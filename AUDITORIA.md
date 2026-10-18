# AUDITORÍA de seguridad — HefestoTech (rama `feat/auditoria-admin`)

Criterio: OWASP Top 10 2021. Fuentes declaradas: `DESIGN.md` (solo sistema visual,
sin efecto en esta tarea), migraciones `001/002/003`, `backend/main.py`,
`backend/.env` (no se muestra ni versiona), `npm audit` del cliente.
Prohibido cumplido: no se tocó `src/`, no se commiteó, no se ejecutó contra producción.

## Hallazgos por severidad

### ALTA

| # | OWASP | Hallazgo / evidencia | Estado |
|---|---|---|---|
| A1 | A01:2021 Control de accesos | Escritura abierta a cualquier `authenticated` en `productos`, `categorias` (`001_productos.sql:44-50`), `proveedores`, `producto_proveedor` (`003_negocio.sql:50-52,67-69`), `storage.objects` (`001:60-68`) y `movimientos_stock` (`003:87-89`). Cualquier usuario logueado podía modificar catálogo, stock e imágenes. | **Corregido** en `004_admin_roles.sql`: policies `escritura/actualizar/borrar admin` con `public.is_admin()`; `SELECT` público/autenticado intacto |
| A2 | A07:2021 Autenticación/Autorización | Sin rol admin: `perfiles` sin columna `rol`, sin `is_admin()`/`has_permission` (`003_negocio.sql:6-14`). Imposible distinguir dueño de cliente. | **Corregido** en `004`: `perfiles.rol` (`admin\|cliente`, default `cliente`), `is_admin()` + `has_permission(text)` base, `SECURITY DEFINER` con `search_path = public` fijo, `GRANT EXECUTE` a `authenticated` |
| A3 | A03:2021 Inyección | `/api/chat` aceptaba texto vacío o ilimitado (`main.py` anterior, `MensajeUsuario.texto` sin validar → abuso de costo del LLM / prompt gigante). `/api/crear-preferencia` aceptaba `cantidad <= 0` y `precio_unitario <= 0` (montos inválidos a MercadoPago). | **Corregido**: chat exige 1–2000 caracteres (strip); preferencia exige título 1–200, `1 <= cantidad <= 100`, `0 < precio <= 1e9` |
| A4 | A04:2021 Diseño inseguro | Sin rate-limit en `/api/chat` ni `/api/crear-preferencia`: automatizables para fundir cuota de IA o generar preferencias en masa. | **Corregido**: límite en memoria por IP, 20 req/min (chat) y 10 req/min (preferencia), respuesta `429` genérica |

### MEDIA

| # | OWASP | Hallazgo / evidencia | Estado |
|---|---|---|---|
| M1 | A09:2021 Fallos de registro/monitoreo | `print(f"...{e}...")` en `/api/chat` y `return {"error": str(e)}` en `/api/crear-preferencia` (`main.py` anterior): trazas y detalle del proveedor llegaban a logs/respuesta. | **Corregido**: logs genéricos sin excepción ni texto del usuario; pagos devuelven `HTTPException 502` genérico |
| M2 | A06:2021 Componentes vulnerables | `npm audit` (cliente `ecomers/client`): **11 vulnerabilidades (8 high, 3 moderate)**. Sin cambios aplicados por orden explícita. Detalle abajo. | **Pendiente** (decisión del dueño; ver "Qué falta") |
| M3 | A05:2021 Mala configuración | No existía `backend/.env.example`: riesgo de copiar/commitear el `.env` real. CORS ya correcto (orígenes cerrados, `main.py:17-27`), sin cambios. `.env` ignorado en `.gitignore` (líneas 1 y 23). | **Corregido**: `backend/.env.example` creado solo con placeholders |

### BAJA / ENDURECIMIENTO

| # | Hallazgo / evidencia | Estado |
|---|---|---|
| B1 | Faltaban índices (`movimientos_stock.created_at`, compuesto con `producto_id`) y búsqueda trigram en `productos(nombre)` (búsquedas `LIKE %..%` lentas = superficie de DoS de lectura) | **Corregido** en `004`: `pg_trgm` + GIN, `idx_movimientos_created`, `idx_movimientos_producto_created`; se reafirman `idx_ordenes_user`, `idx_orden_items_orden`, `idx_movimientos_producto` |
| B2 | `favoritos` ya tenía PK compuesta `(user_id, producto_id)` (`003:96`), unicidad garantizada | **Reafirmado** en `004` con índice único explícito `uq_favoritos_user_producto` |
| B3 | Secretos (`GEMINI_API_KEY`, `MERCADOPAGO_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`) solo en `backend/.env` local, sin valores en el repo | **OK**, sin cambios; nunca mostrar ni commitear |

