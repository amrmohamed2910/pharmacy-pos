from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """إعدادات التطبيق، يمكن تجاوز أي قيمة عبر متغيرات البيئة أو ملف .env"""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "صيدليتي | Pharmacy Suite"
    version: str = "3.0.0"
    api_prefix: str = "/api"

    database_url: str = (
        "mysql+pymysql://root:@127.0.0.1:3306/pharmacy_db?charset=utf8mb4"
    )

    # بديل لـ DATABASE_URL: متغيرات منفصلة (مفيدة عند النشر على Render/Aiven).
    # إذا تم ضبط DB_HOST يُبنى رابط الاتصال تلقائيًا وتُهمل DATABASE_URL.
    db_host: str | None = None
    db_port: int = 3306
    db_user: str = "avnadmin"
    db_password: str = ""
    db_name: str = "defaultdb"

    # اتصال مشفّر بقاعدة بيانات سحابية (مثل Aiven): مسار شهادة CA و/أو تعطيل التحقق.
    database_ssl_ca: str | None = None
    database_ssl_verify: bool = True

    jwt_secret: str = "change-me-in-production-3f8c1d9a"
    jwt_algorithm: str = "HS256"
    token_expire_minutes: int = 720

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    default_currency: str = "ج.م"
    low_stock_threshold: int = 10
    expiry_warning_days: int = 90

    @property
    def cors_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
