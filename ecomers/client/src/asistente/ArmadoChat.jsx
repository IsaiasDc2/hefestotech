import { useState } from "react";
import { Link } from "react-router";
import { FaCartPlus, FaCheck } from "react-icons/fa6";
import useIdiomaStore, { t } from "../store/idiomaStore";
import { formatearPesos } from "../utils/dinero";
import { comprable } from "./conversacion";

/** PC recomendada por recommend_build: lista, total y alta en lote al carrito. */
function ArmadoChat({ armado, alAgregarTodo, alNavegar }) {
  const idioma = useIdiomaStore((s) => s.idioma);
  const [agregado, setAgregado] = useState(false);
  const comprables = armado.productos.filter(comprable);

  const agregar = () => {
    alAgregarTodo(comprables);
    setAgregado(true);
  };

  return (
    <section className="asistente-armado" aria-label={t(idioma, "as.armado")}>
      <ul>
        {armado.productos.map((p) => (
          <li key={p.id}>
            <Link to={p.url} onClick={alNavegar}>{p.nombre}</Link>
            <span>{p.precio_a_confirmar ? t(idioma, "as.aConfirmar") : formatearPesos(p.precio)}</span>
          </li>
        ))}
      </ul>
      <p className="asistente-armado-total">
        <span>{t(idioma, "as.total")}</span>
        <strong>{formatearPesos(armado.total)}</strong>
      </p>
      {(armado.veredicto === "con_pendientes" || !armado.dentro_del_presupuesto) && (
        <p className="asistente-armado-nota">
          {!armado.dentro_del_presupuesto ? t(idioma, "as.fueraPresupuesto") : t(idioma, "as.pendientes")}
        </p>
      )}
      <button type="button" onClick={agregar} disabled={!comprables.length || agregado}>
        {agregado ? <FaCheck aria-hidden="true" /> : <FaCartPlus aria-hidden="true" />}
        {agregado ? t(idioma, "as.agregadoTodo") : t(idioma, "as.agregarTodo")}
      </button>
    </section>
  );
}

export default ArmadoChat;
