import { useState } from "react";
import { FaUser, FaEnvelope, FaLock } from "react-icons/fa";
import { FaCircleCheck } from "react-icons/fa6";
import useAuthStore from "../../store/authStore";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import { traducirErrorAuth } from "../../utils/errores";
import Marca from "../../components/brand/Marca";

function Registro() {
  const idioma = useIdiomaStore((s) => s.idioma);
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
            <FaCircleCheck aria-hidden="true" /> {t(idioma, "reg.cuentaCreada")}
          </p>
          <h2>{t(idioma, "reg.sesionIniciada")}</h2>
          <p className="texto-mutado">{t(idioma, "reg.registradoComo")} {usuario.email}.</p>
        </div>
      </div>
    );
  }

  if (pendienteEmail) {
    return (
      <div className="login-pagina">
        <div className="login card anim-entrada">
          <p className="badge badge-info hero-kicker">
            <FaEnvelope aria-hidden="true" /> {t(idioma, "reg.revisa")}
          </p>
          <h2>{t(idioma, "reg.cuentaCreada")}</h2>
          <p className="texto-mutado">
            {t(idioma, "reg.enviamos")} {email}. {t(idioma, "reg.activa")}
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");
    if (password.length < 6) {
      setLocalError(t(idioma, "reg.passCorta"));
      return;
    }
    if (password !== confirmar) {
      setLocalError(t(idioma, "reg.noCoinciden"));
      return;
    }
    try {
      const data = await registro({ nombre: nombre.trim(), email: email.trim(), password });
      if (!data?.token) setPendienteEmail(true);
    } catch (err) {
      setLocalError(traducirErrorAuth(err?.message, idioma) ?? t(idioma, "reg.error"));
    }
  };

  return (
    <div className="login-pagina">
      <form className="login card anim-entrada" onSubmit={handleSubmit}>
        <p className="badge badge-info hero-kicker kicker-marca">
          <Marca variante="simbolo" ancho={22} alto={22} decorativa />
          HefestoTech
        </p>
        <h2>{t(idioma, "reg.titulo")}</h2>

        <div className="input-con-icono">
          <FaUser className="input-icono" aria-hidden="true" />
          <input
            type="text"
            placeholder={t(idioma, "reg.nombrePh")}
            aria-label={t(idioma, "reg.nombrePh")}
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
            placeholder={t(idioma, "reg.emailPh")}
            aria-label={t(idioma, "reg.emailPh")}
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
            placeholder={t(idioma, "reg.passPh")}
            aria-label={t(idioma, "login.passPh")}
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
            placeholder={t(idioma, "reg.repetirPh")}
            aria-label={t(idioma, "reg.repetirPh")}
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
          {cargando ? t(idioma, "reg.creando") : t(idioma, "reg.crear")}
        </button>
      </form>
    </div>
  );
}

export default Registro;
