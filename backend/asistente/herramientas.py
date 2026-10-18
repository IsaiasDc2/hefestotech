"""HefestoTech · asistente · herramientas sobre datos reales de la tienda.

Todo precio, stock, especificación y veredicto de compatibilidad que diga el
asistente sale de estas funciones. Ninguna inventa: si no hay dato devuelven
`error` o `encontrado: False` y el modelo tiene que decirlo.

Cada herramienta recibe un `Contexto` (fuente de datos + estado del turno):
ahí se registran los productos vistos (tarjetas del chat), el armado
recomendado y la derivación a una persona, que el router manda como eventos
aparte del texto. Así las tarjetas muestran SIEMPRE el precio de la base y
no el que escriba el modelo.
"""

from __future__ import annotations

import itertools
import re
import time
import unicodedata
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from checkout_api import ENVIO_ESTANDAR_CENT, ENVIO_EXPRESS_CENT, UMBRAL_ENVIO_GRATIS_CENT

from . import compatibilidad as motor
from .datos import ErrorDatos, FuenteDatos, numero_pedido
from .politicas import TEMAS, buscar_politica

MAX_RESULTADOS = 6
MAX_CONSULTAS_PEDIDO = 5          # por sesión y ventana: freno a la adivinación
VENTANA_PEDIDOS_SEG = 600


# --------------------------------------------------------------- texto ---
def normalizar(texto: Any) -> str:
    t = unicodedata.normalize("NFD", str(texto or ""))
    return "".join(c for c in t if unicodedata.category(c) != "Mn").lower()


def tokens(texto: Any) -> list[str]:
    return re.findall(r"[a-z0-9]+", normalizar(texto))


_GENERICAS = {
    "de", "la", "el", "los", "las", "un", "una", "y", "o", "con", "para", "por", "que", "en", "mi", "me",
    "placa", "video", "fuente", "gabinete", "motherboard", "mother", "memoria", "ram", "procesador",
    "monitor", "mouse", "teclado", "cooler", "pro", "plus", "edition", "rgb", "gaming", "gamer",
    "gb", "tb", "mhz", "hz", "w", "nvme", "hdd", "ssd", "ddr4", "ddr5", "ti", "super", "xt", "wifi",
    "black", "white", "argb", "aio", "tuf", "rog", "the", "and", "with", "for",
}

# Palabras del usuario → categoría del catálogo.
CATEGORIAS = {
    "placa de video": ("placa de video", "placas de video", "gpu", "gpus", "grafica", "graficas", "tarjeta de video",
                       "rtx", "radeon", "geforce", "video card", "graphics card"),
    "procesador": ("procesador", "procesadores", "cpu", "cpus", "micro", "micros", "ryzen", "intel core", "processor"),
    "motherboard": ("motherboard", "motherboards", "mother", "mothers", "placa madre", "placas madre", "mobo",
                    "placa base", "motherboard"),
    "memoria ram": ("memoria ram", "memorias", "ram", "memoria", "ddr4", "ddr5", "memory"),
    "almacenamiento": ("almacenamiento", "disco", "discos", "ssd", "nvme", "m.2", "hdd", "rigido", "storage", "drive"),
    "fuente": ("fuente", "fuentes", "psu", "fuente de poder", "fuente de alimentacion", "power supply"),
    "gabinete": ("gabinete", "gabinetes", "case", "gabo", "torre", "chasis"),
    "cooler": ("cooler", "coolers", "refrigeracion", "disipador", "watercooling", "water cooling", "aio",
               "refrigeracion liquida"),
    "monitor": ("monitor", "monitores", "pantalla", "screen"),
    "periferico": ("periferico", "perifericos", "teclado", "teclados", "mouse", "mouses", "keyboard"),
    "auriculares": ("auriculares", "auricular", "headset", "headsets", "vincha", "headphones"),
    "mousepad": ("mousepad", "mouse pad", "pad"),
    "parlantes": ("parlantes", "parlante", "speakers"),
    "silla gamer": ("silla", "sillas", "silla gamer", "chair"),
    "webcam": ("webcam", "camara web", "camara"),
    "ups": ("ups", "estabilizador", "bateria"),
}


