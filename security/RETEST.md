# Retest — verificación post-parche

Entorno: `fix/security-audit`, uvicorn `127.0.0.1:8000`, pytest 9.x,
TestClient sin red (Supabase/MP mockeados).

## Tests unitarios/regresión — `backend/tests/test_seguridad.py`

```
10 passed (pytest, ~3s)
```

| Test | Verifica | Resultado |
|---|---|---|
| estado invitado + token → 200 + select pide `acceso_token` | F1 | ✓ |
| estado sin token → 403 | control | ✓ |
| estado token incorrecto → 403 | control | ✓ |
| estado orden ajena sin sesión → 404 | IDOR | ✓ |
| reintento cancelada → `_reservar` llamado + 200 | F2 | ✓ |
| reintento cancelada sin stock → 409, sin preferencia | F2 | ✓ |
| reintento pendiente → NO re-reserva | F2 (sin doble descuento) | ✓ |
| reintento pagada → 409 | control | ✓ |
| `_es_url_mp` acepta init_point real de MP | F3 | ✓ |
| `_es_url_mp` rechaza http / evil.com / javascript: | F3 anti-SSRF | ✓ |

## DAST repetido sobre el servidor parcheado

| Prueba | Antes | Después |
|---|---|---|
| `GET /` headers | sin headers de seguridad | `nosniff`, `DENY`, `no-referrer` |
| `GET /api/productos` | `{"error":"CSV no encontrado"}` | 404 (endpoint eliminado) |
| `GET /api/admin/resumen` sin token | 401 | 401 (sin regresión) |
| `GET /api/buscar` sin token | 401 | 401 |
| `POST /api/webhooks/mercadopago` sin data.id | 200 ignorado | 200 ignorado |
| `POST /api/checkout/crear` items vacíos | 422 | 422 |
| `POST /api/chat` ×21 | 429 en la 21 | 429 en la 21 |
| `GET /docs` | 200 | 200 |

## Scanners post-parche

| Herramienta | Resultado |
|---|---|
| semgrep `--config p/python` sobre `backend/` | **0 hallazgos** |
| semgrep `--config auto` | los 3 hallazgos de `pagos_mp.py` desaparecen con el archivo |
| pip-audit (`requirements.txt` pineado) | **No known vulnerabilities found** |
| import `main`/`checkout_api`/`comprobantes` | OK sin errores |

## No ejecutado (con motivo)

- **ZAP/Trivy**: no hay Java ni Docker en el host; el DAST manual cubrió
  los mismos vectores HTTP. Si se aprovisiona ZAP, repetir sobre
  `localhost:8000` con el alcance `api/*`.
- **Pruebas E2E contra Supabase real**: requiere proyecto de staging y
  keys — **no autorizado para producción**. Con staging, verificar:
  ciclo completo crear→webhook firmado→pagada→comprobante PDF con ítems;
  y reintento de orden cancelada con stock insuficiente en DB real.
- **Frontend build/lint**: fuera del alcance backend acordado.
