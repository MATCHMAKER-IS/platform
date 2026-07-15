"use client";
/** e-learning 受講画面。進捗バー・章別・レッスン完了・クイズ・修了証。 */
import * as React from "react";

interface Lesson { id: string; title: string; type: string; estimatedMinutes?: number; quiz?: { id: string; prompt: string; choices: string[]; multiple?: boolean }[]; }
interface Module { id: string; title: string; lessons: Lesson[]; }
interface State {
  course: { id: string; title: string; modules: Module[] };
  progress: { completedLessons: string[] };
  summary: { ratio: number; completed: number; total: number; certified: boolean };
  next: Lesson | null;
}

export function LearningClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [state, setState] = React.useState<State | null>(null);
  const [openQuiz, setOpenQuiz] = React.useState<string | null>(null);
  const [answers, setAnswers] = React.useState<Record<string, number[]>>({});
  const [quizMsg, setQuizMsg] = React.useState("");
  const [cert, setCert] = React.useState<string>("");

  const load = async () => { const r = await doFetch("/api/learning"); if (r.ok) setState(await r.json() as State); };
  React.useEffect(() => { void load(); }, []);

  const complete = async (lessonId: string) => {
    const r = await doFetch("/api/learning", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "complete", lessonId }) });
    if (r.ok) setState(await r.json() as State);
  };
  const submitQuiz = async (lessonId: string) => {
    const r = await doFetch("/api/learning", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "quiz", lessonId, answers }) });
    const d = await r.json();
    if (r.ok) { setQuizMsg(d.result.passed ? `合格！正答率 ${Math.round(d.result.ratio * 100)}%` : `不合格（正答率 ${Math.round(d.result.ratio * 100)}%）もう一度挑戦しましょう`); setState(d.state as State); if (d.result.passed) setOpenQuiz(null); }
    else setQuizMsg(d.error ?? "エラー");
  };
  const getCert = async () => {
    const r = await doFetch("/api/learning", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "certificate" }) });
    const d = await r.json();
    setCert(r.ok ? `修了証: ${d.certificate.courseTitle}（${new Date(d.certificate.completedAt).toLocaleDateString("ja-JP")} 修了）` : (d.error ?? "エラー"));
  };

  if (!state) return <div style={{ padding: 24, fontFamily: "system-ui" }}>読み込み中…</div>;
  const done = new Set(state.progress.completedLessons);
  const card: React.CSSProperties = { background: "var(--color-surface, #fff)", border: "1px solid #e8e8e8", borderRadius: 10, padding: 16, marginBottom: 12 };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22 }}>{state.course.title}</h1>
      <div style={{ ...card }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
          <span>進捗 {state.summary.completed} / {state.summary.total} レッスン</span>
          <span>{Math.round(state.summary.ratio * 100)}%</span>
        </div>
        <div style={{ height: 8, background: "var(--color-border, #eee)", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ width: `${state.summary.ratio * 100}%`, height: "100%", background: state.summary.certified ? "var(--color-success, #16a34a)" : "var(--color-primary, #2563eb)", transition: "width 400ms cubic-bezier(0.34,1.56,0.64,1)" }} />
        </div>
        {state.summary.certified && <div style={{ marginTop: 12 }}><button onClick={getCert} style={{ padding: "8px 20px", background: "var(--color-success, #16a34a)", color: "var(--color-surface, #fff)", border: "none", borderRadius: 8 }}>修了証を発行</button>{cert && <p style={{ fontSize: 13, color: "var(--color-success, #16a34a)", marginTop: 8 }}>{cert}</p>}</div>}
      </div>

      {state.course.modules.map((m) => (
        <div key={m.id} style={card}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>{m.title}</div>
          {m.lessons.map((l) => (
            <div key={l.id} style={{ borderBottom: "1px solid #f5f5f5", padding: "8px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>{done.has(l.id) ? "✅" : l.type === "quiz" ? "❓" : l.type === "video" ? "▶️" : "📄"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: done.has(l.id) ? "var(--color-muted, #999)" : "#222", textDecoration: done.has(l.id) ? "line-through" : "none" }}>{l.title}</div>
                  {l.estimatedMinutes && <div style={{ fontSize: 11, color: "var(--color-muted, #aaa)" }}>約 {l.estimatedMinutes} 分</div>}
                </div>
                {!done.has(l.id) && l.type !== "quiz" && <button onClick={() => complete(l.id)} style={{ fontSize: 12, padding: "5px 14px", background: "var(--color-primary, #2563eb)", color: "var(--color-surface, #fff)", border: "none", borderRadius: 6 }}>完了にする</button>}
                {l.type === "quiz" && !done.has(l.id) && <button onClick={() => { setOpenQuiz(openQuiz === l.id ? null : l.id); setQuizMsg(""); }} style={{ fontSize: 12, padding: "5px 14px", background: "#7c3aed", color: "var(--color-surface, #fff)", border: "none", borderRadius: 6 }}>クイズに挑戦</button>}
              </div>
              {openQuiz === l.id && l.quiz && (
                <div style={{ marginTop: 10, padding: 12, background: "#faf5ff", borderRadius: 8 }}>
                  {l.quiz.map((q) => (
                    <div key={q.id} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{q.prompt}{q.multiple && <span style={{ fontSize: 11, color: "var(--color-muted, #999)" }}>（複数選択）</span>}</div>
                      {q.choices.map((choice, ci) => (
                        <label key={ci} style={{ display: "block", fontSize: 13, padding: "3px 0", cursor: "pointer" }}>
                          <input type={q.multiple ? "checkbox" : "radio"} name={q.id} checked={(answers[q.id] ?? []).includes(ci)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setAnswers((prev) => {
                              const cur = prev[q.id] ?? [];
                              if (q.multiple) return { ...prev, [q.id]: e.target.checked ? [...cur, ci] : cur.filter((x) => x !== ci) };
                              return { ...prev, [q.id]: [ci] };
                            });
                          }} style={{ marginRight: 6 }} />{choice}
                        </label>
                      ))}
                    </div>
                  ))}
                  <button onClick={() => submitQuiz(l.id)} style={{ fontSize: 13, padding: "6px 18px", background: "#7c3aed", color: "var(--color-surface, #fff)", border: "none", borderRadius: 6 }}>採点する</button>
                  {quizMsg && <p style={{ fontSize: 13, marginTop: 8, color: quizMsg.startsWith("合格") ? "var(--color-success, #16a34a)" : "var(--color-warning, #b45309)" }}>{quizMsg}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
