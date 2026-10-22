"""HefestoTech · backend/storage.py
Acceso mínimo a Supabase Storage con service_role.

Los buckets privados (comprobantes de pago) se suben desde el backend y se
muestran con URLs firmadas de vida corta. Nunca se expone la service_role.
"""

from __future__ import annotations

import os
from urllib.parse import quote

import httpx


class StorageError(RuntimeError):
    """Fallo de Storage sin filtrar detalles sensibles al cliente."""


def _config() -> tuple[str, str]:
    base = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base or not key:
        raise StorageError("Storage no configurado.")
    return base, key


def _headers(key: str, content_type: str = "") -> dict[str, str]:
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}
    if content_type:
        headers["Content-Type"] = content_type
    return headers


def subir(bucket: str, path: str, contenido: bytes, content_type: str) -> None:
    """Sube (sin sobrescribir) un objeto a un bucket privado."""
    base, key = _config()
    ruta = quote(path, safe="/")
    try:
        r = httpx.post(
            f"{base}/storage/v1/object/{quote(bucket, safe='')}/{ruta}",
            content=contenido,
            headers={**_headers(key, content_type), "x-upsert": "false"},
            timeout=30.0,
        )
    except httpx.HTTPError as exc:
        raise StorageError("No se pudo subir el archivo.") from exc
    if r.status_code not in (200, 201):
        raise StorageError("No se pudo subir el archivo.")


def firmar(bucket: str, path: str, expira_segundos: int = 3600) -> str:
    """Devuelve una URL firmada temporal para un objeto privado."""
    base, key = _config()
    ruta = quote(path, safe="/")
    try:
        r = httpx.post(
            f"{base}/storage/v1/object/sign/{quote(bucket, safe='')}/{ruta}",
            json={"expiresIn": max(60, min(int(expira_segundos), 86400))},
            headers=_headers(key, "application/json"),
            timeout=15.0,
        )
    except httpx.HTTPError as exc:
        raise StorageError("No se pudo firmar el archivo.") from exc
    if r.status_code != 200:
        raise StorageError("No se pudo firmar el archivo.")
    try:
        datos = r.json() or {}
    except Exception as exc:
        raise StorageError("Respuesta inválida de Storage.") from exc
    firmada = str(datos.get("signedURL") or datos.get("signedUrl") or "")
    if not firmada:
        raise StorageError("Storage no devolvió la URL firmada.")
    if firmada.startswith("http://") or firmada.startswith("https://"):
        return firmada
    if firmada.startswith("/storage/v1/"):
        return f"{base}{firmada}"
    return f"{base}/storage/v1/{firmada.lstrip('/')}"


def borrar(bucket: str, path: str) -> None:
    """Borra un objeto. No falla si ya no existe."""
    base, key = _config()
    ruta = quote(path, safe="/")
    try:
        httpx.delete(
            f"{base}/storage/v1/object/{quote(bucket, safe='')}/{ruta}",
            headers=_headers(key),
            timeout=15.0,
        )
    except httpx.HTTPError:
        pass
