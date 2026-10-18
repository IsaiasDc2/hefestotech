// HefestoTech · Admin (/admin): shell con navegación interna por estado
// (no toca las rutas de App.jsx) y carga diferida por módulo: cada vista es
// un chunk separado además del chunk "admin". noindex: el panel no se indexa.
import { Suspense, lazy, useEffect, useState } from "react";
import { supabase } from "../../components/lib/supabaseClient";
import AdminLayout from "./AdminLayout";
import { adminApi } from "./adminApi";
import { Skeleton, ZonaToasts } from "./ui";
import { useConfirm, useToasts } from "./hooks";
import "./Admin.css";

const Inicio = lazy(() => import("./Inicio"));
const Productos = lazy(() => import("./Productos"));
const Stock = lazy(() => import("./Stock"));
const Proveedores = lazy(() => import("./Proveedores"));
const Compras = lazy(() => import("./Compras"));
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
  const [usuario, setUsuario] = useState(null);
  const [rol, setRol] = useState(null);
  const [noLeidas, setNoLeidas] = useState(0);
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
        setUsuario(u?.email ?? null);
        if (u) {
          const { data: perfil } = await supabase
            .from("perfiles")
            .select("rol")
            .eq("id", u.id)
            .maybeSingle();
          if (vivo) setRol(perfil?.rol ?? null);
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
        const r = await adminApi.notificaciones({ limit: 20 });
        const n = r?.notificaciones ?? [];
        if (vivo) setNoLeidas(n.filter((x) => !x.leida).length);
      } catch {
        /* campana en 0 */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [vista]);

  const ir = (id, extra = {}) => {
    if (extra.q !== undefined) setPresetQ(extra.q);
    else if (id !== "productos") setPresetQ("");
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

  const props = { avisar, pedirConfirm: pedir, onIr: ir, presetQ, onLeidas: () => setNoLeidas(0) };

  return (
    <AdminLayout vista={vista} onIr={ir} usuario={usuario} rol={rol} noLeidas={noLeidas}>
      <Suspense fallback={<Skeleton lineas={6} etiqueta={`Cargando ${TITULOS[vista] ?? ""}…`} />}>
        {vista === "inicio" && <Inicio onIr={ir} />}
        {vista === "productos" && <Productos {...props} />}
        {vista === "stock" && <Stock {...props} />}
        {vista === "proveedores" && <Proveedores {...props} />}
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
        {vista === "notificaciones" && <Notificaciones onLeidas={() => setNoLeidas(0)} />}
      </Suspense>
      <ZonaToasts lista={lista} onCerrar={cerrar} />
      {dialogo}
    </AdminLayout>
  );
}

export default Admin;
