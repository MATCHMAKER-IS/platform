"use client";
/**
 * 打刻と月次集計のデモ。
 *
 * 打刻から「実労働・残業・深夜・休日・遅刻・早退」を出すところまでが
 * @platform/attendance の担当。金額にするのは @platform/payroll の担当。
 * **その境目**が分かるようにしている。
 */
import * as React from "react";
import { summarize, type AttendanceEntry } from "@platform/attendance";
import { calcMonthlyPay } from "@platform/payroll";
import { Button, Input, Badge, Select, Alert } from "@platform/ui";

const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };
const th: React.CSSProperties = { textAlign: "left", padding: "6px 8px", color: "var(--color-muted)", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "6px 8px", fontSize: 12.5, whiteSpace: "nowrap" };
const lb: React.CSSProperties = { display: "grid", gap: 4, fontSize: 12, color: "var(--color-muted)" };

const hm = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;

const SEED: AttendanceEntry[] = [
  { date: "2026-07-01", clockIn: "09:00", clockOut: "18:00", breakMinutes: 60 },
  { date: "2026-07-02", clockIn: "09:15", clockOut: "20:30", breakMinutes: 60, note: "電車遅延" },
  { date: "2026-07-03", clockIn: "09:00", clockOut: "17:00", breakMinutes: 60, note: "通院で早退" },
  { date: "2026-07-04", clockIn: "22:00", clockOut: "06:00", breakMinutes: 60, workType: "夜勤" },
  { date: "2026-07-05", clockIn: "10:00", clockOut: "15:00", isHoliday: true, workType: "休日出勤" },
];

