"""AI 採点（DESIGN.md §5.6 / §5.7）。

AI は採点者としてのみ使う。答えを出させない。予想問題も作らせない。
"""
from __future__ import annotations

import base64
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import anthropic

from ..config import GRADER_MODEL, PROMPTS_DIR
from ..db import get_db

MAX_PAGE_IMAGES = 40  # PDF が送れない場合のフォールバック上限


def _system_prompt() -> str:
    return (PROMPTS_DIR / "grade.md").read_text(encoding="utf-8")


def _known_weaknesses(conn) -> list[dict]:
    rows = conn.execute(
        "SELECT label, count, resolved FROM weakness ORDER BY resolved, count DESC"
    ).fetchall()
    return [dict(r) for r in rows]


def _question_block(q) -> dict:
    """問題 PDF を document ブロックにする。テキスト層がないので API 側で画像として読まれる。"""
    pdf = Path(q["qs_pdf"])
    data = base64.b64encode(pdf.read_bytes()).decode("ascii")
    return {
        "type": "document",
        "source": {"type": "base64", "media_type": "application/pdf", "data": data},
        "title": f"{q['exam']} 科目B 問題（問{q['qno']} を採点対象とする）",
    }


def _parse_json(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", text, re.S)
        if not m:
            raise
        return json.loads(m.group(0))


def build_user_content(q, attempt, known: list[dict]) -> list[dict]:
    body = json.loads(attempt["body"])
    answers = "\n".join(f"- {k}: {v}" for k, v in body.items()) or "（答案なし）"
    mmd = attempt["diagram_mmd"] or ""
    text = f"""# 採点対象
- 試験回: {q['exam']}
- 問番号: 問{q['qno']}
- テーマ: {q['theme'] or '不明'}
- 所要時間: {attempt['minutes'] if attempt['minutes'] is not None else '未記録'} 分（目安 75 分）

# 利用者の答案
{answers}

# 利用者が書き起こした構成図（Mermaid）
{mmd if mmd.strip() else '（未提出）'}

# 既知の癖（weakness）
{json.dumps(known, ensure_ascii=False)}

# IPA 解答例（全問分。問{q['qno']} の箇所を参照）
{q['ans_md'] or '（解答例なし。判定は保留にする）'}

# IPA 採点講評（全問分。問{q['qno']} の箇所を参照）
{q['cmnt_md'] or '（講評なし。「言及なし」と記す）'}

上記を DESIGN の制約に従って採点し、JSON のみを出力してください。"""
    return [_question_block(q), {"type": "text", "text": text}]


def grade_attempt(attempt_id: int) -> dict:
    with get_db() as conn:
        attempt = conn.execute("SELECT * FROM attempt WHERE id=?", (attempt_id,)).fetchone()
        if attempt is None:
            raise LookupError("attempt not found")
        if not attempt["revealed"]:
            raise PermissionError("答案を確定するまで採点できません")
        q = conn.execute("SELECT * FROM kamoku_b_question WHERE id=?", (attempt["question_id"],)).fetchone()
        known = _known_weaknesses(conn)

    client = anthropic.Anthropic()
    with client.messages.stream(
        model=GRADER_MODEL,
        max_tokens=8000,
        system=[{"type": "text", "text": _system_prompt(), "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": build_user_content(q, attempt, known)}],
    ) as stream:
        msg = stream.get_final_message()

    if msg.stop_reason == "refusal":
        raise RuntimeError("採点モデルが応答を拒否しました")
    text = "".join(b.text for b in msg.content if b.type == "text")
    result = _parse_json(text)

    usage = {
        "input_tokens": msg.usage.input_tokens,
        "output_tokens": msg.usage.output_tokens,
        "cache_read": getattr(msg.usage, "cache_read_input_tokens", None),
        "model": msg.model,
    }
    result["_usage"] = usage
    return _persist(attempt_id, result, known)


def _persist(attempt_id: int, result: dict, known: list[dict]) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    known_labels = {w["label"] for w in known}
    recurring = [l for l in result.get("recurring", []) if l in known_labels]
    new_w = [l for l in result.get("new_weakness", [])[:2] if l and l not in known_labels]
    result["recurring"] = recurring
    result["new_weakness"] = new_w
    next_fix = str(result.get("next_fix") or "").strip() or "（次回まで直す1点が返されませんでした）"
    score = result.get("score_pct")
    score = int(score) if isinstance(score, (int, float)) else None

    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO grade(attempt_id, detail, score_pct, next_fix) VALUES (?,?,?,?)",
            (attempt_id, json.dumps(result, ensure_ascii=False), score, next_fix),
        )
        grade_id = cur.lastrowid
        # 再発: count+1、resolved を戻す、連続クリーンをリセット
        for label in recurring:
            conn.execute(
                "UPDATE weakness SET count=count+1, last_seen=?, resolved=0, clean_streak=0 WHERE label=?",
                (now, label),
            )
        # 新規
        for label in new_w:
            conn.execute(
                "INSERT OR IGNORE INTO weakness(label, count, last_seen, resolved, clean_streak) VALUES (?,1,?,0,0)",
                (label, now),
            )
        # 再発しなかった既知の癖: 連続クリーン+1。3回連続で resolved
        if known_labels - set(recurring):
            placeholders = ",".join("?" * len(recurring)) if recurring else None
            sql = "UPDATE weakness SET clean_streak=clean_streak+1 WHERE resolved=0"
            params: list = []
            if recurring:
                sql += f" AND label NOT IN ({placeholders})"
                params = recurring
            conn.execute(sql, params)
            conn.execute("UPDATE weakness SET resolved=1 WHERE clean_streak>=3 AND resolved=0")
    result["grade_id"] = grade_id
    return result
