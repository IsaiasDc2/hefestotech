// HefestoTech · Admin · WhatsApp: pestaña "Bandeja" (reclamos como
// conversaciones con KPIs reales) + "Manual y plantillas" (Nivel 1: wa.me con
// texto prearmado). Nivel 2 (API/automatizaciones) y email: deshabilitados.
// Nada se envía solo: responder por WhatsApp siempre abre wa.me para revisar.
import { useEffect, useState } from "react";
import { WHATSAPP_NUMERO_A_CONFIRMAR, WHATSAPP_URL, whatsappUrl } from "../../constants/whatsapp";
import { api } from "./adminApi";
import { Cabecera, Proximamente, SinPermiso, Skeleton, Vacio, useModulo } from "./ui";

const PLANTILLAS = [
  { id: "estado", titulo: "Estado de pedido", texto: "Hola, soy de HefestoTech. Te escribo por tu pedido #___ que está en estado ___. Cualquier duda respondeme por acá." },
  { id: "reclamo", titulo: "Respuesta de reclamo", texto: "Hola, soy de HefestoTech. Vimos tu reclamo «___» y te contamos cómo seguimos: ___." },
  { id: "stock", titulo: "Aviso de stock", texto: "Hola, soy de HefestoTech. El producto ___ ya volvió a estar disponible: ___." },
  { id: "pago", titulo: "Link de pago", texto: "Hola, soy de HefestoTech. Te paso el link de pago de tu pedido #___: ___." },
];

