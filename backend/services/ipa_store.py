"""IPA 公式 PDF の遅延取得とページ描画。

Vercel（永続ディスクなし）でも動くように、必要な PDF だけを要求時に取得して /tmp（ローカルなら data/ipa）に置く。
リンク一覧（PDF 名 → URL）は DB の ipa_file に保存し、コールドスタート後も再スクレイプ不要にする。
"""
from __future__ import annotations

import io
from pathlib import Path

import pymupdf
import requests

from ..config import IPA_DIR, IPA_YEARS, PAGES_DIR
from ..db import get_db
from .build_index import parse_name
from .fetch_ipa import UA, list_pdf_links


def refresh_links(years: list[str] | None = None) -> dict:
    """年度別ページをスクレイプし、PDF 名 → URL を ipa_file に保存する。"""
    years = years or IPA_YEARS
    found: list[tuple[str, str, str | None, str | None]] = []
    errors: list[dict] = []
    for year in years:
        try:
            for url in list_pdf_links(year):
                name = url.rsplit("/", 1)[-1]
                info = parse_name(name)
                found.append((name, url, info["exam"] if info else None, info["kind"].lower() if info else None))
        except Exception as e:
            errors.append({"year": year, "error": str(e)})
    with get_db() as conn:
        for name, url, exam, kind in found:
            conn.execute(
                "INSERT INTO ipa_file(name, url, exam, kind) VALUES (?,?,?,?) "
                "ON CONFLICT(name) DO UPDATE SET url=excluded.url, exam=excluded.exam, kind=excluded.kind",
                (name, url, exam, kind),
            )
    return {"links": len(found), "errors": errors}


def known_url(name: str) -> str | None:
    with get_db() as conn:
        r = conn.execute("SELECT url FROM ipa_file WHERE name=?", (name,)).fetchone()
    return r["url"] if r else None


def ensure_pdf(name_or_path: str) -> Path:
    """PDF をローカルに用意して返す。無ければ IPA から取得する。"""
    p = Path(name_or_path)
    if p.is_absolute() and p.exists():
        return p
    name = p.name
    dest = IPA_DIR / name
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    url = known_url(name)
    if not url:
        refresh_links()
        url = known_url(name)
    if not url:
        raise FileNotFoundError(f"IPA のリンク一覧に {name} がありません")
    r = requests.get(url, headers={"User-Agent": UA}, timeout=120)
    r.raise_for_status()
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(r.content)
    return dest


def page_count(pdf: Path) -> int:
    with pymupdf.open(pdf) as doc:
        return len(doc)


def render_page(pdf: Path, page_no: int, dpi: int = 150, fmt: str = "jpg") -> bytes:
    """1 ページを画像にして返す（1 始まり）。描画結果はファイルにもキャッシュする。"""
    cache = PAGES_DIR / pdf.stem / f"p{page_no:03d}.{fmt}"
    if cache.exists():
        return cache.read_bytes()
    with pymupdf.open(pdf) as doc:
        if not 1 <= page_no <= len(doc):
            raise IndexError(page_no)
        zoom = dpi / 72
        pix = doc[page_no - 1].get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
        data = pix.tobytes("jpeg", jpg_quality=80) if fmt == "jpg" else pix.tobytes("png")
    try:
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_bytes(data)
    except OSError:
        pass
    return data


def extract_text(pdf: Path) -> str:
    """解答例・講評（テキスト層あり）を <!-- p.N --> 区切りのテキストにする。"""
    parts: list[str] = []
    with pymupdf.open(pdf) as doc:
        for i, page in enumerate(doc, start=1):
            parts.append(f"<!-- p.{i} -->\n{page.get_text('text')}\n")
    return "".join(parts)


def build_index_lazy() -> dict:
    """リンク一覧から現行形式（pm）の回を見つけ、解答例・講評だけ取得して kamoku_b_question を投入する。
    問題 PDF は演習画面を開いたときに取得する。"""
    from .build_index import extract_themes, upsert

    link_result = refresh_links()
    with get_db() as conn:
        rows = conn.execute("SELECT name, exam, kind FROM ipa_file WHERE exam IS NOT NULL").fetchall()
    groups: dict[str, dict[str, str]] = {}
    for r in rows:
        info = parse_name(r["name"])
        if info and info["is_current_format"]:
            groups.setdefault(r["exam"], {})[r["kind"]] = r["name"]
    items: list[dict] = []
    errors: list[dict] = []
    for exam, files in sorted(groups.items()):
        if "qs" not in files:
            continue
        ans_md = cmnt_md = None
        themes: dict[int, str] = {}
        try:
            if "ans" in files:
                ans_md = extract_text(ensure_pdf(files["ans"]))
            if "cmnt" in files:
                cmnt_md = extract_text(ensure_pdf(files["cmnt"]))
                themes = extract_themes(cmnt_md)
        except Exception as e:
            errors.append({"exam": exam, "error": str(e)})
        for qno in range(1, 5):
            items.append({"exam": exam, "qno": qno, "theme": themes.get(qno), "qs_pdf": files["qs"],
                          "qs_pages": None, "ans_md": ans_md, "cmnt_md": cmnt_md})
    n = upsert(items)
    return {"links": link_result, "exams": sorted(groups), "questions_upserted": n, "errors": errors}
