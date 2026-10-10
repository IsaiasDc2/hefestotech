// HefestoTech · Admin · primitivas compartidas: toasts, confirmación,
// skeletons, vacíos, "Próximamente", tabla responsive (→tarjetas) y useModulo.
import { useCallback, useEffect, useRef, useState } from "react";

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

  useEffect(
    () => () => {
      temporizadores.current.forEach((t) => clearTimeout(t));
    },
    []
  );

  return { lista, avisar, cerrar };
}

export function ZonaToasts({ lista, onCerrar }) {
  return (
    <div className="adm-toasts" role="status" aria-live="polite">
      {lista.map((t) => (
        <div key={t.id} className={`adm-toast es-${t.tono}`}>
          <span>{t.texto}</span>
          {t.accion && (
            <button
              type="button"
              className="adm-toast-accion"
              onClick={() => {
                t.accion.alHacer();
                onCerrar(t.id);
              }}
            >
              {t.accion.etiqueta}
            </button>
          )}
          <button
            type="button"
            className="adm-toast-x"
            aria-label="Cerrar aviso"
            onClick={() => onCerrar(t.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
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
export function useModulo(cargador, deps = []) {
  const [estado, setEstado] = useState("cargando");
  const [datos, setDatos] = useState(null);
  const [detalle, setDetalle] = useState("");

  const recargar = useCallback(async () => {
    setEstado("cargando");
    setDetalle("");
    try {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const r = await cargador();
      setDatos(r);
      setEstado("ok");
    } catch (e) {
      if (e?.status === 403) {
        setEstado("sin-permiso");
      } else {
        setEstado("no-disponible");
        setDetalle(e?.message ?? "");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await cargador();
        if (vivo) {
          setDatos(r);
          setEstado("ok");
        }
      } catch (e) {
        if (!vivo) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { estado, datos, detalle, recargar, setDatos };
}

export function Skeleton({ lineas = 4, etiqueta = "Cargando…" }) {
  return (
    <div className="adm-skeleton" role="status" aria-label={etiqueta}>
      {Array.from({ length: lineas }).map((_, i) => (
        <span key={i} className="adm-skeleton-linea" />
      ))}
    </div>
  );
}

export function Vacio({ titulo, texto, accion = null }) {
  return (
    <div className="adm-vacio">
      <p className="adm-vacio-titulo">{titulo}</p>
      {texto && <p className="adm-vacio-texto">{texto}</p>}
      {accion}
    </div>
  );
}

export function Proximamente({ modulo, detalle = "" }) {
  return (
    <section className="card adm-panel" aria-label={`${modulo} no disponible`}>
      <span className="adm-insignia">Próximamente</span>
      <h2>{modulo}</h2>
      <p className="texto-mutado">
        Este módulo está deshabilitado porque el servicio no respondió o tu rol
        no tiene acceso.
        {detalle ? ` Detalle: ${detalle}` : ""}
      </p>
    </section>
  );
}

export function SinPermiso({ modulo }) {
  return (
    <section className="card adm-panel" aria-label="Sin permiso">
      <span className="adm-insignia es-aviso">Sin permiso</span>
      <h2>{modulo}</h2>
      <p className="texto-mutado">
        Tu rol no tiene acceso a este módulo. Si creés que es un error,
        escribinos desde la página de contacto.
      </p>
    </section>
  );
}

// Tabla responsive: en móvil cada fila es una tarjeta (td::before con data-th).
export function Tabla({ columnas, filas, filaKey, vacio = "Sin datos." }) {
  if (!filas?.length) return <Vacio titulo={vacio} />;
  return (
    <div className="adm-tabla-scroll">
      <table className="adm-tabla">
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c.clave} scope="col">
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={filaKey(f)}>
              {columnas.map((c) => (
                <td key={c.clave} data-th={c.titulo}>
                  {c.ver ? c.ver(f) : (f[c.clave] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Cabecera({ kicker, titulo, insignia = null, acciones = null }) {
  return (
    <header className="adm-cab">
      <div>
        <p className="kicker">
          <span className="kicker-num">{kicker}</span> Admin
        </p>
        <h1>{titulo}</h1>
      </div>
      <div className="adm-cab-lado">
        {insignia}
        {acciones}
      </div>
    </header>
  );
}
