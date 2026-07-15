"use client";
/**
 * タスク管理の画面。かんばん + 進捗 + 担当者ごとの負荷。
 *
 * 判定・集計・並べ替えはすべて `@platform/task` の担当。
 * この画面は「表示」と「操作を API に渡すこと」だけを行う。
 */
import * as React from "react";
import type { Task, TaskStatus, TaskProgress } from "@platform/task";

interface Kanban { status: TaskStatus; tasks: Task[] }
interface Workload { assignee: string; count: number; hours: number }
interface Data { tasks: Task[]; kanban: Kanban[]; summary: TaskProgress; workload: Workload[] }

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "未着手", doing: "作業中", review: "確認中", done: "完了", canceled: "中止",
};
const PRIORITY_LABEL: Record<string, string> = { urgent: "至急", high: "高", normal: "中", low: "低" };
const PRIORITY_COLOR: Record<string, string> = {
  urgent: "var(--color-danger, #dc2626)", high: "var(--color-warning, #d97706)",
  normal: "var(--color-muted, #6b7280)", low: "var(--color-muted, #9ca3af)",
};

/** 次に進める状態(@platform/task の遷移ルールに合わせた表示用)。 */
const NEXT: Partial<Record<TaskStatus, TaskStatus>> = { todo: "doing", doing: "review", review: "done" };

