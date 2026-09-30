import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, GradeResult } from "../api";

// DESIGN.md §5.6: 確定後にだけ到達する画面。解答例は API 側で revealed を確認している。
export default function Grade() {
  const { exam = "", qno = "1", attemptId = "" } = useParams();
  const [qid, setQid] = useState<number | null>(null);
  const [answer, setAnswer] = useState<{ ans_md: string | null; cmnt_md: string | null } | null>(null);
  const [showAnswer, setShowAnswer] = useState<"" | "ans" | "cmnt">("");
  const [result, setResult] = useState<GradeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.byExam(exam, Number(qno)).then((q) => setQid(q.id)).catch((e) => setErr(String(e)));
    api.grades(Number(attemptId)).then((gs) => { if (gs[0]) setResult(gs[0].detail); }).catch(() => {});
  }, [exam, qno, attemptId]);

  const open = async (which: "ans" | "cmnt") => {
    if (showAnswer === which) { setShowAnswer(""); return; }
    if (!answer && qid != null) {
      try { setAnswer(await api.answer(qid)); } catch (e) { setErr(String((e as Error).message ?? e)); return; }
    }
    setShowAnswer(which);
  };

  const grade = async () => {
    setBusy(true); setErr("");
    try { setResult(await api.grade(Number(attemptId))); } catch (e) { setErr(String((e as Error).message ?? e)); } finally { setBusy(false); }
  };

  const markCls = (j: string) => j === "○" ? "bg-green-100 text-green-800" : j === "△" ? "bg-amber-100 text-amber-800" : j === "×" ? "bg-red-100 text-red-800" : "bg-neutral-100 text-neutral-600";
  const pct = result?.score_pct ?? null;

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/kamoku-b" className="text-sm text-neutral-500">‹ 一覧</Link>
        <h1 className="text-lg font-bold ml-1">{exam} 問{qno} 採点</h1>
      </div>

      <button onClick={grade} disabled={busy} className="w-full py-4 rounded-xl bg-neutral-900 text-white font-bold disabled:opacity-50">
        {busy ? "採点中…（1〜2分。画面を閉じないで）" : result ? "もう一度採点する" : "AI 採点を実行"}
      </button>
      {err && <p className="text-red-700 text-sm break-all">{err}</p>}

      {result && (
        <>
          {result.needs_confirmation && (
            <div className="border border-amber-300 bg-amber-50 rounded-xl p-3 text-sm"><b>確認が必要：</b>{result.needs_confirmation}</div>
          )}

          <section className="grid grid-cols-2 gap-3">
            <div className="bg-white border rounded-xl p-4">
              <div className="text-xs text-neutral-500">推定得点率</div>
              <div className={`text-4xl font-bold tabular-nums ${(pct ?? 0) >= 60 ? "text-green-700" : "text-red-700"}`}>{pct ?? "—"}<span className="text-base">%</span></div>
              <div className="text-xs text-neutral-400">合格ライン 60%</div>
            </div>
            <div className="bg-neutral-900 text-white rounded-xl p-4">
              <div className="text-xs text-neutral-400">次回まで直す1点</div>
              <div className="font-bold leading-snug mt-1">{result.next_fix}</div>
            </div>
          </section>

          {(result.recurring.length > 0 || result.new_weakness.length > 0) && (
            <section className="bg-white border rounded-xl p-4 space-y-2 text-sm">
              {result.recurring.map((r) => <div key={r} className="text-red-700"><b>再発</b>　{r}</div>)}
              {result.new_weakness.map((r) => <div key={r}><b>新規</b>　{r}</div>)}
            </section>
          )}

          <section className="space-y-3">
            {result.items.map((it, i) => (
              <article key={i} className="bg-white border rounded-xl p-4 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{it.設問}</span>
                  <span className={`px-2 py-0.5 rounded-full font-bold ${markCls(it.判定)}`}>{it.判定}</span>
                  <span className="ml-auto text-neutral-500 tabular-nums">{it.推定得点}</span>
                </div>
                <div><div className="text-xs text-neutral-400">自分の答案</div><div className="leading-relaxed">{it.自己答案 || "（空欄）"}</div></div>
                <div><div className="text-xs text-neutral-400">IPA 解答例</div><div className="leading-relaxed">{it.IPA解答例}</div></div>
                {it.減点理由 && <div className="text-red-700"><span className="text-xs text-neutral-400 block">減点理由</span>{it.減点理由}</div>}
                {it.採点講評 && it.採点講評 !== "言及なし" && <div className="text-neutral-600"><span className="text-xs text-neutral-400 block">採点講評</span>{it.採点講評}</div>}
              </article>
            ))}
          </section>
        </>
      )}

      <section className="grid grid-cols-2 gap-2">
        <button onClick={() => open("ans")} className={`py-3 rounded-xl border ${showAnswer === "ans" ? "bg-neutral-900 text-white" : "bg-white"}`}>IPA 解答例</button>
        <button onClick={() => open("cmnt")} className={`py-3 rounded-xl border ${showAnswer === "cmnt" ? "bg-neutral-900 text-white" : "bg-white"}`}>採点講評</button>
      </section>
      {showAnswer && (
        <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed bg-white border rounded-xl p-4 max-h-[70vh] overflow-auto">
          {((showAnswer === "ans" ? answer?.ans_md : answer?.cmnt_md) ?? "（なし）").replace(/<!-- p\.\d+ -->\n?/g, "")}
        </div>
      )}
    </main>
  );
}
