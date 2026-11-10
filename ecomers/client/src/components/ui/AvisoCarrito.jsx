import { Toaster, toast } from "sonner";
import { FaCartShopping, FaCheck, FaXmark } from "react-icons/fa6";
import useIdiomaStore, { t } from "../../store/idiomaStore";
import useCartStore, { registrarAvisoCarrito } from "../../store/cartStore";
import { precioFinal } from "../../services/productService";
import { formatearPesos } from "../../utils/dinero";
import { useTema } from "../../hooks/useTema";

// Un solo id: si el cliente agrega varias cosas seguidas, el aviso se
// actualiza en el lugar en vez de apilar una torre de toasts.
const ID_AVISO = "aviso-carrito";

function TarjetaAviso({ id, producto, cantidad }) {
  const idioma = useIdiomaStore((s) => s.idioma);
  const abrirCarrito = useCartStore((s) => s.abrirCarrito);
  const enCarrito = useCartStore((s) => s.carrito.reduce((acc, it) => acc + it.cantidad, 0));
  const precio = precioFinal(producto);

  return (
    <div className="aviso-carrito" role="status">
      <span className="aviso-carrito-brillo" aria-hidden="true" />
      <span className="aviso-carrito-foto">
        {producto.imagen ? (
          <img src={producto.imagen} alt="" width="56" height="56" decoding="async" />
        ) : (
          <FaCartShopping aria-hidden="true" />
        )}
        <span className="aviso-carrito-check" aria-hidden="true">
          <FaCheck />
        </span>
      </span>
      <span className="aviso-carrito-texto">
        <strong>{t(idioma, "aviso.agregado")}</strong>
        <span className="aviso-carrito-nombre">{producto.nombre}</span>
        <span className="aviso-carrito-meta">
          {cantidad > 1 ? `${cantidad} × ` : ""}
          {precio > 0 ? formatearPesos(precio) : ""}
        </span>
      </span>
      <button
        type="button"
        className="aviso-carrito-ver"
        onClick={() => {
          abrirCarrito();
          toast.dismiss(id);
        }}
      >
        {t(idioma, "aviso.verCarrito")}
        <span className="aviso-carrito-cuenta">{enCarrito}</span>
      </button>
      <button
        type="button"
        className="aviso-carrito-cerrar"
        aria-label={t(idioma, "aviso.cerrar")}
        onClick={() => toast.dismiss(id)}
      >
        <FaXmark aria-hidden="true" />
      </button>
    </div>
  );
}

function avisarAgregado(producto, cantidad) {
  toast.custom((id) => <TarjetaAviso id={id} producto={producto} cantidad={cantidad} />, {
    id: ID_AVISO,
    duration: 3500,
  });
}

// Se registra al importar este módulo (lo carga Layout): el store no
// depende de la UI y los tests del carrito no necesitan un Toaster.
registrarAvisoCarrito(avisarAgregado);

export default function ContenedorAvisos() {
  const { tema } = useTema();
  return (
    <Toaster
      position="bottom-right"
      theme={tema === "light" ? "light" : "dark"}
      offset={{ bottom: 100, right: 24 }}
      mobileOffset={{ bottom: 88, left: 12, right: 12 }}
      gap={10}
    />
  );
}
