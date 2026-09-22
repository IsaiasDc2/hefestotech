# hefestotech 🎮

Ecommerce de venta de productos gaming (consolas, PCs, perifericos, sillas, componentes).

**Stack:** React + Vite + Tailwind + Zustand (frontend) · FastAPI + SQLAlchemy (backend) · PostgreSQL (base de datos)

## Estructura del proyecto

```
ecomers-gamer/
├── client/                 
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   ├── layout/       
│   │   │   └── product/      
│   │   ├── pages/
│   │   │   ├── Home/
│   │   │   ├── ProductDetail/
│   │   │   ├── Cart/
│   │   │   ├── Checkout/
│   │   │   ├── Login/
│   │   │   ├── Register/
│   │   │   └── Profile/
│   │   ├── services/         
│   │   ├── store/             
│   │   ├── routes/            
│   │   ├── styles/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├
│   ├── package.json
│   └── vite.config.js
│
├── server/                   
│   ├── app/
│   │   ├── core/               
│   │   ├── db/                  
│   │   ├── models/              
│   │   ├── schemas/             
│   │   ├── routers/             
│   │   ├── dependencies.py      
│   │   ├── seed.py               
│   │   └── main.py
│   ├
│   └── requirements.txt
```
