// HefestoTech · Admin · Clientes: sin endpoint en el CONTRATO → deshabilitado.
import { Cabecera, Proximamente } from "./ui";

export default function Clientes() {
  return (
    <div>
      <Cabecera kicker="Personas" titulo="Clientes" />
      <Proximamente
        modulo="Clientes"
        detalle="El contrato del backend aún no expone /api/admin/clientes."
      />
    </div>
  );
}
