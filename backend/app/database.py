import ssl as ssl_module
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings
import os

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "defaultdb")


def _database_target() -> str | URL:
    """يبني رابط الاتصال من DB_* إن وُجدت، وإلا يستخدم DATABASE_URL."""
    if settings.db_host:
        return URL.create(
            "mysql+pymysql",
            username=settings.db_user or "avnadmin",
            password=settings.db_password or "",
            host=settings.db_host,
            port=settings.db_port,
            database=settings.db_name,
            query={"charset": "utf8mb4"},
        )
    return settings.database_url


def _connect_args() -> dict:
    """إعدادات اتصال MySQL، مع دعم SSL للقواعد السحابية مثل Aiven."""
    if settings.db_host is None and not settings.database_url.startswith("mysql"):
        return {}

    args: dict = {
        "connect_timeout": 10,
        "read_timeout": 30,
        "write_timeout": 30,
    }

    ssl_args: dict = {}
    if settings.database_ssl_ca:
        ssl_args["ca"] = settings.database_ssl_ca
    if not settings.database_ssl_verify:
        # اتصال مشفّر بدون التحقق من شهادة الخادم (مناسب عندما لا تتوفر شهادة Aiven CA).
        ssl_args["check_hostname"] = False
        ssl_args["verify_mode"] = ssl_module.CERT_NONE
    if ssl_args:
        args["ssl"] = ssl_args

    return args


engine = create_engine(
    _database_target(),
    pool_pre_ping=True,
    pool_recycle=280,
    pool_size=5,
    max_overflow=5,
    pool_timeout=10,
    connect_args=_connect_args(),
    future=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
