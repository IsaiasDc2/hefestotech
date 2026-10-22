// HefestoTech · Formulario público de reclamo (/reclamo).
// ÚNICA ruta nueva fuera de /admin (permitida). Intenta el alta contra el
// backend con la sesión actual; si no hay sesión, ofrece WhatsApp (nivel 1)
// con el texto ya armado a partir de lo que escribió la persona.
import { useState } from "react";
import { Link } from "react-router";
import { WHATSAPP_NUMERO_A_CONFIRMAR, whatsappUrl } from "../../constants/whatsapp";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import { traducirError } from "../../utils/errores";
import { adminApi } from "./adminApi";

export default function ReclamoPublico() {
  const idioma = useIdiomaStore((s) => s.idioma);
  const [form, setForm] = useState({ nombre: "", email: "", orden: "", motivo: "", detalle: "" });
  const [estado, setEstado] = useState("listo");
  const [mensaje, setMensaje] = useState("");

  const textoWhatsApp = () =>
    `${t(idioma, "wa.reclamoIntro")}\n${t(idioma, "wa.reclamoNombre")}: ${form.nombre}\nEmail: ${form.email}\n${t(idioma, "wa.reclamoOrden")}: ${form.orden || "-"}\n${t(idioma, "wa.reclamoMotivo")}: ${form.motivo}\n${t(idioma, "wa.reclamoDetalle")}: ${form.detalle}`;

  const enviar = async (e) => {
    e.preventDefault();
    setEstado("enviando");
    setMensaje("");
    // La API espera UUID de orden; si escriben el código corto se guarda
    // como referencia en el detalle en vez de romper con 404.
    const ordenTxt = form.orden.trim();
    const esUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ordenTxt);
    const detalleFinal = ordenTxt && !esUuid
      ? `Orden indicada: ${ordenTxt}\n${form.detalle.trim()}`.slice(0, 2000)
      : form.detalle.trim();
    try {
      await adminApi.crearReclamo({
        orden_id: esUuid ? ordenTxt : null,
        motivo: `${form.motivo.trim()} — ${form.nombre.trim()} <${form.email.trim()}>`,
        detalle: detalleFinal,
      });
      setEstado("ok");
      setMensaje(t(idioma, "recl.ok"));
      setForm({ nombre: "", email: "", orden: "", motivo: "", detalle: "" });
    } catch (err) {
      const sinSesion = err?.status === 401 || err?.status === 403;
      setEstado(sinSesion ? "sin-sesion" : "error");
      setMensaje(
        err?.status === 401 || err?.status === 403
          ? idioma === "en"
            ? "To file it here you need to be signed in. You can send it via WhatsApp with the button below."
            : "Para registrarlo acá necesitás haber iniciado sesión. Podés enviarlo por WhatsApp con el botón de abajo."
          : (traducirError(err?.message, idioma) ?? t(idioma, "recl.error"))
      );
    }
  };

  return (
    <div className="adm-publico">
      <p className="kicker"><span className="kicker-num">{t(idioma, "nav.ayuda")}</span> HefestoTech</p>
      <h1>{t(idioma, "recl.titulo")}</h1>
      <p className="texto-mutado">
        {t(idioma, "recl.sub")} {idioma === "en" ? "If you prefer, you can also message us on WhatsApp." : "Si preferís, también podés escribirnos por WhatsApp."}{WHATSAPP_NUMERO_A_CONFIRMAR ? (idioma === "en" ? " (number to be confirmed by the owner)" : " (número a confirmar por el dueño)") : ""}.
      </p>
      {estado === "ok" ? (
        <div className="card adm-panel" role="status">
          <p><strong>{mensaje}</strong></p>
          <div className="adm-form-acciones">
            <Link className="btn-fantasma adm-btn" to="/">{t(idioma, "ped.volver")}</Link>
            <Link className="btn-primary adm-btn" to="/cuenta?tab=reclamos">{t(idioma, "cuenta.reclamos")}</Link>
          </div>
        </div>
      ) : (
        <form onSubmit={enviar} className="card adm-panel adm-form">
          <label>{t(idioma, "recl.nombre")} *
            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required maxLength={120} autoComplete="name" />
          </label>
          <label>{t(idioma, "recl.email")} *
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required maxLength={160} autoComplete="email" />
          </label>
          <label>{t(idioma, "recl.pedido")}
            <input value={form.orden} onChange={(e) => setForm({ ...form, orden: e.target.value })} maxLength={60} />
          </label>
          <label>{t(idioma, "recl.motivo")} *
            <input value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} required maxLength={200} placeholder={idioma === "en" ? "E.g. faulty product" : "Ej: producto con falla"} />
          </label>
          <label>{t(idioma, "recl.mensaje")}
            <textarea value={form.detalle} onChange={(e) => setForm({ ...form, detalle: e.target.value })} rows={4} maxLength={2000} />
          </label>
          {mensaje && <p role="alert" className="texto-mutado">{mensaje}</p>}
          <div className="adm-form-acciones">
            <a className="btn-fantasma adm-btn" href={whatsappUrl(textoWhatsApp())} target="_blank" rel="noreferrer">
              {t(idioma, "recl.wa")}
            </a>
            <button type="submit" className="btn-primary adm-btn" disabled={estado === "enviando"}>
              {estado === "enviando" ? t(idioma, "recl.enviando") : t(idioma, "recl.enviar")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
