"""HefestoTech · contacto y newsletter (públicos, con rate-limit)."""
from __future__ import annotations

import os
import re
import time
from collections import defaultdict, deque
from typing import Any, Optional

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, field_validator

router = APIRouter()

_VENTANA = 60
_registro: dict[str, deque] = defaultdict(deque)
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _limitar(ip: str, clave: str, max_req: int) -> None:
    ahora = time.monotonic()
    cola = _registro[f"{clave}:{ip}"]
    while cola and ahora - cola[0] > _VENTANA:
        cola.popleft()
    if len(cola) >= max_req:
        raise HTTPException(status_code=429, detail="Demasiadas solicitudes. Esperá un momento.")
    cola.append(ahora)


def _sb(tabla: str, method: str = "GET", params: str = "", body: Any = None) -> Any:
    base = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base or not key:
        raise HTTPException(status_code=503, detail="Servicio no configurado.")
    try:
        r = httpx.request(method, f"{base}/rest/v1/{tabla}{params}",
                          headers={"apikey": key, "Authorization": f"Bearer {key}",
                                   "Content-Type": "application/json",
                                   "Prefer": "return=representation"},
                          json=body, timeout=15.0)
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="No se pudo guardar. Intentá más tarde.")
    if r.status_code in (200, 201):
        return r.json() if r.content else []
    if r.status_code == 409:
        raise HTTPException(status_code=409, detail="Duplicado.")
    raise HTTPException(status_code=502, detail="No se pudo guardar. Intentá más tarde.")


def _uid_desde_bearer(authorization: Optional[str]) -> Optional[str]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    base = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base or not key:
        return None
    try:
        r = httpx.get(f"{base}/auth/v1/user",
                      headers={"apikey": key, "Authorization": authorization}, timeout=10.0)
        if r.status_code != 200:
            return None
        return r.json().get("id")
    except httpx.HTTPError:
        return None


class ContactoEntrante(BaseModel):
    nombre: str
    email: str
    asunto: str
    mensaje: str

    @field_validator("nombre", "asunto")
    @classmethod
    def _texto_corto(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) < 3 or len(v) > 200:
            raise ValueError("Texto inválido.")
        return v

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        v = (v or "").strip().lower()
        if not _EMAIL_RE.match(v) or len(v) > 200:
            raise ValueError("Email inválido.")
        return v

    @field_validator("mensaje")
    @classmethod
    def _mensaje(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) < 10 or len(v) > 2000:
            raise ValueError("Mensaje inválido.")
        return v


class NewsletterEntrante(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        v = (v or "").strip().lower()
        if not _EMAIL_RE.match(v) or len(v) > 200:
            raise ValueError("Email inválido.")
        return v


@router.post("/api/contacto", status_code=201)
def crear_contacto(d: ContactoEntrante, request: Request) -> dict[str, Any]:
    _limitar(request.client.host if request.client else "?", "contacto", 5)
    uid = _uid_desde_bearer(request.headers.get("authorization"))
    detalle = f"De: {d.nombre} <{d.email}>\nAsunto: {d.asunto}\n\n{d.mensaje}"
    filas = _sb("reclamos", "POST", "",
                {"user_id": uid, "motivo": "contacto web", "detalle": detalle})
    return {"id": (filas[0]["id"] if filas else None)}


@router.post("/api/newsletter", status_code=201)
def suscribir_newsletter(d: NewsletterEntrante, request: Request) -> dict[str, Any]:
    _limitar(request.client.host if request.client else "?", "newsletter", 5)
    try:
        _sb("suscriptores", "POST", "", {"email": d.email})
    except HTTPException as e:
        if e.status_code == 409:
            return {"ok": True, "duplicado": True}
        raise
    return {"ok": True}
