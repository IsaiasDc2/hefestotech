"""HefestoTech · asistente · motor de compatibilidad (port de armador/motor.js).

Port 1:1 de `ecomers/client/src/armador/motor.js` y `adaptar.js`: mismas
reglas, mismos estados y mismos mensajes. El asistente valida combinaciones
con las mismas reglas que ve el comprador en "Armá tu PC"; si el motor JS
cambia, `tests/fixtures/motor_paridad.json` deja de coincidir y fallan
Vitest y pytest a la vez (ver scripts/generar-paridad-motor.mjs).

Detalles de JavaScript que se reproducen a propósito:
- `!obj` solo es verdadero para undefined/null (un dict vacío existe).
- `typeof x === "number"` excluye booleanos.
- `String(v)` / plantillas: 357.0 se muestra "357", True → "true".
- `Number(v)` en el adaptador: null y "" valen 0; lo ausente queda indefinido.
- Las regex usan re.ASCII (\\w y \\b de JS son ASCII).
"""

from __future__ import annotations

import math
import re
from typing import Any, Optional

OK = "ok"
WARN = "warn"
ERROR = "error"
UNKNOWN = "unknown"

_FALTA = object()


# ------------------------------------------------------- semántica de JS ---
def _es_num(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and not (
        isinstance(v, float) and math.isnan(v)
    )


def js_str(v: Any) -> str:
    if v is None:
        return ""
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, float):
        if math.isfinite(v) and v == int(v):
            return str(int(v))
        return repr(v)
    if isinstance(v, (list, tuple)):
        return ",".join(js_str(x) for x in v)
    return str(v)


def _norm(v: Any) -> str:
    return re.sub(r"[\s_]+", "-", js_str(v).strip().upper())


def _lista(v: Any) -> list:
    if v is None:
        return []
    return list(v) if isinstance(v, (list, tuple)) else [v]


def _hay(d: dict, clave: str) -> bool:
    return d.get(clave) is not None


def _normalizar_formato(v: Any) -> str:
    n = _norm(v)
    if not n:
        return ""
    if n == "ATX":
        return "ATX"
    if n in ("MICRO-ATX", "MICROATX", "M-ATX", "MATX", "MICRO-ATX-TOWER"):
        return "MICRO-ATX"
    if n in ("MINI-ITX", "MINIITX", "MITX"):
        return "MINI-ITX"
    if n in ("E-ATX", "EATX", "EXTENDED-ATX"):
        return "E-ATX"
    return n


_FORMATOS_ACEPTADOS_POR_GABINETE = {
    "E-ATX": ["E-ATX", "ATX", "MICRO-ATX", "MINI-ITX"],
    "ATX": ["ATX", "MICRO-ATX", "MINI-ITX"],
    "MICRO-ATX": ["MICRO-ATX", "MINI-ITX"],
    "MINI-ITX": ["MINI-ITX"],
}

_A = re.ASCII


def cpu_tiene_igpu(cpu: Optional[dict]) -> Optional[bool]:
    """None = no se sabe (→ unknown, jamás ok)."""
    if cpu is None:
        return None
    if isinstance(cpu.get("tieneIGPU"), bool):
        return cpu["tieneIGPU"]
    nombre = js_str(cpu.get("nombre"))
    if re.search(r"(^|[\s-])\w*F(\s|$)", nombre, re.I | _A) and not re.search(r"RF\b", nombre, re.I | _A):
        if re.search(r"\b(i[3579]|Core|KF|KF\b)", nombre, re.I | _A) or re.search(r"F\b", nombre, _A):
            return False
    if re.search(r"\bKF\b", nombre, re.I | _A):
        return False
    return None


def potencia_estimada(cpu_w: Any, gpu_w: Any, base_w: float = 100, margen: float = 0.3) -> Optional[int]:
    if not _es_num(cpu_w) or not _es_num(gpu_w):
        return None
    if cpu_w <= 0 or gpu_w < 0:
        return None
    return math.ceil((cpu_w + gpu_w + base_w) * (1 + margen))


