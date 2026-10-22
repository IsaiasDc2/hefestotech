"""Lista los modelos disponibles en el proveedor LLM configurado.

Uso (desde `backend/`, con el venv activo):

    python ver_modelos.py

Lee la clave de `LLM_API_KEY` (o `GROQ_API_KEY` como compatibilidad) y la
URL base de `LLM_BASE_URL` (por defecto, la de Groq). Solo imprime IDs de
modelo: nunca muestra la clave.

Nota: este script viene de la rama IAGroncha, que probó Groq/Qwen antes de
que el asistente quedara con proveedores intercambiables en
`backend/asistente/proveedores.py`.
"""

import os

import httpx
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("LLM_API_KEY") or os.getenv("GROQ_API_KEY")
if not api_key:
    raise SystemExit(
        "Falta LLM_API_KEY o GROQ_API_KEY en el entorno (backend/.env)."
    )

base_url = os.getenv("LLM_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/")

try:
    respuesta = httpx.get(
        f"{base_url}/models",
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=15,
    )
except httpx.HTTPError as e:
    raise SystemExit(f"No se pudo conectar con {base_url}: {e}") from e

if respuesta.status_code != 200:
    raise SystemExit(
        f"El proveedor respondió {respuesta.status_code}: {respuesta.text[:300]}"
    )

print(f"--- MODELOS DISPONIBLES EN {base_url} ---")
for modelo in respuesta.json().get("data", []):
    print(modelo.get("id", "(sin id)"))
