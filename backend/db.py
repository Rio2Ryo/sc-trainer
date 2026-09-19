"""SQLite スキーマと接続。DESIGN.md §3 をそのまま実装する。"""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from typing import Iterator

from .config import DB_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS miss (
  id           INTEGER PRIMARY KEY,
  subject      TEXT NOT NULL,
  field        TEXT,
  question     TEXT NOT NULL,
  correct      TEXT NOT NULL,
  chose        TEXT,
  why          TEXT,
  source       TEXT,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS card (
  id           INTEGER PRIMARY KEY,
  miss_id      INTEGER REFERENCES miss(id) ON DELETE CASCADE,
  front        TEXT NOT NULL,
  back         TEXT,
  tags         TEXT,
  due          TIMESTAMP NOT NULL,
  stability    REAL,
  difficulty   REAL,
  state        INTEGER,
  step         INTEGER,
  last_review  TIMESTAMP
);

CREATE TABLE IF NOT EXISTS review_log (
  id          INTEGER PRIMARY KEY,
  card_id     INTEGER REFERENCES card(id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL,
  reviewed_at TIMESTAMP NOT NULL,
  elapsed_ms  INTEGER
);

CREATE TABLE IF NOT EXISTS kamoku_b_question (
  id          INTEGER PRIMARY KEY,
  exam        TEXT NOT NULL,
  qno         INTEGER NOT NULL,
  theme       TEXT,
  qs_pdf      TEXT NOT NULL,
  qs_pages    TEXT,
  ans_md      TEXT,
  cmnt_md     TEXT,
  UNIQUE(exam, qno)
);

CREATE TABLE IF NOT EXISTS attempt (
  id           INTEGER PRIMARY KEY,
  question_id  INTEGER REFERENCES kamoku_b_question(id),
  body         TEXT NOT NULL,
  diagram_mmd  TEXT,
  minutes      INTEGER,
  submitted_at TIMESTAMP,
  revealed     BOOLEAN DEFAULT 0
);

CREATE TABLE IF NOT EXISTS grade (
  id           INTEGER PRIMARY KEY,
  attempt_id   INTEGER REFERENCES attempt(id) ON DELETE CASCADE,
  detail       TEXT NOT NULL,
  score_pct    INTEGER,
  next_fix     TEXT NOT NULL,
  graded_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS weakness (
  id           INTEGER PRIMARY KEY,
  label        TEXT NOT NULL UNIQUE,
  count        INTEGER DEFAULT 1,
  last_seen    TIMESTAMP,
  resolved     BOOLEAN DEFAULT 0,
  clean_streak INTEGER DEFAULT 0
);
"""

# DESIGN.md §3 「weakness の初期データ（投入必須）」。空テーブルから始めない。
WEAKNESS_SEED = [
    "設問の語尾と答えの形が対応していない",
    "字数超過（多くの設問は20〜40字）",
    "開発プロセスを問われて運用プロセスの対策に逃げる",
    "問題文中の固有名詞を使わず一般名詞で答える",
    "攻撃手法名だけを書いて成立条件や影響を書かない",
]


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def get_db() -> Iterator[sqlite3.Connection]:
    conn = connect()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with get_db() as conn:
        conn.executescript(SCHEMA)
        for label in WEAKNESS_SEED:
            conn.execute(
                "INSERT OR IGNORE INTO weakness(label, count, last_seen) VALUES (?, 0, NULL)",
                (label,),
            )


if __name__ == "__main__":
    init_db()
    print(f"initialized {DB_PATH}")
