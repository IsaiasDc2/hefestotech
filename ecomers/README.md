# Hefesto Tech 🎮

Ecommerce de venta de hardware y productos gaming (consolas, PCs, periféricos, componentes) equipado con asistencia técnica inteligente.

**Stack Frontend:** React + Vite + Tailwind + Zustand
**Stack Backend:** Python (FastAPI) + pandas
**Integraciones:** Google Gemini AI (gemini-3.8-flash) + Mercado Pago SDK

## 🚀 Funcionalidades Destacadas

- **Asistente Inteligente "Hefesto":** Un bot de soporte técnico con personalidad de "Dios de la forja", capaz de diagnosticar problemas de hardware, armar presupuestos en tiempo real y filtrar consultas fuera de tema.
- **Pasarela de Pagos:** Creación dinámica de preferencias y links de cobro mediante la API de Mercado Pago.
- **Catálogo Dinámico:** Sistema de lectura de inventario y stock automatizado desde archivos CSV.

## 📂 Estructura del proyecto

```text
hefestotech/
├── client/                 # Frontend (React)
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   ├── layout/
│   │   │   └── product/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── backend/                # API REST (FastAPI)
│   ├── datos/
│   │   └── Inventario_Stock_Ecommerce.csv
│   ├── main.py             # Lógica principal, Endpoints IA y Pagos
│   ├── .env                # Variables de entorno (API Keys seguras)
│   └── requirements.txt
```
