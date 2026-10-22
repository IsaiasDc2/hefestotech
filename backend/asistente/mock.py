"""HefestoTech · asistente · proveedor mock (sin clave, sin internet).

Funciona como un LLM más detrás de `LLMProvider`: en el primer turno decide
qué herramientas llamar a partir del mensaje (reglas determinísticas) y, con
los resultados, redacta la respuesta. Todos los datos de la respuesta salen
de esos resultados: el mock nunca escribe un precio, un stock ni un
veredicto que no haya devuelto una herramienta. Para ubicar qué productos
nombra el usuario lee los nombres del catálogo (eso es entender la pregunta,
no responderla).

Mismo mensaje + mismo catálogo ⇒ misma respuesta.
"""

from __future__ import annotations

import asyncio
import os
import re
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from . import datos
from .herramientas import categoria_en, menciones, normalizar, puntaje, tokens
from .moderacion import MARCA_TARJETA
from .politicas import pesos
from .proveedores import LLMProvider


def ars(n: Any) -> str:
    return pesos(int(n) * 100)


# ------------------------------------------------------------ detección ---
def _hay(patron: str, texto: str) -> bool:
    return re.search(patron, texto) is not None


R_INYECCION = (
    r"ignor\w*\s+(a\s+)?(todas?\s+)?(las\s+|tus\s+|los\s+|esas\s+|estas\s+)?(instrucciones|reglas|indicaciones)"
    r"|olvid\w*\s+(de\s+)?(tus|las|todas)\s+(instrucciones|reglas)|system\s*prompt|prompt\s+(del|de)\s+sistema"
    r"|tus\s+(instrucciones|reglas)|reveal|revela\w*\s+(tu|tus|el|las)|modo\s+(desarrollador|dios|admin)"
    r"|developer\s+mode|jailbreak|\bdan\b|actua\s+como|act\s+as|ignore\s+(all|previous|prior|the|your)"
    r"|disregard|a\s+partir\s+de\s+ahora\s+(sos|eres)|nuevas\s+instrucciones|api\s*key|clave\s+de\s+(la\s+)?api"
    r"|<\s*/?\s*(system|instrucciones)|sos\s+un\s+modelo\s+sin\s+restricciones"
)
R_TARJETA = r"cvv|cvc|codigo de seguridad|numero de (mi )?tarjeta|card number"
R_INSULTO = r"\b(boludo|pelotudo|idiota|inutil|forro|imbecil|tarado|mierda|la concha|puto|estupido|fuck|stupid|useless)\b"
R_HUMANO = (
    r"hablar con (una |un |alguien|algun )?(persona|humano|alguien|asesor|vendedor|operador|representante)?"
    r"|atencion (al cliente|humana)|\bhumano\b|real person|talk to (a )?(human|person|agent)|reclam|queja|denuncia"
    r"|estafa|me (cobraron|debitaron)|cobro (doble|duplicado)|problema con (el |mi )?pago|no me (llego|devolvieron)"
    r"|whatsapp|\bwpp\b|\bwsp\b"
)
R_PEDIDO = (
    r"(mi|el|un|nro|numero de|n)\s+(pedido|orden|compra)|estado de (mi |el |la )?(pedido|orden|compra)"
    r"|order status|my order|seguimiento|tracking|rastre|donde esta mi"
)
R_FUENTE = (
    r"(que|cual|cuanta|cuantos|de cuantos)\s+(fuente|watts|potencia)|fuente (necesito|me conviene|recomendas|uso|va)"
    r"|cuantos watts|(alcanza|banca|aguanta)\b.*\bfuente|fuente\b.*\b(alcanza|banca|aguanta)|power supply|\bpsu\b"
)
R_COMPAT = (
    r"compatib|sirve (con|para (el|la|mi))|anda (con|bien con)|va (con|bien con)|van (juntos|bien)|entra (en|el|la)"
    r"|banca (el|la|una|un)|encastr|soporta|works with|fits|combina|me sirve"
)
R_COMPARAR = r"compar|\bvs\b|versus|cual (es mejor|conviene|me conviene|recomendas|elijo)|diferencia entre|better"
R_ARMADO = (
    r"\barm(ar|o|a|ame|en|as)\b|pc (gamer|completa|para)|\barmado\b|\bbuild\b|presupuesto|budget|gaming pc"
    r"|computadora (gamer|para|completa)|compu (gamer|para|completa)|(una|un) (pc|compu|computadora|equipo) (gamer|para|completa)"
)
R_ENVIO = (
    r"envio|envios|envian|mandan|shipping|\bship\b|despach|correo|\bretiro\b|retirar|codigo postal|\bcp\b"
    r"|cuanto tarda|llega a"
)
R_PAGOS = r"\bpago|\bpagar|medios de pago|cuotas|tarjeta|transferencia|mercado ?pago|efectivo|debito|credito|payment|installments"
R_GARANTIA = r"garantia|warranty|falla de fabrica|defectuos"
R_CAMBIOS = r"\bcambio|cambiar (el|un|mi|la)|devol|devuelv|arrepent|reembols|\breturn"
R_CONTACTO = r"horario|contacto|telefono|mail de|email de|donde (estan|quedan)|direccion|\blocal\b|sucursal"
R_STOCK = r"\bstock\b|\bhay\b|tenes|tienen|disponib|quedan?\b|in stock|available"
R_PRECIO = r"precio|cuanto (sale|cuesta|esta|vale)|\bvalor\b|specs|especificacion|caracteristic|ficha|consumo|price|how much"
R_BUSQUEDA = r"busco|buscando|quiero|necesito|recomend|tenes alg|mostrame|opciones|looking for|\bneed\b|\bwant\b"
R_SALUDO = r"^(hola|buenas|buen dia|buenos dias|buenas tardes|buenas noches|hey|hi|hello|que tal)\b"
R_GRACIAS = r"\b(gracias|genial|perfecto|joya|buenisimo|thanks|thank you)\b"
R_DESPEDIDA = r"\b(chau|adios|bye|nos vemos|hasta luego)\b"
R_EMAIL = r"[a-z0-9._+\-]+@[a-z0-9\-]+(?:\.[a-z0-9\-]+)+"
R_NUMERO = r"(?:#|\bht-?)([0-9a-f]{8})\b|\b([0-9a-f]{8})(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b"
R_NUMERO_SUELTO = r"\b([0-9a-f]{8})\b"


