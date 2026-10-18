"""HefestoTech · asistente · bucle del agente (proveedor + herramientas).

Para cada mensaje: pide un turno al proveedor; si pide herramientas, las
ejecuta sobre datos reales y vuelve a preguntar (hasta MAX_PASOS); el texto
se reenvía en streaming apenas llega. Cada turno tiene timeout y, si falla
antes de emitir texto, se reintenta con backoff. Si el proveedor no responde
se levanta ProveedorCaido y el router muestra el fallback con WhatsApp.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import AsyncIterator

from .herramientas import HERRAMIENTAS, Contexto, ejecutar, normalizar
from .proveedores import LLMProvider

RUTA_PROMPT = Path(__file__).resolve().parents[2] / "prompts" / "assistant.system.md"
MAX_PASOS = 4
REINTENTOS = 2
BACKOFF_SEG = (0.6, 1.8)
MAX_TARJETAS = 4
MAX_RESULTADO_CHARS = 8000


class ProveedorCaido(RuntimeError):
    def __init__(self, interrumpido: bool = False):
        super().__init__("proveedor caído")
        self.interrumpido = interrumpido


def system_prompt() -> str:
    return RUTA_PROMPT.read_text(encoding="utf-8").strip()


def tarjeta(p: dict) -> dict:
    return {k: p[k] for k in ("id", "codigo", "nombre", "marca", "categoria", "precio", "precio_lista",
                              "precio_a_confirmar", "stock", "envio_gratis", "imagen", "url")}


def _acotar(resultado: dict) -> dict:
    """Un resultado gigante no debe comerse la ventana del modelo."""
    if len(json.dumps(resultado, ensure_ascii=False, default=str)) <= MAX_RESULTADO_CHARS:
        return resultado
    if isinstance(resultado.get("productos"), list):
        return {**resultado, "productos": resultado["productos"][:3], "nota_recorte": "Se muestran 3."}
    return {"error": "Resultado demasiado grande."}


async def _turno(proveedor: LLMProvider, sistema: str, mensajes: list[dict], herramientas,
                 max_tokens: int, timeout_seg: float, emitido: list[bool]) -> AsyncIterator[dict]:
    for intento in range(REINTENTOS + 1):
        try:
            async with asyncio.timeout(timeout_seg):
                async for ev in proveedor.turno(sistema, mensajes, herramientas, max_tokens):
                    if ev["tipo"] == "texto":
                        emitido[0] = True
                    yield ev
            return
        except Exception as e:  # noqa: BLE001 - cualquier falla del proveedor activa el fallback
            print(f"ERROR asistente: proveedor {proveedor.nombre} falló ({type(e).__name__}), intento {intento + 1}.")
            codigo = getattr(e, "code", None)
            # Clave inválida, modelo inexistente o pedido mal formado: reintentar no lo arregla.
            definitivo = isinstance(codigo, int) and 400 <= codigo < 500 and codigo != 429
            if emitido[0] or definitivo or intento == REINTENTOS:
                raise ProveedorCaido(interrumpido=emitido[0]) from None
            await asyncio.sleep(BACKOFF_SEG[min(intento, len(BACKOFF_SEG) - 1)])


async def responder(proveedor: LLMProvider, historial: list[dict], ctx: Contexto, *,
                    max_tokens: int = 800, timeout_seg: float = 25) -> AsyncIterator[tuple[str, dict]]:
    """Emite (evento, datos): texto, herramienta, productos, armado, derivacion."""
    sistema = system_prompt()
    mensajes = list(historial)
    texto_final = ""
    emitido = [False]
    for paso in range(MAX_PASOS):
        herramientas = HERRAMIENTAS if paso < MAX_PASOS - 1 else None
        llamadas = None
        async for ev in _turno(proveedor, sistema, mensajes, herramientas, max_tokens, timeout_seg, emitido):
            if ev["tipo"] == "texto":
                texto_final += ev["delta"]
                yield "texto", {"delta": ev["delta"]}
            elif ev["tipo"] == "llamadas":
                llamadas = ev
        if not llamadas:
            break
        mensajes.append({"rol": "asistente", "llamadas": llamadas["llamadas"], "nativo": llamadas.get("nativo")})
        for llamada in llamadas["llamadas"]:
            yield "herramienta", {"nombre": llamada["nombre"]}
            resultado = await asyncio.to_thread(ejecutar, ctx, llamada["nombre"], llamada.get("args") or {})
            mensajes.append({"rol": "herramienta", "id": llamada["id"], "nombre": llamada["nombre"],
                             "resultado": _acotar(resultado)})

    if ctx.armado:
        yield "armado", {
            "productos": [tarjeta(p) for p in ctx.armado["productos"]],
            "total": ctx.armado["total"],
            "dentro_del_presupuesto": ctx.armado["dentro_del_presupuesto"],
            "veredicto": ctx.armado["veredicto"],
        }
    elegidas = elegir_tarjetas(ctx, texto_final)
    if elegidas:
        yield "productos", {"productos": [tarjeta(p) for p in elegidas]}
    if ctx.derivacion:
        yield "derivacion", ctx.derivacion


def elegir_tarjetas(ctx: Contexto, texto: str) -> list[dict]:
    """Tarjetas = productos que devolvieron las herramientas y que la
    respuesta nombra; si no nombra ninguno, los últimos resultados."""
    en_armado = {p["id"] for p in (ctx.armado or {}).get("productos", [])}
    norm = normalizar(texto)
    candidatos = [p for pid, p in ctx.vistos.items() if pid not in en_armado]
    nombrados = [p for p in candidatos if normalizar(p["nombre"]) in norm
                 or (p["codigo"] and normalizar(p["codigo"]) in norm)]
    if nombrados:
        return nombrados[:MAX_TARJETAS]
    if ctx.armado:
        return []
    return [ctx.vistos[i] for i in ctx.ultimos if i not in en_armado][:3]
