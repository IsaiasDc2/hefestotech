/**
 * HefestoTech · Armador · Mensajes del motor en inglés.
 *
 * El motor (motor.js) devuelve sus mensajes en español y NO se toca: su
 * salida completa se compara contra el port de Python del backend
 * (paridad.test.js). Por eso la traducción se hace al mostrar: cada frase
 * del motor se reconoce por su plantilla ({x} = dato variable) y se
 * reemplaza por la plantilla en inglés. Si una frase no tiene traducción
 * se muestra en español (nunca se rompe nada). mensajesEn.test.js falla si
 * motor.js tiene una frase sin plantilla.
 */

export const PLANTILLAS_ES_EN = [
  // cpu_socket
  [
    "Che, me falta el dato del socket del CPU o del mother, así que no te puedo confirmar que encastren. Cargalo y lo reevaluamos.",
    "Heads up: the CPU or motherboard socket is missing, so I can't confirm they fit together. Add it and we'll re-check.",
  ],
  [
    "El CPU y el mother comparten socket {socket}. Van juntos sin drama.",
    "The CPU and the motherboard share the {socket} socket. They go together, no drama.",
  ],
  [
    "Ojo, no encastran: tu CPU es {cpu} y el mother es {mother}. Tenés que cambiar uno de los dos.",
    "Watch out, they don't fit: your CPU is {cpu} and the motherboard is {mother}. You'll need to change one of them.",
  ],
  // ram_ddr
  [
    "De la RAM{tag} no sé si es DDR4 o DDR5, o me falta el dato del mother. Sin eso no te la puedo aprobar.",
    "I can't tell if the RAM{tag} is DDR4 or DDR5, or the motherboard data is missing. Without that I can't approve it.",
  ],
  [
    "Esa RAM{tag} es {tipo} pero el mother solo acepta {tipoMother}. No te va a andar: buscá un kit {tipoMother}.",
    "That RAM{tag} is {tipo} but the motherboard only accepts {tipoMother}. It won't work: look for a {tipoMother} kit.",
  ],
  [
    "Esa RAM{tag} es SO-DIMM (de notebook) y este mother usa DIMM de escritorio. No entra físicamente.",
    "That RAM{tag} is SO-DIMM (laptop memory) and this motherboard uses desktop DIMM. It physically won't fit.",
  ],
  [
    "La RAM{tag} es {tipo} como pide el mother. Bien ahí.",
    "The RAM{tag} is {tipo}, just as the motherboard requires. Nice.",
  ],
  // ram_ranuras
  [
    "Me falta la capacidad o la cantidad de módulos de alguna RAM, así que no puedo verificar las ranuras. Completalo.",
    "I'm missing the capacity or module count of some RAM, so I can't check the slots. Fill it in.",
  ],
  [
    "Te pasaste de ranuras: querés poner {modulos} módulos y el mother trae {ranuras}. Sacá un kit o cambiá el mother.",
    "You're over the slot limit: you want {modulos} modules and the motherboard has {ranuras}. Remove a kit or change the motherboard.",
  ],
  [
    "Entran lo más bien: {modulos} módulo(s) en {ranuras} ranuras.",
    "They fit just fine: {modulos} module(s) in {ranuras} slots.",
  ],
  [
    "No sé cuántas ranuras trae el mother, así que no puedo validar los módulos. Conseguí ese dato.",
    "I don't know how many slots the motherboard has, so I can't validate the modules. Get that data.",
  ],
  // ram_maximo
  [
    "Sin la capacidad de todos los módulos no puedo verificar el máximo del mother.",
    "Without the capacity of every module I can't check the motherboard's maximum.",
  ],
  [
    "Te pasaste del máximo: sumás {total}GB y el mother banca hasta {max}GB. Bajá la capacidad.",
    "You're over the maximum: you add up to {total}GB and the motherboard supports up to {max}GB. Lower the capacity.",
  ],
  [
    "Vas bien de capacidad: {total}GB de un máximo de {max}GB.",
    "Capacity looks good: {total}GB out of a {max}GB maximum.",
  ],
  [
    "No sé la memoria máxima del mother, así que la capacidad total queda pendiente de revisión.",
    "I don't know the motherboard's maximum memory, so total capacity is pending review.",
  ],
  // mother_gabinete
  [
    "No sé el factor de forma del mother. Sin eso no te puedo decir si entra en el gabinete.",
    "I don't know the motherboard's form factor. Without it I can't tell if it fits in the case.",
  ],
  [
    "No sé qué tamaños de mother acepta el gabinete. Fijate la ficha del gabo y lo reevaluamos.",
    "I don't know which motherboard sizes the case accepts. Check the case's spec sheet and we'll re-check.",
  ],
  [
    "El mother {formato} entra en el gabinete. Mandale nomás.",
    "The {formato} motherboard fits in the case. Go for it.",
  ],
  [
    "No entra: el mother es {formato} y el gabinete solo acepta {aceptados}. Cambiá uno de los dos.",
    "It doesn't fit: the motherboard is {formato} and the case only accepts {aceptados}. Change one of them.",
  ],
  // gpu_gabinete
  [
    "Me falta el largo de la placa o el espacio máximo del gabinete. Medilo antes de comprar, que una GPU que no entra es un clavo.",
    "I'm missing the card length or the case's maximum clearance. Measure before buying: a GPU that doesn't fit is a costly mistake.",
  ],
  [
    "La placa ({largo}mm) entra en el gabinete (hasta {max}mm).",
    "The card ({largo}mm) fits in the case (up to {max}mm).",
  ],
  [
    "La placa no entra: mide {largo}mm y el gabinete banca hasta {max}mm. Buscá un gabo más grande o una placa más corta.",
    "The card doesn't fit: it's {largo}mm and the case supports up to {max}mm. Look for a bigger case or a shorter card.",
  ],
  // cooler_socket
  [
    "No sé los sockets que banca el cooler o el socket del CPU. Verificá la compatibilidad del anclaje.",
    "I don't know which sockets the cooler supports or the CPU socket. Check the mounting compatibility.",
  ],
  [
    "El cooler trae anclaje para {socket}. Perfecto.",
    "The cooler includes mounting for {socket}. Perfect.",
  ],
  [
    "El cooler no trae anclaje para {socket} (solo {sockets}). Elegí otro cooler.",
    "The cooler has no mounting for {socket} (only {sockets}). Pick another cooler.",
  ],
  // cooler_tdp
  [
    "Me falta el TDP del CPU o la capacidad del cooler. Sin eso no sé si te va a hacer throttle.",
    "I'm missing the CPU's TDP or the cooler's capacity. Without that I can't tell if it will throttle.",
  ],
  [
    "El cooler se queda corto: disipa {cooler}W y el CPU tira {cpu}W. Te va a hacer throttle; subí de cooler.",
    "The cooler falls short: it dissipates {cooler}W and the CPU pulls {cpu}W. It will throttle; get a bigger cooler.",
  ],
  [
    "Vas justito de disipación ({cooler}W para un CPU de {cpu}W). Anda, pero con calor te conviene algo más grande.",
    "Cooling is tight ({cooler}W for a {cpu}W CPU). It works, but in hot weather you'd want something bigger.",
  ],
  [
    "De disipación vas sobrado: {cooler}W para {cpu}W del CPU.",
    "Cooling is plentiful: {cooler}W for a {cpu}W CPU.",
  ],
  // cooler_gabinete (líquido)
  [
    "No sé el tamaño del radiador o el máximo del gabinete. Confirmá que el radiador entra.",
    "I don't know the radiator size or the case maximum. Confirm that the radiator fits.",
  ],
  [
    "El radiador de {radiador}mm entra en el gabinete (hasta {max}mm).",
    "The {radiador}mm radiator fits in the case (up to {max}mm).",
  ],
  [
    "El radiador no entra: es de {radiador}mm y el gabinete banca hasta {max}mm.",
    "The radiator doesn't fit: it's {radiador}mm and the case supports up to {max}mm.",
  ],
  // cooler_gabinete (aire)
  [
    "Me falta la altura del cooler o el despeje del gabinete. Si el cooler toca el vidrio, es un problema.",
    "I'm missing the cooler height or the case clearance. If the cooler touches the glass panel, that's a problem.",
  ],
  [
    "El cooler ({altura}mm) entra en el gabinete (hasta {max}mm).",
    "The cooler ({altura}mm) fits in the case (up to {max}mm).",
  ],
  [
    "El cooler no entra: mide {altura}mm y el gabinete banca hasta {max}mm. Andá por un perfil más bajo.",
    "The cooler doesn't fit: it's {altura}mm and the case supports up to {max}mm. Go for a lower-profile one.",
  ],
  // almacenamiento
  [
    'Del disco "{nombre}" no sé si es NVMe o SATA. Sin eso no puedo verificar los slots.',
    'I can\'t tell if the drive "{nombre}" is NVMe or SATA. Without that I can\'t check the slots.',
  ],
  [
    "No sé cuántos slots M.2 trae el mother. Contalos en la ficha antes de sumar NVMes.",
    "I don't know how many M.2 slots the motherboard has. Count them on the spec sheet before adding NVMe drives.",
  ],
  [
    "Tenés {nvme} NVMe(s) para {slots} slot(s) M.2. Entran todos.",
    "You have {nvme} NVMe drive(s) for {slots} M.2 slot(s). They all fit.",
  ],
  [
    "Te sobran NVMes: querés {nvme} y el mother trae {slots} slots M.2. Sacá uno o cambiá el mother.",
    "You have too many NVMe drives: you want {nvme} and the motherboard has {slots} M.2 slots. Remove one or change the motherboard.",
  ],
  [
    "No sé cuántos SATA trae el mother, así que los discos SATA quedan pendientes de revisión.",
    "I don't know how many SATA ports the motherboard has, so the SATA drives are pending review.",
  ],
  [
    "Tenés {sata} disco(s) SATA para {slots} puertos. Van todos.",
    "You have {sata} SATA drive(s) for {slots} ports. They all fit.",
  ],
  [
    "Te faltan SATA: querés {sata} discos y el mother trae {slots} puertos.",
    "You're short on SATA ports: you want {sata} drives and the motherboard has {slots} ports.",
  ],
  // cpu_gpu_video
  [
    "Tenés placa dedicada, así que el video está cubierto uses el CPU que uses.",
    "You have a dedicated card, so video is covered whichever CPU you use.",
  ],
  [
    "No pusiste placa, pero tu CPU trae gráficos integrados. Zafás para usar la PC (para jugar en serio después sumás una GPU).",
    "You didn't pick a card, but your CPU has integrated graphics. You can use the PC for now (add a GPU later for serious gaming).",
  ],
  [
    "Ojo: tu CPU no trae gráficos integrados (serie F) y no pusiste placa de video. Te vas a quedar sin imagen; sumá una GPU.",
    "Watch out: your CPU has no integrated graphics (F series) and you didn't pick a graphics card. You'll have no display; add a GPU.",
  ],
  [
    "No pusiste placa y no sé si tu CPU trae gráficos integrados. Confirmalo antes de comprar, porque sin video no hay PC que valga.",
    "You didn't pick a card and I don't know if your CPU has integrated graphics. Confirm it before buying: without video output there's no usable PC.",
  ],
  // fuente_potencia
  [
    "Me faltan los consumos (TDP del CPU / consumo de la GPU) o la potencia de la fuente. Sin eso no te puedo decir si la fuente banca.",
    "I'm missing the power figures (CPU TDP / GPU consumption) or the PSU wattage. Without that I can't tell if the PSU can handle it.",
  ],
  [
    "No pude estimar el consumo con los datos que hay.",
    "I couldn't estimate power draw with the available data.",
  ],
  [
    "La fuente se queda corta: tenés {pot}W y la placa pide mínimo {rec}W. Subí a {rec}W o más (estimado total con margen: ~{estimada}W).",
    "The PSU falls short: you have {pot}W and the card requires at least {rec}W. Go up to {rec}W or more (estimated total with margin: ~{estimada}W).",
  ],
  [
    "No te alcanza la fuente: el consumo estimado con margen es ~{estimada}W y tenés {pot}W. Buscá una más grande.",
    "The PSU isn't enough: estimated draw with margin is ~{estimada}W and you have {pot}W. Look for a bigger one.",
  ],
  [
    "Vas justito: estimamos ~{estimada}W contra {pot}W de fuente (más del 80%). Anda, pero si podés estirate a más potencia para ir holgado.",
    "It's tight: we estimate ~{estimada}W against a {pot}W PSU (over 80%). It works, but if you can, go for more wattage to have headroom.",
  ],
  [
    "La fuente banca: estimamos ~{estimada}W con margen del 30% y tenés {pot}W.",
    "The PSU can handle it: we estimate ~{estimada}W with a 30% margin and you have {pot}W.",
  ],
  // fuente_12vhpwr / 8pin
  [
    "La fuente trae el 12VHPWR que pide la placa. Conectás directo, sin adaptadores raros.",
    "The PSU has the 12VHPWR connector the card needs. Plug it in directly, no weird adapters.",
  ],
  [
    "La placa pide 12VHPWR y tu fuente no lo trae. Cambiá la fuente por una con 12VHPWR nativo (los adaptadores son un parche).",
    "The card needs 12VHPWR and your PSU doesn't have it. Swap the PSU for one with native 12VHPWR (adapters are a patch).",
  ],
  [
    "La placa pide 12VHPWR y no sé si tu fuente lo trae. Fijate la ficha de la fuente.",
    "The card needs 12VHPWR and I don't know if your PSU has it. Check the PSU's spec sheet.",
  ],
  [
    "La placa pide 8-pines y no sé cuántos trae tu fuente. Contalos en la ficha.",
    "The card needs 8-pin connectors and I don't know how many your PSU has. Count them on the spec sheet.",
  ],
  [
    "La fuente trae {tiene} conector(es) de 8-pines y la placa pide {pide}. Listo.",
    "The PSU has {tiene} 8-pin connector(s) and the card needs {pide}. All set.",
  ],
  [
    "Te faltan conectores: la placa pide {pide} de 8-pines y la fuente trae {tiene}.",
    "You're short on connectors: the card needs {pide} 8-pin and the PSU has {tiene}.",
  ],
  // fuente_gabinete
  [
    "No sé el tamaño de la fuente ni los que acepta el gabinete. Verificá que la fuente entra.",
    "I don't know the PSU size or the sizes the case accepts. Verify that the PSU fits.",
  ],
  [
    "No sé qué formatos de fuente acepta el gabinete. Fijate la ficha del gabo.",
    "I don't know which PSU form factors the case accepts. Check the case's spec sheet.",
  ],
  [
    "La fuente {formato} entra en el gabinete.",
    "The {formato} PSU fits in the case.",
  ],
  [
    "La fuente {formato} no entra en el gabinete (acepta {aceptados}).",
    "The {formato} PSU doesn't fit in the case (it accepts {aceptados}).",
  ],
  // bios_chipset
  [
    "Sin el chipset del mother o el modelo exacto del CPU no puedo avisarte si vas a necesitar actualizar la BIOS.",
    "Without the motherboard chipset or the exact CPU model I can't tell you if you'll need a BIOS update.",
  ],
  [
    "Ojo: ese {chipset} seguro necesita actualizar la BIOS para tu CPU de 13va/14va gen. Pedí que te lo den actualizado o tené un pendrive a mano.",
    "Heads up: that {chipset} will surely need a BIOS update for your 13th/14th-gen CPU. Ask for it already updated or keep a USB drive handy.",
  ],
  [
    "Tu combo puede pedir actualización de BIOS (14va gen en serie 600/700). Revisá que el mother venga con BIOS actualizada.",
    "Your combo may need a BIOS update (14th gen on 600/700 series). Check that the motherboard ships with an updated BIOS.",
  ],
  [
    "Los Ryzen 8000 en placas B650/X670 de las primeras tandas a veces piden actualizar la BIOS. Confirmá que venga lista.",
    "Ryzen 8000 on early-batch B650/X670 boards sometimes need a BIOS update. Confirm it ships ready.",
  ],
  [
    "No vemos choque de generación entre CPU y chipset. Igual, siempre fijate la versión de BIOS en la ficha.",
    "We don't see a generation clash between CPU and chipset. Still, always check the BIOS version on the spec sheet.",
  ],
  // usoArmador: candidato sin conflictos
  [
    "Va con lo que ya elegiste.",
    "Fits with what you've picked.",
  ],
];

