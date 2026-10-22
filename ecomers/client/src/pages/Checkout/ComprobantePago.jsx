import { useState } from "react";
import { FaReceipt } from "react-icons/fa6";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import { obtenerComprobantePago, subirComprobantePago } from "../../services/orderService";

const ADMITEN = new Set(["pendiente", "pagado", "pagada", "preparacion", "enviada", "entregada"]);
const MAX_BYTES = 8 * 1024 * 1024;
const TIPOS = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

const pesos = (centavos, idioma) =>
  (Number(centavos ?? 0) / 100).toLocaleString(idioma === "en" ? "en-US" : "es-AR", {
    style: "currency",
    currency: "ARS",
  });

/** Subida del comprobante de pago (transferencia, depósito, etc.). */
export default function ComprobantePago({
  ordenId,
  token = "",
  estado = "",
  comprobanteInicial = null,
  montoCentavos = 0,
  onSubido,
}) {
  const idioma = useIdiomaStore((s) => s.idioma);
  const [comp, setComp] = useState(comprobanteInicial);
  const [url, setUrl] = useState("");
  const [formAbierto, setFormAbierto] = useState(!comprobanteInicial);
  const [archivo, setArchivo] = useState(null);
  const [monto, setMonto] = useState(
    montoCentavos ? (Number(montoCentavos) / 100).toFixed(2) : ""
  );
  const [nota, setNota] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");

  if (!ADMITEN.has(String(estado))) return null;

  const elegirArchivo = (e) => {
    setError("");
    setExito("");
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      setArchivo(null);
      return;
    }
    if (!TIPOS.has(f.type)) {
      setError(t(idioma, "pago.compErrorTipo"));
      e.target.value = "";
      setArchivo(null);
      return;
    }
    if (f.size > MAX_BYTES) {
      setError(t(idioma, "pago.compErrorTam"));
      e.target.value = "";
      setArchivo(null);
      return;
    }
    setArchivo(f);
  };

  const subir = async (e) => {
    e.preventDefault();
    setError("");
    setExito("");
    if (!archivo) {
      setError(t(idioma, "pago.compErrorTipo"));
      return;
    }
    const numero = Number(String(monto).replace(",", "."));
    if (!Number.isFinite(numero) || numero < 0) {
      setError(t(idioma, "pago.compErrorMonto"));
      return;
    }
    setSubiendo(true);
    try {
      const r = await subirComprobantePago(ordenId, token, archivo, {
        montoCentavos: Math.round(numero * 100),
        nota: nota.trim(),
      });
      setComp(r?.comprobante ?? null);
      setUrl(r?.archivo_url ?? "");
      setFormAbierto(false);
      setArchivo(null);
      setNota("");
      setExito(t(idioma, "pago.compOk"));
      onSubido?.(r);
    } catch (err) {
      setError(err?.message || t(idioma, "pago.compError"));
    } finally {
      setSubiendo(false);
    }
  };

  const ver = async () => {
    setError("");
    try {
      let destino = url;
      if (!destino) {
        const r = await obtenerComprobantePago(ordenId, token);
        destino = r?.archivo_url ?? "";
        if (destino) setUrl(destino);
      }
      if (!destino) throw new Error(t(idioma, "pago.compError"));
      window.open(destino, "_blank", "noopener");
    } catch (err) {
      setError(err?.message || t(idioma, "pago.compError"));
    }
  };

  return (
    <section className="comprobante-pago" aria-label={t(idioma, "pago.compTitulo")}>
      <h2>{t(idioma, "pago.compTitulo")}</h2>
      <p className="texto-mutado">{t(idioma, "pago.compAyuda")}</p>

      {comp && (
        <div className="comprobante-pago-cargado">
          <p>
            <FaReceipt aria-hidden="true" /> <strong>{t(idioma, "pago.compCargado")}</strong>
            {" · "}{comp.archivo_nombre || "comprobante"}
            {comp.created_at
              ? ` · ${new Date(comp.created_at).toLocaleString(
                  idioma === "en" ? "en-US" : "es-AR",
                  { dateStyle: "short", timeStyle: "short" }
                )}`
              : ""}
            {comp.monto_centavos ? ` · ${pesos(comp.monto_centavos, idioma)}` : ""}
          </p>
          <div className="checkout-acciones">
            <button type="button" className="btn-fantasma" onClick={ver}>
              {t(idioma, "pago.compVer")}
            </button>
            {!formAbierto && (
              <button type="button" className="btn-fantasma" onClick={() => setFormAbierto(true)}>
                {t(idioma, "pago.compOtro")}
              </button>
            )}
          </div>
        </div>
      )}

      {formAbierto && (
        <form className="comprobante-pago-form" onSubmit={subir}>
          <label>{t(idioma, "pago.compArchivo")}
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
              onChange={elegirArchivo}
              required
            />
          </label>
          <div className="comprobante-pago-fila">
            <label>{t(idioma, "pago.compMonto")}
              <input
                inputMode="decimal"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0,00"
              />
            </label>
            <label>{t(idioma, "pago.compNota")}
              <input
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                maxLength={500}
                placeholder={t(idioma, "pago.compNotaPh")}
              />
            </label>
          </div>
          <button type="submit" className="btn-primary" disabled={subiendo}>
            {subiendo ? t(idioma, "pago.compSubiendo") : t(idioma, "pago.compSubir")}
          </button>
        </form>
      )}

      {exito && <p className="badge badge-ok" role="status">{exito}</p>}
      {error && <p className="badge badge-peligro" role="alert">{error}</p>}
    </section>
  );
}
