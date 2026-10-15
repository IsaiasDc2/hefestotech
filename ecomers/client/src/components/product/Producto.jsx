import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { CATEGORIAS, resolverCategoria } from "../../constants/categorias";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import ProductCard from "./ProductCard";
import "./Productos.css";


function usarVisibleUnaVez() {
  const obsRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => () => obsRef.current?.disconnect(), []);

  const ref = useCallback(
    (el) => {
      obsRef.current?.disconnect();
      obsRef.current = null;
      if (!el || visible) return;
      if (
        typeof IntersectionObserver === "undefined" ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        setVisible(true);
        return;
      }
      const obs = new IntersectionObserver(
        (entradas) => {
          if (entradas.some((e) => e.isIntersecting)) {
            setVisible(true);
            obs.disconnect();
          }
        },
        { threshold: 0.1, rootMargin: "0px 0px -8% 0px" }
      );
      obs.observe(el);
      obsRef.current = obs;
    },
    [visible]
  );

  return [ref, visible];
}

function Productos({ agregarAlCarrito }) {


  const idioma = useIdiomaStore((s) => s.idioma);
  const [productos, setProductos] = useState([]);

  const [cargando, setCargando] = useState(true);

  const [error, setError] = useState(null);

  const [params] = useSearchParams();

  const [busqueda, setBusqueda] = useState(params.get("q") || "");

  const categoriaInicial = resolverCategoria(params.get("categoria"));
  const [categoria, setCategoria] = useState(categoriaInicial.db);
  const [soloOfertas, setSoloOfertas] = useState(categoriaInicial.ofertas);

  const [precioMin, setPrecioMin] = useState("");

  const [precioMax, setPrecioMax] = useState("");

  const [busquedaDif, setBusquedaDif] = useState(busqueda);

  const [precioMinDif, setPrecioMinDif] = useState(precioMin);

  const [precioMaxDif, setPrecioMaxDif] = useState(precioMax);

  const [orden, setOrden] = useState(() => {
    const o = params.get("orden");
    return o === "mayor" || o === "menor" ? o : "";
  });

  const [reintento, setReintento] = useState(0);

  const [grillaRef, grillaVisible] = usarVisibleUnaVez();


  useEffect(() => {
    const r = resolverCategoria(params.get("categoria"));
    setCategoria(r.db);
    setSoloOfertas(r.ofertas);
    setBusqueda(params.get("q") || "");
    const o = params.get("orden");
    setOrden(o === "mayor" || o === "menor" ? o : "");
  }, [params]);


  useEffect(() => {
    const t = setTimeout(() => setBusquedaDif(busqueda), 250);
    return () => clearTimeout(t);
  }, [busqueda]);

  useEffect(() => {
    const t = setTimeout(() => setPrecioMinDif(precioMin), 250);
    return () => clearTimeout(t);
  }, [precioMin]);

  useEffect(() => {
    const t = setTimeout(() => setPrecioMaxDif(precioMax), 250);
    return () => clearTimeout(t);
  }, [precioMax]);


  useEffect(() => {


    async function cargarProductos(){


      try {


        setCargando(true);

        setError(null);


        const { data, error } = await supabase
          .from("productos")
          .select("*");


        if(error){

          throw new Error(error.message);

        }


        const filas = (Array.isArray(data) ? data : []).map((p) => ({
          ...p,
          precio: Number(p.precio ?? 0),
          stock: Number(p.stock ?? 0),
          descuento_porcentaje: Number(p.descuento_porcentaje ?? 0),
          imagen: p.imagen || "",
          categoria: p.categoria || "General",
        }));

        setProductos(filas);


      } catch(error){
        setError(error.message);


      } finally{


        setCargando(false);


      }


    }


    cargarProductos();


  }, [reintento]);


  const etiquetaCategoria =
    CATEGORIAS.find((c) => c.db === categoria)?.label || categoria;


  const categorias = useMemo(()=>{


    return [

      "Todas",

      ...new Set(
        productos.map(
          producto=>producto.categoria
        )
      )

    ];


  },[productos]);


  const limpiarFiltros = ()=>{


    setBusqueda("");

    setCategoria("Todas");

    setSoloOfertas(false);

    setPrecioMin("");

    setPrecioMax("");

    setOrden("");


  };


  const productosOrdenados = useMemo(()=>{


    let resultado = productos.filter(producto=>{


      const nombre =
      producto.nombre
      ?.toLowerCase()
      || "";


      const texto =
      busquedaDif
      .toLowerCase();


      const coincideNombre =
      nombre.includes(texto);


      const coincideCategoria =
      categoria==="Todas"
      ||
      producto.categoria===categoria;


      const coincideOferta =
      !soloOfertas
      ||
      (producto.descuento_porcentaje ?? 0) > 0;


      const coincideMin =
      precioMinDif===""

      ||

      producto.precio >= Number(precioMinDif);


      const coincideMax =
      precioMaxDif===""

      ||

      producto.precio <= Number(precioMaxDif);


      return (

        coincideNombre &&
        coincideCategoria &&
        coincideOferta &&
        coincideMin &&
        coincideMax

      );


    });


    if(orden==="mayor"){

      resultado.sort(
        (a,b)=>b.precio-a.precio
      );

    }


    if(orden==="menor"){

      resultado.sort(
        (a,b)=>a.precio-b.precio
      );

    }


    return resultado;


  },[
    productos,
    busquedaDif,
    categoria,
    soloOfertas,
    precioMinDif,
    precioMaxDif,
    orden
  ]);


  return (

    <section className="productos-container">


      <header className="productos-header">


        <h1>
          {soloOfertas ? t(idioma, "prod.ofertas") : etiquetaCategoria === "Todas" ? t(idioma, "prod.tituloGeneral") : etiquetaCategoria}
        </h1>


        <p className="subtitulo-productos">

          {soloOfertas
            ? t(idioma, "prod.subOfertas")
            : t(idioma, "prod.subGeneral")}

        </p>


      </header>


      <div className="filtros">


        <input

          className="buscador"

          type="text"

          placeholder={t(idioma, "prod.buscarPh")}

          aria-label={t(idioma, "prod.buscarAria")}

          value={busqueda}

          onChange={
            e=>setBusqueda(e.target.value)
          }

        />


        <select

          value={categoria}

          aria-label={t(idioma, "prod.filtrarPor")}

          onChange={
            e=>{ setCategoria(e.target.value); setSoloOfertas(false); }
          }

        >


          {
            categorias.map(cat=>(


              <option

                key={cat}

                value={cat}

              >

                {cat === "Todas" ? t(idioma, "filt.todas") : cat}

              </option>


            ))
          }


        </select>


        <input

          type="number"

          placeholder={t(idioma, "prod.precioMin")}

          aria-label={t(idioma, "prod.precioMin")}

          min="0"

          inputMode="numeric"

          value={precioMin}

          onChange={
            e=>setPrecioMin(e.target.value)
          }

        />


        <input

          type="number"

          placeholder={t(idioma, "prod.precioMax")}

          aria-label={t(idioma, "prod.precioMax")}

          min="0"

          inputMode="numeric"

          value={precioMax}

          onChange={
            e=>setPrecioMax(e.target.value)
          }

        />


        <select

          value={orden}

          aria-label={t(idioma, "prod.ordenarPor")}

          onChange={
            e=>setOrden(e.target.value)
          }

        >

          <option value="">
            {t(idioma, "prod.ordenar")}
          </option>


          <option value="mayor">
            {t(idioma, "prod.mayor")}
          </option>


          <option value="menor">
            {t(idioma, "prod.menor")}
          </option>


        </select>


        <button

          className="btn-limpiar"

          onClick={limpiarFiltros}

        >

          ↻ {t(idioma, "prod.limpiar")}

        </button>


      </div>


      {
        cargando &&

        <p className="estado-carga">
          {t(idioma, "prod.cargando")}
        </p>

      }


      {
        error && !cargando &&

        <div className="vacio" role="alert">
          <p className="vacio-titulo">{t(idioma, "prod.errorTitulo")}</p>
          <p className="vacio-texto">{t(idioma, "prod.errorTexto")}</p>
          <button
            type="button"
            className="btn-limpiar"
            onClick={() => setReintento((n) => n + 1)}
          >
            ↻ {t(idioma, "prod.reintentar")}
          </button>
        </div>

      }


      {
        !cargando &&
        !error &&

        <p className="resultados-contador" role="status">
          <strong>{productosOrdenados.length}</strong>
          &nbsp;{t(idioma, "prod.resultados")}
        </p>
      }


      {
        !cargando &&
        !error &&


        <div ref={grillaRef} className={`grid-productos${grillaVisible ? " is-visible" : ""}`}>


          {

          productosOrdenados.length===0

          ?

          (

            <h2>
              {t(idioma, "prod.vacio")}
            </h2>

          )


          :


          productosOrdenados.map(producto=>(


            <ProductCard

              key={producto.id}

              producto={producto}

              agregarAlCarrito={agregarAlCarrito}

            />


          ))


          }


        </div>


      }


    </section>

  );

}


export default Productos;