def categoria_en(texto: str) -> Optional[str]:
    t = f" {normalizar(texto)} "
    mejor, largo = None, 0
    for cat, sinonimos in CATEGORIAS.items():
        for s in sinonimos:
            if re.search(rf"(?<![a-z0-9]){re.escape(s)}(?![a-z0-9])", t) and len(s) > largo:
                mejor, largo = cat, len(s)
    return mejor


def _tok_identificador(t: str) -> bool:
    """Tokens que identifican un modelo: con dígitos y no unidades sueltas
    (32gb, 850w, 6000mhz) ni un número de una cifra."""
    if not re.search(r"\d", t):
        return False
    if len(t) == 2:
        # h7, g7: modelos cortos. i5/i7/r5 son una gama, no un modelo.
        return bool(re.fullmatch(r"[a-z]\d", t)) and t[0] not in "ir"
    if t.isdigit():
        return len(t) >= 3
    # "850w" sí identifica una fuente; "32gb" o "6000mhz" no identifican nada.
    return len(t) > 2 and not re.fullmatch(r"\d+(gb|tb|mhz|hz|mm|va)", t)


def _coincide(u: str, p: str) -> bool:
    if u == p:
        return True
    # "fuente de 650" encuentra "650w".
    if u.isdigit() and len(u) >= 3 and p == f"{u}w":
        return True
    # "14600" encuentra "14600k"; "7800" encuentra "7800x3d".
    return len(u) >= 4 and p.startswith(u) and re.search(r"\d", u) is not None


def puntaje(consulta_tokens: list[str], producto: dict) -> float:
    nombre = tokens(producto["nombre"])
    marca = tokens(producto["marca"])
    cat = tokens(producto["categoria"])
    codigo = normalizar(producto["codigo"]).replace("-", "")
    total = 0.0
    for u in consulta_tokens:
        if u in _GENERICAS and not any(u == n for n in nombre):
            continue
        if codigo and u == codigo:
            total += 6
        elif any(_coincide(u, n) for n in nombre):
            total += 4 if _tok_identificador(u) else 2
        elif u in marca:
            total += 1.5
        elif u in cat:
            total += 1
    return total


def menciones(texto: str, productos: list[dict], max_items: int = 4) -> list[dict]:
    """Productos nombrados en el texto, uno por modelo, en orden de aparición.
    Requiere al menos un token identificador (un número de modelo o el SKU):
    "una placa de video" no menciona ningún producto."""
    ts = tokens(texto)
    elegidos: list[tuple[int, dict]] = []
    usados: set[str] = set()
    por_codigo = {normalizar(p["codigo"]): p for p in productos if p["codigo"]}
    for m in re.finditer(r"ht\s*-?\s*(\d{4})", normalizar(texto)):
        p = por_codigo.get(f"ht-{m.group(1)}")
        if p and p["id"] not in usados:
            # Posición aproximada en tokens para ordenar junto al resto.
            elegidos.append((len(tokens(normalizar(texto)[:m.start()])), p))
            usados.add(p["id"])
    for i, u in enumerate(ts):
        # Un año suelto ("el mundial 2022") no nombra un producto.
        if not _tok_identificador(u) or (u.isdigit() and 1990 <= int(u) <= 2039):
            continue
        candidatos = [p for p in productos if p["id"] not in usados
                      and any(_coincide(u, n) for n in tokens(p["nombre"]))]
        if not candidatos:
            continue
        ventana = ts[max(0, i - 3): i + 4]
        mejor = max(candidatos, key=lambda p: (
            puntaje(ventana, p), p["stock"] > 0, not p["precio_a_confirmar"], -len(p["nombre"])))
        # El mismo modelo en otra variante (990 PRO 2TB y 990 PRO NVMe 2TB):
        # se queda la primera, las demás no suman otra mención.
        usados.update(c["id"] for c in candidatos if c is mejor or tokens(c["nombre"])[:3] == tokens(mejor["nombre"])[:3])
        elegidos.append((i, mejor))
    elegidos.sort(key=lambda x: x[0])
    vistos, salida = set(), []
    for _, p in elegidos:
        if p["id"] not in vistos:
            vistos.add(p["id"])
            salida.append(p)
    return salida[:max_items]


