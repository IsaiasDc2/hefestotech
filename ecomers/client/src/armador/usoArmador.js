import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { supabase } from "../components/lib/supabaseClient";
import useIdiomaStore, { t } from "../store/idiomaStore";
import { obtenerCatalogo } from "../services/productService";
import { evaluarBuild, potenciaEstimada } from "./motor";
import { PASOS, SLOT_MOTOR, TOTAL_PASOS } from "./pasos";
import { adaptarProducto, mapaSpecs, precioFinal } from "./adaptar";

const CLAVE_STORAGE = "hefestotech-armador-v1";

const FILTRO_BASE = Object.freeze({
  q: "",
  marca: "todas",
  max: null,
  orden: "reco",
  verIncomp: false,
});

/** Etiqueta del componente que usa el motor para cada slot del armador. */
const TAG_POR_SLOT = Object.freeze({
  cpu: "cpu",
  mother: "mother",
  ram: "ram",
  gpu: "gpu",
  refrigeracion: "cooler",
  almacenamiento: "almacenamiento",
  gabinete: "gabinete",
  fuente: "fuente",
});

function normalizarProducto(p) {
  return {
    ...p,
    precio: Number(p.precio ?? 0),
    stock: Number(p.stock ?? 0),
    descuento_porcentaje: Number(p.descuento_porcentaje ?? 0),
    imagen: p.imagen || "",
    categoria: p.categoria || "General",
    marca: p.marca || "",
  };
}

function leerStorage() {
  try {
    const crudo = localStorage.getItem(CLAVE_STORAGE);
    if (!crudo) return null;
    const obj = JSON.parse(crudo);
    if (!obj || typeof obj !== "object") return null;
    return obj;
  } catch {
    return null;
  }
}