## `npm audit` — detalle (solo listado, nada actualizado)

`npm audit` en `ecomers/client` → `11 vulnerabilities (3 moderate, 8 high)`:

| Paquete | Severidad | Aviso |
|---|---|---|
| `braces` (vía `micromatch` → `fast-glob` → `globby` → `gh-pages`) | high | Stack-exhaustion DoS por patrones anidados (`GHSA-vfj7-8cjw-p6xm`); fix exigiría `gh-pages@6.1.1` (breaking) |
| `playwright < 1.55.1` | high | Instala browsers sin verificar certificado SSL (`GHSA-7mvr-c777-76hp`); fix con `npm audit fix` |
| `source-map-js 1.0.0–1.2.1` | high | DoS del event-loop por offsets (`GHSA-68fv-2mgg-jv7q`); fix con `npm audit fix` |
| Resto hasta totalizar 8 high | high | Ver salida completa de `npm audit` (cadenas de `gh-pages`/`fast-glob`) |
| `esbuild <= 0.24.2` (vía `vite`) | moderate | Dev-server acepta peticiones de cualquier sitio (`GHSA-67mh-4wv8-2f99`); fix exigiría `vite@8.3.4` (breaking) |
| `react-router 6.0.0–7.17.0` / `react-router-dom` | moderate (×2 avisos) | Open redirect por backslash (`GHSA-wrjc-x8rr-h8h6`, bypass CVE-2025-68470) e inyección de constructor en `deserializeErrors` SSR (`GHSA-337j-9hxr-rhxg`); fix exigiría `react-router-dom@7.18.4` (breaking) |

## Verificación ejecutada

- `python -c "import main"` en `backend/` → `import ok: True`; rutas `/`, `/api/productos`, `/api/chat`, `/api/crear-preferencia` presentes.
- Validadores: vacío/espacios/+2000 en chat y `titulo` vacío / `cantidad 0` / `precio 0 o negativo` → todos rechazados con `ValidationError`; caso válido aceptado.
- Rate-limit: 11 llamadas con límite 10 → `HTTPException 429` en la 11.ª.
- Migración `004` verificada solo por lectura (idempotente: `if not exists` / `drop policy if exists`); **no aplicada**: requiere SQL Editor del Dashboard.

## Qué falta (dueño)

1. **Primer admin por SQL del dueño** (las policies nuevas bloquean escrituras hasta que exista un admin):
   ```sql
   update perfiles set rol = 'admin'
   where id = (select id from auth.users where email = 'EMAIL_DEL_DUEÑO');
   ```
2. Aplicar `004_admin_roles.sql` en Dashboard → SQL Editor → Run (después de 001–003) y correr las consultas de verificación del pie del archivo.
3. Decidir `npm audit`: `npm audit fix` (playwright, source-map-js) y evaluar los breaking (`gh-pages`, `vite`, `react-router-dom`) en rama aparte con build+tests.
4. Seguimiento (no bloqueante): `back_urls` de MercadoPago aún apuntan a `localhost` (usar `FRONTEND_URL`); rate-limit en memoria no comparte estado entre instancias (si hay réplicas, pasar a Redis); `has_permission()` es base (`is_admin`) hasta definir matriz de permisos.

## Cierre (revisores + H1/H2 + cuenta prueba)
- Pentest: H1/H2 CERRADOS (checkout servidor + webhook MP con HMAC e idempotencia, migracion 006). 12 validaciones + XSS/IDOR/CSRF/JWT/CSRF/rate-limits corregidos y re-testeados 16/16.
- UX/QA: aprobado; CSP con hash del script de tema; drawer admin con Esc/foco (corregidos).
- Cuenta prueba (bloque 11): NO creada (sin service_role). Scripts + 007 + comandos npm listos.
- Sin navegador: sin Lighthouse/capturas/Playwright. Sin push/deploy por mandato.

## Auditoría integral 12/10/2026 (solo lectura, 4 agentes; build+lint+tests como evidencia)