def _r(regla: str, estado: str, mensaje: str, componentes: list[str]) -> dict:
    return {"regla": regla, "estado": estado, "mensaje": mensaje, "componentes": componentes}


# ------------------------------------------------------------------ reglas ---
def _regla_cpu_socket(b: dict):
    C = ["cpu", "mother"]
    if not _hay(b, "cpu") or not _hay(b, "mother"):
        return None
    cs = _norm(b["cpu"].get("socket"))
    ms = _norm(b["mother"].get("socket"))
    if not cs or not ms:
        return _r("cpu_socket", UNKNOWN,
                  "Che, me falta el dato del socket del CPU o del mother, así que no te puedo confirmar que encastren. Cargalo y lo reevaluamos.", C)
    if cs == ms:
        return _r("cpu_socket", OK, f"El CPU y el mother comparten socket {cs}. Van juntos sin drama.", C)
    return _r("cpu_socket", ERROR,
              f"Ojo, no encastran: tu CPU es {cs} y el mother es {ms}. Tenés que cambiar uno de los dos.", C)


def _regla_ram_ddr(b: dict):
    rams = _lista(b.get("ram"))
    if not rams or not _hay(b, "mother"):
        return None
    C = ["ram", "mother"]
    tipo_mother = _norm(b["mother"].get("memoriaTipo"))
    salidas = []
    for i, r in enumerate(rams):
        tag = f" (módulo {i + 1})" if len(rams) > 1 else ""
        tipo = _norm(r.get("tipo"))
        if not tipo or not tipo_mother:
            salidas.append(_r("ram_ddr", UNKNOWN,
                              f"De la RAM{tag} no sé si es DDR4 o DDR5, o me falta el dato del mother. Sin eso no te la puedo aprobar.", C))
            continue
        if tipo != tipo_mother:
            salidas.append(_r("ram_ddr", ERROR,
                              f"Esa RAM{tag} es {tipo} pero el mother solo acepta {tipo_mother}. No te va a andar: buscá un kit {tipo_mother}.", C))
            continue
        mod = _norm(r.get("formatoModulo") or "DIMM")
        if mod == "SO-DIMM":
            salidas.append(_r("ram_ddr", ERROR,
                              f"Esa RAM{tag} es SO-DIMM (de notebook) y este mother usa DIMM de escritorio. No entra físicamente.", C))
            continue
        salidas.append(_r("ram_ddr", OK, f"La RAM{tag} es {tipo} como pide el mother. Bien ahí.", C))
    return salidas


def _regla_ram_capacidad(b: dict):
    rams = _lista(b.get("ram"))
    if not rams or not _hay(b, "mother"):
        return None
    C = ["ram", "mother"]
    mother = b["mother"]
    max_gb = mother.get("memoriaMaximaGB")
    total_mod = 0
    total_gb = 0
    incompleta = False
    for r in rams:
        mods = r.get("modulos")
        if mods is None:
            mods = 1
        if not _es_num(r.get("capacidadGB")) or not _es_num(mods):
            incompleta = True
            continue
        total_mod += mods
        total_gb += r["capacidadGB"] * mods
    salidas = []
    ranuras = mother.get("ranurasRAM")
    if _es_num(ranuras):
        if incompleta:
            salidas.append(_r("ram_ranuras", UNKNOWN,
                              "Me falta la capacidad o la cantidad de módulos de alguna RAM, así que no puedo verificar las ranuras. Completalo.", C))
        elif total_mod > ranuras:
            salidas.append(_r("ram_ranuras", ERROR,
                              f"Te pasaste de ranuras: querés poner {js_str(total_mod)} módulos y el mother trae {js_str(ranuras)}. Sacá un kit o cambiá el mother.", C))
        else:
            salidas.append(_r("ram_ranuras", OK,
                              f"Entran lo más bien: {js_str(total_mod)} módulo(s) en {js_str(ranuras)} ranuras.", C))
    else:
        salidas.append(_r("ram_ranuras", UNKNOWN,
                          "No sé cuántas ranuras trae el mother, así que no puedo validar los módulos. Conseguí ese dato.", C))
    if _es_num(max_gb):
        if incompleta:
            salidas.append(_r("ram_maximo", UNKNOWN,
                              "Sin la capacidad de todos los módulos no puedo verificar el máximo del mother.", C))
        elif total_gb > max_gb:
            salidas.append(_r("ram_maximo", ERROR,
                              f"Te pasaste del máximo: sumás {js_str(total_gb)}GB y el mother banca hasta {js_str(max_gb)}GB. Bajá la capacidad.", C))
        else:
            salidas.append(_r("ram_maximo", OK,
                              f"Vas bien de capacidad: {js_str(total_gb)}GB de un máximo de {js_str(max_gb)}GB.", C))
    else:
        salidas.append(_r("ram_maximo", UNKNOWN,
                          "No sé la memoria máxima del mother, así que la capacidad total queda pendiente de revisión.", C))
    return salidas


