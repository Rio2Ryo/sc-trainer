"""FastAPI エントリ。localhost のみ。認証なし。デプロイしない（DESIGN.md §7）。

起動:  uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
"""
from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import GRADER_MODEL
from .db import backend_name, init_db
from .routers import dashboard, kamoku_b, materials
from .services.materials import bundled_index, seed_from_bundle

app = FastAPI(title="SC Trainer", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# サーバレスではリクエスト前に必ずスキーマがある状態にしたいので import 時に初期化する
init_db()
seed_from_bundle()


app.include_router(dashboard.router)
app.include_router(kamoku_b.router)
app.include_router(materials.router)


@app.get("/api/health")
def health() -> dict:
    """設定の自己診断。ダッシュボードが未設定項目を警告するのに使う。"""
    on_vercel = bool(os.environ.get("VERCEL"))
    db = backend_name()
    return {
        "ok": True,
        "vercel": on_vercel,
        "db": db,
        "db_persistent": (db == "postgres") or not on_vercel,
        "has_api_key": bool(os.environ.get("ANTHROPIC_API_KEY")),
        "bundled_materials": bundled_index().exists(),
        "grader_model": GRADER_MODEL,
    }
