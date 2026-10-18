import { useCallback, useEffect, useState } from "react";
import { obtenerCatalogo } from "../services/productService";

/**
 * Catálogo visible (activo y fuera de papelera) con estados de carga,
 * error y reintento. El estado de carga se deriva del número de intento:
 * no hace falta un setState sincrónico dentro del efecto.
 */
export default function useCatalogo() {
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState({ intento: -1, productos: [], error: null });

  useEffect(() => {
    let vivo = true;
    obtenerCatalogo({ forzar: intento > 0 }).then(
      (productos) => vivo && setResultado({ intento, productos, error: null }),
      (error) => vivo && setResultado({ intento, productos: [], error })
    );
    return () => {
      vivo = false;
    };
  }, [intento]);

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);
  const cargando = resultado.intento !== intento;

  return {
    productos: resultado.productos,
    error: cargando ? null : resultado.error,
    cargando,
    reintentar,
  };
}
