from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import urllib.parse

app = FastAPI(title="Hefesto Tech API")

# Configuración CORS para permitir que el Frontend (HTML/JS) se conecte sin bloqueos
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def estado_api():
    return {"mensaje": "La API de Hefesto Tech está funcionando correctamente"}

@app.get("/api/productos")
def obtener_productos():
    try:
        # Leer el archivo CSV con el stock
        df = pd.read_csv("datos/Inventario_Stock_Ecommerce.csv")
    except FileNotFoundError:
        return {"error": "Archivo CSV no encontrado. Verifica que esté en backend/datos/"}

    productos_lista = []

    # Recorrer cada fila del CSV para agregar la imagen dinámica
    for _, fila in df.iterrows():
        producto = fila.to_dict()
        
        # Crear un texto limpio para la imagen (Ej: "MSI Tarjetas de Video")
        texto_imagen = urllib.parse.quote(f"{producto['Marca']}\n{producto['Categoría']}")
        
        # Generar la URL de la imagen (Fondo oscuro corporativo, texto claro)
        producto['Imagen_URL'] = f"https://placehold.co/400x400/2c3e50/ecf0f1?text={texto_imagen}"
        
        productos_lista.append(producto)

    return {"total_stock": len(productos_lista), "productos": productos_lista}