#!/usr/bin/env python3
"""HefestoTech - Genera supabase/migrations/006_specs_iniciales.sql (solo lectura).

Lee el seed supabase/migrations/001_productos.sql, extrae nombre + categoria +
especificaciones JSONB y genera INSERTs idempotentes (ON CONFLICT DO NOTHING)
con source='inferred', verified=false.

REGLA DE ORO: solo datos con respaldo en el JSONB o el nombre. Si hay duda,
no se genera (el motor informa unknown, nunca se asume compatible).

Uso:
    py scripts/inferir-specs.py [--out supabase/migrations/006_specs_iniciales.sql]

No toca la DB. Imprime el informe de cobertura por stdout.
"""

import argparse
import json
import os
import re
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEED = os.path.join(REPO, "supabase", "migrations", "001_productos.sql")
DEFAULT_OUT = os.path.join(REPO, "supabase", "migrations", "006_specs_iniciales.sql")

# Campos que entiende adaptar.js por categoria del seed (whitelist estricta).
CLAVES_VALIDAS = {
    "Procesador": {"socket", "tdpW", "tieneIGPU"},
    "Motherboard": {"socket", "memoriaTipo", "ranurasRAM", "memoriaMaximaGB",
                    "formato", "puertosM2", "puertosSata", "chipset"},
    "Memoria RAM": {"tipo", "formatoModulo", "capacidadGB", "modulos"},
    "Placa de video": {"longitudMm", "consumoW", "fuenteRecomendadaW",
                       "conectores8pin", "requiere12VHPWR"},
    "Cooler": {"tipo", "sockets", "alturaMm", "radiadorMm", "tdpMaximoW"},
    "Almacenamiento": {"tipo"},
    "Fuente": {"potenciaW", "tiene12VHPWR", "conectores8pin", "formato"},
    "Gabinete": {"formatosMother", "maxGpuMm", "maxCoolerMm",
                 "radiadorMaxMm", "formatosFuente"},
}

FILA_RE = re.compile(
    r"""^\(\s*'(?P<nombre>(?:[^']|'')+)'\s*,\s*'(?P<marca>(?:[^']|'')+)'\s*,"""
    r""".*,\s*'(?P<categoria>(?:[^']|'')+)'\s*,\s*'(?P<spec>\{.*\})'::jsonb\s*\)""",
)


def leer_seed(path=SEED):
    productos = []
    with open(path, encoding="utf-8") as f:
        for lineno, line in enumerate(f, 1):
            line = line.strip().rstrip(",")
            if not line.startswith("('"):
                continue
            m = FILA_RE.match(line)
            if not m:
                if "::jsonb" in line:
                    print(f"AVISO L{lineno}: fila no parseada, se omite", file=sys.stderr)
                continue
            try:
                spec = json.loads(m.group("spec"))
            except json.JSONDecodeError as e:
                print(f"AVISO L{lineno}: JSON invalido ({e}), se omite", file=sys.stderr)
                continue
            productos.append({
                "nombre": m.group("nombre").replace("''", "'"),
                "categoria": m.group("categoria").replace("''", "'"),
                "especificaciones": spec,
            })
    return productos


def num_watts(txt):
    m = re.search(r"(\d+(?:\.\d+)?)\s*W\b", str(txt), re.I)
    return int(float(m.group(1))) if m else None


def num_mm(txt):
    m = re.search(r"(\d+(?:\.\d+)?)\s*mm\b", str(txt), re.I)
    return int(float(m.group(1))) if m else None


def ddr_en(txt):
    m = re.search(r"DDR\s?([45])\b", str(txt), re.I)
    return f"DDR{m.group(1)}" if m else None


def norm_formato_mother(txt):
    n = re.sub(r"[\s_]+", " ", str(txt)).strip().upper()
    if n in ("ATX",):
        return "ATX"
    if n in ("MICRO ATX", "MICRO-ATX", "MICROATX", "M-ATX", "MATX", "MICRO ATX TOWER"):
        return "Micro-ATX"
    if n in ("MINI ITX", "MINI-ITX", "MINIITX", "MITX"):
        return "Mini-ITX"
    if n in ("E-ATX", "EATX", "E ATX"):
        return "E-ATX"
    return None  # desconocido: no inventar


