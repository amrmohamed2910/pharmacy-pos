import random
from datetime import date, datetime, time, timedelta
from math import ceil

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import get_current_user, require_roles
from ..models import Batch, Medicine, Purchase, PurchaseItem, Supplier, User
from ..schemas import PurchaseCreate, PurchaseItemOut, PurchaseOut

router = APIRouter(prefix="/purchases", tags=["purchases"])


def _purchase_number() -> str:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return f"PUR-{stamp}-{random.randint(100, 999)}"


def _to_out(purchase: Purchase) -> PurchaseOut:
    return PurchaseOut(
        id=purchase.id,
        invoice_number=purchase.invoice_number,
        supplier_id=purchase.supplier_id,
        supplier_name=purchase.supplier_name,
        total_amount=float(purchase.total_amount or 0),
        paid_amount=float(purchase.paid_amount or 0),
        payment_method=purchase.payment_method,
        status=purchase.status,
        notes=purchase.notes,
        created_at=purchase.created_at,
        items_count=len(purchase.items),
        items=[
            PurchaseItemOut(
                id=item.id,
                medicine_id=item.medicine_id,
                medicine_name=item.medicine_name,
                batch_number=item.batch_number,
                expiry_date=item.expiry_date,
                buy_price=float(item.buy_price),
                sell_price=float(item.sell_price),
                quantity_boxes=item.quantity_boxes or 0,
                quantity_strips=item.quantity_strips or 0,
                subtotal=float(item.subtotal or 0),
            )
            for item in purchase.items
        ],
    )


@router.get("")
def list_purchases(
    q: str | None = None,
    supplier_id: int | None = None,
    from_date: date | None = Query(default=None, alias="from"),
    to_date: date | None = Query(default=None, alias="to"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(Purchase)
    if q:
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(Purchase.invoice_number.like(term), Purchase.supplier_name.like(term))
        )
    if supplier_id:
        query = query.filter(Purchase.supplier_id == supplier_id)
    if from_date:
        query = query.filter(Purchase.created_at >= datetime.combine(from_date, time.min))
    if to_date:
        query = query.filter(
            Purchase.created_at < datetime.combine(to_date + timedelta(days=1), time.min)
        )

    total = query.count()
    purchases = (
        query.options(selectinload(Purchase.items))
        .order_by(Purchase.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "items": [_to_out(p) for p in purchases],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, ceil(total / page_size)),
    }


@router.get("/{purchase_id}", response_model=PurchaseOut)
def get_purchase(
    purchase_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    purchase = (
        db.query(Purchase)
        .options(selectinload(Purchase.items))
        .filter(Purchase.id == purchase_id)
        .first()
    )
    if not purchase:
        raise HTTPException(status_code=404, detail="فاتورة الشراء غير موجودة")
    return _to_out(purchase)


@router.post("", response_model=PurchaseOut, status_code=status.HTTP_201_CREATED)
def create_purchase(
    payload: PurchaseCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "pharmacist")),
):
    if not payload.items:
        raise HTTPException(status_code=400, detail="أمر الشراء لا يحتوي على أصناف")

    supplier = db.get(Supplier, payload.supplier_id) if payload.supplier_id else None
    supplier_name = supplier.name if supplier else (payload.supplier_name or "مورد نقدي")

    total = 0.0
    items: list[PurchaseItem] = []

    for line in payload.items:
        medicine = db.get(Medicine, line.medicine_id)
        if not medicine:
            raise HTTPException(
                status_code=400, detail=f"الصنف رقم {line.medicine_id} غير موجود"
            )
        if line.quantity_boxes <= 0 and line.quantity_strips <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"يجب إدخال كمية للصنف «{medicine.trade_name}»",
            )
        if line.expiry_date < date.today():
            raise HTTPException(
                status_code=400,
                detail=f"تاريخ انتهاء التشغيلة للصنف «{medicine.trade_name}» غير صالح",
            )

        subtotal = round(
            line.quantity_boxes * line.buy_price
            + line.quantity_strips * line.buy_price / (medicine.strips_per_box or 1),
            2,
        )
        total += subtotal

        existing = (
            db.query(Batch)
            .filter(
                Batch.medicine_id == medicine.id,
                Batch.batch_number == line.batch_number,
            )
            .first()
        )
        if existing:
            existing.quantity_boxes = (existing.quantity_boxes or 0) + line.quantity_boxes
            existing.quantity_strips = (existing.quantity_strips or 0) + line.quantity_strips
            existing.buy_price = line.buy_price
            existing.sell_price = line.sell_price
            existing.expiry_date = line.expiry_date
        else:
            db.add(
                Batch(
                    medicine_id=medicine.id,
                    batch_number=line.batch_number,
                    expiry_date=line.expiry_date,
                    buy_price=line.buy_price,
                    sell_price=line.sell_price,
                    quantity_boxes=line.quantity_boxes,
                    quantity_strips=line.quantity_strips,
                )
            )

        items.append(
            PurchaseItem(
                medicine_id=medicine.id,
                medicine_name=medicine.trade_name,
                batch_number=line.batch_number,
                expiry_date=line.expiry_date,
                buy_price=line.buy_price,
                sell_price=line.sell_price,
                quantity_boxes=line.quantity_boxes,
                quantity_strips=line.quantity_strips,
                subtotal=subtotal,
            )
        )

    purchase = Purchase(
        invoice_number=payload.invoice_number or _purchase_number(),
        supplier_id=supplier.id if supplier else None,
        supplier_name=supplier_name,
        total_amount=round(total, 2),
        paid_amount=round(payload.paid_amount or 0, 2),
        payment_method=payload.payment_method,
        status="received",
        notes=payload.notes,
        user_id=user.id,
        created_at=datetime.now(),
    )
    db.add(purchase)
    db.flush()
    for item in items:
        item.purchase_id = purchase.id
        db.add(item)

    db.commit()
    db.refresh(purchase)
    return _to_out(purchase)