export function TimecardDemo() {
  const [rows, setRows] = React.useState<AttendanceEntry[]>(SEED);
  const [grace, setGrace] = React.useState("0");
  const [wage, setWage] = React.useState(2000);
  const [form, setForm] = React.useState({ date: "2026-07-06", clockIn: "09:00", clockOut: "18:00", breakMinutes: 60 });

  const hours = { start: "09:00", end: "18:00", graceMinutes: Number(grace) };
  const summary = React.useMemo(() => summarize("2026-07", rows, hours), [rows, grace]);
  // 勤怠の集計結果は、そのまま給与計算へ渡せる形にしてある
  const pay = React.useMemo(() => calcMonthlyPay({
    totalMinutes: summary.totalMinutes,
    overtimeMinutes: summary.overtimeMinutes,
    nightMinutes: summary.nightMinutes,
    holidayMinutes: summary.holidayMinutes,
    // 月 60 時間を超えた時間外は割増が上がる
    over60Minutes: Math.max(0, summary.overtimeMinutes - 60 * 60),
    workedDays: summary.workedDays,
  }, wage), [summary, wage]);

  const add = () => {
    if (rows.some((r) => r.date === form.date)) {
      setRows(rows.map((r) => (r.date === form.date ? { ...form } : r)));
    } else {
      setRows([...rows, { ...form }]);
    }
  };

  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 16 }}>
        打刻から労働時間の区分を出すのが <code>@platform/attendance</code>、
        それを金額にするのが <code>@platform/payroll</code> です。<strong>境目</strong>が分かるように並べています。
      </p>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>打刻する</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={lb}>日付<Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          <label style={lb}>出勤<Input type="time" value={form.clockIn} onChange={(e) => setForm({ ...form, clockIn: e.target.value })} /></label>
          <label style={lb}>退勤<Input type="time" value={form.clockOut} onChange={(e) => setForm({ ...form, clockOut: e.target.value })} /></label>
          <label style={lb}>休憩(分)<Input type="number" value={form.breakMinutes} onChange={(e) => setForm({ ...form, breakMinutes: Number(e.target.value) || 0 })} style={{ width: 90 }} /></label>
          <Button onClick={add}>記録する</Button>
          <Button variant="secondary" onClick={() => setRows(SEED)}>初期状態</Button>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginTop: 12 }}>
          <label style={lb}>遅刻の猶予
            <Select value={grace} onChange={(e) => setGrace(e.target.value)}
              options={[{ label: "なし", value: "0" }, { label: "5分", value: "5" }, { label: "15分", value: "15" }]} />
          </label>
          <label style={lb}>時給<Input type="number" value={wage} onChange={(e) => setWage(Number(e.target.value) || 0)} style={{ width: 110 }} /></label>
          <span style={{ fontSize: 12, color: "var(--color-muted)" }}>所定 9:00〜18:00</span>
        </div>
      </div>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>集計（@platform/attendance）</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
            <thead><tr>
              <th style={th}>日付</th><th style={th}>出勤</th><th style={th}>退勤</th>
              <th style={th}>実労働</th><th style={th}>残業</th><th style={th}>深夜</th><th style={th}>休日</th>
              <th style={th}>遅刻</th><th style={th}>早退</th><th style={th}>備考</th>
            </tr></thead>
            <tbody>
              {summary.days.map((d) => (
                <tr key={d.date} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={td}>{d.date.slice(5)}</td>
                  <td style={td}>{d.clockIn}</td>
                  <td style={td}>{d.clockOut}</td>
                  <td style={td}>{hm(d.totalMinutes)}</td>
                  <td style={td}>{d.overtimeMinutes > 0 ? hm(d.overtimeMinutes) : "—"}</td>
                  <td style={td}>{d.nightMinutes > 0 ? hm(d.nightMinutes) : "—"}</td>
                  <td style={td}>{d.holidayMinutes > 0 ? hm(d.holidayMinutes) : "—"}</td>
                  <td style={{ ...td, color: d.lateMinutes > 0 ? "var(--color-danger, #c00)" : undefined }}>{d.lateMinutes > 0 ? `${d.lateMinutes}分` : "—"}</td>
                  <td style={{ ...td, color: d.earlyLeaveMinutes > 0 ? "var(--color-danger, #c00)" : undefined }}>{d.earlyLeaveMinutes > 0 ? `${d.earlyLeaveMinutes}分` : "—"}</td>
                  <td style={{ ...td, color: "var(--color-muted)" }}>{d.workType ?? d.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <Badge variant="secondary">出勤 {summary.workedDays} 日</Badge>
          <Badge variant="secondary">実労働 {hm(summary.totalMinutes)}</Badge>
          <Badge variant={summary.overtimeMinutes > 0 ? "warning" : "secondary"}>残業 {hm(summary.overtimeMinutes)}</Badge>
          <Badge variant="secondary">深夜 {hm(summary.nightMinutes)}</Badge>
          <Badge variant="secondary">休日 {hm(summary.holidayMinutes)}</Badge>
          {summary.lateMinutes > 0 && <Badge variant="danger">遅刻 {summary.lateMinutes}分</Badge>}
        </div>
      </div>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>金額にする（@platform/payroll）</div>
        <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
          <tbody>
            {[
              ["基本賃金", pay.base],
              ["残業割増（60時間以内）", pay.overtimePremium],
              ["残業割増（60時間超）", pay.over60Premium],
              ["深夜割増", pay.nightPremium],
              ["休日労働", pay.holidayPay],
            ].map(([k, v]) => (
              <tr key={String(k)} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ ...td, color: "var(--color-muted)" }}>{k}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{Number(v).toLocaleString()} 円</td>
              </tr>
            ))}
            <tr style={{ borderTop: "2px solid var(--color-border)" }}>
              <td style={{ ...td, fontWeight: 700 }}>合計</td>
              <td style={{ ...td, textAlign: "right", fontWeight: 700, fontFamily: "monospace" }}>{pay.total.toLocaleString()} 円</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Alert variant="info" title="境目の考え方">
        時間の区分（何時間働いたか）は勤怠、金額（いくらか）は給与。分けておくと、
        <strong>割増率が変わっても勤怠側は触らずに済み</strong>、勤務体系が増えても給与側は影響を受けません。
        月次の集計結果はそのまま <code>calcMonthlyPay</code> に渡せる形にしてあります。
      </Alert>
    </div>
  );
}
