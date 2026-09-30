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
    <main className="max-w-3xl mx-auto p-4 space-y-3">
      <h1 className="text-lg font-bold">科目B 過去問</h1>
      <div className="border border-red-300 bg-red-50 rounded-xl p-3 text-sm">
        <b>過去問を読み込めませんでした。</b>
        <pre className="whitespace-pre-wrap break-all text-xs mt-2 max-h-64 overflow-auto">{err}</pre>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={load} className="py-3 rounded-xl bg-neutral-900 text-white">再試行</button>
        <button onClick={runDiag} disabled={diagBusy} className="py-3 rounded-xl border bg-white disabled:opacity-50">
          {diagBusy ? "診断中…" : "接続を診断"}
        </button>
      </div>
      {diag && <pre className="whitespace-pre-wrap break-all text-xs bg-neutral-100 rounded-xl p-3 max-h-[60vh] overflow-auto">{diag}</pre>}
    </main>
  );
  if (qs === null) return (
    <main className="max-w-3xl mx-auto p-4">
      <h1 className="text-lg font-bold mb-2">科目B 過去問</h1>
      <p className="text-neutral-600">読み込み中…<br />初回は IPA から索引を作るので 30 秒〜1 分かかります。</p>
    </main>
  );

  const byExam = qs.reduce<Record<string, Question[]>>((m, q) => ((m[q.exam] ??= []).push(q), m), {});
  const done = qs.filter((q) => q.attempts > 0).length;

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-5">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-bold">科目B 過去問</h1>
        <span className="text-sm text-neutral-500">演習済み {done} / {qs.length}</span>
      </div>
      {Object.entries(byExam).map(([exam, list]) => (
        <section key={exam}>
          <h2 className="text-sm font-semibold text-neutral-500 mb-2 px-1">{exam}</h2>
          <ul className="space-y-2">
            {list.map((q) => (
              <li key={q.id}>
                <Link to={`/kamoku-b/${encodeURIComponent(exam)}/${q.qno}`}
                  className="block bg-white rounded-xl border p-4 active:bg-neutral-100">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold">問{q.qno}</span>
                    {q.attempts > 0 ? (
                      <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${(q.best_score ?? 0) >= 60 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                        {q.attempts}回・最高 {q.best_score ?? "—"}%
                      </span>
                    ) : (
                      <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500">未演習</span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-700 leading-relaxed">
                    {q.theme ?? <span className="text-neutral-400">テーマ未抽出</span>}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
