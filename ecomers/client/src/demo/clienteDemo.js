/**
 * HefestoTech · Cliente Supabase de demostración (solo lectura, en memoria).
 *
 * Se activa desde supabaseClient.js cuando no hay credenciales en
 * desarrollo o con VITE_DEMO=1. Emula el subconjunto del query builder de
 * PostgREST que usa la tienda (select/eq/in/or/order/limit/single…) sobre
 * src/demo/catalogo.json, así las páginas no necesitan ramas "si es demo".
 *
 * Todo lo que escribe (insert/update/upsert/delete/rpc) y la autenticación
 * devuelven un error explícito: en demo no hay cuentas ni pedidos reales.
 */

const BASE = import.meta.env.BASE_URL || "/";

const ERROR_DEMO = Object.freeze({
  code: "DEMO",
  message: "Modo demo: esta acción necesita conectar Supabase.",
});
const ERROR_AUTH = Object.freeze({
  code: "DEMO",
  message: "Modo demo: las cuentas se habilitan al conectar Supabase.",
});

let catalogoPromesa = null;
function cargarCatalogo() {
  catalogoPromesa ??= import("./catalogo.json").then((m) => m.default ?? m);
  return catalogoPromesa;
}

async function filasDe(tabla) {
  const catalogo = await cargarCatalogo();
  switch (tabla) {
    case "productos":
      return catalogo.productos.map((p) => ({
        ...p,
        imagen: p.imagen && !/^https?:\/\//.test(p.imagen) ? `${BASE}${p.imagen}` : p.imagen,
      }));
    case "categorias":
      return catalogo.categorias;
    case "product_specs":
      return catalogo.product_specs;
    default:
      // ordenes, perfiles, favoritos, reclamos…: sin sesión no hay filas.
      return [];
  }
}

/* ---------- Comparadores estilo PostgREST ---------- */
const comoTexto = (v) => (v == null ? "" : String(v));
const normalizar = (s) =>
  comoTexto(s)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

function patronLike(patron, insensible) {
  const escapado = comoTexto(patron)
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/[%*]/g, ".*")
    .replace(/_/g, ".");
  return new RegExp(`^${escapado}$`, insensible ? "is" : "s");
}

function comparar(valor, op, esperado) {
  switch (op) {
    case "eq":
      return valor === esperado || comoTexto(valor) === comoTexto(esperado);
    case "neq":
      return !(valor === esperado || comoTexto(valor) === comoTexto(esperado));
    case "gt":
      return Number(valor) > Number(esperado);
    case "gte":
      return Number(valor) >= Number(esperado);
    case "lt":
      return Number(valor) < Number(esperado);
    case "lte":
      return Number(valor) <= Number(esperado);
    case "in":
      return esperado.map(comoTexto).includes(comoTexto(valor));
    case "is":
      return esperado === null ? valor == null : valor === esperado;
    case "like":
      return patronLike(esperado, false).test(comoTexto(valor));
    case "ilike":
      return patronLike(normalizar(esperado), true).test(normalizar(valor));
    default:
      return true;
  }
}

function valorDeFiltro(op, crudo) {
  if (op === "is") return crudo === "null" ? null : crudo === "true";
  if (op === "in") return crudo.replace(/^\(|\)$/g, "").split(",");
  return crudo;
}

// "nombre.ilike.%rtx%,marca.eq.AMD" → [{col, op, valor}]
function parsearOr(expresion) {
  return String(expresion)
    .split(",")
    .map((parte) => {
      const [col, op, ...resto] = parte.split(".");
      return { col, op, valor: valorDeFiltro(op, resto.join(".")) };
    })
    .filter((c) => c.col && c.op);
}

/* ---------- Query builder ---------- */
class ConsultaDemo {
  constructor(tabla) {
    this.tabla = tabla;
    this.filtros = [];
    this.ordenes = [];
    this.desde = 0;
    this.hasta = Infinity;
    this.modo = "lista";
    this.columnas = "*";
    this.opcionesSelect = {};
    this.escritura = false;
  }

  select(columnas = "*", opciones = {}) {
    this.columnas = columnas;
    this.opcionesSelect = opciones;
    return this;
  }

