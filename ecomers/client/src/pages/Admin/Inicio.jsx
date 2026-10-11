// HefestoTech · Admin · Inicio: resumen operativo (GET /api/admin/resumen).
import { Link } from "react-router-dom";
import { adminApi } from "./adminApi";
import { Cabecera, Proximamente, SinPermiso, Skeleton } from "./ui";
import { useModulo } from "./ui";

export default function Inicio({ onIr }) {
  const { estado, datos, detalle, recargar } = useModulo(() => adminApi.resumen(), []);

  if (estado === "cargando") return <Skeleton lineas={6} etiqueta="Cargando resumen…" />;
  if (estado === "sin-permiso") return <SinPermiso modulo="Inicio" />;
  if (estado === "no-disponible") return <Proximamente modulo="Inicio" detalle={detalle} />;

  const tarjetas = [
    { id: "productos", etiqueta: "Productos activos", valor: datos?.productos_activos ?? 0 },
    { id: "stock", etiqueta: "Con bajo stock", valor: datos?.bajo_stock ?? 0 },
    { id: "pedidos", etiqueta: "Pedidos pendientes", valor: datos?.pedidos_pendientes_pagina ?? 0 },
    { id: "reclamos", etiqueta: "Reclamos abiertos", valor: datos?.reclamos_abiertos ?? 0 },
  ];

  return (
    <div>
      <Cabecera
        kicker="Panel"
        titulo="Inicio"
        acciones={
          <button type="button" className="btn-fantasma adm-btn" onClick={recargar}>
            Actualizar
          </button>
        }
      />
      <div className="adm-kpis">
        {tarjetas.map((t) => (
          <button key={t.id} type="button" className="card adm-kpi" onClick={() => onIr(t.id)}>
            <span className="adm-kpi-valor">{t.valor}</span>
            <span className="adm-kpi-etiqueta">{t.etiqueta}</span>
          </button>
        ))}
      </div>
      <section className="card adm-panel" aria-label="Accesos">
        <h2>Accesos rápidos</h2>
        <ul className="adm-accesos">
          <li><button type="button" className="btn-fantasma adm-btn" onClick={() => onIr("productos")}>Gestionar productos</button></li>
          <li><button type="button" className="btn-fantasma adm-btn" onClick={() => onIr("pedidos")}>Ver pedidos</button></li>
          <li><button type="button" className="btn-fantasma adm-btn" onClick={() => onIr("whatsapp")}>Abrir WhatsApp nivel 1</button></li>
          <li><Link className="btn-fantasma adm-btn" to="/reclamo">Formulario público de reclamo</Link></li>
        </ul>
      </section>
    </div>
  );
}
