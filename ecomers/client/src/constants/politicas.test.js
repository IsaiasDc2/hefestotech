import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  costoEnvio,
  COSTO_ENVIO_ESTANDAR,
  COSTO_ENVIO_EXPRESS,
  CUOTAS_SIN_INTERES,
  DESCUENTO_TRANSFERENCIA_PCT,
  GARANTIA_MESES,
  UMBRAL_ENVIO_GRATIS,
} from "./politicas";
import { TEXTO } from "../store/idiomaStore";

const backend = readFileSync(new URL("../../../../backend/checkout_api.py", import.meta.url), "utf8");
const centavos = (nombre) => {
  const m = new RegExp(`^${nombre}\\s*=\\s*([\\d_]+)\\s*\\*\\s*100`, "m").exec(backend);
  return m ? Number(m[1].replaceAll("_", "")) : null;
};

describe("condiciones comerciales", () => {
  test("envíos: el front muestra exactamente lo que cobra el backend", () => {
    expect(UMBRAL_ENVIO_GRATIS).toBe(centavos("UMBRAL_ENVIO_GRATIS_CENT"));
    expect(COSTO_ENVIO_ESTANDAR).toBe(centavos("ENVIO_ESTANDAR_CENT"));
    expect(COSTO_ENVIO_EXPRESS).toBe(centavos("ENVIO_EXPRESS_CENT"));
  });

  test("costoEnvio replica la regla del servidor (gratis desde el umbral, para cualquier método)", () => {
    expect(costoEnvio(UMBRAL_ENVIO_GRATIS - 1, "estandar")).toBe(COSTO_ENVIO_ESTANDAR);
    expect(costoEnvio(UMBRAL_ENVIO_GRATIS - 1, "express")).toBe(COSTO_ENVIO_EXPRESS);
    expect(costoEnvio(UMBRAL_ENVIO_GRATIS, "estandar")).toBe(0);
    expect(costoEnvio(UMBRAL_ENVIO_GRATIS * 4, "express")).toBe(0);
    expect(costoEnvio(0)).toBe(COSTO_ENVIO_ESTANDAR);
    // Mismo condicional que checkout_api.py:  if subtotal >= UMBRAL: envio = 0
    expect(backend).toMatch(/if subtotal >= UMBRAL_ENVIO_GRATIS_CENT:\s*\n\s*envio_cent = 0/);
  });

  test("lo publicado en el sitio coincide con las constantes", () => {
    // Textos de inicio/encabezado que mencionan estos valores.
    expect(TEXTO.es["promo.offT"]).toContain(`${DESCUENTO_TRANSFERENCIA_PCT}%`);
    expect(TEXTO.en["promo.offT"]).toContain(`${DESCUENTO_TRANSFERENCIA_PCT}%`);
    expect(TEXTO.es["hd.aviso"]).toContain(`${CUOTAS_SIN_INTERES} cuotas sin interés`);
    expect(TEXTO.es["home.garantiaS"]).toContain(`${GARANTIA_MESES} meses`);
    expect(TEXTO.en["home.garantiaS"]).toContain(`${GARANTIA_MESES} months`);
    expect(TEXTO.es["hd.aviso"]).toContain("150.000");
  });
});