# ---------------------------------------------------------- contexto ---
@dataclass
class Contexto:
    fuente: FuenteDatos
    sesion: str = ""
    carrito: list[dict] = field(default_factory=list)
    vistos: dict[str, dict] = field(default_factory=dict)
    ultimos: list[str] = field(default_factory=list)
    armado: Optional[dict] = None
    derivacion: Optional[dict] = None
    usadas: list[str] = field(default_factory=list)

    def ver(self, productos: list[dict]) -> None:
        self.ultimos = []
        for p in productos:
            self.vistos[p["id"]] = p
            self.ultimos.append(p["id"])


_consultas_pedido: dict[str, list[float]] = {}


def _resumen(p: dict) -> dict:
    """Lo que ve el modelo de un producto (sin imagen ni descripción larga)."""
    r = {
        "id": p["id"], "sku": p["codigo"], "nombre": p["nombre"], "marca": p["marca"],
        "categoria": p["categoria"], "stock": p["stock"], "envio_gratis": p["envio_gratis"],
    }
    if p["precio_a_confirmar"]:
        r["precio"] = None
        r["nota_precio"] = "Precio a confirmar: no informar ningún monto."
    else:
        r["precio_final_ars"] = p["precio"]
        if p["precio_lista"] > p["precio"]:
            r["precio_lista_ars"] = p["precio_lista"]
    return r


def _resolver(ref: Any, productos: list[dict]) -> Optional[dict]:
    clave = str(ref or "").strip()
    if not clave:
        return None
    norm = normalizar(clave).replace(" ", "")
    for p in productos:
        if p["id"] == clave or normalizar(p["codigo"]) == norm:
            return p
    encontrados = menciones(clave, productos, max_items=1)
    if encontrados:
        return encontrados[0]
    ts = tokens(clave)
    candidatos = sorted(productos, key=lambda p: puntaje(ts, p), reverse=True)
    if candidatos and puntaje(ts, candidatos[0]) >= 4:
        return candidatos[0]
    return None


# --------------------------------------------------------- herramientas ---
def search_products(ctx: Contexto, consulta: str = "", categoria: str = "", precio_max: Any = None,
                    precio_min: Any = None, solo_con_stock: bool = False, limite: int = 5) -> dict:
    productos = ctx.fuente.productos()
    cat = categoria_en(categoria) if categoria else None
    if categoria and not cat:
        cat = normalizar(categoria)
    if not cat:
        cat = categoria_en(consulta)
    ts = [t for t in tokens(consulta)]
    try:
        pmax = float(precio_max) if precio_max not in (None, "") else None
        pmin = float(precio_min) if precio_min not in (None, "") else None
    except (TypeError, ValueError):
        return {"error": "precio_max y precio_min tienen que ser números en pesos."}
    filtrados = []
    for p in productos:
        if cat and normalizar(p["categoria"]) != cat:
            continue
        if solo_con_stock and p["stock"] <= 0:
            continue
        if pmax is not None and (p["precio_a_confirmar"] or p["precio"] > pmax):
            continue
        if pmin is not None and (p["precio_a_confirmar"] or p["precio"] < pmin):
            continue
        s = puntaje(ts, p)
        if ts and s <= 0 and not cat:
            continue
        filtrados.append((s, p))
    filtrados.sort(key=lambda x: (-x[0], x[1]["stock"] <= 0, x[1]["precio_a_confirmar"],
                                  -x[1]["precio"] if pmax is not None else x[1]["precio"]))
    limite = max(1, min(int(limite or 5), MAX_RESULTADOS))
    elegidos = [p for _, p in filtrados[:limite]]
    ctx.ver(elegidos)
    salida: dict[str, Any] = {"total_encontrados": len(filtrados), "productos": [_resumen(p) for p in elegidos]}
    if cat:
        salida["categoria"] = cat
    if not elegidos:
        salida["nota"] = "Sin resultados en el catálogo con esos criterios."
    return salida


