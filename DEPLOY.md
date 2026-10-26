# DEPLOY.md · Guía de despliegue para un agente de IA

Este documento está escrito para que un agente (Claude Code, Cursor, etc.) despliegue HefestoTech de punta a punta sin adivinar. Seguilo en orden. Cada paso dice qué hacer, con qué comando y cómo verificarlo.

## 0. Reglas para el agente

1. **Secretos**: nunca los escribas en el repo ni en el chat. Van solo en los paneles de Supabase, Render y GitHub (o en `backend/.env` local, que está en `.gitignore`).
2. **No inventes datos**: CUIT, teléfono, WhatsApp, dirección y precios los da el dueño. Si faltan, dejá el placeholder y avisá.
3. **Pagos**: primero todo con credenciales de **prueba** de Mercado Pago. Pasar a producción es decisión del dueño.
4. **Pedí confirmación** antes de acciones irreversibles: borrar tablas, correr SQL destructivo o cambiar el dominio.
5. **Verificá cada paso** con los comandos de la sección 6. No declares "desplegado" sin esa evidencia.

## 1. Qué se despliega

| Pieza | Carpeta | Dónde | Notas |
|---|---|---|---|
| Frontend (React 19 + Vite 8) | `ecomers/client` | GitHub Pages (Actions) o Vercel | Estático. Sin credenciales arranca en **modo demo**. |
| Backend (FastAPI) | `backend` | Render (`render.yaml`) | Checkout, webhook de Mercado Pago, comprobantes, admin, asistente IA. |
| Base de datos | `supabase/migrations` | Supabase | Postgres + RLS + Storage + Auth. |

Requisitos locales: **Node ≥ 22.22** (recomendado 24) y **Python 3.11 o 3.12**.

## 2. Camino rápido: demo pública sin credenciales (5 minutos)

Sirve para mostrarle la tienda a alguien hoy mismo. Catálogo de ejemplo, sin cuentas ni pagos, con la etiqueta "Modo demo" visible.

```bash
cd ecomers/client
npm ci
npm run check            # lint + 118 tests + build; tiene que pasar
```

- **Vercel**: importar el repo, *Root Directory* = `ecomers/client`, *Build* = `npm run build`, *Output* = `dist`, variable `VITE_BASE=/`. Sin más variables queda en modo demo. `vercel.json` ya resuelve las rutas de la SPA.
- **GitHub Pages**: ver paso 5.A sin cargar las variables `VITE_SUPABASE_*`.

Verificación: abrir la URL. Tiene que verse la home con productos y la etiqueta "Modo demo" abajo a la izquierda.

## 3. Base de datos (Supabase)

1. Crear un proyecto en https://supabase.com (región São Paulo, la más cercana a Argentina).
2. En **SQL Editor**, ejecutar **en este orden** (orden alfabético de archivo) todos los `.sql` de `supabase/migrations/`:

   ```
   001_productos.sql
   002_ordenes.sql
   003_negocio.sql
   004_admin_roles.sql
   004_checkout_real.sql
   005_admin_infra.sql
   005_product_specs.sql
   006_checkout_servidor.sql
   006_specs_iniciales.sql
   007_nuevos_productos.sql
   007_test_admin.sql
   008_mensajes_reclamos.sql
   009_suscriptores.sql
   010_indices_api.sql
   011_consolidacion_checkout.sql
   012_comprobantes_snapshot.sql
   013_seguridad.sql
   014_proveedores_compras.sql
   ```

   Son idempotentes (`if not exists` / `on conflict`). Ignorá `ecomers/client/supabase/migrations/`, que es una copia vieja.
3. Crear el primer administrador. El dueño se registra en la tienda y después se corre (reemplazando el email):

   ```sql
   update perfiles set rol = 'owner'
   where id = (select id from auth.users where email = 'EMAIL_DEL_DUENO');
   ```

4. Anotar de *Project Settings → API*: **Project URL**, **publishable/anon key** (pública, va al frontend) y **service_role key** (secreta, solo backend).

## 4. Backend (Render)

1. En https://render.com: *New → Blueprint* → elegir el repo. Render lee `render.yaml` y crea el servicio `hefestotech-api` (`rootDir: backend`).
2. Cargar las variables marcadas `sync: false`:

| Variable | Valor | Obligatoria |
|---|---|---|
| `SUPABASE_URL` | Project URL de Supabase | Sí |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | Sí |
| `MERCADOPAGO_ACCESS_TOKEN` | Access token (`TEST-...` para pruebas) | Para cobrar |
| `MP_WEBHOOK_SECRET` | Clave secreta del webhook (paso 4.4) | Para cobrar |
| `BACKEND_URL` | URL pública de este servicio, sin barra final (ej. `https://hefestotech-api.onrender.com`) | Sí |
| `FRONTEND_URL` | URL del frontend, sin barra final (ya viene `https://hefestotech.vercel.app`) | Sí |
| `CORS_EXTRA_ORIGINS` | Otros orígenes del front separados por coma (ej. GitHub Pages) | Si hay más de uno |
| `CRON_SECRET` | Cadena aleatoria larga (`openssl rand -hex 32`) | Recomendado |
| `LLM_PROVIDER` | `auto` (Groq → Gemini → OpenRouter), `gemini`, `groq`, `openrouter` o `mock` | No (default `mock` sin clave) |
| `GROQ_API_KEY` / `GEMINI_API_KEY` / `OPENROUTER_API_KEY` | Claves de los proveedores de IA (con `auto` se usa la cadena de las que existan) | Para el asistente |
| `LLM_API_KEY` / `LLM_MODEL` | Clave y modelo de un proveedor puntual (`GEMINI_MODEL`, `GROQ_MODEL` y `OPENROUTER_MODEL` los pisan) | Solo si no usás las claves por proveedor |
| `N8N_WEBHOOK_BASE_URL` | Base de los webhooks de n8n, sin barra final (ej. `https://tu-n8n/webhook`) | No (sin esto no avisa) |
| `N8N_WEBHOOK_SECRET` | Secreto compartido con la credencial *Header Auth* de n8n (`openssl rand -hex 32`) | No (sin esto no avisa) |
| `TIENDA_NOMBRE`, `TIENDA_CUIT`, `TIENDA_DIRECCION`, `TIENDA_EMAIL`, `TIENDA_TELEFONO` | Datos reales del comercio para el comprobante | Antes de vender |

