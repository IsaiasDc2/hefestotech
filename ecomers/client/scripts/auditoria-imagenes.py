#!/usr/bin/env python3
"""Auditoria de imagenes locales de HefestoTech (Agente A).

Uso local (sin credenciales):
    python ecomers/client/scripts/auditoria-imagenes.py

Uso con bucket de Supabase (no inventa URLs; requiere anon key a mano):
    1. Pedir al dueno: SUPABASE_URL + SUPABASE_ANON_KEY del proyecto.
    2. Exportarlas SIN commitearlas (solo entorno local):
         $env:SUPABASE_URL="https://<ref>.supabase.co"
         $env:SUPABASE_ANON_KEY="<anon-key>"
       (bash: export SUPABASE_URL=... SUPABASE_ANON_KEY=...)
    3. Correr con flag:
         python ecomers/client/scripts/auditoria-imagenes.py --supabase-bucket productos
       El script lista objetos via Storage API
       (GET {url}/storage/v1/object/list/{bucket} con header apikey),
       los descarga a TEMP, los audita igual que los locales y los borra.
       Sin esas dos variables, el modo supabase se omite con aviso.

Salidas:
    ecomers/client/public/productos-optimizados/reporte-imagenes.csv
    ecomers/client/public/manifiesto-fondos.json

Reglas Agente A: nunca sobrescribe originales; solo reporta + manifiesto.
"""
import csv
import json
import os
import sys
import tempfile
from pathlib import Path

try:
    from PIL import Image, ImageStat
except ImportError:
    sys.exit("Falta Pillow: pip install pillow")

BASE = Path(__file__).resolve().parents[1]  # ecomers/client
PUBLIC = BASE / "public"
OUT_DIR = PUBLIC / "productos-optimizados"
CSV_OUT = OUT_DIR / "reporte-imagenes.csv"
JSON_OUT = PUBLIC / "manifiesto-fondos.json"

# Umbrales del brief: producto <600px o categoria <192px = baja resolucion.
MIN_PRODUCTO = 600
MIN_CATEGORIA = 192


