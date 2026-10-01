import { useState } from "react";
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
      <nav className="cuenta-tabs" aria-label="Secciones de la cuenta">
        {VISTAS.map((v) => (
          <button
            key={v.id}
            type="button"
            className={vista === v.id ? "activo" : ""}
            aria-current={vista === v.id ? "page" : undefined}
            onClick={() => setVista(v.id)}
          >
            {v.label}
          </button>
        ))}
      </nav>
      <div className="contenido">
        {vista === "login" && <Login />}

        {vista === "registro" && (
          <div className="panel-cuenta">
            <h2>Crear cuenta</h2>
            <p>El registro directo aún no está habilitado.</p>
            <p>Escribinos y te creamos la cuenta en el día.</p>
          </div>
        )}

        {vista === "pedidos" && (
          <div className="panel-cuenta">
            <h2>Mis pedidos</h2>
            <p>Todavía no tenés pedidos realizados.</p>
          </div>
        )}

        {vista === "favoritos" && (
          <div className="panel-cuenta">
            <h2>Mis favoritos</h2>
            <p>No tenés productos favoritos.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Cuenta;
