import { useState } from "react";
import { Link } from "react-router";
import { FaGoogle, FaLock, FaUser, FaEnvelope } from "react-icons/fa";
import useAuthStore from "../../store/authStore";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import Marca from "../../components/brand/Marca";
import "./Login.css";

function Login({ onIrRegistro }) {
  const idioma = useIdiomaStore((s) => s.idioma);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = useAuthStore((state) => state.login);
  const cargando = useAuthStore((state) => state.cargando);
  const error = useAuthStore((state) => state.error);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const usuario = useAuthStore((state) => state.usuario);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await login(email, password);
  };

  if (isAuthenticated && usuario) {
    return (
      <div className="login-pagina">
        <div className="login card anim-entrada">
          <h2>{t(idioma, "login.sesionIniciada")}</h2>
          <p className="texto-mutado">{t(idioma, "login.sesionComo")} {usuario.email}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-pagina">
      <form className="login card anim-entrada" onSubmit={handleSubmit}>
        <p className="badge badge-info hero-kicker kicker-marca">
          <Marca variante="simbolo" ancho={22} alto={22} decorativa />
          HefestoTech
        </p>
        <h2>{t(idioma, "login.titulo")}</h2>

        <div className="input-con-icono">
          <label htmlFor="login-email" className="sr-only">
            {t(idioma, "login.emailPh")}
          </label>
          <FaEnvelope className="input-icono" aria-hidden="true" />
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder={t(idioma, "login.emailPh")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="input-con-icono">
          <label htmlFor="login-pass" className="sr-only">
            {t(idioma, "login.passPh")}
          </label>
          <FaLock className="input-icono" aria-hidden="true" />
          <input
            id="login-pass"
            type="password"
            autoComplete="current-password"
            placeholder={t(idioma, "login.passPh")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <p className="badge badge-peligro login-error" role="alert">
            {error}
          </p>
        )}

        <div className="opciones-login">

          <Link to="/contactanos">
            <FaLock className="icono-link" aria-hidden="true" />
            {t(idioma, "login.olvidaste")}
          </Link>
        </div>

        <button type="submit" className="btn-primary" disabled={cargando}>
          {cargando ? t(idioma, "login.ingresando") : t(idioma, "login.ingresar")}
        </button>

        <div className="separador" aria-hidden="true">
          <span>{t(idioma, "login.o")}</span>
        </div>

          <button type="button" className="btn-fantasma" title={t(idioma, "login.google")} disabled aria-disabled="true">
          <FaGoogle aria-hidden="true" />
          {t(idioma, "login.google")}
        </button>

        <p className="registro">
          <FaUser className="icono-link" aria-hidden="true" />
          {t(idioma, "login.sinCuenta")}{" "}
          {onIrRegistro ? (
            <button type="button" className="registro-link" onClick={onIrRegistro}>
              <strong>{t(idioma, "login.crear")}</strong>
            </button>
          ) : (
            <Link to="/cuenta"><strong>{t(idioma, "login.crear")}</strong></Link>
          )}
        </p>
      </form>
    </div>
  );
}

export default Login;
