import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import { CATEGORIAS, resolverCategoria } from "../../constants/categorias";
import ProductCard from "./ProductCard";
import "./Productos.css";


function Productos({ agregarAlCarrito }) {


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


      const controlador = new AbortController();
      const limite = setTimeout(() => controlador.abort(), 12000);
      try {


        setCargando(true);

        setError(null);



        const { data, error } = await supabase
          .from("productos")
          .select("*")
          .abortSignal(controlador.signal);



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


        console.error(error);

        setError(error.message);


      } finally{


        clearTimeout(limite);

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
          {soloOfertas ? "Ofertas" : etiquetaCategoria === "Todas" ? "Componentes de PC" : etiquetaCategoria}
        </h1>


        <p className="subtitulo-productos">

          {soloOfertas
            ? "Descuentos reales en hardware seleccionado."
            : `Encontrá procesadores, placas de video,
          memorias y todo lo necesario para armar
          tu PC ideal.`}

        </p>


      </header>





      <div className="filtros">



        <input

          className="buscador"

          type="text"

          placeholder="🔍 Buscar producto..."

          aria-label="Buscar producto"

          value={busqueda}

          onChange={
            e=>setBusqueda(e.target.value)
          }

        />





        <select

          value={categoria}

          aria-label="Filtrar por categoría"

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

                {cat}

              </option>


            ))
          }


        </select>






        <input

          type="number"

          placeholder="Precio mínimo"

          aria-label="Precio mínimo"

          min="0"

          inputMode="numeric"

          value={precioMin}

          onChange={
            e=>setPrecioMin(e.target.value)
          }

        />





        <input

          type="number"

          placeholder="Precio máximo"

          aria-label="Precio máximo"

          min="0"

          inputMode="numeric"

          value={precioMax}

          onChange={
            e=>setPrecioMax(e.target.value)
          }

        />







        <select

          value={orden}

          aria-label="Ordenar por precio"

          onChange={
            e=>setOrden(e.target.value)
          }

        >

          <option value="">
            Ordenar por precio
          </option>


          <option value="mayor">
            Mayor precio
          </option>


          <option value="menor">
            Menor precio
          </option>


        </select>







        <button

          className="btn-limpiar"

          onClick={limpiarFiltros}

        >

          ↻ Limpiar

        </button>



      </div>







      {
        cargando &&

        <p className="estado-carga">
          Cargando productos...
        </p>

      }






      {
        error && !cargando &&

        <div className="vacio" role="alert">
          <p className="vacio-titulo">No pudimos cargar el catálogo</p>
          <p className="vacio-texto">Revisá tu conexión a internet e intentá de nuevo.</p>
          <button
            type="button"
            className="btn-limpiar"
            onClick={() => setReintento((n) => n + 1)}
          >
            ↻ Reintentar
          </button>
        </div>

      }







      {
        !cargando &&
        !error &&

        <p className="resultados-contador" role="status">
          <strong>{productosOrdenados.length}</strong>
          &nbsp;resultados
        </p>
      }


      {
        !cargando &&
        !error &&


        <motion.div className="grid-productos" layout>


          {

          productosOrdenados.length===0

          ?

          (

            <h2>
              No se encontraron productos
            </h2>

          )


          :


          <AnimatePresence mode="popLayout">
          {productosOrdenados.map(producto=>(


            <motion.div
              key={producto.id}
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
            <ProductCard

              producto={producto}

              agregarAlCarrito={agregarAlCarrito}

            />
            </motion.div>


          ))}
          </AnimatePresence>


          }


        </motion.div>


      }



    </section>

  );

}


export default Productos;