### Área 1 — Funcionalidad y ecommerce
| ID | Sev | archivo:línea | Problema | Impacto | Solución | Esf |
|---|---|---|---|---|---|---|
| F01 | Crítica | backend/checkout_api.py:530-548 | `estado_checkout` no pide `acceso_token` en el select pero lo exige: invitados siempre 403 | Invitado que vuelve de MP no ve su orden | Agregar `acceso_token` al select | S |
| F02 | Crítica | backend/checkout_api.py:792-832 | Reintento pasa cancelada→pendiente sin re-reservar stock | Oversell cobrado sin stock | Re-reservar o prohibir desde cancelada | M |
| F03 | Alta | Checkout.jsx:136-137 | `vaciarCarrito` antes del redirect a MP | Si falla, pierde el carrito con orden pendiente | Vaciar solo ante `pagada` o snapshot | S |
| F04 | Alta | Cuenta.jsx:224-243 | "Mis pedidos" estático; `obtenerMisOrdenes` sin usos | Sin seguimiento de compras | Listar con estados + link /pedido/:id | M |
| F05 | Alta | ProductCard.jsx:32,121-135 | Corazón local; `useFavoritos` solo en Cuenta | Favorito se pierde, no sincroniza | Usar `useFavoritos` en la card | S |
| F06 | Alta | Home.jsx:121-124, Producto.jsx:122-124, usoArmador.js:119-122 | Consultas sin `activo=true` ni filtro papelera, `limit(100)` | Inactivos visibles, truncan catálogo | Filtrar + paginar | S |
| F07 | Alta | App.jsx:31,166 | Guardia solo owner/admin; backend autoriza más roles | Staff denegado injustamente | Alinear guard con matriz | S |
| F08 | Alta | contacto_api.py:52 | Bearer case-sensitive (checkout/admin aceptan minúsculas) | Contacto pierde dueño | `.lower()` como checkout_api:192 | S |
| F09 | Media | Home.jsx:362 vs resto | "Gratis desde $99.999" vs $150.000 reales | Expectativa rota | Unificar a 150.000 | S |
| F10 | Media | Producto.jsx:247-260,277-292 | Filtros/orden por precio base, no con descuento | Orden/rango miente en oferta | Usar `precioFinal` | S |
| F11 | Media | ProductList.jsx:141 | "6 cuotas" hardcodeado; la card exige dato real | Claim inventado | Quitar o condicionar | S |
| F12 | Media | ProductList.jsx:26-30 | Detalle sin filtro activo/deleted | URL abre dados de baja | Filtrar y 404 | S |
| F13 | Media | PagoResultado.jsx:30-53 | setTimeout sin cleanup; deps sin token | Loop huérfano, token stale | Cleanup + deps | S |
| F14 | Media | Asistente.jsx:16,130 | MAX 500 con slice silencioso; backend admite 2000 | Responde a texto recortado | Subir a 2000 o avisar | S |
| F15 | Baja | ArmadorResumen.jsx:48-65 | Agregado en loop abre drawer N veces, sin tope stock | Spam + falla tardía | Un `set` + validar | M |
| F16 | Baja | usoArmador.js:190-191,242-243 | Un solo disco (pisa anterior), limit 100 | M.2/SATA incompletos | Acumular + paginar | M |

### Área 2 — Seguridad y privacidad
| ID | Sev | archivo:línea | Problema | Impacto | Solución | Esf |
|---|---|---|---|---|---|---|
| SEC-01 | Alta | 003:85-86 + 004:90-103 | `movimientos_stock` lectura abierta a authenticated | Cualquiera lee stock/motivos/actores | Policy con `has_permission('stock','leer')` | S |
| SEC-02 | Media | 005:283-284 | Insert notificaciones con permiso de lectura, sin user_id | Inyección de avisos (phishing interno) | Solo service_role o WITH CHECK propio | S-M |
| SEC-03 | Media | orderService.js + PagoResultado + PedidoDetalle + checkout_api:528 | Token invitado en query y en QR a qrserver | Robo de link = PII; fuga a tercero | Token por header/sessionStorage; QR sin token | M |
| SEC-04 | Media | package.json:22 + npm audit | react-router 6.27 vulnerable (open redirect + injection); 11 vulns (8 high) | Phishing; resto dev-only | `npm audit fix` + planificar majors | S/M-L |
| SEC-05 | Media | *_api.py rate-limits + render.yaml | Rate-limit por IP directa tras proxy | Falsos 429 o sin freno real | X-Forwarded-For confiable o Redis | M |
| SEC-06 | Baja | checkout_api.py:297-303 | CheckoutCrear valida email solo por longitud | Basura en comprobantes | Reusar `_EMAIL_RE` | S |
| SEC-07 | Baja | PagoResultado.jsx:58-59 | Reintento sin guard `esUrlMP` | Open redirect residual | Reutilizar guard | S |
| SEC-08 | Baja | index.html:18 | CSP con comodines https + localhost en prod | Exfiltración ante XSS | CSP prod mínima | S-M |
| SEC-09 | Baja | admin_api.py:408-424 | Imágenes admiten `http://` | Mixed content | Solo https/interno | S |
| PRIV-01 | Baja | ReclamoPublico + contacto_api + admin_api | PII en motivo/detalle parseada por regex | ARCO costoso | Columnas propias | M |
| OPS-01 | Info | scripts/create-test-admin.mjs | Imprime password en consola | Fuga en logs/CI | One-shot + rotación, no CI | S |
Verificados sanos: sin secretos en árbol/bundle, XSS cero (sin dangerouslySetInnerHTML), webhook HMAC+idempotencia, logs sin PII, authz en servidor.

