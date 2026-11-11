from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_roles
from ..models import User
from ..schemas import UserCreate, UserOut, UserUpdate
from ..security import hash_password

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    return db.query(User).order_by(User.created_at.asc()).all()


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    exists = db.query(User).filter(User.username == payload.username.strip()).first()
    if exists:
        raise HTTPException(status_code=400, detail="اسم المستخدم مستخدم بالفعل")
    user = User(
        name=payload.name.strip(),
        username=payload.username.strip(),
        role=payload.role,
        is_active=payload.is_active,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("admin")),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")

    data = payload.model_dump(exclude_unset=True)
    if "password" in data and data["password"]:
        user.password_hash = hash_password(data.pop("password"))
    data.pop("password", None)

    if user.id == current.id:
        if data.get("is_active") is False:
            raise HTTPException(status_code=400, detail="لا يمكنك تعطيل حسابك الحالي")
        if data.get("role") and data["role"] != "admin":
            admins = db.query(User).filter(User.role == "admin", User.is_active.is_(True)).count()
            if admins <= 1:
                raise HTTPException(
                    status_code=400, detail="لا يمكن تغيير دور آخر مدير للنظام"
                )

    for key, value in data.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("admin")),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    if user.id == current.id:
        raise HTTPException(status_code=400, detail="لا يمكنك حذف حسابك الحالي")

    admins = db.query(User).filter(User.role == "admin", User.is_active.is_(True)).count()
    if user.role == "admin" and admins <= 1:
        raise HTTPException(status_code=400, detail="لا يمكن حذف آخر مدير للنظام")

    db.delete(user)
    db.commit()
    return {"message": "تم حذف المستخدم"}
