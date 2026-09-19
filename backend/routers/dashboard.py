"""ダッシュボード・弱点一覧（DESIGN.md §5.1, §5.8）。グラフは作らない。"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter

from ..config import EXAM_A_START, EXAM_B_START
from ..db import get_db
from ..models import WeaknessOut

router = APIRouter(prefix="/api", tags=["dashboard"])


def _review_streak(conn) -> int:
    days = {
        str(r[0])[:10]
        for r in conn.execute("SELECT reviewed_at FROM review_log").fetchall()
        if r[0]
    }
    if not days:
        return 0
    today = date.today()
    d = today if today.isoformat() in days else today - timedelta(days=1)
    streak = 0
    while d.isoformat() in days:
        streak += 1
        d -= timedelta(days=1)
    return streak


@router.get("/dashboard")
def dashboard() -> dict:
    today = date.today()
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        due = conn.execute("SELECT COUNT(*) FROM card WHERE due <= ?", (now,)).fetchone()[0]
        total_q = conn.execute("SELECT COUNT(*) FROM kamoku_b_question").fetchone()[0]
        done_q = conn.execute(
            "SELECT COUNT(DISTINCT question_id) FROM attempt WHERE revealed=TRUE"
        ).fetchone()[0]
        avg = conn.execute("SELECT AVG(score_pct) FROM grade WHERE score_pct IS NOT NULL").fetchone()[0]
        top = conn.execute(
            "SELECT label, count FROM weakness WHERE resolved=FALSE AND count>0 ORDER BY count DESC, last_seen DESC LIMIT 3"
        ).fetchall()
        last = conn.execute(
            "SELECT g.next_fix, g.graded_at, q.exam, q.qno FROM grade g "
            "JOIN attempt a ON a.id=g.attempt_id JOIN kamoku_b_question q ON q.id=a.question_id "
            "ORDER BY g.id DESC LIMIT 1"
        ).fetchone()
        streak = _review_streak(conn)
    return {
        "today": today.isoformat(),
        "days_to_a": (EXAM_A_START - today).days,
        "days_to_b": (EXAM_B_START - today).days,
        "review_due": due,
        "review_streak_days": streak,
        "kamoku_b": {"total": total_q, "done": done_q, "avg_score_pct": round(avg) if avg is not None else None},
        "top_weakness": [dict(r) for r in top],
        "next_fix": {**dict(last), "graded_at": str(last["graded_at"])} if last else None,
    }


@router.get("/weakness", response_model=list[WeaknessOut])
def weakness():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, label, count, last_seen, resolved FROM weakness ORDER BY resolved, count DESC, last_seen DESC"
        ).fetchall()
    return [WeaknessOut(id=r["id"], label=r["label"], count=r["count"],
                        last_seen=None if r["last_seen"] is None else str(r["last_seen"]), resolved=bool(r["resolved"]))
            for r in rows]