def montos(n: str) -> list[tuple[float, bool, int]]:
    """(valor en pesos, tenía $ o un multiplicador, posición) de cada monto."""
    salida = []
    patron = (r"(\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d+)?)\s*"
              r"(millones|millon|palos?|lucas?|mil\b|m\b|k\b)?")
    for m in re.finditer(patron, n):
        signo, num, mult = m.group(1), m.group(2), m.group(3)
        if mult in ("millones", "millon", "palo", "palos", "m"):
            v = float(num.replace(".", "").replace(",", ".")) * 1e6 if "." in num and len(num.split(".")[-1]) == 3 \
                else float(num.replace(",", ".")) * 1e6
        elif mult in ("mil", "k", "luca", "lucas"):
            v = float(num.replace(",", ".")) * 1000
        elif re.fullmatch(r"\d{1,3}(?:\.\d{3})+", num):
            v = float(num.replace(".", ""))
        else:
            try:
                v = float(num.replace(",", "."))
            except ValueError:
                continue
        salida.append((v, bool(signo or mult), m.start()))
    return salida


def presupuesto(n: str) -> Optional[int]:
    validos = [v for v, _, _ in montos(n) if 50_000 <= v <= 100_000_000]
    return int(max(validos)) if validos else None


def precio_tope(n: str) -> Optional[int]:
    for v, marcado, pos in montos(n):
        previo = n[max(0, pos - 25):pos]
        if v >= 1000 and (marcado or _hay(r"hasta|menos de|maximo|max|no mas de|por debajo|under|below|tope|presupuesto|budget|de", previo)):
            if v >= 10_000 or marcado:
                return int(v)
    return None


def uso_en(n: str) -> Optional[str]:
    if _hay(r"stream|twitch|\bobs\b", n):
        return "streaming"
    if _hay(r"disen|edici|editar|render|\b3d\b|blender|premiere|autocad|program|design", n):
        return "diseno"
    if _hay(r"oficina|office|estudi|facultad|trabajo|navegar|\bword\b|excel|basic|tareas", n):
        return "oficina"
    if _hay(r"jug|gam|juego|\bfps\b|esport|valorant|fortnite|cs2|warzone|\bgta\b", n):
        return "gaming"
    return None


NOMBRES_CATEGORIA = {
    "placa de video": "placas de video", "procesador": "procesadores", "motherboard": "motherboards",
    "memoria ram": "memorias RAM", "almacenamiento": "almacenamiento", "fuente": "fuentes", "gabinete": "gabinetes",
    "cooler": "coolers", "monitor": "monitores", "periferico": "periféricos", "auriculares": "auriculares",
    "mousepad": "mouse pads", "parlantes": "parlantes", "silla gamer": "sillas gamer", "webcam": "webcams", "ups": "UPS",
}


def mejor_por_nombre(texto: str, productos: list[dict]) -> Optional[dict]:
    """Producto nombrado sin número de modelo ("el mouse Razer DeathAdder"):
    solo si un producto se despega claramente del resto."""
    ts = tokens(texto)
    puntajes = sorted(((puntaje(ts, p), p) for p in productos), key=lambda x: -x[0])
    if not puntajes or puntajes[0][0] < 4:
        return None
    if len(puntajes) > 1 and puntajes[1][0] >= puntajes[0][0] - 1:
        return None
    return puntajes[0][1]


def numero_y_email(textos: list[str], suelto: bool) -> tuple[Optional[str], Optional[str]]:
    numero = email = None
    for t in textos:
        n = t.lower()
        if email is None:
            m = re.search(R_EMAIL, n)
            if m:
                email = m.group(0)
        if numero is None:
            sin_mail = re.sub(R_EMAIL, " ", n)
            m = re.search(R_NUMERO, sin_mail)
            if m:
                numero = m.group(1) or m.group(2)
            elif suelto:
                m = re.search(R_NUMERO_SUELTO, sin_mail)
                if m and re.search(r"\d.*\d", m.group(1)):
                    numero = m.group(1)
    return numero, email


