from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .database import Base, SessionLocal, engine
from .routers import (
    auth,
    batches,
    dashboard,
    medicines,
    partners,
    purchases,
    reports,
    sales,
    settings as settings_router,
    users,
)
from .services.seed import ensure_seed

ROOT_DIR = Path(__file__).resolve().parents[2]
DIST_DIR = ROOT_DIR / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        ensure_seed(db)
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="نظام إدارة صيدليات متكامل — مبيعات، مخزون، مشتريات وتقارير",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API = settings.api_prefix

app.include_router(auth.router, prefix=API)
app.include_router(users.router, prefix=API)
app.include_router(dashboard.router, prefix=API)
app.include_router(medicines.router, prefix=API)
app.include_router(batches.router, prefix=API)
app.include_router(sales.router, prefix=API)
app.include_router(partners.router, prefix=API)
app.include_router(purchases.router, prefix=API)
app.include_router(reports.router, prefix=API)
app.include_router(settings_router.router, prefix=API)


@app.get("/api/health", tags=["system"])
def health():
    return {"status": "ok", "version": settings.version, "app": settings.app_name}


if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        candidate = (DIST_DIR / full_path).resolve()
        if full_path and candidate.is_file() and DIST_DIR in candidate.parents:
            return FileResponse(candidate)
        index = DIST_DIR / "index.html"
        if index.exists():
            return FileResponse(index)
        return JSONResponse({"detail": "الواجهة غير مبنية بعد"}, status_code=404)
