from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Auth & Users ----------
class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class LoginIn(BaseModel):
    username: str = Field(min_length=2, max_length=100)
    password: str = Field(min_length=4, max_length=128)


class UserBase(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    username: str = Field(min_length=2, max_length=100)
    role: Literal["admin", "pharmacist", "cashier"] = "pharmacist"
    is_active: bool = True


class UserCreate(UserBase):
    password: str = Field(min_length=6, max_length=128)


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    role: Literal["admin", "pharmacist", "cashier"] | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=6, max_length=128)


class UserOut(ORMModel):
    id: int
    name: str
    username: str
    role: str
    is_active: bool
    created_at: datetime | None = None


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=128)


# ---------- Medicines ----------
class MedicineBase(BaseModel):
    trade_name: str = Field(min_length=1, max_length=255)
    scientific_name: str = Field(min_length=1, max_length=255)
    barcode: str | None = None
    category: str | None = None
    unit_type: Literal["علبة", "شريط", "قرص", "زجاجة", "أمبول"] = "علبة"
    strips_per_box: int = Field(default=1, ge=1, le=1000)
    requires_prescription: bool = False
    min_stock_level: int = Field(default=10, ge=0)
    tax_rate: float = Field(default=0, ge=0, le=100)
    is_active: bool = True


class MedicineCreate(MedicineBase):
    pass


class MedicineUpdate(BaseModel):
    trade_name: str | None = Field(default=None, min_length=1, max_length=255)
    scientific_name: str | None = Field(default=None, min_length=1, max_length=255)
    barcode: str | None = None
    category: str | None = None
    unit_type: Literal["علبة", "شريط", "قرص", "زجاجة", "أمبول"] | None = None
    strips_per_box: int | None = Field(default=None, ge=1, le=1000)
    requires_prescription: bool | None = None
    min_stock_level: int | None = Field(default=None, ge=0)
    tax_rate: float | None = Field(default=None, ge=0, le=100)
    is_active: bool | None = None


class BatchBase(BaseModel):
    batch_number: str = Field(min_length=1, max_length=100)
    expiry_date: date
    buy_price: float = Field(ge=0)
    sell_price: float = Field(ge=0)
    quantity_boxes: int = Field(default=0, ge=0)
    quantity_strips: int = Field(default=0, ge=0)


class BatchCreate(BatchBase):
    pass


class BatchUpdate(BaseModel):
    batch_number: str | None = Field(default=None, min_length=1, max_length=100)
    expiry_date: date | None = None
    buy_price: float | None = Field(default=None, ge=0)
    sell_price: float | None = Field(default=None, ge=0)
    quantity_boxes: int | None = Field(default=None, ge=0)
    quantity_strips: int | None = Field(default=None, ge=0)


class BatchOut(ORMModel):
    id: int
    medicine_id: int
    batch_number: str
    expiry_date: date
    buy_price: float
    sell_price: float
    quantity_boxes: int
    quantity_strips: int
    created_at: datetime | None = None


class MedicineOut(ORMModel):
    id: int
    trade_name: str
    scientific_name: str
    barcode: str | None = None
    category: str | None = None
    unit_type: str | None = None
    strips_per_box: int | None = None
    requires_prescription: bool | None = None
    min_stock_level: int | None = None
    tax_rate: float | None = None
    is_active: bool | None = None
    created_at: datetime | None = None


class MedicineListItem(MedicineOut):
    total_boxes: int = 0
    total_strips: int = 0
    sell_price: float = 0
    cost_price: float = 0
    nearest_expiry: date | None = None
    stock_status: Literal["out", "low", "ok"] = "ok"
    sold_30d: int = 0


class MedicineDetail(MedicineOut):
    batches: list[BatchOut] = []


class MedicineSearchItem(BaseModel):
    id: int
    trade_name: str
    scientific_name: str
    barcode: str | None = None
    category: str | None = None
    requires_prescription: bool = False
    strips_per_box: int = 1
    box_price: float = 0
    strip_price: float = 0
    cost_price: float = 0
    available_boxes: int = 0
    available_strips: int = 0
    has_stock: bool = False


