/* Markdown mínimo y seguro por construcción: jamás se usa
   dangerouslySetInnerHTML. El texto viaja como nodos React (escapado por
   defecto) y solo se permite **negrita**, *itálica*, `código` y listas
   "- ". Sin links ni HTML crudo no hay vector XSS y no hace falta sumar
   librerías. */
function renderEnLinea(fragmento, clave) {
  const partes = String(fragmento).split(/(\*\*.+?\*\*|\*[^*\s][^*]*?\*|`[^`]+?`)/g);
  return partes.map((parte, i) => {
    if (parte.startsWith("**") && parte.endsWith("**") && parte.length > 4) {
      return <strong key={`${clave}-${i}`}>{parte.slice(2, -2)}</strong>;
    }
    if (parte.startsWith("*") && parte.endsWith("*") && parte.length > 2) {
      return <em key={`${clave}-${i}`}>{parte.slice(1, -1)}</em>;
    }
    if (parte.startsWith("`") && parte.endsWith("`") && parte.length > 2) {
      return <code key={`${clave}-${i}`}>{parte.slice(1, -1)}</code>;
    }
    return <span key={`${clave}-${i}`}>{parte}</span>;
  });
}

export function renderRico(texto) {
  const lineas = String(texto ?? "").split("\n");
  const bloques = [];
  let lista = [];
  const volcarLista = () => {
    if (lista.length) {
      bloques.push(
        <ul key={`lista-${bloques.length}`} className="asistente-lista">
          {lista.map((item, i) => (
            <li key={i}>{renderEnLinea(item, `li-${bloques.length}-${i}`)}</li>
          ))}
        </ul>,
      );
      lista = [];
    }
  };
  lineas.forEach((linea, i) => {
    const recortada = linea.trim();
    if (recortada.startsWith("- ")) {
      lista.push(recortada.slice(2));
    } else {
      volcarLista();
      if (recortada) {
        bloques.push(<p key={`p-${i}`}>{renderEnLinea(linea, `p-${i}`)}</p>);
      }
    }
  });
  volcarLista();
  return bloques.length ? bloques : renderEnLinea(texto, "solo");
}
