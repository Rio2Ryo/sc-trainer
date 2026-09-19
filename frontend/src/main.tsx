import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import "./index.css";
import Dashboard from "./pages/Dashboard";
import KamokuBList from "./pages/KamokuBList";
import KamokuB from "./pages/KamokuB";
import Grade from "./pages/Grade";
import Weakness from "./pages/Weakness";

function Nav() {
  const cls = "px-3 py-1 rounded hover:bg-neutral-200";
  return (
    <nav className="flex gap-2 items-center px-4 py-2 border-b bg-white text-sm">
      <span className="font-bold mr-2">SC Trainer</span>
      <Link className={cls} to="/">ダッシュボード</Link>
      <Link className={cls} to="/kamoku-b">科目B</Link>
      <Link className={cls} to="/weakness">弱点</Link>
    </nav>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/kamoku-b" element={<KamokuBList />} />
        <Route path="/kamoku-b/:exam/:qno" element={<KamokuB />} />
        <Route path="/kamoku-b/:exam/:qno/grade/:attemptId" element={<Grade />} />
        <Route path="/weakness" element={<Weakness />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
