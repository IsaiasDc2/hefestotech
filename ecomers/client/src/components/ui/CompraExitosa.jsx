import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { FaArrowRight } from "react-icons/fa6";
import useIdiomaStore, { t } from "../../store/idiomaStore";

const CLAVE = (id) => `ht-celebrado-${id}`;

function yaCelebrado(id) {
  try {
    return sessionStorage.getItem(CLAVE(id)) === "1";
  } catch {
    return false;
  }
}

// Pantalla de festejo cuando el pago quedó acreditado: fondo azul, check que
// se dibuja y "¡Comprado con éxito!". Se muestra una vez por orden; se cierra
// con el botón, con Escape o tocando afuera. Solo con el estado REAL de la
// orden (lo decide quien la usa), nunca por volver de Mercado Pago.
export default function CompraExitosa({ ordenId, codigo = "", destino = "" }) {
  const idioma = useIdiomaStore((s) => s.idioma);
  const [abierta, setAbierta] = useState(() => Boolean(ordenId) && !yaCelebrado(ordenId));
  const botonRef = useRef(null);

  useEffect(() => {
    if (!abierta) return undefined;
    try {
      sessionStorage.setItem(CLAVE(ordenId), "1");
    } catch {
      /* sin storage: puede volver a festejar, no rompe nada */
    }
    botonRef.current?.focus();
    const alTeclear = (e) => {
      if (e.key === "Escape") setAbierta(false);
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierta, ordenId]);

  if (!abierta) return null;

  return (
    <div
      className="compra-ok"
      role="dialog"
      aria-modal="true"
      aria-labelledby="compra-ok-titulo"
      onClick={(e) => {
        if (e.target === e.currentTarget) setAbierta(false);
      }}
    >
      <div className="compra-ok-cuerpo">
        <span className="compra-ok-anillos" aria-hidden="true">
          <i />
          <i />
        </span>
        <svg className="compra-ok-check" viewBox="0 0 96 96" aria-hidden="true">
          <circle className="compra-ok-circulo" cx="48" cy="48" r="42" />
          <path className="compra-ok-tilde" d="M30 50 l12 12 l24 -26" />
        </svg>
        <h2 id="compra-ok-titulo">{t(idioma, "ok.titulo")}</h2>
        <p>
          {t(idioma, "ok.texto")}
          {codigo ? (
            <>
              {" "}
              {t(idioma, "ok.orden")} <strong>{codigo}</strong>.
            </>
          ) : null}
        </p>
        <div className="compra-ok-acciones">
          {destino ? (
            <Link ref={botonRef} to={destino} className="compra-ok-btn" onClick={() => setAbierta(false)}>
              {t(idioma, "ok.verPedido")} <FaArrowRight aria-hidden="true" />
            </Link>
          ) : null}
          <button
            ref={destino ? undefined : botonRef}
            type="button"
            className="compra-ok-btn compra-ok-btn--suave"
            onClick={() => setAbierta(false)}
          >
            {t(idioma, "ok.continuar")}
          </button>
        </div>
      </div>
    </div>
  );
}
