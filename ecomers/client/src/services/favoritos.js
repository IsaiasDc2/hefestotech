import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../components/lib/supabaseClient";

// HefestoTech · Favoritos reales.
// - Sin sesion: localStorage versionado (hefestotech-favoritos-v1).
// - Con sesion: tabla publica.favoritos (RLS propia "favoritos propios").
// - Al iniciar sesion: merge local -> remoto (upsert sin duplicados).
// - Entre pestanas: evento "storage" mantiene el contador y la lista.

export const FAVORITOS_CLAVE = "hefestotech-favoritos-v1";
export const FAVORITOS_VERSION = 1;

function normalizarIds(valor) {
  if (!Array.isArray(valor)) return [];
  const vistos = new Set();
  const ids = [];
  for (const item of valor) {
    const id = String(item ?? "").trim();
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    ids.push(id);
  }
  return ids;
}

export function leerIdsLocales() {
  try {
    const crudo = window.localStorage.getItem(FAVORITOS_CLAVE);
    if (!crudo) return [];
    const json = JSON.parse(crudo);
    if (json && json.v === FAVORITOS_VERSION) return normalizarIds(json.ids);
    if (Array.isArray(json)) return normalizarIds(json);
    return [];
  } catch (_) {
    return [];
  }
}

export function guardarIdsLocales(ids) {
  try {
    window.localStorage.setItem(
      FAVORITOS_CLAVE,
      JSON.stringify({ v: FAVORITOS_VERSION, ids: normalizarIds(ids) })
    );
  } catch (_) {
    // Almacenamiento lleno o bloqueado: la lista en memoria sigue valiendo.
  }
}

export function suscribirIdsLocales(callback) {
  const alCambiar = (evento) => {
    if (evento.key === FAVORITOS_CLAVE) callback(leerIdsLocales());
  };
  window.addEventListener("storage", alCambiar);
  return () => window.removeEventListener("storage", alCambiar);
}

async function obtenerUsuarioId() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id || null;
}

export async function obtenerIdsRemotos() {
  const userId = await obtenerUsuarioId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from("favoritos")
    .select("producto_id")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return normalizarIds((data || []).map((f) => f.producto_id));
}

export async function agregarFavoritoRemoto(productoId) {
  const userId = await obtenerUsuarioId();
  if (!userId) return;
  const { error } = await supabase
    .from("favoritos")
    .upsert(
      { user_id: userId, producto_id: productoId },
      { onConflict: "user_id,producto_id", ignoreDuplicates: true }
    );
  if (error) throw new Error(error.message);
}

export async function quitarFavoritoRemoto(productoId) {
  const userId = await obtenerUsuarioId();
  if (!userId) return;
  const { error } = await supabase
    .from("favoritos")
    .delete()
    .eq("user_id", userId)
    .eq("producto_id", productoId);
  if (error) throw new Error(error.message);
}

// Une lo guardado sin sesion con la tabla remota. Devuelve los ids finales.
export async function fusionarAlLogin() {
  const userId = await obtenerUsuarioId();
  if (!userId) return leerIdsLocales();
  const locales = leerIdsLocales();
  let remotos = [];
  try {
    remotos = (await obtenerIdsRemotos()) || [];
  } catch (_) {
    return locales;
  }
  const unidos = normalizarIds([...remotos, ...locales]);
  const faltantes = unidos.filter((id) => !remotos.includes(id));
  if (faltantes.length > 0) {
    try {
      const { error } = await supabase.from("favoritos").upsert(
        faltantes.map((producto_id) => ({ user_id: userId, producto_id })),
        { onConflict: "user_id,producto_id", ignoreDuplicates: true }
      );
      if (error) throw new Error(error.message);
    } catch (_) {
      // Sin red o RLS: se conserva la copia local y se reintenta luego.
    }
  }
  guardarIdsLocales(unidos);
  return unidos;
}

// Trae los productos por id y separa visibles de ocultos
// (inexistentes o con activo = false). Los ocultos se avisan, no se rompen.
export async function obtenerProductosPorIds(ids) {
  const lista = normalizarIds(ids);
  if (lista.length === 0) return { visibles: [], ocultosIds: [] };
  const { data, error } = await supabase
    .from("productos")
    .select("*")
    .in("id", lista);
  if (error) throw new Error(error.message);
  const porId = new Map((data || []).map((p) => [String(p.id), p]));
  const visibles = [];
  const ocultosIds = [];
  for (const id of lista) {
    const fila = porId.get(String(id));
    if (fila && fila.activo !== false) visibles.push(fila);
    else ocultosIds.push(id);
  }
  return { visibles, ocultosIds };
}

