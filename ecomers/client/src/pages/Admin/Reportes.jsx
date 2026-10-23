// HefestoTech · Admin · Reportes: ventas agregadas en servidor.
// Definición de venta (ver docs/ADMIN.md): pedidos no cancelados/reembolsados.
import { useState } from "react";
import { adminApi, formatoARS } from "./adminApi";
import { Cabecera, Proximamente, SinPermiso, Skeleton, Tabla } from "./ui";
import { useModulo } from "./hooks";
import { reporteACsv } from "./reportesUtil";

function descargarCsv(datos, rango) {
  const blob = new Blob([reporteACsv(datos, rango)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `ventas-${rango.desde || "inicio"}_a_${rango.hasta || "hoy"}.csv`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function hoyISO() {
  // Fecha local del navegador (no UTC): en Argentina, toISOString() ya es
  // mañana a partir de las 21:00 y el reporte omitía los pedidos del día.
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export default function Reportes() {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState(hoyISO());
  const [rango, setRango] = useState({ desde: "", hasta: hoyISO() });
  const { estado, datos, recargar } = useModulo(
    () => adminApi.reporteVentas(rango),
    [rango.desde, rango.hasta]
  );

  if (estado === "cargando") return <Skeleton lineas={6} etiqueta="Cargando reporte…" />;
  if (estado === "sin-permiso") return <SinPermiso modulo="Reportes" />;
  if (estado === "no-disponible") return <Proximamente modulo="Reportes" />;

  const porEstado = Object.entries(datos?.por_estado ?? {});
  const porDia = datos?.por_dia ?? [];

  return (
    <div>
      <Cabecera
        kicker="Números"
        titulo="Reporte de ventas"
        acciones={
          <div className="adm-acciones-cab">
            <button type="button" className="btn-fantasma adm-btn" onClick={() => descargarCsv(datos, rango)}>
              Exportar CSV
            </button>
            <button type="button" className="btn-fantasma adm-btn" onClick={recargar}>
              Actualizar
            </button>
          </div>
        }
      />
      <section className="card adm-panel" aria-label="Rango">
        <form
          className="adm-buscador-linea"
          onSubmit={(e) => {
            e.preventDefault();
            setRango({ desde, hasta });
          }}
        >
          <label>Desde <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
          <label>Hasta <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
          <button type="submit" className="btn-fantasma adm-btn">Aplicar</button>
        </form>
      </section>
      <div className="adm-kpis">
        <div className="card adm-kpi">
          <span className="adm-kpi-valor">{datos?.pedidos ?? 0}</span>
          <span className="adm-kpi-etiqueta">Pedidos en el rango</span>
        </div>
        <div className="card adm-kpi">
          <span className="adm-kpi-valor">{formatoARS(datos?.total_centavos ?? 0)}</span>
          <span className="adm-kpi-etiqueta">Total (ARS)</span>
        </div>
        <div className="card adm-kpi">
          <span className="adm-kpi-valor">{formatoARS(datos?.ticket_promedio_centavos ?? 0)}</span>
          <span className="adm-kpi-etiqueta">Ticket promedio</span>
        </div>
      </div>
      <div className="adm-grid-2">
        <section className="card adm-panel" aria-label="Por estado">
          <h2>Por estado</h2>
          <Tabla
            columnas={[
              { clave: "estado", titulo: "Estado", ver: (r) => r[0] || "—" },
              { clave: "n", titulo: "Pedidos", ver: (r) => r[1] },
            ]}
            filas={porEstado}
            filaKey={(r) => r[0]}
            vacio="Sin pedidos en el rango."
          />
        </section>
        <section className="card adm-panel" aria-label="Por día">
          <h2>Por día</h2>
          <Tabla
            columnas={[
              { clave: "dia", titulo: "Día", ver: (r) => r.dia || "—" },
              { clave: "pedidos", titulo: "Pedidos" },
              { clave: "total", titulo: "Total", ver: (r) => formatoARS(r.total_centavos ?? 0) },
            ]}
            filas={porDia}
            filaKey={(r) => r.dia}
            vacio="Sin pedidos en el rango."
          />
        </section>
      </div>
      <section className="card adm-panel" aria-label="Productos más vendidos">
        <h2>Productos más vendidos</h2>
        <Tabla
          columnas={[
            { clave: "nombre", titulo: "Producto" },
            { clave: "unidades", titulo: "Unidades" },
            { clave: "total", titulo: "Importe bruto", ver: (r) => formatoARS(r.total_centavos ?? 0) },
          ]}
          filas={datos?.top_productos ?? []}
          filaKey={(r) => r.producto_id}
          vacio="Sin ventas en el rango."
        />
      </section>
      <p className="texto-mutado">
        Venta = pedido no cancelado ni reembolsado, total en centavos calculado en el servidor (ver docs/ADMIN.md).
      </p>
    </div>
  );
}
