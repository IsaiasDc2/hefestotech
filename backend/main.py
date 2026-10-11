from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pathlib import Path
from pydantic import BaseModel, Field
import pandas as pd
import urllib.parse
import os
from dotenv import load_dotenv

from google import genai
import mercadopago

from pagos_mp import (
    crear_orden,
    crear_preferencia_mp,
    validar_firma_mp,
    consultar_pago_mp,
    marcar_resultado_webhook,
    estado_orden,
    liberar_expiradas,
    _sb,
)
from comprobantes import obtener_comprobante, comprobante_pdf

load_dotenv()

app = FastAPI(title="Hefesto Tech API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://isaiasdc2.github.io",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _cliente_ia():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None
    return genai.Client(api_key=api_key)


def _sdk_mp():
    token = os.getenv("MERCADOPAGO_ACCESS_TOKEN")
    if not token:
        return None
    return mercadopago.SDK(token)

@app.get("/")
def estado_api():
    return {"mensaje": "La API de Hefesto Tech está funcionando correctamente"}

@app.get("/api/productos")
def obtener_productos():
    csv_path = Path(__file__).resolve().parent / "datos" / "Inventario_Stock_Ecommerce.csv"
    try:
        df = pd.read_csv(csv_path)
    except FileNotFoundError:
        return {"error": "Archivo CSV no encontrado."}

    productos_lista = []
    for _, fila in df.iterrows():
        producto = fila.to_dict()
        texto_imagen = urllib.parse.quote(f"{producto['Marca']}\n{producto['Categoría']}")
        producto['Imagen_URL'] = f"https://placehold.co/400x400/2c3e50/ecf0f1?text={texto_imagen}"
        productos_lista.append(producto)

    return {"total_stock": len(productos_lista), "productos": productos_lista}

class MensajeUsuario(BaseModel):
    texto: str

@app.post("/api/chat")
async def asistente_ia(mensaje: MensajeUsuario):
    cliente_ia = _cliente_ia()
    if cliente_ia is None:
        return {"respuesta": "Mis circuitos están en mantenimiento. Intenta de nuevo más tarde."}
    try:
        instrucciones = """Eres Hefesto, el técnico experto de Hefesto Tech. REGLA DE ORO: Tus respuestas deben ser EXTREMADAMENTE CORTAS, DIRECTAS Y AL GRANO. Cero rodeos, cero falsa empatía y sin saludos largos. El cliente quiere soluciones rápidas.

Sigue estas 6 reglas:
1. SALUDOS: Si el usuario solo dice "Hola", "Buenas" o te saluda, responde con un tono imponente pero dispuesto a trabajar: "Saludos, mortal. Soy Hefesto, el dios de la forja digital. ¿Qué máquina de poder vamos a armar o reparar hoy?".
2. SOPORTE TÉCNICO: Si reportan un error (ej. "se apaga la PC"), NO des explicaciones largas. Ve directo al diagnóstico haciendo 2 o 3 preguntas cortas (ej. ¿Cuándo pasa? ¿Escritorio o notebook?).
3. PRESUPUESTOS: Pregunta uso y presupuesto. Da la lista de piezas con precio total. Usa 🟢 (stock) o 🔴 (sin stock). Si no alcanza, ofrece la alternativa económica directo al grano.
4. ATENCIÓN AL CLIENTE: Resuelve dudas de compras o de la web en una o dos oraciones.
5. EXPLICACIONES EDUCATIVAS: SOLO si el cliente pregunta explícitamente "qué es" o "para qué sirve" un componente, usa una analogía súper breve y fácil de entender. En soporte técnico de errores, PROHIBIDO usar analogías.
6. LÍMITE DE TEMAS ESTRICTO: Eres exclusivo de Hefesto Tech. Si te preguntan sobre otro tema (clima, recetas, deportes, etc.) o dicen palabras sin sentido, ignora la pregunta y di: "Soy un dios de la forja, no pierdo tiempo con tonterías mortales. Solo hablo de hardware, asistencia técnica y de Hefesto Tech." """

        prompt_completo = f"{instrucciones}\n\nConsulta del usuario: {mensaje.texto}"

        respuesta = cliente_ia.models.generate_content(
            model="gemini-3.8-flash",
            contents=prompt_completo
        )

        return {"respuesta": respuesta.text}

    except Exception as e:
        print(f"\n--- ERROR DE IA ---\n{e}\n-----------------------\n")
        return {"respuesta": "Soy Hefesto, Dios de la forja y el mantenimiento, no pierdo tiempo con tonterías."}

class OrdenCompra(BaseModel):
    titulo: str
    cantidad: int
    precio_unitario: float

# LEGACY (simulado): endpoint anterior sin calculo en servidor ni orden.
# Se mantiene solo por compatibilidad; el flujo real es /api/checkout/crear.
@app.post("/api/crear-preferencia", deprecated=True)
def generar_link_pago(orden: OrdenCompra):
    sdk = _sdk_mp()
    if sdk is None:
        raise HTTPException(status_code=503, detail="Pagos no configurados (falta MERCADOPAGO_ACCESS_TOKEN).")
    try:
        preference_data = {
            "items": [
                {
                    "title": orden.titulo,
                    "quantity": orden.cantidad,
                    "unit_price": orden.precio_unitario,
                    "currency_id": "ARS"
                }
            ],
            "back_urls": {
                "success": "http://localhost:5173/pago-exitoso",
                "failure": "http://localhost:5173/pago-fallido",
                "pending": "http://localhost:5173/pago-pendiente"
            },
            "auto_return": "approved"
        }

        preference_response = sdk.preference().create(preference_data)
        preferencia = preference_response["response"]

        return {"link_pago": preferencia["init_point"]}

    except Exception as e:
        return {"error": str(e)}


# ================= CHECKOUT REAL (Mercado Pago Checkout Pro) =================

class ItemCheckout(BaseModel):
    producto_id: str
    cantidad: int = Field(ge=1, le=10)


class Comprador(BaseModel):
    nombre: str = Field(min_length=3, max_length=120)
    email: str = Field(min_length=6, max_length=160)
    telefono: str = Field(min_length=6, max_length=40)
    documento: str = Field(min_length=7, max_length=20)  # DNI o CUIT
    direccion: str = Field(min_length=4, max_length=200)
    ciudad: str = Field(min_length=2, max_length=100)
    provincia: str = Field(min_length=2, max_length=60)
    codigo_postal: str = Field(min_length=3, max_length=12)


class CrearOrdenBody(BaseModel):
    comprador: Comprador
    items: list[ItemCheckout] = Field(min_length=1)
    envio: str = "estandar"


@app.post("/api/checkout/crear")
def checkout_crear(body: CrearOrdenBody):
    if body.envio not in ("estandar", "express"):
        raise HTTPException(status_code=422, detail="Envío inválido.")
    try:
        orden = crear_orden(body.comprador.model_dump(),
                            [i.model_dump() for i in body.items], body.envio)
        link = crear_preferencia_mp(orden["id"], orden["lineas"],
                                    orden["costo_envio"], body.comprador.model_dump())
        return {"orden_id": orden["id"], "token": orden["token"],
                "total": orden["total"], "subtotal": orden["subtotal"],
                "costo_envio": orden["costo_envio"], "link_pago": link}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@app.get("/api/pedidos/{orden_id}")
def pedido_estado(orden_id: str, token: str = ""):
    o = estado_orden(orden_id)
    if not o or o.get("token_verificacion") != token:
        raise HTTPException(status_code=404, detail="Pedido no encontrado.")
    return {"id": o["id"], "estado": o["estado"], "total": o["total"],
            "mp_payment_id": o.get("mp_payment_id"),
            "comprobante_numero": o.get("comprobante_numero", ""),
            "expira_en": o.get("expira_en")}


@app.post("/api/checkout/{orden_id}/reintentar")
def checkout_reintentar(orden_id: str, body: dict = None):
    o = estado_orden(orden_id)
    if not o:
        raise HTTPException(status_code=404, detail="Pedido no encontrado.")
    if o["estado"] == "pagado":
        raise HTTPException(status_code=409, detail="El pedido ya está pagado.")
    filas = _sb("ordenes", query=f"?id=eq.{orden_id}&select=nombre,email")
    comp = filas[0] if filas else {}
    items = _sb("orden_items", query=f"?orden_id=eq.{orden_id}&select=producto_id,cantidad,precio")
    lineas = [{"producto_id": i["producto_id"], "nombre": "",
               "cantidad": i["cantidad"], "precio_unitario": int(float(i["precio"]))}
              for i in (items or [])]
    costo = int(float(_sb("ordenes", query=f"?id=eq.{orden_id}&select=costo_envio")[0]["costo_envio"]))
    try:
        link = crear_preferencia_mp(orden_id, lineas, costo, comp)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return {"orden_id": orden_id, "link_pago": link}


@app.post("/api/webhooks/mercadopago")
async def webhook_mp(request: Request):
    raw = await request.json()
    data_id = str((raw.get("data") or {}).get("id") or raw.get("id") or "")
    tipo = raw.get("type") or raw.get("topic") or ""
    if tipo != "payment" or not data_id:
        return {"ok": True, "ignorado": True}
    if not validar_firma_mp(request.headers.get("x-signature", ""),
                             request.headers.get("x-request-id", ""), data_id):
        raise HTTPException(status_code=401, detail="Firma inválida.")
    try:
        pago = consultar_pago_mp(data_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"MP: {e}") from e
    orden_id = pago.get("external_reference") or ""
    if not orden_id:
        return {"ok": True, "ignorado": True}
    resultado = marcar_resultado_webhook(orden_id, data_id,
                                         pago.get("status", ""), pago.get("transaction_amount", 0))
    return {"ok": True, "resultado": resultado}


@app.post("/api/checkout/liberar-expiradas")
def checkout_liberar():
    return {"liberadas": liberar_expiradas()}


@app.get("/api/comprobantes/{orden_id}")
def comprobante_ver(orden_id: str, token: str = ""):
    c = obtener_comprobante(orden_id)
    if not c or c.get("token_verificacion") != token:
        raise HTTPException(status_code=404, detail="Comprobante no encontrado.")
    return c


@app.get("/api/comprobantes/{orden_id}/pdf")
def comprobante_descargar(orden_id: str, token: str = ""):
    c = obtener_comprobante(orden_id)
    if not c or c.get("token_verificacion") != token:
        raise HTTPException(status_code=404, detail="Comprobante no encontrado.")
    pdf = comprobante_pdf(c)
    nombre = (c.get("numero") or orden_id).replace("/", "-")
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{nombre}.pdf"'})