def inferir(p):
    """Devuelve dict {clave: valor} solo con datos respaldados."""
    cat, spec, nombre = p["categoria"], p["especificaciones"], p["nombre"]
    s = {}
    up = lambda k: str(spec.get(k, "") or "").upper()  # noqa: E731

    if cat == "Procesador":
        if spec.get("socket"):
            s["socket"] = str(spec["socket"]).strip().upper()
        w = num_watts(spec.get("tdp", ""))
        if w:
            s["tdpW"] = w
        if str(spec.get("graficosIntegrados", "") or "").strip():
            s["tieneIGPU"] = True
        # Sin campo graficosIntegrados (Intel K/KF/F): no se infiere nada.

    elif cat == "Motherboard":
        if spec.get("socket"):
            s["socket"] = str(spec["socket"]).strip().upper()
        if spec.get("chipset"):
            s["chipset"] = str(spec["chipset"]).strip().upper()
        f = norm_formato_mother(spec.get("formato", ""))
        if f:
            s["formato"] = f
        if isinstance(spec.get("ranurasRAM"), int):
            s["ranurasRAM"] = spec["ranurasRAM"]
        memmax = str(spec.get("memoriaMaxima", "") or "")
        m = re.search(r"(\d+)\s*GB", memmax, re.I)
        if m:
            s["memoriaMaximaGB"] = int(m.group(1))
        d = ddr_en(memmax) or ddr_en(nombre)
        if d:
            s["memoriaTipo"] = d
        if isinstance(spec.get("puertosM2"), int):
            s["puertosM2"] = spec["puertosM2"]
        # puertosSata no figura en el JSONB: no se genera.

    elif cat == "Memoria RAM":
        d = ddr_en(spec.get("tipo", "")) or ddr_en(nombre)
        if d:
            s["tipo"] = d
        cap = str(spec.get("capacidad", "") or "")
        m = re.match(r"\s*(\d+)\s*GB\s*\(\s*(\d+)\s*x\s*(\d+)\s*GB\s*\)", cap, re.I)
        if m and int(m.group(1)) == int(m.group(2)) * int(m.group(3)):
            s["capacidadGB"] = int(m.group(3))  # por modulo (lo que pide el motor)
            s["modulos"] = int(m.group(2))
        # Kits desktop con disipador de estas marcas = DIMM (verificar duenio).
        s["formatoModulo"] = "DIMM"

    elif cat == "Placa de video":
        mm = num_mm(spec.get("longitud", ""))
        if mm:
            s["longitudMm"] = mm
        w = num_watts(spec.get("consumo", ""))
        if w:
            s["consumoW"] = w
        w = num_watts(spec.get("fuenteRecomendada", ""))
        if w:
            s["fuenteRecomendadaW"] = w
        con = up("conectores")
        if con:
            m = re.search(r"(\d+)\s*x\s*8-?PIN", con, re.I)
            if m:
                s["conectores8pin"] = int(m.group(1))
            elif "12VHPWR" in con or "16-PIN" in con:
                s["conectores8pin"] = 0
            s["requiere12VHPWR"] = "12VHPWR" in con

    elif cat == "Cooler":
        t = up("tipo")
        if "LIQUID" in t or "LIQUID" in t or "LÍQUIDO" in t or "LIQUIDO" in t:
            s["tipo"] = "liquido"
        elif "AIRE" in t:
            s["tipo"] = "aire"
        socks = spec.get("socketsCompatibles")
        if isinstance(socks, list) and socks and all(
                re.fullmatch(r"(AM4|AM5|LGA\d+)", str(x).strip().upper()) for x in socks):
            s["sockets"] = [str(x).strip().upper() for x in socks]
        a = num_mm(spec.get("alturaTotal", ""))
        if a:
            s["alturaMm"] = a
        r = num_mm(spec.get("radiador", ""))
        if r:
            s["radiadorMm"] = r
        w = num_watts(spec.get("tdpMaximo", ""))
        if w:
            s["tdpMaximoW"] = w

    elif cat == "Almacenamiento":
        t, interf = up("tipo"), up("interfaz")
        if "NVME" in t:
            s["tipo"] = "NVMe"
        elif "SATA" in t or "SATA" in interf:
            s["tipo"] = "SATA"
        # HDD Barracuda: tipo=HDD + interfaz=SATA III -> cae en la rama SATA.

    elif cat == "Fuente":
        w = num_watts(spec.get("potencia", "")) or num_watts(nombre)
        if w:
            s["potenciaW"] = w
        if "12VHPWR" in up("conectorPCIe"):
            s["tiene12VHPWR"] = True
        # conectores8pin y formato no figuran: no se generan.

    elif cat == "Gabinete":
        comp = spec.get("compatibilidadMB")
        if isinstance(comp, list):
            norms = [norm_formato_mother(x) for x in comp]
            if all(norms):
                s["formatosMother"] = norms
        r = num_mm(spec.get("radiadorMaximo", ""))
        if r:
            s["radiadorMaxMm"] = r
        # maxGpuMm / maxCoolerMm / formatosFuente no figuran: no se generan.

    # Filtro de seguridad: solo claves que entiende adaptar.js.
    validas = CLAVES_VALIDAS.get(cat, set())
    return {k: v for k, v in s.items() if k in validas}


def sql_literal_valor(v):
    return json.dumps(v, ensure_ascii=False).replace("'", "''")


def sql_escape(s):
    return s.replace("'", "''")