def modelos_sin_resolver(texto: str, productos: list[dict]) -> list[str]:
    """Modelos que el usuario nombra y no existen en el catálogo (RTX 5090)."""
    ts = tokens(texto)
    nombres = {t for p in productos for t in tokens(p["nombre"])}
    faltan = []
    prefijos = {"rtx", "gtx", "rx", "ryzen", "core", "i3", "i5", "i7", "i9", "radeon", "geforce", "arc"}
    for i, t in enumerate(ts):
        modelo = re.fullmatch(r"[a-z]{1,3}\d{3,4}[a-z0-9]*", t) or (
            re.fullmatch(r"\d{4}[a-z0-9]*", t) and i > 0 and ts[i - 1] in prefijos)
        if not modelo or t in nombres or any(n.startswith(t) for n in nombres if len(t) >= 4):
            continue
        faltan.append(f"{ts[i - 1].upper()} {t.upper()}" if i > 0 and ts[i - 1] in prefijos else t.upper())
    return faltan[:2]


# --------------------------------------------------------------- plan ---
@dataclass
class Plan:
    intencion: str
    llamadas: list[tuple[str, dict]] = field(default_factory=list)
    datos: dict = field(default_factory=dict)
    # Segunda ronda de herramientas a partir de los resultados de la primera.
    ronda2: Optional[Callable[[list[tuple[str, dict]]], list[tuple[str, dict]]]] = None


def _detectar(n: str, crudo: str) -> str:
    if MARCA_TARJETA in crudo or _hay(R_TARJETA, n):
        return "tarjeta"
    if _hay(R_INYECCION, n):
        return "inyeccion"
    if _hay(R_INSULTO, n):
        return "insulto"
    if _hay(R_HUMANO, n):
        return "humano"
    if _hay(R_PEDIDO, n) or re.search(R_NUMERO, crudo.lower()):
        return "pedido"
    if _hay(R_FUENTE, n):
        return "fuente"
    if _hay(R_COMPAT, n):
        return "compatibilidad"
    if _hay(R_ARMADO, n):
        return "armado"
    if _hay(R_ENVIO, n):
        return "envio"
    if _hay(R_GARANTIA, n):
        return "garantia"
    if _hay(R_CAMBIOS, n):
        return "cambios"
    if _hay(R_PAGOS, n):
        return "pagos"
    if _hay(R_CONTACTO, n):
        return "contacto"
    if _hay(R_COMPARAR, n):
        return "comparar"
    if _hay(R_STOCK, n):
        return "stock"
    if _hay(R_PRECIO, n):
        return "precio"
    if _hay(R_BUSQUEDA, n) or categoria_en(n):
        return "busqueda"
    if _hay(R_SALUDO, n) and len(tokens(n)) <= 6:
        return "saludo"
    if _hay(R_DESPEDIDA, n):
        return "despedida"
    if _hay(R_GRACIAS, n) and len(tokens(n)) <= 8:
        return "gracias"
    if re.search(R_EMAIL, n) or presupuesto(n) or re.search(R_NUMERO_SUELTO, n):
        return "dato"
    return "fuera_de_tema"


_HEREDABLES = {"armado", "pedido", "compatibilidad", "fuente", "envio"}


