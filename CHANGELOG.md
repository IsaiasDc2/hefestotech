# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [1.0.0] · 2026-10-17

### Stack
- React 18 → **19.3**, Vite 5 → **8.3** (Rolldown), React Router 6 → **8.4** (`react-router-dom` reemplazado por `react-router`), Zustand 4 → **5**, Supabase JS 2.118.
- ESLint 8 → **10** con configuración plana y reglas del React Compiler (`eslint-plugin-react-hooks` 7). Lint en 0 errores y 0 avisos.
- `npm audit`: de 11 vulnerabilidades (8 altas) a **0**. Se quitó `gh-pages`; el deploy pasa a GitHub Actions.
- Inter y Oswald variables autoalojadas (`@fontsource-variable`), sin Google Fonts.

### Agregado
- **Modo demo**: cliente Supabase en memoria con el catálogo de las migraciones. La tienda se puede mostrar sin credenciales (`npm run dev:demo`) y lleva una etiqueta fija de "Modo demo".
- **Catálogo** (`/productos`) reescrito: filtros en la URL (compartibles), categoría, marca, rango de precio, stock y ofertas con conteos, cinco órdenes, chips de filtros activos, paginación "Mostrar más" y filtros en un `<dialog>` nativo en móvil.
- **Ficha de producto**: selector de cantidad con tope de stock, código del producto, aviso de últimas unidades, "precio final con IVA", productos relacionados y consulta por WhatsApp cuando falta precio o stock.
- **Mi cuenta**: historial real de pedidos con estado y acceso al comprobante; pestañas en la URL.
- Productos con precio 0 (pendientes de carga) muestran "Precio a confirmar" y no se pueden comprar.
- Tests: 93 en Vitest (frontend) y 21 en pytest (backend). CI en GitHub Actions.

### Corregido
- **F01** (crítico): los invitados recibían 403 al volver de Mercado Pago, porque la consulta no traía `acceso_token`.
- **F02** (crítico): el reintento de pago desde una orden cancelada podía reservar stock dos veces o dejarlo trabado si fallaba Mercado Pago. Ahora usa compare-and-set y libera el stock ante cualquier error.
- **F03**: si el pago falla o se cancela, el carrito se restaura.
- **F05**: los favoritos de las tarjetas se guardan de verdad y se sincronizan en la misma pestaña (contador del header incluido).
- **F06/F12**: catálogo, home, ficha y armador muestran solo productos activos y fuera de la papelera.
- **F09**: el texto de envío gratis decía $99.999; el umbral real es $150.000.
- **F10/F11**: filtros y orden por precio final; se quitó "6 cuotas sin interés" fijo de la ficha.
- **F15**: el carrito no supera el stock conocido; el armador agrega todo en un solo paso.
- La grilla de `/productos` quedaba invisible (opacidad 0) en desarrollo por un observer desconectado.
- Calculadora de cuotas con tres decimales ("$86.666,667").
- Seguridad: token de invitado por header (`X-Orden-Token`) en vez de la URL; QR del comprobante generado en el navegador (antes mandaba el token a un servicio externo); email validado en checkout; imágenes del admin solo `https` o rutas internas; CSP de producción sin `localhost`.
- Accesibilidad: carrito cerrado `inert`, anuncios de cantidad con contexto, etiquetas reales en el login, botones de 44 px, `autocomplete` en el checkout, `lang="es-AR"`.

### Rendimiento
- Chunks separados para React, Supabase e íconos (caché entre deploys).
- Precarga de la imagen principal del banner y carga prioritaria de las primeras tarjetas.
- Caché de 60 s del catálogo entre home, listado y ficha.
