"""إنشاء قاعدة بيانات الصيدلية إن لم تكن موجودة (بدون حذف أي بيانات قائمة)."""
from sqlalchemy.engine import make_url

from app.config import settings


def run() -> None:
    url = make_url(settings.database_url)
    database = url.database
    if not database:
        raise SystemExit("DATABASE_URL لا يحتوي على اسم قاعدة البيانات")

    try:
        import pymysql
    except ImportError as exc:  # pragma: no cover
        raise SystemExit(
            "حزمة PyMySQL غير مثبتة. شغّل: python -m pip install -r requirements.txt"
        ) from exc

    connection = pymysql.connect(
        host=url.host or "127.0.0.1",
        port=url.port or 3306,
        user=url.username or "root",
        password=url.password or "",
        charset="utf8mb4",
        autocommit=True,
    )
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS `{database}` "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
        print(f"✓ قاعدة البيانات «{database}» جاهزة")
    finally:
        connection.close()


if __name__ == "__main__":
    run()
