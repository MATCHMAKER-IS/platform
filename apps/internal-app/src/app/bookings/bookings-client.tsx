"use client";
/**
 * 予約画面。会議室・設備・イベントを 1 つの画面で扱う。
 * 対象を選ぶ → 日付を選ぶ → 空き枠をクリック → 用件を入れて予約。
 */
import * as React from "react";
import { Button, Input } from "@platform/ui";

interface Resource { id: string; name: string; kind: "room" | "equipment" | "event"; capacity: number; note?: string }
interface SlotInfo { start: string; end: string; available: boolean; remaining: number }
interface MyBooking { id: string; resourceId: string; resourceName: string; title: string; start: string; end: string; status: string }

const KIND_LABEL: Record<Resource["kind"], string> = { room: "会議室", equipment: "設備", event: "イベント" };

/** 今日から N 日分の日付(YYYY-MM-DD)。土日も出す(休業と分かるように)。 */
function nextDays(n: number): string[] {
  const out: string[] = [];
  const base = new Date();
  for (let i = 0; i < n; i += 1) {
    const d = new Date(base.getTime() + i * 86400000);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function BookingsClient({ fetchImpl }: { fetchImpl?: typeof fetch }) {
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const [resources, setResources] = React.useState<Resource[]>([]);
  const [selected, setSelected] = React.useState<string>("");
  const [date, setDate] = React.useState<string>(nextDays(1)[0] ?? "");
  const [slots, setSlots] = React.useState<SlotInfo[]>([]);
  const [mine, setMine] = React.useState<MyBooking[]>([]);
  const [title, setTitle] = React.useState("");
  const [picked, setPicked] = React.useState<SlotInfo | null>(null);
  const [msg, setMsg] = React.useState("");

  const loadResources = React.useCallback(async () => {
    const r = await doFetch("/api/bookings");
    if (!r.ok) return;
    const d = (await r.json()) as { resources: Resource[] };
    setResources(d.resources);
    if (d.resources[0]) setSelected((s) => s || d.resources[0]!.id);
  }, [doFetch]);

  const loadSlots = React.useCallback(async () => {
    if (!selected || !date) return;
    const r = await doFetch(`/api/bookings?resourceId=${encodeURIComponent(selected)}&date=${date}`);
    if (!r.ok) { setSlots([]); return; }
    const d = (await r.json()) as { slots: SlotInfo[] };
    setSlots(d.slots);
  }, [doFetch, selected, date]);

  const loadMine = React.useCallback(async () => {
    const r = await doFetch("/api/bookings?mine=1");
    if (!r.ok) return;
    setMine(((await r.json()) as { bookings: MyBooking[] }).bookings);
  }, [doFetch]);

  React.useEffect(() => { void loadResources(); void loadMine(); }, [loadResources, loadMine]);
  React.useEffect(() => { void loadSlots(); }, [loadSlots]);

  const book = async () => {
    if (!picked) return;
    setMsg("");
    const r = await doFetch("/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resourceId: selected, title, start: picked.start, end: picked.end }),
    });
    const d = (await r.json()) as { error?: { message?: string } | string };
    if (r.ok) {
      setMsg("予約しました");
      setPicked(null);
      setTitle("");
      await loadSlots();
      await loadMine();
    } else {
      setMsg(typeof d.error === "string" ? d.error : d.error?.message ?? "予約できませんでした");
    }
  };

  const cancel = async (id: string) => {
    setMsg("");
    const r = await doFetch(`/api/bookings?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const d = (await r.json()) as { error?: { message?: string } | string };
    if (r.ok) { setMsg("取り消しました"); await loadSlots(); await loadMine(); }
    else setMsg(typeof d.error === "string" ? d.error : d.error?.message ?? "取り消せませんでした");
  };

  const card: React.CSSProperties = {
    background: "var(--color-surface, #fff)",
    border: "1px solid var(--color-border, #e5e7eb)",
    borderRadius: "var(--radius, 10px)",
    padding: 16,
    marginBottom: 12,
  };
  const resource = resources.find((r) => r.id === selected);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 22 }}>予約</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted, #666)" }}>
        会議室・設備・イベントを予約します。平日 9:00〜18:00（12:00〜13:00 は休み）。
      </p>

      {/* 対象を選ぶ */}
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>何を予約しますか</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
          {resources.map((r) => (
            <Button
              key={r.id}
              onClick={() => { setSelected(r.id); setPicked(null); }}
              style={{
                textAlign: "left", padding: 10, cursor: "pointer",
                border: r.id === selected ? "2px solid var(--color-primary, #2563eb)" : "1px solid var(--color-border, #e5e7eb)",
                borderRadius: "var(--radius, 8px)", background: "var(--color-surface, #fff)", color: "var(--color-fg, #111)",
              }}
            >
              <div style={{ fontSize: 10, color: "var(--color-muted, #888)" }}>{KIND_LABEL[r.kind]}{r.capacity > 1 && ` ・定員${r.capacity}`}</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
              {r.note && <div style={{ fontSize: 11, color: "var(--color-muted, #888)" }}>{r.note}</div>}
            </Button>
          ))}
        </div>
      </div>

      {/* 日付と空き枠 */}
      <div style={card}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>空き枠</div>
          <select
            value={date}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setDate(e.target.value); setPicked(null); }}
            style={{ padding: "4px 8px", border: "1px solid var(--color-border, #ddd)", borderRadius: 6, fontSize: 13 }}
          >
            {nextDays(14).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        {slots.length === 0 && <p style={{ fontSize: 12, color: "var(--color-muted, #999)" }}>この日は休業です（土日は予約できません）。</p>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 6 }}>
          {slots.map((s) => {
            const isPicked = picked?.start === s.start;
            return (
              <Button
                key={s.start}
                disabled={!s.available}
                onClick={() => setPicked(s)}
                style={{
                  padding: "6px 4px", fontSize: 12, cursor: s.available ? "pointer" : "not-allowed",
                  border: isPicked ? "2px solid var(--color-primary, #2563eb)" : "1px solid var(--color-border, #e5e7eb)",
                  borderRadius: 6,
                  background: s.available ? "var(--color-surface, #fff)" : "var(--color-bg, #f3f4f6)",
                  color: s.available ? "var(--color-fg, #111)" : "var(--color-muted, #bbb)",
                }}
              >
                {s.start.slice(11, 16)}
                {resource && resource.capacity > 1 && (
                  <div style={{ fontSize: 9, color: "var(--color-muted, #888)" }}>残 {s.remaining}</div>
                )}
              </Button>
            );
          })}
        </div>

        {picked && (
          <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: "var(--color-bg, #f9fafb)" }}>
            <div style={{ fontSize: 12, marginBottom: 6 }}>
              {date} {picked.start.slice(11, 16)}〜{picked.end.slice(11, 16)} を予約
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Input
                value={title}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                placeholder="用件（例: 定例会議）"
                style={{ flex: 1, minWidth: 180, padding: "6px 8px", border: "1px solid var(--color-border, #ddd)", borderRadius: 6, fontSize: 13 }}
              />
              <Button onClick={() => void book()} style={{ padding: "6px 16px", border: "none", borderRadius: 6, background: "var(--color-primary, #2563eb)", color: "var(--color-primary-fg, #fff)", fontSize: 13, cursor: "pointer" }}>
                予約する
              </Button>
              <Button onClick={() => setPicked(null)} style={{ padding: "6px 12px", border: "1px solid var(--color-border, #ddd)", borderRadius: 6, background: "transparent", fontSize: 13, cursor: "pointer" }}>
                やめる
              </Button>
            </div>
          </div>
        )}
        {msg && <p style={{ fontSize: 12, marginTop: 8, color: msg.includes("しました") ? "var(--color-success, #16a34a)" : "var(--color-danger, #c00)" }}>{msg}</p>}
      </div>

      {/* 自分の予約 */}
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>自分の予約（{mine.filter((b) => b.status === "confirmed").length}）</div>
        {mine.length === 0 && <p style={{ fontSize: 12, color: "var(--color-muted, #999)" }}>まだ予約がありません。</p>}
        {mine.map((b) => (
          <div key={b.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0", borderTop: "1px solid var(--color-border, #f3f4f6)", fontSize: 12 }}>
            <span style={{ color: "var(--color-muted, #888)", minWidth: 130 }}>{b.start.slice(0, 10)} {b.start.slice(11, 16)}〜{b.end.slice(11, 16)}</span>
            <strong style={{ minWidth: 140 }}>{b.resourceName}</strong>
            <span style={{ flex: 1 }}>{b.title}</span>
            {b.status === "cancelled" ? (
              <span style={{ color: "var(--color-muted, #bbb)" }}>取消済</span>
            ) : (
              <Button onClick={() => void cancel(b.id)} style={{ padding: "3px 10px", border: "1px solid var(--color-border, #ddd)", borderRadius: 6, background: "transparent", color: "var(--color-danger, #c00)", fontSize: 11, cursor: "pointer" }}>
                取り消す
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
