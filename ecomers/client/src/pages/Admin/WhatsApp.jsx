// HefestoTech · Admin · WhatsApp Nivel 1: wa.me + plantillas con texto
// prearmado. Nivel 2 (API/automatizaciones) y email: listos y deshabilitados.
import { useState } from "react";
import { WHATSAPP_NUMERO_A_CONFIRMAR, WHATSAPP_URL, whatsappUrl } from "../../constants/whatsapp";
import { Cabecera } from "./ui";

const PLANTILLAS = [
  { id: "estado", titulo: "Estado de pedido", texto: "Hola, soy de HefestoTech. Te escribo por tu pedido #___ que está en estado ___. Cualquier duda respondeme por acá." },
  { id: "reclamo", titulo: "Respuesta de reclamo", texto: "Hola, soy de HefestoTech. Vimos tu reclamo «___» y te contamos cómo seguimos: ___." },
  { id: "stock", titulo: "Aviso de stock", texto: "Hola, soy de HefestoTech. El producto ___ ya volvió a estar disponible: ___." },
  { id: "pago", titulo: "Link de pago", texto: "Hola, soy de HefestoTech. Te paso el link de pago de tu pedido #___: ___." },
];

export default function WhatsApp() {
  const [destino, setDestino] = useState("");
  const [textos, setTextos] = useState(Object.fromEntries(PLANTILLAS.map((p) => [p.id, p.texto])));

  const numeroLimpio = destino.replace(/\D/g, "");

  return (
    <div>
      <Cabecera kicker="Canales" titulo="WhatsApp · Nivel 1" />
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
