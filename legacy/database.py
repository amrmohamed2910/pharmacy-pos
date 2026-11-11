from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Numeric, Boolean, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

# رابط الاتصال بقاعدة بيانات MySQL
SQLALCHEMY_DATABASE_URL = "mysql+pymysql://root:@localhost:3306/pharmacy_db"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- تعريف النماذج والجداول ---

class Medicine(Base):
    __tablename__ = 'medicines'

    id = Column(Integer, primary_key=True, index=True)
    trade_name = Column(String(255), nullable=False)
    scientific_name = Column(String(255), nullable=False)
    barcode = Column(String(100), unique=True)
    category = Column(String(100))
    unit_type = Column(String(50), default='علبة')
    strips_per_box = Column(Integer, default=1)
    requires_prescription = Column(Boolean, default=False)
    min_stock_level = Column(Integer, default=10)
    tax_rate = Column(Numeric(5, 2), default=0.00)

    batches = relationship("Batch", back_populates="medicine", cascade="all, delete-orphan")


class Batch(Base):
    __tablename__ = 'batches'

    id = Column(Integer, primary_key=True, index=True)
    medicine_id = Column(Integer, ForeignKey('medicines.id'), nullable=False)
    batch_number = Column(String(100), nullable=False)
    expiry_date = Column(DateTime, nullable=False)
    buy_price = Column(Numeric(10, 2), nullable=False)
    sell_price = Column(Numeric(10, 2), nullable=False)
    quantity_boxes = Column(Integer, default=0)
    quantity_strips = Column(Integer, default=0)

    medicine = relationship("Medicine", back_populates="batches")


class Sale(Base):
    __tablename__ = 'sales'

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(50), unique=True, nullable=False)
    total_amount = Column(Numeric(10, 2), nullable=False)
    discount = Column(Numeric(10, 2), default=0.00)
    tax_amount = Column(Numeric(10, 2), default=0.00)
    net_amount = Column(Numeric(10, 2), nullable=False)
    payment_method = Column(String(50), default='كاش')
    pharmacist_id = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)


class SaleItem(Base):
    __tablename__ = 'sale_items'

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey('sales.id'), nullable=False)
    batch_id = Column(Integer, ForeignKey('batches.id'), nullable=False)
    quantity_boxes_sold = Column(Integer, default=0)
    quantity_strips_sold = Column(Integer, default=0)
    unit_price = Column(Numeric(10, 2), nullable=False)
    subtotal = Column(Numeric(10, 2), nullable=False)


# دالة فتح وإغلاق الاتصال بقاعدة البيانات
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()