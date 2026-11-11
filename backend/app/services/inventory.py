from datetime import date, timedelta
from typing import Iterable

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..config import settings
from ..models import Batch, Medicine, Sale, SaleItem


def _round(value: float) -> float:
    return round(float(value or 0) + 1e-9, 2)


def batch_unit_prices(medicine: Medicine, batch: Batch) -> tuple[float, float]:
    """(سعر العلبة, سعر الشريط) مبنيًا على سعر بيع التشغيلة"""
    spb = medicine.strips_per_box or 1
    return _round(batch.sell_price), _round(float(batch.sell_price) / spb)


def batch_unit_costs(medicine: Medicine, batch: Batch) -> tuple[float, float]:
    spb = medicine.strips_per_box or 1
    return _round(batch.buy_price), _round(float(batch.buy_price) / spb)


def active_batches(
    db: Session, medicine_id: int, *, lock: bool = False
) -> list[Batch]:
    """التشغيلات الصالحة فقط مرتبة حسب أقرب تاريخ انتهاء (FEFO)"""
    query = (
        db.query(Batch)
        .filter(
            Batch.medicine_id == medicine_id,
            Batch.expiry_date >= date.today(),
            (Batch.quantity_boxes > 0) | (Batch.quantity_strips > 0),
        )
        .order_by(Batch.expiry_date.asc(), Batch.id.asc())
    )
    if lock:
        query = query.with_for_update()
    return query.all()


def get_stock_map(db: Session, medicine_ids: Iterable[int]) -> dict[int, dict]:
    """ملخص المخزون لمجموعة أدوية في استعلام واحد"""
    ids = list(medicine_ids)
    if not ids:
        return {}

    rows = (
        db.query(
            Batch.medicine_id,
            func.coalesce(func.sum(Batch.quantity_boxes), 0),
            func.coalesce(func.sum(Batch.quantity_strips), 0),
            func.min(Batch.expiry_date),
        )
        .filter(
            Batch.medicine_id.in_(ids),
            Batch.expiry_date >= date.today(),
            (Batch.quantity_boxes > 0) | (Batch.quantity_strips > 0),
        )
        .group_by(Batch.medicine_id)
        .all()
    )

    stock = {
        med_id: {
            "boxes": int(boxes or 0),
            "strips": int(strips or 0),
            "nearest_expiry": nearest,
        }
        for med_id, boxes, strips, nearest in rows
    }

    # أسعار البيع/الشراء: من أول تشغيلة سارية (FEFO) وإلا آخر تشغيلة معروفة
    pricing_rows = (
        db.query(Batch)
        .filter(Batch.medicine_id.in_(ids))
        .order_by(Batch.medicine_id.asc(), Batch.expiry_date.asc())
        .all()
    )
    pricing: dict[int, Batch] = {}
    fallback: dict[int, Batch] = {}
    today = date.today()
    for batch in pricing_rows:
        fallback[batch.medicine_id] = batch
        if batch.expiry_date >= today and (
            (batch.quantity_boxes or 0) > 0 or (batch.quantity_strips or 0) > 0
        ):
            pricing.setdefault(batch.medicine_id, batch)

    for med_id in ids:
        entry = stock.setdefault(
            med_id, {"boxes": 0, "strips": 0, "nearest_expiry": None}
        )
        batch = pricing.get(med_id) or fallback.get(med_id)
        entry["sell_price"] = _round(batch.sell_price) if batch else 0.0
        entry["cost_price"] = _round(batch.buy_price) if batch else 0.0
        entry["batch_number"] = batch.batch_number if batch else None
    return stock


def sold_quantities(db: Session, medicine_ids: Iterable[int], days: int = 30) -> dict[int, int]:
    ids = list(medicine_ids)
    if not ids:
        return {}
    since = date.today() - timedelta(days=days)
    rows = (
        db.query(
            Batch.medicine_id,
            func.coalesce(
                func.sum(SaleItem.quantity_boxes_sold + SaleItem.quantity_strips_sold), 0
            ),
        )
        .join(SaleItem, SaleItem.batch_id == Batch.id)
        .join(Sale, Sale.id == SaleItem.sale_id)
        .filter(
            Batch.medicine_id.in_(ids),
            Sale.status == "completed",
            Sale.created_at >= since,
        )
        .group_by(Batch.medicine_id)
        .all()
    )
    return {med_id: int(qty or 0) for med_id, qty in rows}


def stock_status(medicine: Medicine, boxes: int, strips: int) -> str:
    spb = medicine.strips_per_box or 1
    equivalent = boxes + (strips / spb)
    if equivalent <= 0:
        return "out"
    if equivalent <= (medicine.min_stock_level or settings.low_stock_threshold):
        return "low"
    return "ok"


def allocate_fefo(
    db: Session, medicine: Medicine, unit_type: str, quantity: int, *, lock: bool = True
) -> list[dict]:
    """توزيع الكمية المطلوبة على التشغيلات بنظام FEFO

    يعيد قائمة بالتفاصيل: التشغيلة، الكمية، سعر الوحدة، التكلفة، الإجمالي
    """
    batches = active_batches(db, medicine.id, lock=lock)
    field = "quantity_boxes" if unit_type == "box" else "quantity_strips"
    available = sum(getattr(b, field) or 0 for b in batches)

    if available < quantity:
        unit_label = "علبة" if unit_type == "box" else "شريط"
        raise HTTPException(
            status_code=400,
            detail=(
                f"الكمية المطلوبة ({quantity} {unit_label}) من "
                f"«{medicine.trade_name}» غير متوفرة. المتاح حاليًا: {available}"
            ),
        )

    remaining = quantity
    allocations: list[dict] = []
    for batch in batches:
        if remaining <= 0:
            break
        batch_qty = getattr(batch, field) or 0
        if batch_qty <= 0:
            continue
        take = min(batch_qty, remaining)
        sell_box, sell_strip = batch_unit_prices(medicine, batch)
        cost_box, cost_strip = batch_unit_costs(medicine, batch)
        unit_price = sell_box if unit_type == "box" else sell_strip
        unit_cost = cost_box if unit_type == "box" else cost_strip
        allocations.append(
            {
                "batch": batch,
                "quantity": take,
                "unit_price": unit_price,
                "unit_cost": unit_cost,
                "subtotal": _round(unit_price * take),
                "cost_total": _round(unit_cost * take),
            }
        )
        remaining -= take
    return allocations


def restock_batch(db: Session, batch_id: int, boxes: int, strips: int) -> None:
    batch = db.get(Batch, batch_id)
    if not batch:
        return
    batch.quantity_boxes = (batch.quantity_boxes or 0) + int(boxes or 0)
    batch.quantity_strips = (batch.quantity_strips or 0) + int(strips or 0)