def planificar(texto: str, previos: list[str]) -> Plan:
    n = normalizar(texto)
    productos = datos.fuente().productos()
    intencion = _detectar(n, texto)
    mencionados = menciones(texto, productos)

    if intencion in ("dato", "precio", "stock", "busqueda", "fuera_de_tema") and previos:
        anterior = _detectar(normalizar(previos[-1]), previos[-1])
        # "¿y con la B650?" / "con un i7 14700K": completa la pregunta anterior.
        sigue_compat = anterior in ("compatibilidad", "fuente") and mencionados and intencion == "fuera_de_tema"
        if anterior in _HEREDABLES and (intencion == "dato" or sigue_compat):
            intencion = anterior

    if intencion == "pedido":
        numero, email = numero_y_email([texto] + previos[::-1][:3], suelto=True)
        if numero and email:
            return Plan("pedido", [("get_order_status", {"numero": numero, "email": email})])
        return Plan("pedido_faltan", datos={"numero": numero, "email": email})

    if intencion == "tarjeta":
        return Plan("tarjeta")
    if intencion == "inyeccion":
        return Plan("inyeccion")
    if intencion == "insulto":
        return Plan("insulto", [("escalate_to_human", {"motivo": "Cliente molesto, pide atención"})])
    if intencion == "humano":
        motivo = "Reclamo o problema con un pago" if _hay(r"reclam|queja|cobr|pago|estafa|denuncia", n) \
            else "El cliente pide hablar con una persona"
        return Plan("humano", [("escalate_to_human", {"motivo": motivo})], {"reclamo": "Reclamo" in motivo})

    if len(mencionados) >= 2 and intencion in ("stock", "precio", "busqueda", "comparar", "fuera_de_tema"):
        cats = {normalizar(p["categoria"]) for p in mencionados}
        intencion = "comparar" if len(cats) == 1 or intencion == "comparar" else "compatibilidad"

    if intencion == "fuente":
        refs = list(mencionados)
        for previo in previos[::-1][:3]:
            # De mensajes anteriores solo se completa lo que falta (CPU o placa):
            # la fuente es lo que se pregunta.
            tiene = {normalizar(p["categoria"]) for p in refs}
            refs += [p for p in menciones(previo, productos) if p["id"] not in {r["id"] for r in refs}
                     and normalizar(p["categoria"]) in ({"procesador", "placa de video"} - tiene)]
        if any(normalizar(p["categoria"]) == "fuente" for p in refs) and len(refs) >= 2:
            intencion = "compatibilidad"
        else:
            base = [p["id"] for p in refs if normalizar(p["categoria"]) in ("procesador", "placa de video")][:2]
            if not base:
                return Plan("fuente_faltan")
            if not any(normalizar(p["categoria"]) == "procesador" for p in refs):
                # Sin procesador no hay consumo total: solo el mínimo de la placa.
                return Plan("fuente_falta_cpu", [("get_product", {"id_o_sku": base[0]})])

            def verificar(resultados: list[tuple[str, dict]]) -> list[tuple[str, dict]]:
                fuentes = next((r for n_, r in resultados if n_ == "search_products"), {}).get("productos", [])
                return [("check_compatibility", {"productos": base + [f["id"]]}) for f in fuentes]

            return Plan("fuente", [("search_products", {"categoria": "fuente", "solo_con_stock": True, "limite": 6})],
                        {"base": base}, ronda2=verificar)

    if intencion == "compatibilidad":
        refs = list(mencionados)
        for previo in previos[::-1][:3] if len(refs) < 2 else []:
            if len(refs) >= 4:
                break
            for p in menciones(previo, productos):
                if p["id"] not in {r["id"] for r in refs}:
                    refs.append(p)
        if len(refs) < 2:
            return Plan("compat_faltan", datos={"uno": refs[0]["nombre"] if refs else None})
        return Plan("compatibilidad", [("check_compatibility", {"productos": [p["id"] for p in refs[:4]]})])

    if intencion == "comparar":
        if len(mencionados) < 2:
            return Plan("comparar_faltan")
        return Plan("comparar", [("get_product", {"id_o_sku": p["id"]}) for p in mencionados[:3]])

    if intencion == "armado":
        recientes = [texto] + previos[::-1][:4]
        tope = next((presupuesto(normalizar(t)) for t in recientes if presupuesto(normalizar(t))), None)
        uso = next((uso_en(normalizar(t)) for t in recientes if uso_en(normalizar(t))), None)
        if not tope:
            return Plan("armado_faltan", datos={"uso": uso})
        return Plan("armado", [("recommend_build", {"presupuesto": tope, "uso": uso or "gaming"})],
                    {"uso_supuesto": uso is None})

    if intencion == "envio":
        if not mencionados:
            unico = mejor_por_nombre(texto, productos)
            mencionados = [unico] if unico else []
        cp = re.search(r"\b([a-z]?\d{4}[a-z]{0,3})\b", n)
        cp_valido = cp.group(1) if cp and not any(cp.group(1) in tokens(p["nombre"]) for p in productos) else ""
        items = [{"id": p["id"], "cantidad": 1} for p in mencionados]
        args: dict[str, Any] = {"codigo_postal": cp_valido}
        if items:
            args["items"] = items
        llamadas = [("get_shipping_estimate", args), ("get_store_policies", {"tema": "envios"})]
        if len(mencionados) == 1:
            llamadas.insert(0, ("get_product", {"id_o_sku": mencionados[0]["id"]}))
        return Plan("envio", llamadas)

    if intencion in ("garantia", "cambios", "pagos", "contacto"):
        return Plan("politica", [("get_store_policies", {"tema": intencion})], {"tema": intencion})

    if intencion in ("stock", "precio"):
        # Cada pregunta del mensaje puede nombrar un producto distinto
        # ("¿hay stock del DeathAdder? y ¿cuánto sale la 4070?").
        for fragmento in re.split(r"[?¿;.!]|\by\b", texto):
            if fragmento.strip() and not menciones(fragmento, productos):
                unico = mejor_por_nombre(fragmento, productos)
                if unico and unico["id"] not in {p["id"] for p in mencionados}:
                    mencionados.append(unico)

    if intencion in ("stock", "precio", "busqueda") or mencionados:
        faltan = modelos_sin_resolver(texto, productos)
        if mencionados and not faltan:
            if intencion == "stock":
                return Plan("stock", [("check_stock", {"id_o_sku": p["id"]}) for p in mencionados[:3]])
            return Plan("producto", [("get_product", {"id_o_sku": p["id"]}) for p in mencionados[:3]])
        cat = categoria_en(n)
        if cat or faltan or intencion == "busqueda":
            args = {"consulta": "" if faltan else texto[:200], "solo_con_stock": False, "limite": 3}
            if cat:
                args["categoria"] = cat
            tope = precio_tope(n)
            if tope:
                args["precio_max"] = tope
            return Plan("busqueda", [("search_products", args)], {"faltan": faltan, "tope": tope, "cat": cat})

    if intencion in ("saludo", "gracias", "despedida"):
        return Plan(intencion)
    return Plan("fuera_de_tema")


