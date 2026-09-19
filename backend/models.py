"""Pydantic モデル（API の入出力）。"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class QuestionOut(BaseModel):
    id: int
    exam: str
    qno: int
    theme: str | None
    has_pages: bool
    attempts: int
    best_score: int | None


class AttemptIn(BaseModel):
    # {"設問1(1)": "...", ...}。設問名は利用者が画面で付ける
    body: dict[str, str] = Field(default_factory=dict)
    diagram_mmd: str | None = None
    minutes: int | None = None


class AttemptOut(BaseModel):
    id: int
    question_id: int
    body: dict[str, str]
    diagram_mmd: str | None
    minutes: int | None
    submitted_at: str | None
    revealed: bool


class GradeOut(BaseModel):
    id: int
    attempt_id: int
    detail: dict[str, Any]
    score_pct: int | None
    next_fix: str
    graded_at: str


class WeaknessOut(BaseModel):
    id: int
    label: str
    count: int
    last_seen: str | None
    resolved: bool


class IngestIn(BaseModel):
    path: str
    # 'ipa' | 'book'。book は引く用（全文検索は Phase 3 以降）
    kind: str = "book"
