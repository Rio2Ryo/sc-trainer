import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import MermaidPreview from "../components/MermaidPreview";
import Timer from "../components/Timer";

// DESIGN.md §5.5: 3ペイン（問題ページ画像 / 設問ごとの答案 / Mermaid 図）。
// 本番は CBT なので画面で読む・キーボードで書くこと自体が練習になる。
const TOTAL_MINUTES = 150;
const DEFAULT_FIELDS = ["設問1", "設問2", "設問3"];

type Field = { key: string; label: string; text: string };

export default function KamokuB() {
  const { exam = "", qno = "1" } = useParams();
  const nav = useNavigate();
  const [qid, setQid] = useState<number | null>(null);
  const [theme, setTheme] = useState<string | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [fields, setFields] = useState<Field[]>(DEFAULT_FIELDS.map((l, i) => ({ key: `f${i}`, label: l, text: "" })));
  const [mmd, setMmd] = useState("graph LR\n  PC[利用者PC] --> FW[FW] --> Web[Webサーバ]\n");
  const [started] = useState(() => Date.now());
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const draftKey = useMemo(() => `draft:${exam}:${qno}`, [exam, qno]);

  useEffect(() => {
    api.byExam(exam, Number(qno))
      .then((q) => { setQid(q.id); setTheme(q.theme); return api.pages(q.id); })
      .then(setPages)
      .catch((e) => setErr(String(e)));
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) { const d = JSON.parse(raw); if (d.fields) setFields(d.fields); if (d.mmd) setMmd(d.mmd); }
    } catch { /* ignore */ }
  }, [exam, qno, draftKey]);

  // 下書きをブラウザ内に保持（ローカル限定）。確定したら消す。
  useEffect(() => {
    try { localStorage.setItem(draftKey, JSON.stringify({ fields, mmd })); } catch { /* ignore */ }
  }, [fields, mmd, draftKey]);

  const update = (key: string, patch: Partial<Field>) =>
    setFields((fs) => fs.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  const addField = () => setFields((fs) => [...fs, { key: `f${Date.now()}`, label: `設問${fs.length + 1}`, text: "" }]);
  const removeField = (key: string) => setFields((fs) => fs.filter((f) => f.key !== key));

  const submit = async () => {
    if (qid == null) return;
    if (!confirm("答案を確定します。確定後は書き直せず、模範解答が開きます。よろしいですか？")) return;
    setBusy(true); setErr("");
    try {
      const body: Record<string, string> = {};
      for (const f of fields) if (f.label.trim()) body[f.label.trim()] = f.text;
      const minutes = Math.round((Date.now() - started) / 60000);
      const a = await api.submit(qid, body, mmd, minutes);
      try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
      nav(`/kamoku-b/${encodeURIComponent(exam)}/${qno}/grade/${a.id}`);
    } catch (e) { setErr(String(e)); } finally { setBusy(false); }
  };

  return (
    <div className="h-[calc(100vh-41px)] flex flex-col">
      <header className="flex items-center gap-4 px-4 py-2 border-b bg-white text-sm">
        <span className="font-semibold">{exam} 問{qno}</span>
        <span className="text-neutral-500 truncate">{theme ?? ""}</span>
        <span className="ml-auto"><Timer startedAt={started} totalMinutes={TOTAL_MINUTES} /></span>
        <span className="text-neutral-400">（150分で2問。1問あたり75分が目安）</span>
        <button disabled={busy || qid == null} onClick={submit}
          className="px-4 py-1.5 rounded bg-neutral-900 text-white disabled:opacity-50">答案を確定する</button>
      </header>
      {err && <p className="px-4 py-1 text-red-700 text-sm">{err}</p>}

      <div className="flex-1 grid grid-cols-[3fr_2fr_2fr] min-h-0">
        {/* 問題ペイン: ページ画像を縦スクロール。印刷させない。 */}
        <section className="overflow-y-auto bg-neutral-200 p-2 space-y-2">
          {pages.length === 0 && <p className="text-sm text-neutral-600 p-2">ページ画像がありません。</p>}
          {pages.map((src, i) => (
            <img key={src} src={src} alt={`p.${i + 1}`} loading="lazy" className="w-full bg-white shadow" />
          ))}
        </section>

        {/* 答案ペイン: 設問ごとのテキストエリア＋文字数 */}
        <section className="overflow-y-auto border-l bg-white p-3 space-y-3">
          {fields.map((f) => (
            <div key={f.key}>
              <div className="flex items-center gap-2 text-sm">
                <input value={f.label} onChange={(e) => update(f.key, { label: e.target.value })}
                  className="border rounded px-2 py-0.5 w-32" />
                <span className={`ml-auto text-xs ${f.text.length > 40 ? "text-red-700" : "text-neutral-500"}`}>{f.text.length} 字</span>
                <button onClick={() => removeField(f.key)} className="text-xs text-neutral-400 hover:text-red-700">×</button>
              </div>
              <textarea value={f.text} onChange={(e) => update(f.key, { text: e.target.value })} rows={3}
                className="mt-1 w-full border rounded p-2 text-sm font-mono" spellCheck={false} />
            </div>
          ))}
          <button onClick={addField} className="text-sm underline text-neutral-600">＋ 設問欄を追加</button>
          <p className="text-xs text-neutral-400">多くの設問は 20〜40 字。40 字を超えると赤くなる。</p>
        </section>

        {/* 図ペイン: 構成図を自分で Mermaid に書き起こす。AI に図を解釈させない。 */}
        <section className="overflow-y-auto border-l bg-white p-3 flex flex-col gap-2">
          <div className="text-xs text-neutral-500">構成図を自分で書き起こす（Mermaid）。図の読み込み自体が本番の練習。</div>
          <textarea value={mmd} onChange={(e) => setMmd(e.target.value)} rows={12}
            className="w-full border rounded p-2 text-xs font-mono" spellCheck={false} />
          <div className="border rounded p-2 min-h-24 bg-neutral-50">
            <MermaidPreview code={mmd} />
          </div>
        </section>
      </div>
    </div>
  );
}
