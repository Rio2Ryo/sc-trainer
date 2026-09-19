"""科目B 出題テーマ索引の自動生成（DESIGN.md §4.3）と kamoku_b_question への投入。

IPA のファイル名規約: {year}{season}_sc_{part}_{kind}.pdf
  year   : 2023r05 / 2024r06 / 2025r07
  season : h=春, a=秋
  part   : am2 / pm（現行形式の科目B）。pm1/pm2 は旧形式なので科目B対象外
  kind   : qs=問題, ans=解答例, cmnt=採点講評
採点講評冒頭の「問N では，〜について出題した。」を正規表現で抽出して theme にする。
"""
from __future__ import annotations

import re
from pathlib import Path

from ..config import IPA_DIR, PAGES_DIR
from ..db import get_db
from .ingest import ingest

FNAME_RE = re.compile(r"^(?P<year>\d{4}r\d{2})(?P<season>[ha])_sc_(?P<part>am2|pm|pm1|pm2)_(?P<kind>qs|ans|cmnt)\.pdf$", re.I)
ZEN2HAN = str.maketrans("０１２３４５６７８９", "0123456789")
THEME_RE = re.compile(r"問\s*(\d)\s*では[，,、]\s*(.+?)について出題した")


def exam_label(year: str, season: str) -> str:
    """2025r07 + a → 'R7秋'"""
    reiwa = int(year[-2:])
    return f"R{reiwa}{'秋' if season.lower() == 'a' else '春'}"


def parse_name(name: str) -> dict | None:
    m = FNAME_RE.match(name)
    if not m:
        return None
    d = m.groupdict()
    d["exam"] = exam_label(d["year"], d["season"])
    d["is_current_format"] = d["part"].lower() == "pm"
    return d


def extract_themes(cmnt_text: str) -> dict[int, str]:
    text = cmnt_text.translate(ZEN2HAN)
    # PDF 抽出は改行が多いので、行をつなげてから検索する
    flat = re.sub(r"[\r\n]+", "", text)
    themes: dict[int, str] = {}
    for m in THEME_RE.finditer(flat):
        qno = int(m.group(1))
        if 1 <= qno <= 4 and qno not in themes:
            themes[qno] = m.group(2).strip()
    return themes


def collect(ipa_dir: Path = IPA_DIR, pages_root: Path | None = None,
            dpi: int = 200, fmt: str = "png") -> list[dict]:
    """PDF 群から 20 問分のメタ（DB 非依存）を作る。ビルド時同梱と実行時投入の両方で使う。"""
    groups: dict[str, dict[str, Path]] = {}
    for pdf in sorted(ipa_dir.glob("*.pdf")):
        info = parse_name(pdf.name)
        if not info or not info["is_current_format"]:
            continue
        groups.setdefault(info["exam"], {})[info["kind"].lower()] = pdf

    items: list[dict] = []
    for exam, files in sorted(groups.items()):
        qs = files.get("qs")
        if not qs:
            continue
        qs_info = ingest(qs, kind="ipa", pages_root=pages_root, dpi=dpi, fmt=fmt)
        ans_md = cmnt_md = None
        themes: dict[int, str] = {}
        if "ans" in files:
            r = ingest(files["ans"], kind="ipa", pages_root=pages_root)
            if r.get("markdown"):
                ans_md = Path(r["markdown"]).read_text(encoding="utf-8")
        if "cmnt" in files:
            r = ingest(files["cmnt"], kind="ipa", pages_root=pages_root)
            if r.get("markdown"):
                cmnt_md = Path(r["markdown"]).read_text(encoding="utf-8")
                themes = extract_themes(cmnt_md)
        for qno in range(1, 5):
            items.append({
                "exam": exam, "qno": qno, "theme": themes.get(qno),
                "qs_pdf": str(qs), "qs_pages": qs_info.get("pages_dir"),
                "ans_md": ans_md, "cmnt_md": cmnt_md,
                "_qs_kind": qs_info["kind"], "_pages": qs_info.get("page_count"),
            })
    return items


def upsert(items: list[dict]) -> int:
    """メタを kamoku_b_question に投入する（既存は更新）。"""
    n = 0
    with get_db() as conn:
        for it in items:
            conn.execute(
                """INSERT INTO kamoku_b_question(exam, qno, theme, qs_pdf, qs_pages, ans_md, cmnt_md)
                   VALUES (?,?,?,?,?,?,?)
                   ON CONFLICT(exam, qno) DO UPDATE SET
                     theme=excluded.theme, qs_pdf=excluded.qs_pdf, qs_pages=excluded.qs_pages,
                     ans_md=excluded.ans_md, cmnt_md=excluded.cmnt_md""",
                (it["exam"], it["qno"], it["theme"], it["qs_pdf"], it["qs_pages"], it["ans_md"], it["cmnt_md"]),
            )
            n += 1
    return n


def build(ipa_dir: Path = IPA_DIR) -> dict:
    """ローカル用：data/ipa の PDF を data/pages に変換して DB に投入。"""
    items = collect(ipa_dir)
    n = upsert(items)
    report: dict[str, dict] = {}
    for it in items:
        rep = report.setdefault(it["exam"], {"qs_kind": it["_qs_kind"], "pages": it["_pages"], "themes": {},
                                             "has_ans": it["ans_md"] is not None, "has_cmnt": it["cmnt_md"] is not None})
        if it["theme"]:
            rep["themes"][it["qno"]] = it["theme"]
    return {"questions_upserted": n, "exams": report}


if __name__ == "__main__":
    import json

    print(json.dumps(build(), ensure_ascii=False, indent=2))