def _regla_mother_gabinete(b: dict):
    if not _hay(b, "mother") or not _hay(b, "gabinete"):
        return None
    C = ["mother", "gabinete"]
    fm = _normalizar_formato(b["mother"].get("formato"))
    if not fm:
        return _r("mother_gabinete", UNKNOWN,
                  "No sé el factor de forma del mother. Sin eso no te puedo decir si entra en el gabinete.", C)
    aceptados = [x for x in (_normalizar_formato(v) for v in _lista(b["gabinete"].get("formatosMother"))) if x]
    if not aceptados:
        g = _normalizar_formato(b["gabinete"].get("formato"))
        if not g:
            return _r("mother_gabinete", UNKNOWN,
                      "No sé qué tamaños de mother acepta el gabinete. Fijate la ficha del gabo y lo reevaluamos.", C)
        aceptados = _FORMATOS_ACEPTADOS_POR_GABINETE.get(g, [g])
    if fm in aceptados:
        return _r("mother_gabinete", OK, f"El mother {fm} entra en el gabinete. Mandale nomás.", C)
    return _r("mother_gabinete", ERROR,
              f"No entra: el mother es {fm} y el gabinete solo acepta {', '.join(aceptados)}. Cambiá uno de los dos.", C)


def _regla_gpu_gabinete(b: dict):
    if not _hay(b, "gpu") or not _hay(b, "gabinete"):
        return None
    C = ["gpu", "gabinete"]
    largo = b["gpu"].get("longitudMm")
    mx = b["gabinete"].get("maxGpuMm")
    if not _es_num(largo) or not _es_num(mx):
        return _r("gpu_gabinete", UNKNOWN,
                  "Me falta el largo de la placa o el espacio máximo del gabinete. Medilo antes de comprar, que una GPU que no entra es un clavo.", C)
    if largo <= mx:
        return _r("gpu_gabinete", OK, f"La placa ({js_str(largo)}mm) entra en el gabinete (hasta {js_str(mx)}mm).", C)
    return _r("gpu_gabinete", ERROR,
              f"La placa no entra: mide {js_str(largo)}mm y el gabinete banca hasta {js_str(mx)}mm. Buscá un gabo más grande o una placa más corta.", C)


