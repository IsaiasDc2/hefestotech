/**
 * HefestoTech · Asistente · Lector de Server-Sent Events.
 *
 * El chat es un POST (lleva historial y carrito), así que no sirve
 * EventSource: se lee el body con fetch y se parte en eventos acá.
 * Tolera bloques cortados entre chunks y CRLF.
 */
export function crearLectorSSE(alEvento) {
  let resto = "";

  const procesarBloque = (bloque) => {
    let evento = "message";
    const datos = [];
    for (const linea of bloque.split("\n")) {
      if (!linea || linea.startsWith(":")) continue;
      const corte = linea.indexOf(":");
      const campo = corte === -1 ? linea : linea.slice(0, corte);
      const valor = corte === -1 ? "" : linea.slice(corte + 1).replace(/^ /, "");
      if (campo === "event") evento = valor;
      else if (campo === "data") datos.push(valor);
    }
    if (!datos.length) return;
    let carga;
    try {
      carga = JSON.parse(datos.join("\n"));
    } catch {
      return;
    }
    alEvento(evento, carga);
  };

  return {
    alimentar(texto) {
      resto += texto.replace(/\r\n?/g, "\n");
      let fin = resto.indexOf("\n\n");
      while (fin !== -1) {
        procesarBloque(resto.slice(0, fin));
        resto = resto.slice(fin + 2);
        fin = resto.indexOf("\n\n");
      }
    },
    cerrar() {
      if (resto.trim()) procesarBloque(resto);
      resto = "";
    },
  };
}
