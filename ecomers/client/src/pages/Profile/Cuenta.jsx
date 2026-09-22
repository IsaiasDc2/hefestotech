import { useState } from "react";
import "./Cuenta.css";
function Cuenta() {
  const [vista, setVista] = useState("login");

  return (
    <div className="cuenta">
      <div className="contenido">
        {vista === "login" && (
          <div className="panel-cuenta">
            <h2>Iniciar sesión</h2>
            <p>Próximamente vas a poder loguearte acá.</p>
          </div>
        )}

        {vista === "registro" && (
          <div className="panel-cuenta">
            <h2>Crear cuenta</h2>
            <p>Próximamente vas a poder registrarte acá.</p>
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