def _regla_cooler(b: dict):
    if not _hay(b, "cooler"):
        return None
    cooler = b["cooler"]
    salidas = []
    if _hay(b, "cpu"):
        C = ["cooler", "cpu"]
        sockets = [x for x in (_norm(s) for s in _lista(cooler.get("sockets"))) if x]
        cs = _norm(b["cpu"].get("socket"))
        if not sockets or not cs:
            salidas.append(_r("cooler_socket", UNKNOWN,
                              "No sé los sockets que banca el cooler o el socket del CPU. Verificá la compatibilidad del anclaje.", C))
        elif cs in sockets:
            salidas.append(_r("cooler_socket", OK, f"El cooler trae anclaje para {cs}. Perfecto.", C))
        else:
            salidas.append(_r("cooler_socket", ERROR,
                              f"El cooler no trae anclaje para {cs} (solo {', '.join(sockets)}). Elegí otro cooler.", C))
        tdp_cpu = b["cpu"].get("tdpW")
        tdp_cooler = cooler.get("tdpMaximoW")
        if not _es_num(tdp_cpu) or not _es_num(tdp_cooler):
            salidas.append(_r("cooler_tdp", UNKNOWN,
                              "Me falta el TDP del CPU o la capacidad del cooler. Sin eso no sé si te va a hacer throttle.", C))
        elif tdp_cooler < tdp_cpu:
            salidas.append(_r("cooler_tdp", ERROR,
                              f"El cooler se queda corto: disipa {js_str(tdp_cooler)}W y el CPU tira {js_str(tdp_cpu)}W. Te va a hacer throttle; subí de cooler.", C))
        elif tdp_cooler < tdp_cpu * 1.15:
            salidas.append(_r("cooler_tdp", WARN,
                              f"Vas justito de disipación ({js_str(tdp_cooler)}W para un CPU de {js_str(tdp_cpu)}W). Anda, pero con calor te conviene algo más grande.", C))
        else:
            salidas.append(_r("cooler_tdp", OK,
                              f"De disipación vas sobrado: {js_str(tdp_cooler)}W para {js_str(tdp_cpu)}W del CPU.", C))
    if _hay(b, "gabinete"):
        C = ["cooler", "gabinete"]
        tipo = _norm(cooler.get("tipo"))
        gab = b["gabinete"]
        if tipo == "LIQUIDO" or re.search(r"AIO|LIQUID", tipo):
            rad = cooler.get("radiadorMm")
            mx = gab.get("radiadorMaxMm")
            if not _es_num(rad) or not _es_num(mx):
                salidas.append(_r("cooler_gabinete", UNKNOWN,
                                  "No sé el tamaño del radiador o el máximo del gabinete. Confirmá que el radiador entra.", C))
            elif rad <= mx:
                salidas.append(_r("cooler_gabinete", OK,
                                  f"El radiador de {js_str(rad)}mm entra en el gabinete (hasta {js_str(mx)}mm).", C))
            else:
                salidas.append(_r("cooler_gabinete", ERROR,
                                  f"El radiador no entra: es de {js_str(rad)}mm y el gabinete banca hasta {js_str(mx)}mm.", C))
        else:
            alt = cooler.get("alturaMm")
            mx = gab.get("maxCoolerMm")
            if not _es_num(alt) or not _es_num(mx):
                salidas.append(_r("cooler_gabinete", UNKNOWN,
                                  "Me falta la altura del cooler o el despeje del gabinete. Si el cooler toca el vidrio, es un problema.", C))
            elif alt <= mx:
                salidas.append(_r("cooler_gabinete", OK,
                                  f"El cooler ({js_str(alt)}mm) entra en el gabinete (hasta {js_str(mx)}mm).", C))
            else:
                salidas.append(_r("cooler_gabinete", ERROR,
                                  f"El cooler no entra: mide {js_str(alt)}mm y el gabinete banca hasta {js_str(mx)}mm. Andá por un perfil más bajo.", C))
    return salidas


