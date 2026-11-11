"""ترقية قاعدة البيانات الحالية بأمان (idempotent) دون فقدان أي بيانات."""
from sqlalchemy import inspect, text

from app.database import Base, engine

# الأعمدة الجديدة التي يجب إضافتها للجداول الموجودة مسبقًا
NEW_COLUMNS: dict[str, list[tuple[str, str]]] = {
    "medicines": [
        ("is_active", "TINYINT(1) NOT NULL DEFAULT 1"),
    ],
    "sales": [
        ("paid_amount", "DECIMAL(10,2) NOT NULL DEFAULT 0"),
        ("cost_amount", "DECIMAL(10,2) NOT NULL DEFAULT 0"),
        ("customer_id", "INT NULL"),
        ("customer_name", "VARCHAR(255) NULL"),
        ("status", "VARCHAR(20) NOT NULL DEFAULT 'completed'"),
        ("notes", "VARCHAR(500) NULL"),
        ("refunded_at", "DATETIME NULL"),
    ],
    "sale_items": [
        ("medicine_name", "VARCHAR(255) NULL"),
        ("unit_type", "VARCHAR(20) NULL DEFAULT 'box'"),
        ("cost_price", "DECIMAL(10,2) NOT NULL DEFAULT 0"),
    ],
}


def run() -> None:
    Base.metadata.create_all(bind=engine)
    print("✓ تم إنشاء الجداول الجديدة إن لم تكن موجودة")

    inspector = inspect(engine)
    with engine.begin() as conn:
        for table, columns in NEW_COLUMNS.items():
            if not inspector.has_table(table):
                continue
            existing = {col["name"] for col in inspector.get_columns(table)}
            for name, ddl in columns:
                if name in existing:
                    continue
                conn.execute(text(f"ALTER TABLE `{table}` ADD COLUMN `{name}` {ddl}"))
                print(f"✓ إضافة العمود {table}.{name}")

        # تعبئة بيانات الفواتير القديمة لتعمل التقارير بشكل صحيح
        conn.execute(
            text(
                """
                UPDATE sales SET paid_amount = net_amount
                WHERE paid_amount = 0 AND status = 'completed'
                """
            )
        )
        conn.execute(
            text(
                """
                UPDATE sales s
                SET cost_amount = COALESCE((
                    SELECT SUM(si.cost_price * (si.quantity_boxes_sold + si.quantity_strips_sold))
                    FROM sale_items si WHERE si.sale_id = s.id
                ), 0)
                """
            )
        )
        conn.execute(
            text(
                """
                UPDATE sale_items si
                JOIN batches b ON b.id = si.batch_id
                JOIN medicines m ON m.id = b.medicine_id
                SET si.medicine_name = COALESCE(si.medicine_name, m.trade_name),
                    si.unit_type = CASE
                        WHEN si.quantity_boxes_sold > 0 THEN 'box' ELSE 'strip' END,
                    si.cost_price = CASE
                        WHEN si.quantity_boxes_sold > 0 THEN b.buy_price
                        ELSE ROUND(b.buy_price / GREATEST(m.strips_per_box, 1), 2)
                    END
                WHERE si.cost_price = 0 OR si.medicine_name IS NULL
                """
            )
        )
        # فهارس مساعدة للأداء
        for table, column in [
            ("sales", "created_at"),
            ("medicines", "trade_name"),
            ("batches", "expiry_date"),
        ]:
            index_name = f"ix_{table}_{column}"
            indexes = {idx["name"] for idx in inspector.get_indexes(table)}
            if index_name not in indexes:
                try:
                    conn.execute(
                        text(f"CREATE INDEX `{index_name}` ON `{table}` (`{column}`)")
                    )
                    print(f"✓ إنشاء الفهرس {index_name}")
                except Exception as exc:  # pragma: no cover
                    print(f"… تخطي الفهرس {index_name}: {exc}")

    print("✓ اكتملت ترقية قاعدة البيانات بنجاح")


if __name__ == "__main__":
    run()
