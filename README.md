# SC Trainer

情報処理安全確保支援士試験（SC）合格のための個人用学習アプリ。設計は [DESIGN.md](DESIGN.md)。

現在の実装範囲は DESIGN.md §9 の **MVP（1〜7）** のみ。Phase 2（誤答記録・FSRS復習・カード生成）は MVP を1週間使ってから着手する。

## 起動

```bash
# 1. バックエンド
pip install -r requirements.txt
cp .env.example .env            # ANTHROPIC_API_KEY を書く
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload

# 2. フロント（別ターミナル）
cd frontend && npm install && npm run dev   # http://127.0.0.1:5173
```

## 初回セットアップ

ダッシュボードの「IPA 過去問を取得して索引を作る」を押す（または `POST /api/materials/fetch-ipa`）。約45ファイルを `data/ipa/` に取得し、続けて次を行う。

- 問題 PDF（テキスト層なし）→ `data/pages/<pdf名>/pNNN.png` にページ画像化（200dpi）
- 解答例・採点講評 PDF（テキスト層あり）→ Markdown 化
- 採点講評の「問N では，〜について出題した。」からテーマ索引を生成し `kamoku_b_question` に投入

取得済み PDF から索引だけ作り直すときは `POST /api/materials/build-index`。

CLI からも実行できる：

```bash
python -m backend.services.fetch_ipa
python -m backend.services.build_index
python -m backend.services.ingest data/books/xxx.pdf
```

## 学習ループ（科目B）

1. `/kamoku-b` で問を選ぶ → 3ペイン画面（問題画像 / 設問ごとの答案 / Mermaid 構成図）。150分タイマー
2. 「答案を確定する」→ この時点で初めて解答例・講評 API が 200 を返す（それまでは **サーバ側で 404**）
3. 「AI 採点を実行」→ 設問ごとの ○△× と「次回まで直す1点」。再発した癖は `weakness` に加算される
4. ダッシュボードで残日数・進捗・次に直す1点を見る

## 約束事（DESIGN.md §0 / §7）

- `data/` は `.gitignore` 済み。**教材 PDF・DB・ページ画像を絶対にコミットしない**
- `.env` も `.gitignore` 済み
- localhost のみにバインド。デプロイしない
- AI は採点者としてのみ使う。答えを出させない。予想問題を作らせない

## 備考

- 問題 PDF は 1 回分 4 問が 1 ファイルなので、演習画面では全ページを表示する。対象の問までスクロールして読む
- 採点時は問題 PDF 全体を API に送っている。コストが上振れしたら該当ページだけ送る最適化を入れる余地がある（DESIGN.md §8）
- 採点モデルは `.env` の `SC_GRADER_MODEL` で差し替え可能（既定 `claude-sonnet-4-6`）
