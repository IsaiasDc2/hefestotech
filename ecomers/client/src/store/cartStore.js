import { create } from "zustand";

const useCartStore = create((set, get) => ({
  carrito: [],
  isCartOpen: false,

  abrirCarrito: () => set({ isCartOpen: true }),
  cerrarCarrito: () => set({ isCartOpen: false }),

  agregarAlCarrito: (producto) => {
    const carritoActual = get().carrito;
    const existe = carritoActual.find((item) => item.id === producto.id);

    if (existe) {
      set({
        carrito: carritoActual.map((item) =>
          item.id === producto.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        ),
      });
    } else {
      set({ carrito: [...carritoActual, { ...producto, cantidad: 1 }] });
    }
  },

  eliminarDelCarrito: (id) => {
    set({ carrito: get().carrito.filter((item) => item.id !== id) });
  },

  aumentarCantidad: (id) => {
    set({
      carrito: get().carrito.map((item) =>
        item.id === id ? { ...item, cantidad: item.cantidad + 1 } : item
      ),
    });
  },

  disminuirCantidad: (id) => {
    set({
      carrito: get().carrito.map((item) =>
        item.id === id && item.cantidad > 1
          ? { ...item, cantidad: item.cantidad - 1 }
          : item
      ),
    });
  },

  vaciarCarrito: () => set({ carrito: [] }),

  getCantidadTotal: () => {
    return get().carrito.reduce((acc, item) => acc + item.cantidad, 0);
  },

  getTotal: () => {
    return get().carrito.reduce(
      (acc, item) => acc + item.precio * item.cantidad,
      0
    );
  },
}));

export default useCartStore;