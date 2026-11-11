import random
from datetime import date, datetime, time, timedelta
from math import ceil

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import get_current_user, require_roles
from ..models import Batch, Medicine, Sale, SaleItem, User
from ..schemas import (
    CheckoutResult,
    InvoiceCreate,
    SaleItemOut,
    SaleOut,
)
from ..services.inventory import allocate_fefo, restock_batch

router = APIRouter(prefix="/sales", tags=["sales"])


def _invoice_number(prefix: str = "INV") -> str:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return f"{prefix}-{stamp}-{random.randint(100, 999)}"


def _sale_to_out(sale: Sale, with_items: bool = True) -> SaleOut:
    items = []
    if with_items:
        for item in sale.items:
            items.append(
                SaleItemOut(
                    id=item.id,
                    batch_id=item.batch_id,
                    medicine_name=item.medicine_name,
                    unit_type=item.unit_type,
                    quantity_boxes_sold=item.quantity_boxes_sold or 0,
                    quantity_strips_sold=item.quantity_strips_sold or 0,
                    unit_price=float(item.unit_price),
                    cost_price=float(item.cost_price or 0),
                    subtotal=float(item.subtotal),
                    batch_number=item.batch.batch_number if item.batch else None,
                )
            )
    return SaleOut(
        id=sale.id,
        invoice_number=sale.invoice_number,
        total_amount=float(sale.total_amount),
        discount=float(sale.discount or 0),
        tax_amount=float(sale.tax_amount or 0),
        net_amount=float(sale.net_amount),
        paid_amount=float(sale.paid_amount or 0),
        cost_amount=float(sale.cost_amount or 0),
        payment_method=sale.payment_method,
        pharmacist_id=sale.pharmacist_id,
        customer_name=sale.customer_name,
        status=sale.status,
        notes=sale.notes,
        created_at=sale.created_at,
        refunded_at=sale.refunded_at,
        items_count=len(sale.items),
        items=items,
    )


