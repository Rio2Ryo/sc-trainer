"""同梱教材（ビルド時に生成した index.json）を DB に投入する。

scripts/build_materials.py が frontend/public/materials/ に
  ipa/*.pdf, pages/<stem>/pNNN.jpg, md/<stem>.md, index.json
を出力する。Vercel では起動時にこれを読んで kamoku_b_question を揃える。
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from ..config import MATERIALS_DIR
from ..db import get_db
from .build_index import upsert


def bundled_index() -> Path:
    return MATERIALS_DIR / "index.json"


def public_base_url() -> str | None:
    """Vercel 上の自分自身の URL。関数バンドルに教材が無いとき、静的配信側から読むのに使う。"""
    host = os.environ.get("VERCEL_PROJECT_PRODUCTION_URL") or os.environ.get("VERCEL_URL")
    return f"https://{host}/materials" if host else None


def fetch_public(rel: str) -> bytes | None:
    base = public_base_url()
    if not base:
        return None
    try:
        import requests

        r = requests.get(f"{base}/{rel}", timeout=60)
        if r.ok:
            return r.content
    except Exception:
        pass
    return None


def read_material(path: str | Path) -> bytes | None:
    """同梱ファイルを読む。ローカルに無ければ自分の静的配信から取る。"""
    p = Path(path)
    if p.exists():
        return p.read_bytes()
    try:
        rel = p.relative_to(MATERIALS_DIR)
    except ValueError:
        return None
    return fetch_public(str(rel).replace(os.sep, "/"))


def _load_index() -> list[dict] | None:
    idx = bundled_index()
    if idx.exists():
        return json.loads(idx.read_text(encoding="utf-8"))
    raw = fetch_public("index.json")
    return json.loads(raw.decode("utf-8")) if raw else None


def page_count(exam: str) -> int | None:
    """index.json に記録した問題 PDF のページ数（ページ画像ディレクトリが手元に無いときに使う）。"""
    items = _load_index() or []
    for it in items:
        if it["exam"] == exam:
            return it.get("_pages")
    return None


def seed_from_bundle(force: bool = False) -> int:
    items = _load_index()
    if not items:
        return 0
    with get_db() as conn:
        n = conn.execute("SELECT COUNT(*) FROM kamoku_b_question").fetchone()[0]
    if n >= len(items) and not force:
        return 0
    # index.json のパスは materials/ からの相対。絶対に直す
    for it in items:
        it["qs_pdf"] = str(MATERIALS_DIR / it["qs_pdf"])
        it["qs_pages"] = str(MATERIALS_DIR / it["qs_pages"]) if it.get("qs_pages") else None
    return upsert(items)
