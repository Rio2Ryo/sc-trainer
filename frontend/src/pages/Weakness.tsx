import { useEffect, useState } from "react";
import { api } from "../api";

type W = { id: number; label: string; count: number; last_seen: string | null; resolved: boolean };

export default function Weakness() {
  const [ws, setWs] = useState<W[]>([]);
  useEffect(() => { api.weakness().then(setWs).catch(() => {}); }, []);
  const open = ws.filter((w) => !w.resolved);
  const done = ws.filter((w) => w.resolved);
  const Row = ({ w }: { w: W }) => (
    <tr className="border-t"><td className="px-3 py-1">{w.label}</td><td className="px-3 py-1 text-right">{w.count}</td>
      <td className="px-3 py-1 text-neutral-500 text-xs">{w.last_seen?.slice(0, 10) ?? "—"}</td></tr>
  );
  return (
    <main className="max-w-3xl mx-auto p-4 space-y-4 text-sm">
      <h1 className="text-lg font-bold">弱点（count 降順）</h1>
      <table className="w-full bg-white border"><tbody>{open.map((w) => <Row key={w.id} w={w} />)}</tbody></table>
      {done.length > 0 && (<>
        <h2 className="font-semibold text-neutral-500">解消済み（3回連続で再発なし）</h2>
        <table className="w-full bg-white border opacity-60"><tbody>{done.map((w) => <Row key={w.id} w={w} />)}</tbody></table>
      </>)}
    </main>
  );
}
