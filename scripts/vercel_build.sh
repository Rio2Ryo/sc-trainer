#!/usr/bin/env bash
# Vercel の buildCommand。教材の同梱生成 → フロントのビルド。失敗箇所が分かるよう逐一ログを出す。
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== python"
PY=$(command -v python3.12 || command -v python3 || command -v python)
"$PY" --version
"$PY" -m pip --version || "$PY" -m ensurepip --upgrade

echo "== pip install (build deps)"
"$PY" -m pip install --quiet --disable-pip-version-check pymupdf requests beautifulsoup4 python-dotenv pydantic fastapi

echo "== build materials (IPA から取得→ページ画像→索引)"
"$PY" scripts/build_materials.py

echo "== frontend build"
cd frontend && npm run build
echo "== done"
