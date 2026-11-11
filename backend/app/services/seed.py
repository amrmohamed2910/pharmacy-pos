from ..config import settings
from ..models import Setting, User
from ..security import hash_password

DEFAULT_SETTINGS: dict[str, str] = {
    "pharmacy_name": "صيدلية النخبة",
    "pharmacy_phone": "01000000000",
    "pharmacy_address": "شارع الجمهورية - وسط البلد",
    "currency": settings.default_currency,
    "tax_rate": "0",
    "low_stock_threshold": str(settings.low_stock_threshold),
    "expiry_warning_days": str(settings.expiry_warning_days),
    "receipt_footer": "شكرًا لثقتكم بنا — نتمنى لكم الشفاء العاجل",
}


def ensure_seed(db) -> None:
    """تجهيز المستخدم الافتراضي والإعدادات الأساسية عند أول تشغيل"""
    admin = db.query(User).filter(User.username == "admin").first()
    if admin is None:
        db.add(
            User(
                name="مدير النظام",
                username="admin",
                password_hash=hash_password("admin123"),
                role="admin",
                is_active=True,
            )
        )

    for key, value in DEFAULT_SETTINGS.items():
        if db.get(Setting, key) is None:
            db.add(Setting(key=key, value=value))

    db.commit()
