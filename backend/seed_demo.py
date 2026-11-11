"""بيانات تجريبية واقعية لعرض النظام (اختياري).

التشغيل:  python seed_demo.py
يضيف البيانات فقط إذا كانت قاعدة البيانات تحتوي على أقل من 5 أصناف.
"""
import random
from datetime import date, datetime, time, timedelta

from app.database import Base, SessionLocal, engine
from app.models import (
    Batch,
    Customer,
    Medicine,
    Purchase,
    PurchaseItem,
    Sale,
    SaleItem,
    Supplier,
    User,
)
from app.security import hash_password
from app.services.seed import ensure_seed

random.seed(7)

CATALOG = [
    # الاسم التجاري، الاسم العلمي، الباركود، التصنيف، عدد الأشرطة، يتطلب روشتة
    ("Panadol Extra", "Paracetamol + Caffeine", "6281072011234", "مسكنات وخوافض حرارة", 2, False),
    ("Augmentin 1g", "Amoxicillin + Clavulanic Acid", "6281009012345", "مضادات حيوية", 2, True),
    ("Concor 5mg", "Bisoprolol", "6281007023456", "أدوية القلب والضغط", 3, True),
    ("Glucophage 850mg", "Metformin", "6281005034567", "أدوية السكر", 3, True),
    ("Nexium 40mg", "Esomeprazole", "6281003045678", "أدوية المعدة", 2, True),
    ("Zyrtec 10mg", "Cetirizine", "6281001056789", "مضادات حساسية", 2, False),
    ("Cataflam 50mg", "Diclofenac Potassium", "6281009067890", "مسكنات ومضادات التهاب", 2, False),
    ("Ventolin Inhaler", "Salbutamol", "6281007078901", "أدوية الجهاز التنفسي", 1, True),
    ("Vitamin D3 50000", "Cholecalciferol", "6281005089012", "فيتامينات ومكملات", 1, False),
    ("Zinc 50mg", "Zinc Gluconate", "6281003090123", "فيتامينات ومكملات", 2, False),
    ("Betadine Solution", "Povidone Iodine", "6281001001234", "مطهرات وجروح", 1, False),
    ("Otrivin Nasal Spray", "Xylometazoline", "6281009012340", "أدوية الأنف", 1, False),
    ("Voltaren Emulgel", "Diclofenac Diethylamine", "6281007023450", "مسكنات موضعية", 1, False),
    ("Flagyl 500mg", "Metronidazole", "6281005034560", "مضادات حيوية", 2, True),
    ("Lasix 40mg", "Furosemide", "6281003045670", "مدرات البول", 2, True),
    ("Cipro 500mg", "Ciprofloxacin", "6281001056780", "مضادات حيوية", 2, True),
    ("Aspirin Protect 100", "Acetylsalicylic Acid", "6281009067899", "أدوية القلب والضغط", 2, False),
    ("Imodium 2mg", "Loperamide", "6281007078900", "أدوية الجهاز الهضمي", 2, False),
    ("Claritin 10mg", "Loratadine", "6281005089019", "مضادات حساسية", 2, False),
    ("Buscopan 10mg", "Hyoscine Butylbromide", "6281003090120", "مغص وتقلصات", 2, False),
]

SUPPLIERS = [
    ("شركة النيل للأدوية", "01001234567", "sales@nilepharma.com", "القاهرة - مدينة نصر"),
    ("ابن سينا فارما", "01112345678", "info@ibnsina.com", "الجيزة - الدقي"),
    ("المتحدون للمستلزمات الطبية", "01223456789", "orders@unitedmed.com", "الإسكندرية - سموحة"),
    ("فارما أوفرسيز", "01534567890", "contact@pharmaoverseas.com", "القاهرة - المعادي"),
]

