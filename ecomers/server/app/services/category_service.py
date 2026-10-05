from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.category import Category


def list_categories(db: Session) -> Sequence[Category]:
    statement = select(Category).order_by(Category.nombre)
    return db.scalars(statement).all()
