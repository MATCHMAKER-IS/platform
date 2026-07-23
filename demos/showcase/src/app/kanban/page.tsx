"use client";
/**
 * Kanban（タスクボード）のデモ。@platform/ui の Kanban + moveCard を使用。
 *
 * 実業務で必要になるものを一通り載せている:
 *  - カードの追加 / 編集 / 削除（担当・期限・優先度）
 *  - WIP 制限（列ごとの上限。超えると警告し、移動時に確認する）
 *  - 期限の色分け（超過は赤、当日は橙）
 *  - 担当者・キーワードでの絞り込み
 *  - localStorage への保存（リロードしても維持）
 */
import * as React from "react";
import { Kanban, moveCard, Button, Input, Select, type KanbanColumn, type KanbanCard } from "@platform/ui";

const KEY = "demo-kanban-v2";

type Task = { id: string; title: string; assignee: string; due: string; priority: "high" | "normal" | "low" };
type Board = { id: string; title: string; accent: string; wip: number; tasks: Task[] };

const MEMBERS = ["山田", "佐藤", "田中", "鈴木"];
const PRIORITY: Record<Task["priority"], { label: string; color: string }> = {
  high: { label: "高", color: "#dc2626" },
  normal: { label: "中", color: "#64748b" },
  low: { label: "低", color: "#94a3b8" },
};

const DEFAULT: Board[] = [
  { id: "todo", title: "未着手", accent: "#94a3b8", wip: 0, tasks: [
    { id: "t1", title: "要件ヒアリング", assignee: "山田", due: "2026-07-24", priority: "normal" },
    { id: "t2", title: "見積作成", assignee: "佐藤", due: "2026-07-20", priority: "high" },
  ] },
  { id: "doing", title: "進行中", accent: "#2563eb", wip: 2, tasks: [
    { id: "t3", title: "画面設計", assignee: "田中", due: "2026-07-28", priority: "normal" },
  ] },
  { id: "review", title: "レビュー", accent: "#d97706", wip: 2, tasks: [
    { id: "t4", title: "API 実装", assignee: "鈴木", due: "2026-07-22", priority: "high" },
  ] },
  { id: "done", title: "完了", accent: "#16a34a", wip: 0, tasks: [
    { id: "t5", title: "キックオフ", assignee: "全員", due: "", priority: "low" },
  ] },
];

const todayIso = () => new Date().toISOString().slice(0, 10);
/** 期限の状態を返す。色分けの根拠を1か所に集める。 */
function dueState(due: string): "none" | "over" | "today" | "future" {
  if (!due) return "none";
  const t = todayIso();
  return due < t ? "over" : due === t ? "today" : "future";
}

