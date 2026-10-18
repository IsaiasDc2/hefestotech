import { useEffect, useEffectEvent, useState } from "react";

/**
 * Carga asíncrona atada a una clave. Cada vez que cambia `clave` se vuelve
 * a pedir; con `clave == null` no se pide nada. El estado de carga se
 * deriva de si el resultado corresponde a la clave vigente, así no hay
 * resultados viejos pisando a los nuevos ni setState sincrónico en efectos.
 */
export default function useCarga(cargar, clave) {
  const [res, setRes] = useState({ clave: undefined, datos: undefined, error: null });
  const ejecutar = useEffectEvent(() => cargar());

  useEffect(() => {
    if (clave == null) return undefined;
    let vivo = true;
    Promise.resolve()
      .then(ejecutar)
      .then(
        (datos) => vivo && setRes({ clave, datos, error: null }),
        (error) => vivo && setRes({ clave, datos: undefined, error })
      );
    return () => {
      vivo = false;
    };
  }, [clave]);

  const vigente = clave != null && res.clave === clave;
  return {
    datos: vigente ? res.datos : undefined,
    error: vigente ? res.error : null,
    cargando: clave != null && !vigente,
  };
}