# ------------------------------------------------------------ redacción ---
def _lista(items: list[str]) -> str:
    return "\n".join(f"- {i}" for i in items)


def _linea_producto(p: dict, con_stock: bool = True) -> str:
    if p.get("precio_final_ars") is None:
        precio = "precio a confirmar"
    else:
        precio = ars(p["precio_final_ars"])
        if p.get("precio_lista_ars"):
            precio += f" (antes {ars(p['precio_lista_ars'])})"
    partes = [f"**{p['nombre']}** — {precio}"]
    if con_stock:
        partes.append(f"{p['stock']} en stock" if p["stock"] > 0 else "sin stock")
    if p.get("envio_gratis"):
        partes.append("envío gratis")
    return " · ".join(partes)


def _humanizar(clave: str) -> str:
    return re.sub(r"(?<!^)([A-Z])", r" \1", clave).lower()


def _valor(v: Any) -> str:
    if isinstance(v, bool):
        return "sí" if v else "no"
    if isinstance(v, list):
        return ", ".join(str(x) for x in v)
    return str(v)


def _specs(p: dict, claves: Optional[list[str]] = None, maximo: int = 4) -> str:
    esp = p.get("especificaciones") or {}
    claves = claves or list(esp)[:maximo]
    return "; ".join(f"{_humanizar(k)}: {_valor(esp[k])}" for k in claves[:maximo] if k in esp)


def _error(r: dict) -> Optional[str]:
    return r.get("error") if isinstance(r, dict) else None


