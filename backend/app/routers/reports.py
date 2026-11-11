import io
from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Batch, Medicine, Purchase, Sale, SaleItem, User
from ..services.inventory import get_stock_map, stock_status

router = APIRouter(prefix="/reports", tags=["reports"])


def _default_range():
    today = date.today()
    return today - timedelta(days=29), today


@router.get("/sales")
def sales_report(
    from_date: date | None = Query(default=None, alias="from"),
    to_date: date | None = Query(default=None, alias="to"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    default_start, default_end = _default_range()
    start = from_date or default_start
    end = to_date or default_end
    start_dt = datetime.combine(start, time.min)
    end_dt = datetime.combine(end + timedelta(days=1), time.min)

    base_filters = (
        Sale.status == "completed",
        Sale.created_at >= start_dt,
        Sale.created_at < end_dt,
    )

    revenue, invoices, discount, cost = (
        db.query(
            func.coalesce(func.sum(Sale.net_amount), 0),
            func.count(Sale.id),
            func.coalesce(func.sum(Sale.discount), 0),
            func.coalesce(func.sum(Sale.cost_amount), 0),
        )
        .filter(*base_filters)
        .one()
    )

    units = (
        db.query(
            func.coalesce(
                func.sum(SaleItem.quantity_boxes_sold + SaleItem.quantity_strips_sold), 0
            )
        )
        .join(Sale, Sale.id == SaleItem.sale_id)
        .filter(*base_filters)
        .scalar()
    )

    by_day_rows = (
        db.query(
            func.date(Sale.created_at),
            func.coalesce(func.sum(Sale.net_amount), 0),
            func.count(Sale.id),
            func.coalesce(func.sum(Sale.net_amount - Sale.cost_amount), 0),
        )
        .filter(*base_filters)
        .group_by(func.date(Sale.created_at))
        .order_by(func.date(Sale.created_at))
        .all()
    )

    by_payment_rows = (
        db.query(
            Sale.payment_method,
            func.count(Sale.id),
            func.coalesce(func.sum(Sale.net_amount), 0),
        )
        .filter(*base_filters)
        .group_by(Sale.payment_method)
        .all()
    )

    top_rows = (
        db.query(
            SaleItem.medicine_name,
            func.sum(SaleItem.quantity_boxes_sold + SaleItem.quantity_strips_sold),
            func.sum(SaleItem.subtotal),
            func.sum(SaleItem.subtotal - SaleItem.cost_price * (SaleItem.quantity_boxes_sold + SaleItem.quantity_strips_sold)),
        )
        .join(Sale, Sale.id == SaleItem.sale_id)
        .filter(*base_filters)
        .group_by(SaleItem.medicine_name)
        .order_by(func.sum(SaleItem.subtotal).desc())
        .limit(10)
        .all()
    )

    purchases_total = (
        db.query(func.coalesce(func.sum(Purchase.total_amount), 0))
        .filter(Purchase.created_at >= start_dt, Purchase.created_at < end_dt)
        .scalar()
        or 0
    )

    return {
        "range": {"from": start, "to": end},
        "summary": {
            "revenue": round(float(revenue), 2),
            "invoices": int(invoices),
            "discount": round(float(discount), 2),
            "cost": round(float(cost), 2),
            "profit": round(float(revenue) - float(cost), 2),
            "margin": round((float(revenue) - float(cost)) / float(revenue) * 100, 1)
            if float(revenue)
            else 0,
            "units_sold": int(units or 0),
            "average_invoice": round(float(revenue) / invoices, 2) if invoices else 0,
            "purchases": round(float(purchases_total), 2),
        },
        "by_day": [
            {
                "date": str(row[0]),
                "revenue": round(float(row[1]), 2),
                "invoices": int(row[2]),
                "profit": round(float(row[3]), 2),
            }
            for row in by_day_rows
        ],
        "by_payment": [
            {
                "method": row[0] or "غير محدد",
                "count": int(row[1]),
                "amount": round(float(row[2]), 2),
            }
            for row in by_payment_rows
        ],
        "top_medicines": [
            {
                "name": row[0] or "غير معروف",
                "quantity": int(row[1] or 0),
                "revenue": round(float(row[2] or 0), 2),
                "profit": round(float(row[3] or 0), 2),
            }
            for row in top_rows
        ],
    }


@router.get("/inventory")
def inventory_report(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    today = date.today()
    medicines = db.query(Medicine).filter(Medicine.is_active.is_(True)).all()
    stock = get_stock_map(db, [m.id for m in medicines])
    by_id = {m.id: m for m in medicines}

    batches = (
        db.query(Batch)
        .filter(
            Batch.expiry_date >= today,
            (Batch.quantity_boxes > 0) | (Batch.quantity_strips > 0),
        )
        .all()
    )

    cost_value = 0.0
    retail_value = 0.0
    for batch in batches:
        med = by_id.get(batch.medicine_id)
        if not med:
            continue
        spb = med.strips_per_box or 1
        boxes = batch.quantity_boxes or 0
        strips = batch.quantity_strips or 0
        cost_value += boxes * float(batch.buy_price) + strips * float(batch.buy_price) / spb
        retail_value += boxes * float(batch.sell_price) + strips * float(batch.sell_price) / spb

    expired_rows = (
        db.query(Batch, Medicine)
        .join(Medicine, Medicine.id == Batch.medicine_id)
        .filter(
            Batch.expiry_date < today,
            (Batch.quantity_boxes > 0) | (Batch.quantity_strips > 0),
        )
        .all()
    )
    expired_value = 0.0
    for batch, med in expired_rows:
        spb = med.strips_per_box or 1
        expired_value += (batch.quantity_boxes or 0) * float(batch.buy_price) + (
            batch.quantity_strips or 0
        ) * float(batch.buy_price) / spb

    categories: dict[str, dict] = {}
    low_stock = []
    for med in medicines:
        info = stock.get(med.id, {})
        status = stock_status(med, info.get("boxes", 0), info.get("strips", 0))
        category = med.category or "غير مصنف"
        entry = categories.setdefault(category, {"count": 0, "value": 0.0, "units": 0})
        entry["count"] += 1
        entry["units"] += int(info.get("boxes", 0)) + int(info.get("strips", 0))
        entry["value"] += int(info.get("boxes", 0)) * float(info.get("cost_price", 0)) + int(
            info.get("strips", 0)
        ) * float(info.get("cost_price", 0)) / (med.strips_per_box or 1)
        if status in {"low", "out"}:
            low_stock.append(
                {
                    "name": med.trade_name,
                    "category": med.category,
                    "boxes": info.get("boxes", 0),
                    "strips": info.get("strips", 0),
                    "min_stock_level": med.min_stock_level,
                    "status": status,
                }
            )

    return {
        "summary": {
            "medicines": len(medicines),
            "batches": len(batches),
            "units": sum(
                int(v.get("boxes", 0)) + int(v.get("strips", 0)) for v in stock.values()
            ),
            "cost_value": round(cost_value, 2),
            "retail_value": round(retail_value, 2),
            "expected_profit": round(retail_value - cost_value, 2),
            "expired_value": round(expired_value, 2),
            "low_stock_count": len(low_stock),
        },
        "by_category": [
            {"category": name, **{k: round(v, 2) if k == "value" else v for k, v in data.items()}}
            for name, data in sorted(
                categories.items(), key=lambda item: item[1]["value"], reverse=True
            )
        ],
        "low_stock": sorted(low_stock, key=lambda item: item["boxes"] + item["strips"])[:20],
        "expired": [
            {
                "name": med.trade_name,
                "batch_number": batch.batch_number,
                "expiry_date": batch.expiry_date,
                "quantity_boxes": batch.quantity_boxes,
                "quantity_strips": batch.quantity_strips,
            }
            for batch, med in expired_rows[:20]
        ],
    }


def _style_sheet(ws, title: str, headers: list[str], rtl: bool = True):
    ws.sheet_view.rightToLeft = rtl
    ws.append([title])
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(headers))
    title_cell = ws.cell(row=1, column=1)
    title_cell.font = Font(size=15, bold=True, color="0F766E")
    title_cell.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 28

    ws.append(headers)
    fill = PatternFill("solid", fgColor="0D9488")
    for cell in ws[2]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = fill
        cell.alignment = Alignment(horizontal="center", vertical="center")
    ws.freeze_panes = "A3"


def _autofit(ws):
    for column in ws.columns:
        length = max(len(str(cell.value)) if cell.value is not None else 0 for cell in column)
        ws.column_dimensions[get_column_letter(column[0].column)].width = min(
            max(12, length + 4), 40
        )


@router.get("/export/sales.xlsx")
def export_sales(
    from_date: date | None = Query(default=None, alias="from"),
    to_date: date | None = Query(default=None, alias="to"),
    lang: str = Query(default="ar"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    english = (lang or "ar").lower().startswith("en")
    default_start, default_end = _default_range()
    start = from_date or default_start
    end = to_date or default_end

    sales = (
        db.query(Sale)
        .filter(
            Sale.created_at >= datetime.combine(start, time.min),
            Sale.created_at < datetime.combine(end + timedelta(days=1), time.min),
        )
        .order_by(Sale.created_at.asc())
        .all()
    )

    wb = Workbook()
    ws = wb.active
    ws.title = "Sales" if english else "المبيعات"
    if english:
        headers = [
            "Invoice no.",
            "Date",
            "Items",
            "Total",
            "Discount",
            "Net",
            "Cost",
            "Profit",
            "Payment method",
            "Status",
            "Customer",
        ]
        title = f"Sales report from {start} to {end}"
        payment_labels = {"كاش": "Cash", "شبكة": "Card", "آجل": "Credit"}
        status_labels = {"completed": "Completed", "refunded": "Refunded"}
    else:
        headers = [
            "رقم الفاتورة",
            "التاريخ",
            "عدد الأصناف",
            "الإجمالي",
            "الخصم",
            "الصافي",
            "التكلفة",
            "الربح",
            "طريقة الدفع",
            "الحالة",
            "العميل",
        ]
        title = f"تقرير المبيعات من {start} إلى {end}"
        payment_labels = {"كاش": "كاش", "شبكة": "شبكة / فيزا", "آجل": "آجل"}
        status_labels = {"completed": "مكتملة", "refunded": "مرتجعة"}
    _style_sheet(ws, title, headers, rtl=not english)
    for sale in sales:
        ws.append(
            [
                sale.invoice_number,
                sale.created_at.strftime("%Y-%m-%d %H:%M"),
                len(sale.items),
                float(sale.total_amount),
                float(sale.discount or 0),
                float(sale.net_amount),
                float(sale.cost_amount or 0),
                round(float(sale.net_amount) - float(sale.cost_amount or 0), 2),
                payment_labels.get(sale.payment_method, sale.payment_method),
                status_labels.get(sale.status, sale.status),
                sale.customer_name or "-",
            ]
        )
    _autofit(ws)

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    filename = f"sales-{start}-{end}.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/inventory.xlsx")
def export_inventory(
    lang: str = Query(default="ar"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    english = (lang or "ar").lower().startswith("en")
    medicines = db.query(Medicine).filter(Medicine.is_active.is_(True)).all()
    stock = get_stock_map(db, [m.id for m in medicines])

    wb = Workbook()
    ws = wb.active
    ws.title = "Inventory" if english else "المخزون"
    if english:
        headers = [
            "Item",
            "Scientific name",
            "Barcode",
            "Category",
            "Boxes",
            "Strips",
            "Selling price",
            "Purchase price",
            "Nearest expiry",
            "Status",
        ]
        title = "Inventory report"
        labels = {"ok": "In stock", "low": "Low", "out": "Out of stock"}
    else:
        headers = [
            "الصنف",
            "الاسم العلمي",
            "الباركود",
            "التصنيف",
            "علب",
            "أشرطة",
            "سعر البيع",
            "سعر الشراء",
            "أقرب انتهاء",
            "الحالة",
        ]
        title = "تقرير المخزون"
        labels = {"ok": "متاح", "low": "منخفض", "out": "نافد"}
    _style_sheet(ws, title, headers, rtl=not english)
    for med in medicines:
        info = stock.get(med.id, {})
        ws.append(
            [
                med.trade_name,
                med.scientific_name,
                med.barcode or "-",
                med.category or "-",
                info.get("boxes", 0),
                info.get("strips", 0),
                info.get("sell_price", 0),
                info.get("cost_price", 0),
                str(info.get("nearest_expiry") or "-"),
                labels[stock_status(med, info.get("boxes", 0), info.get("strips", 0))],
            ]
        )
    _autofit(ws)

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    filename = f"inventory-{date.today()}.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
