from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
from dotenv import load_dotenv

from admin_api import router as admin_router
from asistente.router import router as asistente_router
from checkout_api import router as checkout_router
from contacto_api import router as contacto_router

load_dotenv()

def _flag(nombre: str) -> bool:
    return os.getenv(nombre, "").strip().lower() in ("1", "true", "si", "sí", "yes")


# Documentación interactiva deshabilitada por defecto (en producción no se
# expone el esquema de la API). Para desarrollo local: MOSTRAR_DOCS=1.
_docs = _flag("MOSTRAR_DOCS")
app = FastAPI(
    title="Hefesto Tech API",
    docs_url="/docs" if _docs else None,
    redoc_url="/redoc" if _docs else None,
    openapi_url="/openapi.json" if _docs else None,
)
app.include_router(admin_router)
app.include_router(checkout_router)
app.include_router(contacto_router)
app.include_router(asistente_router)

def _origen(u):
    u = (u or "").strip().rstrip("/")
    if not u.lower().startswith(("http://", "https://")):
        return ""
    try:
        from urllib.parse import urlparse
        p = urlparse(u)
        return f"{p.scheme}://{p.netloc}" if p.netloc else ""
    except Exception:
        return ""

origenes = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5199",
    "http://127.0.0.1:5199",
    "https://isaiasdc2.github.io",
]
_frente = _origen(os.getenv("FRONTEND_URL", ""))
if _frente and _frente not in origenes:
    origenes.append(_frente)
for extra in os.getenv("CORS_EXTRA_ORIGINS", "").split(","):
    o = _origen(extra)
    if o and o not in origenes:
        origenes.append(o)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origenes,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Límite de cuerpo y cabeceras de seguridad ----
_LIMITE_BODY_BYTES = 6 * 1024 * 1024  # 6 MB (la imagen tiene su tope de 5 MB)


@app.middleware("http")
async def _limite_body(request: Request, call_next):
    if request.method in ("POST", "PUT", "PATCH"):
        largo = request.headers.get("content-length", "")
        if largo.isdigit() and int(largo) > _LIMITE_BODY_BYTES:
            return JSONResponse(
                status_code=413, content={"detail": "Cuerpo demasiado grande."}
            )
    return await call_next(request)


@app.middleware("http")
async def _cabeceras_seguridad(request: Request, call_next):
    respuesta = await call_next(request)
    respuesta.headers.setdefault("X-Content-Type-Options", "nosniff")
    respuesta.headers.setdefault("Referrer-Policy", "no-referrer")
    respuesta.headers.setdefault("X-Frame-Options", "DENY")
    respuesta.headers.setdefault(
        "Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()"
    )
    respuesta.headers.setdefault("Strict-Transport-Security", "max-age=15552000")
    return respuesta

@app.get("/")
def estado_api():
    mensaje = "La API de Hefesto Tech está funcionando correctamente"
    # Los flags de entorno solo se muestran si se pide explícitamente
    # (MOSTRAR_ENV=1); por defecto la raíz no revela configuración.
    if not _flag("MOSTRAR_ENV"):
        return {"mensaje": mensaje}

    def hay(nombre):
        return bool(os.getenv(nombre))
    return {
        "mensaje": mensaje,
        "env": {
            "SUPABASE_URL": hay("SUPABASE_URL"),
            "SUPABASE_SERVICE_ROLE_KEY": hay("SUPABASE_SERVICE_ROLE_KEY"),
            "MERCADOPAGO_ACCESS_TOKEN": hay("MERCADOPAGO_ACCESS_TOKEN"),
            "MP_WEBHOOK_SECRET": hay("MP_WEBHOOK_SECRET"),
            "LLM_PROVIDER": os.getenv("LLM_PROVIDER") or "(auto)",
            "LLM_API_KEY": hay("LLM_API_KEY") or hay("GEMINI_API_KEY"),
            "BACKEND_URL": hay("BACKEND_URL"),
        },
    }

@app.get("/api/productos")
def obtener_productos():
    # Deprecado: doble fuente con Supabase (lo que se cobra sale de la DB).
    # Se mantiene 410 para no servir precios/stock distintos a los reales.
    raise HTTPException(
        status_code=410,
        detail="Catálogo movido a Supabase. Usá /api/admin/productos o la tienda.",
    )
