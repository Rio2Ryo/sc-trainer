"""ビルド時に IPA 過去問を取得し、静的同梱用の教材一式を生成する（Vercel の buildCommand から呼ぶ）。

出力: frontend/public/materials/
  ipa/<name>.pdf          問題・解答例・講評（IPA 公式の公開 PDF）
  pages/<stem>/pNNN.jpg   問題ページ画像（150dpi JPEG。配信サイズを抑える）
  index.json              kamoku_b_question に入れるメタ（パスは materials/ からの相対）

購入・自炊教材（data/books）は絶対に扱わない（DESIGN.md §0 原則4）。
"""
from __future__ import annotations

import json
import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from backend.services import fetch_ipa  # noqa: E402
from backend.services.build_index import collect  # noqa: E402

OUT = Path(os.environ.get("SC_MATERIALS_DIR", ROOT / "frontend" / "public" / "materials"))
IPA_OUT = OUT / "ipa"
PAGES_OUT = OUT / "pages"


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    IPA_OUT.mkdir(parents=True, exist_ok=True)
    fetch_ipa.IPA_DIR = IPA_OUT  # 取得先を同梱ディレクトリに向ける
    r = fetch_ipa.fetch_all()
    print(json.dumps({k: (len(v) if isinstance(v, list) else v) for k, v in r.items()}, ensure_ascii=False))
    if r["errors"]:
        print("fetch errors:", json.dumps(r["errors"], ensure_ascii=False)[:2000])

    items = collect(IPA_OUT, pages_root=PAGES_OUT, dpi=150, fmt="jpg")
    if not items:
        print("ERROR: 科目B の問題が1件も作れませんでした", file=sys.stderr)
        return 1
    for it in items:
        it["qs_pdf"] = str(Path(it["qs_pdf"]).relative_to(OUT))
        it["qs_pages"] = str(Path(it["qs_pages"]).relative_to(OUT)) if it.get("qs_pages") else None
    (OUT / "index.json").write_text(json.dumps(items, ensure_ascii=False), encoding="utf-8")
    # 解答例・講評の Markdown 化で出た図 PNG は不要なので削る（同梱サイズ削減）
    for p in PAGES_OUT.rglob("fig_*.png"):
        p.unlink()
    size = sum(p.stat().st_size for p in OUT.rglob("*") if p.is_file()) / 1e6
    exams = sorted({it["exam"] for it in items})
    print(f"materials: {len(items)} questions, exams={exams}, {size:.1f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
