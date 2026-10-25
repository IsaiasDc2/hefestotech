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

Configuración: LLM_PROVIDER (auto | mock | gemini | groq | grok), LLM_API_KEY,
LLM_MODEL, LLM_MAX_TOKENS. Compatibilidad: si solo existe GEMINI_API_KEY/
GEMINI_MODEL (configuración previa), se usa Gemini con esos valores.
En modo auto (sin LLM_PROVIDER): Gemini si hay GEMINI_API_KEY y, si además hay
GROK_API_KEY (Groq gsk_... o xAI xai-...), queda de respaldo automático.
"""

from __future__ import annotations

import asyncio
import os
import time
from typing import Any, AsyncIterator, Optional

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


class ErrorProveedor(RuntimeError):
    def __init__(self, code: int, detalle: str = ""):
        super().__init__(f"HTTP {code} {detalle}".strip())
        self.code = code


MODELO_GROQ_POR_DEFECTO = "openai/gpt-oss-120b"
MODELO_XAI_POR_DEFECTO = "grok-4"
URL_GROQ = "https://api.groq.com/openai/v1"
URL_XAI = "https://api.x.ai/v1"


class OpenAICompatProvider(LLMProvider):
    """Groq (claves gsk_) y xAI Grok (claves xai-): API compatible con OpenAI."""

    def __init__(self, nombre: str, api_key: str, modelo: str, url_base: str, timeout_seg: float, cliente: Any = None):
        self.nombre = nombre
        self.modelo = modelo
        self._url = url_base.rstrip("/") + "/chat/completions"
        self._clave = api_key
        self._timeout = timeout_seg
        self._cliente = cliente

    @staticmethod
    def _mensajes(sistema: str, mensajes: list[dict]) -> list[dict]:
        import json
        out: list[dict] = [{"role": "system", "content": sistema}]
        for m in mensajes:
            if m["rol"] == "herramienta":
                out.append({"role": "tool", "tool_call_id": m["id"],
                            "content": json.dumps(m["resultado"], ensure_ascii=False, default=str)})
            elif m["rol"] == "asistente" and m.get("llamadas"):
                out.append({"role": "assistant", "content": None, "tool_calls": [
                    {"id": c["id"], "type": "function",
                     "function": {"name": c["nombre"], "arguments": json.dumps(c["args"], ensure_ascii=False)}}
                    for c in m["llamadas"]]})
            else:
                out.append({"role": "assistant" if m["rol"] == "asistente" else "user", "content": m["texto"]})
        return out

    async def turno(self, sistema, mensajes, herramientas, max_tokens):
        import json
        import httpx

        cuerpo: dict = {
            "model": self.modelo, "stream": True, "temperature": 0.3,
            "messages": self._mensajes(sistema, mensajes),
            # Los modelos con razonamiento gastan parte del tope pensando.
            "max_tokens": max_tokens * 2,
        }
        if self.modelo.startswith("openai/gpt-oss"):
            cuerpo["reasoning_effort"] = "low"
        if herramientas:
            cuerpo["tools"] = [{"type": "function", "function": {
                "name": n, "description": h["descripcion"], "parameters": h["parametros"]}}
                for n, h in herramientas.items()]
        acumuladas: dict[int, dict] = {}
        propio = self._cliente is None
        cliente = self._cliente or httpx.AsyncClient(timeout=self._timeout)
        try:
            async with cliente.stream("POST", self._url, json=cuerpo,
                                      headers={"Authorization": f"Bearer {self._clave}"}) as r:
                if r.status_code >= 400:
                    await r.aread()
                    raise ErrorProveedor(r.status_code)
                async for linea in r.aiter_lines():
                    if not linea.startswith("data:"):
                        continue
                    dato = linea[5:].strip()
                    if not dato or dato == "[DONE]":
                        continue
                    for opcion in (json.loads(dato).get("choices") or [])[:1]:
                        delta = opcion.get("delta") or {}
                        if delta.get("content"):
                            yield {"tipo": "texto", "delta": delta["content"]}
                        for tc in delta.get("tool_calls") or []:
                            acc = acumuladas.setdefault(tc.get("index", 0), {"id": "", "nombre": "", "args": ""})
                            if tc.get("id"):
                                acc["id"] = tc["id"]
                            fn = tc.get("function") or {}
                            acc["nombre"] += fn.get("name") or ""
                            acc["args"] += fn.get("arguments") or ""
        finally:
            if propio:
                await cliente.aclose()
        if acumuladas:
            llamadas = []
            for i, acc in sorted(acumuladas.items()):
                try:
                    args = json.loads(acc["args"] or "{}")
                except ValueError:
                    args = {}
                llamadas.append({"id": acc["id"] or f"llamada-{i}", "nombre": acc["nombre"],
                                 "args": args if isinstance(args, dict) else {}})
            yield {"tipo": "llamadas", "llamadas": llamadas, "nativo": None}


class ProveedorConRespaldo(LLMProvider):
    """Usa el principal y, si falla antes de emitir algo (cuota agotada,
    caída, timeout), pasa al de respaldo. Tras una falla, el principal descansa
    DESCANSO_SEG para no pagar el timeout en cada mensaje."""

    DESCANSO_SEG = 60.0
    TIMEOUT_PRINCIPAL_SEG = 10.0

    def __init__(self, principal: LLMProvider, respaldo: LLMProvider):
        self.principal = principal
        self.respaldo = respaldo
        self._hasta = 0.0

    @property
    def nombre(self) -> str:  # type: ignore[override]
        return self.respaldo.nombre if time.monotonic() < self._hasta else self.principal.nombre

    async def turno(self, sistema, mensajes, herramientas, max_tokens):
        if time.monotonic() >= self._hasta:
            emitido = False
            try:
                async with asyncio.timeout(self.TIMEOUT_PRINCIPAL_SEG):
                    async for ev in self.principal.turno(sistema, mensajes, herramientas, max_tokens):
                        emitido = True
                        yield ev
                return
            except Exception as e:  # noqa: BLE001
                if emitido:
                    raise
                print(f"ERROR asistente: {self.principal.nombre} falló ({type(e).__name__}); "
                      f"paso a {self.respaldo.nombre}.")
                self._hasta = time.monotonic() + self.DESCANSO_SEG
        async for ev in self.respaldo.turno(sistema, mensajes, herramientas, max_tokens):
            yield ev


def _clave_openai_compat() -> str:
    return (os.getenv("GROK_API_KEY") or os.getenv("GROQ_API_KEY") or os.getenv("XAI_API_KEY") or "").strip()


def _destino_openai_compat(clave: str) -> tuple[str, str, str]:
    """(nombre, url, modelo por defecto) según el prefijo de la clave."""
    if clave.startswith("xai-"):
        return "grok", os.getenv("LLM_BASE_URL") or URL_XAI, MODELO_XAI_POR_DEFECTO
    return "groq", os.getenv("LLM_BASE_URL") or URL_GROQ, MODELO_GROQ_POR_DEFECTO


def configuracion() -> dict:
    explicito = (os.getenv("LLM_PROVIDER") or "").strip().lower()
    nombre = "" if explicito == "auto" else explicito
    clave_gemini = os.getenv("LLM_API_KEY") or os.getenv("GEMINI_API_KEY") or ""
    clave_compat = _clave_openai_compat()
    respaldo = ""
    if not nombre:
        if clave_gemini:
            nombre = "gemini"
            respaldo = "groq" if clave_compat else ""
        elif clave_compat:
            nombre = "groq"
        else:
            nombre = "mock"
    clave = clave_gemini if nombre == "gemini" else (
        os.getenv("LLM_API_KEY") or clave_compat if nombre in ("groq", "grok") else clave_gemini)
    modelo = os.getenv("LLM_MODEL") or (os.getenv("GEMINI_MODEL") if nombre == "gemini" else "") or ""
    return {
        "proveedor": nombre,
        "clave": clave,
        "modelo": modelo,
        "respaldo": respaldo,
        "max_tokens": int(os.getenv("LLM_MAX_TOKENS") or 800),
        "timeout_seg": float(os.getenv("LLM_TIMEOUT_SEG") or 20),
    }


def _crear_openai_compat(clave: str, modelo: str, timeout_seg: float) -> LLMProvider:
    nombre, url, modelo_defecto = _destino_openai_compat(clave)
    return OpenAICompatProvider(nombre, clave, modelo or modelo_defecto, url, timeout_seg)


def crear_proveedor(conf: Optional[dict] = None) -> LLMProvider:
    conf = conf or configuracion()
    if conf["proveedor"] == "mock":
        from .mock import MockProvider
        return MockProvider()
    if conf["proveedor"] == "gemini":
        if not conf["clave"]:
            raise ProveedorNoConfigurado("LLM_PROVIDER=gemini sin LLM_API_KEY")
        principal = GeminiProvider(conf["clave"], conf["modelo"] or MODELO_GEMINI_POR_DEFECTO, conf["timeout_seg"])
        if conf.get("respaldo"):
            return ProveedorConRespaldo(principal, _crear_openai_compat(_clave_openai_compat(), "", conf["timeout_seg"]))
        return principal
    if conf["proveedor"] in ("groq", "grok"):
        if not conf["clave"]:
            raise ProveedorNoConfigurado(f"LLM_PROVIDER={conf['proveedor']} sin GROK_API_KEY")
        return _crear_openai_compat(conf["clave"], conf["modelo"], conf["timeout_seg"])
    raise ProveedorNoConfigurado(f"LLM_PROVIDER desconocido: {conf['proveedor']}")
