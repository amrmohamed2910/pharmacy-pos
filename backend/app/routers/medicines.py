from datetime import date, timedelta
from math import ceil

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..deps import get_current_user, require_roles
from ..models import Batch, Medicine, SaleItem, User
from ..schemas import (
    BatchCreate,
    BatchOut,
    MedicineCreate,
    MedicineDetail,
    MedicineListItem,
    MedicineSearchItem,
    MedicineUpdate,
)
from ..services.inventory import get_stock_map, sold_quantities, stock_status

router = APIRouter(prefix="/medicines", tags=["medicines"])


def _clean_barcode(barcode: str | None) -> str | None:
    value = (barcode or "").strip()
    return value or None


def _assert_barcode_free(db: Session, barcode: str | None, exclude_id: int | None = None) -> None:
    barcode = _clean_barcode(barcode)
    if not barcode:
        return
    query = db.query(Medicine).filter(Medicine.barcode == barcode)
    if exclude_id:
        query = query.filter(Medicine.id != exclude_id)
    if query.first():
        raise HTTPException(status_code=400, detail="هذا الباركود مستخدم بالفعل لصنف آخر")


def _to_list_item(db: Session, med: Medicine, stock: dict | None = None, sold: dict | None = None):
    stock = stock or get_stock_map(db, [med.id]).get(med.id, {})
    sold = sold or sold_quantities(db, [med.id])
    boxes = int(stock.get("boxes", 0))
    strips = int(stock.get("strips", 0))
    return MedicineListItem(
        **{
            "id": med.id,
            "trade_name": med.trade_name,
            "scientific_name": med.scientific_name,
            "barcode": med.barcode,
            "category": med.category,
            "unit_type": med.unit_type,
            "strips_per_box": med.strips_per_box,
            "requires_prescription": med.requires_prescription,
            "min_stock_level": med.min_stock_level,
            "tax_rate": float(med.tax_rate or 0),
            "is_active": med.is_active,
            "created_at": med.created_at,
            "total_boxes": boxes,
            "total_strips": strips,
            "sell_price": stock.get("sell_price", 0),
            "cost_price": stock.get("cost_price", 0),
            "nearest_expiry": stock.get("nearest_expiry"),
            "stock_status": stock_status(med, boxes, strips),
            "sold_30d": sold.get(med.id, 0),
        }
    )


@router.get("")
def list_medicines(
    q: str | None = None,
    category: str | None = None,
    stock_filter: str | None = Query(default=None, alias="status"),
    active_only: bool = True,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    sort: str = Query(default="name"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(Medicine)
    if active_only:
        query = query.filter(Medicine.is_active.is_(True))
    if q:
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Medicine.trade_name.like(term),
                Medicine.scientific_name.like(term),
                Medicine.barcode.like(term),
                Medicine.category.like(term),
            )
        )
    if category:
        query = query.filter(Medicine.category == category)

    medicines = query.order_by(Medicine.trade_name.asc()).all()
    stock = get_stock_map(db, [m.id for m in medicines])
    sold = sold_quantities(db, [m.id for m in medicines])

    items = [_to_list_item(db, med, stock.get(med.id), sold) for med in medicines]

    if stock_filter in {"out", "low", "ok"}:
        items = [item for item in items if item.stock_status == stock_filter]
    if stock_filter == "expiring":
        today = date.today()
        expiring_ids = {
            row[0]
            for row in db.query(Batch.medicine_id)
            .filter(
                Batch.expiry_date >= today,
                Batch.expiry_date <= today + timedelta(days=settings.expiry_warning_days),
                (Batch.quantity_boxes > 0) | (Batch.quantity_strips > 0),
            )
            .all()
        }
        items = [item for item in items if item.id in expiring_ids]

    if sort == "stock":
        items.sort(key=lambda i: i.total_boxes + i.total_strips)
    elif sort == "stock_desc":
        items.sort(key=lambda i: i.total_boxes + i.total_strips, reverse=True)
    elif sort == "sold":
        items.sort(key=lambda i: i.sold_30d, reverse=True)

    total = len(items)
    start = (page - 1) * page_size
    return {
        "items": items[start : start + page_size],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, ceil(total / page_size)),
    }


