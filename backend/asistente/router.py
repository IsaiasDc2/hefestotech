"""HefestoTech · asistente · endpoints HTTP.

POST /api/chat           → text/event-stream (SSE). Eventos:
    inicio      {id, modo}                 modo = proveedor activo ("mock" = demo sin IA)
    herramienta {nombre}                   el asistente está consultando datos
    texto       {delta}                    streaming de la respuesta
    armado      {productos, total, ...}    PC recomendada (agregar todo al carrito)
    productos   {productos}                tarjetas con datos de la base
    derivacion  {motivo}                   mostrar el botón de WhatsApp
    error       {tipo, mensaje}            tipo: proveedor | interrumpido | interno
    fin         {}
POST /api/chat/feedback  → 204 (👍/👎 por mensaje, sin texto de la conversación)

Errores antes de abrir el stream (validación 422, rate limit 429) vuelven
como JSON normal para que el front los distinga.
"""

from __future__ import annotations

import json
import os
import re
import time
import uuid
from collections import defaultdict, deque
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator

from . import datos
from .agente import ProveedorCaido, responder
from .herramientas import Contexto
from .moderacion import huella, limpiar_tarjetas
from .proveedores import LLMProvider, ProveedorNoConfigurado, configuracion, crear_proveedor

router = APIRouter()

MAX_USUARIO = 2000
MAX_ASISTENTE = 4000
VENTANA_MENSAJES = 12
VENTANA_CHARS = 9000

_VENTANA_SEG = 60
_registro: dict[str, deque] = defaultdict(deque)


def _limite_ip() -> int:
    return max(1, int(os.getenv("ASSISTANT_RATE_LIMIT_PER_MIN") or 20))


