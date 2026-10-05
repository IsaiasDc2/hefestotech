from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import urllib.parse
import os
from dotenv import load_dotenv

# --- NUEVAS LIBRERÍAS ---
from openai import OpenAI
import mercadopago

# Cargar el archivo .env
load_dotenv()

app = FastAPI(title="Hefesto Tech API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 1. CONFIGURACIÓN DE IA (OpenAI 3.5) ---
# Lee la clave que guardaste en el .env (mantenemos el nombre de la variable para que no tengas que editar el .env de nuevo)
api_key_segura = os.getenv("GEMINI_API_KEY")
cliente_ia = OpenAI(api_key=api_key_segura)

# --- 2. CONFIGURACIÓN DE MERCADO PAGO ---
mp_access_token = os.getenv("MERCADOPAGO_ACCESS_TOKEN")
sdk = mercadopago.SDK(mp_access_token)


@app.get("/")
def estado_api():
    return {"mensaje": "La API de Hefesto Tech está funcionando correctamente"}

@app.get("/api/productos")
def obtener_productos():
    try:
        df = pd.read_csv("datos/Inventario_Stock_Ecommerce.csv")
    except FileNotFoundError:
        return {"error": "Archivo CSV no encontrado."}

    productos_lista = []
    for _, fila in df.iterrows():
        producto = fila.to_dict()
        texto_imagen = urllib.parse.quote(f"{producto['Marca']}\n{producto['Categoría']}")
        producto['Imagen_URL'] = f"https://placehold.co/400x400/2c3e50/ecf0f1?text={texto_imagen}"
        productos_lista.append(producto)

    return {"total_stock": len(productos_lista), "productos": productos_lista}

# --- RUTAS DE LA IA ---
class MensajeUsuario(BaseModel):
    texto: str

@app.post("/api/chat")
async def asistente_ia(mensaje: MensajeUsuario):
    try:
        instrucciones = """Eres Hefesto, el técnico experto de Hefesto Tech. REGLA DE ORO: Tus respuestas deben ser EXTREMADAMENTE CORTAS, DIRECTAS Y AL GRANO. Cero rodeos, cero falsa empatía (no digas "lo lamento mucho") y sin saludos largos. El cliente quiere soluciones rápidas.

Sigue estas 5 reglas:
1. SOPORTE TÉCNICO: Si reportan un error (ej. "se apaga la PC"), NO des explicaciones largas ni uses analogías de por qué pasa. Ve directo al diagnóstico haciendo 2 o 3 preguntas cortas (ej. ¿Cuándo pasa? ¿Escritorio o notebook?).
2. PRESUPUESTOS: Pregunta uso y presupuesto. Da la lista de piezas con precio total. Usa 🟢 (stock) o 🔴 (sin stock). Si no alcanza, ofrece la alternativa económica directo al grano.
3. ATENCIÓN AL CLIENTE: Resuelve dudas de compras o de la web en una o dos oraciones.
4. EXPLICACIONES EDUCATIVAS: SOLO si el cliente pregunta explícitamente "qué es" o "para qué sirve" un componente, usa una analogía súper breve (una línea) y fácil de entender. En soporte técnico de errores, PROHIBIDO usar analogías.
5. LÍMITE DE TEMAS ESTRICTO: Eres exclusivo de Hefesto Tech. SOLO puedes hablar sobre componentes de hardware, soporte técnico de PC, reparaciones o información de nuestra tienda web. Si el usuario te pregunta SOBRE CUALQUIER OTRO TEMA (clima, política, historia, recetas, deportes, etc.), TIENES PROHIBIDO responder la duda. Simplemente ignora la pregunta y di: "Solo estoy programado para ayudarte con asistencia técnica de PC, componentes y consultas sobre Hefesto Tech." """
        
        # Llamada a la IA con el formato oficial de OpenAI
        respuesta = cliente_ia.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": instrucciones},
                {"role": "user", "content": mensaje.texto}
            ]
        )
        return {"respuesta": respuesta.choices[0].message.content}
    
    except Exception as e:
        print(f"\n--- ERROR DE IA ---\n{e}\n-----------------------\n")
        return {"respuesta": "Lo siento, mis circuitos están en mantenimiento. Intenta de nuevo más tarde."}

# --- RUTAS DE MERCADO PAGO ---
class OrdenCompra(BaseModel):
    titulo: str
    cantidad: int
    precio_unitario: float

@app.post("/api/crear-preferencia")
def generar_link_pago(orden: OrdenCompra):
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