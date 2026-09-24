import { FaGoogle, FaGithub, FaLock, FaUser } from "react-icons/fa";
import "./Login.css"
function Login() {
  return (
    <form className="login">

      <h2>Iniciar sesión</h2>

      <input
        type="email"
        placeholder="Correo electrónico"
        required
      />

      <input
        type="password"
        placeholder="Contraseña"
        required
      />

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

      <button type="submit">
        Ingresar
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