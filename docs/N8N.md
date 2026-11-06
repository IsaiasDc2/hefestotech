# Automatizaciones con n8n

El backend avisa a n8n cuando pasa algo en la tienda; n8n manda los mensajes (WhatsApp al cliente, mails de ofertas, aviso al dueño). Es opcional: sin las variables de abajo el backend funciona igual y no manda nada.

```
Mercado Pago ─► backend ─► mailer.notificar_estado ─┬─► email (Resend, como antes)
Panel admin  ─►            (cambio de estado)        └─► n8n_hook ─► n8n /hefestotech-pedidos ─► WhatsApp
Panel admin ─► crear cupón ─► n8n_hook ─► n8n /hefestotech-ofertas ─► mail a suscriptores + WhatsApp al dueño
n8n (cada día 10:00) ─► Supabase productos con descuento ─► mismo flujo de ofertas
GitHub Actions (liberar vencidos) ─► n8n /hefestotech-alertas ─► CallMeBot ─► WhatsApp al dueño
```

## Puesta en marcha

1. **n8n**: importar `n8n/hefestotech-pedidos-whatsapp.json`, `n8n/hefestotech-ofertas.json` y `n8n/hefestotech-alertas-whatsapp.json` (*Workflows → Import from file*).
2. **Credenciales en n8n**
   - *Header Auth* llamada `Hefesto Secret (X-Hefesto-Secret)`: nombre `X-Hefesto-Secret`, valor = un secreto largo (`openssl rand -hex 32`).
   - WhatsApp Business Cloud API (token de Meta) y Gmail OAuth2.
   - Supabase con la **service role** (solo para leer `suscriptores`; esa tabla no tiene policies de lectura).
3. **Completar placeholders** en los nodos: `TU_CALLMEBOT_API_KEY` en el flujo de alertas (ver abajo) y `TU_PHONE_NUMBER_ID` si algún día se usa el nodo oficial de Meta. El proyecto Supabase, la anon key y el WhatsApp del dueño ya están cargados.
4. **Activar** los tres workflows (la memoria de ofertas ya avisadas solo persiste con el workflow activo).
5. **Backend** (Render → Environment):

   | Variable | Valor |
   |---|---|
   | `N8N_WEBHOOK_BASE_URL` | `https://hefestotech.app.n8n.cloud/webhook` (sin barra final; para probar usá `/webhook-test`) |
   | `N8N_WEBHOOK_SECRET` | El mismo secreto de la credencial Header Auth |

   Sin las dos, no se envía nada. En `render.yaml` están declaradas con `sync: false`; si el servicio no se creó desde el Blueprint, cargalas a mano.

6. **GitHub Actions** (*Settings → Secrets and variables → Actions*): cargar la **variable** `N8N_WEBHOOK_BASE_URL` y el **secreto** `N8N_WEBHOOK_SECRET` con los mismos valores. Sin esto, el liberador de pedidos vencidos funciona igual pero no manda el aviso por WhatsApp.

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
  "link_pedido": "https://.../pedido/<id>?token=..."
}
```

**`oferta.creada`** → `/hefestotech-ofertas`. Se emite al crear un cupón **activo** desde el panel. `valor` es el porcentaje (1-100) o pesos ARS si el tipo es `monto`.

```json
{ "codigo": "HOT10", "tipo": "porcentaje", "valor": 10, "min_compra": 50000.0,
  "usos_max": 50, "vence_at": null, "tienda_url": "https://..." }
```

**`alerta.workflow`** → `/hefestotech-alertas`. Lo emite el workflow de GitHub Actions que libera pedidos vencidos, solo cuando liberó al menos un pedido o cuando la corrida falló. El destinatario es siempre el WhatsApp del dueño (`5493875029222`); las corridas sin pedidos liberados no mandan nada para no generar 96 mensajes por día.

```json
{ "workflow": "Liberar pedidos expirados", "resultado": "success",
  "liberadas": 2, "revisadas": 6, "telefono": "5493875029222",
  "run_url": "https://github.com/.../actions/runs/123" }
