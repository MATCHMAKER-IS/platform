"use client";
/**
 * 予約システムのデモ。**@platform/booking の関数を実際に呼んでいる**。
 *
 * 基盤が担当（純ロジック）:
 *  - generateSlots  … 営業時間からスロットを作る
 *  - availableSlots … 既存予約とキャパシティから空き枠を出す
 *  - hasConflict    … 二重予約の判定
 *  - isWithinBookingWindow … 受付期間（何分前まで／何日先まで）
 *  - canCancel      … キャンセル期限
 * アプリが担当（業務ルール）:
 *  - 同一人物の二重予約を断る／予約一覧・キャンセル・localStorage 保存
 */
import * as React from "react";
import {
  generateSlots, availableSlots, hasConflict, isWithinBookingWindow, canCancel,
  type Slot, type BookingInterval,
} from "@platform/booking";
import { Alert, Badge, Button, Input, Select } from "@platform/ui";

const KEY = "demo-booking-v2";
type Reservation = { id: string; date: string; start: string; end: string; name: string };

const DURATIONS = [{ label: "30 分", value: "30" }, { label: "60 分", value: "60" }, { label: "90 分", value: "90" }];
/** 受付ルール: 60分前までは予約不可・30日先まで受付。キャンセルは開始1時間前まで。 */
const WINDOW = { minLeadMinutes: 60, maxAdvanceDays: 30 };
const CANCEL_DEADLINE_MIN = 60;
const REASON: Record<string, string> = {
  past: "過去の日時です", too_soon: "直前すぎます（開始1時間前で締切）", too_far: "先すぎます（30日先まで）",
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };

