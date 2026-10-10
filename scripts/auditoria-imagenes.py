#!/usr/bin/env python3
"""Auditoria de imagenes de HefestoTech (Agente c - Imagenes).

Responde a DESIGN.md (doble tema, tokens, Flat-At-Rest) y al brief de la
rama feat/auditoria-admin: audita TODAS las imagenes accesibles sin auth
(locales + URLs http(s) publicas) y vuelca:

  qa/imagenes.csv                  formato, px, peso, proporcion,
                                   transparencia, fondo por bordes/esquinas,
                                   barras incrustadas, baja resolucion
  <public>/manifiesto-fondos.json  URL -> "blanco" | "negro" (solo alta
                                   confianza). ProductCard lo consume para
                                   aplicar multiply/screen sin canvas runtime.

Fuentes de URLs remotas (ninguna inventada):
  1. Supabase REST (tabla productos, columna imagen) si hay
     SUPABASE_URL + SUPABASE_ANON_KEY (o flags equivalentes).
  2. --urls-file / --urls (lista explicita curada a mano).
  3. Intento best-effort de listar el bucket publico `productos`
     (solo lectura; si pide auth se registra como pendiente).

Locales: se recorren --dir (default ecomers/client/public) con extensiones
raster que Pillow puede abrir. Los SVG se registran como no-auditables.

Requiere: Pillow, requests. Sin auth, sin writes salvo los dos outputs.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

try:
    import requests
except ImportError:  # pragma: no cover
    print("Falta 'requests' (pip install requests pillow)", file=sys.stderr)
    sys.exit(2)

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    print("Falta 'Pillow' (pip install pillow requests)", file=sys.stderr)
    sys.exit(2)

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DIR = REPO_ROOT / "ecomers" / "client" / "public"
DEFAULT_CSV = REPO_ROOT / "qa" / "imagenes.csv"
DEFAULT_MANIFEST = (
    REPO_ROOT / "ecomers" / "client" / "public" / "manifiesto-fondos.json"
)
RASTER_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".avif"}
SVG_EXTS = {".svg"}
MIN_SIDE = 600  # debajo: baja resolucion para card 1:1
TINY_SIDE = 192  # debajo: practicamente placeholder
MAX_BYTES = 25 * 1024 * 1024
TIMEOUT = 20


# ---------------------------------------------------------------- metricas
def _luminance(rgb: tuple) -> float:
    r, g, b = rgb[:3]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def border_pixels(img: "Image.Image") -> list:
    """Píxeles del marco (4px) + esquinas 8x8: de ahi se infiere el fondo."""
    rgb = img.convert("RGB")
    w, h = rgb.size
    t = max(2, min(4, min(w, h) // 50))
    px = rgb.load()
    out = []
    for x in range(w):
        for y in list(range(t)) + list(range(h - t, h)):
            out.append(px[x, y])
    for y in range(h):
        for x in list(range(t)) + list(range(w - t, w)):
            out.append(px[x, y])
    c = min(8, w // 4, h // 4)
    for cx in (0, w - c):
        for cy in (0, h - c):
            for x in range(cx, cx + c):
                for y in range(cy, cy + c):
                    out.append(px[x, y])
    return out


def classify_background(img: "Image.Image") -> dict:
    """Clasifica fondo por bordes/esquinas: blanco|negro|transparente|otro|mixto."""
    has_alpha = img.mode in ("RGBA", "LA") or (
        img.mode == "P" and "transparency" in img.info
    )
    if has_alpha:
        try:
            alpha = img.convert("RGBA").split()[3]
            hist = alpha.histogram()
            total = sum(hist)
            transparent = sum(hist[:128]) / total if total else 0
            if transparent > 0.15:
                return {"tipo": "transparente", "uniforme": True,
                        "conf": round(transparent, 3)}
        except Exception:
            pass
    borde = border_pixels(img)
    if not borde:
        return {"tipo": "otro", "uniforme": False, "conf": 0.0}
    n = len(borde)
    mean = tuple(sum(c[i] for c in borde) // n for i in range(3))
    lum = _luminance(mean)
    tol = 28
    dentro = sum(
        1 for c in borde
        if abs(c[0] - mean[0]) <= tol and abs(c[1] - mean[1]) <= tol
        and abs(c[2] - mean[2]) <= tol
    )
    uniforme = (dentro / n) >= 0.85
    if not uniforme:
        # ¿Es foto con fondo propio (azul Pebble) o collage? -> mixto.
        return {"tipo": "mixto", "uniforme": False,
                "conf": round(dentro / n, 3)}
    if lum >= 235:
        return {"tipo": "blanco", "uniforme": True, "conf": round(dentro / n, 3)}
    if lum <= 15:
        return {"tipo": "negro", "uniforme": True, "conf": round(dentro / n, 3)}
    return {"tipo": "otro", "uniforme": True, "conf": round(dentro / n, 3)}


def detect_bars(img: "Image.Image") -> str:
    """Detecta letterbox/pillarbox: franjas uniformes incrustadas en la foto.

    Conservador: exige par opuesto (sup+inf o izq+der), franjas uniformes,
    parecidas entre si y distintas del centro. En imagenes con alfa se
    omite (el transparente convertido a RGB genera falsos positivos).
    """
    if img.mode in ("RGBA", "LA", "PA"):
        try:
            alpha = img.convert("RGBA").split()[3]
            hist = alpha.histogram()
            if sum(hist[:128]) / (sum(hist) or 1) > 0.02:
                return ""
        except Exception:
            return ""
    rgb = img.convert("RGB")
    small = rgb.resize((64, 64))
    raw = small.tobytes()
    px = [tuple(raw[i * 3:(i + 1) * 3]) for i in range(64 * 64)]
    rows = [px[i * 64:(i + 1) * 64] for i in range(64)]

    def uniform(band) -> bool:
        m = [sum(c[i] for c in band) / len(band) for i in range(3)]
        return all(
            abs(c[j] - m[j]) < 12 for c in band for j in range(3)
        )

    top = sum(1 for r in rows[:8] if uniform(r))
    bottom = sum(1 for r in rows[-8:] if uniform(r))
    cols = [[rows[y][x] for y in range(64)] for x in range(64)]
    left = sum(1 for c in cols[:8] if uniform(c))
    right = sum(1 for c in cols[-8:] if uniform(c))

    # Solo cuenta como barra si hay par opuesto uniforme, del mismo tono
    # entre si y distinto del centro (foto con contenido real al medio).
    centro = [sum(c[i] for c in px) / len(px) for i in range(3)]

    def media(band) -> list:
        flat = [p for fila in band for p in fila]
        return [sum(c[i] for c in flat) / len(flat) for i in range(3)]

    def parecidas(a, b) -> bool:
        return sum(abs(a[i] - b[i]) for i in range(3)) < 30

    def distinta(m) -> bool:
        return sum(abs(m[i] - centro[i]) for i in range(3)) > 45

    top_m = media(rows[:2]) if top >= 5 else None
    bot_m = media(rows[-2:]) if bottom >= 5 else None
    left_m = media([cols[0], cols[1]]) if left >= 5 else None
    right_m = media([cols[-1], cols[-2]]) if right >= 5 else None

    barras = []
    if (top_m and bot_m and parecidas(top_m, bot_m)
            and distinta(top_m)):
        barras.append("letterbox")
    if (left_m and right_m and parecidas(left_m, right_m)
            and distinta(left_m)):
        barras.append("pillarbox")
    return "|".join(barras)


def analyze_image(data: bytes) -> dict:
    img = Image.open(io.BytesIO(data))
    img.load()
    w, h = img.size
    aspecto = round(w / h, 3) if h else 0
    fondo = classify_background(img)
    transparencia = "si" if fondo["tipo"] == "transparente" else (
        "posible" if img.mode in ("RGBA", "LA", "PA") else "no"
    )
    return {
        "formato": (img.format or "").lower(),
        "ancho_px": w,
        "alto_px": h,
        "proporcion": f"{w}:{h}",
        "aspecto": aspecto,
        "modo": img.mode,
        "transparencia": transparencia,
        "fondo_bordes": fondo["tipo"],
        "uniforme_borde": "si" if fondo["uniforme"] else "no",
        "conf_fondo": fondo["conf"],
        "barras": detect_bars(img),
        "baja_res_600": "si" if min(w, h) < MIN_SIDE else "no",
        "tiny_192": "si" if min(w, h) < TINY_SIDE else "no",
    }


# ---------------------------------------------------------------- fuentes
def collect_local(root: Path) -> list:
    items = []
    if not root.is_dir():
        return items
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        ext = path.suffix.lower()
        if ext in SVG_EXTS:
            items.append({"fuente": "local", "origen": str(path),
                          "nota": "svg-no-auditable"})
        elif ext in RASTER_EXTS:
            items.append({"fuente": "local", "origen": str(path),
                          "nota": ""})
    return items


def supabase_product_images(base: str, key: str) -> tuple[list, str]:
    """Lee productos.imagen via REST. Devuelve (urls, error). Sin auth extra."""
    try:
        url = base.rstrip("/") + "/rest/v1/productos?select=id,nombre,imagen"
        r = requests.get(url, headers={"apikey": key,
                                       "Authorization": f"Bearer {key}"},
                         timeout=TIMEOUT)
        r.raise_for_status()
        rows = r.json()
    except Exception as e:  # noqa: BLE001 - se vuelca a pendiente
        return [], f"supabase-rest: {e}"
    urls = []
    vacias = 0
    for row in rows if isinstance(rows, list) else []:
        img = (row.get("imagen") or "").strip()
        if img.startswith("http"):
            urls.append({"fuente": "supabase-productos",
                         "origen": img,
                         "nota": str(row.get("nombre") or row.get("id"))})
        else:
            vacias += 1
    return urls, f"ok ({len(urls)} con URL, {vacias} vacias->placeholder)"


def supabase_bucket_list(base: str, key: str) -> tuple[list, str]:
    try:
        url = base.rstrip("/") + "/storage/v1/object/list/productos"
        r = requests.post(url, headers={"apikey": key,
                                        "Authorization": f"Bearer {key}",
                                        "Content-Type": "application/json"},
                          json={"prefix": "", "limit": 1000}, timeout=TIMEOUT)
        r.raise_for_status()
        names = [o.get("name") for o in r.json() if o.get("name")]
    except Exception as e:  # noqa: BLE001
        return [], f"bucket-list: {e}"
    pub = base.rstrip("/") + "/storage/v1/object/public/productos/"
    return [{"fuente": "supabase-bucket", "origen": pub + n, "nota": n}
            for n in names], f"ok ({len(names)} objetos)"


def fetch_bytes(origen: str) -> tuple[bytes | None, int, str]:
    """Devuelve (bytes, peso, error). Solo http(s), tope de tamaño."""
    scheme = urlparse(origen).scheme
    if scheme not in ("http", "https"):
        try:
            data = Path(origen).read_bytes()
            return data, len(data), ""
        except Exception as e:  # noqa: BLE001
            return None, 0, f"lectura-local: {e}"
    try:
        with requests.get(origen, timeout=TIMEOUT, stream=True) as r:
            r.raise_for_status()
            buf = io.BytesIO()
            for chunk in r.iter_content(65536):
                buf.write(chunk)
                if buf.tell() > MAX_BYTES:
                    return None, 0, "excede-25MB"
            data = buf.getvalue()
            return data, len(data), ""
    except Exception as e:  # noqa: BLE001
        return None, 0, f"http: {e}"


# ---------------------------------------------------------------- main
def contexto_de(fuente: str, origen: str) -> str:
    """banners|brand: fuera de la card (umbrales igual se registran).
    producto: foto de catalogo (remota o futura ruta local)."""
    low = origen.replace("\\", "/").lower()
    if "/banners/" in low:
        return "banners"
    if "/brand/" in low or "favicon" in low or "icon-" in low:
        return "brand"
    if fuente.startswith("supabase") or fuente == "manual":
        return "producto"
    return "otro"


def sugerencia(row: dict) -> str:
    if row.get("accesible") != "si":
        return "re-subir al bucket productos / revisar URL"
    s = []
    es_producto = row.get("contexto") == "producto"
    if row.get("tiny_192") == "si":
        s.append("reemplazar: diminuta (<192px)" if es_producto
                 else "icono/chico: verificar nitidez en su uso")
    elif row.get("baja_res_600") == "si" and es_producto:
        s.append("reemplazar o reexportar >=600px lado menor")
    if row.get("barras"):
        s.append("recortar barras incrustadas")
    if row.get("fondo_bordes") == "mixto" and es_producto:
        s.append("normalizar a fondo blanco puro #FFFFFF")
    if row.get("fondo_bordes") == "otro" and es_producto:
        s.append("evaluar fondo blanco puro o transparente")
    if not s:
        s.append("ok")
    return "; ".join(s)


def main() -> int:
    ap = argparse.ArgumentParser(description="Audita imagenes accesibles.")
    ap.add_argument("--dir", default=str(DEFAULT_DIR))
    ap.add_argument("--out", default=str(DEFAULT_CSV))
    ap.add_argument("--manifiesto", default=str(DEFAULT_MANIFEST))
    ap.add_argument("--supabase-url", default=os.getenv("SUPABASE_URL", ""))
    ap.add_argument("--supabase-key", default=os.getenv("SUPABASE_ANON_KEY", ""))
    ap.add_argument("--urls-file", default="")
    ap.add_argument("--urls", nargs="*", default=[])
    args = ap.parse_args()

    fuentes: list[dict] = collect_local(Path(args.dir))
    notas_fuente = [f"local: {len(fuentes)} archivos raster/svg"]

    if args.supabase_url and args.supabase_key:
        urls, nota = supabase_product_images(args.supabase_url,
                                             args.supabase_key)
        fuentes += urls
        notas_fuente.append(f"supabase-productos: {nota}")
        burls, bnota = supabase_bucket_list(args.supabase_url,
                                            args.supabase_key)
        notas_fuente.append(f"supabase-bucket: {bnota}")
        vistos = {f["origen"] for f in fuentes}
        fuentes += [b for b in burls if b["origen"] not in vistos]
    else:
        notas_fuente.append("supabase: omitido (sin SUPABASE_URL/KEY)")

    if args.urls_file:
        for line in Path(args.urls_file).read_text().splitlines():
            line = line.strip()
            if line.startswith("http"):
                fuentes.append({"fuente": "manual", "origen": line, "nota": ""})
    for u in args.urls:
        if u.startswith("http"):
            fuentes.append({"fuente": "manual", "origen": u, "nota": ""})

    # Dedup por origen.
    unicas: dict[str, dict] = {}
    for f in fuentes:
        unicas.setdefault(f["origen"], f)
    fuentes = list(unicas.values())

    filas = []
    public_root = Path(args.dir)
    for f in fuentes:
        origen = f["origen"]
        ctx = contexto_de(f["fuente"], origen)
        if f.get("nota") == "svg-no-auditable":
            filas.append({"fuente": f["fuente"], "url_o_ruta": origen,
                          "contexto": ctx,
                          "accesible": "n/a", "error": "svg vectorial",
                          "formato": "svg", "ancho_px": "", "alto_px": "",
                          "proporcion": "", "peso_kb": "", "modo": "",
                          "transparencia": "si", "fondo_bordes": "n/a",
                          "uniforme_borde": "", "barras": "",
                          "baja_res_600": "", "tiny_192": "",
                          "sugerencia": "ok vectorial"})
            continue
        data, peso, err = fetch_bytes(origen)
        if data is None:
            filas.append({"fuente": f["fuente"], "url_o_ruta": origen,
                          "contexto": ctx,
                          "accesible": "no", "error": err, "formato": "",
                          "ancho_px": "", "alto_px": "", "proporcion": "",
                          "peso_kb": "", "modo": "", "transparencia": "",
                          "fondo_bordes": "", "uniforme_borde": "",
                          "barras": "", "baja_res_600": "", "tiny_192": "",
                          "sugerencia": sugerencia({"accesible": "no"})})
            continue
        try:
            m = analyze_image(data)
        except Exception as e:  # noqa: BLE001
            filas.append({"fuente": f["fuente"], "url_o_ruta": origen,
                          "contexto": ctx,
                          "accesible": "no", "error": f"pillow: {e}",
                          "formato": "", "ancho_px": "", "alto_px": "",
                          "proporcion": "", "peso_kb": round(peso / 1024, 1),
                          "modo": "", "transparencia": "", "fondo_bordes": "",
                          "uniforme_borde": "", "barras": "",
                          "baja_res_600": "", "tiny_192": "",
                          "sugerencia": sugerencia({"accesible": "no"})})
            continue
        fila = {"fuente": f["fuente"], "url_o_ruta": origen,
                "contexto": ctx,
                "accesible": "si", "error": "",
                "formato": m["formato"], "ancho_px": m["ancho_px"],
                "alto_px": m["alto_px"], "proporcion": m["proporcion"],
                "peso_kb": round(peso / 1024, 1), "modo": m["modo"],
                "transparencia": m["transparencia"],
                "fondo_bordes": m["fondo_bordes"],
                "uniforme_borde": m["uniforme_borde"], "barras": m["barras"],
                "baja_res_600": m["baja_res_600"], "tiny_192": m["tiny_192"],
                "sugerencia": ""}
        fila["sugerencia"] = sugerencia(fila)
        # Barras incrustadas solo importan en foto de producto: fuera de
        # ese contexto el detector confunde padding de iconos/banners.
        if ctx != "producto":
            fila["barras"] = ""
            fila["sugerencia"] = sugerencia(fila)
        filas.append(fila)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    cols = ["fuente", "url_o_ruta", "contexto", "accesible", "error",
            "formato", "ancho_px", "alto_px", "proporcion", "peso_kb",
            "modo", "transparencia", "fondo_bordes", "uniforme_borde",
            "barras", "baja_res_600", "tiny_192", "sugerencia"]
    with out.open("w", newline="", encoding="utf-8") as fh:
        wr = csv.DictWriter(fh, fieldnames=cols)
        wr.writeheader()
        wr.writerows(filas)

    # Manifiesto: solo alta confianza (borde uniforme + blanco/negro).
    # Nunca canvas en runtime: la app solo lee este JSON estatico.
    # Clave: URL remota tal cual; local: ruta relativa a public/ (la app
    # tambien matchea por basename para URLs del bucket con otro prefijo).
    entradas = {}
    for fila in filas:
        if (fila["accesible"] == "si"
                and fila["uniforme_borde"] == "si"
                and fila["fondo_bordes"] in ("blanco", "negro")):
            clave = fila["url_o_ruta"]
            try:
                clave = str(Path(clave).relative_to(public_root)
                            ).replace("\\", "/")
            except ValueError:
                pass
            entradas[clave] = fila["fondo_bordes"]
    manifiesto = {
        "version": 1,
        "generado": datetime.now(timezone.utc).isoformat(),
        "nota": "URL -> tipo de fondo. blanco=>multiply, negro=>screen. "
                "Solo alta confianza; sin entrada = sin blend.",
        "entradas": entradas,
    }
    man = Path(args.manifiesto)
    man.parent.mkdir(parents=True, exist_ok=True)
    man.write_text(json.dumps(manifiesto, indent=2, ensure_ascii=False)
                   + "\n", encoding="utf-8")

    print(f"fuentes: {'; '.join(notas_fuente)}")
    print(f"filas: {len(filas)} -> {out}")
    print(f"manifiesto: {len(entradas)} entradas -> {man}")
    pendientes = sum(1 for r in filas if r["accesible"] != "si")
    print(f"pendientes/inaccesibles: {pendientes}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