// Hook principal: alternado optimista con reversion ante error remoto,
// "pop" del ultimo cambio para animar el corazon y aviso con deshacer.
export function useFavoritos() {
  const [ids, setIds] = useState(() => leerIdsLocales());
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [popId, setPopId] = useState(null);
  const [ultimoQuitado, setUltimoQuitado] = useState(null);
  // Espejo mutable: los quitados en lote o seguidos siempre parten de
  // la lista fresca, no de la clausura del render.
  const idsRef = useRef(leerIdsLocales());

  const fijarIds = useCallback((siguientes) => {
    const lista = normalizarIds(siguientes);
    idsRef.current = lista;
    setIds(lista);
    guardarIdsLocales(lista);
  }, [idsRef]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const userId = await obtenerUsuarioId();
        if (!userId) {
          if (vivo) {
            const locales = leerIdsLocales();
            idsRef.current = locales;
            setIds(locales);
          }
        } else {
          const unidos = await fusionarAlLogin();
          if (vivo) {
            idsRef.current = unidos;
            setIds(unidos);
          }
        }
      } catch (err) {
        if (vivo) {
          setIds(leerIdsLocales());
          setError(err?.message || "No se pudieron cargar los favoritos.");
        }
      } finally {
        if (vivo) setCargando(false);
      }
    });
    const desuscribirStorage = suscribirIdsLocales((nuevos) => {
      if (vivo) {
        idsRef.current = nuevos;
        setIds(nuevos);
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (evento) => {
      if (!vivo) return;
      if (evento === "SIGNED_IN") {
        try {
          const unidos = await fusionarAlLogin();
          if (vivo) {
            idsRef.current = unidos;
            setIds(unidos);
          }
        } catch (err) {
          if (vivo) setError(err?.message || "No se pudieron unir los favoritos.");
        }
      } else if (evento === "SIGNED_OUT") {
        if (vivo) {
          const locales = leerIdsLocales();
          idsRef.current = locales;
          setIds(locales);
          setUltimoQuitado(null);
        }
      }
    });
    return () => {
      vivo = false;
      desuscribirStorage();
      subscription.unsubscribe();
    };
  }, []);

  const persistir = useCallback(async (siguientes, operacion) => {
    const previos = idsRef.current;
    fijarIds(siguientes);
    const userId = await obtenerUsuarioId().catch(() => null);
    if (!userId) return true;
    try {
      await operacion();
      return true;
    } catch (err) {
      // Reversion: vuelve la lista anterior en memoria y en localStorage.
      fijarIds(previos);
      setError(err?.message || "No se pudo guardar el favorito.");
      return false;
    }
  }, [fijarIds, idsRef]);

  const agregar = useCallback(
    async (productoId) => {
      const id = String(productoId);
      if (idsRef.current.includes(id)) return true;
      setPopId(id);
      return persistir([...idsRef.current, id], () => agregarFavoritoRemoto(id));
    },
    [persistir, idsRef]
  );

  const quitar = useCallback(
    async (productoId, nombre) => {
      const id = String(productoId);
      if (!idsRef.current.includes(id)) return true;
      setPopId(id);
      setUltimoQuitado({ id, nombre: nombre || "Producto" });
      return persistir(
        idsRef.current.filter((x) => x !== id),
        () => quitarFavoritoRemoto(id)
      );
    },
    [persistir, idsRef]
  );

  // Quitado en lote (p. ej. limpiar no disponibles): una sola operacion
  // remota y sin clausuras rancias entre items.
  const quitarMuchos = useCallback(
    async (listaIds) => {
      const lote = normalizarIds(listaIds).filter((id) => idsRef.current.includes(id));
      if (lote.length === 0) return true;
      const previos = idsRef.current;
      const siguientes = previos.filter((x) => !lote.includes(x));
      setPopId(lote[lote.length - 1]);
      setUltimoQuitado(null);
      fijarIds(siguientes);
      const userId = await obtenerUsuarioId().catch(() => null);
      if (!userId) return true;
      try {
        const { error: errBorrado } = await supabase
          .from("favoritos")
          .delete()
          .eq("user_id", userId)
          .in("producto_id", lote);
        if (errBorrado) throw new Error(errBorrado.message);
        return true;
      } catch (err) {
        fijarIds(previos);
        setError(err?.message || "No se pudieron quitar los favoritos.");
        return false;
      }
    },
    [fijarIds, idsRef]
  );

  const alternar = useCallback(
    async (productoId, nombre) => {
      const id = String(productoId);
      if (idsRef.current.includes(id)) return quitar(id, nombre);
      const ok = await agregar(id);
      return ok;
    },
    [agregar, quitar, idsRef]
  );

  const deshacerQuitado = useCallback(async () => {
    if (!ultimoQuitado) return false;
    const ok = await agregar(ultimoQuitado.id);
    if (ok) setUltimoQuitado(null);
    return ok;
  }, [ultimoQuitado, agregar]);

  const esFavorito = useCallback((productoId) => ids.includes(String(productoId)), [ids]);

  return {
    ids,
    cantidad: ids.length,
    cargando,
    error,
    popId,
    ultimoQuitado,
    esFavorito,
    agregar,
    quitar,
    quitarMuchos,
    alternar,
    deshacerQuitado,
    limpiarError: () => setError(""),
  };
}

// Contador liviano para el header: lee la misma clave versionada y
// sigue los cambios entre pestanas. Lleva a /cuenta?tab=favoritos.
export function useCantidadFavoritos() {
  const [cantidad, setCantidad] = useState(() => leerIdsLocales().length);
  useEffect(() => suscribirIdsLocales((ids) => setCantidad(ids.length)), []);
  return cantidad;
}

export default useFavoritos;