export default function Page() {
  const [date, setDate] = React.useState(todayIso());
  const [open, setOpen] = React.useState("09:00");
  const [close, setClose] = React.useState("17:00");
  const [duration, setDuration] = React.useState("60");
  const [capacity, setCapacity] = React.useState(3);
  const [name, setName] = React.useState("山田 太郎");
  const [rows, setRows] = React.useState<Reservation[]>([]);
  const [msg, setMsg] = React.useState<{ kind: "info" | "danger"; text: string } | null>(null);

  React.useEffect(() => {
    try { const r = localStorage.getItem(KEY); if (r) setRows(JSON.parse(r)); } catch { /* noop */ }
  }, []);
  const save = (next: Reservation[]) => {
    setRows(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* noop */ }
  };

  // 基盤: 営業時間 → スロット生成
  const slots: Slot[] = React.useMemo(() => {
    try { return generateSlots([{ open, close }], { slotMinutes: Number(duration) }); }
    catch { return []; }
  }, [open, close, duration]);

  // その日の予約を BookingInterval へ（基盤が扱う形）
  const dayBookings: BookingInterval[] = React.useMemo(
    () => rows.filter((r) => r.date === date).map((r) => ({ start: r.start, end: r.end })), [rows, date]);

  // 基盤: 空き枠の算出（キャパシティ考慮）
  const free = React.useMemo(() => availableSlots(slots, dayBookings, capacity), [slots, dayBookings, capacity]);
  const freeKeys = React.useMemo(() => new Set(free.map((s) => `${s.start}-${s.end}`)), [free]);

  const book = (slot: Slot) => {
    setMsg(null);
    if (name.trim() === "") { setMsg({ kind: "danger", text: "お名前を入力してください" }); return; }

    // 基盤: 受付期間の判定
    const at = new Date(`${date}T${slot.start}:00`);
    const check = isWithinBookingWindow(at, WINDOW);
    if (!check.ok) { setMsg({ kind: "danger", text: `予約できません: ${REASON[check.reason ?? ""] ?? check.reason}` }); return; }

    // 基盤: 定員に対する二重予約の判定
    if (hasConflict({ start: slot.start, end: slot.end }, dayBookings, capacity)) {
      setMsg({ kind: "danger", text: "この枠は満席です" }); return;
    }
    // アプリ: 同一人物の二重予約は業務ルールなのでアプリ側で断る
    if (rows.some((r) => r.date === date && r.name === name.trim() && r.start === slot.start)) {
      setMsg({ kind: "danger", text: `${name.trim()} さんは既にこの枠を予約済みです` }); return;
    }

    save([...rows, { id: `b${Date.now()}`, date, start: slot.start, end: slot.end, name: name.trim() }]);
    setMsg({ kind: "info", text: `${date} ${slot.start} で予約しました` });
  };

  const cancel = (r: Reservation) => {
    // 基盤: キャンセル期限の判定
    if (!canCancel(new Date(`${r.date}T${r.start}:00`), CANCEL_DEADLINE_MIN)) {
      setMsg({ kind: "danger", text: "開始1時間前を過ぎたためキャンセルできません" }); return;
    }
    save(rows.filter((x) => x.id !== r.id));
    setMsg({ kind: "info", text: "キャンセルしました" });
  };

  const dayRows = rows.filter((r) => r.date === date).sort((a, b) => a.start.localeCompare(b.start));
  const countAt = (s: Slot) => dayBookings.filter((b) => b.start === s.start).length;

  return (
    <main style={{ maxWidth: 860, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 6 }}>予約システム（空き枠）</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 16 }}>
        スロット生成・空き枠計算・二重予約判定・受付期間・キャンセル期限を、基盤の関数で判定しています。
        受付は開始1時間前で締切、30日先まで。予約は localStorage に保存されます。
      </p>

      <div style={box}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={lb}>日付<Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label style={lb}>営業開始<Input type="time" value={open} onChange={(e) => setOpen(e.target.value)} /></label>
          <label style={lb}>営業終了<Input type="time" value={close} onChange={(e) => setClose(e.target.value)} /></label>
          <label style={lb}>1枠の長さ<Select value={duration} onChange={(e) => setDuration(e.target.value)} options={DURATIONS} /></label>
          <label style={lb}>1枠の定員<Input type="number" min={1} max={9} value={capacity} onChange={(e) => setCapacity(Math.max(1, Number(e.target.value) || 1))} style={{ width: 80 }} /></label>
          <label style={lb}>お名前<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="予約者名" /></label>
        </div>
      </div>

      {msg !== null && (
        <div style={{ marginBottom: 16 }}>
          <Alert variant={msg.kind === "danger" ? "danger" : "info"}>{msg.text}</Alert>
        </div>
      )}

      <div style={box}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>空き枠（押すと予約）</span>
          <span style={{ fontSize: 12, color: "var(--color-muted)" }}>空き {free.length} 枠 / 全 {slots.length} 枠</span>
        </div>
        {slots.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--color-muted)" }}>営業時間の指定を確認してください（開始 &lt; 終了）。</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8 }}>
            {slots.map((s) => {
              const isFree = freeKeys.has(`${s.start}-${s.end}`);
              const used = countAt(s);
              return (
                <Button key={s.start} type="button" onClick={() => book(s)} disabled={!isFree}
                  style={{ padding: "10px 8px", borderRadius: "var(--radius)", cursor: isFree ? "pointer" : "not-allowed", border: "1px solid var(--color-border)", background: isFree ? "var(--color-surface)" : "var(--color-bg)", opacity: isFree ? 1 : 0.6, textAlign: "center" }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{s.start}</div>
                  <div style={{ fontSize: 11, color: "var(--color-muted)" }}>〜{s.end}</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>
                    {isFree ? <span style={{ color: "var(--color-muted)" }}>空き {capacity - used}/{capacity}</span> : <Badge variant="danger">満</Badge>}
                  </div>
                </Button>
              );
            })}
          </div>
        )}
      </div>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{date} の予約（{dayRows.length} 件）</div>
        {dayRows.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--color-muted)" }}>まだ予約はありません。</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>
              <th style={th}>時間</th><th style={th}>お名前</th><th style={{ ...th, textAlign: "right" }}>操作</th>
            </tr></thead>
            <tbody>
              {dayRows.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={td}>{r.start}〜{r.end}</td>
                  <td style={td}>{r.name}</td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <Button size="sm" variant="secondary" onClick={() => cancel(r)}>キャンセル</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Alert variant="info" title="基盤とアプリの分担">
        スロット生成・空き枠計算・二重予約・受付期間・キャンセル期限は <code>@platform/booking</code> の純ロジック。
        「同じ人が同じ枠を二重に取れない」のような業務ルールはアプリ側に置いています。日時計算は <code>@platform/datetime</code>。
      </Alert>
    </main>
  );
}

const lb: React.CSSProperties = { display: "grid", gap: 4, fontSize: 12, color: "var(--color-muted)" };
const th: React.CSSProperties = { textAlign: "left", padding: "6px 8px", color: "var(--color-muted)", fontWeight: 600 };
const td: React.CSSProperties = { padding: "6px 8px" };
