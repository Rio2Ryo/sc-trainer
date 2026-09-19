// バックエンド呼び出し。Vite の proxy 経由で localhost:8000 に届く。
export type Question = {
  id: number; exam: string; qno: number; theme: string | null;
  has_pages: boolean; attempts: number; best_score: number | null;
};
export type Attempt = {
  id: number; question_id: number; body: Record<string, string>;
  diagram_mmd: string | null; minutes: number | null; submitted_at: string | null; revealed: boolean;
};
export type GradeItem = {
  設問: string; 自己答案: string; IPA解答例: string; 判定: string; 推定得点: string; 減点理由: string; 採点講評: string;
};
export type GradeResult = {
  items: GradeItem[]; recurring: string[]; new_weakness: string[]; next_fix: string;
  score_pct: number | null; needs_confirmation?: string; grade_id?: number; _usage?: Record<string, unknown>;
};
export type Dashboard = {
  today: string; days_to_a: number; days_to_b: number; review_due: number; review_streak_days: number;
  kamoku_b: { total: number; done: number; avg_score_pct: number | null };
  top_weakness: { label: string; count: number }[];
  next_fix: { next_fix: string; graded_at: string; exam: string; qno: number } | null;
};

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, { headers: { "Content-Type": "application/json" }, ...init });
  if (!r.ok) {
    let msg = `${r.status}`;
    try { msg = (await r.json()).detail ?? msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return r.json();
}

export const api = {
  dashboard: () => req<Dashboard>("/api/dashboard"),
  questions: () => req<Question[]>("/api/kamoku-b/questions"),
  byExam: (exam: string, qno: number) => req<{ id: number; exam: string; qno: number; theme: string | null }>(`/api/kamoku-b/by-exam/${encodeURIComponent(exam)}/${qno}`),
  pages: (qid: number) => req<string[]>(`/api/kamoku-b/${qid}/pages`),
  attempts: (qid: number) => req<Attempt[]>(`/api/kamoku-b/${qid}/attempts`),
  submit: (qid: number, body: Record<string, string>, diagram_mmd: string, minutes: number) =>
    req<Attempt>(`/api/kamoku-b/${qid}/attempt`, { method: "POST", body: JSON.stringify({ body, diagram_mmd, minutes }) }),
  answer: (qid: number) => req<{ ans_md: string | null; cmnt_md: string | null }>(`/api/kamoku-b/${qid}/answer`),
  grade: (attemptId: number) => req<GradeResult>(`/api/kamoku-b/attempt/${attemptId}/grade`, { method: "POST" }),
  grades: (attemptId: number) => req<{ id: number; detail: GradeResult; score_pct: number | null; next_fix: string; graded_at: string }[]>(`/api/kamoku-b/attempt/${attemptId}/grade`),
  weakness: () => req<{ id: number; label: string; count: number; last_seen: string | null; resolved: boolean }[]>("/api/weakness"),
  fetchIpa: () => req<Record<string, unknown>>("/api/materials/fetch-ipa", { method: "POST" }),
  buildIndex: () => req<Record<string, unknown>>("/api/materials/build-index", { method: "POST" }),
};
