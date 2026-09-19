"""IPA 過去問の自動取得（DESIGN.md §4.1）。

年度別ページをスクレイプし、_sc_ または _am1_ を含む PDF を data/ipa/ に保存する。
既存ファイルはスキップ。各リクエスト間に 0.5 秒スリープ。
"""
from __future__ import annotations

import re
import time
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from ..config import IPA_BASE, IPA_DIR, IPA_INDEX, IPA_YEARS

UA = "sc-trainer/0.1 (personal study tool; single user; 0.5s delay between requests)"
SLEEP_SEC = 0.5
PATTERN = re.compile(r"(_sc_|_am1_)", re.IGNORECASE)


def list_pdf_links(year: str) -> list[str]:
    url = IPA_INDEX.format(year=year)
    r = requests.get(url, headers={"User-Agent": UA}, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    links: list[str] = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if not href.lower().endswith(".pdf"):
            continue
        if not PATTERN.search(href):
            continue
        links.append(urljoin(IPA_BASE, href))
    # 重複除去（順序維持）
    seen: set[str] = set()
    out = []
    for l in links:
        if l not in seen:
            seen.add(l)
            out.append(l)
    return out


def fetch_all(years: list[str] | None = None) -> dict:
    years = years or IPA_YEARS
    downloaded: list[str] = []
    skipped: list[str] = []
    errors: list[dict] = []
    for year in years:
        try:
            links = list_pdf_links(year)
        except Exception as e:  # ページ取得失敗はその年度だけ落とす
            errors.append({"year": year, "error": str(e)})
            continue
        time.sleep(SLEEP_SEC)
        for url in links:
            name = url.rsplit("/", 1)[-1]
            dest: Path = IPA_DIR / name
            if dest.exists() and dest.stat().st_size > 0:
                skipped.append(name)
                continue
            try:
                r = requests.get(url, headers={"User-Agent": UA}, timeout=120)
                r.raise_for_status()
                dest.write_bytes(r.content)
                downloaded.append(name)
            except Exception as e:
                errors.append({"file": name, "error": str(e)})
            time.sleep(SLEEP_SEC)
    return {
        "downloaded": downloaded,
        "skipped": skipped,
        "errors": errors,
        "total_in_dir": len(list(IPA_DIR.glob("*.pdf"))),
    }


if __name__ == "__main__":
    import json

    print(json.dumps(fetch_all(), ensure_ascii=False, indent=2))