### Área 3 — Rendimiento y SEO
Bundle: index 490KB/144gzip (monolito), CSS 72KB, Home 46+24KB, Armador 42KB, Admin 16KB. Tira-placa 407KB JPEG la imagen más pesada.
| ID | Sev | archivo:línea | Problema | Impacto | Solución | Esf |
|---|---|---|---|---|---|---|
| P01 | Alta | vite.config.js:1-11 | Sin manualChunks: monolito 490KB | LCP/INP | seasoned manualChunks | M |
| P02 | Alta | Banner.jsx:231-249 | Hero sin width/height/eager explícito + doble descarga (fondo duplicado) + blur 28px | LCP | Eager+preload, quitar duplicado/blur | S |
| P03 | Alta | Home + TiraBanner | Sin ancho/alto ni aspect de reserva; tira-placa 407KB | CLS + peso | anchos reales + webp 1200px | S |
| P04 | Alta | ProductCard.jsx:97-107 | Todo lazy (incluso primer viewport), sin srcset, 600px fijos | LCP listado | Eager primeras 4 + srcset/Supabase thumbs | S |
| P05 | Alta | Producto.jsx/Home/productService | `select("*")`, sin limit/paginación server | Red/memoria/escala | Columnas + paginación + filtros server | M |
| P06 | Media | App.jsx/Home | Sin useMemo en conteos/filtros, ProductCard sin memo | INP | Memo + useShallow | M |
| P07 | Media | Banner.css/index.css/Navbar | backdrop-blur + body::after + 3 rAF | Jank/batería | Quitar un blur, unificar rAF | M |
| P08 | Media | index.html:94-97 | Fonts bloqueantes sin preload/preconnect | FCP/LCP | preload + preconnect | S |
| P09 | Media | index.html:98 | Título único, sin canonical | SEO | useDocumentTitle + canonical | S |
| P10 | Media | sitemap.xml + metas | Privadas incluidas, /armar y /reclamo fuera; sin Product/Breadcrumb JSON-LD | Crawl/rich | Limpiar sitemap + JSON-LD | S |
| P11 | Media | main.jsx/App/404 | 404.html no versionado en public/; sin ScrollToTop | Refresh roto si se pierde dist | Versionar 404 + ScrollToTop | S |
| P12 | Baja | Navbar.jsx:66-70 | minHeight por JS post-montaje | Micro-CLS | Reserva por CSS | S |
| P13 | Baja | index.html:16-19 | CSP hash frágil + localhost en prod | FOUC si cambia inline | Nonce/hash en build | S |
| P14 | Baja | reporte-imagenes.csv | lockup/icon PNG 154-170KB | Peso | Recomprimir/webp | S |