export function TasksClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [data, setData] = React.useState<Data | null>(null);
  const [error, setError] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [assignee, setAssignee] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");

  const load = React.useCallback(async () => {
    const r = await doFetch("/api/tasks");
    const d = (await r.json()) as Data & { error?: string };
    if (r.ok) { setData(d); setError(""); }
    else setError(d.error ?? "取得に失敗しました");
  }, [doFetch]);

  React.useEffect(() => { void load(); }, [load]);

  const add = async () => {
    if (!title.trim()) return;
    const r = await doFetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, assignee: assignee || undefined, dueDate: dueDate || undefined }),
    });
    if (r.ok) { setTitle(""); setAssignee(""); setDueDate(""); await load(); }
    else setError(((await r.json()) as { error?: string }).error ?? "追加に失敗しました");
  };

  const move = async (id: string, status: TaskStatus) => {
    const r = await doFetch("/api/tasks", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (r.ok) await load();
    else setError(((await r.json()) as { error?: string }).error ?? "更新に失敗しました");
  };

  if (error && !data) return <div style={{ padding: 40, color: "var(--color-danger, #c00)" }}>{error}</div>;
  if (!data) return <div style={{ padding: 40, color: "var(--color-muted, #888)" }}>読み込み中…</div>;

  const card: React.CSSProperties = {
    background: "var(--color-surface, #fff)", border: "1px solid var(--color-border, #e5e7eb)",
    borderRadius: "var(--radius, 10px)", padding: 16, marginBottom: 12,
  };
  const input: React.CSSProperties = {
    padding: "6px 8px", border: "1px solid var(--color-border, #ddd)",
    borderRadius: "var(--radius, 6px)", fontSize: 13, background: "var(--color-bg, #fff)", color: "var(--color-fg, #111)",
  };

  const rate = Math.round(data.summary.rate * 100);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 22 }}>タスク</h1>

      {error && <div style={{ ...card, borderLeft: "4px solid var(--color-danger, #c00)", color: "var(--color-danger, #c00)", fontSize: 13 }}>{error}</div>}

      {/* 進捗 */}
      <div style={card}>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--color-muted, #888)" }}>完了率（中止は除く）</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{rate}%</div>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ height: 8, background: "var(--color-bg, #f3f4f6)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${rate}%`, height: "100%", background: "var(--color-success, #16a34a)" }} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: "var(--color-muted, #888)" }}>
            {data.summary.done} / {data.summary.total - data.summary.byStatus.canceled} 件
          </div>
          {data.summary.overdue > 0 && (
            <div style={{ fontSize: 12, color: "var(--color-danger, #c00)", fontWeight: 700 }}>
              期限切れ {data.summary.overdue} 件
            </div>
          )}
          <div style={{ fontSize: 12, color: "var(--color-muted, #888)" }}>
            見積 {data.summary.estimateHours}h / 実績 {data.summary.actualHours}h
          </div>
        </div>
      </div>

      {/* 追加 */}
      <div style={card}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input value={title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} placeholder="やること" style={{ ...input, flex: 1, minWidth: 200 }} />
          <input value={assignee} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAssignee(e.target.value)} placeholder="担当（任意）" style={{ ...input, width: 120 }} />
          <input type="date" value={dueDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDueDate(e.target.value)} style={{ ...input, width: 150 }} />
          <button onClick={() => void add()} style={{ ...input, background: "var(--color-primary, #2563eb)", color: "var(--color-primary-fg, #fff)", border: "none", cursor: "pointer", fontWeight: 600 }}>
            追加
          </button>
        </div>
      </div>

      {/* かんばん */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
        {data.kanban.map((col) => (
          <div key={col.status} style={{ ...card, marginBottom: 0, padding: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
              <span>{STATUS_LABEL[col.status]}</span>
              <span style={{ color: "var(--color-muted, #999)" }}>{col.tasks.length}</span>
            </div>
            {col.tasks.map((t) => {
              const overdue = t.dueDate && t.status !== "done" && t.dueDate < new Date().toISOString().slice(0, 10);
              return (
                <div key={t.id} style={{
                  padding: 8, marginBottom: 6, borderRadius: 8,
                  background: "var(--color-bg, #f9fafb)", border: "1px solid var(--color-border, #f3f4f6)",
                }}>
                  <div style={{ fontSize: 12, marginBottom: 4 }}>{t.title}</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 10, flexWrap: "wrap" }}>
                    <span style={{ color: PRIORITY_COLOR[t.priority] ?? "var(--color-muted)", fontWeight: 700 }}>
                      {PRIORITY_LABEL[t.priority] ?? t.priority}
                    </span>
                    {t.assignee && <span style={{ color: "var(--color-muted, #888)" }}>{t.assignee}</span>}
                    {t.dueDate && (
                      <span style={{ color: overdue ? "var(--color-danger, #c00)" : "var(--color-muted, #888)", fontWeight: overdue ? 700 : 400 }}>
                        {t.dueDate.slice(5)}{overdue ? " 超過" : ""}
                      </span>
                    )}
                  </div>
                  {NEXT[t.status] && (
                    <button
                      onClick={() => void move(t.id, NEXT[t.status]!)}
                      style={{ marginTop: 6, width: "100%", padding: "3px 0", fontSize: 10, border: "1px solid var(--color-border, #ddd)", borderRadius: 6, background: "var(--color-surface, #fff)", color: "var(--color-fg, #111)", cursor: "pointer" }}
                    >
                      {STATUS_LABEL[NEXT[t.status]!]}へ →
                    </button>
                  )}
                </div>
              );
            })}
            {col.tasks.length === 0 && <div style={{ fontSize: 11, color: "var(--color-muted, #ccc)", padding: "8px 0" }}>なし</div>}
          </div>
        ))}
      </div>

      {/* 担当者ごとの負荷 */}
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>担当者ごとの負荷</div>
        <p style={{ fontSize: 11, color: "var(--color-muted, #888)", margin: "0 0 8px" }}>未完のタスクのみ（終わった仕事は負荷ではないため）</p>
        {data.workload.length === 0 && <p style={{ fontSize: 12, color: "var(--color-muted, #999)" }}>未完のタスクはありません。</p>}
        {data.workload.map((w) => {
          const max = Math.max(...data.workload.map((x) => x.hours), 1);
          return (
            <div key={w.assignee} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, padding: "3px 0" }}>
              <span style={{ minWidth: 100 }}>{w.assignee}</span>
              <div style={{ flex: 1, height: 6, background: "var(--color-bg, #f3f4f6)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${(w.hours / max) * 100}%`, height: "100%", background: "var(--color-primary, #2563eb)" }} />
              </div>
              <span style={{ color: "var(--color-muted, #888)", minWidth: 80, textAlign: "right" }}>{w.count} 件 / {w.hours}h</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