3. Deploy. Verificación: `curl https://<BACKEND_URL>/` devuelve `{"mensaje": "La API de Hefesto Tech está funcionando correctamente"}`.
4. **Webhook de Mercado Pago**: en *Tus integraciones → Webhooks*, URL `https://<BACKEND_URL>/api/webhooks/mercadopago`, evento **Pagos**. Copiar la clave secreta a `MP_WEBHOOK_SECRET` y redeployar.
5. **Liberar reservas vencidas**: crear un *Cron Job* (Render o cron-job.org) cada 10 minutos:

   ```bash
   curl -X POST https://<BACKEND_URL>/api/checkout/liberar-expiradas -H "x-cron-secret: <CRON_SECRET>"
   ```

   Sin esto, el stock reservado por pagos abandonados no vuelve solo.

El plan gratis de Render se duerme tras 15 minutos sin uso: la primera compra tarda unos 30 segundos. Para vender en serio conviene el plan pago.

## 5. Frontend

Variables (todas **públicas**, nunca pongas acá la service_role):

| Variable | Valor |
|---|---|
| `VITE_SUPABASE_URL` | Project URL de Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | publishable/anon key |
| `VITE_API_URL` | `BACKEND_URL` del paso 4 |
| `VITE_BASE` | `/hefestotech/` en GitHub Pages, `/` en Vercel o en dominio propio |

### 5.A GitHub Pages (ya configurado)

1. Repo → *Settings → Pages → Source*: **GitHub Actions**.
2. *Settings → Secrets and variables → Actions → Variables*: crear `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_API_URL`.
3. Push a `main`: corre `.github/workflows/deploy-pages.yml` (build + publicación). `.github/workflows/ci.yml` corre lint, tests, build, `npm audit` y pytest.

### 5.B Vercel

*Root Directory* `ecomers/client`, *Build* `npm run build`, *Output* `dist`, las variables de arriba con `VITE_BASE=/`. Agregar la URL de Vercel a `CORS_EXTRA_ORIGINS` del backend.

La CSP de `index.html` se ajusta sola en el build: quita `localhost` y agrega el origen de `VITE_API_URL`. Si el backend cambia de dominio, rebuild del frontend.

## 6. Verificación final (obligatoria)

```bash
# Backend vivo
curl -s https://<BACKEND_URL>/

# Asistente: responde por streaming (SSE) con "event: inicio", "event: herramienta"
# (search_products) y "event: texto" con productos reales del catálogo
curl -sN -X POST https://<BACKEND_URL>/api/chat -H "Content-Type: application/json" -d "{\"mensajes\":[{\"rol\":\"usuario\",\"texto\":\"Busco un procesador AM5\"}]}" | head -c 600

# Checkout: sin productos válidos tiene que rechazar (422), no 500
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<BACKEND_URL>/api/checkout/crear -H "Content-Type: application/json" -d "{\"items\":[]}"
```

`/api/productos` devuelve 410 a propósito: el catálogo se lee de Supabase, no del backend.

En el navegador, sobre la URL del frontend:

- [ ] La home carga con productos reales y **sin** la etiqueta "Modo demo".
- [ ] `/productos` filtra por categoría y marca; la URL cambia con los filtros.
- [ ] Agregar al carrito → *Finalizar compra* → redirige a Mercado Pago (sandbox) con el total del servidor.
- [ ] Pago de prueba aprobado → vuelve a `/checkout?orden_id=...&pago=exito` y la orden figura **pagada** (la marca el webhook).
- [ ] El dueño entra a `/admin` y ve el pedido.
- [ ] Sin errores en la consola del navegador.

Tarjetas y usuarios de prueba: https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/integration-test

## 7. Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| Aparece "Modo demo" en producción | Faltan `VITE_SUPABASE_*` en el build | Cargar las variables y rebuild |
| Página de error "Algo salió mal" | Error de runtime | Ver la consola; la pantalla tiene "Recargar" |
| Recargar una ruta da 404 (Pages) | Falta `public/404.html` en `dist` | Ya está versionado; verificar que el build lo copie |
| `CORS` en la consola | Origen del front no autorizado | Agregarlo a `FRONTEND_URL` o `CORS_EXTRA_ORIGINS` |
| `Refused to connect` (CSP) | `VITE_API_URL` vacío o distinto en el build | Rebuild con la variable correcta |
| El pago queda "pendiente" para siempre | Webhook mal configurado o sin `MP_WEBHOOK_SECRET` | Paso 4.4 y revisar logs de Render |
| 503 "Pagos no configurados" | Falta `MERCADOPAGO_ACCESS_TOKEN` o `BACKEND_URL` | Paso 4.2 |
| Escrituras del admin bloqueadas | No hay usuario con rol `owner` o `admin` | Paso 3.3 |

## 8. Pendientes que necesitan al dueño

Datos del comercio (`TIENDA_*`), precios y stock de los productos en $0 (migración 007), marcar como verificadas las specs del armador (`product_specs.verified = true`) y revisar los textos legales con un profesional. Detalle en `docs/ROADMAP.md`.