  filtro(col, op, valor) {
    this.filtros.push((fila) => comparar(fila[col], op, valor));
    return this;
  }
  eq(col, v) { return this.filtro(col, "eq", v); }
  neq(col, v) { return this.filtro(col, "neq", v); }
  gt(col, v) { return this.filtro(col, "gt", v); }
  gte(col, v) { return this.filtro(col, "gte", v); }
  lt(col, v) { return this.filtro(col, "lt", v); }
  lte(col, v) { return this.filtro(col, "lte", v); }
  in(col, v) { return this.filtro(col, "in", Array.from(v ?? [])); }
  is(col, v) { return this.filtro(col, "is", v); }
  like(col, v) { return this.filtro(col, "like", v); }
  ilike(col, v) { return this.filtro(col, "ilike", v); }
  filter(col, op, v) { return this.filtro(col, op, valorDeFiltro(op, comoTexto(v))); }
  match(objeto) {
    for (const [col, v] of Object.entries(objeto ?? {})) this.eq(col, v);
    return this;
  }
  not(col, op, v) {
    const valor = valorDeFiltro(op, comoTexto(v));
    this.filtros.push((fila) => !comparar(fila[col], op, valor));
    return this;
  }
  or(expresion) {
    const condiciones = parsearOr(expresion);
    this.filtros.push((fila) => condiciones.some((c) => comparar(fila[c.col], c.op, c.valor)));
    return this;
  }
  order(col, { ascending = true } = {}) {
    this.ordenes.push({ col, asc: ascending });
    return this;
  }
  limit(n) {
    this.hasta = this.desde + Math.max(0, Number(n) || 0) - 1;
    return this;
  }
  range(desde, hasta) {
    this.desde = desde;
    this.hasta = hasta;
    return this;
  }
  single() {
    this.modo = "single";
    return this;
  }
  maybeSingle() {
    this.modo = "maybeSingle";
    return this;
  }

  // Escrituras: se aceptan en la cadena pero responden con error demo.
  insert() { this.escritura = true; return this; }
  update() { this.escritura = true; return this; }
  upsert() { this.escritura = true; return this; }
  delete() { this.escritura = true; return this; }

  async ejecutar() {
    if (this.escritura) return { data: null, error: ERROR_DEMO, count: null, status: 403 };

    let filas = (await filasDe(this.tabla)).filter((f) => this.filtros.every((fn) => fn(f)));
    const total = filas.length;

    if (this.ordenes.length) {
      filas = [...filas].sort((a, b) => {
        for (const { col, asc } of this.ordenes) {
          const va = a[col];
          const vb = b[col];
          if (va === vb) continue;
          const cmp =
            typeof va === "number" && typeof vb === "number"
              ? va - vb
              : comoTexto(va).localeCompare(comoTexto(vb), "es");
          return asc ? cmp : -cmp;
        }
        return 0;
      });
    }

    filas = filas.slice(this.desde, this.hasta === Infinity ? undefined : this.hasta + 1);

    if (this.columnas && this.columnas !== "*") {
      const cols = this.columnas.split(",").map((c) => c.trim()).filter(Boolean);
      filas = filas.map((f) => Object.fromEntries(cols.map((c) => [c, f[c]])));
    }

    const count = this.opcionesSelect.count ? total : null;
    if (this.opcionesSelect.head) return { data: null, error: null, count, status: 200 };

    if (this.modo === "single") {
      if (filas.length !== 1) {
        return {
          data: null,
          error: { code: "PGRST116", message: "No se encontró el registro." },
          count,
          status: 406,
        };
      }
      return { data: structuredClone(filas[0]), error: null, count, status: 200 };
    }
    if (this.modo === "maybeSingle") {
      return { data: filas[0] ? structuredClone(filas[0]) : null, error: null, count, status: 200 };
    }
    return { data: structuredClone(filas), error: null, count, status: 200 };
  }

  then(resolver, rechazar) {
    return this.ejecutar().then(resolver, rechazar);
  }
}

const sinSesion = async () => ({ data: { session: null }, error: null });

export function crearClienteDemo() {
  return {
    modoDemo: true,
    from: (tabla) => new ConsultaDemo(tabla),
    rpc: async () => ({ data: null, error: ERROR_DEMO }),
    channel: () => ({ on() { return this; }, subscribe() { return this; }, unsubscribe() {} }),
    removeChannel: async () => "ok",
    storage: {
      from: () => ({
        getPublicUrl: (ruta) => ({ data: { publicUrl: ruta } }),
        upload: async () => ({ data: null, error: ERROR_DEMO }),
        remove: async () => ({ data: null, error: ERROR_DEMO }),
      }),
    },
    auth: {
      getSession: sinSesion,
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: async () => ({ data: { user: null, session: null }, error: ERROR_AUTH }),
      signUp: async () => ({ data: { user: null, session: null }, error: ERROR_AUTH }),
      signInWithOAuth: async () => ({ data: null, error: ERROR_AUTH }),
      resetPasswordForEmail: async () => ({ data: null, error: ERROR_AUTH }),
      updateUser: async () => ({ data: { user: null }, error: ERROR_AUTH }),
      signOut: async () => ({ error: null }),
    },
  };
}
