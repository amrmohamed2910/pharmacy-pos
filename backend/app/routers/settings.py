from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_roles
from ..models import Setting, User
from ..schemas import SettingsUpdate
from ..services.seed import DEFAULT_SETTINGS

router = APIRouter(prefix="/settings", tags=["settings"])

ALLOWED_KEYS = set(DEFAULT_SETTINGS.keys())


def _all_settings(db: Session) -> dict[str, str]:
    values = {key: value for key, value in DEFAULT_SETTINGS.items()}
    for setting in db.query(Setting).all():
        values[setting.key] = setting.value or ""
    return values


@router.get("")
def get_settings(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    values = _all_settings(db)
    return {
        **values,
        "tax_rate": float(values.get("tax_rate") or 0),
        "low_stock_threshold": int(values.get("low_stock_threshold") or 10),
        "expiry_warning_days": int(values.get("expiry_warning_days") or 90),
    }


@router.put("")
def update_settings(
    payload: SettingsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        if key not in ALLOWED_KEYS:
            continue
        setting = db.get(Setting, key)
        str_value = "" if value is None else str(value)
        if setting:
            setting.value = str_value
        else:
            db.add(Setting(key=key, value=str_value))
    db.commit()
    return get_settings(db, _)
