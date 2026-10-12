# HefestoTech · Panel Admin (/admin)

Panel interno con layout propio (sidebar colapsable, topbar con ⌘K,
notificaciones, tema, usuario). Acceso: `GuardiaRol soloAdmin` (roles
`owner`/`admin`, negación por defecto) + autorización por endpoint en
`backend/admin_api.py`. El panel declara `noindex, nofollow` al montarse.
Frontend: `ecomers/client/src/pages/Admin/`. Ruta pública extra: `/reclamo`.

## Matriz de permisos (espejo de `admin_permisos`, migración 005)

| Rol | Productos | Pedidos | Stock | Reclamos | Cupones | Banners | Notif. | Auditoría | Reportes | Buscar | Config | Usuarios |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| owner | leer/crear/editar/borrar | leer/crear/editar/cambiar_estado | leer/ajustar | leer/crear/editar/cambiar_estado | leer/crear/editar/borrar | leer/crear/editar/borrar | leer | leer | leer | leer | leer/gestionar | leer/gestionar |
| admin | igual que owner | igual que owner | leer/ajustar | igual que owner | igual que owner | igual que owner | leer | leer | leer | leer | leer | — |
| operador | leer/crear/editar | leer/cambiar_estado | leer/ajustar | leer | leer | leer | leer | — | leer | leer | — | — |
| soporte | leer | leer | — | leer/crear/editar/cambiar_estado | — | — | leer | — | — | leer | — | — |
| solo_lectura | leer | leer | leer | leer | leer | leer | leer | leer | leer | leer | — | — |

Fuente de verdad RLS: tabla SQL `admin_permisos`. El espejo `PERMISOS` en
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
