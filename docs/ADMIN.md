# HefestoTech · Panel Admin (/admin)

Panel interno con layout propio (sidebar colapsable, topbar con ⌘K,
notificaciones, tema, usuario). Acceso: `GuardiaRol soloAdmin` (roles
`owner`/`admin`, negación por defecto) + autorización por endpoint en
`backend/admin_api.py`. El panel declara `noindex, nofollow` al montarse.
Frontend: `ecomers/client/src/pages/Admin/`. Ruta pública extra: `/reclamo`.

## Matriz de permisos (espejo de `admin_permisos`, migración 005)

| Rol | Productos | Pedidos | Stock | Reclamos | Cupones | Banners | Notif. | Auditoría | Reportes | Buscar | Config | Usuarios | Proveedores | Compras |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| owner | leer/crear/editar/borrar | leer/crear/editar/cambiar_estado | leer/ajustar | leer/crear/editar/cambiar_estado | leer/crear/editar/borrar | leer/crear/editar/borrar | leer | leer | leer | leer | leer/gestionar | leer/gestionar | leer/crear/editar/borrar | leer/crear/editar/cambiar_estado/recibir |
| admin | igual que owner | igual que owner | leer/ajustar | igual que owner | igual que owner | igual que owner | leer | leer | leer | leer | leer | — | igual que owner | igual que owner |
| operador | leer/crear/editar | leer/cambiar_estado | leer/ajustar | leer | leer | leer | leer | — | leer | leer | — | — | leer/crear/editar | leer/crear/editar/cambiar_estado/recibir |
| soporte | leer | leer | — | leer/crear/editar/cambiar_estado | — | — | leer | — | — | leer | — | — | — | — |
| solo_lectura | leer | leer | leer | leer | leer | leer | leer | leer | leer | leer | — | — | leer | leer |

Fuente de verdad RLS: tabla SQL `admin_permisos` (Proveedores y Compras se
suman en la migración 014). El espejo `PERMISOS` en
`backend/admin_api.py` solo decide el acceso a ese backend. Roles fuera de
la matriz (p. ej. `cliente`) no entran a ningún endpoint. El JWT se valida
contra Supabase (`/auth/v1/user`); nunca se confía en el rol del cliente.
El token nunca se loguea ni se renderiza.

## Estados

- **Pedido** (`ESTADOS_PEDIDO`): `pendiente → pagada → preparacion → enviada → entregada`.
  Finales: `cancelada`, `reembolsada`. Transiciones vía RPC
  `cambiar_estado_pedido` con control optimista de versión (409 ante
  conflicto: "recargá el pedido").
- **Reclamo** (`ESTADOS_RECLAMO`): `abierto → en_revision → resuelto | rechazado`.
- **Orden de compra** (`TRANSICIONES_OC`): `borrador → enviada → confirmada`,
  y `recibida_parcial → recibida` solo por recepción. `cancelada` desde
  borrador, enviada, confirmada o recibida parcial (cierra el saldo; lo
  recibido queda). Cambio manual con control optimista (`estado=eq.<actual>`;
  409 "recargala" si otro la movió).

## Proveedores y Compras (migración 014)

- **Ficha**: razón social (`nombre`, única), nombre comercial, CUIT con
  dígito verificador (módulo 11, se guarda en 11 dígitos; validado en
  servidor por `_cuit_valido`, en SQL por `cuit_valido()` y en el formulario
  por `compras.js`), condición IVA, contactos (jsonb), pago contado/15/30/60
  días, moneda ARS/USD, plazo, pedido mínimo (centavos), descuento, CBU
  (verificadores validados; **nunca sale del servidor**: solo `cbu_mascara`
  con los últimos 4), alias, notas, etiquetas, calificación 1–5 y estado
  `activo | en_evaluacion | inactivo`. Borrado lógico con papelera y
  restaurar; **no se borra con órdenes abiertas** (409).
- **Producto ↔ proveedor**: costo en centavos (`costo_centavos`; el `costo`
  numeric de 003 queda sin uso), moneda, SKU del proveedor, cantidad mínima,
  plazo y **un solo principal por producto** (índice único parcial).
  `producto_proveedor_costos` guarda el historial de cada cambio de costo.
- **Reposición**: productos activos con `stock < stock_minimo`, agrupados
  por proveedor principal. Sugerida = `2 × mínimo − stock − lo pendiente en
  OC abiertas` (incluye borradores), llevada a la cantidad mínima del
  proveedor; si lo pedido ya cubre, no aparece. Sin principal → grupo aparte
  (no se puede crear borrador hasta asignarlo).
- **Recepción**: RPC `recibir_orden_compra` (SECURITY DEFINER, solo
  service_role) en una transacción: valida lo pendiente por línea, suma
  stock con `adjust_stock` (movimiento `motivo=recepcion_compra`,
  `nota=OC-000123`), actualiza el costo del proveedor (opcional), fija
  `recibida_parcial`/`recibida` y guarda la recepción en
  `recepciones_compra`. Si una línea falla, no se aplica ninguna. El backend
  pre-valida con `_validar_recepcion` para responder 400/409 claros.
- RLS: `proveedores` y `producto_proveedor` dejan de ser de lectura pública
  (costos y CBU); lectura solo staff con `proveedores/leer`, compras con
  `compras/leer`. Escritura de compras solo vía backend.
- Fuera del MVP (pendiente): cuenta corriente y pagos, documentos adjuntos,
  importación de listas de precios, PDF/email de la OC, reportes de compras.

## Cupones

- Tipos: `porcentaje` (1–100) o `monto` (centavos). Contrato: GET/POST/DELETE
  (sin edición; para cambiar, borrar y crear de nuevo).
