import { useEffect, useState } from "react";

// 150分カウントダウン。超過しても止めない（負の値で表示し続ける）。
export default function Timer({ startedAt, totalMinutes }: { startedAt: number; totalMinutes: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const remain = totalMinutes * 60 - Math.floor((now - startedAt) / 1000);
  const over = remain < 0;
  const abs = Math.abs(remain);
  const mm = String(Math.floor(abs / 60)).padStart(2, "0");
  const ss = String(abs % 60).padStart(2, "0");
  return (
    <span className={`font-mono text-lg ${over ? "text-red-700" : ""}`}>
      {over ? "超過 " : "残り "}{mm}:{ss}
    </span>
  );
}
