import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  FaCheck,
  FaGlobe,
  FaMoon,
  FaScrewdriverWrench,
  FaSun,
  FaTag,
  FaUser,
  FaUserPlus,
  FaWhatsapp,
  FaXmark,
} from "react-icons/fa6";
import { FILA_CATEGORIAS, IDIOMAS, esClaveActiva } from "./navLinks";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import useTema from "../../hooks/useTema";
import "./MobileDrawer.css";

const WHATSAPP_URL = "https://wa.me/5491112345678";

function MobileDrawer({ abierto, alCerrar }) {
  const panelRef = useRef(null);
  const idioma = useIdiomaStore((s) => s.idioma);
  const setIdioma = useIdiomaStore((s) => s.setIdioma);
  const { tema, alternar } = useTema();
  const location = useLocation();
  const esEn = idioma === "en";

  useEffect(() => {
    if (!abierto) return undefined;
    const focoPrevio = document.activeElement;
    const panel = panelRef.current;
    panel?.querySelector("[data-autofoco]")?.focus();
    const scrollPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const alTeclado = (e) => {
      if (e.key === "Escape") {
        alCerrar();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const focos = panel.querySelectorAll("a[href], button:not([disabled])");
      if (focos.length === 0) return;
      const primero = focos[0];
      const ultimo = focos[focos.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener("keydown", alTeclado);
    return () => {
      document.removeEventListener("keydown", alTeclado);
      document.body.style.overflow = scrollPrevio;
      if (focoPrevio instanceof HTMLElement) focoPrevio.focus();
    };
  }, [abierto, alCerrar]);

  if (!abierto) return null;

  const etiquetaTema = esEn
    ? (tema === "light" ? "Switch to dark mode" : "Switch to light mode")
    : (tema === "light" ? "Cambiar a modo oscuro" : "Cambiar a modo claro");
  const etiquetaMenu = esEn ? "Menu" : "Menú";
  const etiquetaCerrar = esEn ? "Close menu" : "Cerrar menú";

  return (
    <div className="drawer-raiz">
      <div className="drawer-velo" onClick={alCerrar} aria-hidden="true" />
      <div
        ref={panelRef}
        id="menu-movil"
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label={etiquetaMenu}
      >
        <div className="drawer-cabecera">
          <span className="drawer-marca">HefestoTech</span>
          <button
            type="button"
            data-autofoco
            className="drawer-cerrar"
            onClick={alCerrar}
            aria-label={etiquetaCerrar}
          >
            <FaXmark aria-hidden="true" />
          </button>
        </div>

        <nav className="drawer-nav" aria-label={etiquetaMenu}>
          <div className="drawer-grupo">
            <Link to="/cuenta?modo=registro" className="drawer-link" onClick={alCerrar}>
              <FaUserPlus aria-hidden="true" />
              <span>{t(idioma, "nav.registrate")}</span>
            </Link>
            <Link to="/cuenta" className="drawer-link" onClick={alCerrar}>
              <FaUser aria-hidden="true" />
              <span>{t(idioma, "nav.sesion")}</span>
            </Link>
          </div>

          <p className="drawer-titulo" id="drawer-titulo-comercial">
            {t(idioma, "nav.categorias")}
          </p>
          <div className="drawer-grupo" aria-labelledby="drawer-titulo-comercial">
            {FILA_CATEGORIAS.map((c) => {
              const activa = esClaveActiva(location.pathname, location.search, c.clave);
              const esArma = c.clave === "combo";
              const esOutlet = c.clave === "outlet";
              const clase = [
                "drawer-link",
                esArma ? "drawer-link--arma" : "",
                esOutlet ? "drawer-link--outlet" : "",
                activa ? "activo" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <Link
                  key={c.clave}
                  to={c.to}
                  className={clase}
                  aria-current={activa ? "page" : undefined}
                  onClick={alCerrar}
                >
                  {esArma && <FaScrewdriverWrench aria-hidden="true" />}
                  {esOutlet && <FaTag aria-hidden="true" />}
                  <span>{t(idioma, c.labelKey)}</span>
                </Link>
              );
            })}
          </div>

          <p className="drawer-titulo" id="drawer-titulo-ayuda">
            {t(idioma, "nav.ayuda")}
          </p>
          <div className="drawer-grupo" aria-labelledby="drawer-titulo-ayuda">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              className="drawer-link"
            >
              <FaWhatsapp aria-hidden="true" />
              <span>WhatsApp</span>
            </a>
            <Link to="/acerca" className="drawer-link" onClick={alCerrar}>
              <span>{t(idioma, "nav.ayuda")}</span>
            </Link>
            <Link to="/contactanos" className="drawer-link" onClick={alCerrar}>
              <span>{t(idioma, "nav.posventa")}</span>
            </Link>
          </div>

          <p className="drawer-titulo" id="drawer-titulo-prefs">
            {t(idioma, "topbar.idioma")}
          </p>
          <div className="drawer-grupo" aria-labelledby="drawer-titulo-prefs">
            <button
              type="button"
              className="drawer-link drawer-btn"
              onClick={alternar}
              aria-pressed={tema === "light"}
              aria-label={etiquetaTema}
              title={etiquetaTema}
            >
              {tema === "light" ? (
                <FaSun aria-hidden="true" />
              ) : (
                <FaMoon aria-hidden="true" />
              )}
              <span>{etiquetaTema}</span>
            </button>
            <div className="drawer-idiomas" role="group" aria-label={t(idioma, "topbar.idioma")}>
              <FaGlobe aria-hidden="true" className="drawer-idiomas-icono" />
              {IDIOMAS.map((op) => (
                <button
                  key={op.codigo}
                  type="button"
                  className={`drawer-idioma${idioma === op.codigo ? " activo" : ""}`}
                  aria-pressed={idioma === op.codigo}
                  onClick={() => setIdioma(op.codigo)}
                >
                  {idioma === op.codigo && <FaCheck aria-hidden="true" />}
                  {op.etiqueta}
                </button>
              ))}
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}

export default MobileDrawer;
