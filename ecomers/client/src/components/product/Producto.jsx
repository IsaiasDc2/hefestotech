import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
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

  const [orden, setOrden] = useState(params.get("orden") === "mayor" ? "mayor" : "");


  // Si cambia la URL (ej: clic en otra categoría) se re-aplican los filtros
  useEffect(() => {
    const r = resolverCategoria(params.get("categoria"));
    setCategoria(r.db);
    setSoloOfertas(r.ofertas);
    setBusqueda(params.get("q") || "");
    setOrden(params.get("orden") === "mayor" ? "mayor" : "");
  }, [params]);





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



        // Normaliza filas incompletas para que las cards nunca rompan
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


        setCargando(false);


      }


    }


    cargarProductos();


  }, []);







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
      busqueda
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
      precioMin===""

      ||

      producto.precio >= Number(precioMin);





      const coincideMax =
      precioMax===""

      ||

      producto.precio <= Number(precioMax);




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
    busqueda,
    categoria,
    soloOfertas,
    precioMin,
    precioMax,
    orden
  ]);








  return (

    <section className="productos-container">


      <header className="productos-header">


        <h1>
          {soloOfertas ? "Ofertas" : "Componentes de PC"}
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

          value={busqueda}

          onChange={
            e=>setBusqueda(e.target.value)
          }

        />





        <select

          value={categoria}

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

          value={precioMin}

          onChange={
            e=>setPrecioMin(e.target.value)
          }

        />





        <input

          type="number"

          placeholder="Precio máximo"

          value={precioMax}

          onChange={
            e=>setPrecioMax(e.target.value)
          }

        />







        <select

          value={orden}

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

        <p className="estado-error">

          Error:
          {error}

        </p>

      }







      {
        !cargando &&
        !error &&


        <div className="grid-productos">


          {

          productosOrdenados.length===0

          ?

          (

            <h2>
              No se encontraron productos
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
