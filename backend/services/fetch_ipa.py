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

# 一部のサイトは独自 UA を弾くため、一般的なブラウザ UA に個人学習用である旨を添える
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/128.0 Safari/537.36 sc-trainer/0.2 (personal study)")
HEADERS = {"User-Agent": UA, "Accept": "text/html,application/pdf,*/*", "Accept-Language": "ja,en;q=0.8"}
PDF_HREF = re.compile(r"""["'(]([^"'()\s]+?\.pdf)(?:[?#][^"'()\s]*)?["')]""", re.IGNORECASE)
SLEEP_SEC = 0.5
PATTERN = re.compile(r"(_sc_|_am1_)", re.IGNORECASE)


def _all_pdf_hrefs(html: str, page_url: str) -> list[str]:
    hrefs: list[str] = []
    soup = BeautifulSoup(html, "html.parser")
    for a in soup.find_all("a", href=True):
        h = a["href"].split("#")[0].split("?")[0]
        if h.lower().endswith(".pdf"):
            hrefs.append(urljoin(page_url, h))
    # <a> 以外（JS やデータ属性）に書かれたリンクも拾う
    for m in PDF_HREF.finditer(html):
        hrefs.append(urljoin(page_url, m.group(1)))
    return hrefs


def list_pdf_links(year: str) -> list[str]:
    url = IPA_INDEX.format(year=year)
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    r.encoding = r.apparent_encoding or r.encoding
    links = [h for h in _all_pdf_hrefs(r.text, url) if PATTERN.search(h.rsplit("/", 1)[-1])]
    # 重複除去（順序維持）
    seen: set[str] = set()
    out = []
    for l in links:
        if l not in seen:
            seen.add(l)
            out.append(l)
    return out


def diagnose(years: list[str] | None = None) -> list[dict]:
    """年度ページごとに、取得できたか・PDF リンクが何本あったかを返す（Vercel 上の切り分け用）。"""
    out: list[dict] = []
    for year in years or IPA_YEARS:
        url = IPA_INDEX.format(year=year)
        row: dict = {"year": year, "url": url}
        try:
            r = requests.get(url, headers=HEADERS, timeout=30)
            row["status"] = r.status_code
            row["bytes"] = len(r.content)
            r.encoding = r.apparent_encoding or r.encoding
            hrefs = _all_pdf_hrefs(r.text, url)
            names = [h.rsplit("/", 1)[-1] for h in hrefs]
            row["pdf_links"] = len(hrefs)
            row["matched"] = sorted({n for n in names if PATTERN.search(n)})
            row["sample_pdf"] = sorted(set(names))[:15]
        except Exception as e:
            row["error"] = f"{type(e).__name__}: {e}"
        out.append(row)
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
                r = requests.get(url, headers=HEADERS, timeout=120)
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
