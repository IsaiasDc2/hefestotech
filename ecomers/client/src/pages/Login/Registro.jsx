import { useState } from "react";
import { FaUser, FaEnvelope, FaLock } from "react-icons/fa";
import { FaCircleCheck } from "react-icons/fa6";
import useAuthStore from "../../store/authStore";
import Marca from "../../components/brand/Marca";

function Registro() {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [localError, setLocalError] = useState("");
  const [pendienteEmail, setPendienteEmail] = useState(false);

  const registro = useAuthStore((s) => s.registro);
  const cargando = useAuthStore((s) => s.cargando);
  const error = useAuthStore((s) => s.error);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const usuario = useAuthStore((s) => s.usuario);

  if (isAuthenticated && usuario) {
    return (
      <div className="login-pagina">
        <div className="login card anim-entrada">
          <p className="badge badge-ok hero-kicker">
            <FaCircleCheck aria-hidden="true" /> Cuenta creada
          </p>
          <h2>Sesión iniciada</h2>
          <p className="texto-mutado">Estás registrado como {usuario.email}.</p>
        </div>
      </div>
    );
  }

  if (pendienteEmail) {
    return (
      <div className="login-pagina">
        <div className="login card anim-entrada">
          <p className="badge badge-info hero-kicker">
            <FaEnvelope aria-hidden="true" /> Revisá tu email
          </p>
          <h2>Cuenta creada</h2>
          <p className="texto-mutado">
            Te enviamos un correo de confirmación a {email}. Abrilo para
            activar tu cuenta y después iniciá sesión.
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");
    if (password.length < 6) {
      setLocalError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmar) {
      setLocalError("Las contraseñas no coinciden.");
      return;
    }
    try {
      const data = await registro({ nombre: nombre.trim(), email: email.trim(), password });
      if (!data?.token) setPendienteEmail(true);
    } catch {
    }
  };

  return (
    <div className="login-pagina">
      <form className="login card anim-entrada" onSubmit={handleSubmit}>
        <p className="badge badge-info hero-kicker kicker-marca">
          <Marca variante="simbolo" ancho={22} alto={22} decorativa />
          HefestoTech
        </p>
        <h2>Crear cuenta</h2>

        <div className="input-con-icono">
          <FaUser className="input-icono" aria-hidden="true" />
          <input
            type="text"
            placeholder="Nombre"
            aria-label="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            autoComplete="name"
          />
        </div>

        <div className="input-con-icono">
          <FaEnvelope className="input-icono" aria-hidden="true" />
          <input
            type="email"
            placeholder="Correo electrónico"
            aria-label="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="input-con-icono">
          <FaLock className="input-icono" aria-hidden="true" />
          <input
            type="password"
            placeholder="Contraseña (mínimo 6 caracteres)"
            aria-label="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>

        <div className="input-con-icono">
          <FaLock className="input-icono" aria-hidden="true" />
          <input
            type="password"
            placeholder="Repetir contraseña"
            aria-label="Repetir contraseña"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>

        {(localError || error) && (
          <p className="badge badge-peligro login-error" role="alert">
            {localError || error}
          </p>
        )}

        <button type="submit" className="btn-primary" disabled={cargando}>
          {cargando ? "Creando cuenta..." : "Crear cuenta"}
        </button>
      </form>
    </div>
  );
}

export default Registro;