def _regla_almacenamiento(b: dict):
    discos = _lista(b.get("discos"))
    if not discos or not _hay(b, "mother"):
        return None
    C = ["almacenamiento", "mother"]
    mother = b["mother"]
    nvme = [d for d in discos if _norm(d.get("tipo")) == "NVME"]
    sata = [d for d in discos if _norm(d.get("tipo")) == "SATA"]
    raros = [d for d in discos if _norm(d.get("tipo")) not in ("NVME", "SATA")]
    salidas = []
    for d in raros:
        nombre = d.get("nombre")
        nombre = "sin nombre" if nombre is None else js_str(nombre)
        salidas.append(_r("almacenamiento_slots", UNKNOWN,
                          f'Del disco "{nombre}" no sé si es NVMe o SATA. Sin eso no puedo verificar los slots.', C))
    if nvme:
        slots = mother.get("puertosM2")
        if not _es_num(slots):
            salidas.append(_r("almacenamiento_nvme", UNKNOWN,
                              "No sé cuántos slots M.2 trae el mother. Contalos en la ficha antes de sumar NVMes.", C))
        elif len(nvme) <= slots:
            salidas.append(_r("almacenamiento_nvme", OK,
                              f"Tenés {len(nvme)} NVMe(s) para {js_str(slots)} slot(s) M.2. Entran todos.", C))
        else:
            salidas.append(_r("almacenamiento_nvme", ERROR,
                              f"Te sobran NVMes: querés {len(nvme)} y el mother trae {js_str(slots)} slots M.2. Sacá uno o cambiá el mother.", C))
    if sata:
        slots = mother.get("puertosSata")
        if not _es_num(slots):
            salidas.append(_r("almacenamiento_sata", UNKNOWN,
                              "No sé cuántos SATA trae el mother, así que los discos SATA quedan pendientes de revisión.", C))
        elif len(sata) <= slots:
            salidas.append(_r("almacenamiento_sata", OK,
                              f"Tenés {len(sata)} disco(s) SATA para {js_str(slots)} puertos. Van todos.", C))
        else:
            salidas.append(_r("almacenamiento_sata", ERROR,
                              f"Te faltan SATA: querés {len(sata)} discos y el mother trae {js_str(slots)} puertos.", C))
    return salidas


def _regla_igpu(b: dict):
    if not _hay(b, "cpu"):
        return None
    C = ["cpu", "gpu"]
    if _hay(b, "gpu"):
        return _r("cpu_gpu_video", OK,
                  "Tenés placa dedicada, así que el video está cubierto uses el CPU que uses.", C)
    igpu = cpu_tiene_igpu(b["cpu"])
    if igpu is True:
        return _r("cpu_gpu_video", OK,
                  "No pusiste placa, pero tu CPU trae gráficos integrados. Zafás para usar la PC (para jugar en serio después sumás una GPU).", C)
    if igpu is False:
        return _r("cpu_gpu_video", ERROR,
                  "Ojo: tu CPU no trae gráficos integrados (serie F) y no pusiste placa de video. Te vas a quedar sin imagen; sumá una GPU.", C)
    return _r("cpu_gpu_video", UNKNOWN,
              "No pusiste placa y no sé si tu CPU trae gráficos integrados. Confirmalo antes de comprar, porque sin video no hay PC que valga.", C)


def _regla_fuente_potencia(b: dict):
    if not _hay(b, "fuente"):
        return None
    C = ["fuente", "cpu", "gpu"]
    pot = b["fuente"].get("potenciaW")
    cpu_w = b["cpu"].get("tdpW") if _hay(b, "cpu") else None
    gpu = b["gpu"] if _hay(b, "gpu") else None
    gpu_w = gpu.get("consumoW") if gpu is not None else 0
    if not _es_num(pot) or not _es_num(cpu_w) or (gpu is not None and not _es_num(gpu_w)):
        return _r("fuente_potencia", UNKNOWN,
                  "Me faltan los consumos (TDP del CPU / consumo de la GPU) o la potencia de la fuente. Sin eso no te puedo decir si la fuente banca.", C)
    estimada = potencia_estimada(cpu_w, gpu_w)
    if estimada is None:
        return _r("fuente_potencia", UNKNOWN, "No pude estimar el consumo con los datos que hay.", C)
    rec = gpu.get("fuenteRecomendadaW") if gpu is not None else None
    if _es_num(rec) and pot < rec:
        return _r("fuente_potencia", ERROR,
                  f"La fuente se queda corta: tenés {js_str(pot)}W y la placa pide mínimo {js_str(rec)}W. Subí a {js_str(rec)}W o más (estimado total con margen: ~{estimada}W).", C)
    if estimada > pot:
        return _r("fuente_potencia", ERROR,
                  f"No te alcanza la fuente: el consumo estimado con margen es ~{estimada}W y tenés {js_str(pot)}W. Buscá una más grande.", C)
    if estimada > pot * 0.8:
        return _r("fuente_potencia", WARN,
                  f"Vas justito: estimamos ~{estimada}W contra {js_str(pot)}W de fuente (más del 80%). Anda, pero si podés estirate a más potencia para ir holgado.", C)
    return _r("fuente_potencia", OK,
              f"La fuente banca: estimamos ~{estimada}W con margen del 30% y tenés {js_str(pot)}W.", C)


