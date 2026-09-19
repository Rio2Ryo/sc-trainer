import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "neutral" });
let seq = 0;

export default function MermaidPreview({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      if (!code.trim()) { if (ref.current) ref.current.innerHTML = ""; setErr(""); return; }
      try {
        const { svg } = await mermaid.render(`mmd-${++seq}`, code);
        if (alive && ref.current) { ref.current.innerHTML = svg; setErr(""); }
      } catch (e) {
        if (alive) setErr(String((e as Error).message ?? e));
      }
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [code]);
  return (
    <div>
      {err && <pre className="text-xs text-red-700 whitespace-pre-wrap">{err}</pre>}
      <div ref={ref} className="overflow-auto" />
    </div>
  );
}