@router.post("/checkout", response_model=CheckoutResult, status_code=status.HTTP_201_CREATED)
def create_sale(
    invoice: InvoiceCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not invoice.items:
        raise HTTPException(status_code=400, detail="الفاتورة لا تحتوي على أي أصناف")

    # دمج الأصناف المتكررة بنفس الوحدة
    merged: dict[tuple[int, str], int] = {}
    for item in invoice.items:
        key = (item.medicine_id, item.unit_type)
        merged[key] = merged.get(key, 0) + item.quantity

    try:
        sale_items: list[SaleItem] = []
        subtotal = 0.0
        cost_total = 0.0

        for (medicine_id, unit_type), quantity in merged.items():
            medicine = db.get(Medicine, medicine_id)
            if medicine is None or not medicine.is_active:
                raise HTTPException(
                    status_code=400, detail=f"الصنف رقم {medicine_id} غير موجود أو غير مفعّل"
                )

            allocations = allocate_fefo(db, medicine, unit_type, quantity, lock=True)
            for allocation in allocations:
                batch: Batch = allocation["batch"]
                take = allocation["quantity"]
                if unit_type == "box":
                    batch.quantity_boxes -= take
                else:
                    batch.quantity_strips -= take

                subtotal += allocation["subtotal"]
                cost_total += allocation["cost_total"]
                sale_items.append(
                    SaleItem(
                        batch_id=batch.id,
                        medicine_name=medicine.trade_name,
                        unit_type=unit_type,
                        quantity_boxes_sold=take if unit_type == "box" else 0,
                        quantity_strips_sold=take if unit_type == "strip" else 0,
                        unit_price=allocation["unit_price"],
                        cost_price=allocation["unit_cost"],
                        subtotal=allocation["subtotal"],
                    )
                )

        discount = round(float(invoice.discount or 0), 2)
        if discount > subtotal:
            raise HTTPException(
                status_code=400, detail="الخصم لا يمكن أن يتجاوز إجمالي الفاتورة"
            )

        net_amount = round(subtotal - discount, 2)
        paid_amount = round(float(invoice.paid_amount or 0), 2)
        if invoice.payment_method == "آجل" and not (
            invoice.customer_name or invoice.customer_id
        ):
            raise HTTPException(
                status_code=400,
                detail="البيع الآجل يتطلب تحديد اسم العميل",
            )
        if invoice.payment_method != "آجل":
            if paid_amount == 0:
                paid_amount = net_amount
            elif paid_amount < net_amount:
                raise HTTPException(
                    status_code=400, detail="المبلغ المدفوع أقل من صافي الفاتورة"
                )
        change = round(max(0.0, paid_amount - net_amount), 2)

        sale = Sale(
            invoice_number=_invoice_number(),
            total_amount=round(subtotal, 2),
            discount=discount,
            tax_amount=0,
            net_amount=net_amount,
            paid_amount=paid_amount,
            cost_amount=round(cost_total, 2),
            payment_method=invoice.payment_method,
            pharmacist_id=user.id,
            customer_id=invoice.customer_id,
            customer_name=(invoice.customer_name or "").strip() or None,
            notes=invoice.notes,
            status="completed",
            created_at=datetime.now(),
        )
        db.add(sale)
        db.flush()

        for item in sale_items:
            item.sale_id = sale.id
            db.add(item)

        db.commit()
        db.refresh(sale)
        result = _sale_to_out(sale)
        return CheckoutResult(
            **result.model_dump(),
            change=change,
            profit=round(net_amount - cost_total, 2),
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:  # pragma: no cover
        db.rollback()
        raise HTTPException(status_code=500, detail=f"تعذر إتمام عملية البيع: {exc}")


@router.get("")
def list_sales(
    q: str | None = None,
    from_date: date | None = Query(default=None, alias="from"),
    to_date: date | None = Query(default=None, alias="to"),
    payment_method: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(Sale)
    if q:
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(Sale.invoice_number.like(term), Sale.customer_name.like(term))
        )
    if from_date:
        query = query.filter(Sale.created_at >= datetime.combine(from_date, time.min))
    if to_date:
        query = query.filter(
            Sale.created_at < datetime.combine(to_date + timedelta(days=1), time.min)
        )
    if payment_method:
        query = query.filter(Sale.payment_method == payment_method)
    if status_filter:
        query = query.filter(Sale.status == status_filter)

    total = query.count()
    sales = (
        query.options(selectinload(Sale.items).selectinload(SaleItem.batch))
        .order_by(Sale.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": [_sale_to_out(sale) for sale in sales],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, ceil(total / page_size)),
    }


@router.get("/{sale_id}", response_model=SaleOut)
def get_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    sale = (
        db.query(Sale)
        .options(selectinload(Sale.items).selectinload(SaleItem.batch))
        .filter(Sale.id == sale_id)
        .first()
    )
    if not sale:
        raise HTTPException(status_code=404, detail="الفاتورة غير موجودة")
    return _sale_to_out(sale)


@router.post("/{sale_id}/refund", response_model=SaleOut)
def refund_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "pharmacist")),
):
    sale = (
        db.query(Sale)
        .options(selectinload(Sale.items))
        .filter(Sale.id == sale_id)
        .first()
    )
    if not sale:
        raise HTTPException(status_code=404, detail="الفاتورة غير موجودة")
    if sale.status == "refunded":
        raise HTTPException(status_code=400, detail="تم إرجاع هذه الفاتورة بالفعل")

    for item in sale.items:
        restock_batch(
            db,
            item.batch_id,
            item.quantity_boxes_sold or 0,
            item.quantity_strips_sold or 0,
        )

    sale.status = "refunded"
    sale.refunded_at = datetime.now()
    db.commit()
    db.refresh(sale)
    return _sale_to_out(sale)
