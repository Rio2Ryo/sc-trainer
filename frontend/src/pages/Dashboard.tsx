import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, Dashboard as D } from "../api";

// DESIGN.md §5.1: 数字の羅列で十分。グラフは作らない。
export default function Dashboard() {
  const [d, setD] = useState<D | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => api.dashboard().then(setD).catch((e) => setErr(String(e)));
  useEffect(() => { load(); }, []);

  const fetchIpa = async () => {
    setBusy(true); setMsg("IPA から取得中（約45ファイル、数分かかります）…");
    try {
      const r = await api.fetchIpa();
      setMsg(JSON.stringify(r, null, 1).slice(0, 2000));
      load();
    } catch (e) { setMsg(String(e)); } finally { setBusy(false); }
  };

  if (err) return <p className="p-4 text-red-700">{err}</p>;
  if (!d) return <p className="p-4">読み込み中…</p>;

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-6">
      <section className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded border p-4">
          <div className="text-sm text-neutral-500">科目A まで</div>
          <div className="text-6xl font-bold">{d.days_to_a}<span className="text-xl ml-1">日</span></div>
        </div>
        <div className="bg-white rounded border p-4">
          <div className="text-sm text-neutral-500">科目B まで</div>
          <div className="text-6xl font-bold">{d.days_to_b}<span className="text-xl ml-1">日</span></div>
        </div>
      </section>

      <section className="bg-white rounded border p-4 space-y-1 text-sm">
        <div>今日の復習: <b>{d.review_due}</b> 枚（連続 {d.review_streak_days} 日）<span className="text-neutral-400 ml-2">※復習画面は Phase 2</span></div>
        <div>科目B: 演習済み <b>{d.kamoku_b.done}</b> / {d.kamoku_b.total} 問、平均得点率 <b>{d.kamoku_b.avg_score_pct ?? "—"}</b>%</div>
      </section>

      <section className="bg-white rounded border p-4">
        <div className="text-sm text-neutral-500 mb-1">次に直す1点</div>
        {d.next_fix ? (
          <div><span className="text-lg font-semibold">{d.next_fix.next_fix}</span>
            <span className="text-xs text-neutral-500 ml-2">{d.next_fix.exam} 問{d.next_fix.qno}</span></div>
        ) : <div className="text-neutral-400">まだ採点がありません</div>}
      </section>

      <section className="bg-white rounded border p-4">
        <div className="text-sm text-neutral-500 mb-1">再発中の癖</div>
        {d.top_weakness.length === 0 ? <div className="text-neutral-400">なし</div> : (
          <ol className="list-decimal ml-5">
            {d.top_weakness.map((w) => <li key={w.label}>{w.label} <span className="text-neutral-500">×{w.count}</span></li>)}
          </ol>
        )}
      </section>

      <section className="flex gap-3 items-center text-sm">
        <Link to="/kamoku-b" className="px-4 py-2 rounded bg-neutral-900 text-white">科目B 演習へ</Link>
        {d.kamoku_b.total === 0 && (
          <button disabled={busy} onClick={fetchIpa} className="px-4 py-2 rounded border bg-white disabled:opacity-50">
            IPA 過去問を取得して索引を作る
          </button>
        )}
      </section>
      {msg && <pre className="text-xs bg-neutral-100 p-2 rounded whitespace-pre-wrap">{msg}</pre>}
    </main>
  );
}
