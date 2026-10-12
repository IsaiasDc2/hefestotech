#!/usr/bin/env python3
"""HefestoTech - Procesar fotos de productos (solo crea archivos locales, nada de DB).

1) NUEVOS: descarga las fotos oficiales a TEMP (11 de 12: la del B850M-PLUS
   esta caida, ver NOTA bajo NUEVOS), remueve fondo blanco/negro
   uniforme (flood-fill desde bordes + feather; si el recorte dana el
   producto se conserva el original), centra en lienzo 1000x1000 WebP con
   el producto al ~80% y guarda en
   ecomers/client/public/productos-optimizados/nuevos/.
2) RESUBIR: reprocesa las fotos actuales del bucket cuyo fondo es
   blanco/negro uniforme (columna `fondo` de auditoria-bucket.csv) con el
   mismo keying y guarda en .../resubir/ con el MISMO nombre de archivo
   (listo para sobrescribir en el bucket). Las escenas NO se tocan.

Uso:
    py scripts/procesar-fotos.py [--nuevos-only | --resubir-only]
"""

import argparse
import csv
import os
import sys
import tempfile
import urllib.parse
import urllib.request

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDITORIA_CSV = os.path.join(
    REPO, "ecomers", "client", "public", "productos-optimizados",
    "auditoria-bucket.csv",
)
DIR_NUEVOS = os.path.join(
    REPO, "ecomers", "client", "public", "productos-optimizados", "nuevos")
DIR_RESUBIR = os.path.join(
    REPO, "ecomers", "client", "public", "productos-optimizados", "resubir")

UA = {"User-Agent": "hefestotech-procesar/1.0"}
LIENZO = 1000          # lienzo cuadrado final
PRODUCTO_PX = 800      # lado mayor del producto = 80% del lienzo

# (nombre logico, archivo destino, url oficial)
NUEVOS = [
    ("RTX 5070 ASUS Dual 12GB GDDR7", "rtx5070-asus-dual-12gb.webp",
     "https://dlcdnwebimgs.asus.com/gain/0d8a93cf-1150-40f4-8469-78cb7d193fdd/w800"),
    ("RX 9070 XT ASUS TUF 16GB GDDR6", "rx9070xt-asus-tuf-16gb.webp",
     "https://dlcdnwebimgs.asus.com/gain/aa54c1c4-67ba-427d-9b40-488646ae3ed5/w800"),
    ("ASUS TUF B850M-PLUS WIFI", "asus-tuf-b850m-plus-wifi.webp",
     "https://dlcdnwebimgs.asus.com/gain/c5c8e8fb-7dc1-4912-89af-3fd005d9f4d5/w800"),
    ("ASUS TUF B860M-PLUS WIFI", "asus-tuf-b860m-plus-wifi.webp",
     "https://dlcdnwebimgs.asus.com/gain/2cb8e12a-d1ad-4baf-b543-d57979bf56a9/w800"),
    ("Corsair Vengeance 32GB DDR5-6400", "corsair-vengeance-32gb-ddr5-6400.webp",
     "https://assets.corsair.com/image/upload/c_pad,q_85,h_1100,w_1100,f_auto/products/Memory/vengeance-ddr5-blk-config/Gallery/VENGEANCE_DDR5_BLK_01_2up.webp"),
    ("Corsair Dominator 32GB DDR5-6000", "corsair-dominator-32gb-ddr5-6000.webp",
     "https://assets.corsair.com/image/upload/c_pad,q_85,h_1100,w_1100,f_auto/products/Memory/CMT32GX5M2X6000C30/DOMINATOR_-PLATINUM-RGB-32GB-_2x16GB_-DDR5-DRAM-6000MHz-C30-Memory-Kit-_-Black-0.webp"),
    ("Samsung 990 PRO 2TB", "samsung-990-pro-2tb.webp",
     "https://images.samsung.com/is/image/samsung/p6pim/us/mz-v9p2t0b-am/gallery/us-990pro-nvme-m2-ssd-mz-v9p2t0b-am-551141316?$product-details-jpg$"),
    ("Seasonic FOCUS GX-850", "seasonic-focus-gx-850.webp",
     "https://seasonic.com/wp-content/uploads/2026/04/Focus_V5_GX850-1462x1080.webp"),
    ("ASUS TUF LC II 360 ARGB", "asus-tuf-lc-ii-360-argb.webp",
     "https://dlcdnwebimgs.asus.com/gain/0295450d-c47e-47fc-8237-45f42c48688c//w184"),
    ("ASUS TUF GT302 ARGB", "asus-tuf-gt302-argb.webp",
     "https://dlcdnwebimgs.asus.com/gain/a1cd7e69-1da4-484e-9ccf-b1579d5196f6/w800"),
    ("ASUS TUF K3", "asus-tuf-k3.webp",
     "https://dlcdnwebimgs.asus.com/gain/17b38f2d-d2e5-4952-b0ea-c99181fbde04/w800"),
    ("ASUS VG27AQ3A 27\"", "asus-vg27aq3a-27.webp",
     "https://dlcdnwebimgs.asus.com/gain/b6351479-db37-4f8e-9311-be37b14b01ae/w800"),
]

