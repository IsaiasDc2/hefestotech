import { Component } from "react";
import { WHATSAPP_URL } from "../constants/whatsapp";
import "./ErrorGeneral.css";

/**
 * Red de seguridad de toda la app: si algo falla al renderizar, se muestra
 * esta pantalla en vez de una página en blanco. Es un componente de clase
 * porque React solo captura errores de render con getDerivedStateFromError.
 * Textos fijos en español: el store de idioma podría ser lo que falló.
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
    return (
      <main className="error-general" role="alert">
        <img src={`${base}brand/logo-symbol.webp`} alt="" width="56" height="54" />
        <h1>Algo salió mal</h1>
        <p>No pudimos cargar la tienda. Probá recargar la página; si sigue pasando, escribinos.</p>
        <div className="error-general-acciones">
          <button type="button" onClick={() => window.location.reload()}>
            Recargar
          </button>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
        </div>
      </main>
    );
  }
}
