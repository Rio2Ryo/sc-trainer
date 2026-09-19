"""科目B 演習・採点 API（DESIGN.md §5.5〜5.7, §6）。

模範解答は attempt.revealed=1 になるまでサーバ側で 404 を返す。フロント制御だけにしない。
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from ..config import PUBLIC_MATERIALS_BASE
from ..db import get_db
from ..models import AttemptIn, AttemptOut, GradeOut, QuestionOut
from ..services.grader import grade_attempt
from ..services.materials import page_count

router = APIRouter(prefix="/api/kamoku-b", tags=["kamoku-b"])


def _s(v) -> str | None:
    return None if v is None else str(v)


def _row_to_attempt(r) -> AttemptOut:
    return AttemptOut(
        id=r["id"],
        question_id=r["question_id"],
        body=json.loads(r["body"]),
        diagram_mmd=r["diagram_mmd"],
        minutes=r["minutes"],
        submitted_at=_s(r["submitted_at"]),
        revealed=bool(r["revealed"]),
    )


@router.get("/questions", response_model=list[QuestionOut])
def list_questions():
    with get_db() as conn:
        rows = conn.execute(
            """SELECT q.id, q.exam, q.qno, q.theme, q.qs_pages,
                      COUNT(a.id) AS attempts, MAX(g.score_pct) AS best_score
               FROM kamoku_b_question q
               LEFT JOIN attempt a ON a.question_id=q.id AND a.revealed=TRUE
               LEFT JOIN grade g ON g.attempt_id=a.id
               GROUP BY q.id, q.exam, q.qno, q.theme, q.qs_pages ORDER BY q.exam DESC, q.qno"""
        ).fetchall()
    return [
        QuestionOut(
            id=r["id"], exam=r["exam"], qno=r["qno"], theme=r["theme"],
            has_pages=bool(r["qs_pages"] and (Path(r["qs_pages"]).exists() or PUBLIC_MATERIALS_BASE)),
            attempts=r["attempts"], best_score=r["best_score"],
        )
        for r in rows
    ]


@router.get("/by-exam/{exam}/{qno}")
def by_exam(exam: str, qno: int) -> dict:
    with get_db() as conn:
        r = conn.execute("SELECT id, exam, qno, theme FROM kamoku_b_question WHERE exam=? AND qno=?", (exam, qno)).fetchone()
    if not r:
        raise HTTPException(404, "question not found")
    return dict(r)


def _get_question(conn, qid: int):
    q = conn.execute("SELECT * FROM kamoku_b_question WHERE id=?", (qid,)).fetchone()
    if not q:
        raise HTTPException(404, "question not found")
    return q


@router.get("/{qid}/pages")
def pages(qid: int) -> list[str]:
    """問題のページ画像 URL 配列。"""
    with get_db() as conn:
        q = _get_question(conn, qid)
    d = Path(q["qs_pages"]) if q["qs_pages"] else None
    if not d:
        return []
    if d.exists():
        names = sorted(p.name for p in d.iterdir() if p.suffix in (".png", ".jpg"))
    else:
        names = [f"p{i:03d}.jpg" for i in range(1, (page_count(q["exam"]) or 0) + 1)]
    if PUBLIC_MATERIALS_BASE:
        # ビルド時に同梱した静的ファイルを直接配信（Vercel）
        return [f"{PUBLIC_MATERIALS_BASE}/pages/{d.name}/{n}" for n in names]
    return [f"/api/kamoku-b/{qid}/pages/{n}" for n in names]


@router.get("/{qid}/pages/{name}")
def page_image(qid: int, name: str):
    if "/" in name or ".." in name or not name.endswith((".png", ".jpg")):
        raise HTTPException(400, "bad name")
    with get_db() as conn:
        q = _get_question(conn, qid)
    p = Path(q["qs_pages"]) / name
    if not p.exists():
        raise HTTPException(404, "page not found")
    return FileResponse(p, media_type="image/jpeg" if name.endswith(".jpg") else "image/png")


@router.post("/{qid}/attempt", response_model=AttemptOut)
def submit_attempt(qid: int, body: AttemptIn):
    """答案を確定する。確定と同時に revealed=1 となり、解答例が開けるようになる。"""
    if not any(v.strip() for v in body.body.values()):
        raise HTTPException(400, "答案が空です。書いてから確定してください")
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        _get_question(conn, qid)
        new_id = conn.insert(
            "INSERT INTO attempt(question_id, body, diagram_mmd, minutes, submitted_at, revealed) VALUES (?,?,?,?,?,TRUE)",
            (qid, json.dumps(body.body, ensure_ascii=False), body.diagram_mmd, body.minutes, now),
        )
        r = conn.execute("SELECT * FROM attempt WHERE id=?", (new_id,)).fetchone()
    return _row_to_attempt(r)


@router.get("/{qid}/attempts", response_model=list[AttemptOut])
def list_attempts(qid: int):
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM attempt WHERE question_id=? ORDER BY id DESC", (qid,)).fetchall()
    return [_row_to_attempt(r) for r in rows]


@router.get("/{qid}/answer")
def answer(qid: int) -> dict:
    """解答例＋講評。確定済み答案（revealed=1）が1件もなければ 404。サーバ側で塞ぐ。"""
    with get_db() as conn:
        q = _get_question(conn, qid)
        ok = conn.execute(
            "SELECT 1 FROM attempt WHERE question_id=? AND revealed=TRUE LIMIT 1", (qid,)
        ).fetchone()
    if not ok:
        raise HTTPException(404, "答案を確定するまで解答例は開けません")
    return {"exam": q["exam"], "qno": q["qno"], "ans_md": q["ans_md"], "cmnt_md": q["cmnt_md"]}


@router.post("/attempt/{attempt_id}/grade")
def grade(attempt_id: int) -> dict:
    try:
        return grade_attempt(attempt_id)
    except LookupError:
        raise HTTPException(404, "attempt not found")
    except PermissionError as e:
        raise HTTPException(403, str(e))
    except Exception as e:  # API エラー等はそのまま見せる
        raise HTTPException(502, f"採点に失敗しました: {e}")


@router.get("/attempt/{attempt_id}/grade", response_model=list[GradeOut])
def get_grades(attempt_id: int):
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM grade WHERE attempt_id=? ORDER BY id DESC", (attempt_id,)).fetchall()
    return [
        GradeOut(id=r["id"], attempt_id=r["attempt_id"], detail=json.loads(r["detail"]),
                 score_pct=r["score_pct"], next_fix=r["next_fix"], graded_at=str(r["graded_at"]))
        for r in rows
    ]
