"""Vercel Python Functions のエントリ。/api/* を FastAPI に流す（vercel.json の rewrites 参照）。"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.main import app  # noqa: E402,F401
