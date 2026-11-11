from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from ..config import settings
from ..database import get_db
from ..deps import get_current_user
from ..models import Batch, Medicine, Sale, SaleItem, User
from ..services.inventory import get_stock_map, stock_status

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _resolve_range(range_key: str, from_date: date | None, to_date: date | None):
    today = date.today()
    if range_key == "today":
        start, end = today, today
    elif range_key == "week":
        start, end = today - timedelta(days=6), today
    elif range_key == "month":
        start, end = today - timedelta(days=29), today
    elif range_key == "year":
        start, end = today - timedelta(days=364), today
    else:
        start = from_date or (today - timedelta(days=6))
        end = to_date or today
    return start, end


def _percent_change(current: float, previous: float) -> float | None:
    if previous == 0:
        return None if current == 0 else 100.0
    return round((current - previous) / previous * 100, 1)


@router.get("/summary")
def summary(
    range_key: str = Query(default="week", alias="range"),
    from_date: date | None = Query(default=None, alias="from"),
    to_date: date | None = Query(default=None, alias="to"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    start, end = _resolve_range(range_key, from_date, to_date)
    span = (end - start).days + 1
    prev_start = start - timedelta(days=span)
    prev_end = start - timedelta(days=1)

    def totals(s: date, e: date):
        row = (
            db.query(
                func.coalesce(func.sum(Sale.net_amount), 0),
                func.count(Sale.id),
                func.coalesce(func.sum(Sale.net_amount - Sale.cost_amount), 0),
            )
            .filter(
                Sale.status == "completed",
                Sale.created_at >= datetime.combine(s, time.min),
                Sale.created_at < datetime.combine(e + timedelta(days=1), time.min),
            )
            .one()
        )
        return float(row[0]), int(row[1]), float(row[2])

    revenue, invoices, profit = totals(start, end)
    prev_revenue, prev_invoices, prev_profit = totals(prev_start, prev_end)

    items_sold = (
        db.query(
            func.coalesce(
                func.sum(SaleItem.quantity_boxes_sold + SaleItem.quantity_strips_sold), 0
            )
        )
        .join(Sale, Sale.id == SaleItem.sale_id)
        .filter(
            Sale.status == "completed",
            Sale.created_at >= datetime.combine(start, time.min),
            Sale.created_at < datetime.combine(end + timedelta(days=1), time.min),
        )
        .scalar()
    )

    today = date.today()
    medicines = db.query(Medicine).filter(Medicine.is_active.is_(True)).all()
    stock = get_stock_map(db, [m.id for m in medicines])
    low_stock = sum(
        1
        for m in medicines
        if stock_status(m, stock.get(m.id, {}).get("boxes", 0), stock.get(m.id, {}).get("strips", 0))
        in {"low", "out"}
    )

    expiring = (
        db.query(func.count(Batch.id))
        .filter(
            Batch.expiry_date >= today,
            Batch.expiry_date <= today + timedelta(days=settings.expiry_warning_days),
            (Batch.quantity_boxes > 0) | (Batch.quantity_strips > 0),
        )
        .scalar()
        or 0
    )
    expired = (
        db.query(func.count(Batch.id))
        .filter(
            Batch.expiry_date < today,
            (Batch.quantity_boxes > 0) | (Batch.quantity_strips > 0),
        )
        .scalar()
        or 0
    )
    inventory_units = sum(
        int(v.get("boxes", 0)) + int(v.get("strips", 0)) for v in stock.values()
    )

    return {
        "range": {"from": start, "to": end},
        "revenue": round(revenue, 2),
        "revenue_change": _percent_change(revenue, prev_revenue),
        "invoices": invoices,
        "invoices_change": _percent_change(invoices, prev_invoices),
        "profit": round(profit, 2),
        "profit_change": _percent_change(profit, prev_profit),
        "average_invoice": round(revenue / invoices, 2) if invoices else 0,
        "items_sold": int(items_sold or 0),
        "low_stock_count": low_stock,
        "expiring_count": int(expiring),
        "expired_count": int(expired),
        "inventory_units": inventory_units,
        "medicines_count": len(medicines),
    }


@router.get("/trend")
def sales_trend(
    days: int = Query(default=14, ge=7, le=90),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    today = date.today()
    start = today - timedelta(days=days - 1)

    rows = (
        db.query(
            func.date(Sale.created_at).label("day"),
            func.coalesce(func.sum(Sale.net_amount), 0),
            func.count(Sale.id),
            func.coalesce(func.sum(Sale.net_amount - Sale.cost_amount), 0),
        )
        .filter(
            Sale.status == "completed",
            Sale.created_at >= datetime.combine(start, time.min),
        )
        .group_by(func.date(Sale.created_at))
        .all()
    )
    by_day = {
        str(row[0]): {
            "revenue": round(float(row[1]), 2),
            "invoices": int(row[2]),
            "profit": round(float(row[3]), 2),
        }
        for row in rows
    }

    trend = []
    for offset in range(days):
        day = start + timedelta(days=offset)
        key = day.isoformat()
        entry = by_day.get(key, {"revenue": 0, "invoices": 0, "profit": 0})
        trend.append({"date": key, **entry})
    return {"items": trend}


@router.get("/top-medicines")
def top_medicines(
    days: int = Query(default=30, ge=1, le=365),
    limit: int = Query(default=6, ge=1, le=20),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    since = datetime.combine(date.today() - timedelta(days=days - 1), time.min)
    rows = (
        db.query(
            SaleItem.medicine_name,
            func.sum(SaleItem.quantity_boxes_sold + SaleItem.quantity_strips_sold),
            func.sum(SaleItem.subtotal),
        )
        .join(Sale, Sale.id == SaleItem.sale_id)
        .filter(Sale.status == "completed", Sale.created_at >= since)
        .group_by(SaleItem.medicine_name)
        .order_by(func.sum(SaleItem.subtotal).desc())
        .limit(limit)
        .all()
    )
    return {
        "items": [
            {
                "name": row[0] or "غير معروف",
                "quantity": int(row[1] or 0),
                "revenue": round(float(row[2] or 0), 2),
            }
            for row in rows
        ]
    }


@router.get("/payment-methods")
def payment_methods(
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    since = datetime.combine(date.today() - timedelta(days=days - 1), time.min)
    rows = (
        db.query(
            Sale.payment_method,
            func.count(Sale.id),
            func.coalesce(func.sum(Sale.net_amount), 0),
        )
        .filter(Sale.status == "completed", Sale.created_at >= since)
        .group_by(Sale.payment_method)
        .all()
    )
    return {
        "items": [
            {
                "method": row[0] or "غير محدد",
                "count": int(row[1]),
                "amount": round(float(row[2]), 2),
            }
            for row in rows
        ]
    }


@router.get("/recent-sales")
def recent_sales(
    limit: int = Query(default=8, ge=1, le=50),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    sales = (
        db.query(Sale)
        .options(selectinload(Sale.items).selectinload(SaleItem.batch))
        .order_by(Sale.created_at.desc())
        .limit(limit)
        .all()
    )
    return {
        "items": [
            {
                "id": sale.id,
                "invoice_number": sale.invoice_number,
                "net_amount": float(sale.net_amount),
                "payment_method": sale.payment_method,
                "created_at": sale.created_at,
                "status": sale.status,
                "items_count": len(sale.items),
                "customer_name": sale.customer_name,
                "first_item": sale.items[0].medicine_name if sale.items else None,
            }
            for sale in sales
        ]
    }


@router.get("/alerts")
def alerts(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    today = date.today()
    medicines = db.query(Medicine).filter(Medicine.is_active.is_(True)).all()
    stock = get_stock_map(db, [m.id for m in medicines])

    low = []
    for med in medicines:
        info = stock.get(med.id, {})
        status = stock_status(med, info.get("boxes", 0), info.get("strips", 0))
        if status in {"low", "out"}:
            low.append(
                {
                    "id": med.id,
                    "name": med.trade_name,
                    "boxes": info.get("boxes", 0),
                    "strips": info.get("strips", 0),
                    "min_stock_level": med.min_stock_level,
                    "status": status,
                }
            )
    low.sort(key=lambda item: item["boxes"] + item["strips"])
    low = low[:10]

    expiring_batches = (
        db.query(Batch, Medicine)
        .join(Medicine, Medicine.id == Batch.medicine_id)
        .filter(
            Batch.expiry_date >= today,
            Batch.expiry_date <= today + timedelta(days=settings.expiry_warning_days),
            (Batch.quantity_boxes > 0) | (Batch.quantity_strips > 0),
        )
        .order_by(Batch.expiry_date.asc())
        .limit(10)
        .all()
    )
    expired_batches = (
        db.query(Batch, Medicine)
        .join(Medicine, Medicine.id == Batch.medicine_id)
        .filter(
            Batch.expiry_date < today,
            (Batch.quantity_boxes > 0) | (Batch.quantity_strips > 0),
        )
        .order_by(Batch.expiry_date.asc())
        .limit(10)
        .all()
    )

    def batch_payload(batch: Batch, med: Medicine):
        return {
            "batch_id": batch.id,
            "medicine_id": med.id,
            "name": med.trade_name,
            "batch_number": batch.batch_number,
            "expiry_date": batch.expiry_date,
            "days_left": (batch.expiry_date - today).days,
            "quantity_boxes": batch.quantity_boxes,
            "quantity_strips": batch.quantity_strips,
        }

    return {
        "low_stock": low,
        "expiring": [batch_payload(b, m) for b, m in expiring_batches],
        "expired": [batch_payload(b, m) for b, m in expired_batches],
    }


@router.get("/activity")
def activity(
    days: int = Query(default=7, ge=1, le=30),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    since = datetime.combine(date.today() - timedelta(days=days - 1), time.min)
    sales = (
        db.query(Sale)
        .options(selectinload(Sale.items))
        .filter(Sale.created_at >= since)
        .order_by(Sale.created_at.desc())
        .limit(12)
        .all()
    )
    return {
        "items": [
            {
                "id": sale.id,
                "invoice_number": sale.invoice_number,
                "amount": float(sale.net_amount),
                "created_at": sale.created_at,
                "items_count": len(sale.items),
                "payment_method": sale.payment_method,
                "status": sale.status,
            }
            for sale in sales
        ]
    }
