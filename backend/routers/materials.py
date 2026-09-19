"""教材取り込み API（DESIGN.md §6）。"""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException

from ..config import BOOKS_DIR, IPA_DIR
from ..models import IngestIn
from ..services import build_index, fetch_ipa, ingest

router = APIRouter(prefix="/api/materials", tags=["materials"])


@router.post("/fetch-ipa")
def fetch() -> dict:
    """IPA 過去問（約45ファイル）を data/ipa/ に取得し、続けて索引を組む。"""
    result = fetch_ipa.fetch_all()
    result["index"] = build_index.build()
    return result


@router.post("/build-index")
def rebuild_index() -> dict:
    """取得済み PDF から科目B索引だけを作り直す（オフラインでも可）。"""
    return build_index.build()


@router.post("/ingest")
def ingest_pdf(body: IngestIn) -> dict:
    """任意 PDF を判定→変換。パスは data/ 配下のみ受け付ける（教材はローカルから出さない）。"""
    p = Path(body.path)
    if not p.is_absolute():
        p = (BOOKS_DIR if body.kind == "book" else IPA_DIR) / p
    p = p.resolve()
    if not (str(p).startswith(str(BOOKS_DIR.resolve())) or str(p).startswith(str(IPA_DIR.resolve()))):
        raise HTTPException(400, "data/books または data/ipa 配下の PDF のみ受け付けます")
    if not p.exists():
        raise HTTPException(404, f"not found: {p}")
    return ingest.ingest(p, kind=body.kind)


@router.get("/status")
def status() -> dict:
    return {
        "ipa_pdfs": sorted(f.name for f in IPA_DIR.glob("*.pdf")),
        "book_pdfs": sorted(f.name for f in BOOKS_DIR.glob("*.pdf")),
    }
