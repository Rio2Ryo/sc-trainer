"""PDF のテキスト層判定と変換（DESIGN.md §4.2）。

- 最大20ページをサンプリングし、120文字以上のページが50%以上なら text、未満なら image
- text  → ページ区切り付き Markdown。埋め込み画像は 200px 以上のみ PNG 出力
- image → 200dpi でページ全体を PNG 化
"""
from __future__ import annotations

import json
from pathlib import Path

import pymupdf as fitz

from ..config import PAGES_DIR

SAMPLE_PAGES = 20
MIN_CHARS_PER_PAGE = 120
TEXT_RATIO_THRESHOLD = 0.5
MIN_FIGURE_PX = 200
IMAGE_DPI = 200


def classify(pdf_path: Path) -> dict:
    doc = fitz.open(pdf_path)
    n = len(doc)
    if n == 0:
        return {"kind": "image", "pages": 0, "text_ratio": 0.0, "sampled": 0}
    step = max(1, n // SAMPLE_PAGES)
    idxs = list(range(0, n, step))[:SAMPLE_PAGES]
    hits = 0
    for i in idxs:
        chars = len(doc[i].get_text("text").strip())
        if chars >= MIN_CHARS_PER_PAGE:
            hits += 1
    ratio = hits / len(idxs)
    doc.close()
    return {
        "kind": "text" if ratio >= TEXT_RATIO_THRESHOLD else "image",
        "pages": n,
        "text_ratio": round(ratio, 2),
        "sampled": len(idxs),
    }


def to_markdown(pdf_path: Path, out_dir: Path) -> Path:
    """テキスト層のある PDF を <!-- p.N --> 区切りの Markdown にする。図表は PNG で別出力。"""
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(pdf_path)
    parts: list[str] = []
    fig_count = 0
    for i, page in enumerate(doc, start=1):
        parts.append(f"<!-- p.{i} -->\n")
        parts.append(page.get_text("text"))
        parts.append("\n")
        for img in page.get_images(full=True):
            xref = img[0]
            try:
                pix = fitz.Pixmap(doc, xref)
                if pix.width < MIN_FIGURE_PX or pix.height < MIN_FIGURE_PX:
                    continue
                if pix.n - pix.alpha >= 4:  # CMYK → RGB
                    pix = fitz.Pixmap(fitz.csRGB, pix)
                fig_count += 1
                fig = out_dir / f"fig_p{i}_{fig_count}.png"
                pix.save(fig)
                parts.append(f"![fig]({fig.name})\n")
            except Exception:
                continue
    doc.close()
    md_path = out_dir / (pdf_path.stem + ".md")
    md_path.write_text("".join(parts), encoding="utf-8")
    return md_path


def to_page_images(pdf_path: Path, out_dir: Path, dpi: int = IMAGE_DPI) -> list[Path]:
    """テキスト層のない PDF をページ画像にする。既に揃っていれば再生成しない。"""
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(pdf_path)
    paths: list[Path] = []
    zoom = dpi / 72
    mat = fitz.Matrix(zoom, zoom)
    for i, page in enumerate(doc, start=1):
        p = out_dir / f"p{i:03d}.png"
        if not p.exists():
            page.get_pixmap(matrix=mat, alpha=False).save(p)
        paths.append(p)
    doc.close()
    return paths


def ingest(pdf_path: Path, kind: str = "book") -> dict:
    """判定→変換。結果のメタを返す（DB への登録は build_index 側が担う）。"""
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        raise FileNotFoundError(pdf_path)
    info = classify(pdf_path)
    out_dir = PAGES_DIR / pdf_path.stem
    result = {"file": str(pdf_path), "kind_hint": kind, **info}
    if info["kind"] == "text":
        md = to_markdown(pdf_path, out_dir)
        result["markdown"] = str(md)
    else:
        pages = to_page_images(pdf_path, out_dir)
        result["pages_dir"] = str(out_dir)
        result["page_count"] = len(pages)
    (out_dir / "ingest.json").parent.mkdir(parents=True, exist_ok=True)
    (out_dir / "ingest.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result


if __name__ == "__main__":
    import sys

    print(json.dumps(ingest(Path(sys.argv[1])), ensure_ascii=False, indent=2))
