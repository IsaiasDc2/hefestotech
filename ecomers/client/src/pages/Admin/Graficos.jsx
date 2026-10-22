// HefestoTech · Admin · gráficos SVG sin dependencias.
// Cada gráfico expone <title> por barra y una tabla equivalente para lectores
// de pantalla (clase sr-only). Sin datos: texto explícito, nunca ceros falsos.

const AZUL = "var(--primary)";

function etiquetaDia(iso) {
  const partes = String(iso ?? "").split("-");
  return partes.length === 3 ? `${partes[2]}/${partes[1]}` : String(iso ?? "");
}

function textoVacio() {
  return <p className="adm-grafico-vacio">Sin datos en el período.</p>;
}

function TablaOculta({ etiqueta, filas }) {
  return (
    <figcaption className="sr-only">
      <table>
        <caption>{etiqueta}</caption>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i}>
              <th scope="row">{f.etiqueta}</th>
              <td>{f.valor}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figcaption>
  );
}

// Barras verticales de una serie (ventas por día).
export function Barras({ datos, valor, etiqueta, formato = (n) => n }) {
  const filas = datos ?? [];
  if (!filas.length) return textoVacio();
  const max = Math.max(1, ...filas.map((d) => Number(valor(d)) || 0));
  const ancho = 640;
  const alto = 190;
  const margen = 22;
  const paso = ancho / filas.length;
  const grosor = Math.max(2, Math.min(20, paso * 0.62));

  return (
    <figure className="adm-grafico">
      <svg
        viewBox={`0 0 ${ancho} ${alto}`}
        role="img"
        aria-label={`${etiqueta}. Máximo: ${formato(max)}.`}
        preserveAspectRatio="none"
      >
        <title>{etiqueta}</title>
        {[0.25, 0.5, 0.75, 1].map((p) => (
          <line
            key={p}
            x1="0"
            x2={ancho}
            y1={alto - margen - p * (alto - margen * 2)}
            y2={alto - margen - p * (alto - margen * 2)}
            className="adm-grafico-linea"
          />
        ))}
        {filas.map((d, i) => {
          const v = Number(valor(d)) || 0;
          const altura = (v / max) * (alto - margen * 2);
          return (
            <rect
              key={d.dia ?? i}
              x={i * paso + (paso - grosor) / 2}
              y={alto - margen - altura}
              width={grosor}
              height={Math.max(v > 0 ? 2 : 0, altura)}
              rx="2"
              className="adm-grafico-barra"
            >
              <title>{`${etiquetaDia(d.dia)}: ${formato(v)}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="adm-grafico-ejes" aria-hidden="true">
        <span>{etiquetaDia(filas[0]?.dia)}</span>
        <span>{etiquetaDia(filas[Math.floor(filas.length / 2)]?.dia)}</span>
        <span>{etiquetaDia(filas[filas.length - 1]?.dia)}</span>
      </div>
      <TablaOculta
        etiqueta={etiqueta}
        filas={filas.map((d) => ({
          etiqueta: etiquetaDia(d.dia),
          valor: formato(Number(valor(d)) || 0),
        }))}
      />
    </figure>
  );
}

// Barras apiladas por día (entradas / salidas / ajustes de stock).
export function BarrasApiladas({ datos, series, etiqueta, formato = (n) => n }) {
  const filas = datos ?? [];
  if (!filas.length) return textoVacio();
  const totales = filas.map((d) => series.reduce((acc, s) => acc + (Number(d[s.clave]) || 0), 0));
  const max = Math.max(1, ...totales);
  const ancho = 640;
  const alto = 190;
  const margen = 22;
  const paso = ancho / filas.length;
  const grosor = Math.max(2, Math.min(20, paso * 0.62));

  return (
    <figure className="adm-grafico">
      <svg
        viewBox={`0 0 ${ancho} ${alto}`}
        role="img"
        aria-label={etiqueta}
        preserveAspectRatio="none"
      >
        <title>{etiqueta}</title>
        {[0.5, 1].map((p) => (
          <line
            key={p}
            x1="0"
            x2={ancho}
            y1={alto - margen - p * (alto - margen * 2)}
            y2={alto - margen - p * (alto - margen * 2)}
            className="adm-grafico-linea"
          />
        ))}
        {filas.map((d, i) => {
          let acumulado = 0;
          return (
            <g key={d.dia ?? i}>
              {series.map((s) => {
                const v = Number(d[s.clave]) || 0;
                if (!v) return null;
                const altura = (v / max) * (alto - margen * 2);
                const y = alto - margen - acumulado - altura;
                acumulado += altura;
                return (
                  <rect
                    key={s.clave}
                    x={i * paso + (paso - grosor) / 2}
                    y={y}
                    width={grosor}
                    height={Math.max(2, altura)}
                    rx="2"
                    fill={s.color}
                  >
                    <title>{`${etiquetaDia(d.dia)} · ${s.etiqueta}: ${formato(v)}`}</title>
                  </rect>
                );
              })}
            </g>
          );
        })}
      </svg>
      <ul className="adm-grafico-leyenda">
        {series.map((s) => (
          <li key={s.clave}>
            <span className="adm-grafico-punto" style={{ background: s.color }} aria-hidden="true" />
            {s.etiqueta}
          </li>
        ))}
      </ul>
      <TablaOculta
        etiqueta={etiqueta}
        filas={filas.map((d) => ({
          etiqueta: etiquetaDia(d.dia),
          valor: series.map((s) => `${s.etiqueta}: ${formato(Number(d[s.clave]) || 0)}`).join(" · "),
        }))}
      />
    </figure>
  );
}

// Dona para proporciones (pedidos por estado).
export function Donut({ datos, etiqueta }) {
  const filas = (datos ?? []).filter((d) => Number(d.valor) > 0);
  const total = filas.reduce((acc, d) => acc + Number(d.valor), 0);
  if (!filas.length || total === 0) return textoVacio();
  const radio = 44;
  const circunferencia = 2 * Math.PI * radio;
  const largos = filas.map((d) => (Number(d.valor) / total) * circunferencia);
  const inicios = largos.map((_, i) =>
    largos.slice(0, i).reduce((acc, largo) => acc + largo, 0)
  );

  return (
    <figure className="adm-grafico adm-grafico-donut">
      <svg viewBox="0 0 120 120" role="img" aria-label={`${etiqueta}. Total: ${total}.`}>
        <title>{etiqueta}</title>
        <circle cx="60" cy="60" r={radio} className="adm-grafico-donut-fondo" />
        {filas.map((d, i) => {
          const parte = Number(d.valor) / total;
          const largo = largos[i];
          return (
            <circle
              key={d.etiqueta}
              cx="60"
              cy="60"
              r={radio}
              fill="none"
              stroke={d.color ?? AZUL}
              strokeWidth="16"
              strokeDasharray={`${largo} ${circunferencia - largo}`}
              strokeDashoffset={-inicios[i]}
              transform="rotate(-90 60 60)"
            >
              <title>{`${d.etiqueta}: ${d.valor} (${Math.round(parte * 100)}%)`}</title>
            </circle>
          );
        })}
        <text x="60" y="58" textAnchor="middle" className="adm-grafico-donut-total">
          {total}
        </text>
        <text x="60" y="72" textAnchor="middle" className="adm-grafico-donut-sub">
          pedidos
        </text>
      </svg>
      <ul className="adm-grafico-leyenda">
        {filas.map((d) => (
          <li key={d.etiqueta}>
            <span className="adm-grafico-punto" style={{ background: d.color ?? AZUL }} aria-hidden="true" />
            {d.etiqueta}: <strong>{d.valor}</strong>
          </li>
        ))}
      </ul>
      <TablaOculta
        etiqueta={etiqueta}
        filas={filas.map((d) => ({ etiqueta: d.etiqueta, valor: d.valor }))}
      />
    </figure>
  );
}

// Ranking horizontal (top productos).
export function BarrasHorizontales({ datos, valor, etiqueta, formato = (n) => n }) {
  const filas = datos ?? [];
  if (!filas.length) return textoVacio();
  const max = Math.max(1, ...filas.map((d) => Number(valor(d)) || 0));

  return (
    <figure className="adm-grafico">
      <ul className="adm-ranking">
        {filas.map((d, i) => (
          <li key={d.producto_id ?? d.etiqueta ?? i}>
            <div className="adm-ranking-fila">
              <span className="adm-ranking-puesto">{i + 1}</span>
              <span className="adm-ranking-nombre">{d.nombre ?? d.etiqueta}</span>
              <strong className="adm-ranking-valor">{formato(Number(valor(d)) || 0)}</strong>
            </div>
            <span className="adm-ranking-barra" aria-hidden="true">
              <span style={{ width: `${(Number(valor(d)) / max) * 100}%` }} />
            </span>
          </li>
        ))}
      </ul>
      <TablaOculta
        etiqueta={etiqueta}
        filas={filas.map((d) => ({
          etiqueta: d.nombre ?? d.etiqueta,
          valor: formato(Number(valor(d)) || 0),
        }))}
      />
    </figure>
  );
}
