import requests
import os
from dotenv import load_dotenv

# Cargamos tu llave desde el archivo .env
load_dotenv()
api_key = os.getenv("GROQ_API_KEY")

# Le preguntamos a Groq qué modelos tiene activos
url = "https://api.groq.com/openai/v1/models"
headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

respuesta = requests.get(url, headers=headers)
datos = respuesta.json()

print("--- MODELOS DISPONIBLES PARA TU CUENTA ---")
for modelo in datos.get("data", []):
    print(modelo["id"])