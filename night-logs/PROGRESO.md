# Progreso nocturno — 2026-10-06 (sesión autónoma)

## Rama `night/2026-10-06` (pusheada) + `fix/errores-2026-10-06` (pusheada)
- Filtros: rediseño card + buscador full-width tablet + labels/aria + debounce + selects custom.
- Footer: Ayuda/Posventa mudados del topbar, marca HefestoTech, orden y táctil 44px.
- Topbar: solo Envíos + WhatsApp + selector idioma ES/EN (funcional, navbar+footer) + luna visual sin función.
- Errores: estados amables ES con reintento, Supabase resiliente, URL typo corregida (era 1 `r` de menos), timeout 12s fail-fast.
- Checkout: Mercado Pago con logo oficial + redirección a preferencia del backend.
- Banner: 1 h1 por slide, CTA secundario a link, fotos HD locales con licencia CC (7KB → 64-172KB).
- Tokens: foco unificado, kickers/badge a spec, hex→vars, `:root` listo para tema claro (stash local, NO subir).
- Tests: 13 `node:test` en verde en rama fix (utils/pago.js). Lint ✅ Build ✅ en ambas ramas.
- Skills: 7 ui-ux-pro-max instaladas + skills de `.agents/` descubiertas (emil-design-eng, apple-design, etc.). Todas ignoradas en git.

## Stash local (NO pushear sin aviso)
- `tema-claro-local-no-subir`: toggle funcional de tema claro/oscuro.

## Pendiente humano
- Verificar modelo `gemini-3.8-flash` con key real; `back_urls` MP a env; upgrade react-router v7 (breaking); cobertura de tests; resto del sitio en EN.
