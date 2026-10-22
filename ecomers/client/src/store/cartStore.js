import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Tope por línea: el stock que conocemos del producto (si es un número).
// El servidor vuelve a validar al crear la orden; esto evita que el
// comprador se entere recién en el checkout.
const tope = (producto) => {
  const stock = Number(producto?.stock);
  return Number.isFinite(stock) && stock > 0 ? stock : Infinity;
};

function sumar(carrito, producto, cantidad) {
  const existe = carrito.find((item) => item.id === producto.id);
  if (existe) {
    return carrito.map((item) =>
      item.id === producto.id
        ? { ...item, cantidad: Math.min(item.cantidad + cantidad, tope(producto)) }
        : item
    );
  }
  return [...carrito, { ...producto, cantidad: Math.min(cantidad, tope(producto)) }];
}

const useCartStore = create(
  persist(
    (set, get) => ({
      carrito: [],
      isCartOpen: false,

      abrirCarrito: () => set({ isCartOpen: true }),
      cerrarCarrito: () => set({ isCartOpen: false }),

      // abrir: false lo usa el asistente, que confirma el alta en su propia
      // tarjeta sin tapar el chat con el carrito lateral.
      agregarAlCarrito: (producto, cantidad = 1, { abrir = true } = {}) => {
        const n = Math.max(1, Math.floor(Number(cantidad) || 1));
        set({ carrito: sumar(get().carrito, producto, n), ...(abrir ? { isCartOpen: true } : {}) });
      },

      // Alta en lote (armador): un solo cambio de estado y una sola apertura
      // del carrito, en vez de abrirlo una vez por componente.
      agregarVarios: (productos = [], { abrir = true } = {}) => {
        const carrito = productos
          .filter(Boolean)
          .reduce((acc, producto) => sumar(acc, producto, 1), get().carrito);
        set({ carrito, ...(abrir ? { isCartOpen: true } : {}) });
      },

      eliminarDelCarrito: (id) => {
        set({ carrito: get().carrito.filter((item) => item.id !== id) });
      },

      aumentarCantidad: (id) => {
        set({
          carrito: get().carrito.map((item) =>
            item.id === id
              ? { ...item, cantidad: Math.min(item.cantidad + 1, tope(item)) }
              : item
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

      // Vuelve a cargar un carrito guardado (p. ej. el respaldo previo a
      // Mercado Pago cuando el pago falla o se cancela).
      restaurarCarrito: (items) => {
        if (!Array.isArray(items) || items.length === 0) return;
        set({
          carrito: items
            .filter((item) => item && item.id != null)
            .map((item) => ({ ...item, cantidad: Math.max(1, Number(item.cantidad) || 1) })),
        });
      },

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

export const topeDeStock = tope;

export default useCartStore;
