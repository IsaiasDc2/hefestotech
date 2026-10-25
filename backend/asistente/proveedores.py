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

Configuración: LLM_PROVIDER (mock | gemini | groq | openrouter | auto),
LLM_API_KEY, LLM_MODEL, LLM_MAX_TOKENS. Compatibilidad: si solo existe
GEMINI_API_KEY/GEMINI_MODEL (configuración previa), se usa Gemini con esos
valores.

`LLM_PROVIDER=auto` arma la cadena de failover groq → gemini → openrouter
(según qué API keys existan en el entorno): si un proveedor falla antes de
emitir texto se pasa al siguiente; a mitad del stream no se puede cambiar
limpio y la falla sube como ProveedorCaido. Las keys por proveedor:
GROQ_API_KEY, GEMINI_API_KEY (o LLM_API_KEY), OPENROUTER_API_KEY; modelos
configurables con GROQ_MODEL / OPENROUTER_MODEL.
"""

from __future__ import annotations

import json
import os
from typing import Any, AsyncIterator, Optional

import httpx

# Con la clave del proyecto, gemini-3.8-flash no respondía en más de 60 s
# (oct-2026) y gemini-2.5-flash ya no existe para claves nuevas; 3.5-flash
# contesta en ~2 s y soporta herramientas. Se cambia con LLM_MODEL.
MODELO_GEMINI_POR_DEFECTO = "gemini-3.5-flash"


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


class ErrorHTTPProveedor(RuntimeError):
    """El proveedor respondió un HTTP no-200. `code` lo usa agente.py para
    decidir si reintentar o cortar (4xx != 429 son definitivos)."""

    def __init__(self, code: int):
        super().__init__(f"HTTP {code}")
        self.code = code


class OpenAICompatibleProvider(LLMProvider):
    """Proveedor con API OpenAI-compatible vía SSE streaming
    (Groq, OpenRouter y otros con /chat/completions)."""

    def __init__(self, nombre: str, url: str, api_key: str, modelo: str, timeout_seg: float):
        self.nombre = nombre
        self.modelo = modelo
        self._url = url
        self._key = api_key
        self._timeout = timeout_seg

    def _mensajes(self, sistema: str, mensajes: list[dict]) -> list[dict]:
        out = [{"role": "system", "content": sistema}]
        for m in mensajes:
            if m["rol"] == "herramienta":
                out.append({
                    "role": "tool",
                    "tool_call_id": m["id"],
                    "name": m["nombre"],
                    "content": json.dumps(m["resultado"], ensure_ascii=False, default=str),
                })
            elif m["rol"] == "asistente" and m.get("llamadas"):
                out.append({
                    "role": "assistant",
                    "content": m.get("texto"),
                    "tool_calls": [{
                        "id": c["id"], "type": "function",
                        "function": {"name": c["nombre"],
                                     "arguments": json.dumps(c["args"] or {}, ensure_ascii=False)},
                    } for c in m["llamadas"]],
                })
            else:
                rol = "assistant" if m["rol"] == "asistente" else "user"
                out.append({"role": rol, "content": m["texto"]})
        return out

    def _tools(self, herramientas: Optional[dict]) -> Optional[list]:
        if not herramientas:
            return None
        return [{
            "type": "function",
            "function": {"name": n, "description": h["descripcion"], "parameters": h["parametros"]},
        } for n, h in herramientas.items()]

    async def turno(self, sistema, mensajes, herramientas, max_tokens):
        payload: dict[str, Any] = {
            "model": self.modelo,
            "messages": self._mensajes(sistema, mensajes),
            "max_tokens": max_tokens,
            "temperature": 0.3,
            "stream": True,
        }
        tools = self._tools(herramientas)
        if tools:
            payload["tools"] = tools
        headers = {"Authorization": f"Bearer {self._key}", "Content-Type": "application/json"}

        async with httpx.AsyncClient(timeout=self._timeout) as cli:
            async with cli.stream("POST", self._url, json=payload, headers=headers) as r:
                if r.status_code != 200:
                    await r.aread()
                    raise ErrorHTTPProveedor(r.status_code)
                llamadas: dict[int, dict] = {}
                async for linea in r.aiter_lines():
                    if not linea.startswith("data:"):
                        continue
                    data = linea[5:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        trozo = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    for ch in (trozo.get("choices") or [])[:1]:
                        delta = ch.get("delta") or {}
                        if delta.get("content"):
                            yield {"tipo": "texto", "delta": delta["content"]}
                        for tc in delta.get("tool_calls") or []:
                            llamada = llamadas.setdefault(tc.get("index", 0),
                                                          {"id": "", "nombre": "", "args": ""})
                            if tc.get("id"):
                                llamada["id"] = tc["id"]
                            fn = tc.get("function") or {}
                            if fn.get("name"):
                                llamada["nombre"] += fn["name"]
                            if fn.get("arguments"):
                                llamada["args"] += fn["arguments"]
        if llamadas:
            yield {"tipo": "llamadas", "llamadas": [
                {"id": llamadas[i]["id"] or f"llamada-{i}",
                 "nombre": llamadas[i]["nombre"],
                 "args": _json_o_vacio(llamadas[i]["args"])}
                for i in sorted(llamadas)
            ]}


def _json_o_vacio(texto: str) -> dict:
    try:
        return json.loads(texto or "{}")
    except json.JSONDecodeError:
        return {}


class FailoverProvider(LLMProvider):
    """Cadena de proveedores: si el activo falla antes de emitir texto,
    pasa al siguiente. A mitad del stream la falla sube (no se puede
    reintentar limpio). Recuerda el último que funcionó."""

    nombre = "auto"

    def __init__(self, proveedores: list[LLMProvider]):
        self._proveedores = proveedores
        self._activo = 0

    async def turno(self, sistema, mensajes, herramientas, max_tokens):
        i = self._activo
        emitio_texto = False
        ultimo_error: Optional[Exception] = None
        while i < len(self._proveedores):
            p = self._proveedores[i]
            try:
                async for ev in p.turno(sistema, mensajes, herramientas, max_tokens):
                    if ev["tipo"] == "texto":
                        emitio_texto = True
                    yield ev
                self._activo = i
                return
            except Exception as e:  # noqa: BLE001 - failover ante cualquier falla pre-stream
                ultimo_error = e
                print(f"asistente/{p.nombre}: falló ({type(e).__name__} {getattr(e, 'code', '')}); "
                      f"probando siguiente proveedor")
                if emitio_texto:
                    raise
                i += 1
        raise ultimo_error or ProveedorNoConfigurado("cadena de proveedores vacía")


# Proveedores OpenAI-compatibles configurables por env. Orden de la cadena
# auto: groq -> gemini -> openrouter (el que tenga key entra a la cadena).
_PROVEEDORES_OPENAI = {
    "groq": {
        "url": "https://api.groq.com/openai/v1/chat/completions",
        "env_key": "GROQ_API_KEY",
        "env_model": "GROQ_MODEL",
        "modelo_defecto": "qwen/qwen3.8-27b",
    },
    "openrouter": {
        "url": "https://openrouter.ai/api/v1/chat/completions",
        "env_key": "OPENROUTER_API_KEY",
        "env_model": "OPENROUTER_MODEL",
        "modelo_defecto": "nvidia/nemotron-3-ultra-550b-a55b:free",
    },
}


def _proveedor_openai(nombre: str, timeout_seg: float, conf: Optional[dict] = None) -> OpenAICompatibleProvider:
    spec = _PROVEEDORES_OPENAI[nombre]
    clave = os.getenv(spec["env_key"]) or ((conf or {}).get("clave") if nombre == (conf or {}).get("proveedor") else "") or ""
    if not clave and nombre == "groq":
        clave = os.getenv("GROK_API_KEY") or ""  # nombre que se usó en backend/.env
    if not clave:
        raise ProveedorNoConfigurado(f"{spec['env_key']} no configurada")
    modelo = os.getenv(spec["env_model"]) or (conf or {}).get("modelo") or spec["modelo_defecto"]
    return OpenAICompatibleProvider(nombre, spec["url"], clave, modelo, timeout_seg)


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
        "timeout_seg": float(os.getenv("LLM_TIMEOUT_SEG") or 20),
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
    if conf["proveedor"] in _PROVEEDORES_OPENAI:
        return _proveedor_openai(conf["proveedor"], conf["timeout_seg"], conf)
    if conf["proveedor"] == "auto":
        cadena: list[LLMProvider] = []
        for nombre in ("groq", "gemini", "openrouter"):
            try:
                if nombre == "gemini":
                    clave = os.getenv("GEMINI_API_KEY") or os.getenv("LLM_API_KEY") or ""
                    if not clave:
                        continue
                    cadena.append(GeminiProvider(clave, os.getenv("GEMINI_MODEL") or MODELO_GEMINI_POR_DEFECTO,
                                                 conf["timeout_seg"]))
                else:
                    cadena.append(_proveedor_openai(nombre, conf["timeout_seg"]))
            except ProveedorNoConfigurado:
                continue
        if not cadena:
            raise ProveedorNoConfigurado("LLM_PROVIDER=auto sin ninguna API key")
        return FailoverProvider(cadena)
    raise ProveedorNoConfigurado(f"LLM_PROVIDER desconocido: {conf['proveedor']}")
