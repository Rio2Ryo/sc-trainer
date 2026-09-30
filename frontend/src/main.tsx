import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, NavLink, Route, Routes, useLocation } from "react-router-dom";
import "./index.css";
import Dashboard from "./pages/Dashboard";
import KamokuBList from "./pages/KamokuBList";
import KamokuB from "./pages/KamokuB";
import Grade from "./pages/Grade";
import Weakness from "./pages/Weakness";

const TABS = [
  { to: "/", label: "ホーム", icon: "⌂", end: true },
  { to: "/kamoku-b", label: "科目B", icon: "✎", end: false },
  { to: "/weakness", label: "弱点", icon: "⚑", end: false },
];

// スマホは画面下のタブバー、PC は上部のリンク。演習画面は専用のタブを持つので隠す。
function Shell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const inExercise = /^\/kamoku-b\/[^/]+\/\d+$/.test(pathname);
  return (
    <div className="min-h-dvh bg-neutral-50 text-neutral-900">
      {!inExercise && (
        <header className="sticky top-0 z-20 bg-neutral-900 text-white">
          <div className="max-w-3xl mx-auto flex items-center h-12 px-4">
            <span className="font-bold">SC Trainer</span>
            <nav className="hidden md:flex gap-1 ml-6 text-sm">
              {TABS.map((t) => (
                <NavLink key={t.to} to={t.to} end={t.end}
                  className={({ isActive }) => `px-3 py-1 rounded ${isActive ? "bg-white/20" : "hover:bg-white/10"}`}>
                  {t.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </header>
      )}
      <div className={inExercise ? "" : "pb-20 md:pb-6"}>{children}</div>
      {!inExercise && (
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t safe-bottom">
          <div className="grid grid-cols-3">
            {TABS.map((t) => (
              <NavLink key={t.to} to={t.to} end={t.end}
                className={({ isActive }) => `flex flex-col items-center py-2 text-xs ${isActive ? "text-neutral-900 font-bold" : "text-neutral-400"}`}>
                <span className="text-xl leading-none mb-0.5">{t.icon}</span>{t.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/kamoku-b" element={<KamokuBList />} />
          <Route path="/kamoku-b/:exam/:qno" element={<KamokuB />} />
          <Route path="/kamoku-b/:exam/:qno/grade/:attemptId" element={<Grade />} />
          <Route path="/weakness" element={<Weakness />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  </React.StrictMode>,
);
