"use client";
/**
 * スケジュール（月/週/日）＋作成・移動・リサイズ・繰り返し・例外日・終了日のデモ。
 * ScheduleCalendar（onRangeSelect / onEventDrop）を使用。繰り返しは demo 側で展開。
 * - 終了日(until): その日まで展開
 * - 例外日(exdates): 「この回だけ削除/変更」でシリーズから除外（変更は単発予定として切り出し）
 */
import * as React from "react";
import { Badge, Button, Input, ScheduleCalendar, type CalendarCategory, type CalendarEvent } from "@platform/ui";

type Recur = "none" | "daily" | "weekly" | "monthly";
type DemoEvent = CalendarEvent & { recur?: Recur; until?: string; count?: number; exdates?: string[] };
const KEY = "demo-schedule-events-v3";
const COLORS = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];
const CATS: CalendarCategory[] = [
  { id: "会議", label: "会議", color: "#2563eb" },
  { id: "作業", label: "作業", color: "#d97706" },
  { id: "タスク", label: "タスク", color: "#16a34a" },
];
const base = new Date();
const at = (dayOffset: number, h: number, m = 0) => { const x = new Date(base); x.setDate(x.getDate() + dayOffset); x.setHours(h, m, 0, 0); return x; };

const SEED: DemoEvent[] = [
  { id: "e1", title: "朝会", start: at(0, 9, 30), end: at(0, 10, 0), color: "#2563eb", category: "会議", recur: "daily" },
  { id: "e2", title: "週次定例", start: at(1, 15, 0), end: at(1, 16, 0), color: "#7c3aed", category: "会議", recur: "weekly" },
  { id: "e4", title: "リリース作業", start: at(2, 18, 0), end: at(2, 20, 0), color: "#d97706", category: "作業" },
];
const bid = (id: string) => (id.includes("#") ? id.split("#")[0]! : id);
const keyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const withDate = (dateSrc: Date, timeSrc: Date) => new Date(dateSrc.getFullYear(), dateSrc.getMonth(), dateSrc.getDate(), timeSrc.getHours(), timeSrc.getMinutes(), 0, 0);
const dayBeforeISO = (d: Date) => {
  const x = new Date(d);
  x.setDate(x.getDate() - 1);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
const fmt = (d: Date) => d.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
const RECUR_LABEL: Record<Recur, string> = { none: "繰り返しなし", daily: "毎日", weekly: "毎週", monthly: "毎月" };

function reviveEvents(raw: string): DemoEvent[] {
  return JSON.parse(raw).map((e: DemoEvent) => ({ ...e, start: new Date(e.start), end: new Date(e.end) }));
}
function expand(evs: DemoEvent[], winStart: Date, winEnd: Date): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const e of evs) {
    if (!e.recur || e.recur === "none") { out.push(e); continue; }
    const dur = e.end.getTime() - e.start.getTime();
    const untilTime = e.until ? new Date(`${e.until}T23:59:59`).getTime() : Infinity;
    const stopTime = Math.min(winEnd.getTime(), untilTime);
    const ex = new Set(e.exdates ?? []);
    const maxCount = e.count && e.count > 0 ? e.count : Infinity;
    const advance = (dt: Date, dir: number) => { if (e.recur === "monthly") dt.setMonth(dt.getMonth() + dir); else dt.setDate(dt.getDate() + dir * (e.recur === "weekly" ? 7 : 1)); };
    const d = new Date(e.start);
    let n = 0;
    while (d.getTime() <= stopTime && n < maxCount && n < 400) {
      const s = new Date(d);
      if (s.getTime() >= winStart.getTime() && !ex.has(keyOf(s))) out.push({ id: `${e.id}#${keyOf(s)}`, title: e.title, start: s, end: new Date(s.getTime() + dur), color: e.color, category: e.category, allDay: e.allDay });
      advance(d, 1); n++;
    }
  }
  return out;
}