def _regla_fuente_conectores(b: dict):
    if not _hay(b, "fuente") or not _hay(b, "gpu"):
        return None
    C = ["fuente", "gpu"]
    fuente, gpu = b["fuente"], b["gpu"]
    salidas = []
    if gpu.get("requiere12VHPWR"):
        tiene = fuente.get("tiene12VHPWR")
        if tiene is True:
            salidas.append(_r("fuente_12vhpwr", OK,
                              "La fuente trae el 12VHPWR que pide la placa. Conectás directo, sin adaptadores raros.", C))
        elif tiene is False:
            salidas.append(_r("fuente_12vhpwr", ERROR,
                              "La placa pide 12VHPWR y tu fuente no lo trae. Cambiá la fuente por una con 12VHPWR nativo (los adaptadores son un parche).", C))
        else:
            salidas.append(_r("fuente_12vhpwr", UNKNOWN,
                              "La placa pide 12VHPWR y no sé si tu fuente lo trae. Fijate la ficha de la fuente.", C))
    pide8 = gpu.get("conectores8pin")
    if pide8 is None:
        pide8 = 0
    if _es_num(pide8) and pide8 > 0:
        tiene8 = fuente.get("conectores8pin")
        if not _es_num(tiene8):
            salidas.append(_r("fuente_8pin", UNKNOWN,
                              "La placa pide 8-pines y no sé cuántos trae tu fuente. Contalos en la ficha.", C))
        elif tiene8 >= pide8:
            salidas.append(_r("fuente_8pin", OK,
                              f"La fuente trae {js_str(tiene8)} conector(es) de 8-pines y la placa pide {js_str(pide8)}. Listo.", C))
        else:
            salidas.append(_r("fuente_8pin", ERROR,
                              f"Te faltan conectores: la placa pide {js_str(pide8)} de 8-pines y la fuente trae {js_str(tiene8)}.", C))
    return salidas or None


def _regla_fuente_gabinete(b: dict):
    if not _hay(b, "fuente") or not _hay(b, "gabinete"):
        return None
    C = ["fuente", "gabinete"]
    formato = b["fuente"].get("formato")
    f = _norm(formato or "ATX")
    aceptados = [x for x in (_norm(v) for v in _lista(b["gabinete"].get("formatosFuente"))) if x]
    if not formato and not aceptados:
        return _r("fuente_gabinete", UNKNOWN,
                  "No sé el tamaño de la fuente ni los que acepta el gabinete. Verificá que la fuente entra.", C)
    if not aceptados:
        return _r("fuente_gabinete", UNKNOWN,
                  "No sé qué formatos de fuente acepta el gabinete. Fijate la ficha del gabo.", C)
    if f in aceptados:
        return _r("fuente_gabinete", OK, f"La fuente {f} entra en el gabinete.", C)
    return _r("fuente_gabinete", ERROR,
              f"La fuente {f} no entra en el gabinete (acepta {', '.join(aceptados)}).", C)