```

## CallMeBot (sin WhatsApp Business)

El aviso del liberador no usa la API de Meta: el flujo `hefestotech-alertas-whatsapp.json` llama a **CallMeBot**, que manda un WhatsApp al número que activó el bot. Es gratis y solo para uso personal.

1. Desde el WhatsApp del dueño (`+54 9 387 502-9222`), agregar el contacto **+34 684 728 023** y mandarle el mensaje `I allow callmebot to send me messages`.
2. El bot responde con una **API key**. Guardarla en `backend/.env` como `CALLMEBOT_API_KEY=...` (ese archivo no se commitea).
3. Pegar esa key en el nodo *Enviar WhatsApp (CallMeBot)* del flujo, o dejar que el agente la cargue desde `.env`.
4. Activar el workflow. La llamada queda `https://api.callmebot.com/whatsapp.php?phone=+5493875029222&text=...&apikey=...`.

Solo puede mandar al número que activó el bot (no a clientes), solo texto y sin plantillas. Para mensajes masivos o a clientes hace falta la API oficial de Meta o un proveedor como Twilio.

## MCP de n8n (OpenCode)

La instancia es `https://hefestotech.app.n8n.cloud`. El servidor MCP está en `https://hefestotech.app.n8n.cloud/mcp-server/http` y se configura una sola vez en `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "mcp": {
    "servers": {
      "n8n": { "type": "remote", "url": "https://hefestotech.app.n8n.cloud/mcp-server/http" }
    }
  }
}
```

Usa OAuth: en OpenCode, `/mcps` → `n8n` → iniciar sesión. Con eso el agente puede importar, editar, activar y ejecutar workflows sin manejar una API key. Si el estado queda en `needs_auth`, falta ese login.

## Notas

- **No se duplica el email.** El mail al cliente sigue saliendo por Resend. El nodo *Enviar Gmail* del workflow de pedidos viene desactivado: activalo solo si no usás Resend.
- **Cuidado con los cupones de prueba.** Crear un cupón activo desde el panel dispara el workflow de ofertas: manda mail a **todos** los suscriptores. Para probar, dejá el workflow inactivo o usá una instancia con una lista de prueba.
- **Teléfonos.** El workflow normaliza a formato WhatsApp Argentina (`549` + área + número). Si el número no se puede normalizar con seguridad, no se envía. Conviene guardar el teléfono como área + número, sin `15`.
- **Plantillas de WhatsApp.** Los mensajes iniciados por el negocio fuera de las 24 h desde el último mensaje del cliente requieren plantillas aprobadas por Meta. Los nodos vienen con texto libre: para producción, crear las plantillas y cambiar a *Send Template*.
- **WhatsApp de marketing.** Las ofertas se mandan por mail a `suscriptores` y por WhatsApp solo al dueño. Para escribirles por WhatsApp a los clientes hace falta registrar su consentimiento (hoy no existe). Los mails llevan un aviso de baja (respondiendo "BAJA"); no hay un enlace de baja automático.
- **Descuentos de producto.** El panel no edita `descuento_porcentaje`; si lo cargás directo en Supabase, el workflow diario lo detecta y avisa. La primera corrida solo memoriza lo que ya estaba en oferta.
- **Seguridad.** El aviso no incluye datos de pago ni la service role. `link_pedido` lleva el `acceso_token` del cliente (igual que el mail): tratá la instancia de n8n y su historial de ejecuciones como datos sensibles.
- **Fallos.** El envío corre en un hilo con timeout de 5 s y los errores solo se loguean; n8n caído no afecta a cobros ni a cambios de estado. No hay reintentos: si n8n estuvo caído, ese aviso se pierde.
- **Avisos del liberador.** El workflow de GitHub manda `alerta.workflow` a n8n y n8n lo reenvía al WhatsApp del dueño. Si n8n está caído, el liberador igual termina: el aviso se pierde y queda el error en el log de Actions.
- **Pruebas.** `backend/tests/test_n8n_hook.py` (sin red). Prueba manual: con el workflow en modo *Listen for test event*, `N8N_WEBHOOK_BASE_URL=https://TU-N8N/webhook-test`, y cambiar el estado de un pedido de prueba desde el panel.
