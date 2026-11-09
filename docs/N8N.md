# Automatizaciones con n8n

El backend avisa a n8n cuando pasa algo en la tienda; n8n manda los mensajes (WhatsApp al cliente, mails de ofertas, aviso al dueño). Es opcional: sin las variables de abajo el backend funciona igual y no manda nada.

```
Mercado Pago ─► backend ─► mailer.notificar_estado ─┬─► email (Resend, como antes)
Panel admin  ─►            (cambio de estado)        └─► n8n_hook ─► n8n /hefestotech-pedidos ─► WhatsApp
Panel admin ─► crear cupón ─► n8n_hook ─► n8n /hefestotech-ofertas ─► mail a suscriptores + WhatsApp al dueño
n8n (cada día 10:00) ─► Supabase productos con descuento ─► mismo flujo de ofertas
GitHub Actions (liberar vencidos) ─► Gmail ─► email a Hefestotech077@gmail.com
```

## Puesta en marcha

1. **n8n**: importar `n8n/hefestotech-pedidos-whatsapp.json` y `n8n/hefestotech-ofertas.json` (*Workflows → Import from file*). El flujo `n8n/hefestotech-alertas.json` es una alternativa opcional (Telegram): el liberador de pedidos vencidos ya manda email directo desde GitHub Actions.
2. **Credenciales en n8n**
   - *Header Auth* llamada `Hefesto Secret (X-Hefesto-Secret)`: nombre `X-Hefesto-Secret`, valor = un secreto largo (`openssl rand -hex 32`).
   - WhatsApp Business Cloud API (token de Meta) y Gmail OAuth2.
   - Supabase con la **service role** (solo para leer `suscriptores`; esa tabla no tiene policies de lectura).
3. **Completar placeholders** en los nodos de pedidos/ofertas: `TU_PHONE_NUMBER_ID` si se usa el nodo oficial de Meta. El proyecto Supabase, la anon key y el WhatsApp del dueño ya están cargados. El flujo de alertas por Telegram (opcional) usa `TU_TELEGRAM_BOT_TOKEN` y `TU_TELEGRAM_CHAT_ID`.
4. **Activar** los workflows que uses (la memoria de ofertas ya avisadas solo persiste con el workflow activo).
5. **Backend** (Render → Environment):

   | Variable | Valor |
   |---|---|
   | `N8N_WEBHOOK_BASE_URL` | `https://hefestotech.app.n8n.cloud/webhook` (sin barra final; para probar usá `/webhook-test`) |
   | `N8N_WEBHOOK_SECRET` | El mismo secreto de la credencial Header Auth |

   Sin las dos, no se envía nada. En `render.yaml` están declaradas con `sync: false`; si el servicio no se creó desde el Blueprint, cargalas a mano.

6. **GitHub Actions** (*Settings → Secrets and variables → Actions*): cargar la **variable** `GMAIL_USER=Hefestotech077@gmail.com`, la **variable** `MAIL_TO=Hefestotech077@gmail.com` y el **secreto** `GMAIL_APP_PASSWORD` (contraseña de aplicación de Gmail). Sin la contraseña, el liberador funciona igual pero no manda el aviso por email.

## Eventos

Cuerpo común: `{ "evento", "evento_id", "ocurrio_at", "datos" }`. Encabezado `X-Hefesto-Secret`.

**`pedido.estado`** → `/hefestotech-pedidos`. Se emite cuando el backend avisa al cliente: pagos y reembolsos confirmados por Mercado Pago, y los cambios que se hacen desde el panel (preparación, enviada, entregada, cancelada, reembolsada). Las cancelaciones automáticas por pago rechazado o reserva vencida no avisan, para no mandar mensajes a checkouts abandonados. Si el seguimiento se carga después de marcar el pedido como enviado, se emite un segundo aviso con el código (el `evento_id` cambia).

```json
{
  "pedido_id": "uuid", "numero": "HT-AAAAAAAA", "estado": "pagada",
  "cliente": { "nombre": "Ana", "email": "ana@ej.com", "telefono": "03875551234" },
  "total": 12345.0, "moneda": "ARS",
  "items": [{ "nombre": "RAM 16GB", "cantidad": 2, "precio_unitario": 5000.0 }],
  "envio": { "transportista": "Andreani", "codigo": "ABC123", "url": "https://..." },
  "link_pedido": "https://.../pedido/<id>#token=..."
}
```

**`oferta.creada`** → `/hefestotech-ofertas`. Se emite al crear un cupón **activo** desde el panel. `valor` es el porcentaje (1-100) o pesos ARS si el tipo es `monto`.

```json
{ "codigo": "HOT10", "tipo": "porcentaje", "valor": 10, "min_compra": 50000.0,
  "usos_max": 50, "vence_at": null, "tienda_url": "https://..." }
```

**`alerta.workflow`** → `/hefestotech-alertas` (opcional, solo si usás el flujo de Telegram). El workflow de GitHub Actions que libera pedidos vencidos ya no llama a n8n: manda un **email directo por Gmail SMTP** a `Hefestotech077@gmail.com` cuando libera al menos un pedido o cuando la corrida falla. Las corridas sin pedidos liberados no mandan nada para no generar 96 mails por día.

