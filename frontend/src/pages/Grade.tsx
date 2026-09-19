import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, GradeResult } from "../api";

// DESIGN.md §5.6: 確定後にだけ到達する画面。解答例は API 側で revealed を確認している。
export default function Grade() {
  const { exam = "", qno = "1", attemptId = "" } = useParams();
  const [qid, setQid] = useState<number | null>(null);
  const [answer, setAnswer] = useState<{ ans_md: string | null; cmnt_md: string | null } | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.byExam(exam, Number(qno)).then((q) => setQid(q.id)).catch((e) => setErr(String(e)));
    api.grades(Number(attemptId)).then((gs) => { if (gs[0]) setResult(gs[0].detail); }).catch(() => {});
  }, [exam, qno, attemptId]);

  const loadAnswer = async () => {
    if (qid == null) return;
    try { setAnswer(await api.answer(qid)); setShowAnswer(true); } catch (e) { setErr(String(e)); }
  };

  const grade = async () => {
    setBusy(true); setErr("");
    try { setResult(await api.grade(Number(attemptId))); } catch (e) { setErr(String(e)); } finally { setBusy(false); }
  };

  const mark = (j: string) => j === "○" ? "text-green-700" : j === "△" ? "text-amber-700" : j === "×" ? "text-red-700" : "text-neutral-500";

  return (
    <main className="max-w-5xl mx-auto p-4 space-y-4">
      <header className="flex items-center gap-3">
        <h1 className="text-lg font-bold">{exam} 問{qno} 採点</h1>
        <Link to="/kamoku-b" className="text-sm underline text-neutral-600">一覧へ</Link>
        <span className="ml-auto" />
        <button onClick={grade} disabled={busy} className="px-4 py-1.5 rounded bg-neutral-900 text-white disabled:opacity-50">
          {busy ? "採点中…（1〜2分）" : result ? "再採点" : "AI 採点を実行"}
        </button>
      </header>
      {err && <p className="text-red-700 text-sm">{err}</p>}

      {result && (
        <section className="space-y-3">
          {result.needs_confirmation && (
            <div className="border border-amber-400 bg-amber-50 rounded p-3 text-sm">
              <b>確認が必要：</b>{result.needs_confirmation}
            </div>
          )}
          <table className="w-full text-sm bg-white border">
            <thead className="bg-neutral-100">
              <tr>{["設問", "自己答案", "IPA解答例", "判定", "推定得点", "減点理由", "採点講評"].map((h) => <th key={h} className="px-2 py-1 text-left font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {result.items.map((it, i) => (
                <tr key={i} className="border-t align-top">
                  <td className="px-2 py-1 whitespace-nowrap">{it.設問}</td>
                  <td className="px-2 py-1">{it.自己答案}</td>
                  <td className="px-2 py-1">{it.IPA解答例}</td>
                  <td className={`px-2 py-1 font-bold ${mark(it.判定)}`}>{it.判定}</td>
                  <td className="px-2 py-1 whitespace-nowrap">{it.推定得点}</td>
                  <td className="px-2 py-1">{it.減点理由}</td>
                  <td className="px-2 py-1 text-neutral-600">{it.採点講評}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-white border rounded p-3">
              <div className="text-neutral-500">推定得点率（合格ライン 60%）</div>
              <div className={`text-4xl font-bold ${(result.score_pct ?? 0) >= 60 ? "text-green-700" : "text-red-700"}`}>{result.score_pct ?? "—"}%</div>
            </div>
            <div className="bg-white border rounded p-3">
              <div className="text-neutral-500">次回まで直す1点</div>
              <div className="text-lg font-semibold">{result.next_fix}</div>
            </div>
            <div className="bg-white border rounded p-3">
              <div className="text-neutral-500">再発した癖</div>
              {result.recurring.length ? <ul className="list-disc ml-5">{result.recurring.map((r) => <li key={r} className="text-red-700">再発：{r}</li>)}</ul> : <div className="text-neutral-400">なし</div>}
            </div>
            <div className="bg-white border rounded p-3">
              <div className="text-neutral-500">新規の癖</div>
              {result.new_weakness.length ? <ul className="list-disc ml-5">{result.new_weakness.map((r) => <li key={r}>{r}</li>)}</ul> : <div className="text-neutral-400">なし</div>}
            </div>
          </div>
          {result._usage && <div className="text-xs text-neutral-400">usage: {JSON.stringify(result._usage)}</div>}
        </section>
      )}

      <section className="bg-white border rounded p-3 text-sm">
        {!showAnswer ? (
          <button onClick={loadAnswer} className="underline">IPA 解答例・採点講評を開く</button>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div><h2 className="font-semibold mb-1">解答例</h2><pre className="whitespace-pre-wrap text-xs max-h-[60vh] overflow-auto">{answer?.ans_md ?? "（なし）"}</pre></div>
            <div><h2 className="font-semibold mb-1">採点講評</h2><pre className="whitespace-pre-wrap text-xs max-h-[60vh] overflow-auto">{answer?.cmnt_md ?? "（なし）"}</pre></div>
          </div>
        )}
      </section>
    </main>
  );
}