@router.get("/categories", response_model=list[str])
def list_categories(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = (
        db.query(Medicine.category)
        .filter(Medicine.category.isnot(None), Medicine.category != "")
        .distinct()
        .order_by(Medicine.category.asc())
        .all()
    )
    return [row[0] for row in rows]


@router.get("/search", response_model=list[MedicineSearchItem])
def search_medicines(
    q: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    term = (q or "").strip()
    if not term:
        return []

    medicines = (
        db.query(Medicine)
        .filter(
            Medicine.is_active.is_(True),
            or_(
                Medicine.barcode == term,
                Medicine.trade_name.like(f"%{term}%"),
                Medicine.scientific_name.like(f"%{term}%"),
            ),
        )
        .limit(15)
        .all()
    )
    exact = [m for m in medicines if m.barcode == term]
    others = [m for m in medicines if m.barcode != term]
    ordered = exact + others

    stock = get_stock_map(db, [m.id for m in ordered])
    results: list[MedicineSearchItem] = []
    for med in ordered:
        info = stock.get(med.id, {})
        boxes = int(info.get("boxes", 0))
        strips = int(info.get("strips", 0))
        spb = med.strips_per_box or 1
        box_price = float(info.get("sell_price", 0))
        results.append(
            MedicineSearchItem(
                id=med.id,
                trade_name=med.trade_name,
                scientific_name=med.scientific_name,
                barcode=med.barcode,
                category=med.category,
                requires_prescription=bool(med.requires_prescription),
                strips_per_box=spb,
                box_price=box_price,
                strip_price=round(box_price / spb, 2),
                cost_price=float(info.get("cost_price", 0)),
                available_boxes=boxes,
                available_strips=strips,
                has_stock=(boxes + strips) > 0,
            )
        )
    return results


@router.get("/{medicine_id}", response_model=MedicineDetail)
def get_medicine(
    medicine_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    med = db.get(Medicine, medicine_id)
    if not med:
        raise HTTPException(status_code=404, detail="الصنف غير موجود")
    batches = (
        db.query(Batch)
        .filter(Batch.medicine_id == medicine_id)
        .order_by(Batch.expiry_date.asc())
        .all()
    )
    return MedicineDetail(
        **{
            "id": med.id,
            "trade_name": med.trade_name,
            "scientific_name": med.scientific_name,
            "barcode": med.barcode,
            "category": med.category,
            "unit_type": med.unit_type,
            "strips_per_box": med.strips_per_box,
            "requires_prescription": med.requires_prescription,
            "min_stock_level": med.min_stock_level,
            "tax_rate": float(med.tax_rate or 0),
            "is_active": med.is_active,
            "created_at": med.created_at,
            "batches": [BatchOut.model_validate(b) for b in batches],
        }
    )


@router.post("", response_model=MedicineDetail, status_code=status.HTTP_201_CREATED)
def create_medicine(
    payload: MedicineCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "pharmacist")),
):
    _assert_barcode_free(db, payload.barcode)
    med = Medicine(**payload.model_dump())
    med.barcode = _clean_barcode(payload.barcode)
    db.add(med)
    db.commit()
    db.refresh(med)
    return get_medicine(med.id, db, _)


@router.put("/{medicine_id}", response_model=MedicineDetail)
def update_medicine(
    medicine_id: int,
    payload: MedicineUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "pharmacist")),
):
    med = db.get(Medicine, medicine_id)
    if not med:
        raise HTTPException(status_code=404, detail="الصنف غير موجود")

    data = payload.model_dump(exclude_unset=True)
    if "barcode" in data:
        _assert_barcode_free(db, data["barcode"], exclude_id=medicine_id)
        data["barcode"] = _clean_barcode(data["barcode"])
    for key, value in data.items():
        setattr(med, key, value)
    db.commit()
    db.refresh(med)
    return get_medicine(med.id, db, _)


@router.delete("/{medicine_id}")
def delete_medicine(
    medicine_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    med = db.get(Medicine, medicine_id)
    if not med:
        raise HTTPException(status_code=404, detail="الصنف غير موجود")

    has_sales = (
        db.query(SaleItem.id)
        .join(Batch, Batch.id == SaleItem.batch_id)
        .filter(Batch.medicine_id == medicine_id)
        .first()
    )
    if has_sales:
        med.is_active = False
        db.commit()
        return {"message": "تم أرشفة الصنف لوجود فواتير مرتبطة به"}

    db.delete(med)
    db.commit()
    return {"message": "تم حذف الصنف نهائيًا"}


@router.post("/{medicine_id}/batches", response_model=BatchOut, status_code=status.HTTP_201_CREATED)
def add_batch(
    medicine_id: int,
    payload: BatchCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "pharmacist")),
):
    med = db.get(Medicine, medicine_id)
    if not med:
        raise HTTPException(status_code=404, detail="الصنف غير موجود")
    if payload.expiry_date < date.today():
        raise HTTPException(status_code=400, detail="لا يمكن إضافة تشغيلة منتهية الصلاحية")

    duplicate = (
        db.query(Batch)
        .filter(Batch.medicine_id == medicine_id, Batch.batch_number == payload.batch_number)
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=400, detail="رقم التشغيلة مستخدم بالفعل لهذا الصنف")

    batch = Batch(medicine_id=medicine_id, **payload.model_dump())
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch
