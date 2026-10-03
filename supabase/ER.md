# HefestoTech · Modelo entidad-relación

`001_productos.sql` ya aplicada (productos, categorias, bucket). Falta aplicar
`002_ordenes.sql` → ver "Cómo crearla" abajo.

```mermaid
erDiagram
    AUTH-USERS ||--o{ ORDENES : "user_id (FK)"
    AUTH-USERS ||--|| PERFILES : "id (FK, 1:1)"
    AUTH-USERS ||--o{ FAVORITOS : "user_id (FK)"
    CATEGORIAS ||..o{ PRODUCTOS : "categoria TEXT lógico, sin FK"
    ORDENES ||--o{ ORDEN-ITEMS : "orden_id (FK, cascade)"
    ORDENES ||..o{ MOVIMIENTOS : "orden_id (FK, opcional)"
    PRODUCTOS ||..o{ ORDEN-ITEMS : "producto_id (FK, set null)"
    PRODUCTOS ||--o{ PRODUCTO-PROVEEDOR : "producto_id (FK)"
    PRODUCTOS ||--o{ MOVIMIENTOS : "producto_id (FK)"
    PRODUCTOS ||--o{ FAVORITOS : "producto_id (FK)"
    PROVEEDORES ||--o{ PRODUCTO-PROVEEDOR : "proveedor_id (FK)"

    AUTH-USERS {
        uuid id PK
        text email
    }
    CATEGORIAS {
        uuid id PK
        text nombre UK
        timestamptz created_at
    }
    PRODUCTOS {
        uuid id PK
        text codigo UK
        text nombre
        text descripcion
        text categoria
        text marca
        numeric precio
        numeric precio_con_descuento
        numeric descuento_porcentaje
        int stock
        int stock_minimo
        bool envio_gratis
        bool destacado
        text imagen
        jsonb especificaciones
        bool activo
        timestamptz created_at
    }
    ORDENES {
        uuid id PK
        uuid user_id FK
        text nombre
        text email
        text direccion
        text ciudad
        text codigo_postal
        text envio
        text pago_mock
        text tarjeta_ultimos4
        numeric subtotal
        numeric costo_envio
        numeric total
        text estado
        timestamptz created_at
    }
    ORDEN-ITEMS {
        uuid id PK
        uuid orden_id FK
        uuid producto_id FK
        int cantidad
        numeric precio
        timestamptz created_at
    }
    PERFILES {
        uuid id PK_FK
        text nombre
        text telefono
        text direccion
        text ciudad
        text codigo_postal
        timestamptz created_at
    }
    PROVEEDORES {
        uuid id PK
        text nombre UK
        text cuit
        text email
        text telefono
        text direccion
        timestamptz created_at
    }
    PRODUCTO-PROVEEDOR {
        uuid producto_id PK_FK
        uuid proveedor_id PK_FK
        numeric costo
        int tiempo_entrega_dias
        timestamptz created_at
    }
    MOVIMIENTOS {
        uuid id PK
        uuid producto_id FK
        text tipo
        int cantidad
        text motivo
        uuid orden_id FK
        timestamptz created_at
    }
    FAVORITOS {
        uuid user_id PK_FK
        uuid producto_id PK_FK
        timestamptz created_at
    }
```

## Relaciones

| Desde → Hasta | Tipo | Regla |
|---|---|---|
| ordenes.user_id → auth.users.id | N:1 | `on delete cascade` (sin usuario, sin órdenes) |
| orden_items.orden_id → ordenes.id | N:1 | `on delete cascade` |
| orden_items.producto_id → productos.id | N:1, opcional | `on delete set null` (la orden sobrevive al producto) |
| perfiles.id → auth.users.id | 1:1 | se crea sola con trigger al registrarse |
| producto_proveedor → productos / proveedores | N:M | costo y entrega por proveedor |
| movimientos_stock.producto_id → productos.id | N:1, opcional | `set null`; `tipo` solo entrada/salida/ajuste |
| favoritos.(user_id, producto_id) | N:M | PK compuesta, cascade a ambos lados |
| productos.categoria ↔ categorias.nombre | lógica, **sin FK** | texto libre; ver mejora propuesta |

## RLS (Row Level Security)

* `categorias`, `productos`: lectura pública; escritura solo `authenticated`.
* `ordenes`, `orden_items`: cada usuario solo ve/crea las suyas (`user_id = auth.uid()`).
* Storage `productos`: bucket público de lectura, escritura autenticada.

## Cómo crearla (1 paso, requiere tu sesión)

1. Abrí Supabase Dashboard → tu proyecto → **SQL Editor** → **New query**.
2. Pegá el contenido de `supabase/migrations/002_ordenes.sql` y **Run**.
3. Verificá con:
   ```sql
   select table_name from information_schema.tables
   where table_schema = 'public' order by 1;
   ```
   Debe listar `categorias`, `ordenes`, `orden_items`, `productos`.

> El DDL exige sesión con permisos (Dashboard o `psql`); la key pública del
> front no puede crear tablas. Avisame cuando lo ejecutes y lo verifico por API.

## Mejora propuesta (no aplicada para no romper la app viva)

`productos.categoria` es texto libre y los nombres no siempre coinciden con
`categorias.nombre` (ej: `Procesador` vs `Procesadores`). La migración correcta
sería `categoria_id uuid references categorias(id)` + backfill + ajuste del
front (filtros por id). Hacerlo después, con deploy coordinado.