- Reglas en servidor (espejo `aplicar_cupon()`): activo, no vencido, con usos
  disponibles, subtotal ≥ mínimo. Descuento nunca supera el subtotal.
- Montos siempre en **centavos enteros**; el frontend solo formatea a ARS.

## Definición de venta (reportes)

- Venta = pedido **no** `cancelada` ni `reembolsada`. `GET
  /api/admin/reportes/ventas?desde=&hasta=` agrega en servidor:
  `{pedidos, total_centavos, por_estado, por_dia[]}`. Totales en centavos,
  sin floats para dinero.

## Papelera

- Borrado lógico de productos (`deleted_at`/`deleted_by`); **purga a los 30
  días** en servidor. Restaurar: `POST /api/admin/productos/{id}/restaurar`.
- UX: al borrar desde Productos se ofrece **Deshacer durante 10 s** (toast con
  acción) que llama a restaurar. Papelera lista `?papelera=true`.

## Módulos y estado

| Módulo | Endpoint(s) | Estado |
|---|---|---|
| Inicio | `GET /api/admin/resumen` | Terminado |
| Productos (+lotes, +Deshacer 10s) | `GET/POST /api/admin/productos`, `PUT/DELETE`, `restaurar`, `lotes` | Terminado |
| Stock | `POST /api/admin/stock/ajustar` | Terminado |
| Proveedores (ficha, productos, papelera) | `GET/POST /api/admin/proveedores`, `GET/PUT/DELETE /{id}`, `restaurar`, `PUT/DELETE /{id}/productos/{producto_id}` | Terminado (MVP) |
| Compras (reposición, OC, recepción) | `GET /api/admin/compras/sugerencias`, `GET/POST /api/admin/compras/ordenes`, `GET/PUT /{id}`, `POST /{id}/estado`, `POST /{id}/recepciones` | Terminado (MVP) |
| Pedidos | `GET /api/admin/pedidos`, `POST estado` | Terminado |
| Reclamos (bandeja) + `/reclamo` público | `GET/POST`, `PATCH` | Terminado |
| WhatsApp Nivel 1 (wa.me + plantillas) | sin backend (enlaces) | Terminado |
| Banners | `GET/POST/PUT/DELETE` | Terminado |
| Cupones | `GET/POST/DELETE` | Terminado |
| Reportes | `GET /api/admin/reportes/ventas` | Terminado |
| Auditoría (append-only) | `GET /api/admin/auditoria` | Terminado |
| Notificaciones (campana + bandeja) | `GET /api/admin/notificaciones` | Terminado |
| Búsqueda global (⌘K) | `GET /api/buscar` | Terminado |
| Papelera | `GET ?papelera=true` + restaurar | Terminado |
| Config | sin endpoint | Lectura segura (entorno/host, secretos redactados) |
| Clientes | sin endpoint en el contrato | Próximamente |
| WhatsApp Nivel 2 / Email | — | Listos y **deshabilitados** |

Regla general: si un endpoint falla (o 403 por rol), el módulo queda
deshabilitado como **Próximamente** / Sin permiso, sin datos inventados
(vacío real cuando no hay).

## Operación de pedidos y reportes

- **Número de pedido**: `HT-` + 8 primeros caracteres del id (p. ej. `HT-B952791B`).
  El buscador de Pedidos acepta número completo o parcial (con o sin `#`/`HT-`),
  email o nombre, y rango de fechas en hora argentina.
- **Hora argentina**: "hoy", los 30 días del tablero, la bandeja y los reportes
  cuentan días en `America/Argentina/Buenos_Aires` (no en UTC).
- **Seguimiento de envío** (migración `017_envio_seguimiento.sql`): transportista,
  código y enlace. El cliente lo ve en `/pedido/:id` y, si el pedido ya está
  enviado, le llega por email. Sin la migración, el panel avisa que falta aplicarla.
- **Reembolso real**: `POST /api/admin/pedidos/{id}/reembolsar`. Solo owner/admin;
  pedidos `pagada` o `entregada` con pago de Mercado Pago. Llama a la API de
  reembolsos de MP con clave de idempotencia fija por pedido, pasa el pedido a
  `reembolsada` y, opcionalmente, devuelve el stock. En pedidos con pago de MP el
  botón común «→ reembolsada» se oculta para no cambiar la etiqueta sin devolver el dinero.
- **Emails al cliente** (opcional, `backend/mailer.py`): pagada, enviada, entregada,
  cancelada y reembolsada. Requiere `RESEND_API_KEY` y `MAIL_FROM`; sin ellas no
  hace nada y un fallo del proveedor nunca interrumpe la operación.
- **Reportes**: ventas, ticket promedio, productos más vendidos (importe bruto) y
  exportación CSV (separador `;`, BOM para Excel, celdas protegidas contra fórmulas).

## SEO (tienda pública)

- `vite build` ejecuta `scripts/generar-seo.mjs` (postbuild): genera un HTML real por
  producto y por página pública (estado 200, con título, descripción, canonical,
  Open Graph, Twitter y JSON-LD propios), `sitemap.xml` (productos con imagen y
  categorías) y `robots.txt`. En GitHub Pages las rutas profundas responden 404 y
  los buscadores no las indexan: por eso se prerenderizan.
- En la app, `useSeoRuta`/`useSeo` mantienen título, descripción, canonical, OG y
  robots por ruta. Carrito, checkout, cuenta, admin, pagos y pedidos llevan `noindex`;
  las búsquedas internas (`?q=`) también.
- `robots.txt` solo rige si el sitio está en la raíz del dominio (en `usuario.github.io/hefestotech`
  los buscadores solo leen el de `usuario.github.io`); la protección real es el `noindex`.
- Después de publicar: dar de alta el sitio en Google Search Console y enviar `sitemap.xml`.