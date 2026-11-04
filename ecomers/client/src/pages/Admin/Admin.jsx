// HefestoTech · Admin: shell de rutas reales (/admin/:modulo) y carga diferida
// por módulo. La navegación se filtra con los permisos que devuelve el backend;
// la autorización real sigue en cada endpoint. noindex: el panel no se indexa.
import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import useAuthStore from "../../store/authStore";
import AdminLayout from "./AdminLayout";
import { MODULOS, modulosVisibles } from "./adminModules";
import { adminApi } from "./adminApi";
import { Skeleton, ZonaToasts } from "./ui";
import { useConfirm, useToasts } from "./hooks";
import "./Admin.css";

const Inicio = lazy(() => import("./Inicio"));
const Productos = lazy(() => import("./Productos"));
const Stock = lazy(() => import("./Stock"));
const Proveedores = lazy(() => import("./Proveedores"));
const Compras = lazy(() => import("./Compras.jsx"));
const Pedidos = lazy(() => import("./Pedidos"));
const Reclamos = lazy(() => import("./Reclamos"));
const WhatsApp = lazy(() => import("./WhatsApp"));
const Banners = lazy(() => import("./Banners"));
const Cupones = lazy(() => import("./Cupones"));
const Reportes = lazy(() => import("./Reportes"));
const Clientes = lazy(() => import("./Clientes"));
const Config = lazy(() => import("./Config"));
const Auditoria = lazy(() => import("./Auditoria"));
const Papelera = lazy(() => import("./Papelera"));
const Notificaciones = lazy(() => import("./Notificaciones"));

const TITULOS = Object.fromEntries(MODULOS.map((m) => [m.id, m.etiqueta]));

