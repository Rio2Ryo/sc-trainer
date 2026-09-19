"""パス・定数。data/ 配下は .gitignore 対象で、ローカル固定。"""
from __future__ import annotations

import os
from datetime import date
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

DATA_DIR = ROOT / "data"
IPA_DIR = DATA_DIR / "ipa"
BOOKS_DIR = DATA_DIR / "books"
PAGES_DIR = DATA_DIR / "pages"
DB_PATH = DATA_DIR / "sc.db"
PROMPTS_DIR = ROOT / "backend" / "prompts"

for _d in (DATA_DIR, IPA_DIR, BOOKS_DIR, PAGES_DIR):
    _d.mkdir(parents=True, exist_ok=True)

# 試験日程（DESIGN.md 冒頭）
EXAM_A_START = date(2026, 10, 17)
EXAM_B_START = date(2026, 11, 11)

# 科目B 本番: 150分で4問中2問 → 1問あたり75分
KAMOKU_B_TOTAL_MINUTES = 150

GRADER_MODEL = os.environ.get("SC_GRADER_MODEL", "claude-sonnet-4-6")

# IPA 年度別過去問ページ。現行形式（科目B統合後）は R5秋 以降
IPA_YEARS = ["2023r05", "2024r06", "2025r07"]
IPA_BASE = "https://www.ipa.go.jp"
IPA_INDEX = IPA_BASE + "/shiken/mondai-kaiotu/{year}.html"