export default function Page() {
  const [boards, setBoards] = React.useState<Board[]>(DEFAULT);
  const [q, setQ] = React.useState("");
  const [who, setWho] = React.useState("");
  const [editing, setEditing] = React.useState<{ task: Task; colId: string; isNew: boolean } | null>(null);
  const [toast, setToast] = React.useState("");

  React.useEffect(() => {
    try { const r = localStorage.getItem(KEY); if (r) setBoards(JSON.parse(r)); } catch { /* noop */ }
  }, []);
  const save = (next: Board[]) => {
    setBoards(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* noop */ }
  };
  const notify = (m: string) => { setToast(m); window.setTimeout(() => setToast(""), 2600); };

  // 絞り込み後のカードを @platform/ui の形へ変換する
  const columns: KanbanColumn[] = React.useMemo(() => boards.map((b) => {
    const shown = b.tasks.filter((t) =>
      (q === "" || t.title.includes(q) || t.assignee.includes(q)) && (who === "" || t.assignee === who));
    const over = b.wip > 0 && b.tasks.length > b.wip;
    const cards: KanbanCard[] = shown.map((t) => {
      const st = dueState(t.due);
      return {
        id: t.id,
        title: t.title,
        meta: `${t.assignee}${t.due ? ` / ${t.due}` : ""}${st === "over" ? "（期限超過）" : st === "today" ? "（本日期限）" : ""} ・優先度${PRIORITY[t.priority].label}`,
        accent: st === "over" ? "#dc2626" : st === "today" ? "#d97706" : PRIORITY[t.priority].color,
      };
    });
    return {
      id: b.id,
      title: `${b.title}（${shown.length}${b.wip > 0 ? ` / 上限${b.wip}` : ""}）${over ? " ⚠" : ""}`,
      accent: over ? "#dc2626" : b.accent,
      cards,
    };
  }), [boards, q, who]);

  const onMove = (cardId: string, toColumnId: string, toIndex: number) => {
    const from = boards.find((b) => b.tasks.some((t) => t.id === cardId));
    const to = boards.find((b) => b.id === toColumnId);
    if (!from || !to) return;
    // WIP 制限: 上限を超える移動は確認してから通す（止めはしない。現場の判断を優先）
    if (from.id !== to.id && to.wip > 0 && to.tasks.length >= to.wip) {
      const okToGo = window.confirm(`「${to.title}」は上限 ${to.wip} 件です。超過して移動しますか？`);
      if (!okToGo) return;
    }
    // 表示は絞り込み済みだが、保持しているのは全件。moveCard には全件の形を渡す
    const full: KanbanColumn[] = boards.map((b) => ({ id: b.id, title: b.title, cards: b.tasks.map((t) => ({ id: t.id, title: t.title })) }));
    const moved = moveCard(full, cardId, toColumnId, toIndex) as KanbanColumn[];
    const byId = new Map(boards.flatMap((b) => b.tasks).map((t) => [t.id, t]));
    save(boards.map((b) => {
      const col = moved.find((m) => m.id === b.id);
      return { ...b, tasks: (col?.cards ?? []).map((c) => byId.get(c.id)!).filter(Boolean) };
    }));
  };

  const openNew = (colId: string) => setEditing({ isNew: true, colId, task: { id: `t${Date.now()}`, title: "", assignee: MEMBERS[0]!, due: todayIso(), priority: "normal" } });
  const openEdit = (card: KanbanCard, colId: string) => {
    const t = boards.flatMap((b) => b.tasks).find((x) => x.id === card.id);
    if (t) setEditing({ isNew: false, colId, task: { ...t } });
  };

  const commit = () => {
    if (!editing) return;
    const { task, colId, isNew } = editing;
    if (!task.title.trim()) { notify("タイトルを入力してください"); return; }
    save(boards.map((b) => b.id !== colId ? b : {
      ...b,
      tasks: isNew ? [...b.tasks, task] : b.tasks.map((t) => (t.id === task.id ? task : t)),
    }));
    setEditing(null);
    notify(isNew ? "追加しました" : "更新しました");
  };
  const remove = () => {
    if (!editing) return;
    save(boards.map((b) => ({ ...b, tasks: b.tasks.filter((t) => t.id !== editing.task.id) })));
    setEditing(null);
    notify("削除しました");
  };

  const all = boards.flatMap((b) => b.tasks);
  const overdue = all.filter((t) => dueState(t.due) === "over").length;
  const wipOver = boards.filter((b) => b.wip > 0 && b.tasks.length > b.wip);

  return (
    <main style={{ maxWidth: 1000, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 6 }}>Kanban（タスクボード）</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 16 }}>
        カードを列から列へドラッグして移動できます。カードを押すと編集、列見出しの「＋」で追加。
        WIP 制限・期限の色分け・絞り込み付きで、内容は localStorage に保存されます。
      </p>

      {/* 集計 */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <span style={chip}>全 {all.length} 件</span>
        <span style={{ ...chip, borderColor: overdue > 0 ? "#dc2626" : undefined, color: overdue > 0 ? "#dc2626" : undefined }}>期限超過 {overdue} 件</span>
        {wipOver.length > 0 && <span style={{ ...chip, borderColor: "#dc2626", color: "#dc2626" }}>WIP 超過: {wipOver.map((b) => b.title).join("・")}</span>}
      </div>

      {/* 絞り込み */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="タイトル・担当で検索" style={{ maxWidth: 240 }} />
        <Select value={who} onChange={(e) => setWho(e.target.value)} style={{ maxWidth: 170 }}
          options={[{ label: "担当者：すべて", value: "" }, ...MEMBERS.map((m) => ({ label: m, value: m }))]} />
        {(q !== "" || who !== "") && <Button size="sm" variant="secondary" onClick={() => { setQ(""); setWho(""); }}>絞り込み解除</Button>}
      </div>

      {/* 列ごとの追加ボタン */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        {boards.map((b) => (
          <Button key={b.id} size="sm" variant="secondary" onClick={() => openNew(b.id)}>＋ {b.title}に追加</Button>
        ))}
      </div>

      <Kanban columns={columns} onMove={onMove} onCardClick={openEdit} />

      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <Button size="sm" variant="secondary" onClick={() => save(DEFAULT)}>初期状態に戻す</Button>
      </div>

      {toast !== "" && (
        <div role="status" style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: 80, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "8px 16px", fontSize: 13, boxShadow: "0 8px 24px rgba(0,0,0,0.2)" }}>{toast}</div>
      )}

      {editing !== null && (
        <div role="presentation" style={overlay} onClick={() => setEditing(null)}>
          <div role="dialog" aria-modal="true" aria-label={editing.isNew ? "タスクを追加" : "タスクを編集"} style={modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{editing.isNew ? "タスクを追加" : "タスクを編集"}</h2>
            <div style={{ display: "grid", gap: 10 }}>
              <label style={label}>タイトル
                <Input value={editing.task.title} onChange={(e) => setEditing({ ...editing, task: { ...editing.task, title: e.target.value } })} placeholder="やること" />
              </label>
              <label style={label}>担当
                <Select value={editing.task.assignee} onChange={(e) => setEditing({ ...editing, task: { ...editing.task, assignee: e.target.value } })}
                  options={[...MEMBERS, "全員"].map((m) => ({ label: m, value: m }))} />
              </label>
              <label style={label}>期限
                <Input type="date" value={editing.task.due} onChange={(e) => setEditing({ ...editing, task: { ...editing.task, due: e.target.value } })} />
              </label>
              <label style={label}>優先度
                <Select value={editing.task.priority} onChange={(e) => setEditing({ ...editing, task: { ...editing.task, priority: e.target.value as Task["priority"] } })}
                  options={[{ label: "高", value: "high" }, { label: "中", value: "normal" }, { label: "低", value: "low" }]} />
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
              {!editing.isNew && <Button size="sm" variant="danger" onClick={remove}>削除</Button>}
              <Button size="sm" variant="secondary" onClick={() => setEditing(null)}>やめる</Button>
              <Button size="sm" onClick={commit}>{editing.isNew ? "追加" : "保存"}</Button>
            </div>
          </div>
        </div>
      )}

      <p style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.8, marginTop: 16 }}>
        <code>@platform/ui</code> の <code>Kanban</code>（列間ドラッグ）と <code>moveCard</code>（移動ロジック）を使用。
        WIP 制限・期限判定・絞り込みは業務ルールなのでアプリ側に置いています。
        自由な位置への移動は <a href="/canvas" style={{ color: "var(--color-primary)" }}>自由配置キャンバス</a>、グリッド並べ替えは <a href="/dashboard-grid" style={{ color: "var(--color-primary)" }}>ライブダッシュボード</a> を参照。
      </p>
    </main>
  );
}

const chip: React.CSSProperties = { fontSize: 12, padding: "4px 10px", borderRadius: 999, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-muted)" };
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
const modal: React.CSSProperties = { width: "100%", maxWidth: 420, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 12, padding: 20, boxShadow: "0 20px 60px rgba(0,0,0,0.35)" };
const label: React.CSSProperties = { display: "grid", gap: 4, fontSize: 12, color: "var(--color-muted)" };
