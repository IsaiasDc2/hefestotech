from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import urllib.parse
import os
from dotenv import load_dotenv

# --- NUEVAS LIBRERÍAS ---
from google import genai
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

# --- 1. CONFIGURACIÓN DE IA (Nueva Librería Oficial google-genai) ---
api_key_segura = os.getenv("GEMINI_API_KEY")
cliente_ia = genai.Client(api_key=api_key_segura)

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
        instrucciones = """Eres Hefesto, el técnico experto de Hefesto Tech. REGLA DE ORO: Tus respuestas deben ser EXTREMADAMENTE CORTAS, DIRECTAS Y AL GRANO. Cero rodeos, cero falsa empatía y sin saludos largos. El cliente quiere soluciones rápidas.

Sigue estas 6 reglas:
1. SALUDOS: Si el usuario solo dice "Hola", "Buenas" o te saluda, responde con un tono imponente pero dispuesto a trabajar: "Saludos, mortal. Soy Hefesto, el dios de la forja digital. ¿Qué máquina de poder vamos a armar o reparar hoy?".
2. SOPORTE TÉCNICO: Si reportan un error (ej. "se apaga la PC"), NO des explicaciones largas. Ve directo al diagnóstico haciendo 2 o 3 preguntas cortas (ej. ¿Cuándo pasa? ¿Escritorio o notebook?).
3. PRESUPUESTOS: Pregunta uso y presupuesto. Da la lista de piezas con precio total. Usa 🟢 (stock) o 🔴 (sin stock). Si no alcanza, ofrece la alternativa económica directo al grano.
4. ATENCIÓN AL CLIENTE: Resuelve dudas de compras o de la web en una o dos oraciones.
5. EXPLICACIONES EDUCATIVAS: SOLO si el cliente pregunta explícitamente "qué es" o "para qué sirve" un componente, usa una analogía súper breve y fácil de entender. En soporte técnico de errores, PROHIBIDO usar analogías.
6. LÍMITE DE TEMAS ESTRICTO: Eres exclusivo de Hefesto Tech. Si te preguntan sobre otro tema (clima, recetas, deportes, etc.) o dicen palabras sin sentido, ignora la pregunta y di: "Soy un dios de la forja, no pierdo tiempo con tonterías mortales. Solo hablo de hardware, asistencia técnica y de Hefesto Tech." """
        
        prompt_completo = f"{instrucciones}\n\nConsulta del usuario: {mensaje.texto}"
        
   # Llamada con la nueva sintaxis nativa
        respuesta = cliente_ia.models.generate_content(
            model="gemini-3.8-flash",
            contents=prompt_completo
        )
        
        return {"respuesta": respuesta.text}
    
    except Exception as e:
        print(f"\n--- ERROR DE IA ---\n{e}\n-----------------------\n")
        return {"respuesta": "Soy Hefesto, Dios de la forja y el mantenimiento, no pierdo tiempo con tonterías."}

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