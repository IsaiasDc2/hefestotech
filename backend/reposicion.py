"""HefestoTech · backend/reposicion.py
Motor de reposición de stock.

Cuando un producto activo llega a su punto de reposición (`stock_minimo`) y no
tiene una orden de compra abierta, registra una solicitud al proveedor
principal con la cantidad necesaria para llegar a `stock_objetivo` (o al doble
del mínimo si no se configuró) y deja una notificación para el staff.

Reglas:
- `stock_minimo <= 0` desactiva la reposición de ese producto.
- No se inventan cantidades ni costos: salen de `productos` y
  `producto_proveedor`. Si falta el proveedor principal, solo se notifica.
- Idempotente: mientras haya una OC abierta con ese producto no se crea otra.
- Los helpers REST se inyectan (`sb_get`, `sb_post`) para que este módulo no
  dependa de `admin_api` ni de `checkout_api` y sea testeable sin red.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from math import ceil
from typing import Any, Callable

OC_ABIERTAS = {"borrador", "enviada", "confirmada", "recibida_parcial"}
MONEDAS = {"ARS", "USD"}
MAX_UNIDADES = 1_000_000

SbGet = Callable[[str, dict[str, Any]], Any]
SbPost = Callable[..., Any]
SbPatch = Callable[[str, dict[str, Any], dict[str, Any]], Any]


def _entero(valor: Any, por_defecto: int = 0) -> int:
    try:
        return int(valor)
    except (TypeError, ValueError):
        return por_defecto


def _codigo_oc(numero: Any) -> str:
    try:
        return f"OC-{int(numero):06d}"
    except (TypeError, ValueError):
        return "OC"


def _notificar(*, sb_get: SbGet, sb_post: SbPost, titulo: str, mensaje: str,
               dedupe: str) -> bool:
    """Inserta una notificación visible para todo el staff (user_id null)."""
    try:
        existentes = sb_get("notificaciones", {
            "select": "id", "dedupe_key": f"eq.{dedupe}", "limit": 1,
        }) or []
    except Exception:
        existentes = []
    if existentes:
        return False
    try:
        sb_post("notificaciones", {
            "user_id": None, "titulo": titulo[:200], "mensaje": mensaje[:2000],
            "dedupe_key": dedupe,
        }, prefer="return=representation")
        return True
    except Exception:
        return False


def _evaluar(producto_id: str, sb_get: SbGet, sb_post: SbPost,
             sb_patch: SbPatch | None, hoy: date | None, actor: str | None) -> dict[str, Any]:
    filas = sb_get("productos", {
        "select": "id,nombre,stock,stock_minimo,stock_objetivo,activo,deleted_at",
        "id": f"eq.{producto_id}", "limit": 1,
    }) or []
    if not filas:
        return {"accion": "inexistente", "producto_id": producto_id}
    p = filas[0]
    if p.get("deleted_at") is not None or not p.get("activo", True):
        return {"accion": "inactivo", "producto_id": producto_id}

    stock = _entero(p.get("stock"))
    minimo = _entero(p.get("stock_minimo") if p.get("stock_minimo") is not None else 5)
    if minimo <= 0 or stock >= minimo:
        return {"accion": "sin_alerta", "producto_id": producto_id,
                "stock": stock, "stock_minimo": minimo}

    # Una OC abierta (manual o automática) con este producto ya cubre el pedido.
    items = sb_get("ordenes_compra_items", {
        "select": "orden_id,cantidad,cantidad_recibida,ordenes_compra(id,numero,estado,origen)",
        "producto_id": f"eq.{producto_id}", "limit": 300,
    }) or []
    for it in items:
        oc = it.get("ordenes_compra") or {}
        if str(oc.get("estado") or "") in OC_ABIERTAS:
            return {"accion": "ya_pedido", "producto_id": producto_id,
                    "orden_id": oc.get("id"), "codigo": _codigo_oc(oc.get("numero"))}

    nombre = str(p.get("nombre") or "Producto")
    relaciones = sb_get("producto_proveedor", {
        "select": ("proveedor_id,costo_centavos,moneda,cantidad_minima,"
                   "tiempo_entrega_dias,proveedores(id,nombre,moneda,estado,"
                   "deleted_at,plazo_entrega_dias)"),
        "producto_id": f"eq.{producto_id}", "es_principal": "eq.true", "limit": 1,
    }) or []
    rel = relaciones[0] if relaciones else None
    prov = (rel or {}).get("proveedores") or {}
    if (not rel or not prov or prov.get("deleted_at") is not None
            or str(prov.get("estado") or "activo") != "activo"):
        _notificar(
            sb_get=sb_get, sb_post=sb_post,
            titulo=f"Producto por agotarse: {nombre}",
            mensaje=(f"Quedan {stock} u. (mínimo {minimo}) y no tiene proveedor "
                     "principal activo. Asignale uno para enviar la solicitud de reposición."),
            dedupe=f"reposicion-sin-proveedor:{producto_id}:{hoy or date.today()}",
        )
        return {"accion": "sin_proveedor", "producto_id": producto_id,
                "stock": stock, "stock_minimo": minimo}

    objetivo = _entero(p.get("stock_objetivo"))
    if objetivo <= stock:
        objetivo = max(minimo * 2, minimo + 1)

    cantidad_minima = max(1, _entero(rel.get("cantidad_minima"), 1))
    faltan = max(objetivo - stock, 1)
    cantidad = max(faltan, cantidad_minima)
    cantidad = int(ceil(cantidad / cantidad_minima) * cantidad_minima)
    cantidad = min(cantidad, MAX_UNIDADES)

    moneda = str(rel.get("moneda") or prov.get("moneda") or "ARS").upper()
    if moneda not in MONEDAS:
        moneda = "ARS"
    costo = max(0, _entero(rel.get("costo_centavos")))

    dias = _entero(rel.get("tiempo_entrega_dias"), -1)
    if dias < 0:
        dias = _entero(prov.get("plazo_entrega_dias"), 7)
    dias = max(0, min(dias, 365))
    fecha_esperada = (hoy or date.today()) + timedelta(days=dias)

    proveedor_nombre = str(prov.get("nombre") or "Proveedor")
    nota = (f"[Reposición] {nombre}: stock {stock} u., mínimo {minimo}, "
            f"objetivo {objetivo}. Solicitud: {cantidad} u.")
    fila = {
        "proveedor_id": str(rel.get("proveedor_id")),
        "estado": "enviada",
        "moneda": moneda,
        "notas": nota,
        "fecha_esperada": fecha_esperada.isoformat(),
        "creado_por": actor,
        "enviada_at": datetime.now(timezone.utc).isoformat(),
        "origen": "reposicion",
    }
    try:
        creadas = sb_post("ordenes_compra", fila) or []
    except Exception:
        # Base sin la migración 016: se conserva la solicitud con la marca en
        # las notas (la consulta de abiertas igual la detecta por producto).
        fila.pop("origen", None)
        creadas = sb_post("ordenes_compra", fila) or []
    if not creadas:
        return {"accion": "error", "producto_id": producto_id,
                "detalle": "no se pudo crear la orden"}
    oc = creadas[0]
    oc_id = str(oc.get("id") or "")
    if not oc_id:
        return {"accion": "error", "producto_id": producto_id,
                "detalle": "orden sin id"}

    try:
        sb_post("ordenes_compra_items", [{
            "orden_id": oc_id, "producto_id": producto_id,
            "cantidad": cantidad, "costo_unitario_centavos": costo,
        }], prefer="return=minimal")
    except Exception:
        # Sin transacción por REST: cancelar la cabecera recién creada.
        if sb_patch:
            try:
                sb_patch("ordenes_compra", {"id": f"eq.{oc_id}", "estado": "eq.enviada"},
                         {"estado": "cancelada",
                          "cancelada_at": datetime.now(timezone.utc).isoformat()})
            except Exception:
                pass
        return {"accion": "error", "producto_id": producto_id,
                "detalle": "no se pudo guardar el ítem"}

    codigo = _codigo_oc(oc.get("numero"))
    _notificar(
        sb_get=sb_get, sb_post=sb_post,
        titulo=f"Reposición enviada: {nombre}",
        mensaje=(f"El stock llegó a {stock} u. (mínimo {minimo}). Se registró la "
                 f"solicitud de {cantidad} u. a {proveedor_nombre} · {codigo}."),
        dedupe=f"reposicion:{oc_id}",
    )
    return {
        "accion": "solicitud_creada", "producto_id": producto_id,
        "orden_id": oc_id, "codigo": codigo, "cantidad": cantidad,
        "proveedor": proveedor_nombre, "stock": stock, "stock_minimo": minimo,
        "stock_objetivo": objetivo,
    }


def evaluar_producto(producto_id: str, *, sb_get: SbGet, sb_post: SbPost,
                     sb_patch: SbPatch | None = None, hoy: date | None = None,
                     actor: str | None = None) -> dict[str, Any]:
    """Evalúa un producto. Nunca levanta: un fallo de reposición no puede
    tumbar una venta, un ajuste de stock ni un pago acreditado."""
    try:
        return _evaluar(str(producto_id), sb_get, sb_post, sb_patch, hoy, actor)
    except Exception as exc:  # noqa: BLE001 - se registra sin datos sensibles
        print(f"AVISO reposicion: no se pudo evaluar {producto_id} ({type(exc).__name__}).")
        return {"accion": "error", "producto_id": str(producto_id)}


def evaluar_varios(producto_ids: list[str], *, sb_get: SbGet, sb_post: SbPost,
                   sb_patch: SbPatch | None = None, hoy: date | None = None,
                   actor: str | None = None) -> list[dict[str, Any]]:
    """Evalúa una lista sin repetir productos."""
    vistos: set[str] = set()
    salida: list[dict[str, Any]] = []
    for pid in producto_ids:
        clave = str(pid or "").strip()
        if not clave or clave in vistos:
            continue
        vistos.add(clave)
        salida.append(evaluar_producto(clave, sb_get=sb_get, sb_post=sb_post,
                                       sb_patch=sb_patch, hoy=hoy, actor=actor))
    return salida
