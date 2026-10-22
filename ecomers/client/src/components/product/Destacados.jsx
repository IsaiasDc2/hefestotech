import {
  FaBolt,
  FaCircleInfo,
  FaDisplay,
  FaFan,
  FaGaugeHigh,
  FaHardDrive,
  FaLayerGroup,
  FaMemory,
  FaMicrochip,
  FaPlug,
  FaRulerCombined,
  FaShieldHalved,
  FaVolumeHigh,
  FaWifi,
} from "react-icons/fa6";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import { destacadosProducto } from "../../utils/destacados";
import "./PanelPrecio.css";

// Ícono por clave de especificación (las que no están usan uno genérico).
const ICONOS = {
  nucleos: FaMicrochip,
  socket: FaMicrochip,
  chipset: FaMicrochip,
  hilos: FaLayerGroup,
  frecuenciaTurbo: FaGaugeHigh,
  frecuenciaBoost: FaGaugeHigh,
  frecuenciaBase: FaGaugeHigh,
  velocidad: FaGaugeHigh,
  tasaRefresco: FaGaugeHigh,
  dpiMaximo: FaGaugeHigh,
  cacheL3: FaMemory,
  memoriaMaxima: FaMemory,
  interfazMemoria: FaMemory,
  ranurasRAM: FaMemory,
  latencia: FaMemory,
  capacidad: FaHardDrive,
  velocidadLectura: FaHardDrive,
  interfaz: FaHardDrive,
  puertosM2: FaHardDrive,
  potencia: FaBolt,
  consumo: FaBolt,
  fuenteRecomendada: FaBolt,
  potenciaTotal: FaBolt,
  tdpMaximo: FaBolt,
  tamanio: FaDisplay,
  resolucion: FaDisplay,
  panel: FaDisplay,
  tiempoRespuesta: FaDisplay,
  formato: FaRulerCombined,
  longitud: FaRulerCombined,
  dimensiones: FaRulerCombined,
  compatibilidadMB: FaRulerCombined,
  panelLateral: FaRulerCombined,
  conexion: FaPlug,
  conectores: FaPlug,
  wifi: FaWifi,
  certificacion: FaShieldHalved,
  modular: FaShieldHalved,
  proteccion: FaShieldHalved,
  ventiladores: FaFan,
  ventilador: FaFan,
  ventiladoresIncluidos: FaFan,
  sonido: FaVolumeHigh,
};

/** Fila de "Características principales" con las specs reales del producto. */
function Destacados({ producto }) {
  const idioma = useIdiomaStore((s) => s.idioma);
  const items = destacadosProducto(producto, {
    idioma,
    si: t(idioma, "pd.si"),
    no: t(idioma, "pd.no"),
  });
  // Un solo dato suelto no es un "resumen": ya está en la tabla de abajo.
  if (items.length < 2) return null;

  return (
    <section className="dst" aria-labelledby="dst-titulo">
      <h2 id="dst-titulo" className="dst-titulo">
        {t(idioma, "pp.destacados")}
      </h2>
      <ul className="dst-lista">
        {items.map(({ clave, etiqueta, valor }) => {
          const Icono = ICONOS[clave] ?? FaCircleInfo;
          return (
            <li key={clave} className="dst-item" title={`${etiqueta}: ${valor}`}>
              <Icono className="dst-icono" aria-hidden="true" />
              <strong className="dst-valor">{valor}</strong>
              <span className="dst-etiqueta">{etiqueta}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default Destacados;
