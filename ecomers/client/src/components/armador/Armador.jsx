import { useEffect, useMemo, useRef, useState } from "react";
import PasoStepper from "./PasoStepper";
import CatalogoPiezas from "./CatalogoPiezas";
import ResumenArmado from "./ResumenArmado";
import AlertaCompatibilidad from "./AlertaCompatibilidad";
import useArmadorStore from "../../store/armadorStore";
import useCartStore from "../../store/cartStore";
import { CATEGORIAS, ORDEN_PASOS, piezasPorCategoria, nombreCategoria } from "../../data/armadorCatalogo";
import { validarArmado, evaluarPieza } from "../../lib/compatibility/motor";
import { formatoARS, usePrefersReducedMotion } from "../../hooks/useNumeroAnimado";
import "./Armador.css";

function textoListado(filas, total, consumo) {
  const lineas = filas.map((f) =>
    f.pieza ? `• ${f.nombre}: ${f.pieza.marca} ${f.pieza.nombre} — ${formatoARS(f.pieza.precio)}` : `• ${f.nombre}: falta elegir`
  );
  return [
    "Mi armado HefestoTech",
    ...lineas,
    `Total: ${formatoARS(total)}`,
    `Consumo estimado: ${consumo} W`,
  ].join("\n");
}

function Armador() {
  const seleccion = useArmadorStore((s) => s.seleccion);
  const pasoActual = useArmadorStore((s) => s.pasoActual);
  const setPieza = useArmadorStore((s) => s.setPieza);
  const quitarPieza = useArmadorStore((s) => s.quitarPieza);
  const limpiar = useArmadorStore((s) => s.limpiar);
  const setPaso = useArmadorStore((s) => s.setPaso);
  const agregarAlCarrito = useCartStore((s) => s.agregarAlCarrito);

  const [sheetAbierto, setSheetAbierto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const resumenRef = useRef(null);
  const flotanteRef = useRef(null);
  const reducido = usePrefersReducedMotion();
  const copiadoTimer = useRef(null);

  const validacion = useMemo(() => validarArmado(seleccion), [seleccion]);
  const { issues, porPieza, estado, consumoEstimadoW, fuenteRecomendadaW } = validacion;

  const piezasPaso = useMemo(() => piezasPorCategoria(pasoActual), [pasoActual]);

  const evaluaciones = useMemo(() => {
    const mapa = {};
    for (const pieza of piezasPaso) {
      mapa[pieza.id] = evaluarPieza(pieza, seleccion);
    }
    return mapa;
  }, [piezasPaso, seleccion]);

  const pasos = useMemo(
    () =>
      CATEGORIAS.map((c) => {
        const elegido = seleccion[c.id] != null;
        const conError = (porPieza[c.id] ?? []).some((i) => i.severidad === "error");
        const estadoPaso = conError ? "error" : elegido ? "completo" : c.id === pasoActual ? "actual" : "vacio";
        return { id: c.id, nombre: c.nombre, estado: estadoPaso };
      }),
    [seleccion, porPieza, pasoActual]
  );

  const filas = useMemo(
    () =>
      ORDEN_PASOS.map((paso) => ({
        paso,
        nombre: nombreCategoria(paso),
        pieza: seleccion[paso] ?? null,
      })),
    [seleccion]
  );

  const total = useMemo(
    () => filas.reduce((acc, f) => acc + (f.pieza ? Number(f.pieza.precio ?? 0) : 0), 0),
    [filas]
  );
  const completados = filas.filter((f) => f.pieza).length;
  const errores = issues.filter((i) => i.severidad === "error").length;
  const advertencias = issues.filter((i) => i.severidad === "advertencia").length;

  useEffect(() => {
    if (!sheetAbierto) return;
    const onKey = (e) => {
      if (e.key === "Escape") setSheetAbierto(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [sheetAbierto]);

  useEffect(() => () => {
    if (copiadoTimer.current) clearTimeout(copiadoTimer.current);
  }, []);

  const volarAlResumen = (origenEl) => {
    if (reducido || !origenEl) return;
    const enMobile = window.innerWidth <= 900;
    const destinoEl = enMobile && !sheetAbierto ? flotanteRef.current : resumenRef.current;
    if (!destinoEl) return;
    const r1 = origenEl.getBoundingClientRect();
    const r2 = destinoEl.getBoundingClientRect();
    if (r1.width === 0 || r2.width === 0) return;

    const clon = origenEl.cloneNode(true);
    Object.assign(clon.style, {
      position: "fixed",
      left: `${r1.left}px`,
      top: `${r1.top}px`,
      width: `${r1.width}px`,
      height: `${r1.height}px`,
      margin: "0",
      zIndex: "999",
      pointerEvents: "none",
      opacity: "0.9",
    });
    clon.classList.add("pieza-voladora");
    document.body.appendChild(clon);

    const dx = r2.left + r2.width / 2 - (r1.left + r1.width / 2);
    const dy = r2.top + r2.height / 2 - (r1.top + r1.height / 2);
    requestAnimationFrame(() => {
      clon.style.transition =
        "transform 350ms cubic-bezier(0.22, 1, 0.36, 1), opacity 350ms, scale 350ms";
      clon.style.transform = `translate(${dx}px, ${dy}px)`;
      clon.style.scale = "0.15";
      clon.style.opacity = "0.3";
    });
    const limpiarClon = () => {
      clon.remove();
      destinoEl.classList.remove("is-pulso");
      void destinoEl.offsetWidth;
      destinoEl.classList.add("is-pulso");
    };
    clon.addEventListener("transitionend", limpiarClon, { once: true });
    setTimeout(limpiarClon, 500);
  };

  const handleAccion = (pieza, e) => {
    const yaElegida = seleccion[pieza.categoria]?.id === pieza.id;
    if (yaElegida) {
      quitarPieza(pieza.categoria);
      return;
    }
    const pasoEstabaVacio = seleccion[pieza.categoria] == null;
    const tarjeta = e?.currentTarget?.closest?.(".pieza-card") ?? e?.currentTarget ?? null;
    setPieza(pieza.categoria, pieza);
    volarAlResumen(tarjeta);
    if (pasoEstabaVacio) {
      const i = ORDEN_PASOS.indexOf(pieza.categoria);
      const siguienteVacio = ORDEN_PASOS.slice(i + 1).find((p) => seleccion[p] == null);
      setPaso(siguienteVacio ?? pieza.categoria);
    }
  };

  const handleCopiar = async () => {
    const texto = textoListado(filas, total, consumoEstimadoW);
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = texto;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopiado(true);
    if (copiadoTimer.current) clearTimeout(copiadoTimer.current);
    copiadoTimer.current = setTimeout(() => setCopiado(false), 2000);
  };

  const handleAgregarTodo = () => {
    filas.forEach((f) => {
      if (!f.pieza) return;
      agregarAlCarrito({
        id: `armador-${f.pieza.id}`,
        nombre: `[Armado] ${f.pieza.nombre}`,
        marca: f.pieza.marca,
        precio: Number(f.pieza.precio ?? 0),
        precio_con_descuento: Number(f.pieza.precio ?? 0),
        imagen: "",
        categoria: "Armado PC",
      });
    });
  };

  const handleVerPaso = (categoria) => {
    if (ORDEN_PASOS.includes(categoria)) {
      setPaso(categoria);
      setSheetAbierto(false);
      document.querySelector(".armador")?.scrollIntoView({ behavior: reducido ? "auto" : "smooth" });
    }
  };

  return (
    <div className="armador">
      <div className="armador__head-acciones">
        <p className="armador__ayuda">
          Elegí pieza por pieza. Te avisamos al toque si algo no es compatible.
        </p>
        {completados > 0 && (
          <button type="button" className="armador__limpiar" onClick={limpiar}>
            Empezar de nuevo
          </button>
        )}
      </div>

      <AlertaCompatibilidad issues={issues} onVerPaso={handleVerPaso} />

      <div className="armador__layout">
        <div className="armador__stepper">
          <PasoStepper pasos={pasos} pasoActual={pasoActual} seleccion={seleccion} onIrAPaso={setPaso} />
        </div>

        <div className="armador__catalogo-col">
          <CatalogoPiezas
            paso={pasoActual}
            nombrePaso={nombreCategoria(pasoActual)}
            piezas={piezasPaso}
            seleccionadaId={seleccion[pasoActual]?.id ?? null}
            evaluaciones={evaluaciones}
            onAccion={handleAccion}
          />
        </div>

        <div className="armador__resumen-col">
          <ResumenArmado
            filas={filas}
            total={total}
            consumo={consumoEstimadoW}
            recomendada={fuenteRecomendadaW}
            completados={completados}
            totalPasos={ORDEN_PASOS.length}
            estado={estado}
            errores={errores}
            advertencias={advertencias}
            copiado={copiado}
            onQuitar={quitarPieza}
            onCopiar={handleCopiar}
            onImprimir={() => window.print()}
            onAgregarTodo={handleAgregarTodo}
            resumenRef={resumenRef}
          />
        </div>
      </div>

      {/* Bottom-sheet mobile */}
      {sheetAbierto && (
        <div className="sheet__backdrop" onClick={() => setSheetAbierto(false)} aria-hidden="true" />
      )}
      <div
        className={`sheet${sheetAbierto ? " is-abierto" : ""}`}
        ref={(el) => {
          if (el) el.inert = !sheetAbierto;
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Resumen de tu armado"
        aria-hidden={!sheetAbierto}
      >
        <ResumenArmado
          filas={filas}
          total={total}
          consumo={consumoEstimadoW}
          recomendada={fuenteRecomendadaW}
          completados={completados}
          totalPasos={ORDEN_PASOS.length}
          estado={estado}
          errores={errores}
          advertencias={advertencias}
          copiado={copiado}
          onQuitar={quitarPieza}
          onCopiar={handleCopiar}
          onImprimir={() => window.print()}
          onAgregarTodo={handleAgregarTodo}
          enSheet
          onCerrarSheet={() => setSheetAbierto(false)}
        />
      </div>

      <button
        type="button"
        ref={flotanteRef}
        className="btn-flotante"
        onClick={() => setSheetAbierto(true)}
        aria-label={`Ver mi armado, ${completados} de ${ORDEN_PASOS.length} componentes, total ${formatoARS(total)}`}
      >
        Ver mi armado ({completados}/{ORDEN_PASOS.length}) · {formatoARS(total)}
      </button>
    </div>
  );
}

export default Armador;
