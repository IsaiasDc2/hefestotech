"""HefestoTech · asistente · proveedores de LLM detrás de una interfaz común.

`LLMProvider.turno()` recibe el system prompt, la conversación en formato
neutro y las herramientas, y emite eventos:
    {"tipo": "texto", "delta": "..."}                         (streaming)
    {"tipo": "llamadas", "llamadas": [...], "nativo": obj}    (function calling)

Mensajes neutros:
    {"rol": "usuario" | "asistente", "texto": str}
    {"rol": "asistente", "llamadas": [{"id", "nombre", "args"}], "nativo": obj}
    {"rol": "herramienta", "id", "nombre", "resultado": dict}

`nativo` es el turno tal cual lo devolvió el proveedor (Gemini necesita
reenviar sus `thought_signature`). Sumar un proveedor = implementar `turno`
y registrarlo en `crear_proveedor`.

Configuración: LLM_PROVIDER (mock | gemini), LLM_API_KEY, LLM_MODEL,
LLM_MAX_TOKENS. Compatibilidad: si solo existe GEMINI_API_KEY/GEMINI_MODEL
(configuración previa), se usa Gemini con esos valores.
"""

from __future__ import annotations

import os
from typing import Any, AsyncIterator, Optional

# Modelo que ya tenía configurado el backend anterior (main.py).
MODELO_GEMINI_POR_DEFECTO = "gemini-3.8-flash"


class ProveedorNoConfigurado(RuntimeError):
    pass


class LLMProvider:
    nombre = "base"
    es_mock = False

    async def turno(self, sistema: str, mensajes: list[dict], herramientas: Optional[dict],
                    max_tokens: int) -> AsyncIterator[dict]:
        raise NotImplementedError
        yield  # pragma: no cover


class GeminiProvider(LLMProvider):
    nombre = "gemini"

    def __init__(self, api_key: str, modelo: str, timeout_seg: float, cliente: Any = None):
        from google import genai
        from google.genai import types

        self._types = types
        self.modelo = modelo
        self._cliente = cliente or genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(timeout=int(timeout_seg * 1000)),
        )

    def _contenidos(self, mensajes: list[dict]) -> list:
        t = self._types
        contenidos: list = []
        for m in mensajes:
            if m["rol"] == "herramienta":
                parte = t.Part.from_function_response(name=m["nombre"], response={"resultado": m["resultado"]})
                previo = contenidos[-1] if contenidos else None
                if previo is not None and previo.role == "user" and previo.parts and previo.parts[0].function_response:
                    previo.parts.append(parte)
                else:
                    contenidos.append(t.Content(role="user", parts=[parte]))
            elif m["rol"] == "asistente" and m.get("llamadas"):
                if m.get("nativo") is not None:
                    contenidos.append(m["nativo"])
                else:
                    contenidos.append(t.Content(role="model", parts=[
                        t.Part(function_call=t.FunctionCall(name=c["nombre"], args=c["args"])) for c in m["llamadas"]
                    ]))
            else:
                rol = "model" if m["rol"] == "asistente" else "user"
                contenidos.append(t.Content(role=rol, parts=[t.Part.from_text(text=m["texto"])]))
        return contenidos

    def _config(self, sistema: str, herramientas: Optional[dict], max_tokens: int):
        t = self._types
        tools = None
        if herramientas:
            tools = [t.Tool(function_declarations=[
                t.FunctionDeclaration(name=n, description=h["descripcion"], parameters_json_schema=h["parametros"])
                for n, h in herramientas.items()
            ])]
        return t.GenerateContentConfig(
            system_instruction=sistema,
            tools=tools,
            automatic_function_calling=t.AutomaticFunctionCallingConfig(disable=True),
            max_output_tokens=max_tokens,
            temperature=0.3,
        )

    async def turno(self, sistema, mensajes, herramientas, max_tokens):
        partes: list = []
        llamadas: list[dict] = []
        flujo = await self._cliente.aio.models.generate_content_stream(
            model=self.modelo, contents=self._contenidos(mensajes),
            config=self._config(sistema, herramientas, max_tokens),
        )
        async for trozo in flujo:
            for cand in (trozo.candidates or [])[:1]:
                for parte in (cand.content.parts if cand.content and cand.content.parts else []):
                    partes.append(parte)
                    if parte.function_call:
                        fc = parte.function_call
                        llamadas.append({"id": fc.id or f"llamada-{len(llamadas)}", "nombre": fc.name,
                                         "args": dict(fc.args or {})})
                    elif parte.text and not parte.thought:
                        yield {"tipo": "texto", "delta": parte.text}
        if llamadas:
            yield {"tipo": "llamadas", "llamadas": llamadas,
                   "nativo": self._types.Content(role="model", parts=partes)}


def configuracion() -> dict:
    clave = os.getenv("LLM_API_KEY") or os.getenv("GEMINI_API_KEY") or ""
    nombre = (os.getenv("LLM_PROVIDER") or "").strip().lower()
    if not nombre:
        nombre = "gemini" if clave else "mock"
    modelo = os.getenv("LLM_MODEL") or (os.getenv("GEMINI_MODEL") if nombre == "gemini" else "") or ""
    return {
        "proveedor": nombre,
        "clave": clave,
        "modelo": modelo,
        "max_tokens": int(os.getenv("LLM_MAX_TOKENS") or 800),
        "timeout_seg": float(os.getenv("LLM_TIMEOUT_SEG") or 25),
    }


def crear_proveedor(conf: Optional[dict] = None) -> LLMProvider:
    conf = conf or configuracion()
    if conf["proveedor"] == "mock":
        from .mock import MockProvider
        return MockProvider()
    if conf["proveedor"] == "gemini":
        if not conf["clave"]:
            raise ProveedorNoConfigurado("LLM_PROVIDER=gemini sin LLM_API_KEY")
        return GeminiProvider(conf["clave"], conf["modelo"] or MODELO_GEMINI_POR_DEFECTO, conf["timeout_seg"])
    raise ProveedorNoConfigurado(f"LLM_PROVIDER desconocido: {conf['proveedor']}")