def get_product(ctx: Contexto, id_o_sku: str = "") -> dict:
    p = _resolver(id_o_sku, ctx.fuente.productos())
    if not p:
        return {"encontrado": False, "nota": "No existe un producto activo con ese id, SKU o nombre."}
    ctx.ver([p])
    specs = ctx.fuente.specs().get(p["id"], {})
    return {
        "encontrado": True, **_resumen(p), "descripcion": p["descripcion"],
        "especificaciones": p["especificaciones"],
        "specs_verificadas_compatibilidad": specs,
        "url": p["url"],
    }


def check_stock(ctx: Contexto, id_o_sku: str = "") -> dict:
    p = _resolver(id_o_sku, ctx.fuente.productos())
    if not p:
        return {"encontrado": False, "nota": "No existe un producto activo con ese id, SKU o nombre."}
    ctx.ver([p])
    return {"encontrado": True, "id": p["id"], "nombre": p["nombre"], "stock": p["stock"],
            "disponible": p["stock"] > 0}


def check_compatibility(ctx: Contexto, productos: Optional[list] = None) -> dict:
    catalogo = ctx.fuente.productos()
    refs = list(productos or [])[:10]
    resueltos, no_encontrados = [], []
    for ref in refs:
        p = _resolver(ref, catalogo)
        if p and p not in resueltos:
            resueltos.append(p)
        elif not p:
            no_encontrados.append(str(ref)[:60])
    build, fuera = motor.build_desde_productos(resueltos, ctx.fuente.specs())
    evaluables = [p for p in resueltos if p not in fuera]
    if len(evaluables) < 2:
        return {
            "evaluado": False,
            "nota": "Hacen falta al menos dos componentes de PC del catálogo (procesador, mother, RAM, placa de video, "
                    "almacenamiento, cooler, gabinete o fuente).",
            "no_encontrados": no_encontrados,
            "no_evaluables": [p["nombre"] for p in fuera],
        }
    ctx.ver(evaluables)
    ev = motor.evaluar_build(build)
    r = ev["resumen"]
    veredicto = "incompatible" if r["bloqueada"] else ("con_pendientes" if r["tienePendientes"] else "compatible")
    extra: dict[str, Any] = {}
    if "cpu" in build:
        gpu_w = build["gpu"].get("consumoW") if "gpu" in build else 0
        estimada = motor.potencia_estimada(build["cpu"].get("tdpW"), gpu_w)
        if estimada:
            extra["consumo_estimado_con_margen_w"] = estimada
    if "gpu" in build and build["gpu"].get("fuenteRecomendadaW"):
        extra["fuente_recomendada_por_la_placa_w"] = build["gpu"]["fuenteRecomendadaW"]
    return {
        **extra,
        "evaluado": True,
        "veredicto": veredicto,
        "componentes": [{"nombre": p["nombre"], "tipo": motor.NOMBRE_COMPONENTE[motor.slot_de(p)[1]]}
                        for p in evaluables],
        "resultados": [{"regla": x["regla"], "estado": x["estado"], "mensaje": x["mensaje"]}
                       for x in ev["resultados"]],
        "resumen": {k: r[k] for k in ("ok", "warn", "error", "unknown")},
        "no_encontrados": no_encontrados,
        "no_evaluables": [p["nombre"] for p in fuera],
    }


# ----------------------------------------------------- armado por presupuesto ---
USOS = ("gaming", "oficina", "diseno", "streaming")
_ORDEN_ARMADO = ("cpu", "mother", "ram", "gpu", "cooler", "discos", "fuente", "gabinete")


def _capacidad_gb(p: dict, spec: dict) -> float:
    cap, mods = spec.get("capacidadGB"), spec.get("modulos") or 1
    if isinstance(cap, (int, float)) and not isinstance(cap, bool):
        return cap * mods
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*(tb|gb)", normalizar(p["nombre"]))
    if not m:
        return 0
    n = float(m.group(1).replace(",", "."))
    return n * 1000 if m.group(2) == "tb" else n


def _normalizar_uso(uso: Any) -> str:
    u = normalizar(uso)
    if any(x in u for x in ("ofic", "office", "estudi", "trabaj", "basic", "navega", "hogar")):
        return "oficina"
    if any(x in u for x in ("disen", "edici", "render", "3d", "video", "design", "creac", "program")):
        return "diseno"
    if "stream" in u:
        return "streaming"
    return "gaming"


