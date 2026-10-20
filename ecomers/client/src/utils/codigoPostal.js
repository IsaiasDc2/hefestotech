// Código postal argentino de 4 dígitos (formato viejo, el que pide el
// checkout). Se recuerda en el navegador para no pedirlo en cada pantalla.
const CLAVE = "ht-cp";

export const esCpValido = (cp) => /^[0-9]{4}$/.test(String(cp ?? "").trim());

export function leerCp() {
  try {
    const cp = localStorage.getItem(CLAVE) ?? "";
    return esCpValido(cp) ? cp : "";
  } catch {
    return "";
  }
}

export function guardarCp(cp) {
  try {
    if (esCpValido(cp)) localStorage.setItem(CLAVE, String(cp).trim());
  } catch {
    // Sin almacenamiento (modo privado): solo se pierde el recuerdo.
  }
}
