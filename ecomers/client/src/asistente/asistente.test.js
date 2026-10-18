import { describe, expect, test } from "vitest";
import { crearLectorSSE } from "./sse.js";
import { ErrorChat, enviarChat } from "./cliente.js";
import {
  MARCA_TARJETA,
  cargarConversacion,
  comprable,
  guardarConversacion,
  historialParaApi,
  limpiarTarjetas,
  productoParaCarrito,
} from "./conversacion.js";

const almacen = () => {
  const datos = new Map();
  return {
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => datos.set(k, String(v)),
    removeItem: (k) => datos.delete(k),
  };
};

function respuestaSSE(trozos, { status = 200, tipo = "text/event-stream" } = {}) {
  const cod = new TextEncoder();
  const body = new ReadableStream({
    start(control) {
      for (const t of trozos) control.enqueue(cod.encode(t));
      control.close();
    },
  });
  return new Response(body, { status, headers: { "content-type": tipo } });
}

describe("lector SSE", () => {
  test("arma eventos aunque lleguen cortados entre chunks y con CRLF", () => {
    const eventos = [];
    const lector = crearLectorSSE((e, d) => eventos.push([e, d]));
    lector.alimentar('event: texto\r\ndata: {"delta":"Ho');
    lector.alimentar('la"}\r\n\r\nevent: fin\ndata: {}\n\n: comentario\n\n');
    lector.cerrar();
    expect(eventos).toEqual([["texto", { delta: "Hola" }], ["fin", {}]]);
  });

  test("ignora data que no es JSON", () => {
    const eventos = [];
    const lector = crearLectorSSE((e, d) => eventos.push([e, d]));
    lector.alimentar("event: x\ndata: {roto\n\n");
    expect(eventos).toEqual([]);
  });
});

describe("cliente del chat", () => {
  test("reenvía cada evento del stream y termina en fin", async () => {
    const recibidos = [];
    let cuerpo = null;
    const fetcher = async (_url, init) => {
      cuerpo = JSON.parse(init.body);
      return respuestaSSE([
        'event: inicio\ndata: {"id":"abc","modo":"mock"}\n\n',
        'event: texto\ndata: {"delta":"Sí, "}\n\nevent: texto\ndata: {"delta":"hay stock."}\n\n',
        'event: productos\ndata: {"productos":[{"id":"p1"}]}\n\nevent: fin\ndata: {}\n\n',
      ]);
    };
    await enviarChat({
      mensajes: [{ rol: "usuario", texto: "hola" }], sesion: "s1", carrito: [{ id: "p1", cantidad: 1 }],
      alEvento: (e, d) => recibidos.push(e === "texto" ? d.delta : e), fetcher,
    });
    expect(cuerpo).toEqual({ mensajes: [{ rol: "usuario", texto: "hola" }], sesion: "s1", carrito: [{ id: "p1", cantidad: 1 }] });
    expect(recibidos).toEqual(["inicio", "Sí, ", "hay stock.", "productos", "fin"]);
  });

  test("429 y 422 llegan como ErrorChat con el detalle del servidor", async () => {
    const json = (status, detail) => async () =>
      new Response(JSON.stringify({ detail }), { status, headers: { "content-type": "application/json" } });
    await expect(enviarChat({ mensajes: [], alEvento() {}, fetcher: json(429, "Esperá un minuto.") }))
      .rejects.toMatchObject({ tipo: "limite", detalle: "Esperá un minuto." });
    await expect(enviarChat({
      mensajes: [], alEvento() {}, fetcher: json(422, [{ msg: "Value error, El mensaje no puede estar vacío." }]),
    })).rejects.toMatchObject({ tipo: "validacion", detalle: "El mensaje no puede estar vacío." });
  });

  test("backend caído o stream cortado", async () => {
    const caido = async () => {
      throw new TypeError("Failed to fetch");
    };
    await expect(enviarChat({ mensajes: [], alEvento() {}, fetcher: caido })).rejects.toBeInstanceOf(ErrorChat);
    const cortado = async () => respuestaSSE(['event: texto\ndata: {"delta":"a medias"}\n\n']);
    await expect(enviarChat({ mensajes: [], alEvento() {}, fetcher: cortado }))
      .rejects.toMatchObject({ tipo: "interrumpido" });
  });
});

describe("conversación", () => {
  test("borra números de tarjeta válidos (Luhn) y el CVV, no otros números", () => {
    const limpio = limpiarTarjetas("mi tarjeta 4509 9535 6623 3704 cvv 123, pedido 12345678, presupuesto 1500000");
    expect(limpio).toContain(MARCA_TARJETA);
    expect(limpio).not.toContain("4509");
    expect(limpio).not.toMatch(/cvv 123/);
    expect(limpio).toContain("12345678");
    expect(limpio).toContain("1500000");
  });

  test("persiste y recupera; vence a las 24 h", () => {
    const a = almacen();
    const mensajes = [
      { id: "1", rol: "usuario", texto: "hola", hora: 1 },
      { id: "2", rol: "ia", texto: "", pendiente: true },
    ];
    guardarConversacion({ sesion: "s-1", mensajes, modo: "mock" }, a);
    expect(cargarConversacion(a)).toEqual({
      sesion: "s-1",
      modo: "mock",
      mensajes: [{ id: "1", rol: "usuario", texto: "hola", hora: 1 }],
    });
    const crudo = JSON.parse(a.getItem("hefestotech-asistente"));
    a.setItem("hefestotech-asistente", JSON.stringify({ ...crudo, guardado: Date.now() - 25 * 3600 * 1000 }));
    expect(cargarConversacion(a)).toBeNull();
  });

  test("el historial para la API solo lleva texto visible", () => {
    const h = historialParaApi([
      { rol: "usuario", texto: "a" },
      { rol: "ia", texto: "b", productos: [{}] },
      { rol: "ia", texto: "  " },
    ]);
    expect(h).toEqual([{ rol: "usuario", texto: "a" }, { rol: "asistente", texto: "b" }]);
  });

  test("tarjeta → producto del carrito respeta oferta, imagen relativa y comprabilidad", () => {
    const tarjeta = {
      id: "x", codigo: "HT-1", nombre: "Monitor", marca: "LG", categoria: "Monitor",
      precio: 378000, precio_lista: 420000, stock: 3, imagen: "productos/a.webp", precio_a_confirmar: false,
    };
    expect(productoParaCarrito(tarjeta, "/hefestotech/")).toMatchObject({
      precio: 420000, precio_con_descuento: 378000, imagen: "/hefestotech/productos/a.webp",
    });
    expect(comprable(tarjeta)).toBe(true);
    expect(comprable({ ...tarjeta, stock: 0 })).toBe(false);
    expect(comprable({ ...tarjeta, precio: 0, precio_a_confirmar: true })).toBe(false);
  });
});
