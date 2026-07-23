"use client";
/**
 * 年次有給休暇のデモ。
 *
 * 有給は**法律で付与日数と時効が決まっている**ため、会社ごとに作り直すものではない。
 * ここで扱うのは日数の計算だけで、申請と承認は @platform/workflow の担当。
 */
import * as React from "react";
import { grantsSinceHire, leaveBalance, mandatoryLeaveStatus, statutoryLeaveDays, type LeaveTaken } from "@platform/attendance";
import { Button, Input, Badge, Alert } from "@platform/ui";

const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };
const th: React.CSSProperties = { textAlign: "left", padding: "6px 8px", color: "var(--color-muted)", fontWeight: 600, fontSize: 12 };
const td: React.CSSProperties = { padding: "6px 8px", fontSize: 12.5 };
const lb: React.CSSProperties = { display: "grid", gap: 4, fontSize: 12, color: "var(--color-muted)" };

const SEED: LeaveTaken[] = [
  { date: "2025-01-10", days: 1 },
  { date: "2025-08-13", days: 2 },
  { date: "2026-05-01", days: 2 },
];

export function LeaveDemo() {
  const [hireDate, setHireDate] = React.useState("2024-04-01");
  const [asOf, setAsOf] = React.useState("2026-07-22");
  const [taken, setTaken] = React.useState<LeaveTaken[]>(SEED);
  const [form, setForm] = React.useState({ date: "2026-08-10", days: 1 });

  const grants = React.useMemo(() => grantsSinceHire(hireDate, asOf), [hireDate, asOf]);
  const balance = React.useMemo(() => leaveBalance(grants, taken, asOf), [grants, taken, asOf]);
  const duty = React.useMemo(() => {
    const last = grants[grants.length - 1];
    return last ? mandatoryLeaveStatus(last, taken, asOf) : null;
  }, [grants, taken, asOf]);

  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 16 }}>
        入社日から法定の付与日数を計算し、<strong>古い付与から消化</strong>して残日数を出します。
        年 5 日の取得義務の不足も分かります。
      </p>

      <div style={box}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={lb}>入社日<Input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} /></label>
          <label style={lb}>基準日<Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></label>
        </div>
      </div>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>残日数</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <Badge variant={balance.remaining > 0 ? "success" : "danger"}>残り {balance.remaining} 日</Badge>
          <Badge variant="secondary">付与 {balance.granted} 日</Badge>
          <Badge variant="secondary">取得 {balance.taken} 日</Badge>
          {balance.expired > 0 && <Badge variant="warning">時効で消滅 {balance.expired} 日</Badge>}
        </div>
        {balance.nextExpiry && (
          <div style={{ fontSize: 12.5, color: "var(--color-muted)" }}>
            次に失効: <b>{balance.nextExpiry.date}</b> に {balance.nextExpiry.days} 日
            <span style={{ marginLeft: 8 }}>（付与から 2 年で消えます）</span>
          </div>
        )}
      </div>

      {duty?.required && (
        <div style={{ marginBottom: 16 }}>
          <Alert variant={duty.shortage > 0 ? "warning" : "success"} title="年 5 日の取得義務（労基法 第39条第7項）">
            {duty.shortage > 0
              ? <>期限 <b>{duty.deadline}</b> までに、あと <b>{duty.shortage} 日</b>取らせる必要があります（取得済み {duty.takenDays} 日）。
                  <div style={{ fontSize: 12, marginTop: 6 }}>満たせないと<strong>会社側の違反</strong>になります。期限が近い人を早めに把握してください。</div></>
              : <>取得済み {duty.takenDays} 日。義務を満たしています。</>}
          </Alert>
        </div>
      )}

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>付与の履歴</div>
        <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: 460 }}>
          <thead><tr><th style={th}>付与日</th><th style={th}>日数</th><th style={th}>失効日</th></tr></thead>
          <tbody>
            {grants.length === 0 ? (
              <tr><td style={{ ...td, color: "var(--color-muted)" }} colSpan={3}>まだ付与されていません（入社 6 か月後に初回）</td></tr>
            ) : grants.map((g) => (
              <tr key={g.grantedOn} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={td}>{g.grantedOn}</td>
                <td style={td}>{g.days} 日</td>
                <td style={{ ...td, color: g.expiresOn <= asOf ? "var(--color-danger, #c00)" : undefined }}>
                  {g.expiresOn}{g.expiresOn <= asOf ? "（失効済み）" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 8, lineHeight: 1.8 }}>
          6 か月で {statutoryLeaveDays(0.5)} 日、以降 1 年ごとに増え、6 年半以降は {statutoryLeaveDays(7)} 日で頭打ちです。
        </p>
      </div>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>取得の履歴</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
          <label style={lb}>取得日<Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          <label style={lb}>日数<Input type="number" step="0.5" value={form.days} onChange={(e) => setForm({ ...form, days: Number(e.target.value) || 0 })} style={{ width: 90 }} /></label>
          <Button onClick={() => setTaken([...taken, { ...form }].sort((a, b) => (a.date < b.date ? -1 : 1)))}>追加</Button>
          <Button variant="secondary" onClick={() => setTaken(SEED)}>初期状態</Button>
        </div>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
          {taken.map((t, i) => (
            <li key={`${t.date}-${i}`} style={{ fontSize: 12.5, display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontFamily: "monospace" }}>{t.date}</span>
              <span>{t.days} 日</span>
              <Button size="sm" variant="ghost" onClick={() => setTaken(taken.filter((_, j) => j !== i))}>取り消す</Button>
            </li>
          ))}
        </ul>
      </div>

      <Alert variant="info" title="古い付与から消化する理由">
        新しい分から使うと、古い分が時効（2 年）で消えます。つまり<strong>実質的に日数を捨てる</strong>ことになるため、
        基盤では必ず古い付与から充てます。「基準日を統一する運用（全社員 4/1 付与）」の場合は、
        付与記録を直接持つ形にしてください。
      </Alert>
    </div>
  );
}
