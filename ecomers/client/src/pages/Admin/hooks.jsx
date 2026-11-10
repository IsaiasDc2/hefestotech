// HefestoTech · Admin · hooks compartidos: toasts, confirmación y useModulo.
// Separados de ui.jsx para que Fast Refresh trate ese archivo como solo-componentes.
import { useCallback, useEffect, useRef, useState } from "react";
import { PASO_CARGA } from "../../hooks/useCargarMas";

// --- toasts (con acción opcional, p. ej. Deshacer 10s) ---
let proximoId = 1;

export function useToasts() {
  const [lista, setLista] = useState([]);
  const temporizadores = useRef(new Map());

  const cerrar = useCallback((id) => {
    setLista((l) => l.filter((t) => t.id !== id));
    const t = temporizadores.current.get(id);
    if (t) {
      clearTimeout(t);
      temporizadores.current.delete(id);
    }
  }, []);

  const avisar = useCallback(
    (texto, { tono = "ok", accion = null, ms = 5000 } = {}) => {
      const id = proximoId++;
      setLista((l) => [...l.slice(-3), { id, texto, tono, accion }]);
      const t = setTimeout(() => cerrar(id), accion ? accion.ms ?? 10000 : ms);
      temporizadores.current.set(id, t);
      return id;
    },
    [cerrar]
  );

  useEffect(() => {
    const mapa = temporizadores.current;
    return () => {
      mapa.forEach((t) => clearTimeout(t));
    };
  }, []);

  return { lista, avisar, cerrar };
}

// --- confirmación accesible (devuelve Promise<boolean>) ---
export function useConfirm() {
  const [peticion, setPeticion] = useState(null);
  const resolver = useRef(null);

  const pedir = useCallback(
    ({ titulo, texto, confirmar = "Confirmar", peligro = false }) =>
      new Promise((res) => {
        resolver.current = res;
        setPeticion({ titulo, texto, confirmar, peligro });
      }),
    []
  );

  const responder = useCallback((valor) => {
    setPeticion(null);
    resolver.current?.(valor);
    resolver.current = null;
  }, []);

  useEffect(() => {
    if (!peticion) return;
    const alTeclar = (e) => {
      if (e.key === "Escape") responder(false);
    };
    window.addEventListener("keydown", alTeclar);
    return () => window.removeEventListener("keydown", alTeclar);
  }, [peticion, responder]);

  const dialogo = peticion ? (
    <div
      className="adm-velo"
      role="alertdialog"
      aria-modal="true"
      aria-label={peticion.titulo}
      onClick={() => responder(false)}
    >
      <div className="adm-dialogo" onClick={(e) => e.stopPropagation()}>
        <h2>{peticion.titulo}</h2>
        <p>{peticion.texto}</p>
        <div className="adm-dialogo-acciones">
          <button
            type="button"
            className="btn-fantasma adm-btn"
            onClick={() => responder(false)}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={`adm-btn ${peticion.peligro ? "adm-btn-peligro" : "btn-primary"}`}
            onClick={() => responder(true)}
            autoFocus
          >
            {peticion.confirmar}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { pedir, dialogo };
}

// --- carga de módulo: ok | cargando | sin-permiso (403) | no-disponible ---
// Cualquier endpoint que falla deja el módulo deshabilitado ("Próximamente").
// `deps` (primitivos) decide cuándo recargar; `cargador` es un closure nuevo en
// cada render, así que se guarda el último en un ref en vez de ser dependencia.
export function useModulo(cargador, deps = []) {
  const [estado, setEstado] = useState("cargando");
  const [datos, setDatos] = useState(null);
  const [detalle, setDetalle] = useState("");
  const [actualizando, setActualizando] = useState(false);
  const cargadorRef = useRef(cargador);
  const pedidoRef = useRef(0);
  const clave = JSON.stringify(deps);

  // Declarado antes del efecto de carga: corre primero en el mismo commit.
  useEffect(() => {
    cargadorRef.current = cargador;
  });

  // Con datos ya en pantalla, recargar (filtro, "Cargar más") no vuelve al
  // esqueleto: la lista queda visible y se reemplaza cuando llega la nueva.
  const hayDatosRef = useRef(false);

  const recargar = useCallback(async () => {
    const pedido = ++pedidoRef.current;
    if (!hayDatosRef.current) setEstado("cargando");
    setActualizando(true);
    setDetalle("");
    try {
      const r = await cargadorRef.current();
      if (pedido !== pedidoRef.current) return;
      hayDatosRef.current = true;
      setDatos(r);
      setEstado("ok");
      setActualizando(false);
    } catch (e) {
      if (pedido !== pedidoRef.current) return;
      setActualizando(false);
      if (e?.status === 403) {
        setEstado("sin-permiso");
      } else {
        setEstado("no-disponible");
        setDetalle(e?.message ?? "");
      }
    }
  }, []);

  useEffect(() => {
    let vivo = true;
    const pedido = ++pedidoRef.current;
    (async () => {
      if (!hayDatosRef.current) setEstado("cargando");
      setActualizando(true);
      setDetalle("");
      try {
        const r = await cargadorRef.current();
        if (vivo && pedido === pedidoRef.current) {
          hayDatosRef.current = true;
          setDatos(r);
          setEstado("ok");
          setActualizando(false);
        }
      } catch (e) {
        if (!vivo || pedido !== pedidoRef.current) return;
        setActualizando(false);
        if (e?.status === 403) setEstado("sin-permiso");
        else {
          setEstado("no-disponible");
          setDetalle(e?.message ?? "");
        }
      }
    })();
    return () => {
      vivo = false;
    };
  }, [clave]);

  return { estado, datos, detalle, recargar, setDatos, actualizando };
}

// --- "Cargar más" del listado ---
// Se piden los primeros `por` registros (de a PASO_CARGA) desde el offset 0;
// "Cargar más" agranda el límite y la lista crece en el lugar. Vuelve al
// primer tramo cuando cambia `claveFiltros` (búsqueda, estado, etc.).
// Conserva la forma { pagina, por, offset, irA, cambiarPor } que usan los
// módulos, así ninguno cambia su llamada a la API.
export function usePaginacion(claveFiltros = "", porInicial = PASO_CARGA) {
  const [estado, setEstado] = useState({ clave: claveFiltros, por: porInicial });
  const por = estado.clave === claveFiltros ? estado.por : porInicial;
  const cambiarPor = useCallback(
    (n) => setEstado({ clave: claveFiltros, por: Math.max(porInicial, Number(n) || porInicial) }),
    [claveFiltros, porInicial]
  );
  const irA = useCallback(() => {}, []);
  return { pagina: 1, por, offset: 0, irA, cambiarPor, paso: porInicial };
}