def _limite_sesion() -> int:
    return max(1, int(os.getenv("ASSISTANT_RATE_LIMIT_SESSION_PER_MIN") or max(5, _limite_ip() // 2)))


def _limitar(clave: str, maximo: int) -> None:
    ahora = time.monotonic()
    cola = _registro[clave]
    while cola and ahora - cola[0] > _VENTANA_SEG:
        cola.popleft()
    if len(cola) >= maximo:
        raise HTTPException(status_code=429,
                            detail="Demasiadas consultas seguidas. Esperá un minuto e intentá de nuevo.")
    cola.append(ahora)


def _ip(request: Request) -> str:
    return request.client.host if request.client else "desconocida"


# ------------------------------------------------------------- modelos ---
class Mensaje(BaseModel):
    rol: Literal["usuario", "asistente"]
    texto: str = Field(max_length=MAX_ASISTENTE)


class ItemCarrito(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    cantidad: int = Field(default=1, ge=1, le=100)


class PedidoChat(BaseModel):
    mensajes: list[Mensaje] = Field(min_length=1, max_length=40)
    sesion: str = Field(default="", max_length=64)
    carrito: list[ItemCarrito] = Field(default_factory=list, max_length=50)

    @field_validator("sesion")
    @classmethod
    def _sesion(cls, v: str) -> str:
        if v and not re.fullmatch(r"[A-Za-z0-9-]{8,64}", v):
            raise ValueError("Sesión inválida.")
        return v

    @field_validator("mensajes")
    @classmethod
    def _ultimo(cls, v: list[Mensaje]) -> list[Mensaje]:
        ultimo = v[-1]
        if ultimo.rol != "usuario":
            raise ValueError("El último mensaje tiene que ser del usuario.")
        texto = ultimo.texto.strip()
        if not texto:
            raise ValueError("El mensaje no puede estar vacío.")
        if len(texto) > MAX_USUARIO:
            raise ValueError(f"El mensaje es demasiado largo (máximo {MAX_USUARIO} caracteres).")
        return v


class Feedback(BaseModel):
    sesion: str = Field(default="", max_length=64)
    mensaje_id: str = Field(min_length=1, max_length=64)
    valor: Literal["positivo", "negativo"]


# ------------------------------------------------------------ historial ---
def preparar_historial(mensajes: list[Mensaje]) -> list[dict]:
    """Ventana de los últimos mensajes. Lo que queda afuera se resume en una
    línea (solo lo que dijo el usuario) para no perder el hilo."""
    limpios = []
    for m in mensajes:
        texto, _ = limpiar_tarjetas(m.texto.strip())
        if texto:
            limpios.append({"rol": m.rol, "texto": texto[:MAX_USUARIO if m.rol == "usuario" else MAX_ASISTENTE]})
    ventana, total = [], 0
    for m in reversed(limpios):
        if len(ventana) >= VENTANA_MENSAJES or (ventana and total + len(m["texto"]) > VENTANA_CHARS):
            break
        ventana.insert(0, m)
        total += len(m["texto"])
    descartados = limpios[: len(limpios) - len(ventana)]
    if descartados:
        dichos = [m["texto"][:80] for m in descartados if m["rol"] == "usuario"][-5:]
        if dichos:
            ventana.insert(0, {"rol": "usuario",
                               "texto": "[Resumen de mensajes anteriores del cliente, solo como contexto] "
                                        + " | ".join(dichos)})
            if len(ventana) > 1 and ventana[1]["rol"] == "usuario":
                ventana.insert(1, {"rol": "asistente", "texto": "Entendido."})
    while ventana and ventana[0]["rol"] == "asistente":
        ventana.pop(0)
    return ventana


# ------------------------------------------------------------ proveedor ---
_proveedor: Optional[LLMProvider] = None


def proveedor() -> LLMProvider:
    global _proveedor
    if _proveedor is None:
        _proveedor = crear_proveedor()
    return _proveedor


def usar_proveedor(p: Optional[LLMProvider]) -> None:
    """Para tests: fija (o resetea con None) el proveedor."""
    global _proveedor
    _proveedor = p


def _sse(evento: str, datos_evento: dict) -> str:
    return f"event: {evento}\ndata: {json.dumps(datos_evento, ensure_ascii=False)}\n\n"


FALLBACK = ("Ahora no puedo responder: el servicio del asistente no está disponible. "
            "Escribinos por WhatsApp y te atiende una persona del equipo.")


@router.post("/api/chat")
async def chat(pedido: PedidoChat, request: Request):
    _limitar(f"chat-ip:{_ip(request)}", _limite_ip())
    if pedido.sesion:
        _limitar(f"chat-sesion:{pedido.sesion}", _limite_sesion())

    historial = preparar_historial(pedido.mensajes)
    ctx = Contexto(fuente=datos.fuente(), sesion=pedido.sesion or _ip(request),
                   carrito=[i.model_dump() for i in pedido.carrito])
    conf = configuracion()
    try:
        llm = proveedor()
    except ProveedorNoConfigurado:
        print("ERROR asistente: proveedor de LLM mal configurado (revisar LLM_PROVIDER / LLM_API_KEY).")
        llm = None
    id_respuesta = uuid.uuid4().hex[:16]

    async def flujo():
        inicio = time.monotonic()
        yield _sse("inicio", {"id": id_respuesta, "modo": llm.nombre if llm else "no_disponible"})
        estado = "ok"
        if llm is None:
            estado = "sin_proveedor"
            yield _sse("error", {"tipo": "proveedor", "mensaje": FALLBACK})
            yield _sse("derivacion", {"motivo": "El asistente no está disponible"})
        else:
            try:
                async for evento, datos_evento in responder(llm, historial, ctx, max_tokens=conf["max_tokens"],
                                                            timeout_seg=conf["timeout_seg"]):
                    yield _sse(evento, datos_evento)
            except ProveedorCaido as e:
                estado = "interrumpido" if e.interrumpido else "caido"
                yield _sse("error", {"tipo": "interrumpido" if e.interrumpido else "proveedor",
                                     "mensaje": FALLBACK})
                yield _sse("derivacion", {"motivo": "El asistente no está disponible"})
            except Exception as e:  # noqa: BLE001 - nunca un 500 a mitad del stream
                estado = "error"
                print(f"ERROR asistente: fallo interno ({type(e).__name__}).")
                yield _sse("error", {"tipo": "interno", "mensaje": FALLBACK})
        # Log sin texto ni datos personales: métricas y hash de sesión.
        print(f"asistente: sesion={huella(pedido.sesion)} proveedor={llm.nombre if llm else '-'} "
              f"estado={estado} herramientas={','.join(ctx.usadas) or '-'} "
              f"ms={int((time.monotonic() - inicio) * 1000)}")
        yield _sse("fin", {})

    return StreamingResponse(flujo(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
    })


_feedback: dict[str, int] = {"positivo": 0, "negativo": 0}


@router.post("/api/chat/feedback", status_code=204)
def feedback(f: Feedback, request: Request) -> Response:
    _limitar(f"feedback-ip:{_ip(request)}", 30)
    _feedback[f.valor] += 1
    print(f"asistente feedback: {f.valor} mensaje={huella(f.mensaje_id)} sesion={huella(f.sesion)}")
    return Response(status_code=204)