def _regla_bios(b: dict):
    if not _hay(b, "cpu") or not _hay(b, "mother"):
        return None
    C = ["cpu", "mother"]
    chipset = _norm(b["mother"].get("chipset"))
    nombre = js_str(b["cpu"].get("nombre"))
    if not chipset or not nombre:
        return _r("bios_chipset", UNKNOWN,
                  "Sin el chipset del mother o el modelo exacto del CPU no puedo avisarte si vas a necesitar actualizar la BIOS.", C)
    intel14 = bool(re.search(r"\b14\d{3}", nombre, _A))
    intel13 = bool(re.search(r"\b13\d{3}", nombre, _A))
    amd8000 = bool(re.search(r"\b8\d{3}[A-Z]?\b", nombre, _A)) and bool(re.search(r"RYZEN", nombre, re.I))
    if (intel14 or intel13) and chipset in ("B660", "Z690"):
        return _r("bios_chipset", WARN,
                  f"Ojo: ese {chipset} seguro necesita actualizar la BIOS para tu CPU de 13va/14va gen. Pedí que te lo den actualizado o tené un pendrive a mano.", C)
    if intel14 and chipset in ("B760", "Z790", "H770"):
        return _r("bios_chipset", WARN,
                  "Tu combo puede pedir actualización de BIOS (14va gen en serie 600/700). Revisá que el mother venga con BIOS actualizada.", C)
    if amd8000 and chipset in ("B650", "X670", "B650E", "X670E"):
        return _r("bios_chipset", WARN,
                  "Los Ryzen 8000 en placas B650/X670 de las primeras tandas a veces piden actualizar la BIOS. Confirmá que venga lista.", C)
    return _r("bios_chipset", OK,
              "No vemos choque de generación entre CPU y chipset. Igual, siempre fijate la versión de BIOS en la ficha.", C)


_REGLAS = (
    _regla_cpu_socket, _regla_ram_ddr, _regla_ram_capacidad, _regla_mother_gabinete,
    _regla_gpu_gabinete, _regla_cooler, _regla_almacenamiento, _regla_igpu,
    _regla_fuente_potencia, _regla_fuente_conectores, _regla_fuente_gabinete, _regla_bios,
)


def evaluar_build(build: Optional[dict] = None) -> dict:
    b = build or {}
    resultados: list[dict] = []
    for fn in _REGLAS:
        r = fn(b)
        if not r:
            continue
        if isinstance(r, list):
            resultados.extend(r)
        else:
            resultados.append(r)
    estados = [r["estado"] for r in resultados]
    return {
        "resultados": resultados,
        "resumen": {
            "total": len(resultados),
            "ok": estados.count(OK),
            "warn": estados.count(WARN),
            "error": estados.count(ERROR),
            "unknown": estados.count(UNKNOWN),
            "bloqueada": ERROR in estados,
            "tienePendientes": UNKNOWN in estados,
        },
    }


# ------------------------------------------------------- adaptar.js (port) ---
def _como_numero(v: Any) -> Optional[float]:
    if v is _FALTA:
        return None
    if v is None:
        return 0
    if isinstance(v, bool):
        return 1 if v else 0
    if _es_num(v):
        return v if math.isfinite(v) else None
    if isinstance(v, str):
        t = v.strip()
        if not t:
            return 0
        try:
            n = float(t)
        except ValueError:
            return None
        if not math.isfinite(n):
            return None
        return int(n) if n == int(n) else n
    return None


def _como_texto(v: Any) -> Optional[str]:
    if v is _FALTA:
        return None
    t = js_str(v).strip()
    return t or None


def _como_bool(v: Any) -> Optional[bool]:
    return v if isinstance(v, bool) else None


def _como_lista_texto(v: Any) -> Optional[list[str]]:
    if not isinstance(v, list):
        return None
    lista = [x for x in (js_str(i).strip() for i in v) if x]
    return lista or None


def mapa_specs(filas: list[dict]) -> dict[str, dict]:
    mapa: dict[str, dict] = {}
    for f in filas or []:
        if not f or f.get("producto_id") is None or not f.get("clave"):
            continue
        mapa.setdefault(f["producto_id"], {})[f["clave"]] = f.get("valor")
    return mapa


