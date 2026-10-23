// HefestoTech · Admin (/admin): shell con navegación interna por estado
// (no toca las rutas de App.jsx) y carga diferida por módulo: cada vista es
// un chunk separado además del chunk "admin". noindex: el panel no se indexa.
import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { supabase } from "../../components/lib/supabaseClient";
import useAuthStore from "../../store/authStore";
import AdminLayout from "./AdminLayout";
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

const TITULOS = {
  inicio: "Inicio", productos: "Productos", stock: "Stock", proveedores: "Proveedores",
  compras: "Compras", pedidos: "Pedidos",
  reclamos: "Reclamos", whatsapp: "WhatsApp", banners: "Banners", cupones: "Cupones",
  reportes: "Reportes", clientes: "Clientes", config: "Configuración",
  auditoria: "Auditoría", papelera: "Papelera", notificaciones: "Notificaciones",
};

function Admin() {
  const [vista, setVista] = useState("inicio");
  const [presetQ, setPresetQ] = useState("");
  const [accion, setAccion] = useState("");
  const [accionSeq, setAccionSeq] = useState(0);
  const [usuario, setUsuario] = useState(null);
  const [rol, setRol] = useState(null);
  const [noLeidas, setNoLeidas] = useState(0);
  const [sucursal, setSucursal] = useState("");
  const [sucursales, setSucursales] = useState([]);
  const [refrescoInicio, setRefrescoInicio] = useState(0);
  const { lista, avisar, cerrar } = useToasts();
  const { pedir, dialogo } = useConfirm();

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

  // Usuario + rol (solo display; la autorización real la hace el backend).
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const u = data?.session?.user ?? null;
        if (!vivo) return;
        if (!u) {
          setUsuario(null);
          return;
        }
        setUsuario({
          email: u.email ?? "",
          nombre: u.user_metadata?.nombre ?? u.user_metadata?.full_name ?? "",
        });
        if (u) {
          const { data: perfil } = await supabase
            .from("perfiles")
            .select("nombre,rol")
            .eq("id", u.id)
            .maybeSingle();
          if (vivo) {
            setRol(perfil?.rol ?? null);
            if (perfil?.nombre) {
              setUsuario((previo) => ({ ...(previo ?? {}), nombre: perfil.nombre }));
            }
          }
        }
      } catch {
        /* display solamente */
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  // Contador de la campana (si falla, queda en 0 y la bandeja dirá Próximamente).
  useEffect(() => {
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
  }, [vista]);

  // Sucursales para el selector de la barra superior. Si el rol no tiene
  // permiso o la migración 015 falta, la lista queda vacía y el panel sigue.
  useEffect(() => {
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
  }, []);

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
    if (extra.q !== undefined) setPresetQ(extra.q);
    else if (id !== "productos") setPresetQ("");
    if (extra.accion) {
      setAccion(extra.accion);
      setAccionSeq((n) => n + 1);
    } else {
      setAccion("");
    }
    setVista(TITULOS[id] ? id : "inicio");
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
    await useAuthStore.getState().logout();
    // Recarga en la base del sitio (respeta Vite `base`): la guardia vuelve a
    // evaluar la sesión y el panel deja de mostrarse.
    window.location.assign(import.meta.env.BASE_URL || "/");
  };

  const marcarLeidas = useCallback(async () => {
    try {
      await adminApi.marcarNotificacionesLeidas();
    } catch {
      /* si falla, la campana se reintenta al abrir la bandeja */
    }
    setNoLeidas(0);
  }, []);

  const props = { avisar, pedirConfirm: pedir, onIr: ir, presetQ, onLeidas: marcarLeidas };

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
    >
      <Suspense fallback={<Skeleton lineas={6} etiqueta={`Cargando ${TITULOS[vista] ?? ""}…`} />}>
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
