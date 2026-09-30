import { useEffect, useState } from "react";
import { api } from "../api";

type W = { id: number; label: string; count: number; last_seen: string | null; resolved: boolean };

export default function Weakness() {
  const [ws, setWs] = useState<W[]>([]);
  useEffect(() => { api.weakness().then(setWs).catch(() => {}); }, []);
  const open = ws.filter((w) => !w.resolved);
  const done = ws.filter((w) => w.resolved);
  const Card = ({ w }: { w: W }) => (
    <li className="bg-white rounded-xl border p-3 flex items-start gap-3">
      <span className={`shrink-0 w-10 h-10 rounded-full grid place-items-center font-bold ${w.count > 0 ? "bg-red-100 text-red-800" : "bg-neutral-100 text-neutral-400"}`}>
        {w.count}
      </span>
      <div className="min-w-0">
        <div className="text-sm leading-snug">{w.label}</div>
        <div className="text-xs text-neutral-400 mt-1">最終 {w.last_seen?.slice(0, 10) ?? "—"}</div>
      </div>
    </li>
  );
  return (
    <main className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-lg font-bold">弱点</h1>
      <p className="text-xs text-neutral-500">数字は再発回数。3 回連続で再発しなければ解消済みに移ります。</p>
      <ul className="space-y-2">{open.map((w) => <Card key={w.id} w={w} />)}</ul>
      {done.length > 0 && (<>
        <h2 className="text-sm font-semibold text-neutral-500 pt-2">解消済み</h2>
        <ul className="space-y-2 opacity-60">{done.map((w) => <Card key={w.id} w={w} />)}</ul>
      </>)}
    </main>
  );
}
