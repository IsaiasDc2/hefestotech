// HefestoTech · Admin · layout propio: sidebar colapsable, topbar con ⌘K,
// campana de notificaciones, tema y usuario. Responsive: drawer en móvil.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  FaBars,
  FaBell,
  FaBox,
  FaBoxesStacked,
  FaCartShopping,
  FaChartLine,
  FaChevronLeft,
  FaChevronRight,
  FaCircleUser,
  FaClipboardList,
  FaGear,
  FaHouse,
  FaMagnifyingGlass,
  FaMessage,
  FaMoneyBillWave,
  FaRectangleAd,
  FaRightFromBracket,
  FaScaleBalanced,
  FaMoon,
  FaPlus,
  FaSun,
  FaTrashCan,
  FaTriangleExclamation,
  FaTruck,
  FaTruckFast,
  FaFileInvoiceDollar,
} from "react-icons/fa6";
import { adminApi } from "./adminApi";

const NAV = [
  { id: "inicio", etiqueta: "Inicio", Icono: FaHouse },
  { id: "productos", etiqueta: "Productos", Icono: FaBox },
  { id: "stock", etiqueta: "Stock", Icono: FaBoxesStacked },
  { id: "proveedores", etiqueta: "Proveedores", Icono: FaTruck },
  { id: "compras", etiqueta: "Compras", Icono: FaFileInvoiceDollar },
  { id: "pedidos", etiqueta: "Pedidos", Icono: FaCartShopping },
  { id: "reclamos", etiqueta: "Reclamos", Icono: FaMessage },
  { id: "whatsapp", etiqueta: "WhatsApp", Icono: FaClipboardList },
  { id: "banners", etiqueta: "Banners", Icono: FaRectangleAd },
  { id: "cupones", etiqueta: "Cupones", Icono: FaMoneyBillWave },
  { id: "reportes", etiqueta: "Reportes", Icono: FaChartLine },
  { id: "clientes", etiqueta: "Clientes", Icono: FaCircleUser },
  { id: "config", etiqueta: "Config", Icono: FaGear },
  { id: "auditoria", etiqueta: "Auditoría", Icono: FaScaleBalanced },
  { id: "papelera", etiqueta: "Papelera", Icono: FaTrashCan },
  { id: "notificaciones", etiqueta: "Notificaciones", Icono: FaBell },
];

