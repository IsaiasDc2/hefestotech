import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaGoogle, FaGithub, FaLock, FaUser } from "react-icons/fa";
import useAuthStore from "../../store/authStore";
import "./Login.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const cargando = useAuthStore((state) => state.cargando);
  const error = useAuthStore((state) => state.error);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await login(email, password);
  };

  if (isAuthenticated) {
    navigate("/cuenta");
  }

  return (
    <form className="login" onSubmit={handleSubmit}>
      <h2>Iniciar sesión</h2>

      <input
        type="email"
        placeholder="Correo electrónico"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <input
        type="password"
        placeholder="Contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      {error && <p className="login-error">{error}</p>}

      <div className="opciones-login">
        <label>
          <input type="checkbox" />
          Recordarme
        </label>

        <a href="#">
          <FaLock className="icono-link" />
          ¿Olvidaste tu contraseña?
        </a>
      </div>

      <button type="submit" disabled={cargando}>
        {cargando ? "Ingresando..." : "Ingresar"}
      </button>

      <div className="separador">
        <span>o</span>
      </div>

      <button type="button" className="google">
        <FaGoogle />
        Continuar con Google
      </button>

      <button type="button" className="github">
        <FaGithub />
        Continuar con GitHub
      </button>

      <p className="registro">
        <FaUser className="icono-link" />
        ¿No tienes una cuenta? <strong>Regístrate</strong>
      </p>
    </form>
  );
}

export default Login;