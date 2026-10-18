// HefestoTech · Admin · primitivas compartidas: toasts, skeletons, vacíos,
// "Próximamente" y tabla responsive (→tarjetas). Hooks en hooks.jsx.

// --- toasts (estado en useToasts, hooks.jsx) ---
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
      {accion && <div className="adm-vacio-accion">{accion}</div>}
    </div>
  );
}

export function Proximamente({ modulo, detalle = "", accion = null }) {
  return (
    <section className="card adm-panel" aria-label={`${modulo} no disponible`}>
      <span className="adm-insignia">Próximamente</span>
      <h2>{modulo}</h2>
      <p className="texto-mutado">
        Este módulo está deshabilitado porque el servicio no respondió o tu rol
        no tiene acceso.
        {detalle ? ` Detalle: ${detalle}` : ""}
      </p>
      {accion && <div className="adm-form-acciones">{accion}</div>}
    </section>
  );
}

export function SinPermiso({ modulo, accion = null }) {
  return (
    <section className="card adm-panel" aria-label="Sin permiso">
      <span className="adm-insignia es-aviso">Sin permiso</span>
      <h2>{modulo}</h2>
      <p className="texto-mutado">
        Tu rol no tiene acceso a este módulo. Si creés que es un error,
        escribinos desde la página de contacto.
      </p>
      {accion && <div className="adm-form-acciones">{accion}</div>}
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
