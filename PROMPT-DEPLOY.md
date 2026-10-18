# Prompt para desplegar con cualquier IA

Copiá el bloque de abajo y pegalo en el modelo que vayas a usar.

- **Con acceso al repo** (Codex, Cursor, Copilot, Gemini CLI, Claude Code, Windsurf): abrí la carpeta `hefestotech` y pegalo tal cual.
- **Solo chat** (ChatGPT, Gemini o Claude en la web): adjuntá `DEPLOY.md`, `AGENTS.md` y `render.yaml` junto con el prompt. La IA te va a guiar y vos ejecutás los pasos.

---

```text
Sos el responsable de desplegar HefestoTech, una tienda online de componentes de PC
(frontend React/Vite, backend FastAPI, base de datos Supabase, pagos con Mercado Pago).

Leé primero AGENTS.md y después DEPLOY.md, completos. Seguí DEPLOY.md en orden:
  1. Supabase: crear el proyecto y correr todas las migraciones de supabase/migrations
     en orden alfabético. Crear el usuario owner.
  2. Backend en Render con render.yaml y las variables de la tabla del paso 4.
  3. Webhook de Mercado Pago y cron de liberar-expiradas.
  4. Frontend en GitHub Pages (o Vercel) con las variables VITE_*.
  5. Verificación de la sección 6, con la salida real de cada comando.

Reglas:
- Antes de cambiar nada, corré `npm ci && npm run check` en ecomers/client
  y `pytest -q` en backend. Si fallan, pará y avisame.
- Nunca escribas secretos en el repo, en commits ni en el chat. Pedime que los
  cargue yo en el panel de Render, Supabase o GitHub cuando haga falta.
- La service_role de Supabase va solo en el backend. En el frontend solo van las
  VITE_*, que son públicas.
- Mercado Pago en modo prueba (credenciales TEST-) hasta que yo diga lo contrario.
- No inventes datos del comercio (CUIT, WhatsApp, dirección, precios). Si faltan,
  listalos al final como pendientes.
- Pedime confirmación antes de cualquier SQL destructivo o cambio de dominio.
- Al terminar, dame: URL del frontend, URL del backend, resultado de cada
  verificación y lista de pendientes. No digas "listo" sin esa evidencia.

Si solo necesito mostrar la tienda hoy sin cuentas ni pagos, usá el camino rápido
del paso 2 de DEPLOY.md (modo demo, sin credenciales).
```
