// HefestoTech · Admin · Config: solo lectura segura. PROHIBIDO exponer
// secretos: ningún token/clave sale del servidor (ver _redactar en backend).
// Muestra entorno, canal y estado de integraciones apagadas.
import { WHATSAPP_NUMERO_A_CONFIRMAR } from "../../constants/whatsapp";
import { API_BASE } from "./adminApi";
import { Cabecera } from "./ui";

function soloHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return "no configurado";
  }
}

export default function Config() {
  return (
    <div>
      <Cabecera kicker="Sistema" titulo="Configuración" />
      <section className="card adm-panel" aria-label="Entorno">
        <h2>Entorno</h2>
        <ul className="adm-lista">
          <li><span>Modo</span><strong>{import.meta.env.DEV ? "Desarrollo" : "Producción"}</strong></li>
          <li><span>Backend</span><strong>{soloHost(API_BASE)}</strong></li>
          <li><span>Secrets</span><strong>conectado •••• (redactado)</strong></li>
        </ul>
        <p className="texto-mutado">
          Los secretos nunca salen del servidor: acá solo se muestra si hay
          conexión, jamás valores.
        </p>
      </section>
      <section className="card adm-panel" aria-label="Canales">
        <h2>Canales</h2>
        <ul className="adm-lista">
          <li>
            <span>WhatsApp Nivel 1 (wa.me manual){WHATSAPP_NUMERO_A_CONFIRMAR ? " · número a confirmar" : ""}</span>
            <span className="adm-insignia es-ok">Activo</span>
          </li>
          <li><span>WhatsApp Nivel 2 (automático)</span><span className="adm-insignia">Deshabilitado</span></li>
          <li><span>Email transaccional</span><span className="adm-insignia">Deshabilitado</span></li>
        </ul>
      </section>
    </div>
  );
}