## Aviso por email del liberador (Gmail)

El workflow `.github/workflows/liberar-expiradas.yml` envía el aviso con `smtplib` desde GitHub Actions, sin pasar por n8n ni por un proveedor externo.

1. En la cuenta `Hefestotech077@gmail.com`, activar la verificación en dos pasos y crear una **contraseña de aplicación** (Google → Seguridad → Contraseñas de aplicaciones).
2. Guardarla solo en GitHub: *Settings → Secrets and variables → Actions* → **secreto** `GMAIL_APP_PASSWORD`.
3. Cargar las **variables** `GMAIL_USER=Hefestotech077@gmail.com` y `MAIL_TO=Hefestotech077@gmail.com` (el workflow ya las usa por defecto, pero conviene dejarlas explícitas).
4. Probar con *Run workflow* y `forzar_aviso=true`: llega un mail de prueba aunque no haya pedidos vencidos.

El correo sale solo si `liberadas > 0`, si el job falló o si se fuerza la prueba. Si falta la contraseña, el liberador funciona igual y solo imprime el aviso en el log de Actions.

## Flujo alternativo de Telegram (opcional)

`n8n/hefestotech-alertas.json` queda como alternativa si algún día preferís Telegram en vez de email. Importarlo, completar `TU_TELEGRAM_BOT_TOKEN` (de `@BotFather`) y `TU_TELEGRAM_CHAT_ID`, y apuntar el workflow de GitHub a `N8N_WEBHOOK_BASE_URL` + `/hefestotech-alertas`. No hace falta para el aviso por email.

## MCP de n8n (OpenCode)

La instancia es `https://hefestotech.app.n8n.cloud`. El servidor MCP está en `https://hefestotech.app.n8n.cloud/mcp-server/http` y se configura una sola vez en `~/.config/opencode/opencode.jsonc` con un **bearer token** (no OAuth):

```jsonc
{
  "mcp": {
    "servers": {
      "n8n": {
        "type": "remote",
        "url": "https://hefestotech.app.n8n.cloud/mcp-server/http",
        "oauth": false,
        "headers": { "Authorization": "Bearer <TOKEN_N8N>" }
      }
    }
  }
}
```

El token se genera en n8n → *Settings → MCP Server* y se guarda en `backend/.env` como `TOKEN_N8N=...` (nunca en el repo ni en el chat). Es un bearer del MCP, no la API pública: `/api/v1` sigue devolviendo 401. Con eso el agente puede importar, editar, publicar y ejecutar workflows.

## Notas

- **No se duplica el email.** El mail al cliente sigue saliendo por Resend. El nodo *Enviar Gmail* del workflow de pedidos viene desactivado: activalo solo si no usás Resend.
- **Cuidado con los cupones de prueba.** Crear un cupón activo desde el panel dispara el workflow de ofertas: manda mail a **todos** los suscriptores. Para probar, dejá el workflow inactivo o usá una instancia con una lista de prueba.
- **Teléfonos.** El workflow normaliza a formato WhatsApp Argentina (`549` + área + número). Si el número no se puede normalizar con seguridad, no se envía. Conviene guardar el teléfono como área + número, sin `15`.
- **Plantillas de WhatsApp.** Los mensajes iniciados por el negocio fuera de las 24 h desde el último mensaje del cliente requieren plantillas aprobadas por Meta. Los nodos vienen con texto libre: para producción, crear las plantillas y cambiar a *Send Template*.
- **WhatsApp de marketing.** Las ofertas se mandan por mail a `suscriptores` y por WhatsApp solo al dueño. Para escribirles por WhatsApp a los clientes hace falta registrar su consentimiento (hoy no existe). Los mails llevan un aviso de baja (respondiendo "BAJA"); no hay un enlace de baja automático.
- **Descuentos de producto.** El panel no edita `descuento_porcentaje`; si lo cargás directo en Supabase, el workflow diario lo detecta y avisa. La primera corrida solo memoriza lo que ya estaba en oferta.
- **Seguridad.** El aviso no incluye datos de pago ni la service role. `link_pedido` lleva el `acceso_token` del cliente (igual que el mail): tratá la instancia de n8n y su historial de ejecuciones como datos sensibles.
- **Fallos.** El envío corre en un hilo con timeout de 5 s y los errores solo se loguean; n8n caído no afecta a cobros ni a cambios de estado. No hay reintentos: si n8n estuvo caído, ese aviso se pierde.
- **Avisos del liberador.** El workflow de GitHub manda un email directo por Gmail a `Hefestotech077@gmail.com`; n8n no participa. Si falta la contraseña de aplicación, el liberador igual termina y el aviso queda solo en el log de Actions.
- **Pruebas.** `backend/tests/test_n8n_hook.py` (sin red). Prueba manual: con el workflow en modo *Listen for test event*, `N8N_WEBHOOK_BASE_URL=https://TU-N8N/webhook-test`, y cambiar el estado de un pedido de prueba desde el panel.