def redactar(plan: Plan, resultados: list[tuple[str, dict]]) -> str:
    r = resultados[0][1] if resultados else {}
    i = plan.intencion

    if i == "saludo":
        return "¡Hola! Soy Hefesto, el asistente de HefestoTech. ¿Qué estás buscando: armar una PC, un componente puntual o el estado de un pedido?"
    if i == "gracias":
        return "¡De nada! Si necesitás algo más, acá estoy."
    if i == "despedida":
        return "¡Gracias por escribir! Cuando quieras seguimos."
    if i == "fuera_de_tema":
        return ("Eso se me escapa: solo puedo ayudarte con lo de HefestoTech (productos, armado de PC, "
                "compatibilidad, envíos, pagos y pedidos). ¿Buscás algo de eso?")
    if i == "inyeccion":
        return ("No puedo cambiar mis reglas ni compartir mis instrucciones internas. "
                "Sí te ayudo con productos, compatibilidad, envíos o tu pedido: ¿qué necesitás?")
    if i == "tarjeta":
        return ("Por seguridad no compartas datos de tarjeta por chat: los saqué de la conversación y no se enviaron. "
                "El pago se hace solo dentro de Mercado Pago, al finalizar la compra. ¿Te ayudo con algo más?")
    if i == "insulto":
        return ("Entiendo que puede ser frustrante. Contame qué pasó y lo resolvemos, o si preferís te atiende "
                "una persona del equipo por WhatsApp (tenés el botón acá abajo).")
    if i == "humano":
        pre = "Lamento el problema. " if plan.datos.get("reclamo") else ""
        contacto = " ".join(r.get("contacto", []))
        email = re.search(R_EMAIL, contacto)
        horario = next((c for c in r.get("contacto", []) if c.lower().startswith("horario")), "")
        extra = f" También podés escribir a {email.group(0)}." if email else ""
        if horario:
            extra += f" {horario}"
        return f"{pre}Te paso con una persona del equipo: tocá el botón de WhatsApp y la consulta va precargada.{extra}"

    if i == "pedido_faltan":
        numero, email = plan.datos.get("numero"), plan.datos.get("email")
        if numero and not email:
            return f"Tengo el pedido **#{numero}**. Para mostrarte el estado necesito también el email con el que hiciste la compra."
        if email and not numero:
            return ("Necesito también el número de pedido: son los 8 caracteres que ves en Mi cuenta o en la "
                    "confirmación de pago (por ejemplo #3f9a1c2b).")
        return ("Pasame el número de pedido (los 8 caracteres que ves en Mi cuenta o en la confirmación, "
                "por ejemplo #3f9a1c2b) y el email con el que compraste, y te digo cómo viene.")
    if i == "pedido":
        if _error(r):
            return f"{r['error'].rstrip('.')}. Si querés, te paso con una persona del equipo."
        if not r.get("encontrado"):
            return ("No encontré un pedido con ese número y ese email. Revisá que sean los de la compra; "
                    "si sigue sin aparecer, te paso con una persona del equipo.")
        fecha = "/".join(reversed(r["fecha"].split("-"))) if r.get("fecha") else ""
        texto = f"Tu pedido **{r['numero']}**{' del ' + fecha if fecha else ''} está **{r['estado']}**."
        if r.get("demo"):
            texto += " (Es un pedido de demostración.)"
        items = [f"{x['cantidad']} × {x['nombre']}" for x in r.get("items", [])]
        if items:
            texto += "\n" + _lista(items)
        texto += f"\nTotal: **{ars(r['total_ars'])}**."
        seg = r.get("seguimiento")
        if seg and (seg.get("codigo") or seg.get("operador")):
            texto += f"\nSeguimiento: {seg.get('operador') or 'operador'} · código {seg.get('codigo') or '—'} ({seg.get('estado')})."
        return texto

    if i == "compat_faltan":
        if plan.datos.get("uno"):
            return (f"Tengo **{plan.datos['uno']}**. ¿Con qué otro componente lo querés combinar? "
                    "Decime el modelo (mother, RAM, fuente, gabinete…) y lo verifico.")
        return ("Decime qué componentes querés combinar (por ejemplo «Ryzen 5 7600 con la B650») y lo verifico "
                "con las reglas del armador.")
    if i == "compatibilidad":
        if _error(r):
            return f"No pude verificarlo ahora: {r['error']}"
        if not r.get("evaluado"):
            extra = f" No encontré en el catálogo: {', '.join(r['no_encontrados'])}." if r.get("no_encontrados") else ""
            return f"{r.get('nota', '')}{extra} ¿Qué componentes querés combinar?"
        nombres = " + ".join(f"**{c['nombre']}**" for c in r["componentes"])
        errores = [x["mensaje"] for x in r["resultados"] if x["estado"] == "error"]
        avisos = [x["mensaje"] for x in r["resultados"] if x["estado"] == "warn"]
        pendientes = [x["mensaje"] for x in r["resultados"] if x["estado"] == "unknown"]
        oks = [x["mensaje"] for x in r["resultados"] if x["estado"] == "ok"]
        if r["veredicto"] == "incompatible":
            return f"No, {nombres} no van juntos:\n{_lista(errores[:3])}\n¿Querés que te busque una alternativa compatible?"
        if r["veredicto"] == "con_pendientes":
            return (f"Entre {nombres} no encontré choques, pero no lo puedo confirmar del todo:\n"
                    f"{_lista((pendientes + avisos)[:3])}")
        texto = f"Sí, {nombres} son compatibles:\n{_lista(oks[:3])}"
        if avisos:
            texto += f"\nOjo: {avisos[0]}"
        return texto

    if i == "fuente_faltan":
        return ("Para recomendarte una fuente necesito la placa de video y el procesador que vas a usar. "
                "¿Cuáles son? (por ejemplo «RTX 4070 SUPER con Ryzen 5 7600»)")
    if i == "fuente_falta_cpu":
        if not r.get("encontrado"):
            return "No encontré esa placa en el catálogo. ¿Me pasás el modelo exacto y el procesador?"
        minimo = (r.get("specs_verificadas_compatibilidad") or {}).get("fuenteRecomendadaW")
        texto = (f"Según su ficha, **{r['nombre']}** pide una fuente de al menos **{minimo}W**. " if minimo
                 else f"No tengo cargado el mínimo de fuente de **{r['nombre']}**. ")
        return texto + "Para estimar el consumo total y decirte qué fuente en stock alcanza necesito el procesador: ¿cuál vas a usar?"
    if i == "fuente":
        checks =[x for n_, x in resultados if n_ == "check_compatibility" and x.get("evaluado")]
        if not checks:
            return "No encontré fuentes en stock para verificar. ¿Querés que te pase con el equipo?"
        primero = checks[0]
        base = " + ".join(f"**{c['nombre']}**" for c in primero["componentes"] if c["tipo"] != "fuente")
        datos_consumo = []
        if primero.get("consumo_estimado_con_margen_w"):
            datos_consumo.append(f"estimamos ~{primero['consumo_estimado_con_margen_w']}W con margen del 30%")
        if primero.get("fuente_recomendada_por_la_placa_w"):
            datos_consumo.append(f"la placa pide como mínimo {primero['fuente_recomendada_por_la_placa_w']}W")
        texto = f"Para {base} {'; '.join(datos_consumo)}." if datos_consumo else f"Para {base}:"
        aptas, cortas = [], []
        for x in checks:
            fuente = next(c["nombre"] for c in x["componentes"] if c["tipo"] == "fuente")
            regla = next((y for y in x["resultados"] if y["regla"] == "fuente_potencia"), None)
            fallas = [y for y in x["resultados"] if y["estado"] == "error" and y["regla"].startswith("fuente")]
            if fallas:
                cortas.append((fuente, regla))
            elif regla and regla["estado"] in ("ok", "warn"):
                aptas.append((fuente, regla))
        if aptas:
            texto += "\nDe las que hay en stock, te sirven:\n" + _lista(
                [f"**{f}** — {r['mensaje'] if r else 'potencia sin verificar'}" for f, r in aptas[:3]])
        else:
            texto += "\nNinguna fuente en stock alcanza para esa combinación."
        if cortas:
            texto += f"\nNo te alcanzan: {', '.join(f for f, _ in cortas[:3])}."
        return texto
    if i == "comparar_faltan":
        return "¿Qué productos querés comparar? Pasame los dos modelos (por ejemplo «RTX 4070 SUPER vs RX 7800 XT»)."
    if i == "comparar":
        fichas = [x for _, x in resultados if x.get("encontrado")]
        if len(fichas) < 2:
            return "No encontré los dos productos en el catálogo para compararlos. ¿Me pasás los modelos exactos?"
        comunes = [k for k in (fichas[0].get("especificaciones") or {}) if all(k in (f.get("especificaciones") or {}) for f in fichas)]
        lineas = []
        for f in fichas:
            linea = _linea_producto(f)
            detalle = _specs(f, comunes, 3)
            lineas.append(f"{linea}{' · ' + detalle if detalle else ''}")
        con_precio = [f for f in fichas if f.get("precio_final_ars") is not None]
        texto = "Te los dejo lado a lado:\n" + _lista(lineas)
        if len(con_precio) >= 2:
            barato = min(con_precio, key=lambda f: f["precio_final_ars"])
            caro = max(con_precio, key=lambda f: f["precio_final_ars"])
            if barato is not caro:
                texto += f"\n**{barato['nombre']}** sale {ars(caro['precio_final_ars'] - barato['precio_final_ars'])} menos."
        return texto + "\n¿Para qué lo vas a usar? Así te digo cuál conviene."

    if i == "armado_faltan":
        if plan.datos.get("uso"):
            return "Dale. ¿Cuánto querés invertir en pesos? Con eso te armo una PC compatible con lo que hay en stock."
        return "Dale, te ayudo. ¿Para qué la vas a usar (juegos, oficina, diseño) y cuánto querés invertir en pesos?"
    if i == "armado":
        if _error(r):
            return f"No pude armarla: {r['error']}"
        usos = {"gaming": "gaming", "oficina": "uso general/oficina", "diseno": "diseño y edición", "streaming": "streaming"}
        lineas = [f"{c['tipo'][:1].upper()}{c['tipo'][1:]}: {_linea_producto(c, con_stock=False)}" for c in r["componentes"]]
        if r["dentro_del_presupuesto"]:
            texto = (f"Con {ars(r['presupuesto_ars'])} para {usos[r['uso']]} te armo esto, total **{ars(r['total_ars'])}**"
                     f"{' (te sobran ' + ars(r['sobrante_ars']) + ')' if r.get('sobrante_ars') else ''}:\n")
        else:
            texto = (f"Con {ars(r['presupuesto_ars'])} no llego a una PC de {usos[r['uso']]} compatible con el stock de hoy. "
                     f"La más económica que puedo armar sale **{ars(r['total_ars'])}**:\n")
        texto += _lista(lineas)
        avisos = r["compatibilidad"]["avisos"]
        if avisos:
            texto += (f"\nPasa las reglas del armador, pero {len(avisos)} punto(s) no se pueden verificar por falta "
                      f"de datos. Por ejemplo: {avisos[0]}")
        else:
            texto += "\nPasa todas las reglas de compatibilidad del armador."
        if plan.datos.get("uso_supuesto"):
            texto += "\nLa pensé para gaming; si es para otra cosa, decime y la ajusto."
        elif not r["dentro_del_presupuesto"] and r["uso"] != "oficina":
            texto += "\nSi el presupuesto es fijo, puedo armarte una de uso general sin placa de video."
        return texto

    if i == "envio":
        por_nombre = dict(resultados)
        est = por_nombre.get("get_shipping_estimate", {})
        est = est if not _error(est) else {}
        pol = por_nombre.get("get_store_policies", {})
        ficha = por_nombre.get("get_product", {})
        opciones = {o["metodo"]: o["costo_ars"] for o in est.get("opciones", [])}
        previo = ""
        if ficha.get("encontrado"):
            previo = (f"**{ficha['nombre']}** sale **{ars(ficha['precio_final_ars'])}**. "
                      if ficha.get("precio_final_ars") is not None else f"El precio de **{ficha['nombre']}** está a confirmar. ")
        if est.get("subtotal_ars") and est.get("items"):
            if all(v == 0 for v in opciones.values()):
                texto = f"Con {ars(est['subtotal_ars'])} de compra el envío te sale **gratis**"
            else:
                texto = (f"Para {ars(est['subtotal_ars'])} de compra el envío sale **{ars(opciones.get('estándar', 0))}** "
                         f"(estándar) o **{ars(opciones.get('express', 0))}** (express)")
            texto += f"{' a ' + est['codigo_postal'] if est.get('codigo_postal') else ''}."
        else:
            texto = (f"El envío tiene tarifa única para todo el país: estándar **{ars(opciones.get('estándar', 0))}** o "
                     f"express **{ars(opciones.get('express', 0))}**, y es **gratis desde "
                     f"{ars(est.get('envio_gratis_desde_ars', 0))}** de compra.")
        texto = previo + texto
        publicados = [p["texto"] for p in pol.get("puntos", []) if p["fuente"] == "publicado"]
        if publicados:
            texto += f"\nEn el sitio figura: {' '.join(publicados)}"
        texto += "\nNo tengo un plazo de entrega confirmado; si lo necesitás, te paso con el equipo."
        return texto

    if i == "politica":
        if _error(r) or not r.get("puntos"):
            return "No tengo una política publicada sobre eso. Si querés, te paso con una persona del equipo."
        firmes = [p["texto"] for p in r["puntos"] if p["fuente"] in ("checkout", "ley", "sitio")]
        publicados = [p["texto"] for p in r["puntos"] if p["fuente"] == "publicado"]
        sin_dato = [p["texto"] for p in r["puntos"] if p["fuente"] == "nota"]
        texto = f"**{r['titulo']}**:\n" + _lista(firmes + [f"En el sitio figura: {t}" for t in publicados])
        if sin_dato:
            texto += "\n" + " ".join(sin_dato).replace(": derivar a una persona", "; si lo necesitás, te paso con el equipo")
        elif plan.datos.get("tema") in ("garantia", "cambios"):
            texto += "\nPara un caso puntual te conviene hablar con el equipo: ¿te paso el WhatsApp?"
        return texto

    if i in ("stock", "producto") and len(resultados) > 1:
        return "\n".join(redactar(Plan(i), [x]) for x in resultados)
    if i == "stock":
        if not r.get("encontrado"):
            return "No encontré ese producto en el catálogo. ¿Me pasás el modelo exacto?"
        if r["disponible"]:
            return f"Sí, de **{r['nombre']}** hay **{r['stock']}** en stock."
        return f"Hoy **{r['nombre']}** está sin stock. ¿Querés que te busque una alternativa?"
    if i == "producto":
        if not r.get("encontrado"):
            return "No encontré ese producto en el catálogo. ¿Me pasás el modelo exacto?"
        if r.get("precio_final_ars") is None:
            texto = f"El precio de **{r['nombre']}** está a confirmar; escribinos por WhatsApp y te lo pasamos."
        else:
            texto = f"**{r['nombre']}** sale **{ars(r['precio_final_ars'])}** (precio final"
            texto += f", antes {ars(r['precio_lista_ars'])})." if r.get("precio_lista_ars") else ")."
        texto += f" {'Hay ' + str(r['stock']) + ' en stock.' if r['stock'] > 0 else 'Hoy está sin stock.'}"
        detalle = _specs(r)
        if detalle:
            texto += f"\nFicha: {detalle}."
        return texto

    if i == "busqueda":
        if _error(r):
            return f"No pude buscar en el catálogo ahora: {r['error']}"
        prods = r.get("productos", [])
        faltan = plan.datos.get("faltan") or []
        cat = plan.datos.get("cat")
        tope = plan.datos.get("tope")
        pre = f"No tenemos **{faltan[0]}** en el catálogo. " if faltan else ""
        if not prods:
            filtro = f" hasta {ars(tope)}" if tope else ""
            return (f"{pre}No encontré {NOMBRES_CATEGORIA.get(cat, cat) if cat else 'productos'}{filtro} en el catálogo. "
                    "¿Querés que amplíe la búsqueda?")
        titulo = f"Estas son las opciones de {NOMBRES_CATEGORIA.get(cat, cat)}" if cat else "Encontré esto"
        if tope:
            titulo += f" hasta {ars(tope)}"
        texto = f"{pre}{titulo}:\n{_lista([_linea_producto(p) for p in prods])}"
        if r.get("total_encontrados", 0) > len(prods):
            texto += f"\nHay {r['total_encontrados'] - len(prods)} más en el catálogo."
        return texto + "\n¿Querés que compare alguna o que verifique compatibilidad con lo que ya tenés?"

    return "No pude resolver eso. ¿Me lo contás de otra forma?"