# NOTA (2026-10-10): la URL oficial del B850M-PLUS devuelve una pagina HTML
# de bloqueo ("Account Level System", HTTP 200 text/html), no una imagen.
# Se excluye del procesamiento: el producto queda SIN FOTO (imagen='')
# hasta que el duenio provea el archivo. No se inventa URL alternativa.
NUEVOS = [e for e in NUEVOS if e[1] != "asus-tuf-b850m-plus-wifi.webp"]


def descargar(url, destino, timeout=90):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r, \
            open(destino, "wb") as f:
        while True:
            chunk = r.read(65536)
            if not chunk:
                break
            f.write(chunk)
    return os.path.getsize(destino)


def color_fondo(rgb):
    """Mediana del marco exterior (3px). Devuelve (color, desvio, luminancia)."""
    import numpy as np
    a = np.asarray(rgb, dtype=np.float64)
    h, w, _ = a.shape
    b = 3
    marco = np.concatenate([
        a[:b, :, :].reshape(-1, 3), a[-b:, :, :].reshape(-1, 3),
        a[:, :b, :].reshape(-1, 3), a[:, -b:, :].reshape(-1, 3),
    ])
    med = np.median(marco, axis=0)
    std = float(marco.std())
    lum = float(0.299 * med[0] + 0.587 * med[1] + 0.114 * med[2])
    return med, std, lum


def flood_fill_fondo(rgb, bg, tol):
    """Mascara (True=fondo) conectada a los bordes por flood-fill.

    Trabaja sobre una version reducida (lado mayor <= 320) con dilatacion
    iterativa numpy: rapido y sin dependencias extra.
    """
    import numpy as np
    from PIL import Image
    w0, h0 = rgb.size
    esc = min(1.0, 320.0 / max(w0, h0))
    pequena = rgb.resize((max(1, int(w0 * esc)), max(1, int(h0 * esc))),
                         Image.BILINEAR)
    a = np.asarray(pequena, dtype=np.float64)
    h, w, _ = a.shape
    dist = np.sqrt(((a - bg) ** 2).sum(axis=2))
    similar = dist <= tol
    masc = np.zeros((h, w), dtype=bool)
    masc[0, :] = similar[0, :]
    masc[-1, :] = similar[-1, :]
    masc[:, 0] = similar[:, 0]
    masc[:, -1] = similar[:, -1]
    # Crecimiento: vecino-4 de la region & similar, hasta converger.
    while True:
        arriba = np.zeros_like(masc)
        arriba[1:, :] |= masc[:-1, :]
        arriba[:-1, :] |= masc[1:, :]
        arriba[:, 1:] |= masc[:, :-1]
        arriba[:, :-1] |= masc[:, 1:]
        nueva = masc | (arriba & similar)
        if np.array_equal(nueva, masc):
            break
        masc = nueva
    m = Image.fromarray((masc * 255).astype("uint8"))
    m = m.resize((w0, h0), Image.BILINEAR)
    from PIL import ImageFilter
    m = m.filter(ImageFilter.GaussianBlur(radius=max(1, round(1 / esc))))
    return m


