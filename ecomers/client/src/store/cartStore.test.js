import { beforeEach, describe, expect, test } from "vitest";
import useCartStore from "./cartStore";

const gpu = { id: "gpu", nombre: "GPU", precio: 1000, stock: 2 };
const cpu = { id: "cpu", nombre: "CPU", precio: 500, stock: 5 };

const carrito = () => useCartStore.getState().carrito;

beforeEach(() => {
  useCartStore.setState({ carrito: [], isCartOpen: false });
});

describe("carrito", () => {
  test("agregar suma cantidades y abre el carrito", () => {
    const { agregarAlCarrito } = useCartStore.getState();
    agregarAlCarrito(cpu);
    agregarAlCarrito(cpu, 2);
    expect(carrito()).toEqual([{ ...cpu, cantidad: 3 }]);
    expect(useCartStore.getState().isCartOpen).toBe(true);
  });

  test("nunca supera el stock conocido (F15)", () => {
    const { agregarAlCarrito, aumentarCantidad } = useCartStore.getState();
    agregarAlCarrito(gpu, 5);
    expect(carrito()[0].cantidad).toBe(2);
    aumentarCantidad("gpu");
    expect(carrito()[0].cantidad).toBe(2);
  });

  test("disminuir no baja de 1", () => {
    const { agregarAlCarrito, disminuirCantidad } = useCartStore.getState();
    agregarAlCarrito(cpu);
    disminuirCantidad("cpu");
    expect(carrito()[0].cantidad).toBe(1);
  });

  test("agregarVarios hace un solo alta en lote (armador)", () => {
    useCartStore.getState().agregarVarios([cpu, gpu, null, cpu]);
    expect(carrito().map((i) => [i.id, i.cantidad])).toEqual([
      ["cpu", 2],
      ["gpu", 1],
    ]);
  });

  test("restaurarCarrito ignora basura y normaliza cantidades", () => {
    useCartStore.getState().restaurarCarrito([{ ...cpu, cantidad: "0" }, { nombre: "sin id" }]);
    expect(carrito()).toEqual([{ ...cpu, cantidad: 1 }]);
  });

  test("total usa el precio con descuento si existe", () => {
    const { agregarAlCarrito, getTotal } = useCartStore.getState();
    agregarAlCarrito({ ...cpu, precio_con_descuento: 450 }, 2);
    expect(getTotal()).toBe(900);
  });
});
