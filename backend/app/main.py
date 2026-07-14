from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import Base, engine
from app.routers import auth, grows, search, seeds, strains

app = FastAPI(
    title="Cannabis Grow & Seed Tracker",
    description="API für die Verwaltung von Cannabis-Strains, Samen und Grow-Dokumentation",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(strains.router)
app.include_router(seeds.router)
app.include_router(grows.router)
app.include_router(search.router)


@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@app.get("/")
async def root():
    return {
        "app": "Cannabis Grow & Seed Tracker",
        "version": "0.1.0",
        "docs": "http://localhost:8000/docs",
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


frontend_dist = Path(__file__).resolve().parent.parent / "frontend-dist"
if frontend_dist.is_dir():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
