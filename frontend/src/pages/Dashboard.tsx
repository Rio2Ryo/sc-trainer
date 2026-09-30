import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, Dashboard as D, Health } from "../api";

// DESIGN.md §5.1: 数字の羅列で十分。グラフは作らない。
export default function Dashboard() {
  const [d, setD] = useState<D | null>(null);
  const [h, setH] = useState<Health | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.dashboard().then(setD).catch((e) => setErr(String(e)));
    api.health().then(setH).catch(() => {});
  }, []);

  if (err) return <p className="p-4 text-red-700">{err}</p>;
  if (!d) return <p className="p-4 text-neutral-500">読み込み中…</p>;

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-4">
      {h && !h.db_persistent && (
        <div className="border border-red-300 bg-red-50 rounded-xl p-3 text-sm leading-relaxed">
          <b>記録が保存されない設定です。</b>答案・採点・弱点はしばらくすると消えます。
          Vercel → Storage → <b>Neon</b> を追加して Redeploy してください。
        </div>
      )}
      {h && !h.has_api_key && (
        <div className="border border-amber-300 bg-amber-50 rounded-xl p-3 text-sm leading-relaxed">
          <b>AI 採点が使えません。</b>Vercel → Settings → Environment Variables に <code>ANTHROPIC_API_KEY</code> を追加して Redeploy してください。
        </div>
      )}

      <section className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-neutral-500">科目A まで</div>
          <div className="text-5xl font-bold tabular-nums">{d.days_to_a}<span className="text-base ml-1">日</span></div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-neutral-500">科目B まで</div>
          <div className="text-5xl font-bold tabular-nums">{d.days_to_b}<span className="text-base ml-1">日</span></div>
        </div>
      </section>

      <section className="bg-neutral-900 text-white rounded-xl p-4">
        <div className="text-xs text-neutral-400 mb-1">次に直す1点</div>
        {d.next_fix ? (
          <>
            <div className="text-lg font-bold leading-snug">{d.next_fix.next_fix}</div>
            <div className="text-xs text-neutral-400 mt-1">{d.next_fix.exam} 問{d.next_fix.qno} の採点より</div>
          </>
        ) : <div className="text-neutral-400">まだ採点がありません</div>}
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-neutral-500">科目B 演習済み</div>
          <div className="text-3xl font-bold tabular-nums">{d.kamoku_b.done}<span className="text-base text-neutral-400"> / {d.kamoku_b.total || 20}</span></div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-neutral-500">平均得点率（合格 60%）</div>
          <div className={`text-3xl font-bold tabular-nums ${d.kamoku_b.avg_score_pct == null ? "" : d.kamoku_b.avg_score_pct >= 60 ? "text-green-700" : "text-red-700"}`}>
            {d.kamoku_b.avg_score_pct ?? "—"}<span className="text-base">%</span>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-xl border p-4">
        <div className="text-xs text-neutral-500 mb-2">再発中の癖</div>
        {d.top_weakness.length === 0 ? <div className="text-neutral-400 text-sm">なし</div> : (
          <ol className="space-y-2">
            {d.top_weakness.map((w) => (
              <li key={w.label} className="flex gap-2 text-sm leading-snug">
                <span className="shrink-0 font-bold text-red-700">×{w.count}</span><span>{w.label}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <Link to="/kamoku-b" className="block text-center py-4 rounded-xl bg-neutral-900 text-white font-bold">科目B を演習する</Link>
    </main>
  );
}
