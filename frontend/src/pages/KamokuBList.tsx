import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, Question } from "../api";

export default function KamokuBList() {
  const [qs, setQs] = useState<Question[] | null>(null);
  const [err, setErr] = useState("");
  const [diag, setDiag] = useState("");
  const [diagBusy, setDiagBusy] = useState(false);

  const load = () => {
    setErr(""); setQs(null);
    api.questions().then(setQs).catch((e) => setErr(String((e as Error).message ?? e)));
  };
  useEffect(load, []);

  const runDiag = async () => {
    setDiagBusy(true);
    try { setDiag(JSON.stringify(await api.diagnose(), null, 1)); }
    catch (e) { setDiag(String((e as Error).message ?? e)); }
    finally { setDiagBusy(false); }
  };

  if (err) return (
    <main className="max-w-3xl mx-auto p-4 space-y-3 text-sm">
      <h1 className="text-xl font-bold">科目B 過去問</h1>
      <div className="border border-red-400 bg-red-50 rounded p-3">
        <b>過去問を読み込めませんでした。</b>
        <pre className="whitespace-pre-wrap text-xs mt-2 max-h-64 overflow-auto">{err}</pre>
      </div>
      <div className="flex gap-2">
        <button onClick={load} className="px-3 py-1.5 rounded bg-neutral-900 text-white">再試行</button>
        <button onClick={runDiag} disabled={diagBusy} className="px-3 py-1.5 rounded border bg-white disabled:opacity-50">
          {diagBusy ? "診断中…" : "IPA への接続を診断"}
        </button>
      </div>
      {diag && <pre className="whitespace-pre-wrap text-xs bg-neutral-100 rounded p-2 max-h-[60vh] overflow-auto">{diag}</pre>}
      <p className="text-neutral-500">この画面のスクリーンショット（診断結果を含む）を送ってもらえれば原因を特定できます。</p>
    </main>
  );
  if (qs === null) return (
    <main className="max-w-3xl mx-auto p-4 text-sm">
      <h1 className="text-xl font-bold mb-2">科目B 過去問</h1>
      <p>読み込み中…　初回は IPA から過去問の索引を作るので 30 秒〜1 分かかります。</p>
    </main>
  );

  const byExam = qs.reduce<Record<string, Question[]>>((m, q) => ((m[q.exam] ??= []).push(q), m), {});

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold">科目B 過去問（{qs.length} 問）</h1>
      {Object.entries(byExam).map(([exam, list]) => (
        <section key={exam} className="bg-white rounded border">
          <div className="px-4 py-2 border-b font-semibold">{exam}</div>
          <table className="w-full text-sm">
            <tbody>
              {list.map((q) => (
                <tr key={q.id} className="border-b last:border-0">
                  <td className="px-4 py-2 w-14">問{q.qno}</td>
                  <td className="px-2 py-2">{q.theme ?? <span className="text-neutral-400">テーマ未抽出</span>}</td>
                  <td className="px-2 py-2 text-neutral-500 w-28">{q.attempts} 回 / 最高 {q.best_score ?? "—"}%</td>
                  <td className="px-2 py-2 w-24 text-right">
                    <Link className="underline" to={`/kamoku-b/${encodeURIComponent(exam)}/${q.qno}`}>演習</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </main>
  );
}