### Área 4 — Accesibilidad, CSS y código
| ID | Sev | archivo:línea | Problema | Impacto | Solución | Esf |
|---|---|---|---|---|---|---|
| A01 | Alta | CarritoLateral.jsx:76-83 + css | aside oculto con foco adentro (aria-hidden + translate) | Tab en invisible | inert/visibility o montar solo abierto | S |
| A02 | Alta | index.css + ProductCard + FilterPanel | --text-faint ~3:1 en texto chico | Ilegible dark | Subir a #9AA8C0 o reservar | S |
| A03 | Media | ProductCard.jsx:142-155 | aria-label sin role en rating | Invisible SR | role="img" | XS |
| A04 | Media | CarritoLateral.jsx:172 | live anuncia número sin contexto | "2" sin sentido | Texto oculto + atomic | XS |
| A05 | Media | FilterPanel.jsx:264 | velo onClick sin teclado | Sin mouse no cierra | button o aria-hidden + cerrar visible | S |
| A06 | Media | Login.jsx:43-65 | Sin label visible | Comprensión | label visible/sr-only | S |
| A07 | Media | Contacto.jsx:203-208 | Skeleton sin status | SR sin feedback | role=status "Enviando…" | XS |
| A08 | Media | ProductCard/Card.css | Stock solo por color | Daltónicos | Icono/forma + texto | S |
| A09 | Media | ProductCarousel.jsx:101 | tabindex en región con interactivos | Tab tedioso | Quitar tabindex | S |
| A10 | Media | Navbar.jsx:218-222 | aria-live en button | No se anuncia | span sr-only separado | XS |
| A11 | Baja | Login.jsx:73-77 | Checkbox muerto | Estado fantasma | Conectar o quitar | XS |
| A12 | Baja | Checkout.jsx:234-240 | Sin autocomplete ciudad/CP | Autocompletado | address-level2/postal-code | XS |
| C01 | Media | index.css | Doble sistema btn/badge (.btn-* vs .ht-*) | Divergencia | Unificar en ht-* | M |
| C02 | Media | index.css | Explosión de alias | Cambios no propagan | Vocabulario canónico + @deprecated | M |
| C03 | Baja | index.css | img/scrollbar/focus duplicados | Confusión | Dedup | XS |
| C04 | Baja | ProductCard.css:449-453 | aria-busy sin uso | Muerto | Quitar o implementar | XS |
| C05 | Baja | CarritoLateral.css:362-375 | 36px y ~19px en desktop | Click difícil | 44px siempre | XS |
| Q01 | Media | App.jsx + Navbar.jsx | Rol duplicado sin hook | Diverge | useRol() compartido | S |
| Q02 | Media | package.json | Sin runner ni script test | Regresiones | vitest o script test | S |
| Q03 | Media | tamaños | Admin/Navbar/Home/Armador/Asistente enormes | Mantenimiento | Partir por módulo | M |
| Q04 | Baja | CarritoLateral.jsx:17-51 | useRef tras useEffect | Riesgo TDZ | Reordenar | XS |
| Q05 | Baja | App.jsx + ProductoDetalle.css | .detalle-estado cruzado | Guard roto si no carga | Mover a global | XS |

### Resumen ejecutivo
73 hallazgos (2 críticos, 12 altos). Nada roto visualmente; lo grave está en checkout invitados (F01), oversell en reintento (F02), stock legible por cualquiera (SEC-01) y LCP (P01-P04).

### 10 prioridades (impacto/esfuerzo)
1. F01 token en select (S, desbloquea invitados)
2. F02 re-reserva en reintento (M, evita oversell)
3. SEC-01 RLS movimientos (S)
4. P02 hero LCP (S)
5. P03 tiras CLS+peso (S)
6. F05 favoritos en card (S)
7. F04 mis pedidos (M)
8. A01 foco en drawer oculto (S)
9. P01 manualChunks (M)
10. SEC-03 token fuera de URL/QR (M)

### Quick wins (<1h)
F08 lower() · F09 texto $150.000 · F11 quitar cuotas · F12 filtro activo · F13 cleanup · F14 límite 2000 · A03 role img · A04 live con contexto · A07 status envío · A10 live separado · SEC-06 email regex · SEC-07 esUrlMP · C03 dedup CSS · P08 preload fonts · P11 404 versionado + ScrollToTop.

## Estado al 17/10/2026 (rama `mvp/auditoria-integral`)

Verificado contra el código con `npm run check` (lint 0/0, 93 tests, build), `pytest` (21 tests) y recorrido en navegador en modo demo (escritorio y 375 px).

