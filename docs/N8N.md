# Automatizaciones con n8n

El backend avisa a n8n cuando pasa algo en la tienda; n8n manda los mensajes (WhatsApp al cliente, mails de ofertas, aviso al dueño). Es opcional: sin las variables de abajo el backend funciona igual y no manda nada.

```
Mercado Pago ─► backend ─► mailer.notificar_estado ─┬─► email (Resend, como antes)
Panel admin  ─►            (cambio de estado)        └─► n8n_hook ─► n8n /hefestotech-pedidos ─► WhatsApp
Panel admin ─► crear cupón ─► n8n_hook ─► n8n /hefestotech-ofertas ─► mail a suscriptores + WhatsApp al dueño
n8n (cada día 10:00) ─► Supabase productos con descuento ─► mismo flujo de ofertas
```

## Puesta en marcha

1. **n8n**: importar `n8n/hefestotech-pedidos-whatsapp.json` y `n8n/hefestotech-ofertas.json` (*Workflows → Import from file*).
2. **Credenciales en n8n**
   - *Header Auth* llamada `Hefesto Secret (X-Hefesto-Secret)`: nombre `X-Hefesto-Secret`, valor = un secreto largo (`openssl rand -hex 32`).
   - WhatsApp Business Cloud API (token de Meta) y Gmail OAuth2.
   - Supabase con la **service role** (solo para leer `suscriptores`; esa tabla no tiene policies de lectura).
3. **Completar placeholders** en los nodos: `TU_PHONE_NUMBER_ID`, `TU_NUMERO_WHATSAPP` (tu número, para el aviso al dueño), `TU_PROYECTO` y `TU_SUPABASE_ANON_KEY` (el HTTP de ofertas; la anon key es pública).
4. **Activar** ambos workflows (la memoria de ofertas ya avisadas solo persiste con el workflow activo).
5. **Backend** (Render → Environment):

   | Variable | Valor |
   |---|---|
   | `N8N_WEBHOOK_BASE_URL` | `https://TU-N8N/webhook` (sin barra final; para probar usá `/webhook-test`) |
   | `N8N_WEBHOOK_SECRET` | El mismo secreto de la credencial Header Auth |

   Sin las dos, no se envía nada. En `render.yaml` están declaradas con `sync: false`; si el servicio no se creó desde el Blueprint, cargalas a mano.

## Eventos

Cuerpo común: `{ "evento", "evento_id", "ocurrio_at", "datos" }`. Encabezado `X-Hefesto-Secret`.

**`pedido.estado`** → `/hefestotech-pedidos`. Se emite cuando el backend avisa al cliente: pagos y reembolsos confirmados por Mercado Pago, y los cambios que se hacen desde el panel (preparación, enviada, entregada, cancelada, reembolsada). Las cancelaciones automáticas por pago rechazado o reserva vencida no avisan, para no mandar mensajes a checkouts abandonados.

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

## Notas

- **No se duplica el email.** El mail al cliente sigue saliendo por Resend. El nodo *Enviar Gmail* del workflow de pedidos viene desactivado: activalo solo si no usás Resend.
- **Teléfonos.** El workflow normaliza a formato WhatsApp Argentina (`549` + área + número). Si el número no se puede normalizar con seguridad, no se envía. Conviene guardar el teléfono como área + número, sin `15`.
- **Plantillas de WhatsApp.** Los mensajes iniciados por el negocio fuera de las 24 h desde el último mensaje del cliente requieren plantillas aprobadas por Meta. Los nodos vienen con texto libre: para producción, crear las plantillas y cambiar a *Send Template*.
- **WhatsApp de marketing.** Las ofertas se mandan por mail a `suscriptores` y por WhatsApp solo al dueño. Para escribirles por WhatsApp a los clientes hace falta registrar su consentimiento (hoy no existe). Los mails llevan un aviso de baja (respondiendo "BAJA"); no hay un enlace de baja automático.
- **Descuentos de producto.** El panel no edita `descuento_porcentaje`; si lo cargás directo en Supabase, el workflow diario lo detecta y avisa. La primera corrida solo memoriza lo que ya estaba en oferta.
- **Seguridad.** El aviso no incluye datos de pago ni la service role. `link_pedido` lleva el `acceso_token` del cliente (igual que el mail): tratá la instancia de n8n y su historial de ejecuciones como datos sensibles.
- **Fallos.** El envío corre en un hilo con timeout de 5 s y los errores solo se loguean; n8n caído no afecta a cobros ni a cambios de estado. No hay reintentos: si n8n estuvo caído, ese aviso se pierde.
- **Pruebas.** `backend/tests/test_n8n_hook.py` (sin red). Prueba manual: con el workflow en modo *Listen for test event*, `N8N_WEBHOOK_BASE_URL=https://TU-N8N/webhook-test`, y cambiar el estado de un pedido de prueba desde el panel.