def procesar_imagen(path_origen, path_destino):
    """Aplica keying + lienzo 1000x1000. Devuelve dict con el detalle."""
    from PIL import Image
    with Image.open(path_origen) as im:
        im.load()
        rgb = im.convert("RGB")
        traia_alfa = "A" in im.getbands()
        w0, h0 = rgb.size

    detalle = {"origen_px": f"{w0}x{h0}", "keying": "no-aplicado",
               "motivo": "", "transparente_pct": 0.0}

    alfa = None
    if not traia_alfa:
        bg, std, lum = color_fondo(rgb)
        if std > 30:
            detalle["motivo"] = (f"borde no uniforme (std={std:.1f}); "
                                 "se conserva original")
        elif lum >= 225:
            modo, tol = "blanco", 38.0
            masc = flood_fill_fondo(rgb, bg, tol)
            alfa = _evaluar_mascara(masc, detalle, modo)
        elif lum <= 30:
            modo, tol = "negro", 34.0
            masc = flood_fill_fondo(rgb, bg, tol)
            alfa = _evaluar_mascara(masc, detalle, modo)
        else:
            detalle["motivo"] = (f"fondo intermedio (lum={lum:.0f}); "
                                 "se conserva original")
    else:
        detalle["motivo"] = "ya traia transparencia; se conserva original"

    with Image.open(path_origen) as im:
        im.load()
        base = im.convert("RGBA")
    if alfa is not None:
        base.putalpha(alfa)

    # Recorte al contenido y escalado: lado mayor = 800 (80% del lienzo).
    alfa_banda = base.split()[3]
    bbox = alfa_banda.getbbox()
    if bbox is None:  # imagen totalmente transparente: no deberia pasar
        bbox = (0, 0, base.size[0], base.size[1])
        detalle["motivo"] += " | bbox vacia, se usa imagen completa"
    recorte = base.crop(bbox)
    factor = PRODUCTO_PX / max(recorte.size)
    if factor < 1.0 or max(recorte.size) < PRODUCTO_PX:
        # Escala en ambos sentidos para uniformidad del catalogo.
        recorte = recorte.resize(
            (max(1, round(recorte.size[0] * factor)),
             max(1, round(recorte.size[1] * factor))),
            Image.LANCZOS)

    from PIL import Image as _I
    lienzo = _I.new("RGBA", (LIENZO, LIENZO), (255, 255, 255, 255))
    lienzo.alpha_composite(
        recorte,
        ((LIENZO - recorte.size[0]) // 2, (LIENZO - recorte.size[1]) // 2))
    lienzo.convert("RGB").save(path_destino, "WEBP", quality=85, method=6)
    detalle["destino_bytes"] = os.path.getsize(path_destino)
    return detalle


def _evaluar_mascara(masc, detalle, modo):
    """Decide si la mascara es segura. Devuelve alfa o None (descartada)."""
    import numpy as np
    m = np.asarray(masc, dtype=np.float64) / 255.0
    total = m.size
    transp = float((m > 0.5).sum()) / total
    detalle["transparente_pct"] = round(transp * 100, 1)
    opaca = 1.0 - transp
    if transp < 0.02:
        detalle["keying"] = "sin-efecto"
        detalle["motivo"] = (f"fondo {modo} pero casi nada para recortar "
                             f"({detalle['transparente_pct']} %); se conserva original")
        return None
    if opaca < 0.10:
        detalle["keying"] = "descartado"
        detalle["motivo"] = (f"recorte danaria el producto (quedaria "
                             f"{opaca * 100:.1f} % opaco); se conserva original")
        return None
    from PIL import Image
    alfa = Image.fromarray(((1.0 - m) * 255).astype("uint8"))
    bbox = alfa.getbbox()
    if bbox is None:
        detalle["keying"] = "descartado"
        detalle["motivo"] = "mascara vacia; se conserva original"
        return None
    area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]) / total
    if area < 0.10:
        detalle["keying"] = "descartado"
        detalle["motivo"] = (f"bbox restante {area * 100:.1f} %; "
                             "se conserva original")
        return None
    detalle["keying"] = "aplicado"
    detalle["motivo"] = (f"fondo {modo} removido "
                         f"({detalle['transparente_pct']} % transparente)")
    return alfa


