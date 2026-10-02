import { useState } from "react";
import { Link } from "react-router-dom";
import { FaBoxOpen, FaHeart, FaUserPlus, FaArrowRight } from "react-icons/fa6";
import Login from "../Login/Login";
import "./Cuenta.css";

const VISTAS = [
  { id: "login", label: "Ingresar" },
  { id: "registro", label: "Crear cuenta" },
  { id: "pedidos", label: "Mis pedidos" },
  { id: "favoritos", label: "Favoritos" },
];

function Cuenta() {
  const [vista, setVista] = useState("login");

  return (
    <div className="cuenta">
      <p className="badge badge-info hero-kicker">HefestoTech · Mi cuenta</p>
      <nav className="cuenta-tabs" aria-label="Secciones de la cuenta" role="tablist">
        {VISTAS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={vista === v.id}
            className={vista === v.id ? "activo" : ""}
            aria-current={vista === v.id ? "page" : undefined}
            onClick={() => setVista(v.id)}
          >
            {v.label}
          </button>
        ))}
      </nav>
      <div className="contenido" role="tabpanel">
        {vista === "login" && <Login />}

        {vista === "registro" && (
          <div className="panel-cuenta card anim-entrada">
            <p className="badge badge-aviso">Registro asistido</p>
            <h2>Crear cuenta</h2>
            <p>El registro directo aún no está habilitado.</p>
            <p>Escribinos y te creamos la cuenta en el día.</p>
            <div className="vacio">
              <span className="vacio-icono" aria-hidden="true">
                <FaUserPlus />
              </span>
              <p className="vacio-titulo">Te la creamos en el día</p>
              <p className="vacio-texto">Contanos qué necesitás y la dejamos lista.</p>
              <Link to="/contactanos" className="btn-primary">
                Contactanos <FaArrowRight aria-hidden="true" />
              </Link>
            </div>
          </div>
        )}

        {vista === "pedidos" && (
          <div className="panel-cuenta card anim-entrada">
            <p className="badge badge-info">Historial</p>
            <h2>Mis pedidos</h2>
            <p>Todavía no tenés pedidos realizados.</p>
            <div className="vacio">
              <span className="vacio-icono" aria-hidden="true">
                <FaBoxOpen />
              </span>
              <p className="vacio-titulo">Sin pedidos todavía</p>
              <p className="vacio-texto">Cuando compres, el seguimiento aparece acá.</p>
              <Link to="/productos" className="btn-fantasma">
                Ver productos <FaArrowRight aria-hidden="true" />
              </Link>
            </div>
          </div>
        )}

        {vista === "favoritos" && (
          <div className="panel-cuenta card anim-entrada">
            <p className="badge badge-info">Guardados</p>
            <h2>Mis favoritos</h2>
            <p>No tenés productos favoritos.</p>
            <div className="vacio">
              <span className="vacio-icono" aria-hidden="true">
                <FaHeart />
              </span>
              <p className="vacio-titulo">Nada guardado por ahora</p>
              <p className="vacio-texto">Marcá el corazón en un producto y lo ves acá.</p>
              <Link to="/productos" className="btn-fantasma">
                Explorar catálogo <FaArrowRight aria-hidden="true" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Cuenta;