function compilar([es, en]) {
  const nombres = [];
  const patron = es
    .split(/(\{\w+\})/)
    .map((trozo) => {
      const m = /^\{(\w+)\}$/.exec(trozo);
      if (m) {
        nombres.push(m[1]);
        return "(.*?)";
      }
      return trozo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("");
  return { re: new RegExp(`^${patron}$`), nombres, en };
}

const COMPILADAS = PLANTILLAS_ES_EN.map(compilar);

// El motor numera los módulos de RAM en español: " (módulo 2)".
function traducirDato(nombre, valor) {
  if (nombre === "tag") return valor.replace(/módulo/g, "module");
  if (valor === "sin nombre") return "unnamed";
  return valor;
}

/**
 * Traduce un mensaje del motor. `idioma` distinto de "en" (o un texto que
 * no sea del motor) devuelve el mensaje tal cual.
 */
export function traducirMensaje(mensaje, idioma) {
  if (idioma !== "en" || typeof mensaje !== "string" || !mensaje) return mensaje;
  for (const { re, nombres, en } of COMPILADAS) {
    const m = re.exec(mensaje);
    if (!m) continue;
    const datos = {};
    nombres.forEach((nombre, i) => {
      datos[nombre] = traducirDato(nombre, m[i + 1]);
    });
    return en.replace(/\{(\w+)\}/g, (_, nombre) => datos[nombre] ?? "");
  }
  return mensaje;
}