def recommend_build(ctx: Contexto, presupuesto: Any = None, uso: str = "gaming") -> dict:
    try:
        tope = float(presupuesto)
    except (TypeError, ValueError):
        return {"error": "Falta el presupuesto en pesos (número)."}
    if tope < 50_000 or tope > 100_000_000:
        return {"error": "El presupuesto tiene que estar entre $50.000 y $100.000.000."}
    uso = _normalizar_uso(uso)
    specs = ctx.fuente.specs()
    disponibles = [p for p in ctx.fuente.productos() if p["stock"] > 0 and not p["precio_a_confirmar"]]
    por_clave: dict[str, list[dict]] = {}
    for p in disponibles:
        par = motor.slot_de(p)
        if par:
            por_clave.setdefault(par[1], []).append(p)
    for lista in por_clave.values():
        lista.sort(key=lambda p: p["precio"])
        del lista[12:]
    spec = {p["id"]: motor.adaptar_producto(p, motor.slot_de(p)[0], specs.get(p["id"])) for p in disponibles
            if motor.slot_de(p)}

    if not all(por_clave.get(k) for k in ("cpu", "mother", "ram", "discos", "fuente", "gabinete")):
        return {"error": "El catálogo no tiene en stock todos los componentes necesarios para un armado completo."}

    ram_min = {"gaming": 16, "oficina": 8, "diseno": 32, "streaming": 32}[uso]
    disco_min = {"gaming": 1000, "oficina": 480, "diseno": 1000, "streaming": 1000}[uso]

    def elegir(lista: list[dict], minimo: float, ok: Callable[[dict], bool]) -> Optional[dict]:
        aptos = [p for p in lista if ok(p)]
        grandes = [p for p in aptos if _capacidad_gb(p, spec[p["id"]]) >= minimo]
        return (grandes or aptos or [None])[0]

    candidatos = []
    for cpu, mother in itertools.product(por_clave["cpu"], por_clave["mother"]):
        base = {"cpu": spec[cpu["id"]], "mother": spec[mother["id"]]}
        if motor.evaluar_build(base)["resumen"]["bloqueada"]:
            continue
        ram = elegir(por_clave["ram"], ram_min,
                     lambda r: not motor.evaluar_build({"mother": base["mother"], "ram": spec[r["id"]]})["resumen"]["bloqueada"])
        disco = elegir([d for d in por_clave["discos"] if normalizar(spec[d["id"]].get("tipo")) == "nvme"]
                       or por_clave["discos"], disco_min, lambda d: True)
        if not ram or not disco:
            continue
        igpu = motor.cpu_tiene_igpu(base["cpu"])
        gpus: list[Optional[dict]] = list(por_clave.get("gpu", []))
        if uso == "oficina" and igpu is True:
            gpus = [None]
        tdp = base["cpu"].get("tdpW") or 0
        coolers: list[Optional[dict]] = list(por_clave.get("cooler", [])) if tdp >= 105 else [None]
        if not gpus or not coolers:
            continue
        for gpu, cooler, fuente, gab in itertools.product(gpus, coolers, por_clave["fuente"], por_clave["gabinete"]):
            partes = {"cpu": cpu, "mother": mother, "ram": ram, "gpu": gpu, "cooler": cooler,
                      "discos": disco, "fuente": fuente, "gabinete": gab}
            total = sum(p["precio"] for p in partes.values() if p)
            build = {k: ([spec[p["id"]]] if k == "discos" else spec[p["id"]]) for k, p in partes.items() if p}
            ev = motor.evaluar_build(build)
            if ev["resumen"]["bloqueada"]:
                continue
            candidatos.append((partes, total, ev))

    if not candidatos:
        return {"error": "No encontré una combinación compatible con el stock actual."}

    def valor(c) -> tuple:
        partes, total, ev = c
        precio = lambda k: partes[k]["precio"] if partes[k] else 0  # noqa: E731
        if uso == "oficina":
            peso = -total
        elif uso == "gaming":
            peso = 3 * precio("gpu") + 1.5 * precio("cpu") + 0.3 * precio("ram") + 0.1 * total
        else:
            peso = 2 * precio("cpu") + precio("gpu") + 0.6 * precio("ram") + 0.1 * total
        return (-ev["resumen"]["unknown"], -ev["resumen"]["warn"], peso)

    dentro = [c for c in candidatos if c[1] <= tope]
    if dentro:
        partes, total, ev = max(dentro, key=valor)
        entra = True
    else:
        partes, total, ev = min(candidatos, key=lambda c: c[1])
        entra = False
    elegidos = [partes[k] for k in _ORDEN_ARMADO if partes[k]]
    avisos = [x["mensaje"] for x in ev["resultados"] if x["estado"] in (motor.WARN, motor.UNKNOWN)]
    resultado = {
        "uso": uso,
        "presupuesto_ars": int(tope),
        "dentro_del_presupuesto": entra,
        "total_ars": total,
        "componentes": [{**_resumen(p), "tipo": motor.NOMBRE_COMPONENTE[motor.slot_de(p)[1]]} for p in elegidos],
        "compatibilidad": {
            "veredicto": "con_pendientes" if ev["resumen"]["tienePendientes"] else "compatible",
            "ok": ev["resumen"]["ok"], "avisos": avisos,
        },
    }
    if entra:
        resultado["sobrante_ars"] = int(tope - total)
    else:
        resultado["nota"] = "Ningún armado compatible entra en el presupuesto: este es el más económico posible hoy."
    if partes["gpu"] is None:
        resultado["sin_placa_de_video"] = "El procesador tiene gráficos integrados."
    ctx.ver(elegidos)
    ctx.armado = {"productos": elegidos, "total": total, "dentro_del_presupuesto": entra,
                  "veredicto": resultado["compatibilidad"]["veredicto"]}
    return resultado


