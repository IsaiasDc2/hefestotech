import { Component } from "react";
import { WHATSAPP_URL } from "../constants/whatsapp";
import "./ErrorGeneral.css";

// Textos fijos (ES/EN) que no pasan por el store de idioma, porque podría
// ser lo que falló: el idioma se lee directo de localStorage.
const TEXTOS = {
  es: {
    titulo: "Algo salió mal",
    detalle: "No pudimos cargar la tienda. Probá recargar la página; si sigue pasando, escribinos.",
    recargar: "Recargar",
  },
  en: {
    titulo: "Something went wrong",
    detalle: "We couldn't load the store. Try reloading the page; if it keeps happening, write to us.",
    recargar: "Reload",
  },
};

function textosActuales() {
  try {
    return localStorage.getItem("ht-idioma") === "en" ? TEXTOS.en : TEXTOS.es;
  } catch {
    return TEXTOS.es;
  }
}

/**
 * Red de seguridad de toda la app: si algo falla al renderizar, se muestra
 * esta pantalla en vez de una página en blanco. Es un componente de clase
 * porque React solo captura errores de render con getDerivedStateFromError.
 */
export default class ErrorGeneral extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[app] Error no controlado", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const base = import.meta.env.BASE_URL || "/";
    const texto = textosActuales();
    return (
      <main className="error-general" role="alert">
        <img src={`${base}brand/logo-symbol.webp`} alt="" width="56" height="54" />
        <h1>{texto.titulo}</h1>
        <p>{texto.detalle}</p>
        <div className="error-general-acciones">
          <button type="button" onClick={() => window.location.reload()}>
            {texto.recargar}
          </button>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
        </div>
      </main>
    );
  }
}