_CAMPOS_SLOT = {
    "cpu": (("socket", _como_texto), ("tdpW", _como_numero), ("tieneIGPU", _como_bool)),
    "mother": (("socket", _como_texto), ("memoriaTipo", _como_texto), ("ranurasRAM", _como_numero),
               ("memoriaMaximaGB", _como_numero), ("formato", _como_texto), ("puertosM2", _como_numero),
               ("puertosSata", _como_numero), ("chipset", _como_texto)),
    "ram": (("tipo", _como_texto), ("formatoModulo", _como_texto), ("capacidadGB", _como_numero),
            ("modulos", _como_numero)),
    "gpu": (("longitudMm", _como_numero), ("consumoW", _como_numero), ("fuenteRecomendadaW", _como_numero),
            ("conectores8pin", _como_numero), ("requiere12VHPWR", _como_bool)),
    "refrigeracion": (("tipo", _como_texto), ("sockets", _como_lista_texto), ("alturaMm", _como_numero),
                      ("radiadorMm", _como_numero), ("tdpMaximoW", _como_numero)),
    "almacenamiento": (("tipo", _como_texto),),
    "fuente": (("potenciaW", _como_numero), ("tiene12VHPWR", _como_bool), ("conectores8pin", _como_numero),
               ("formato", _como_texto)),
    "gabinete": (("formatosMother", _como_lista_texto), ("maxGpuMm", _como_numero), ("maxCoolerMm", _como_numero),
                 ("radiadorMaxMm", _como_numero), ("formatosFuente", _como_lista_texto)),
}


def adaptar_producto(producto: dict, slot: str, specs: Optional[dict] = None) -> dict:
    s = specs or {}
    nombre = producto.get("nombre")
    spec: dict[str, Any] = {"nombre": "" if nombre is None else nombre}
    for clave, conv in _CAMPOS_SLOT.get(slot, ()):
        valor = conv(s.get(clave, _FALTA))
        if valor is not None:
            spec[clave] = valor
    return spec


# Pasos del armador (pasos.js): categoría del catálogo → slot del adaptador
# → clave del build del motor.
SLOTS = {
    "procesador": ("cpu", "cpu"),
    "motherboard": ("mother", "mother"),
    "memoria ram": ("ram", "ram"),
    "placa de video": ("gpu", "gpu"),
    "almacenamiento": ("almacenamiento", "discos"),
    "cooler": ("refrigeracion", "cooler"),
    "gabinete": ("gabinete", "gabinete"),
    "fuente": ("fuente", "fuente"),
}

NOMBRE_COMPONENTE = {
    "cpu": "procesador", "mother": "motherboard", "ram": "memoria RAM", "gpu": "placa de video",
    "discos": "almacenamiento", "almacenamiento": "almacenamiento", "cooler": "cooler",
    "gabinete": "gabinete", "fuente": "fuente",
}


def slot_de(producto: dict) -> Optional[tuple[str, str]]:
    return SLOTS.get(js_str(producto.get("categoria")).strip().lower())


def build_desde_productos(productos: list[dict], specs: dict[str, dict]) -> tuple[dict, list[dict]]:
    """Arma el build del motor como lo hace usoArmador.js. Devuelve también
    los productos que no son componentes evaluables (monitores, etc.) o que
    repiten un slot único."""
    build: dict[str, Any] = {}
    fuera: list[dict] = []
    for p in productos:
        par = slot_de(p)
        if par is None:
            fuera.append(p)
            continue
        slot, clave = par
        spec = adaptar_producto(p, slot, specs.get(p.get("id")))
        if clave == "discos":
            build.setdefault("discos", []).append(spec)
        elif clave == "ram":
            if "ram" in build:
                previa = build["ram"]
                build["ram"] = (previa if isinstance(previa, list) else [previa]) + [spec]
            else:
                build["ram"] = spec
        elif clave in build:
            fuera.append(p)
        else:
            build[clave] = spec
    return build, fuera
