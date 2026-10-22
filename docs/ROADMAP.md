# Hoja de ruta

Pendientes ordenados por impacto para el comercio. Lo ya resuelto está en `CHANGELOG.md` y el estado de cada hallazgo en `AUDITORIA.md`.

## Antes de vender con esta versión (necesita al dueño)

1. **Datos del comercio**: CUIT, dirección y email en `backend/.env` (`TIENDA_*`).
2. **Precios y stock** de los 15 productos de la migración 007 (hoy en $0: se muestran como "Precio a confirmar").
3. **Specs del armador**: las de `product_specs` están cargadas como inferidas (`verified=false`) y el motor solo lee las verificadas. Hay que revisarlas y marcarlas `verified=true`.
4. **Deploy**: activar *Pages → Source: GitHub Actions* y cargar las variables `VITE_*` del repo (ver README).
5. Confirmar que las migraciones 005 a 013 están aplicadas en Supabase (la RLS de `movimientos_stock`, SEC-01, se corrigió editando la 005).
6. Validar con un profesional los textos legales: botón de arrepentimiento (Res. 424/2020), Defensa del Consumidor y Ley 25.326.

## Próximos desarrollos

| Prioridad | Tema | Detalle |
|---|---|---|
| Alta | Medios de pago | Transferencia con descuento configurable y confirmación desde el admin; efectivo (Rapipago/Pago Fácil) vía Mercado Pago. |
| Alta | Asistente de IA | Herramientas sobre el catálogo real (`search_products`, `check_compatibility`, `get_order_status`), streaming y modo sin clave. Ver el prompt maestro. |
| Alta | Proveedores y compras | Ficha de proveedor con CUIT validado, costos por producto, órdenes de compra y recepción que actualiza stock y costo (las tablas base existen en la migración 003). |
| Media | Envíos | Cotización por código postal con tabla de zonas configurable en el admin. |
| Media | Catálogo en servidor | Paginación y filtros en Postgres cuando el catálogo supere ~500 productos (hoy se filtra en el navegador). |
| Media | Seguridad | SEC-02 (insert de notificaciones), SEC-05 (rate limit detrás del proxy de Render, idealmente con Redis), PRIV-01 (datos del reclamo en columnas propias). |
| Media | E2E | Playwright para los flujos de compra, admin y armador en móvil y escritorio. |
| Baja | Imágenes | `srcset` con transformaciones de Supabase Storage; recomprimir `tira-placa.webp` y `almacenamiento.webp`. |
| Baja | Post-MVP | Facturación electrónica ARCA, reseñas moderadas, comparador, aviso de reposición. |
