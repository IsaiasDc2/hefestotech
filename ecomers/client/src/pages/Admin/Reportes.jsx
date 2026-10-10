// HefestoTech · Admin · Reportes: ventas agregadas en servidor.
// Definición de venta (ver docs/ADMIN.md): pedidos no cancelados/reembolsados.
import { useState } from "react";
import { adminApi, formatoARS } from "./adminApi";
import { Cabecera, Proximamente, SinPermiso, Skeleton, Tabla } from "./ui";
import { useModulo } from "./ui";

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
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
          <button type="button" className="btn-fantasma adm-btn" onClick={recargar}>
            Actualizar
          </button>
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
      <p className="texto-mutado">
        Venta = pedido no cancelado ni reembolsado, total en centavos calculado en el servidor (ver docs/ADMIN.md).
      </p>
    </div>
  );
}
