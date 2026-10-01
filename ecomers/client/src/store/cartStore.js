import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Fuente de verdad del carrito en la capa de datos.
// NOTA: App.jsx mantiene hoy su propio useState de carrito (no se puede
// tocar en este scope). Cuando su dueño lo migre, basta con reemplazar ese
// useState por este store: las firmas son las mismas
// (carrito, isCartOpen, abrirCarrito, cerrarCarrito, agregarAlCarrito,
// eliminarDelCarrito, aumentarCantidad, disminuirCantidad) más los extras
// vaciarCarrito, cantidadTotal y total.
const useCartStore = create(
  persist(
    (set, get) => ({
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
        set({ isCartOpen: true });
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
          (acc, item) =>
            acc +
            Number(item.precio_con_descuento ?? item.precio ?? 0) *
              item.cantidad,
          0
        );
      },
    }),
    {
      name: "hefestotech-carrito",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ carrito: state.carrito }),
    }
  )
);

export default useCartStore;
