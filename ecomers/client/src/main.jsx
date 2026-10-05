import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename="/hefestotech">
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
async function cargarCatalogo() {
    try {
        // Apuntamos al puerto donde corre tu Uvicorn (por defecto 8000)
        const respuesta = await fetch("http://127.0.0.1:8000/api/productos");
        const datos = await respuesta.json();

        // Buscamos el contenedor vacío
        const contenedor = document.getElementById("catalogo-destacados");
        contenedor.innerHTML = ""; // Borramos el texto de "forjando"

        // Recorremos tu inventario y dibujamos las tarjetas
        datos.productos.forEach(producto => {
            // Aquí puedes adaptar las clases HTML para que coincidan con tu diseño
            contenedor.innerHTML += `
                <div class="tarjeta-producto" style="border: 1px solid #444; padding: 15px; margin: 10px; border-radius: 8px;">
                    <img src="${producto.Imagen_URL}" alt="${producto.Marca}" style="max-width: 100%;">
                    <h3>${producto.Marca}</h3>
                    <p>${producto.Categoría}</p>
                    <p style="color: #ff6600; font-weight: bold;">Stock disponible</p>
                </div>
            `;
        });
    } catch (error) {
        console.error("Error al conectar con la forja:", error);
    }
}