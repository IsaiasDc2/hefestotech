import { useState } from "react";
import { Link } from "react-router-dom";
import { FaGoogle, FaGithub, FaLock, FaUser, FaEnvelope } from "react-icons/fa";
import useAuthStore from "../../store/authStore";
import "./Login.css";

function Login({ onIrRegistro }) {
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
          <h2>Sesión iniciada</h2>
          <p className="texto-mutado">Estás ingresado como {usuario.email}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-pagina">
      <form className="login card anim-entrada" onSubmit={handleSubmit}>
        <p className="badge badge-info hero-kicker">
          <FaLock aria-hidden="true" /> HefestoTech
        </p>
        <h2>Iniciar sesión</h2>

        <div className="input-con-icono">
          <FaEnvelope className="input-icono" aria-hidden="true" />
          <input
            type="email"
            placeholder="Correo electrónico"
            aria-label="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="input-con-icono">
          <FaLock className="input-icono" aria-hidden="true" />
          <input
            type="password"
            placeholder="Contraseña"
            aria-label="Contraseña"
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
          <label>
            <input type="checkbox" />
            Recordarme
          </label>

          <Link to="/contactanos">
            <FaLock className="icono-link" aria-hidden="true" />
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        <button type="submit" className="btn-primary" disabled={cargando}>
          {cargando ? "Ingresando..." : "Ingresar"}
        </button>

        <div className="separador" aria-hidden="true">
          <span>o</span>
        </div>

        <button type="button" className="btn-fantasma" title="Disponible próximamente" disabled aria-disabled="true">
          <FaGoogle aria-hidden="true" />
          Continuar con Google
        </button>

        <button type="button" className="btn-fantasma" title="Disponible próximamente" disabled aria-disabled="true">
          <FaGithub aria-hidden="true" />
          Continuar con GitHub
        </button>

        <p className="registro">
          <FaUser className="icono-link" aria-hidden="true" />
          ¿No tenés una cuenta?{" "}
          {onIrRegistro ? (
            <button type="button" className="registro-link" onClick={onIrRegistro}>
              <strong>Crear cuenta</strong>
            </button>
          ) : (
            <Link to="/cuenta"><strong>Crear cuenta</strong></Link>
          )}
        </p>
      </form>
    </div>
  );
}

export default Login;