def fondo_por_bordes(im):
    """Estima color de fondo promediando borde de 6px + esquinas 12x12."""
    rgb = im.convert("RGB")
    w, h = rgb.size
    b = 6
    px = rgb.load()
    muestras = []
    for x in range(w):
        for y in list(range(min(b, h))) + list(range(max(0, h - b), h)):
            muestras.append(px[x, y])
    for y in range(h):
        for x in list(range(min(b, w))) + list(range(max(0, w - b), w)):
            muestras.append(px[x, y])
    n = len(muestras) or 1
    prom = tuple(sum(c[i] for c in muestras) // n for i in range(3))
    # Varianza de esquinas: si difieren mucho, el fondo no es uniforme.
    esquinas = []
    c = 12
    for x0, y0 in ((0, 0), (w - c, 0), (0, h - c), (w - c, h - c)):
        crop = rgb.crop((max(0, x0), max(0, y0), min(w, x0 + c), min(h, y0 + c)))
        st = ImageStat.Stat(crop)
        esquinas.append(tuple(int(v) for v in st.mean))
    uniforme = max(
        max(abs(a[i] - b_[i]) for i in range(3))
        for a in esquinas for b_ in esquinas
    ) < 24
    return "#%02x%02x%02x" % prom, uniforme


def tiene_transparencia(im):
    if im.mode in ("RGBA", "LA"):
        alpha = im.getchannel("A")
        st = ImageStat.Stat(alpha)
        return st.extrema[0][0] < 250  # algun pixel no-opaco
    return False


def auditar_archivo(path, origen="local"):
    try:
        im = Image.open(path)
        im.load()
    except Exception as e:  # noqa: BLE001
        return {
            "archivo": str(path), "origen": origen, "px": "",
            "peso_kb": round(path.stat().st_size / 1024, 1) if path.exists() else "",
            "formato": "", "proporcion": "", "transparencia": "",
            "fondo_bordes": "", "fondo_uniforme": "", "baja_resolucion": "",
            "nota": f"no se pudo leer: {e}",
        }
    w, h = im.size
    fondo, uniforme = fondo_por_bordes(im)
    ruta_txt = str(path).replace("\\", "/")
    if "/brand/" in ruta_txt:
        # Assets de marca/iconos: tamaño nominal fijo (favicon 32, icon-192/512,
        # apple-touch 180, logos). No aplica umbral de producto/categoria.
        baja = "no"
        nota = "asset de marca, tamano nominal"
    else:
        es_categoria = "banners" in ruta_txt
        umbral = MIN_CATEGORIA if es_categoria else MIN_PRODUCTO
        baja = "SI" if min(w, h) < umbral else "no"
        nota = f"min lado {min(w, h)}px vs umbral {umbral}px"
    mcd = __import__("math").gcd(w, h)
    return {
        "archivo": path.name if origen == "local" else str(path),
        "origen": origen,
        "px": f"{w}x{h}",
        "ancho": w,
        "alto": h,
        "peso_kb": round(path.stat().st_size / 1024, 1) if path.exists() else "",
        "formato": (im.format or path.suffix.lstrip(".")).upper(),
        "proporcion": f"{w // mcd}:{h // mcd}",
        "transparencia": "si" if tiene_transparencia(im) else "no",
        "fondo_bordes": fondo,
        "fondo_uniforme": "si" if uniforme else "no",
        "baja_resolucion": baja,
        "nota": nota,
    }


def auditar_locales():
    archivos = sorted((PUBLIC / "banners").glob("*")) + sorted((PUBLIC / "brand").glob("*"))
    archivos = [p for p in archivos if p.is_file() and not p.name.startswith(".")]
    return [auditar_archivo(p) for p in archivos]


def auditar_supabase(bucket):
    """Lista y audita objetos del bucket sin inventar URLs. Requiere env."""
    import urllib.request  # stdlib solamente

    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_ANON_KEY", "")
    if not url or not key:
        print("AVISO: sin SUPABASE_URL/SUPABASE_ANON_KEY, se omite bucket. Ver docstring.")
        return []
    payload = json.dumps({"prefix": "", "limit": 100}).encode()
    req = urllib.request.Request(
        f"{url}/storage/v1/object/list/{bucket}",
        data=payload,
        headers={"apikey": key, "Authorization": f"Bearer {key}",
                 "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        objetos = json.load(r)
    filas = []
    tmp = Path(tempfile.mkdtemp(prefix="ht-audit-"))
    for obj in objetos:
        nombre = obj.get("name", "")
        if not nombre or nombre.endswith("/"):
            continue
        if not nombre.lower().endswith((".webp", ".png", ".jpg", ".jpeg", ".avif")):
            continue
        dest = tmp / Path(nombre).name
        dl = urllib.request.Request(
            f"{url}/storage/v1/object/public/{bucket}/{nombre}",
            headers={"apikey": key},
        )
        try:
            with urllib.request.urlopen(dl, timeout=60) as r, open(dest, "wb") as f:
                f.write(r.read())
            filas.append(auditar_archivo(dest, origen=f"supabase:{bucket}/{nombre}"))
        except Exception as e:  # noqa: BLE001
            print(f"AVISO: no se pudo bajar {nombre}: {e}")
    print(f"(temporales en {tmp}, borrar a mano si hace falta)")
    return filas


def main():
    bucket = None
    if "--supabase-bucket" in sys.argv:
        bucket = sys.argv[sys.argv.index("--supabase-bucket") + 1]
    filas = auditar_locales()
    if bucket:
        filas += auditar_supabase(bucket)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    cols = ["archivo", "origen", "px", "peso_kb", "formato", "proporcion",
            "transparencia", "fondo_bordes", "fondo_uniforme",
            "baja_resolucion", "nota"]
    with open(CSV_OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(filas)
    manifiesto = {
        "_nota": "Fondo estimado por bordes/esquinas. No se tocan originales.",
        "fondos": {
            r["archivo"]: {"fondo": r["fondo_bordes"],
                           "uniforme": r["fondo_uniforme"],
                           "transparencia": r["transparencia"],
                           "px": r["px"]}
            for r in filas if r.get("px")
        },
    }
    with open(JSON_OUT, "w", encoding="utf-8") as f:
        json.dump(manifiesto, f, indent=2, ensure_ascii=False)
    bajas = [r for r in filas if r.get("baja_resolucion") == "SI"]
    print(f"Auditoria OK: {len(filas)} archivos -> {CSV_OUT.name} + manifiesto-fondos.json")
    for r in bajas:
        print(f"BAJA-RES: {r['archivo']} {r['px']} ({r['nota']})")


if __name__ == "__main__":
    main()
