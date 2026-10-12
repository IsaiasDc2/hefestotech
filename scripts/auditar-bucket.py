#!/usr/bin/env python3
"""HefestoTech - Auditoria de imagenes del bucket `productos` (solo lectura).

Descarga las 54 imagenes (URLs en productos.imagen) a TEMP (nunca al repo),
las analiza con Pillow (px, peso, proporcion, fondo, baja resolucion) y
escribe el reporte CSV en ecomers/client/public/productos-optimizados/.

Uso:
    py scripts/auditar-bucket.py [--out ruta.csv]

Lee VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY (o VITE_SUPABASE_ANON_KEY)
de ecomers/client/.env.local solo en memoria. Nunca imprime la clave.
"""

import argparse
import csv
import json
import os
import re
import sys
import tempfile
import urllib.parse
import urllib.request

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_LOCAL = os.path.join(REPO, "ecomers", "client", ".env.local")
DEFAULT_OUT = os.path.join(
    REPO, "ecomers", "client", "public", "productos-optimizados",
    "auditoria-bucket.csv",
)


def leer_env():
    vals = {}
    with open(ENV_LOCAL, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            vals[k.strip()] = v.strip().strip('"').strip("'")
    url = vals.get("VITE_SUPABASE_URL")
    key = vals.get("VITE_SUPABASE_PUBLISHABLE_KEY") or vals.get("VITE_SUPABASE_ANON_KEY")
    if not url or not key:
        sys.exit("Falta VITE_SUPABASE_URL o la clave en ecomers/client/.env.local")
    return url, key


def fetch_productos(url, key):
    q = urllib.parse.urlencode({
        "select": "nombre,categoria,imagen",
        "order": "nombre.asc",
        "limit": "100",
    })
    req = urllib.request.Request(
        url + "/rest/v1/productos?" + q,
        headers={"apikey": key, "Authorization": "Bearer " + key},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def descargar(url, destino, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": "hefestotech-audit/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r, open(destino, "wb") as f:
        while True:
            chunk = r.read(65536)
            if not chunk:
                break
            f.write(chunk)
    return os.path.getsize(destino)


def clasificar_fondo(im):
    """Fondo por esquinas/bordes: blanco | negro | color | escena.

    Muestrea el marco exterior (5% del lado menor, min 4px). Si el marco es
    uniforme -> fondo liso (blanco/negro/color por luminancia). Si no -> escena.
    """
    from PIL import ImageStat
    rgb = im.convert("RGB")
    w, h = rgb.size
    b = max(4, int(min(w, h) * 0.05))
    px = rgb.load()
    muestra = []
    for x in range(0, w, max(1, w // 60)):
        for y in list(range(0, b)) + list(range(h - b, h)):
            muestra.append(px[x, y])
    for y in range(0, h, max(1, h // 60)):
        for x in list(range(0, b)) + list(range(w - b, w)):
            muestra.append(px[x, y])
    n = len(muestra)
    mr = sum(p[0] for p in muestra) / n
    mg = sum(p[1] for p in muestra) / n
    mb = sum(p[2] for p in muestra) / n
    lum = 0.299 * mr + 0.587 * mg + 0.114 * mb
    var = sum((p[0] - mr) ** 2 + (p[1] - mg) ** 2 + (p[2] - mb) ** 2 for p in muestra) / n
    std = var ** 0.5
    hex_color = "#%02x%02x%02x" % (int(mr), int(mg), int(mb))
    if std > 38:
        return "escena", hex_color
    if lum >= 225:
        return "blanco", hex_color
    if lum <= 30:
        return "negro", hex_color
    return "color", hex_color


def auditar_imagen(path):
    from PIL import Image
    peso = os.path.getsize(path)
    with Image.open(path) as im:
        im.load()
        w, h = im.size
        formato = (im.format or "").lower()
    with Image.open(path) as im2:
        fondo, bg_hex = clasificar_fondo(im2)
    lado_menor = min(w, h)
    mcd = __import__("math").gcd(w, h)
    proporcion = f"{w // mcd}:{h // mcd}"
    return {
        "ancho_px": w,
        "alto_px": h,
        "peso_bytes": peso,
        "proporcion": proporcion,
        "lado_menor_px": lado_menor,
        "baja_resolucion": "si" if lado_menor < 600 else "no",
        "fondo": fondo,
        "bg_hex": bg_hex,
        "formato": formato,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=DEFAULT_OUT)
    args = ap.parse_args()

    url, key = leer_env()
    productos = fetch_productos(url, key)
    print(f"productos: {len(productos)}")

    tmp = tempfile.mkdtemp(prefix="hefestotech-auditoria-")
    print(f"descargas en TEMP: {tmp}")
    filas = []
    for i, p in enumerate(productos, 1):
        nombre = p.get("nombre") or ""
        img = p.get("imagen") or ""
        archivo = urllib.parse.unquote(img.rsplit("/", 1)[-1]) if img else ""
        dest = os.path.join(tmp, f"{i:02d}_{archivo or 'sin-imagen'}")
        fila = {
            "nombre": nombre,
            "categoria": p.get("categoria") or "",
            "archivo_bucket": archivo,
            "url": img,
        }
        try:
            peso = descargar(img, dest)
            info = auditar_imagen(dest)
            fila.update(info)
            fila["peso_kb"] = round(peso / 1024, 1)
            fila["error"] = ""
        except Exception as e:  # noqa: BLE001 - queda registrado en el CSV
            fila.update({
                "ancho_px": "", "alto_px": "", "peso_bytes": "",
                "proporcion": "", "lado_menor_px": "", "baja_resolucion": "",
                "fondo": "", "bg_hex": "", "formato": "", "peso_kb": "",
                "error": f"{type(e).__name__}: {e}",
            })
        filas.append(fila)
        print(f"[{i}/{len(productos)}] {nombre} "
              f"{fila.get('ancho_px')}x{fila.get('alto_px')} "
              f"fondo={fila.get('fondo')} baja={fila.get('baja_resolucion')}")

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    cols = ["nombre", "categoria", "archivo_bucket", "url", "ancho_px",
            "alto_px", "peso_bytes", "peso_kb", "proporcion",
            "lado_menor_px", "baja_resolucion", "fondo", "bg_hex",
            "formato", "error"]
    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(filas)
    bajas = [f for f in filas if f.get("baja_resolucion") == "si"]
    print(f"CSV: {args.out} ({len(filas)} filas, {len(bajas)} baja resolucion)")


if __name__ == "__main__":
    main()