def leer_resubir():
    """Filas del CSV con fondo blanco/negro uniforme (escenas excluidas)."""
    filas = []
    with open(AUDITORIA_CSV, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            fondo = (row.get("fondo") or "").strip().lower()
            if fondo in ("blanco", "negro") and row.get("url"):
                filas.append(row)
    return filas


def main():
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--nuevos-only", action="store_true")
    g.add_argument("--resubir-only", action="store_true")
    args = ap.parse_args()

    tmp = tempfile.mkdtemp(prefix="hefestotech-fotos-")
    print(f"TEMP: {tmp}")
    resumen = {"nuevos_ok": 0, "nuevos_fallo": [], "resubir_ok": 0,
               "resubir_fallo": [], "keying_descartado": []}

    if not args.resubir_only:
        os.makedirs(DIR_NUEVOS, exist_ok=True)
        for i, (nombre, archivo, url) in enumerate(NUEVOS, 1):
            dest = os.path.join(DIR_NUEVOS, archivo)
            tmpf = os.path.join(tmp, f"nuevo_{i:02d}")
            try:
                descargar(url, tmpf)
                det = procesar_imagen(tmpf, dest)
                resumen["nuevos_ok"] += 1
                if det["keying"] == "descartado":
                    resumen["keying_descartado"].append(f"nuevos/{archivo}")
                print(f"[nuevo {i}/{len(NUEVOS)}] {archivo} {det['origen_px']} "
                      f"-> 1000x1000 webp {det['destino_bytes'] // 1024} KB "
                      f"| keying={det['keying']} ({det['motivo']})")
            except Exception as e:  # noqa: BLE001 - se reporta y se sigue
                resumen["nuevos_fallo"].append(f"{archivo}: {type(e).__name__}: {e}")
                print(f"[nuevo {i}/{len(NUEVOS)}] {archivo} FALLO: {e}")

    if not args.nuevos_only:
        os.makedirs(DIR_RESUBIR, exist_ok=True)
        filas = leer_resubir()
        print(f"resubir candidatas (fondo blanco/negro): {len(filas)}")
        for i, row in enumerate(filas, 1):
            archivo = row["archivo_bucket"]
            dest = os.path.join(DIR_RESUBIR, archivo)
            tmpf = os.path.join(tmp, f"resubir_{i:02d}")
            try:
                descargar(row["url"], tmpf)
                det = procesar_imagen(tmpf, dest)
                resumen["resubir_ok"] += 1
                if det["keying"] == "descartado":
                    resumen["keying_descartado"].append(f"resubir/{archivo}")
                print(f"[resubir {i}/{len(filas)}] {archivo} {det['origen_px']} "
                      f"-> 1000x1000 ({det['destino_bytes'] // 1024} KB) "
                      f"| keying={det['keying']} ({det['motivo']})")
            except Exception as e:  # noqa: BLE001
                resumen["resubir_fallo"].append(f"{archivo}: {type(e).__name__}: {e}")
                print(f"[resubir {i}/{len(filas)}] {archivo} FALLO: {e}")

    print("RESUMEN:", resumen)
    if resumen["nuevos_fallo"] or resumen["resubir_fallo"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