# ------------------------------------------------------------ proveedor ---
class MockProvider(LLMProvider):
    nombre = "mock"
    es_mock = True

    def __init__(self, demora_ms: Optional[float] = None):
        valor = os.getenv("ASISTENTE_MOCK_DEMORA_MS", "12") if demora_ms is None else demora_ms
        self.demora = max(0.0, float(valor)) / 1000

    async def turno(self, sistema, mensajes, herramientas, max_tokens):
        ultimo = max(i for i, m in enumerate(mensajes) if m["rol"] == "usuario")
        texto = mensajes[ultimo]["texto"]
        previos = [m["texto"] for m in mensajes[:ultimo] if m["rol"] == "usuario"]
        resultados = [(m["nombre"], m["resultado"]) for m in mensajes[ultimo + 1:] if m["rol"] == "herramienta"]
        rondas = sum(1 for m in mensajes[ultimo + 1:] if m["rol"] == "asistente" and m.get("llamadas"))
        plan = planificar(texto, previos)
        pendientes = plan.llamadas if rondas == 0 else (plan.ronda2(resultados) if rondas == 1 and plan.ronda2 else [])
        if pendientes and herramientas:
            yield {"tipo": "llamadas", "nativo": None, "llamadas": [
                {"id": f"mock-{rondas}-{k}", "nombre": nombre, "args": args} for k, (nombre, args) in enumerate(pendientes)]}
            return
        respuesta = redactar(plan, resultados)
        for trozo in re.findall(r"\S+\s*", respuesta):
            yield {"tipo": "texto", "delta": trozo}
            if self.demora:
                await asyncio.sleep(self.demora)
