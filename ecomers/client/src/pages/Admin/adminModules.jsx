// HefestoTech · Admin · registro único de módulos del panel.
// `permiso` es el permiso mínimo para verlo en la navegación; el backend
// vuelve a validar cada endpoint. Un módulo nuevo se agrega acá una sola vez.
import {
  FaBell,
  FaBox,
  FaBoxesStacked,
  FaCartShopping,
  FaChartLine,
  FaCircleUser,
  FaClipboardList,
  FaFileInvoiceDollar,
  FaGear,
  FaHouse,
  FaMessage,
  FaMoneyBillWave,
  FaRectangleAd,
  FaScaleBalanced,
  FaTrashCan,
  FaTruck,
} from "react-icons/fa6";

export const MODULOS = [
  { id: "inicio", etiqueta: "Inicio", Icono: FaHouse, permiso: ["reportes", "leer"] },
  { id: "productos", etiqueta: "Productos", Icono: FaBox, permiso: ["productos", "leer"] },
  { id: "stock", etiqueta: "Stock", Icono: FaBoxesStacked, permiso: ["stock", "leer"] },
  { id: "proveedores", etiqueta: "Proveedores", Icono: FaTruck, permiso: ["proveedores", "leer"] },
  { id: "compras", etiqueta: "Compras", Icono: FaFileInvoiceDollar, permiso: ["compras", "leer"] },
  { id: "pedidos", etiqueta: "Pedidos", Icono: FaCartShopping, permiso: ["pedidos", "leer"] },
  { id: "reclamos", etiqueta: "Reclamos", Icono: FaMessage, permiso: ["reclamos", "leer"] },
  { id: "whatsapp", etiqueta: "WhatsApp", Icono: FaClipboardList, permiso: ["reclamos", "leer"] },
  { id: "banners", etiqueta: "Banners", Icono: FaRectangleAd, permiso: ["banners", "leer"] },
  { id: "cupones", etiqueta: "Cupones", Icono: FaMoneyBillWave, permiso: ["cupones", "leer"] },
  { id: "reportes", etiqueta: "Reportes", Icono: FaChartLine, permiso: ["reportes", "leer"] },
  { id: "clientes", etiqueta: "Clientes", Icono: FaCircleUser, permiso: ["usuarios", "leer"] },
  { id: "config", etiqueta: "Config", Icono: FaGear, permiso: ["config", "leer"] },
  { id: "auditoria", etiqueta: "Auditoría", Icono: FaScaleBalanced, permiso: ["auditoria", "leer"] },
  { id: "papelera", etiqueta: "Papelera", Icono: FaTrashCan, permiso: ["productos", "leer"] },
  { id: "notificaciones", etiqueta: "Notificaciones", Icono: FaBell, permiso: ["notificaciones", "leer"] },
];

export function modulosVisibles(puede) {
  return MODULOS.filter((m) => puede(m.permiso[0], m.permiso[1]));
}
