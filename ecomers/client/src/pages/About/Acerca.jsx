import { Link } from "react-router-dom";
import "./Acerca.css";

function Acerca() {
  return (
    <div className="acerca">
      <header className="acerca-hero">
        <h1>Acerca de Nosotros</h1>
        <p>
          Armamos y recomendamos componentes de PC con la misma exigencia
          con la que armaríamos nuestra propia máquina.
        </p>
      </header>

      <section className="acerca-stats">
        <div className="stat">
          <strong>5000+</strong>
          <span>Clientes atendidos</span>
        </div>
        <div className="stat">
          <strong>2020</strong>
          <span>Año de fundación</span>
        </div>
        <div className="stat">
          <strong>24-48hs</strong>
          <span>Tiempo de envío</span>
        </div>
        <div className="stat">
          <strong>4.8★</strong>
          <span>Valoración promedio</span>
        </div>
      </section>

      <section className="acerca-seccion">
        <h2>Nuestra historia</h2>
        <p>
          Empezamos en 2020 vendiendo componentes sueltos a gamers y
          makers de nuestro barrio. Hoy despachamos a todo el país, pero
          seguimos probando cada producto antes de listarlo: si no lo
          usaríamos en nuestra propia PC, no lo vendemos.
        </p>
      </section>

      <section className="acerca-valores">
        <h2>Lo que nos guía</h2>

        <div className="valores-grid">
          <div className="valor-card">
            <span className="valor-icono">🔧</span>
            <h3>Calidad verificada</h3>
            <p>
              Cada producto pasa control de stock real y garantía oficial
              antes de publicarse.
            </p>
          </div>

          <div className="valor-card">
            <span className="valor-icono">🚚</span>
            <h3>Envíos rápidos</h3>
            <p>
              Despachamos en 24-48hs y ofrecemos envío gratis en compras
              seleccionadas.
            </p>
          </div>

          <div className="valor-card">
            <span className="valor-icono">💬</span>
            <h3>Soporte real</h3>
            <p>
              Te ayudamos a elegir la pieza correcta antes de comprar, no
              solo a resolver problemas después.
            </p>
          </div>

          <div className="valor-card">
            <span className="valor-icono">💳</span>
            <h3>Precios claros</h3>
            <p>
              Cuotas sin interés y sin letra chica: el precio que ves es
              el que pagás.
            </p>
          </div>
        </div>
      </section>

      <section className="acerca-cta">
        <h2>¿Listo para armar tu próxima PC?</h2>
        <p>Explorá el catálogo completo de componentes disponibles.</p>
        <div className="acerca-cta-botones">
          <Link to="/" className="acerca-btn">
            Ver productos
          </Link>
          <Link to="/arma-tu-pc" className="acerca-btn acerca-btn-outline">
            🖥️ Armá tu PC
          </Link>
        </div>
      </section>
    </div>
  );
}

export default Acerca;