function estadoInicial(searchParams) {
  const porUrl = {};
  let hayUrl = false;
  for (const paso of PASOS) {
    const v = searchParams.get(`s_${paso.id}`);
    if (v) {
      porUrl[paso.slot] = v;
      hayUrl = true;
    }
  }
  const skipUrl = (searchParams.get("skip") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (skipUrl.length > 0) hayUrl = true;
  const extrasUrl = (searchParams.get("extras") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (extrasUrl.length > 0) hayUrl = true;

  if (hayUrl) {
    return {
      selecciones: porUrl,
      salteados: skipUrl.filter((id) => PASOS.some((p) => p.id === id)),
      extras: extrasUrl,
    };
  }
  const guardado = leerStorage();
  if (guardado) {
    return {
      selecciones:
        guardado.selecciones && typeof guardado.selecciones === "object"
          ? guardado.selecciones
          : {},
      salteados: Array.isArray(guardado.salteados) ? guardado.salteados : [],
      extras: Array.isArray(guardado.extras) ? guardado.extras : [],
    };
  }
  return { selecciones: {}, salteados: [], extras: [] };
}

export function useArmador() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [reintento, setReintento] = useState(0);

  const [iniciado, setIniciado] = useState(false);
  const [paso, setPaso] = useState(0);
  const [verResumen, setVerResumen] = useState(false);
  const [filtrosPorPaso, setFiltrosPorPaso] = useState({});

  const [inicial] = useState(() => estadoInicial(searchParams));
  const [selecciones, setSelecciones] = useState(inicial.selecciones);
  const [salteados, setSalteados] = useState(inicial.salteados);
  const [extras, setExtras] = useState(inicial.extras);

  useEffect(() => {
    let vivo = true;
    async function cargar() {
      try {
        setErrorCarga(false);
        setCargando(true);
        const data = await obtenerCatalogo({ forzar: reintento > 0 });
        let specsPorProducto = new Map();
        try {
          const { data: specs, error: errorSpecs } = await supabase
            .from("product_specs")
            .select("producto_id,clave,valor")
            .eq("verified", true);
          if (errorSpecs) throw errorSpecs;
          specsPorProducto = mapaSpecs(specs);
        } catch {
          specsPorProducto = new Map();
        }
        if (!vivo) return;
        setProductos(
          (data || []).map((p) =>
            normalizarProducto({
              ...p,
              _specs: specsPorProducto.get(p.id) ?? {},
            })
          )
        );
      } catch {
        if (vivo) setErrorCarga(true);
      } finally {
        if (vivo) setCargando(false);
      }
    }
    cargar();
    return () => {
      vivo = false;
    };
  }, [reintento]);

  /* Persistencia: localStorage + URL (reemplaza, sin ensuciar el historial). */
  useEffect(() => {
    try {
      localStorage.setItem(
        CLAVE_STORAGE,
        JSON.stringify({ selecciones, salteados, extras })
      );
    } catch {
      /* almacenamiento lleno o privado: el armador sigue andando */
    }
    const params = new URLSearchParams();
    for (const p of PASOS) {
      if (selecciones[p.slot]) params.set(`s_${p.id}`, selecciones[p.slot]);
    }
    if (salteados.length > 0) params.set("skip", salteados.join(","));
    if (extras.length > 0) params.set("extras", extras.join(","));
    setSearchParams(params, { replace: true });
  }, [selecciones, salteados, extras, setSearchParams]);

  const porId = useMemo(() => {
    const mapa = new Map();
    for (const p of productos) mapa.set(String(p.id), p);
    return mapa;
  }, [productos]);

  /* Build normalizado para el motor (se reevalúa entero ante cada cambio). */
  const build = useMemo(() => {
    const b = {};
    for (const p of PASOS) {
      const id = selecciones[p.slot];
      if (!id) continue;
      const prod = porId.get(String(id));
      if (!prod) continue;
      const spec = adaptarProducto(prod, p.slot);
      if (p.slot === "almacenamiento") b[SLOT_MOTOR[p.slot]] = [spec];
      else b[SLOT_MOTOR[p.slot]] = spec;
    }
    return b;
  }, [selecciones, porId]);

  const evaluacion = useMemo(() => evaluarBuild(build), [build]);

  const consumo = useMemo(() => {
    const cpuW = build.cpu?.tdpW;
    const gpuW = build.gpu ? build.gpu.consumoW : 0;
    return potenciaEstimada({ cpuW, gpuW });
  }, [build]);

  const elegidos = useMemo(() => {
    const lista = [];
    for (const p of PASOS) {
      const id = selecciones[p.slot];
      const prod = id ? porId.get(String(id)) : null;
      lista.push({ paso: p, producto: prod ?? null });
    }
    return lista;
  }, [selecciones, porId]);

  const extrasElegidos = useMemo(
    () => extras.map((id) => porId.get(String(id))).filter(Boolean),
    [extras, porId]
  );

  const total = useMemo(() => {
    let acc = 0;
    for (const { producto } of elegidos) {
      if (producto) acc += precioFinal(producto);
    }
    for (const e of extrasElegidos) acc += precioFinal(e);
    return acc;
  }, [elegidos, extrasElegidos]);

  const cantidad = useMemo(
    () =>
      elegidos.filter((e) => e.producto).length + extrasElegidos.length,
    [elegidos, extrasElegidos]
  );

  /**
   * Estado de un candidato en su paso: reevalúa el build completo con ese
   * candidato puesto y mira las reglas que tocan su componente.
   */
  const estadoCandidato = useCallback(
    (pasoDef, producto) => {
      const tag = TAG_POR_SLOT[pasoDef.slot];
      const spec = adaptarProducto(producto, pasoDef.slot);
      const hipotetico = { ...build };
      if (pasoDef.slot === "almacenamiento") hipotetico.discos = [spec];
      else hipotetico[SLOT_MOTOR[pasoDef.slot]] = spec;
      const ev = evaluarBuild(hipotetico);
      const tocan = ev.resultados.filter((r) =>
        (r.componentes ?? []).includes(tag)
      );
      const errores = tocan.filter((r) => r.estado === "error");
      if (errores.length > 0) {
        return { estado: "incompatible", motivo: errores[0].mensaje };
      }
      const revisar = tocan.filter(
        (r) => r.estado === "warn" || r.estado === "unknown"
      );
      if (revisar.length > 0) {
        return { estado: "revisar", motivo: revisar[0].mensaje };
      }
      return { estado: "compatible", motivo: "Va con lo que ya elegiste." };
    },
    [build]
  );

  const filtros = filtrosPorPaso[paso] ?? FILTRO_BASE;
  const setFiltros = useCallback(
    (parche) => {
      setFiltrosPorPaso((prev) => ({
        ...prev,
        [paso]: { ...(prev[paso] ?? FILTRO_BASE), ...parche },
      }));
    },
    [paso]
  );

  const elegir = useCallback(
    (pasoDef, producto) => {
      setSelecciones((prev) => ({ ...prev, [pasoDef.slot]: producto.id }));
      setSalteados((prev) => prev.filter((id) => id !== pasoDef.id));
    },
    []
  );

  const quitar = useCallback((pasoDef) => {
    setSelecciones((prev) => {
      const copia = { ...prev };
      delete copia[pasoDef.slot];
      return copia;
    });
  }, []);

  const saltear = useCallback((pasoDef) => {
    // Idioma al momento de preguntar (el hook no se suscribe: no hace falta).
    const idioma = useIdiomaStore.getState().idioma;
    const claveTitulo = `arm.paso.${pasoDef.id}`;
    const claveConsecuencia = `arm.cons.${pasoDef.id}`;
    const tituloPaso = t(idioma, claveTitulo);
    const consecuenciaPaso = t(idioma, claveConsecuencia);
    const pregunta = t(idioma, "arm.salteamos").replace(
      "{paso}",
      tituloPaso === claveTitulo ? pasoDef.titulo : tituloPaso
    );
    const texto = pasoDef.esencial
      ? `${pregunta}\n\n${consecuenciaPaso === claveConsecuencia ? pasoDef.consecuencia : consecuenciaPaso}`
      : `${pregunta} ${t(idioma, "arm.salteaVolver")}`;
    if (!window.confirm(texto)) return false;
    quitar(pasoDef);
    setSalteados((prev) =>
      prev.includes(pasoDef.id) ? prev : [...prev, pasoDef.id]
    );
    return true;
  }, [quitar]);

  const quitarSalteado = useCallback((pasoId) => {
    setSalteados((prev) => prev.filter((id) => id !== pasoId));
  }, []);

  const toggleExtra = useCallback((producto) => {
    setExtras((prev) => {
      const id = String(producto.id);
      return prev.map(String).includes(id)
        ? prev.filter((x) => String(x) !== id)
        : [...prev, producto.id];
    });
  }, []);

  const reiniciar = useCallback(() => {
    const idioma = useIdiomaStore.getState().idioma;
    if (!window.confirm(t(idioma, "arm.arrancarConfirm"))) {
      return;
    }
    setSelecciones({});
    setSalteados([]);
    setExtras([]);
    setPaso(0);
    setVerResumen(false);
  }, []);

  const reintentar = useCallback(() => setReintento((n) => n + 1), []);

  return {
    productos,
    porId,
    cargando,
    errorCarga,
    reintentar,
    iniciado,
    setIniciado,
    paso,
    setPaso,
    verResumen,
    setVerResumen,
    filtros,
    setFiltros,
    selecciones,
    salteados,
    extras,
    build,
    evaluacion,
    consumo,
    elegidos,
    extrasElegidos,
    total,
    cantidad,
    estadoCandidato,
    elegir,
    quitar,
    saltear,
    quitarSalteado,
    toggleExtra,
    reiniciar,
  };
}

export { PASOS, TOTAL_PASOS };
export default useArmador;
