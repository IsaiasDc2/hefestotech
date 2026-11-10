import { useCallback, useState } from "react";

// Listas largas: se muestran de a PASO_CARGA y el botón "Cargar más" suma
// otro tramo. La cantidad vuelve al primer tramo cuando cambia `clave`
// (búsqueda, filtro, pestaña), derivado en el render y sin efectos.
export const PASO_CARGA = 5;

export default function useCargarMas(clave = "", paso = PASO_CARGA) {
  const [estado, setEstado] = useState({ clave, cantidad: paso });
  const cantidad = estado.clave === clave ? estado.cantidad : paso;
  const mas = useCallback(
    () => setEstado({ clave, cantidad: cantidad + paso }),
    [clave, cantidad, paso]
  );
  // Desde qué índice llegó el último tramo (para animar solo lo nuevo).
  const desdeLote = cantidad > paso ? cantidad - paso : Infinity;
  const claseLote = (i) => (i >= desdeLote ? "entra-lote" : "");
  const estiloLote = (i) => (i >= desdeLote ? { "--lote": i - desdeLote } : undefined);
  return { cantidad, mas, claseLote, estiloLote };
}
