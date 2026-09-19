"""FastAPI エントリ。localhost のみ。認証なし。デプロイしない（DESIGN.md §7）。

起動:  uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import init_db
from .routers import dashboard, kamoku_b, materials

app = FastAPI(title="SC Trainer", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# サーバレスではリクエスト前に必ずスキーマがある状態にしたいので import 時に初期化する
init_db()


app.include_router(dashboard.router)
app.include_router(kamoku_b.router)
app.include_router(materials.router)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}