// Fecha relativa rioplatense corta ("hace 5 min", "ayer"). Solo display.
function hace(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return "recién";
  if (s < 3600) {
    const m = Math.floor(s / 60);
    return `hace ${m} min`;
  }
  if (s < 86400) {
    const h = Math.floor(s / 3600);
    return `hace ${h} h`;
  }
  if (s < 172800) return "ayer";
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

function horaCorta(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function snippet(conversacion, largo = 90) {
  const fuente = conversacion.ultimo?.texto?.trim() || conversacion.detalle?.trim() || conversacion.motivo?.trim() || "";
  return fuente.length > largo ? `${fuente.slice(0, largo).trim()}…` : fuente;
}

function textoWhatsAppRespuesta(conversacion, borrador) {
  const cliente = conversacion.cliente && conversacion.cliente !== "Invitado" ? ` ${conversacion.cliente}` : "";
  const seguimiento = borrador.trim() ? borrador.trim() : "___";
  return (
    `Hola${cliente}, soy de HefestoTech. ` +
    `Vimos tu reclamo «${conversacion.motivo || "tu consulta"}» y te contamos cómo seguimos: ${seguimiento}`
  );
}

function Bandeja({ avisar }) {
  const { estado, datos, recargar } = useModulo(() => api("/api/admin/bandeja"), []);
  const [elegido, setElegido] = useState(null);
  const [hilo, setHilo] = useState({ estado: "vacio", mensajes: [] });
  const [borrador, setBorrador] = useState("");
  const [guardando, setGuardando] = useState(false);

  const conversaciones = datos?.conversaciones ?? [];
  const kpis = datos?.kpis ?? { abiertos_hoy: 0, sin_responder_48h: 0, por_estado: {} };
  const actual = conversaciones.find((c) => c.id === elegido) ?? null;

  useEffect(() => {
    // Si la lista cambia (recarga/filtro), soltar la selección fantasma.
    if (elegido && !conversaciones.some((c) => c.id === elegido)) {
      setElegido(null);
      setHilo({ estado: "vacio", mensajes: [] });
    }
  }, [datos]);

  useEffect(() => {
    if (!elegido) {
      setHilo({ estado: "vacio", mensajes: [] });
      setBorrador("");
      return;
    }
    let vivo = true;
    setHilo({ estado: "cargando", mensajes: [] });
    setBorrador("");
    api(`/api/admin/reclamos/${encodeURIComponent(elegido)}/mensajes`)
      .then((r) => {
        if (vivo) setHilo({ estado: "ok", mensajes: r?.mensajes ?? [] });
      })
      .catch(() => {
        if (vivo) setHilo({ estado: "error", mensajes: [] });
      });
    return () => {
      vivo = false;
    };
  }, [elegido]);

  const guardarNota = async () => {
    const texto = borrador.trim();
    if (!actual || !texto || guardando) return;
    setGuardando(true);
    try {
      await api(`/api/admin/reclamos/${encodeURIComponent(actual.id)}/mensajes`, {
        method: "POST",
        body: { texto, autor: "staff" },
      });
      avisar("Nota interna guardada.");
      setBorrador("");
      const r = await api(`/api/admin/reclamos/${encodeURIComponent(actual.id)}/mensajes`);
      setHilo({ estado: "ok", mensajes: r?.mensajes ?? [] });
      recargar();
    } catch (err) {
      avisar(err?.message ?? "No se pudo guardar la nota.", { tono: "error" });
    } finally {
      setGuardando(false);
    }
  };

  if (estado === "cargando") return <Skeleton lineas={6} etiqueta="Cargando bandeja…" />;
  if (estado === "sin-permiso") return <SinPermiso modulo="Bandeja" />;
  if (estado === "no-disponible") return <Proximamente modulo="Bandeja" />;

  const porEstado = Object.entries(kpis.por_estado ?? {});

  return (
    <div className="ht-bandeja">
      <dl className="adm-kpis" aria-label="Indicadores de la bandeja">
        <div className="card adm-kpi">
          <dt className="adm-kpi-etiqueta">Abiertos hoy</dt>
          <dd className="adm-kpi-valor">{kpis.abiertos_hoy ?? 0}</dd>
        </div>
        <div className="card adm-kpi">
          <dt className="adm-kpi-etiqueta">Sin respuesta +48 h</dt>
          <dd className="adm-kpi-valor">{kpis.sin_responder_48h ?? 0}</dd>
        </div>
        <div className="card adm-kpi">
          <dt className="adm-kpi-etiqueta">Por estado</dt>
          <dd className="adm-kpi-valor ht-band-estados">
            {porEstado.length === 0 ? (
              <span className="texto-mutado">—</span>
            ) : (
              porEstado.map(([nombre, cantidad]) => (
                <span key={nombre} className={`adm-estado es-${nombre}`}>
                  {nombre}: {cantidad}
                </span>
              ))
            )}
          </dd>
        </div>
      </dl>

      {conversaciones.length === 0 ? (
        <Vacio
          titulo="Sin conversaciones"
          texto="Todavía no hay reclamos para atender. Cuando entre uno, aparece acá como conversación."
        />
      ) : (
        <div className="ht-band-columnas">
          <section className="card ht-band-lista-panel" aria-label="Conversaciones">
            <h2>Conversaciones ({conversaciones.length})</h2>
            <ul className="ht-band-lista">
              {conversaciones.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`ht-band-item${c.id === elegido ? " es-activo" : ""}`}
                    onClick={() => setElegido(c.id)}
                    aria-current={c.id === elegido ? "true" : undefined}
                    aria-label={`${c.cliente || "Invitado"}, ${c.motivo}, estado ${c.estado}, ${hace(c.ultimo?.created_at ?? c.created_at)}`}
                  >
                    <span className="ht-band-item-head">
                      <strong>{c.cliente || "Invitado"}</strong>
                      <span className={`adm-estado es-${c.estado}`}>{c.estado}</span>
                    </span>
                    <span className="ht-band-item-motivo">{c.motivo || "Sin motivo"}</span>
                    <span className="ht-band-item-snippet texto-mutado">{snippet(c)}</span>
                    <span className="ht-band-item-fecha texto-mutado">{hace(c.ultimo?.created_at ?? c.created_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="card ht-band-hilo-panel" aria-label="Hilo de la conversación" aria-live="polite">
            {!actual ? (
              <Vacio titulo="Elegí una conversación" texto="Tocá un reclamo de la lista para ver el hilo y responder." />
            ) : (
              <>
                <header className="ht-band-hilo-head">
                  <div>
                    <h2>{actual.cliente || "Invitado"}</h2>
                    <p className="texto-mutado">
                      {actual.motivo}
                      {actual.orden_id ? ` · Orden ${String(actual.orden_id).slice(0, 8)}` : ""}
                    </p>
                  </div>
                  <span className={`adm-estado es-${actual.estado}`}>{actual.estado}</span>
                </header>

                {actual.detalle && (
                  <blockquote className="ht-band-detalle">
                    <span className="texto-mutado">Detalle del reclamo · {horaCorta(actual.created_at)}</span>
                    <p>{actual.detalle}</p>
                  </blockquote>
                )}

                {hilo.estado === "cargando" && <Skeleton lineas={3} etiqueta="Cargando mensajes…" />}
                {hilo.estado === "error" && (
                  <p role="alert" className="texto-mutado">
                    No se pudieron cargar los mensajes.{" "}
                    <button type="button" className="btn-fantasma adm-mini" onClick={() => setElegido(null)}>
                      Volver a la lista
                    </button>
                  </p>
                )}
                {hilo.estado === "ok" && hilo.mensajes.length === 0 && (
                  <p className="texto-mutado">Todavía no hay mensajes internos en este reclamo.</p>
                )}
                {hilo.estado === "ok" && hilo.mensajes.length > 0 && (
                  <ol className="ht-band-hilo">
                    {hilo.mensajes.map((m) => (
                      <li
                        key={m.id}
                        className={`ht-burbuja es-${m.autor === "staff" ? "propia" : m.autor === "sistema" ? "sistema" : "cliente"}`}
                      >
                        <span className="ht-burbuja-autor texto-mutado">
                          {m.autor === "staff" ? "Staff" : m.autor === "sistema" ? "Sistema" : "Cliente"}
                        </span>
                        <p>{m.texto}</p>
                        <time className="texto-mutado" dateTime={m.created_at}>
                          {horaCorta(m.created_at)}
                        </time>
                      </li>
                    ))}
                  </ol>
                )}

                <div className="ht-band-respuesta">
                  <label htmlFor="ht-band-borrador">Respuesta (se guarda como nota interna)
                    <textarea
                      id="ht-band-borrador"
                      value={borrador}
                      onChange={(e) => setBorrador(e.target.value)}
                      rows={3}
                      maxLength={2000}
                      placeholder="Escribí la respuesta…"
                    />
                  </label>
                  <div className="adm-form-acciones">
                    <button
                      type="button"
                      className="btn-primary adm-btn"
                      onClick={guardarNota}
                      disabled={!borrador.trim() || guardando}
                    >
                      {guardando ? "Guardando…" : "Guardar nota interna"}
                    </button>
                    <a
                      className="btn-fantasma adm-btn"
                      href={whatsappUrl(textoWhatsAppRespuesta(actual, borrador))}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Abrir WhatsApp con la respuesta prearmada (no se envía solo)"
                    >
                      Responder por WhatsApp
                    </a>
                  </div>
                  <p className="texto-mutado ht-band-aviso">
                    Nada se envía solo: el botón abre WhatsApp con el texto prearmado para que lo revises antes de mandar.
                  </p>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Manual() {
  const [destino, setDestino] = useState("");
  const [textos, setTextos] = useState(Object.fromEntries(PLANTILLAS.map((p) => [p.id, p.texto])));

  const numeroLimpio = destino.replace(/\D/g, "");

  return (
    <div>
      <section className="card adm-panel" aria-label="Abrir chat">
        <h2>Abrir chat manual</h2>
        <p className="texto-mutado">
          Nivel 1: contacto humano por enlace wa.me. Nada se envía solo; siempre
          se abre WhatsApp para que lo revises antes de mandar.
          {WHATSAPP_NUMERO_A_CONFIRMAR && " Número de la tienda a confirmar por el dueño."}
        </p>
        <div className="adm-buscador-linea">
          <input
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            placeholder="Número del cliente (ej: 54911…)"
            aria-label="Número del cliente"
            inputMode="tel"
          />
          <a
            className="btn-primary adm-btn"
            href={numeroLimpio ? `https://wa.me/${numeroLimpio}` : WHATSAPP_URL}
            target="_blank"
            rel="noreferrer"
          >
            Abrir WhatsApp
          </a>
        </div>
      </section>
      <section className="card adm-panel" aria-label="Plantillas">
        <h2>Plantillas</h2>
        <ul className="adm-tarjetas">
          {PLANTILLAS.map((p) => (
            <li key={p.id} className="card adm-plantilla">
              <strong>{p.titulo}</strong>
              <textarea
                value={textos[p.id]}
                onChange={(e) => setTextos({ ...textos, [p.id]: e.target.value })}
                rows={4}
                aria-label={`Texto de plantilla ${p.titulo}`}
              />
              <a
                className="btn-fantasma adm-btn"
                href={whatsappUrl(`Asunto: ${p.titulo}\n${textos[p.id]}`)}
                target="_blank"
                rel="noreferrer"
              >
                Usar en WhatsApp
              </a>
            </li>
          ))}
        </ul>
      </section>
      <section className="card adm-panel" aria-label="Canales deshabilitados">
        <h2>Canales deshabilitados</h2>
        <ul className="adm-lista">
          <li>
            <span>WhatsApp Nivel 2 (envíos automáticos por API)</span>
            <span className="adm-insignia">Deshabilitado</span>
          </li>
          <li>
            <span>Email transaccional</span>
            <span className="adm-insignia">Deshabilitado</span>
          </li>
        </ul>
        <p className="texto-mutado">La integración está preparada pero apagada: no se envía nada por estos canales.</p>
      </section>
    </div>
  );
}

const PESTANAS = [
  { id: "bandeja", etiqueta: "Bandeja" },
  { id: "manual", etiqueta: "Manual y plantillas" },
];

export default function WhatsApp({ avisar = () => {} }) {
  const [pestana, setPestana] = useState("bandeja");

  const alTeclarPestanas = (e) => {
    const i = PESTANAS.findIndex((p) => p.id === pestana);
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const siguiente =
      PESTANAS[(i + (e.key === "ArrowRight" ? 1 : PESTANAS.length - 1)) % PESTANAS.length];
    setPestana(siguiente.id);
    document.getElementById(`ht-tab-${siguiente.id}`)?.focus();
  };

  return (
    <div>
      <Cabecera kicker="Canales" titulo="WhatsApp" />
      <div className="ht-tabs" role="tablist" aria-label="Secciones de WhatsApp" onKeyDown={alTeclarPestanas}>
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            id={`ht-tab-${p.id}`}
            type="button"
            role="tab"
            aria-selected={pestana === p.id}
            aria-controls={`ht-panel-${p.id}`}
            tabIndex={pestana === p.id ? 0 : -1}
            className={`ht-tab${pestana === p.id ? " es-activo" : ""}`}
            onClick={() => setPestana(p.id)}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>
      <div
        id={`ht-panel-${pestana}`}
        role="tabpanel"
        aria-labelledby={`ht-tab-${pestana}`}
      >
        {pestana === "bandeja" ? <Bandeja avisar={avisar} /> : <Manual />}
      </div>
    </div>
  );
}