class Paginated(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    pages: int


# ---------- Sales ----------
class SaleItemRequest(BaseModel):
    medicine_id: int
    unit_type: Literal["box", "strip"] = "box"
    quantity: int = Field(default=1, ge=1, le=10000)


class InvoiceCreate(BaseModel):
    pharmacist_id: int | None = None
    payment_method: Literal["كاش", "شبكة", "آجل"] = "كاش"
    discount: float = Field(default=0, ge=0)
    paid_amount: float = Field(default=0, ge=0)
    customer_id: int | None = None
    customer_name: str | None = None
    notes: str | None = None
    items: list[SaleItemRequest] = Field(min_length=1)


class SaleItemOut(ORMModel):
    id: int
    batch_id: int
    medicine_name: str | None = None
    unit_type: str | None = None
    quantity_boxes_sold: int = 0
    quantity_strips_sold: int = 0
    unit_price: float
    cost_price: float = 0
    subtotal: float
    batch_number: str | None = None


class SaleOut(ORMModel):
    id: int
    invoice_number: str
    total_amount: float
    discount: float
    tax_amount: float
    net_amount: float
    paid_amount: float = 0
    cost_amount: float = 0
    payment_method: str | None = None
    pharmacist_id: int | None = None
    customer_name: str | None = None
    status: str = "completed"
    notes: str | None = None
    created_at: datetime
    refunded_at: datetime | None = None
    items_count: int = 0
    items: list[SaleItemOut] = []


class CheckoutResult(SaleOut):
    change: float = 0
    profit: float = 0


# ---------- Suppliers & Purchases ----------
class SupplierBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    notes: str | None = None
    is_active: bool = True


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    notes: str | None = None
    is_active: bool | None = None


class SupplierOut(ORMModel):
    id: int
    name: str
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    notes: str | None = None
    is_active: bool = True
    created_at: datetime | None = None
    purchases_count: int = 0
    total_purchases: float = 0


class CustomerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    phone: str | None = None
    address: str | None = None
    notes: str | None = None


class CustomerOut(ORMModel):
    id: int
    name: str
    phone: str | None = None
    address: str | None = None
    notes: str | None = None
    created_at: datetime | None = None
    total_spent: float = 0
    invoices_count: int = 0


class PurchaseItemIn(BaseModel):
    medicine_id: int
    batch_number: str = Field(min_length=1, max_length=100)
    expiry_date: date
    buy_price: float = Field(ge=0)
    sell_price: float = Field(ge=0)
    quantity_boxes: int = Field(default=0, ge=0)
    quantity_strips: int = Field(default=0, ge=0)


class PurchaseCreate(BaseModel):
    supplier_id: int | None = None
    supplier_name: str | None = None
    invoice_number: str | None = None
    payment_method: Literal["كاش", "شبكة", "آجل"] = "كاش"
    paid_amount: float = Field(default=0, ge=0)
    notes: str | None = None
    items: list[PurchaseItemIn] = Field(min_length=1)


class PurchaseItemOut(ORMModel):
    id: int
    medicine_id: int
    medicine_name: str | None = None
    batch_number: str
    expiry_date: date
    buy_price: float
    sell_price: float
    quantity_boxes: int
    quantity_strips: int
    subtotal: float


class PurchaseOut(ORMModel):
    id: int
    invoice_number: str
    supplier_id: int | None = None
    supplier_name: str | None = None
    total_amount: float
    paid_amount: float
    payment_method: str | None = None
    status: str
    notes: str | None = None
    created_at: datetime
    items: list[PurchaseItemOut] = []
    items_count: int = 0


# ---------- Settings ----------
class SettingsUpdate(BaseModel):
    pharmacy_name: str | None = None
    pharmacy_phone: str | None = None
    pharmacy_address: str | None = None
    currency: str | None = None
    tax_rate: float | None = Field(default=None, ge=0, le=100)
    low_stock_threshold: int | None = Field(default=None, ge=0)
    expiry_warning_days: int | None = Field(default=None, ge=1, le=730)
    receipt_footer: str | None = None


TokenOut.model_rebuild()