function Admin() {
  const { modulo = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const puede = useAuthStore((s) => s.puede);
  const usuarioStore = useAuthStore((s) => s.usuario);
  const perfil = useAuthStore((s) => s.perfil);
  const logout = useAuthStore((s) => s.logout);

  const [noLeidas, setNoLeidas] = useState(0);
  const [sucursal, setSucursal] = useState("");
  const [sucursales, setSucursales] = useState([]);
  const [refrescoInicio, setRefrescoInicio] = useState(0);
  const { lista, avisar, cerrar } = useToasts();
  const { pedir, dialogo } = useConfirm();

  const modulos = modulosVisibles(puede);
  const permitido = modulos.some((m) => m.id === modulo);
  const primerModulo = modulos[0]?.id ?? "";
  const vista = permitido ? modulo : "";

  // Acciones que llegan por navegación (paleta, Inicio, altas rápidas).
  const presetQ = typeof location.state?.q === "string" ? location.state.q : "";
  const accion = typeof location.state?.accion === "string" ? location.state.accion : "";
  const accionSeq = location.state?.seq ?? 0;

  const puedeNotificaciones = puede("notificaciones", "leer");
  const puedeSucursales = puede("sucursales", "leer");

  const usuario = usuarioStore
    ? {
        email: usuarioStore.email || "",
        nombre: perfil?.nombre || usuarioStore.nombre || "",
      }
    : null;
  const rol = perfil?.rol ?? null;

  // noindex: el panel no debe aparecer en buscadores.
  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]');
    const previa = meta?.getAttribute("content");
    const creada = !meta;
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "robots");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", "noindex, nofollow");
    return () => {
      if (creada) meta.remove();
      else if (previa !== null) meta.setAttribute("content", previa);
    };
  }, []);

  // /admin y los módulos inexistentes o sin permiso caen en el primero visible.
  useEffect(() => {
    if (!primerModulo) return;
    if (!modulo || !permitido) {
      navigate(`/admin/${primerModulo}`, { replace: true });
    }
  }, [modulo, permitido, primerModulo, navigate]);

  // Contador de la campana (solo si el rol puede ver notificaciones).
  useEffect(() => {
    if (!puedeNotificaciones) return undefined;
    let vivo = true;
    (async () => {
      try {
        const r = await adminApi.notificaciones({ limit: 100, soloNoLeidas: true });
        const n = r?.notificaciones ?? [];
        if (vivo) setNoLeidas(n.length);
      } catch {
        /* campana en 0 */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [vista, puedeNotificaciones]);

  // Sucursales para el selector de la barra superior.
  useEffect(() => {
    if (!puedeSucursales) return undefined;
    let vivo = true;
    (async () => {
      try {
        const r = await adminApi.sucursales();
        if (vivo) setSucursales(r?.sucursales ?? []);
      } catch {
        if (vivo) setSucursales([]);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [puedeSucursales]);

  const crearSucursal = async (datos) => {
    const r = await adminApi.crearSucursal(datos);
    try {
      const lista = await adminApi.sucursales();
      setSucursales(lista?.sucursales ?? []);
    } catch {
      /* el alta ya se hizo: la lista se actualiza en la próxima carga */
    }
    setRefrescoInicio((n) => n + 1);
    return r;
  };

  const ir = (id, extra = {}) => {
    const destino = modulos.some((m) => m.id === id) ? id : primerModulo;
    if (!destino) return;
    const estado = {};
    if (extra.q !== undefined) estado.q = extra.q;
    if (extra.accion) {
      estado.accion = extra.accion;
      estado.seq = Date.now();
    }
    navigate(`/admin/${destino}`, {
      state: Object.keys(estado).length ? estado : null,
    });
    // El módulo es lazy: scrollear de entrada y reintentar cuando termine
    // de montar, si no el título queda cortado bajo el topbar.
    const alContenido = () => {
      document.getElementById("admin-contenido")?.scrollIntoView({ block: "start" });
    };
    alContenido();
    requestAnimationFrame(() => requestAnimationFrame(alContenido));
    setTimeout(alContenido, 600);
  };

  const salir = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const marcarLeidas = useCallback(async () => {
    if (!puede("notificaciones", "leer")) return;
    try {
      await adminApi.marcarNotificacionesLeidas();
    } catch {
      /* si falla, la campana se reintenta al abrir la bandeja */
    }
    setNoLeidas(0);
  }, [puede]);

  const props = {
    avisar,
    pedirConfirm: pedir,
    onIr: ir,
    presetQ,
    onLeidas: marcarLeidas,
    rol,
    puede,
  };

  return (
    <AdminLayout
      vista={vista}
      onIr={ir}
      usuario={usuario}
      rol={rol}
      noLeidas={noLeidas}
      onSalir={salir}
      sucursales={sucursales}
      sucursal={sucursal}
      onSucursal={setSucursal}
      onCrearSucursal={crearSucursal}
      avisar={avisar}
      modulos={modulos}
      puede={puede}
    >
      <Suspense
        fallback={
          <Skeleton
            lineas={6}
            etiqueta={`Cargando ${TITULOS[vista] ?? "módulo"}…`}
          />
        }
      >
        {vista === "inicio" && (
          <Inicio
            onIr={ir}
            sucursal={sucursal}
            sucursalNombre={sucursales.find((s) => s.id === sucursal)?.nombre ?? ""}
            refresco={refrescoInicio}
          />
        )}
        {vista === "productos" && <Productos key={`productos-${accionSeq}`} {...props} accionInicial={accion} />}
        {vista === "stock" && <Stock key={`stock-${accionSeq}`} {...props} accionInicial={accion} />}
        {vista === "proveedores" && <Proveedores key={`proveedores-${accionSeq}`} {...props} accionInicial={accion} />}
        {vista === "compras" && <Compras {...props} />}
        {vista === "pedidos" && <Pedidos {...props} />}
        {vista === "reclamos" && <Reclamos {...props} />}
        {vista === "whatsapp" && <WhatsApp {...props} />}
        {vista === "banners" && <Banners {...props} />}
        {vista === "cupones" && <Cupones {...props} />}
        {vista === "reportes" && <Reportes {...props} />}
        {vista === "clientes" && <Clientes />}
        {vista === "config" && <Config />}
        {vista === "auditoria" && <Auditoria />}
        {vista === "papelera" && <Papelera {...props} />}
        {vista === "notificaciones" && <Notificaciones onLeidas={marcarLeidas} />}
      </Suspense>
      <ZonaToasts lista={lista} onCerrar={cerrar} />
      {dialogo}
    </AdminLayout>
  );
}

export default Admin;
