from datetime import date, timedelta
from math import ceil

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..deps import get_current_user, require_roles
from ..models import Batch, Medicine, SaleItem, User
from ..schemas import BatchOut, BatchUpdate

router = APIRouter(prefix="/batches", tags=["batches"])


@router.get("")
def list_batches(
    q: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    today = date.today()
    query = db.query(Batch, Medicine).join(Medicine, Medicine.id == Batch.medicine_id)

    if q:
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Medicine.trade_name.like(term),
                Medicine.scientific_name.like(term),
                Medicine.barcode.like(term),
                Batch.batch_number.like(term),
            )
        )
    if status_filter == "expired":
        query = query.filter(Batch.expiry_date < today)
    elif status_filter == "expiring":
        query = query.filter(
            Batch.expiry_date >= today,
            Batch.expiry_date <= today + timedelta(days=settings.expiry_warning_days),
        )
    elif status_filter == "available":
        query = query.filter(
            Batch.expiry_date >= today,
            (Batch.quantity_boxes > 0) | (Batch.quantity_strips > 0),
        )

    total = query.count()
    rows = (
        query.order_by(Batch.expiry_date.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = []
    for batch, med in rows:
        days_left = (batch.expiry_date - today).days
        items.append(
            {
                "id": batch.id,
                "medicine_id": med.id,
                "medicine_name": med.trade_name,
                "scientific_name": med.scientific_name,
                "batch_number": batch.batch_number,
                "expiry_date": batch.expiry_date,
                "days_left": days_left,
                "buy_price": float(batch.buy_price),
                "sell_price": float(batch.sell_price),
                "quantity_boxes": batch.quantity_boxes or 0,
                "quantity_strips": batch.quantity_strips or 0,
                "stock_value": round(
                    (batch.quantity_boxes or 0) * float(batch.buy_price)
                    + (batch.quantity_strips or 0)
                    * float(batch.buy_price)
                    / (med.strips_per_box or 1),
                    2,
                ),
                "state": "expired"
                if days_left < 0
                else ("expiring" if days_left <= settings.expiry_warning_days else "ok"),
            }
        )

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, ceil(total / page_size)),
    }


@router.put("/{batch_id}", response_model=BatchOut)
def update_batch(
    batch_id: int,
    payload: BatchUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "pharmacist")),
):
    batch = db.get(Batch, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="التشغيلة غير موجودة")
    data = payload.model_dump(exclude_unset=True)
    if "expiry_date" in data and data["expiry_date"] < date.today():
        raise HTTPException(status_code=400, detail="تاريخ الانتهاء يجب أن يكون في المستقبل")
    for key, value in data.items():
        setattr(batch, key, value)
    db.commit()
    db.refresh(batch)
    return batch


@router.delete("/{batch_id}")
def delete_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "pharmacist")),
):
    batch = db.get(Batch, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="التشغيلة غير موجودة")
    if db.query(SaleItem.id).filter(SaleItem.batch_id == batch_id).first():
        raise HTTPException(
            status_code=400,
            detail="لا يمكن حذف تشغيلة تم البيع منها. يمكنك تصفير الكميات بدلًا من ذلك.",
        )
    db.delete(batch)
    db.commit()
    return {"message": "تم حذف التشغيلة"}