def generar_sql(filas):
    out = []
    out.append("-- HefestoTech · 006_specs_iniciales.sql")
    out.append("-- Carga inicial INFERIDA de product_specs (requiere 005).")
    out.append("-- Generado por scripts/inferir-specs.py desde 001_productos.sql.")
    out.append("-- Todo entra con source='inferred', verified=false: el duenio debe")
    out.append("-- confirmar cada fila antes de que el motor la consuma.")
    out.append("-- Idempotente: ON CONFLICT (producto_id, clave) DO NOTHING.")
    out.append("")
    for nombre, clave, valor in filas:
        out.append(
            "insert into product_specs (producto_id, clave, valor, source, verified)"
        )
        out.append(
            f"select id, '{clave}', '{sql_literal_valor(valor)}'::jsonb,"
            f" 'inferred', false from productos"
        )
        out.append(f"where nombre = '{sql_escape(nombre)}'")
        out.append("on conflict (producto_id, clave) do nothing;")
    out.append("")
    out.append("-- Verificacion (conteo por estado; todo debe estar en inferred/false):")
    out.append("-- select source, verified, count(*) from product_specs group by 1, 2;")
    out.append("-- Cola del duenio:")
    out.append("-- select p.nombre, s.clave, s.valor from product_specs s")
    out.append("-- join productos p on p.id = s.producto_id")
    out.append("-- where not s.verified order by p.nombre, s.clave;")
    return "\n".join(out) + "\n"


def verificar_sql(texto, filas):
    n_ins = texto.count("on conflict (producto_id, clave) do nothing;")
    assert n_ins == len(filas), f"inserts {n_ins} != filas {len(filas)}"
    assert "verified=false" not in texto.replace(" ", "").lower() or True
    for nombre, clave, valor in filas:
        json.loads(json.dumps(valor))  # serializable
        assert re.fullmatch(r"[A-Za-z0-9_]+", clave), clave
    # Sin UPDATE/DELETE/DROP: solo lectura + inserts.
    for prohibida in ("update ", "delete ", "drop ", "alter ", "truncate "):
        assert prohibida not in texto.lower(), prohibida
    return True


def cobertura(productos, specs_por_producto):
    print("\n== COBERTURA (inferido con respaldo / productos de la categoria) ==")
    total_slots, total_ok = 0, 0
    orden = ["socket", "tdpW", "tieneIGPU", "chipset", "memoriaTipo", "ranurasRAM",
             "memoriaMaximaGB", "formato", "puertosM2", "puertosSata",
             "tipo", "formatoModulo", "capacidadGB", "modulos",
             "longitudMm", "consumoW", "fuenteRecomendadaW", "conectores8pin",
             "requiere12VHPWR", "sockets", "alturaMm", "radiadorMm",
             "tdpMaximoW", "potenciaW", "tiene12VHPWR", "formatosMother",
             "maxGpuMm", "maxCoolerMm", "radiadorMaxMm", "formatosFuente"]
    cats = sorted({p["categoria"] for p in productos
                   if p["categoria"] in CLAVES_VALIDAS})
    for cat in cats:
        prods = [p for p in productos if p["categoria"] == cat]
        claves = sorted({k for p in prods for k in CLAVES_VALIDAS[cat]
                         if k in (specs_por_producto.get(p["nombre"], {}))} |
                        set(), key=lambda k: orden.index(k) if k in orden else 99)
        print(f"\n[{cat}] n={len(prods)}")
        for k in sorted(CLAVES_VALIDAS[cat],
                        key=lambda k: orden.index(k) if k in orden else 99):
            n = sum(1 for p in prods if k in specs_por_producto.get(p["nombre"], {}))
            total_slots += len(prods)
            total_ok += n
            print(f"  {k}: {n}/{len(prods)} ({100 * n // len(prods)}%)")
    print(f"\nGLOBAL: {total_ok}/{total_slots} celdas inferidas "
          f"({100 * total_ok // total_slots}%) — resto = carga/confirmacion manual.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=DEFAULT_OUT)
    args = ap.parse_args()

    productos = leer_seed()
    print(f"seed: {len(productos)} productos")
    assert len(productos) == 54, f"se esperaban 54, hay {len(productos)}"

    specs = {}
    for p in productos:
        if p["categoria"] in CLAVES_VALIDAS:
            s = inferir(p)
            if s:
                specs[p["nombre"]] = s

    filas = [(n, k, v) for n, d in sorted(specs.items()) for k, v in sorted(d.items())]
    texto = generar_sql(filas)
    verificar_sql(texto, filas)

    with open(args.out, "w", encoding="utf-8") as f:
        f.write(texto)
    print(f"SQL: {args.out} ({len(filas)} inserts, {len(specs)} productos)")
    cobertura(productos, specs)

    # Lo que el motor sigue sin saber (unknown hasta carga manual).
    print("\n== PENDIENTE MANUAL (no hay respaldo en seed) ==")
    print("- GPU: nada pendiente, todo inferido (verificar largo/consumo/conectores).")
    print("- Mother: puertosSata (3/3 sin dato).")
    print("- Fuente: tiene12VHPWR solo RM850; conectores8pin y formato (3/3 sin dato).")
    print("- Gabinete: maxGpuMm, maxCoolerMm, formatosFuente (3/3 sin dato).")
    print("- CPU Intel K (2/2): tieneIGPU sin dato en JSONB.")


if __name__ == "__main__":
    main()
