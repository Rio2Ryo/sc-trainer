import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import MermaidPreview from "../components/MermaidPreview";
import Timer from "../components/Timer";

// DESIGN.md §5.5: 問題 / 答案 / 図。スマホはタブで切り替え、PC(lg 以上)は 3 ペイン。
const TOTAL_MINUTES = 150;
const DEFAULT_FIELDS = ["設問1", "設問2", "設問3"];
type Field = { key: string; label: string; text: string };
type Tab = "q" | "a" | "d";

export default function KamokuB() {
  const { exam = "", qno = "1" } = useParams();
  const nav = useNavigate();
  const [qid, setQid] = useState<number | null>(null);
  const [theme, setTheme] = useState<string | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [fields, setFields] = useState<Field[]>(DEFAULT_FIELDS.map((l, i) => ({ key: `f${i}`, label: l, text: "" })));
  const [mmd, setMmd] = useState("graph LR\n  PC[利用者PC] --> FW[FW] --> Web[Webサーバ]\n");
  const [started, setStarted] = useState(() => Date.now());
  const [tab, setTab] = useState<Tab>("q");
  const [zoom, setZoom] = useState(1);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const draftKey = useMemo(() => `draft:${exam}:${qno}`, [exam, qno]);
  const loaded = useRef(false);

  useEffect(() => {
    api.byExam(exam, Number(qno))
      .then((q) => { setQid(q.id); setTheme(q.theme); return api.pages(q.id); })
      .then(setPages)
      .catch((e) => setErr(String((e as Error).message ?? e)));
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.fields) setFields(d.fields);
        if (d.mmd) setMmd(d.mmd);
        if (d.started) setStarted(d.started); // タイマーはリロードしても続きから
      }
    } catch { /* ignore */ }
    loaded.current = true;
  }, [exam, qno, draftKey]);

  // 下書きをブラウザ内に保持。確定したら消す。
  useEffect(() => {
    if (!loaded.current) return;
    try { localStorage.setItem(draftKey, JSON.stringify({ fields, mmd, started })); } catch { /* ignore */ }
  }, [fields, mmd, started, draftKey]);

  const update = (key: string, patch: Partial<Field>) =>
    setFields((fs) => fs.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  const addField = () => setFields((fs) => [...fs, { key: `f${Date.now()}`, label: `設問${fs.length + 1}`, text: "" }]);
  const removeField = (key: string) => setFields((fs) => fs.filter((f) => f.key !== key));
  const written = fields.filter((f) => f.text.trim()).length;

  const submit = async () => {
    if (qid == null) return;
    if (!written) { setTab("a"); setErr("答案が空です。書いてから確定してください"); return; }
    if (!confirm("答案を確定します。確定後は書き直せず、模範解答が開きます。よろしいですか？")) return;
    setBusy(true); setErr("");
    try {
      const body: Record<string, string> = {};
      for (const f of fields) if (f.label.trim()) body[f.label.trim()] = f.text;
      const minutes = Math.round((Date.now() - started) / 60000);
      const a = await api.submit(qid, body, mmd, minutes);
      try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
      nav(`/kamoku-b/${encodeURIComponent(exam)}/${qno}/grade/${a.id}`);
    } catch (e) { setErr(String((e as Error).message ?? e)); } finally { setBusy(false); }
  };

  const pane = (t: Tab) => `${tab === t ? "block" : "hidden"} lg:block min-h-0 overflow-y-auto`;

  return (
    <div className="h-dvh flex flex-col bg-neutral-50">
      {/* 上部：戻る・問番号・タイマー・確定 */}
      <header className="shrink-0 bg-neutral-900 text-white">
        <div className="flex items-center gap-2 px-3 h-12">
          <Link to="/kamoku-b" className="text-xl px-1" aria-label="一覧へ">‹</Link>
          <div className="min-w-0">
            <div className="font-bold leading-tight">{exam} 問{qno}</div>
            <div className="text-[11px] text-neutral-400 truncate leading-tight">{theme ?? ""}</div>
          </div>
          <span className="ml-auto shrink-0 text-base"><Timer startedAt={started} totalMinutes={TOTAL_MINUTES} /></span>
          <button disabled={busy || qid == null} onClick={submit}
            className="ml-2 shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg bg-white text-neutral-900 text-sm font-bold disabled:opacity-50">確定</button>
        </div>
      </header>
      {err && <p className="shrink-0 px-3 py-2 text-red-700 text-sm bg-red-50 break-all">{err}</p>}

      <div className="flex-1 min-h-0 lg:grid lg:grid-cols-[3fr_2fr_2fr]">
        {/* 問題：ページ画像を縦スクロール。＋−で拡大 */}
        <section className={`${pane("q")} h-full bg-neutral-300`}>
          <div className="sticky top-0 z-10 flex justify-end gap-2 p-2">
            <button onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))} className="w-9 h-9 rounded-full bg-white/90 shadow font-bold">−</button>
            <button onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} className="w-9 h-9 rounded-full bg-white/90 shadow font-bold">＋</button>
          </div>
          <div className="overflow-x-auto -mt-12 pb-4">
            <div style={{ width: `${zoom * 100}%` }} className="space-y-2 px-1">
              {pages.length === 0 && !err && <p className="text-sm text-neutral-700 p-4 pt-14">問題を IPA から取得中…（初回は 10〜30 秒）</p>}
              {pages.map((src, i) => (
                <img key={src} src={src} alt={`p.${i + 1}`} loading="lazy" className="w-full bg-white shadow" />
              ))}
            </div>
          </div>
        </section>

        {/* 答案：設問ごと＋文字数 */}
        <section className={`${pane("a")} h-full lg:border-l bg-white p-3 space-y-4`}>
          {fields.map((f) => (
            <div key={f.key}>
              <div className="flex items-center gap-2 mb-1">
                <input value={f.label} onChange={(e) => update(f.key, { label: e.target.value })}
                  className="border rounded-lg px-2 py-1 w-36 font-bold" />
                <span className={`ml-auto text-sm tabular-nums ${f.text.length > 40 ? "text-red-700 font-bold" : "text-neutral-500"}`}>{f.text.length}字</span>
                <button onClick={() => removeField(f.key)} className="w-8 h-8 text-neutral-400" aria-label="削除">×</button>
              </div>
              <textarea value={f.text} onChange={(e) => update(f.key, { text: e.target.value })} rows={4}
                className="w-full border rounded-lg p-3 leading-relaxed" spellCheck={false} />
            </div>
          ))}
          <button onClick={addField} className="w-full py-3 rounded-lg border border-dashed text-neutral-600">＋ 設問欄を追加</button>
          <p className="text-xs text-neutral-400">多くの設問は 20〜40 字。40 字を超えると赤くなる。設問名は「設問1(2)」のように書き換えられる。</p>
        </section>

        {/* 図：構成図を自分で Mermaid に書き起こす */}
        <section className={`${pane("d")} h-full lg:border-l bg-white p-3 space-y-2`}>
          <p className="text-xs text-neutral-500">構成図を自分で書き起こす（Mermaid）。図の読み込み自体が本番の練習。</p>
          <textarea value={mmd} onChange={(e) => setMmd(e.target.value)} rows={10}
            className="w-full border rounded-lg p-3 font-mono text-sm" spellCheck={false} autoCapitalize="off" autoCorrect="off" />
          <div className="border rounded-lg p-2 min-h-24 bg-neutral-50 overflow-x-auto">
            <MermaidPreview code={mmd} />
          </div>
        </section>
      </div>

      {/* スマホ下部タブ */}
      <nav className="lg:hidden shrink-0 grid grid-cols-3 bg-white border-t safe-bottom">
        {([["q", "問題", `${pages.length}p`], ["a", "答案", `${written}/${fields.length}`], ["d", "図", "Mermaid"]] as const).map(([k, label, sub]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`py-2 ${tab === k ? "text-neutral-900 font-bold border-t-2 border-neutral-900 -mt-px" : "text-neutral-400"}`}>
            <div className="text-sm">{label}</div>
            <div className="text-[10px]">{sub}</div>
          </button>
        ))}
      </nav>
    </div>
  );
}