CUSTOMERS = [
    ("أحمد محمود", "01001112223"),
    ("منى عبد الرحمن", "01112223334"),
    ("شركة الرعاية الطبية", "0223456789"),
    ("خالد سيد", "01223334445"),
    ("سارة إبراهيم", "01534445556"),
]


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        ensure_seed(db)
        if db.query(Medicine).count() >= 5:
            print("قاعدة البيانات تحتوي على بيانات بالفعل — لم تتم إضافة بيانات تجريبية.")
            return

        admin = db.query(User).filter(User.username == "admin").first()
        pharmacist = User(
            name="د. هدى سالم",
            username="huda",
            password_hash=hash_password("huda123"),
            role="pharmacist",
        )
        cashier = User(
            name="محمد كامل",
            username="mohamed",
            password_hash=hash_password("mohamed123"),
            role="cashier",
        )
        db.add_all([pharmacist, cashier])
        db.flush()

        suppliers = [Supplier(name=n, phone=p, email=e, address=a) for n, p, e, a in SUPPLIERS]
        db.add_all(suppliers)
        db.flush()

        customers = [Customer(name=n, phone=p) for n, p in CUSTOMERS]
        db.add_all(customers)
        db.flush()

        today = date.today()
        medicines: list[Medicine] = []
        existing_by_barcode = {
            med.barcode: med for med in db.query(Medicine).all() if med.barcode
        }
        for idx, (trade, sci, barcode, category, spb, rx) in enumerate(CATALOG):
            med = existing_by_barcode.get(barcode)
            if med is None:
                med = Medicine(barcode=barcode)
                db.add(med)
            med.trade_name = trade
            med.scientific_name = sci
            med.category = category
            med.unit_type = "علبة"
            med.strips_per_box = spb
            med.requires_prescription = rx
            med.min_stock_level = random.choice([5, 8, 10, 12])
            med.tax_rate = 0
            med.is_active = True
            medicines.append(med)
        db.flush()

        # تشغيلات بصلاحية متنوعة (طبيعية / قريبة الانتهاء / منتهية)
        batches: list[Batch] = []
        for idx, med in enumerate(medicines):
            box_price = random.choice([18, 22.5, 27, 32.5, 39, 45, 58, 67.5, 82, 96])
            buy_price = round(box_price * random.uniform(0.6, 0.75), 2)
            base_expiry = today + timedelta(days=random.choice([220, 300, 420, 540, 650]))
            batches.append(
                Batch(
                    medicine_id=med.id,
                    batch_number=f"B{today.year}-{idx + 1:03d}",
                    expiry_date=base_expiry,
                    buy_price=buy_price,
                    sell_price=box_price,
                    quantity_boxes=random.randint(14, 60),
                    quantity_strips=random.randint(0, 20),
                )
            )
        # بعض التنبيهات المفيدة للعرض
        for med, days, qty in [
            (medicines[2], 25, 9),
            (medicines[6], 45, 4),
            (medicines[9], 12, 3),
            (medicines[13], 60, 6),
            (medicines[16], 80, 5),
        ]:
            batches.append(
                Batch(
                    medicine_id=med.id,
                    batch_number=f"EXP-{med.id:03d}",
                    expiry_date=today + timedelta(days=days),
                    buy_price=round(random.uniform(15, 40), 2),
                    sell_price=round(random.uniform(25, 65), 2),
                    quantity_boxes=qty,
                    quantity_strips=0,
                )
            )
        # صنف منتهي الصلاحية + صنف نافد
        batches.append(
            Batch(
                medicine_id=medicines[18].id,
                batch_number="OLD-001",
                expiry_date=today - timedelta(days=14),
                buy_price=22,
                sell_price=35,
                quantity_boxes=8,
                quantity_strips=0,
            )
        )
        batches.append(
            Batch(
                medicine_id=medicines[19].id,
                batch_number="OUT-001",
                expiry_date=today + timedelta(days=200),
                buy_price=18,
                sell_price=29,
                quantity_boxes=0,
                quantity_strips=0,
            )
        )
        db.add_all(batches)
        db.flush()

        # فاتورة شراء تجريبية لكل مورد
        for s_index, supplier in enumerate(suppliers):
            items = []
            total = 0.0
            for line in range(3):
                med = medicines[(s_index * 3 + line) % len(medicines)]
                qty = random.randint(10, 30)
                buy = round(random.uniform(15, 55), 2)
                sell = round(buy * 1.45, 2)
                subtotal = round(qty * buy, 2)
                total += subtotal
                items.append(
                    PurchaseItem(
                        medicine_id=med.id,
                        medicine_name=med.trade_name,
                        batch_number=f"PUR-{s_index + 1}-{line + 1}",
                        expiry_date=today + timedelta(days=400),
                        buy_price=buy,
                        sell_price=sell,
                        quantity_boxes=qty,
                        quantity_strips=0,
                        subtotal=subtotal,
                    )
                )
            purchase = Purchase(
                invoice_number=f"PUR-DEMO-{s_index + 1:03d}",
                supplier_id=supplier.id,
                supplier_name=supplier.name,
                total_amount=round(total, 2),
                paid_amount=round(total, 2) if s_index % 2 == 0 else round(total * 0.5, 2),
                payment_method="كاش" if s_index % 2 == 0 else "آجل",
                status="received",
                user_id=admin.id,
                created_at=datetime.now() - timedelta(days=random.randint(10, 40)),
            )
            purchase.items = items
            db.add(purchase)

        # سجل مبيعات لآخر 30 يومًا
        now = datetime.now()
        invoice_seq = 1
        for day_offset in range(30, -1, -1):
            day = now - timedelta(days=day_offset)
            daily_sales = random.randint(2, 7) if day_offset > 0 else random.randint(3, 6)
            for _ in range(daily_sales):
                sale_time = day.replace(
                    hour=random.randint(9, 21),
                    minute=random.randint(0, 59),
                    second=random.randint(0, 59),
                    microsecond=0,
                )
                chosen = random.sample(medicines, k=random.randint(1, 4))
                sale_items = []
                subtotal = 0.0
                cost = 0.0
                for med in chosen:
                    med_batches = [b for b in batches if b.medicine_id == med.id]
                    if not med_batches:
                        continue
                    batch = random.choice(med_batches)
                    if batch.quantity_boxes <= 2:
                        continue
                    unit = random.choices(["box", "strip"], weights=[0.7, 0.3])[0]
                    qty = random.randint(1, 3)
                    if unit == "box":
                        qty = min(qty, batch.quantity_boxes - 1)
                        unit_price = float(batch.sell_price)
                        unit_cost = float(batch.buy_price)
                        batch.quantity_boxes -= qty
                        boxes, strips = qty, 0
                    else:
                        qty = min(qty, max(batch.quantity_strips, 4))
                        unit_price = round(float(batch.sell_price) / (med.strips_per_box or 1), 2)
                        unit_cost = round(float(batch.buy_price) / (med.strips_per_box or 1), 2)
                        batch.quantity_strips += max(4, qty) - qty
                        batch.quantity_strips -= qty
                        boxes, strips = 0, qty
                    line_total = round(unit_price * qty, 2)
                    subtotal += line_total
                    cost += unit_cost * qty
                    sale_items.append(
                        SaleItem(
                            batch_id=batch.id,
                            medicine_name=med.trade_name,
                            unit_type=unit,
                            quantity_boxes_sold=boxes,
                            quantity_strips_sold=strips,
                            unit_price=unit_price,
                            cost_price=unit_cost,
                            subtotal=line_total,
                        )
                    )
                if not sale_items:
                    continue
                discount = random.choice([0, 0, 0, 0, 2, 5])
                net = round(max(0, subtotal - discount), 2)
                method = random.choices(["كاش", "شبكة", "آجل"], weights=[0.65, 0.3, 0.05])[0]
                customer = None
                if method == "آجل":
                    customer = random.choice(customers)
                sale = Sale(
                    invoice_number=f"INV-DEMO-{invoice_seq:04d}",
                    total_amount=round(subtotal, 2),
                    discount=discount,
                    tax_amount=0,
                    net_amount=net,
                    paid_amount=net if method != "آجل" else round(net / 2, 2),
                    cost_amount=round(cost, 2),
                    payment_method=method,
                    pharmacist_id=random.choice([admin.id, pharmacist.id]),
                    customer_id=customer.id if customer else None,
                    customer_name=customer.name if customer else None,
                    status="completed",
                    created_at=sale_time,
                )
                sale.items = sale_items
                db.add(sale)
                invoice_seq += 1

        # فاتورة مرتجعة واحدة
        first = db.query(Sale).order_by(Sale.created_at.asc()).first()
        if first:
            first.status = "refunded"
            first.refunded_at = first.created_at + timedelta(hours=2)

        db.commit()
        print("✓ تمت إضافة البيانات التجريبية بنجاح")
        print("  مدير: admin / admin123")
        print("  صيدلي: huda / huda123")
        print("  كاشير: mohamed / mohamed123")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
