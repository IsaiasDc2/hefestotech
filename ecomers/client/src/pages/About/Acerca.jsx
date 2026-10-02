import { Link } from "react-router-dom";
import "./Acerca.css";

function Acerca() {
  return (
    <div className="acerca">
      <header className="acerca-hero anim-entrada">
        <p className="badge badge-info hero-kicker">Desde 2020 · Buenos Aires</p>
        <h1>
          Acerca de <span className="titulo-degradado">Nosotros</span>
        </h1>
        <p>
          Armamos y recomendamos componentes de PC con la misma exigencia
          con la que armaríamos nuestra propia máquina.
        </p>
      </header>

      <section className="acerca-stats" aria-label="HefestoTech en números">
        <div className="stat card">
          <strong>5000+</strong>
          <span>Clientes atendidos</span>
        </div>
        <div className="stat card">
          <strong>2020</strong>
          <span>Año de fundación</span>
        </div>
        <div className="stat card">
          <strong>24-48hs</strong>
          <span>Tiempo de envío</span>
        </div>
        <div className="stat card">
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
          <div className="valor-card card">
            <span className="valor-icono" aria-hidden="true">🔧</span>
            <h3>Calidad verificada</h3>
            <p>
              Cada producto pasa control de stock real y garantía oficial
              antes de publicarse.
            </p>
          </div>

          <div className="valor-card card">
            <span className="valor-icono" aria-hidden="true">🚚</span>
            <h3>Envíos rápidos</h3>
            <p>
              Despachamos en 24-48hs y ofrecemos envío gratis en compras
              seleccionadas.
            </p>
          </div>

          <div className="valor-card card">
            <span className="valor-icono" aria-hidden="true">💬</span>
            <h3>Soporte real</h3>
            <p>
              Te ayudamos a elegir la pieza correcta antes de comprar, no
              solo a resolver problemas después.
            </p>
          </div>

          <div className="valor-card card">
            <span className="valor-icono" aria-hidden="true">💳</span>
            <h3>Precios claros</h3>
            <p>
              Cuotas sin interés y sin letra chica: el precio que ves es
              el que pagás.
            </p>
          </div>
        </div>
      </section>

      <section className="acerca-cta">
        <div className="acerca-cta-panel card">
          <h2>¿Listo para armar tu próxima PC?</h2>
          <p>Explorá el catálogo completo de componentes disponibles.</p>
          <div className="acerca-cta-botones">
            <Link to="/productos" className="btn-primary">
              Ver productos
            </Link>
            <Link to="/contactanos" className="btn-fantasma">
              🖥️ Armá tu PC
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Acerca;