# ------------------------------------------------------------- envío ---
_CP = re.compile(r"^(?:[A-Za-z]\d{4}[A-Za-z]{3}|\d{4})$")


def get_shipping_estimate(ctx: Contexto, codigo_postal: str = "", items: Optional[list] = None) -> dict:
    cp = re.sub(r"\s+", "", str(codigo_postal or "")).upper()
    if cp and not _CP.match(cp):
        return {"error": "Código postal inválido: son 4 dígitos (ej. 4400) o el CPA (ej. A4400XAA)."}
    lineas = items if items else ctx.carrito
    catalogo = ctx.fuente.productos()
    subtotal, detalle, faltan = 0, [], []
    for it in (lineas or [])[:50]:
        ref = it.get("id") or it.get("id_o_sku") if isinstance(it, dict) else it
        cantidad = int(it.get("cantidad", 1)) if isinstance(it, dict) else 1
        p = _resolver(ref, catalogo)
        if not p or p["precio_a_confirmar"]:
            faltan.append(str(ref)[:60])
            continue
        cantidad = max(1, min(cantidad, 100))
        subtotal += p["precio"] * cantidad
        detalle.append({"nombre": p["nombre"], "cantidad": cantidad})
    sub_cent = subtotal * 100
    gratis = sub_cent >= UMBRAL_ENVIO_GRATIS_CENT
    salida = {
        "codigo_postal": cp or None,
        "tarifa": "única para todo el país (regla del checkout)",
        "subtotal_ars": subtotal if detalle else None,
        "envio_gratis_desde_ars": UMBRAL_ENVIO_GRATIS_CENT // 100,
        "opciones": [
            {"metodo": "estándar", "costo_ars": 0 if gratis else ENVIO_ESTANDAR_CENT // 100},
            {"metodo": "express", "costo_ars": 0 if gratis else ENVIO_EXPRESS_CENT // 100},
        ],
        "plazo": "No hay un plazo de entrega confirmado.",
        "items": detalle,
    }
    if not detalle:
        salida["nota"] = "Sin productos: se informan las tarifas base."
        salida["opciones"] = [
            {"metodo": "estándar", "costo_ars": ENVIO_ESTANDAR_CENT // 100},
            {"metodo": "express", "costo_ars": ENVIO_EXPRESS_CENT // 100},
        ]
    if faltan:
        salida["sin_precio_o_inexistentes"] = faltan
    return salida


# ------------------------------------------------------------- pedidos ---
_EMAIL = re.compile(r"^[A-Za-z0-9._+\-]+@[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)+$")
_NUMERO = re.compile(r"^(?:#|HT-?)?([0-9a-f]{8})(?:-[0-9a-f-]{27})?$", re.I)

ESTADOS_PEDIDO = {
    "pendiente": "pendiente de pago",
    "pagada": "pagado, en preparación",
    "preparacion": "en preparación",
    "enviada": "enviado",
    "entregada": "entregado",
    "cancelada": "cancelado",
    "reembolsada": "reembolsado",
}
ESTADOS_ENVIO = {
    "pendiente": "pendiente de despacho", "despachado": "despachado", "en_camino": "en camino",
    "entregado": "entregado", "devuelto": "devuelto",
}


def get_order_status(ctx: Contexto, numero: str = "", email: str = "") -> dict:
    num = str(numero or "").strip()
    mail = str(email or "").strip().lower()
    m = _NUMERO.match(num)
    if not m or not _EMAIL.match(mail) or len(mail) > 200:
        return {"encontrado": False,
                "error": "Hacen falta el número de pedido (8 caracteres, ej. #3f9a1c2b o HT-3F9A1C2B) "
                         "y el email con el que se hizo la compra."}
    ahora = time.monotonic()
    clave = ctx.sesion or "sin-sesion"
    previas = [t for t in _consultas_pedido.get(clave, []) if ahora - t < VENTANA_PEDIDOS_SEG]
    if len(previas) >= MAX_CONSULTAS_PEDIDO:
        return {"encontrado": False, "error": "Demasiadas consultas de pedidos seguidas. Derivar a una persona."}
    _consultas_pedido[clave] = previas + [ahora]
    try:
        pedidos = ctx.fuente.pedidos_por_email(mail)
    except ErrorDatos:
        return {"encontrado": False, "error": "La base de pedidos no responde ahora. Derivar a una persona."}
    buscado = m.group(1).lower()
    pedido = next((p for p in pedidos if numero_pedido(p.get("id", "")) == buscado), None)
    if not pedido:
        # Mismo mensaje exista o no el email: no se revela quién compró.
        return {"encontrado": False, "nota": "No hay un pedido con ese número y ese email."}
    catalogo = {p["id"]: p["nombre"] for p in ctx.fuente.productos()}
    envios = pedido.get("envios") or []
    salida = {
        "encontrado": True,
        "numero": f"#{buscado}",
        "estado": ESTADOS_PEDIDO.get(pedido.get("estado"), pedido.get("estado")),
        "fecha": str(pedido.get("created_at") or "")[:10],
        "total_ars": int(pedido.get("total_centavos") or 0) // 100,
        "metodo_envio": pedido.get("envio") or "",
        "items": [{"nombre": catalogo.get(i.get("producto_id"), "Producto"), "cantidad": i.get("cantidad", 1)}
                  for i in pedido.get("orden_items") or []],
    }
    if envios:
        e = envios[0]
        salida["seguimiento"] = {"operador": e.get("operador") or "", "codigo": e.get("tracking") or "",
                                 "estado": ESTADOS_ENVIO.get(e.get("estado"), e.get("estado"))}
    if pedido.get("demo"):
        salida["demo"] = True
    return salida


def get_store_policies(ctx: Contexto, tema: str = "") -> dict:
    return buscar_politica(tema)


def escalate_to_human(ctx: Contexto, motivo: str = "") -> dict:
    motivo = re.sub(r"\s+", " ", str(motivo or "")).strip()[:160] or "Consulta desde el asistente"
    ctx.derivacion = {"motivo": motivo}
    pol = buscar_politica("contacto")
    return {
        "derivado": True,
        "canales": "El chat ya muestra el botón de WhatsApp con la consulta precargada.",
        "contacto": [x["texto"] for x in pol["puntos"]],
    }


# ---------------------------------------------------------- catálogo ---
HERRAMIENTAS: dict[str, dict] = {
    "search_products": {
        "fn": search_products,
        "descripcion": "Busca productos del catálogo real. Devuelve precio final en ARS (IVA incluido) y stock.",
        "parametros": {
            "type": "object",
            "properties": {
                "consulta": {"type": "string", "description": "Texto libre: modelo, marca o tipo de producto."},
                "categoria": {"type": "string", "description": "Categoría: placa de video, procesador, motherboard, "
                              "memoria ram, almacenamiento, fuente, gabinete, cooler, monitor, periferico, "
                              "auriculares, mousepad, parlantes, silla gamer, webcam, ups."},
                "precio_max": {"type": "number", "description": "Precio final máximo en pesos."},
                "precio_min": {"type": "number", "description": "Precio final mínimo en pesos."},
                "solo_con_stock": {"type": "boolean"},
                "limite": {"type": "integer", "description": "Cantidad de resultados (1 a 6)."},
            },
        },
    },
    "get_product": {
        "fn": get_product,
        "descripcion": "Ficha de un producto: precio, stock y especificaciones.",
        "parametros": {"type": "object", "properties": {
            "id_o_sku": {"type": "string", "description": "id, SKU (HT-0035) o nombre del producto."}},
            "required": ["id_o_sku"]},
    },
    "check_stock": {
        "fn": check_stock,
        "descripcion": "Stock disponible de un producto.",
        "parametros": {"type": "object", "properties": {
            "id_o_sku": {"type": "string", "description": "id, SKU o nombre del producto."}},
            "required": ["id_o_sku"]},
    },
    "check_compatibility": {
        "fn": check_compatibility,
        "descripcion": "Verifica la compatibilidad entre componentes con las reglas del armador de la tienda "
                       "(socket, DDR, ranuras, formato, largo de placa, cooler, potencia y conectores de fuente, BIOS).",
        "parametros": {"type": "object", "properties": {
            "productos": {"type": "array", "items": {"type": "string"},
                          "description": "ids, SKUs o nombres de 2 o más componentes."}},
            "required": ["productos"]},
    },
    "recommend_build": {
        "fn": recommend_build,
        "descripcion": "Arma una PC completa compatible con el stock actual dentro de un presupuesto.",
        "parametros": {"type": "object", "properties": {
            "presupuesto": {"type": "number", "description": "Presupuesto total en pesos."},
            "uso": {"type": "string", "enum": list(USOS)}},
            "required": ["presupuesto"]},
    },
    "get_shipping_estimate": {
        "fn": get_shipping_estimate,
        "descripcion": "Costo de envío según la regla del checkout. Sin items usa el carrito del cliente.",
        "parametros": {"type": "object", "properties": {
            "codigo_postal": {"type": "string"},
            "items": {"type": "array", "items": {"type": "object", "properties": {
                "id": {"type": "string"}, "cantidad": {"type": "integer"}}}}}},
    },
    "get_order_status": {
        "fn": get_order_status,
        "descripcion": "Estado de un pedido. Exige número de pedido y el email de la compra.",
        "parametros": {"type": "object", "properties": {
            "numero": {"type": "string"}, "email": {"type": "string"}},
            "required": ["numero", "email"]},
    },
    "get_store_policies": {
        "fn": get_store_policies,
        "descripcion": "Políticas de la tienda. Cada punto indica su fuente: checkout (firme), ley (firme) o "
                       "publicado (figura en el sitio, no prometer).",
        "parametros": {"type": "object", "properties": {
            "tema": {"type": "string", "enum": list(TEMAS)}}, "required": ["tema"]},
    },
    "escalate_to_human": {
        "fn": escalate_to_human,
        "descripcion": "Deriva la conversación a una persona del equipo (WhatsApp o email).",
        "parametros": {"type": "object", "properties": {
            "motivo": {"type": "string", "description": "Resumen breve del caso, sin datos personales."}},
            "required": ["motivo"]},
    },
}


def ejecutar(ctx: Contexto, nombre: str, args: Optional[dict]) -> dict:
    h = HERRAMIENTAS.get(nombre)
    if not h:
        return {"error": f"Herramienta desconocida: {nombre}"}
    permitidos = set(h["parametros"].get("properties", {}))
    limpios = {k: v for k, v in (args or {}).items() if k in permitidos}
    ctx.usadas.append(nombre)
    try:
        return h["fn"](ctx, **limpios)
    except ErrorDatos:
        return {"error": "El catálogo no responde en este momento."}
    except (TypeError, ValueError):
        return {"error": "Parámetros inválidos para la herramienta."}
