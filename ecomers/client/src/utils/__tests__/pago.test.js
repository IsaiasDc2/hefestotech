import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  soloDigitos,
  formatearTarjeta,
  formatearVenc,
  detectarMarca,
  pasaLuhn,
  vencimientoValido,
} from "../pago.js";

describe("soloDigitos", () => {
  it("deja solo digitos", () => assert.equal(soloDigitos("4242-4242 4242"), "424242424242"));
  it("valor por defecto", () => assert.equal(soloDigitos(), ""));
});

describe("formatearTarjeta", () => {
  it("agrupa de a 4 y corta en 16", () =>
    assert.equal(formatearTarjeta("42424242424242424299"), "4242 4242 4242 4242"));
  it("texto parcial", () => assert.equal(formatearTarjeta("4242"), "4242"));
});

describe("formatearVenc", () => {
  it("inserta barra", () => assert.equal(formatearVenc("1228"), "12/28"));
  it("menos de 3 digitos sin barra", () => assert.equal(formatearVenc("12"), "12"));
});

describe("detectarMarca", () => {
  it("visa/master/amex/desconocida/vacia", () => {
    assert.equal(detectarMarca("4111"), "Visa");
    assert.equal(detectarMarca("5500"), "Mastercard");
    assert.equal(detectarMarca("2221"), "Mastercard");
    assert.equal(detectarMarca("3712"), "Amex");
    assert.equal(detectarMarca("6011"), "Tarjeta");
    assert.equal(detectarMarca(""), "");
  });
});

describe("pasaLuhn", () => {
  it("acepta 4242...42", () => assert.equal(pasaLuhn("4242 4242 4242 4242"), true));
  it("rechaza numero invalido", () => assert.equal(pasaLuhn("4242 4242 4242 4241"), false));
  it("rechaza cortos", () => assert.equal(pasaLuhn("123"), false));
});

describe("vencimientoValido", () => {
  it("futuro valido", () => assert.equal(vencimientoValido("12/99"), true));
  it("pasado invalido", () => assert.equal(vencimientoValido("01/20"), false));
  it("formato invalido", () => {
    assert.equal(vencimientoValido("13/30"), false);
    assert.equal(vencimientoValido(""), false);
  });
});
