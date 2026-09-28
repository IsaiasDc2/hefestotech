from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import urllib.parse
from google import genai  # <--- IMPORTACIÓN ACTUALIZADA

# --- MODIFICACIÓN 1: Importar librerías de entorno ---
import os
from dotenv import load_dotenv

# --- MODIFICACIÓN 2: Cargar el archivo .env ---
load_dotenv()

app = FastAPI(title="Hefesto Tech API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MODIFICACIÓN 3: Usar la variable en lugar del texto fijo ---
api_key_segura = os.getenv("GEMINI_API_KEY")
cliente_ia = genai.Client(api_key=api_key_segura)

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

Sigue estas 4 reglas:
1. SOPORTE TÉCNICO: Si reportan un error (ej. "se apaga la PC"), NO des explicaciones largas ni uses analogías de por qué pasa. Ve directo al diagnóstico haciendo 2 o 3 preguntas cortas (ej. ¿Cuándo pasa? ¿Escritorio o notebook?).
2. PRESUPUESTOS: Pregunta uso y presupuesto. Da la lista de piezas con precio total. Usa 🟢 (stock) o 🔴 (sin stock). Si no alcanza, ofrece la alternativa económica directo al grano.
3. ATENCIÓN AL CLIENTE: Resuelve dudas de compras o de la web en una o dos oraciones.
4. EXPLICACIONES EDUCATIVAS: SOLO si el cliente pregunta explícitamente "qué es" o "para qué sirve" un componente, usa una analogía súper breve (una línea) y fácil de entender. En soporte técnico de errores, PROHIBIDO usar analogías.

Responde a la siguiente consulta del cliente aplicando estas reglas estrictamente: """
        prompt_completo = instrucciones + mensaje.texto
        
        # Llamada a la IA con el nuevo formato oficial de Google
        respuesta = cliente_ia.models.generate_content(
            model='gemini-3.8-flash',
            contents=prompt_completo
        )
        return {"respuesta": respuesta.text}
    
    except Exception as e:
        print(f"\n--- ERROR DE GEMINI ---\n{e}\n-----------------------\n")
        return {"respuesta": "Lo siento, mis circuitos están en mantenimiento. Intenta de nuevo más tarde."}