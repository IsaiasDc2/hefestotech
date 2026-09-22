function Carrito({ carrito }) {

  return (
    <div>
      <h1>
        Carrito completo
      </h1>

      <p>
        Productos: {carrito.length}
      </p>

    </div>
  );

}

export default Carrito;