| Estado | IDs |
|---|---|
| ✅ Corregido | F01, F02, F03, F04, F05, F06, F08, F09, F10, F11, F12, F13, F14, F15, SEC-03, SEC-04, SEC-06, SEC-07, SEC-08, SEC-09, P01, P08, P09, P10, P11, A01, A02, A03, A04, A05, A06, A07, A08, A09, A10, A11, A12, C05, Q02, Q04, Q05 |
| ⚠️ Parcial | P04 (carga prioritaria y `sizes`, falta `srcset`), P05 (filtro y caché, sigue `select("*")`), P13 (sin localhost en prod, hash de CSP aún fijo), SEC-05 (proxy confiable pendiente), OPS-01, Q03 |
| ❌ Pendiente | F07, F16 (un solo disco en el armador), SEC-01 (corregido en la 005, falta confirmar que esté aplicado), SEC-02, PRIV-01, P02, P03, P06, P07, P12, P14, C01–C04, Q01 |

Detalle de lo corregido en `CHANGELOG.md`; próximos pasos en `docs/ROADMAP.md`.

## Asistente de IA (Fase 6) — 17/10/2026

**Diagnóstico (reproducido antes de tocar):** con `TestClient` sobre el `/api/chat` anterior, sin clave respondía `200` con «Mis circuitos están en mantenimiento» y con una clave inválida tardaba 4,1 s y respondía `200` con «Soy Hefesto, Dios de la forja… no pierdo tiempo con tonterías». El front mostraba ambos como respuestas válidas.

| ID | Sev | Causa raíz | Corrección | Estado |
|---|---|---|---|---|
| IA01 | P0 | El modelo no tenía acceso a la tienda: el prompt pedía «usar solo el catálogo» pero no le pasaba ninguno, así que precio, stock o compatibilidad eran imposibles o inventados | Herramientas sobre datos reales (`backend/asistente/herramientas.py`): búsqueda, ficha, stock, compatibilidad con el motor del armador portado 1:1 (paridad verificada en 307 casos), armado por presupuesto, envío con la regla del checkout, pedido con número + email, políticas con fuente y derivación | ✅ |
| IA02 | P1 | `time.sleep(3)` y cliente síncrono de Gemini dentro de `async def`: bloqueaban todo el servidor durante el reintento | Cliente async, timeout por turno, reintentos con backoff solo ante fallas transitorias (los 4xx no se reintentan) | ✅ |
| IA03 | P1 | Errores devueltos como `200` con texto | Eventos SSE `error` + derivación a WhatsApp; el front muestra aviso con Reintentar | ✅ |
| IA04 | P1 | Cada mensaje viajaba solo, sin historial | Ventana de 12 mensajes / 9000 caracteres con resumen de lo anterior | ✅ |
| IA05 | P2 | Sin streaming | `POST /api/chat` por SSE (texto, herramienta en curso, tarjetas, armado, derivación) | ✅ |
| IA06 | P2 | Proveedor fijo, sin modo sin internet | Interfaz `LLMProvider` (`LLM_PROVIDER`/`LLM_API_KEY`/`LLM_MODEL`) con Gemini y `mock` determinístico | ✅ |
| IA07 | P2 | Rate limit solo por IP; sin freno a adivinar pedidos | Límite por IP y por sesión; 5 consultas de pedido por sesión cada 10 min y misma respuesta exista o no el email | ✅ |
| IA08 | P2 | WhatsApp hardcodeado en `Asistente.jsx`; límite 500 en el front contra 2000 en el back (F14 seguía abierto en el código) | `constants/whatsapp.js` con mensaje precargado; 2000 en ambos lados | ✅ |
| IA09 | P2 | En móvil `.card` (index.css) pisaba `position: fixed` del panel: el chat quedaba cortado arriba | Selector con más especificidad; verificado a 375 px | ✅ |
| IA10 | P2 | Datos de tarjeta podían llegar al modelo y a los logs | Se borran (Luhn + CVV) en el front y en el back antes del modelo; los logs no llevan texto | ✅ |

Pendiente (dueño o próxima sesión):
- Probar las conversaciones de `docs/QA-ASISTENTE.md` con `LLM_PROVIDER=gemini` y una clave de prueba. En esta sesión el camino real se verificó con un cliente simulado y con una clave inválida contra la API de Google, que cae al fallback en 1,8 s.
- Confirmar lo que el sitio publica sin regla en el checkout (el asistente lo cita como «figura en el sitio», sin prometerlo): 6 cuotas sin interés, 10 % off por transferencia (el checkout no ofrece transferencia), garantía de 12 meses, retiro en Salta y plazos de despacho.
- El número de WhatsApp sigue siendo un placeholder (`WHATSAPP_NUMERO_A_CONFIRMAR`).
- Persistir conversaciones y feedback en la base (`assistant_conversations` del Anexo D). Hoy el feedback solo queda en logs sin texto.
