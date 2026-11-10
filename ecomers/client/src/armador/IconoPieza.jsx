// Íconos de línea de cada pieza del armador (dibujos propios, 48×48, trazo
// con currentColor). Las piezas con partes móviles (ventiladores, disco)
// tienen una clase para girar en hover o cuando son el paso actual.
const TRAZO = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function Ventilador({ cx, cy, r }) {
  return (
    <g className="pieza-gira" style={{ transformOrigin: `${cx}px ${cy}px` }}>
      <circle cx={cx} cy={cy} r={r} />
      <circle cx={cx} cy={cy} r={r * 0.22} />
      <path d={`M${cx} ${cy - r * 0.22} q ${r * 0.5} ${-r * 0.3} ${r * 0.15} ${-r * 0.7}`} />
      <path d={`M${cx + r * 0.2} ${cy + r * 0.1} q ${r * 0.1} ${r * 0.6} ${r * 0.65} ${r * 0.35}`} />
      <path d={`M${cx - r * 0.2} ${cy + r * 0.1} q ${-r * 0.6} ${r * 0.2} ${-r * 0.75} ${-r * 0.35}`} />
    </g>
  );
}

const DIBUJOS = {
  cpu: (
    <>
      <rect x="12" y="12" width="24" height="24" rx="2" />
      <rect x="18" y="18" width="12" height="12" rx="1" />
      {[16, 20, 24, 28, 32].map((v) => (
        <g key={v}>
          <path d={`M${v} 12V7`} />
          <path d={`M${v} 36v5`} />
          <path d={`M12 ${v}H7`} />
          <path d={`M36 ${v}h5`} />
        </g>
      ))}
    </>
  ),
  mother: (
    <>
      <rect x="7" y="6" width="34" height="36" rx="2" />
      <rect x="12" y="11" width="11" height="11" rx="1" />
      <path d="M28 11h8M28 15h8M28 19h8" />
      <path d="M12 27h24M12 31h24" />
      <rect x="12" y="35" width="6" height="3" />
      <rect x="21" y="35" width="6" height="3" />
      <circle cx="34" cy="36.5" r="1.5" />
    </>
  ),
  ram: (
    <>
      <path d="M5 18h38v12H5z" />
      <path d="M5 30v4h38v-4" />
      <path d="M22 34v-2h4v2" />
      <rect x="9" y="21" width="6" height="6" />
      <rect x="18" y="21" width="6" height="6" />
      <rect x="27" y="21" width="6" height="6" />
      <rect x="36" y="21" width="4" height="6" />
    </>
  ),
  gpu: (
    <>
      <rect x="5" y="13" width="38" height="20" rx="2" />
      <Ventilador cx={16} cy={23} r={7} />
      <Ventilador cx={32} cy={23} r={7} />
      <path d="M9 33v5h14v-5" />
      <path d="M43 17h2v12h-2" />
    </>
  ),
  almacenamiento: (
    <>
      <rect x="10" y="5" width="28" height="38" rx="3" />
      <g className="pieza-gira" style={{ transformOrigin: "24px 20px" }}>
        <circle cx="24" cy="20" r="10" />
        <circle cx="24" cy="20" r="2" />
        <path d="M24 10v3" />
      </g>
      <path d="M31 31l-6-9" />
      <path d="M15 38h4M29 38h4" />
    </>
  ),
  refrigeracion: (
    <>
      <path d="M8 34h32v6H8z" />
      {[11, 15, 19, 23, 27, 31, 35].map((x) => (
        <path key={x} d={`M${x} 34V12`} />
      ))}
      <rect x="9" y="9" width="30" height="25" rx="2" />
      <Ventilador cx={24} cy={21.5} r={9} />
    </>
  ),
  fuente: (
    <>
      <rect x="5" y="11" width="38" height="26" rx="2" />
      <Ventilador cx={17} cy={24} r={8} />
      <rect x="30" y="16" width="8" height="6" rx="1" />
      <path d="M32 18.5h1.5M35 18.5h1" />
      <rect x="30" y="26" width="8" height="6" rx="1" />
      <path d="M34 28v2" />
    </>
  ),
  gabinete: (
    <>
      <rect x="12" y="4" width="24" height="40" rx="2" />
      <path d="M16 8h16" />
      <Ventilador cx={24} cy={19} r={6} />
      <Ventilador cx={24} cy={33} r={6} />
      <path d="M16 44v-1M32 44v-1" />
    </>
  ),
  extras: (
    <>
      <rect x="4" y="6" width="26" height="17" rx="1.5" />
      <path d="M14 23v4h6v-4M11 27h12" />
      <path d="M34 9a7 7 0 0 1 10 0" />
      <rect x="32" y="10" width="3" height="6" rx="1" />
      <rect x="43" y="10" width="3" height="6" rx="1" />
      <rect x="6" y="33" width="24" height="10" rx="1.5" />
      <path d="M9 36h2M13 36h2M17 36h2M21 36h2M25 36h2M10 40h16" />
      <path d="M38 30c3 0 5 2 5 5v4c0 3-2 5-5 5s-5-2-5-5v-4c0-3 2-5 5-5z" />
      <path d="M38 30v5" />
    </>
  ),
};

export default function IconoPieza({ pieza, className = "" }) {
  const dibujo = DIBUJOS[pieza] ?? DIBUJOS.extras;
  return (
    <svg className={`icono-pieza ${className}`.trim()} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <g {...TRAZO}>{dibujo}</g>
    </svg>
  );
}