function leerTema() {
  try {
    return document.documentElement.dataset.theme === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function BotonTema() {
  const [tema, setTema] = useState(leerTema);
  const alternar = () => {
    const proximo = tema === "light" ? "dark" : "light";
    try {
      localStorage.setItem("ht-tema", proximo);
      document.documentElement.dataset.theme = proximo;
      document.documentElement.style.colorScheme = proximo;
    } catch {
      /* sin almacenamiento: no se persiste */
    }
    setTema(proximo);
  };
  return (
    <button
      type="button"
      className="adm-icon-btn"
      onClick={alternar}
      aria-label={tema === "light" ? "Cambiar a tema oscuro" : "Cambiar a tema claro"}
      aria-pressed={tema === "light"}
      title="Tema"
    >
      {tema === "light" ? <FaMoon aria-hidden="true" /> : <FaSun aria-hidden="true" />}
    </button>
  );
}

// Paleta ⌘K: navegación + búsqueda global (GET /api/buscar).
function Paleta({ abierta, onCerrar, onIr, vistaActual }) {
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [abiertaPrevia, setAbiertaPrevia] = useState(abierta);
  const entrada = useRef(null);

  // Al abrir o cerrar se limpia durante el render (al abrir, también el texto).
  if (abierta !== abiertaPrevia) {
    setAbiertaPrevia(abierta);
    if (abierta) setTexto("");
    setResultados([]);
    setBuscando(false);
  }

  useEffect(() => {
    if (!abierta) return;
    const t = setTimeout(() => entrada.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [abierta]);

  useEffect(() => {
    if (!abierta) return;
    const alTeclar = (e) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alTeclar);
    return () => window.removeEventListener("keydown", alTeclar);
  }, [abierta, onCerrar]);

  // El estado "buscando"/limpieza se fija al tipear (alCambiarTexto); el efecto
  // solo agenda la consulta con debounce.
  const alCambiarTexto = (valor) => {
    setTexto(valor);
    if (valor.trim().length < 2) {
      setResultados([]);
      setBuscando(false);
    } else {
      setBuscando(true);
    }
  };

  useEffect(() => {
    const t = texto.trim();
    if (!abierta || t.length < 2) return;
    const id = setTimeout(async () => {
      try {
        const r = await adminApi.buscar(t, 8);
        setResultados(r?.resultados ?? []);
      } catch {
        setResultados([]);
      } finally {
        setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [texto, abierta]);

  const navFiltrada = useMemo(() => {
    const t = texto.trim().toLowerCase();
    if (!t) return NAV;
    return NAV.filter((n) => n.etiqueta.toLowerCase().includes(t));
  }, [texto]);

  if (!abierta) return null;
  return (
    <div className="adm-velo" role="dialog" aria-modal="true" aria-label="Búsqueda" onClick={onCerrar}>
      <div className="adm-paleta" onClick={(e) => e.stopPropagation()}>
        <div className="adm-paleta-entrada">
          <FaMagnifyingGlass aria-hidden="true" />
          <input
            ref={entrada}
            value={texto}
            onChange={(e) => alCambiarTexto(e.target.value)}
            placeholder="Buscar módulo o producto… (Esc para cerrar)"
            aria-label="Buscar en el panel"
          />
        </div>
        <ul className="adm-paleta-lista" aria-label="Módulos">
          {navFiltrada.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className={n.id === vistaActual ? "es-actual" : ""}
                onClick={() => {
                  onIr(n.id);
                  onCerrar();
                }}
              >
                <n.Icono aria-hidden="true" /> {n.etiqueta}
                {n.id === vistaActual && <span className="texto-mutado"> · actual</span>}
              </button>
            </li>
          ))}
        </ul>
        {texto.trim().length >= 2 && (
          <div className="adm-paleta-resultados">
            <p className="texto-mutado">
              {buscando ? "Buscando…" : resultados.length ? `${resultados.length} resultado(s)` : "Sin resultados en el catálogo."}
            </p>
            <ul>
              {resultados.map((r, i) => (
                <li key={r.id ?? i}>
                  <button
                    type="button"
                    onClick={() => {
                      onIr("productos", { q: r.nombre ?? r.codigo ?? "" });
                      onCerrar();
                    }}
                  >
                    {r.nombre ?? r.codigo ?? "Producto"}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminLayout({
  vista,
  onIr,
  usuario,
  rol,
  noLeidas,
  onSalir,
  children,
}) {
  const [colapsada, setColapsada] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [paleta, setPaleta] = useState(false);
  const drawerRef = useRef(null);
  const hamburguesaRef = useRef(null);
  const focoPrevio = useRef(null);
  const nombreUsuario =
    typeof usuario === "string"
      ? usuario
      : usuario?.nombre?.trim() || usuario?.email || "";

  useEffect(() => {
    const atajo = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaleta((v) => !v);
      }
    };
    window.addEventListener("keydown", atajo);
    return () => window.removeEventListener("keydown", atajo);
  }, []);

  useEffect(() => {
    if (!drawer) return undefined;
    focoPrevio.current = document.activeElement;
    const hamburguesa = hamburguesaRef.current;
    drawerRef.current?.querySelector("button")?.focus();
    const alTeclado = (e) => {
      if (e.key === "Escape") {
        setDrawer(false);
        return;
      }
      if (e.key !== "Tab") return;
      const panel = drawerRef.current;
      if (!panel) return;
      const focos = panel.querySelectorAll("button:not([disabled]), a[href]");
      if (focos.length === 0) return;
      const primero = focos[0];
      const ultimo = focos[focos.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener("keydown", alTeclado);
    return () => {
      document.removeEventListener("keydown", alTeclado);
      if (focoPrevio.current instanceof HTMLElement) focoPrevio.current.focus();
      else hamburguesa?.focus();
    };
  }, [drawer]);

  const ir = (id, extra) => {
    setDrawer(false);
    onIr(id, extra);
  };

  const barra = (enDrawer) => (
    <nav aria-label="Módulos del panel" className={enDrawer ? "adm-nav" : "adm-nav"}>
      {NAV.map((n) => (
        <button
          key={n.id}
          type="button"
          className={`adm-nav-item ${vista === n.id ? "es-activo" : ""}`}
          onClick={() => ir(n.id)}
          aria-current={vista === n.id ? "page" : undefined}
          title={colapsada && !enDrawer ? n.etiqueta : undefined}
        >
          <n.Icono aria-hidden="true" />
          {(!colapsada || enDrawer) && <span>{n.etiqueta}</span>}
          {n.id === "notificaciones" && noLeidas > 0 && (!colapsada || enDrawer) && (
            <span className="adm-contador" aria-label={`${noLeidas} sin leer`}>
              {noLeidas}
            </span>
          )}
        </button>
      ))}
    </nav>
  );

  return (
    <div className={`adm ${colapsada ? "es-colapsado" : ""}`}>
      <aside className="adm-lateral" aria-label="Barra lateral">
        <div className="adm-marca">
          <Link to="/" aria-label="Volver a la tienda">
            <strong>HefestoTech</strong> <span>Admin</span>
          </Link>
          <button
            type="button"
            className="adm-icon-btn adm-colapso"
            onClick={() => setColapsada((v) => !v)}
            aria-label={colapsada ? "Expandir barra lateral" : "Colapsar barra lateral"}
            aria-expanded={!colapsada}
          >
            {colapsada ? <FaChevronRight aria-hidden="true" /> : <FaChevronLeft aria-hidden="true" />}
          </button>
        </div>
        {barra(false)}
        <div className="adm-altas">
          {!colapsada && <p className="adm-altas-titulo">Altas rápidas</p>}
          <button
            type="button"
            className="adm-altas-btn"
            onClick={() => ir("productos", { accion: "nuevo" })}
            title="Nuevo producto"
          >
            <FaPlus aria-hidden="true" />
            {!colapsada && <span>Nuevo producto</span>}
          </button>
          <button
            type="button"
            className="adm-altas-btn"
            onClick={() => ir("stock", { accion: "agregar" })}
            title="Agregar stock"
          >
            <FaBoxesStacked aria-hidden="true" />
            {!colapsada && <span>Agregar stock</span>}
          </button>
          <button
            type="button"
            className="adm-altas-btn"
            onClick={() => ir("stock", { accion: "reposicion" })}
            title="Reposición de stock"
          >
            <FaTruckFast aria-hidden="true" />
            {!colapsada && <span>Reponer stock</span>}
          </button>
          <button
            type="button"
            className="adm-altas-btn"
            onClick={() => ir("proveedores", { accion: "nuevo" })}
            title="Agregar proveedor"
          >
            <FaTruck aria-hidden="true" />
            {!colapsada && <span>Agregar proveedor</span>}
          </button>
        </div>
        <p className="adm-rol texto-mutado">
          {colapsada ? (rol?.slice(0, 1).toUpperCase() ?? "·") : `Rol: ${rol ?? "—"}`}
        </p>
      </aside>

      {drawer && (
        <div className="adm-velo adm-drawer-velo" onClick={() => setDrawer(false)}>
          <div
            ref={drawerRef}
            className="adm-drawer"
            id="adm-menu-movil"
            role="dialog"
            aria-modal="true"
            aria-label="Menú del panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="adm-marca">
              <strong>HefestoTech</strong> <span>Admin</span>
            </div>
            {barra(true)}
          </div>
        </div>
      )}

      <div className="adm-cuerpo">
        <div className="adm-topbar">
          <button
            ref={hamburguesaRef}
            type="button"
            className="adm-icon-btn adm-hamburguesa"
            onClick={() => setDrawer(true)}
            aria-label="Abrir menú del panel"
            aria-expanded={drawer}
            aria-controls="adm-menu-movil"
          >
            <FaBars aria-hidden="true" />
          </button>
          <button
            type="button"
            className="adm-buscar-btn"
            onClick={() => setPaleta(true)}
            aria-label="Abrir búsqueda (Control o Comando K)"
          >
            <FaMagnifyingGlass aria-hidden="true" />
            <span>Buscar…</span>
            <kbd>⌘K</kbd>
          </button>
          <div className="adm-topbar-lado">
            <BotonTema />
            <button
              type="button"
              className="adm-icon-btn adm-campana"
              onClick={() => ir("notificaciones")}
              aria-label={noLeidas > 0 ? `Notificaciones, ${noLeidas} sin leer` : "Notificaciones"}
              title="Notificaciones"
            >
              <FaBell aria-hidden="true" />
              {noLeidas > 0 && <span className="adm-punto" aria-hidden="true" />}
            </button>
            <span
              className="adm-usuario"
              title={nombreUsuario || "Usuario"}
            >
              <FaCircleUser aria-hidden="true" />
              <span className="adm-usuario-nombre">{nombreUsuario || "—"}</span>
            </span>
            {onSalir && (
              <button
                type="button"
                className="adm-icon-btn"
                onClick={onSalir}
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
              >
                <FaRightFromBracket aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        {(vista === "reclamos" || vista === "pedidos") && (
          <p className="adm-aviso-linea" role="note">
            <FaTriangleExclamation aria-hidden="true" /> Los montos se muestran
            en pesos argentinos calculados en el servidor.
          </p>
        )}
        <main className="adm-main" id="admin-contenido">
          {children}
        </main>
      </div>

      <Paleta abierta={paleta} onCerrar={() => setPaleta(false)} onIr={ir} vistaActual={vista} />
    </div>
  );
}
