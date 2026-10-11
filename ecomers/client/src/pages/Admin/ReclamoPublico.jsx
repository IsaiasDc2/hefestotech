// HefestoTech · Formulario público de reclamo (/reclamo).
// ÚNICA ruta nueva fuera de /admin (permitida). Intenta el alta contra el
// backend con la sesión actual; si no hay sesión, ofrece WhatsApp (nivel 1)
// con el texto ya armado a partir de lo que escribió la persona.
import { useState } from "react";
import { Link } from "react-router-dom";
import { WHATSAPP_NUMERO_A_CONFIRMAR, whatsappUrl } from "../../constants/whatsapp";
import { adminApi } from "./adminApi";

export default function ReclamoPublico() {
  const [form, setForm] = useState({ nombre: "", email: "", orden: "", motivo: "", detalle: "" });
  const [estado, setEstado] = useState("listo");
  const [mensaje, setMensaje] = useState("");

  const textoWhatsApp = () =>
    `Hola HefestoTech, quiero hacer un reclamo.\nNombre: ${form.nombre}\nEmail: ${form.email}\nOrden: ${form.orden || "-"}\nMotivo: ${form.motivo}\nDetalle: ${form.detalle}`;

  const enviar = async (e) => {
    e.preventDefault();
    setEstado("enviando");
    setMensaje("");
    try {
      await adminApi.crearReclamo({
        orden_id: form.orden.trim() || null,
        motivo: `${form.motivo.trim()} — ${form.nombre.trim()} <${form.email.trim()}>`,
        detalle: form.detalle.trim(),
      });
      setEstado("ok");
      setMensaje("Reclamo registrado. Te contactaremos a la brevedad.");
      setForm({ nombre: "", email: "", orden: "", motivo: "", detalle: "" });
    } catch (err) {
      setEstado("sin-sesion");
      setMensaje(
        err?.status === 401 || err?.status === 403
          ? "Para registrarlo acá necesitás haber iniciado sesión. Podés enviarlo por WhatsApp con el botón de abajo."
          : (err?.message ?? "No se pudo registrar. Probá por WhatsApp.")
      );
    }
  };

  return (
    <div className="adm-publico">
      <p className="kicker"><span className="kicker-num">Ayuda</span> HefestoTech</p>
      <h1>Hacer un reclamo</h1>
      <p className="texto-mutado">
        Contanos qué pasó y lo revisamos. Si preferís, también podés escribirnos
        por WhatsApp{WHATSAPP_NUMERO_A_CONFIRMAR ? " (número a confirmar por el dueño)" : ""}.
      </p>
      {estado === "ok" ? (
        <div className="card adm-panel" role="status">
          <p><strong>{mensaje}</strong></p>
          <Link className="btn-fantasma adm-btn" to="/">Volver a la tienda</Link>
        </div>
      ) : (
        <form onSubmit={enviar} className="card adm-panel adm-form">
          <label>Nombre y apellido *
            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required maxLength={120} autoComplete="name" />
          </label>
          <label>Email *
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required maxLength={160} autoComplete="email" />
          </label>
          <label>Número de orden (si lo tenés)
            <input value={form.orden} onChange={(e) => setForm({ ...form, orden: e.target.value })} maxLength={60} />
          </label>
          <label>Motivo *
            <input value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} required maxLength={200} placeholder="Ej: producto con falla" />
          </label>
          <label>Detalle
            <textarea value={form.detalle} onChange={(e) => setForm({ ...form, detalle: e.target.value })} rows={4} maxLength={2000} />
          </label>
          {mensaje && <p role={estado === "sin-sesion" ? "alert" : "status"} className="texto-mutado">{mensaje}</p>}
          <div className="adm-form-acciones">
            <button type="submit" className="btn-primary adm-btn" disabled={estado === "enviando"}>
              {estado === "enviando" ? "Enviando…" : "Enviar reclamo"}
            </button>
            <a className="btn-fantasma adm-btn" href={whatsappUrl(textoWhatsApp())} target="_blank" rel="noreferrer">
              Enviar por WhatsApp
            </a>
          </div>
        </form>
      )}
    </div>
  );
}
