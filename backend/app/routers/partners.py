from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_roles
from ..models import Customer, Purchase, Sale, Supplier, User
from ..schemas import (
    CustomerCreate,
    CustomerOut,
    SupplierCreate,
    SupplierOut,
    SupplierUpdate,
)

router = APIRouter(tags=["partners"])


# ---------------- الموردون ----------------
@router.get("/suppliers")
def list_suppliers(
    q: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(Supplier)
    if q:
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(Supplier.name.like(term), Supplier.phone.like(term), Supplier.address.like(term))
        )
    suppliers = query.order_by(Supplier.name.asc()).all()

    stats = {
        row[0]: (int(row[1]), float(row[2] or 0))
        for row in db.query(
            Purchase.supplier_id,
            func.count(Purchase.id),
            func.coalesce(func.sum(Purchase.total_amount), 0),
        )
        .group_by(Purchase.supplier_id)
        .all()
    }

    items = []
    for supplier in suppliers:
        count, total = stats.get(supplier.id, (0, 0.0))
        items.append(
            SupplierOut(
                id=supplier.id,
                name=supplier.name,
                phone=supplier.phone,
                email=supplier.email,
                address=supplier.address,
                notes=supplier.notes,
                is_active=supplier.is_active,
                created_at=supplier.created_at,
                purchases_count=count,
                total_purchases=round(total, 2),
            )
        )
    return {"items": items, "total": len(items)}


@router.post("/suppliers", response_model=SupplierOut, status_code=status.HTTP_201_CREATED)
def create_supplier(
    payload: SupplierCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "pharmacist")),
):
    supplier = Supplier(**payload.model_dump())
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return SupplierOut.model_validate(supplier)


@router.put("/suppliers/{supplier_id}", response_model=SupplierOut)
def update_supplier(
    supplier_id: int,
    payload: SupplierUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "pharmacist")),
):
    supplier = db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="المورد غير موجود")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(supplier, key, value)
    db.commit()
    db.refresh(supplier)
    return SupplierOut.model_validate(supplier)


@router.delete("/suppliers/{supplier_id}")
def delete_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    supplier = db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="المورد غير موجود")
    if db.query(Purchase.id).filter(Purchase.supplier_id == supplier_id).first():
        supplier.is_active = False
        db.commit()
        return {"message": "تم أرشفة المورد لوجود فواتير شراء مرتبطة به"}
    db.delete(supplier)
    db.commit()
    return {"message": "تم حذف المورد"}


# ---------------- العملاء ----------------
@router.get("/customers")
def list_customers(
    q: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(Customer)
    if q:
        term = f"%{q.strip()}%"
        query = query.filter(or_(Customer.name.like(term), Customer.phone.like(term)))
    customers = query.order_by(Customer.name.asc()).all()

    stats = {
        row[0]: (int(row[1]), float(row[2] or 0))
        for row in db.query(
            Sale.customer_id, func.count(Sale.id), func.coalesce(func.sum(Sale.net_amount), 0)
        )
        .filter(Sale.status == "completed", Sale.customer_id.isnot(None))
        .group_by(Sale.customer_id)
        .all()
    }

    items = []
    for customer in customers:
        count, total = stats.get(customer.id, (0, 0.0))
        items.append(
            CustomerOut(
                id=customer.id,
                name=customer.name,
                phone=customer.phone,
                address=customer.address,
                notes=customer.notes,
                created_at=customer.created_at,
                invoices_count=count,
                total_spent=round(total, 2),
            )
        )
    return {"items": items, "total": len(items)}


@router.post("/customers", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
def create_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    customer = Customer(**payload.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return CustomerOut.model_validate(customer)


@router.get("/customers/search", response_model=list[CustomerOut])
def search_customers(
    q: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    term = f"%{(q or '').strip()}%"
    customers = (
        db.query(Customer)
        .filter(or_(Customer.name.like(term), Customer.phone.like(term)))
        .limit(10)
        .all()
    )
    return [CustomerOut.model_validate(c) for c in customers]


@router.put("/customers/{customer_id}", response_model=CustomerOut)
def update_customer(
    customer_id: int,
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="العميل غير موجود")
    for key, value in payload.model_dump().items():
        setattr(customer, key, value)
    db.commit()
    db.refresh(customer)
    return CustomerOut.model_validate(customer)
