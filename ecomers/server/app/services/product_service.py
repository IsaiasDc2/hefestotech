from collections.abc import Sequence

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.product import Product


def list_products(
    db: Session,
    *,
    categoria: str | None = None,
    destacado: bool | None = None,
    ofertas: bool | None = None,
    q: str | None = None,
    activo: bool | None = True,
    limit: int = 50,
    offset: int = 0,
) -> Sequence[Product]:
    statement = select(Product)

    if activo is not None:
        statement = statement.where(Product.activo == activo)
    if categoria:
        statement = statement.where(Product.categoria.ilike(categoria))
    if destacado is not None:
        statement = statement.where(Product.destacado == destacado)
    if ofertas is True:
        statement = statement.where(Product.descuento_porcentaje > 0)
    if q:
        like = f"%{q.strip()}%"
        statement = statement.where(
            or_(
                Product.nombre.ilike(like),
                Product.descripcion.ilike(like),
                Product.marca.ilike(like),
            )
        )

    statement = statement.order_by(Product.destacado.desc(), Product.created_at.desc())
    statement = statement.limit(limit).offset(offset)
    return db.scalars(statement).all()


def search_products(db: Session, q: str, **kwargs) -> Sequence[Product]:
    return list_products(db, q=q, **kwargs)


def list_destacados(db: Session, limite: int = 8) -> Sequence[Product]:
    return list_products(db, destacado=True, limit=limite, offset=0, activo=True)


def list_ofertas(db: Session, limite: int = 10) -> Sequence[Product]:
    return list_products(db, ofertas=True, limit=limite, offset=0, activo=True)
