import { supabase } from "../components/lib/supabaseClient";

export const normalizarProducto = (p = {}) => {
  const precio = Number(p.precio ?? 0);
  const descuento = Number(p.descuento_porcentaje ?? 0);
  const conDescuento =
    p.precio_con_descuento != null
      ? Number(p.precio_con_descuento)
      : descuento > 0
        ? Math.round(precio * (1 - descuento / 100))
        : precio;
  return {
    ...p,
    precio,
    descuento_porcentaje: descuento,
    precio_con_descuento: conDescuento,
    stock: Number(p.stock ?? 0),
    imagen: p.imagen || "",
    categoria: p.categoria || "General",
    envio_gratis: Boolean(p.envio_gratis),
    destacado: Boolean(p.destacado),
  };
};

export const precioFinal = (producto = {}) => {
  if (producto.precio_con_descuento != null)
    return Number(producto.precio_con_descuento);
  const descuento = Number(producto.descuento_porcentaje ?? 0);
  const precio = Number(producto.precio ?? 0);
  if (descuento > 0) return Math.round(precio * (1 - descuento / 100));
  return precio;
};

// Solo lo publicable: activo y fuera de la papelera (deleted_at, mig. 005).
// La RLS de lectura es pública, así que el filtro tiene que ir siempre.
const consultaVisibles = () =>
  supabase.from("productos").select("*").eq("activo", true).is("deleted_at", null);

export const obtenerProductos = async () => {
  const { data, error } = await consultaVisibles();
  if (error) throw new Error(error.message);
  return (Array.isArray(data) ? data : []).map(normalizarProducto);
};

// Caché corta en memoria: home → catálogo → ficha no vuelve a pedir todo.
const TTL_CATALOGO_MS = 60_000;
let cacheCatalogo = null;

export const obtenerCatalogo = ({ forzar = false } = {}) => {
  const vigente = cacheCatalogo && Date.now() - cacheCatalogo.en < TTL_CATALOGO_MS;
  if (!forzar && vigente) return cacheCatalogo.promesa;
  const promesa = obtenerProductos().catch((err) => {
    cacheCatalogo = null;
    throw err;
  });
  cacheCatalogo = { en: Date.now(), promesa };
  return promesa;
};

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const obtenerProductoPorId = async (id) => {
  // Un id que no es UUID no puede existir: "no encontrado", no "error de red".
  if (!ES_UUID.test(String(id ?? ""))) return null;
  const { data, error } = await consultaVisibles().eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? normalizarProducto(data) : null;
};

export const buscarProductos = async (query) => {
  // Saneado para el filtro `.or()` de PostgREST: `,` separaría condiciones
  // y `*` es comodín; `()` y comillas no aportan a la búsqueda y endurecen
  // el patrón. El cliente nunca arma SQL, pero tampoco inyecta filtros.
  const q = String(query ?? "").replace(/[%_,*()"'\\;!]/g, "").trim();
  if (!q) return obtenerProductos();
  const { data, error } = await consultaVisibles()
    .or(`nombre.ilike.%${q}%,descripcion.ilike.%${q}%,marca.ilike.%${q}%`);
  if (error) throw new Error(error.message);
  return (Array.isArray(data) ? data : []).map(normalizarProducto);
};

export const obtenerProductosDestacados = async (limite = 8) => {
  const { data, error } = await consultaVisibles()
    .eq("destacado", true)
    .limit(limite);
  if (error) throw new Error(error.message);
  return (Array.isArray(data) ? data : []).map(normalizarProducto);
};

export const obtenerOfertas = async (limite = 10) => {
  const { data, error } = await consultaVisibles()
    .gt("descuento_porcentaje", 0)
    .limit(limite);
  if (error) throw new Error(error.message);
  return (Array.isArray(data) ? data : []).map(normalizarProducto);
};

export const obtenerCategorias = async () => {
  const { data, error } = await supabase
    .from("categorias")
    .select("*")
    .order("nombre");
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data : [];
};
