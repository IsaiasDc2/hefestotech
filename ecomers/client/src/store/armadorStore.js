import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { ORDEN_PASOS } from "../data/armadorCatalogo";

const seleccionVacia = () =>
  Object.fromEntries(ORDEN_PASOS.map((paso) => [paso, null]));

const useArmadorStore = create(
  persist(
    (set, get) => ({
      seleccion: seleccionVacia(),
      pasoActual: ORDEN_PASOS[0],

      setPieza: (categoria, pieza) =>
        set({
          seleccion: { ...get().seleccion, [categoria]: pieza ?? null },
        }),

      quitarPieza: (categoria) =>
        set({
          seleccion: { ...get().seleccion, [categoria]: null },
        }),

      limpiar: () => set({ seleccion: seleccionVacia(), pasoActual: ORDEN_PASOS[0] }),

      setPaso: (paso) =>
        set({ pasoActual: ORDEN_PASOS.includes(paso) ? paso : ORDEN_PASOS[0] }),

      irAlSiguientePaso: () => {
        const i = ORDEN_PASOS.indexOf(get().pasoActual);
        if (i >= 0 && i < ORDEN_PASOS.length - 1) {
          set({ pasoActual: ORDEN_PASOS[i + 1] });
        }
      },
    }),
    {
      name: "hefestotech-armador",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        seleccion: state.seleccion,
        pasoActual: state.pasoActual,
      }),
      merge: (persisted, current) => {
        const p = persisted && typeof persisted === "object" ? persisted : {};
        const base = seleccionVacia();
        const sel =
          p.seleccion && typeof p.seleccion === "object" ? p.seleccion : {};
        return {
          ...current,
          ...p,
          seleccion: { ...base, ...sel },
          pasoActual: ORDEN_PASOS.includes(p.pasoActual) ? p.pasoActual : ORDEN_PASOS[0],
        };
      },
    }
  )
);

export default useArmadorStore;
