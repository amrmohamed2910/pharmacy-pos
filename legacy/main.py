from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from database import get_db, Batch, Medicine, Sale, SaleItem

app = FastAPI(title="Pharmacy Management System - Enterprise", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Schemas ---
class SaleItemRequest(BaseModel):
    medicine_id: int
    unit_type: str = "box"  # "box" أو "strip"
    quantity: int = 1

class InvoiceCreate(BaseModel):
    pharmacist_id: int = 1
    payment_method: str = "كاش"
    discount: float = 0.0
    paid_amount: float = 0.0
    items: List[SaleItemRequest]

# --- Endpoints ---

# 1. API للبحث عن الأدوية بالاسم أو الباركود
@app.get("/api/medicines/search")
def search_medicines(q: str, db: Session = Depends(get_db)):
    if not q:
        return []
    
    medicines = db.query(Medicine).filter(
        or_(
            Medicine.trade_name.like(f"%{q}%"),
            Medicine.scientific_name.like(f"%{q}%"),
            Medicine.barcode == q
        )
    ).limit(10).all()

    result = []
    for med in medicines:
        # البحث عن أحدث تشغيلة سارية لحساب الأسعار والمخزون المتاح
        batch = db.query(Batch).filter(
            Batch.medicine_id == med.id,
            Batch.expiry_date > datetime.utcnow(),
            (Batch.quantity_boxes > 0) | (Batch.quantity_strips > 0)
        ).order_by(Batch.expiry_date.asc()).first()

        sell_price_box = float(batch.sell_price) if batch else 0.0
        strips_per_box = med.strips_per_box if med.strips_per_box > 0 else 1
        sell_price_strip = round(sell_price_box / strips_per_box, 2)

        result.append({
            "id": med.id,
            "trade_name": med.trade_name,
            "scientific_name": med.scientific_name,
            "barcode": med.barcode,
            "strips_per_box": med.strips_per_box,
            "box_price": sell_price_box,
            "strip_price": sell_price_strip,
            "available_boxes": batch.quantity_boxes if batch else 0,
            "available_strips": batch.quantity_strips if batch else 0,
            "has_stock": batch is not None
        })
    return result

# 2. API إتمام البيع بنظام FEFO وحساب الخصم والباقي
@app.post("/api/sales/checkout", status_code=status.HTTP_201_CREATED)
def create_sale(invoice: InvoiceCreate, db: Session = Depends(get_db)):
    try:
        subtotal_amount = 0.0
        processed_items = []

        for item in invoice.items:
            # تطبيق FEFO
            batch = db.query(Batch).filter(
                Batch.medicine_id == item.medicine_id,
                Batch.expiry_date > datetime.utcnow(),
                (Batch.quantity_boxes > 0) | (Batch.quantity_strips > 0)
            ).order_by(Batch.expiry_date.asc()).first()

            if not batch:
                med = db.query(Medicine).get(item.medicine_id)
                name = med.trade_name if med else f"ID {item.medicine_id}"
                raise HTTPException(status_code=400, detail=f"عذراً، الصنف ({name}) غير متوفر بالمخزون أو منتهي الصلاحية.")

            medicine = db.query(Medicine).get(item.medicine_id)
            price_per_box = float(batch.sell_price)
            price_per_strip = price_per_box / medicine.strips_per_box if (medicine and medicine.strips_per_box > 0) else price_per_box

            req_boxes = item.quantity if item.unit_type == "box" else 0
            req_strips = item.quantity if item.unit_type == "strip" else 0

            # خصم الكمية من المخزون
            if item.unit_type == "box":
                if batch.quantity_boxes < req_boxes:
                    raise HTTPException(status_code=400, detail=f"الكمية المطلوبة للعلب من ({medicine.trade_name}) غير متوفرة.")
                batch.quantity_boxes -= req_boxes
                item_total = req_boxes * price_per_box
            else:
                if batch.quantity_strips < req_strips:
                    raise HTTPException(status_code=400, detail=f"الكمية المطلوبة بالأشرطة من ({medicine.trade_name}) غير متوفرة.")
                batch.quantity_strips -= req_strips
                item_total = req_strips * price_per_strip

            subtotal_amount += item_total
            processed_items.append({
                "batch_id": batch.id,
                "boxes_sold": req_boxes,
                "strips_sold": req_strips,
                "unit_price": price_per_box if item.unit_type == "box" else price_per_strip,
                "subtotal": item_total
            })

        discount = float(invoice.discount)
        net_amount = max(0.0, subtotal_amount - discount)
        change_amount = max(0.0, float(invoice.paid_amount) - net_amount) if invoice.paid_amount > 0 else 0.0

        invoice_number = f"INV-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        new_sale = Sale(
            invoice_number=invoice_number,
            total_amount=subtotal_amount,
            discount=discount,
            net_amount=net_amount,
            payment_method=invoice.payment_method,
            pharmacist_id=invoice.pharmacist_id
        )
        db.add(new_sale)
        db.flush()

        for p_item in processed_items:
            sale_item = SaleItem(
                sale_id=new_sale.id,
                batch_id=p_item["batch_id"],
                quantity_boxes_sold=p_item["boxes_sold"],
                quantity_strips_sold=p_item["strips_sold"],
                unit_price=p_item["unit_price"],
                subtotal=p_item["subtotal"]
            )
            db.add(sale_item)

        db.commit()

        return {
            "status": "success",
            "message": "تمت عملية البيع بنجاح",
            "invoice_number": invoice_number,
            "subtotal": round(subtotal_amount, 2),
            "discount": round(discount, 2),
            "net_amount": round(net_amount, 2),
            "paid_amount": round(invoice.paid_amount, 2),
            "change": round(change_amount, 2)
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))