export default function Page() {
  const [events, setEvents] = React.useState<DemoEvent[]>(SEED);
  const [sel, setSel] = React.useState<CalendarEvent | null>(null);
  const [pending, setPending] = React.useState<{ start: Date; end: Date; allDay: boolean } | null>(null);
  const [title, setTitle] = React.useState("");
  const [recur, setRecur] = React.useState<Recur>("none");
  const [until, setUntil] = React.useState("");
  const [count, setCount] = React.useState("");
  const [drop, setDrop] = React.useState<{ occ: CalendarEvent; ns: Date; ne: Date } | null>(null);

  React.useEffect(() => { try { const r = localStorage.getItem(KEY); if (r) setEvents(reviveEvents(r)); } catch { /* noop */ } }, []);
  const persist = (next: DemoEvent[]) => { setEvents(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* noop */ } };

  const winStart = React.useMemo(() => { const d = new Date(base); d.setDate(d.getDate() - 120); return d; }, []);
  const winEnd = React.useMemo(() => { const d = new Date(base); d.setDate(d.getDate() + 120); return d; }, []);
  const shown = React.useMemo(() => expand(events, winStart, winEnd), [events, winStart, winEnd]);
  const selBase = sel ? events.find((e) => e.id === bid(sel.id)) : undefined;
  const selRecurring = !!selBase?.recur && selBase.recur !== "none";
  const isOccurrence = (id: string) => id.includes("#");

  const onRange = (start: Date, end: Date) => {
    const allDay = start.getHours() === 0 && start.getMinutes() === 0 && end.getHours() === 0 && end.getMinutes() === 0;
    setPending({ start, end: allDay ? new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59) : end, allDay });
    setTitle(""); setRecur("none"); setUntil(""); setCount("");
  };
  const create = () => {
    if (!pending) return;
    const ev: DemoEvent = { id: "u_" + Math.random().toString(36).slice(2, 7), title: title.trim() || "新しい予定", start: pending.start, end: pending.end, allDay: pending.allDay, color: COLORS[events.length % COLORS.length], recur, until: recur !== "none" && until ? until : undefined, count: recur !== "none" && count ? Number(count) : undefined };
    persist([...events, ev]); setPending(null); setSel(ev);
  };
  const onDrop = (ev: CalendarEvent, ns: Date, ne: Date) => {
    const b = events.find((e) => e.id === bid(ev.id));
    if (b?.recur && b.recur !== "none" && isOccurrence(ev.id)) { setDrop({ occ: ev, ns, ne }); return; }
    persist(events.map((e) => (e.id === bid(ev.id) ? { ...e, start: ns, end: ne } : e)));
  };
  // 移動/リサイズ：繰り返し全体
  const dropAll = () => {
    if (!drop) return;
    persist(events.map((e) => (e.id === bid(drop.occ.id) ? { ...e, start: withDate(e.start, drop.ns), end: withDate(e.end, drop.ne) } : e)));
    setDrop(null);
  };
  // 移動/リサイズ：この回だけ（例外日に追加し、単発予定として切り出し）
  const dropThis = () => {
    if (!drop) return;
    const id = bid(drop.occ.id); const exKey = drop.occ.id.split("#")[1]!;
    const detached: DemoEvent = { id: "u_" + Math.random().toString(36).slice(2, 7), title: drop.occ.title, start: drop.ns, end: drop.ne, color: drop.occ.color, category: drop.occ.category };
    persist([...events.map((e) => (e.id === id ? { ...e, exdates: [...(e.exdates ?? []), exKey] } : e)), detached]);
    setDrop(null); setSel(detached);
  };
  // 移動/リサイズ：この回以降（元シリーズを直前で終了し、この回から新シリーズを作る）
  const dropFollowing = () => {
    if (!drop) return;
    const id = bid(drop.occ.id); const b = events.find((e) => e.id === id); if (!b) return;
    const next: DemoEvent = { id: "u_" + Math.random().toString(36).slice(2, 7), title: drop.occ.title, start: drop.ns, end: drop.ne, color: drop.occ.color, category: drop.occ.category, recur: b.recur, until: b.until };
    persist([...events.map((e) => (e.id === id ? { ...e, until: dayBeforeISO(drop.occ.start), count: undefined } : e)), next]);
    setDrop(null); setSel(next);
  };
  const deleteThis = () => {
    if (!sel) return;
    const id = bid(sel.id); const exKey = sel.id.split("#")[1]!;
    persist(events.map((e) => (e.id === id ? { ...e, exdates: [...(e.exdates ?? []), exKey] } : e)));
    setSel(null);
  };
  const deleteFollowing = () => {
    if (!sel) return;
    persist(events.map((e) => (e.id === bid(sel.id) ? { ...e, until: dayBeforeISO(sel.start), count: undefined } : e)));
    setSel(null);
  };
  const deleteSeries = () => { if (sel) { persist(events.filter((e) => e.id !== bid(sel.id))); setSel(null); } };

  return (
    <main style={{ maxWidth: 1000, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 6 }}>スケジュール ＋ 繰り返し・例外日・終了日</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 16 }}>
        月/週/日で作成・移動・リサイズ。作成時に<strong>繰り返し</strong>と<strong>終了日</strong>を指定でき、繰り返し予定は<strong>「この回だけ」</strong>の変更・削除（例外日）に対応します。
      </p>

      <div style={{ height: 560, display: "flex", flexDirection: "column", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
        <ScheduleCalendar events={shown} categories={CATS} onEventClick={setSel} onRangeSelect={onRange} onEventDrop={onDrop} style={{ flex: 1 }} />
      </div>

      {sel && (
        <div style={{ marginTop: 16, padding: 14, border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: sel.color ?? "#2563eb" }} />
            <strong>{sel.title}</strong>
            {sel.category && <Badge variant="secondary">{sel.category}</Badge>}
            {selRecurring && <Badge variant="success">🔁 {RECUR_LABEL[selBase!.recur!]}{selBase!.until ? `〜${selBase!.until}` : ""}</Badge>}
          </div>
          <div style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 10 }}>{sel.allDay ? "終日" : `${fmt(sel.start)} 〜 ${sel.end.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {selRecurring ? (<>
              <Button size="sm" variant="secondary" onClick={deleteThis}>この回だけ削除</Button>
              <Button size="sm" variant="secondary" onClick={deleteFollowing}>この回以降を削除</Button>
              <Button size="sm" variant="secondary" onClick={deleteSeries}>繰り返しごと削除</Button>
            </>) : (
              <Button size="sm" variant="secondary" onClick={deleteSeries}>削除</Button>
            )}
          </div>
        </div>
      )}

      {pending && (
        <div role="presentation" style={overlay} onClick={() => setPending(null)}>
          <div role="dialog" aria-modal="true" style={modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>予定を作成</div>
            <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 12 }}>
              {pending.allDay ? `${pending.start.toLocaleDateString("ja-JP")} 〜 ${pending.end.toLocaleDateString("ja-JP")}（終日）` : `${fmt(pending.start)} 〜 ${pending.end.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`}
            </div>
            <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="予定のタイトル" onKeyDown={(e) => { if (e.key === "Enter") create(); }}
              style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius)", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)", marginBottom: 10 }} />
            <label style={{ fontSize: 12, color: "var(--color-muted)", display: "block", marginBottom: 4 }}>繰り返し</label>
            <div style={{ display: "flex", gap: 6, marginBottom: recur !== "none" ? 10 : 0 }}>
              {(["none", "daily", "weekly", "monthly"] as Recur[]).map((r) => (
                <Button key={r} type="button" onClick={() => setRecur(r)}
                  style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--color-border)", background: recur === r ? "var(--color-primary)" : "var(--color-bg)", color: recur === r ? "var(--color-primary-fg)" : "var(--color-fg)" }}>{RECUR_LABEL[r]}</Button>))}
            </div>
            {recur !== "none" && (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
                <label style={{ fontSize: 12, color: "var(--color-muted)", display: "flex", alignItems: "center", gap: 8 }}>終了日
                  <Input type="date" value={until} onChange={(e) => { setUntil(e.target.value); if (e.target.value) setCount(""); }} style={{ padding: "6px 8px", borderRadius: "var(--radius)", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)" }} /></label>
                <label style={{ fontSize: 12, color: "var(--color-muted)", display: "flex", alignItems: "center", gap: 8 }}>回数
                  <Input type="number" min={1} placeholder="回" value={count} onChange={(e) => { setCount(e.target.value); if (e.target.value) setUntil(""); }} style={{ width: 70, padding: "6px 8px", borderRadius: "var(--radius)", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)" }} /></label>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <Button variant="secondary" onClick={() => setPending(null)}>キャンセル</Button>
              <Button onClick={create}>作成</Button>
            </div>
          </div>
        </div>
      )}

      {drop && (
        <div role="presentation" style={overlay} onClick={() => setDrop(null)}>
          <div role="dialog" aria-modal="true" style={{ ...modal, maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>繰り返し予定の変更</div>
            <div style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 16 }}>「{drop.occ.title}」の変更をどう適用しますか？</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Button onClick={dropThis}>この回だけ変更（例外日にする）</Button>
              <Button onClick={dropFollowing}>この回以降を変更</Button>
              <Button variant="secondary" onClick={dropAll}>繰り返し全体に適用（時刻）</Button>
              <Button variant="secondary" onClick={() => setDrop(null)}>キャンセル</Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 };
const modal: React.CSSProperties = { background: "var(--color-surface)", borderRadius: "var(--radius)", border: "1px solid var(--color-border)", padding: 20, width: "100%", maxWidth: 380, boxShadow: "0 10px 40px rgba(0,0,0,0.3)" };
