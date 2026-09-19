import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, Question } from "../api";

export default function KamokuBList() {
  const [qs, setQs] = useState<Question[]>([]);
  const [err, setErr] = useState("");
  useEffect(() => { api.questions().then(setQs).catch((e) => setErr(String(e))); }, []);
  if (err) return <p className="p-4 text-red-700">{err}</p>;

  const byExam = qs.reduce<Record<string, Question[]>>((m, q) => ((m[q.exam] ??= []).push(q), m), {});

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold">科目B 過去問（{qs.length} 問）</h1>
      {qs.length === 0 && <p className="text-neutral-500">問題がありません。ダッシュボードから IPA 過去問を取得してください。</p>}
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
                    {q.has_pages ? <Link className="underline" to={`/kamoku-b/${encodeURIComponent(exam)}/${q.qno}`}>演習</Link>
                      : <span className="text-neutral-400">画像なし</span>}
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
