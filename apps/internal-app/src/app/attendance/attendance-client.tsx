"use client";
/** 勤怠。月を選んで勤務表を表示（実働・残業・深夜・休日）、打刻を記録、月次集計。 */
import * as React from "react";
import { Button, Checkbox, Input, PageShell } from "@platform/ui";
import { formatMonthJst } from "@platform/datetime";

interface Day {
  date: string;
  clockIn: string;
  clockOut: string;
  breakMinutes?: number;
  isHoliday?: boolean;
  totalMinutes: number;
  overtimeMinutes: number;
  nightMinutes: number;
  holidayMinutes: number;
}
interface Approval { status: string; submittedAt: string; history: { action: string; actor: string }[]; }
interface Summary { month: string; days: Day[]; totalMinutes: number; overtimeMinutes: number; nightMinutes: number; holidayMinutes: number; approval?: Approval | null; }
/** 36 協定の判定 1 件(`@platform/attendance` の `OvertimeViolation` と同じ形)。 */
interface Violation { kind: string; severity: "violation" | "warning"; month: string; message: string; actualMinutes: number; }
/** 上限までの残り。**「あと何時間」が分かるのは上限に達する前だけ**。 */
interface Remaining { remainingMinutes: number; binding: string }
interface LimitsView { violations: Violation[]; remaining: Remaining | null; summary: { violation: number; warning: number } }
const APPROVAL_LABEL: Record<string, { label: string; cls: string }> = { pending: { label: "承認待ち", cls: "bg-[color-mix(in_srgb,var(--color-warning)_15%,transparent)] text-[var(--color-warning)]" }, approved: { label: "承認済", cls: "bg-[color-mix(in_srgb,var(--color-success)_15%,transparent)] text-[var(--color-success)]" }, rejected: { label: "却下", cls: "bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)] text-[var(--color-danger)]" } };

const hm = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;

function thisMonth(): string { return formatMonthJst(); }

export interface AttendanceClientProps { fetchImpl?: typeof fetch; }

export function AttendanceClient({ fetchImpl }: AttendanceClientProps) {
  const [month, setMonth] = React.useState(thisMonth());
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [form, setForm] = React.useState({ date: "", clockIn: "09:00", clockOut: "18:00", breakMinutes: "60", isHoliday: false });
  const [error, setError] = React.useState("");
  const [msg, setMsg] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  // **36 協定の上限。** 月末に集計して気づいても、その月は終わっている。
  // 基盤に `checkOvertimeLimits` があるのに、2026-08 まで呼ばれていなかった。
  const [limits, setLimits] = React.useState<LimitsView | null>(null);
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  const reload = React.useCallback(async () => {
    const res = await doFetch(`/api/attendance?month=${month}`);
    if (res.ok) setSummary((await res.json()) as Summary);
  }, [doFetch, month]);
  React.useEffect(() => { void reload(); }, [reload]);

  // **上限は月に依存しない**(直近 12 か月で判定する)ので、月の切り替えでは読み直さない。
  React.useEffect(() => {
    void (async () => {
      const res = await doFetch("/api/attendance/overtime-limits");
      if (res.ok) setLimits((await res.json()) as LimitsView);
    })();
  }, [doFetch]);

  const submitMonth = async () => {
    // **押した後に反応を見せる。** 見えないと二重に押され、申請が 2 件になる
    setBusy(true);
    setMsg(""); setError("");
    try {
      const res = await doFetch("/api/attendance/submit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ month }) });
      if (res.ok) { setMsg("当月を上長承認へ申請しました"); await reload(); }
      else setError(((await res.json()) as { error?: string }).error ?? "申請に失敗しました");
    } catch {
      setError("通信に失敗しました。ネットワークを確認してください");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setError("");
    if (!form.date) { setError("日付を入力してください"); return; }
    const body = { date: form.date, clockIn: form.clockIn, clockOut: form.clockOut, breakMinutes: Number(form.breakMinutes) || 0, isHoliday: form.isHoliday };
    const res = await doFetch("/api/attendance", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { setForm({ ...form, date: "" }); await reload(); }
    else setError(((await res.json()) as { error?: string }).error ?? "記録に失敗しました");
  };

  return (
    <PageShell title="勤怠" width="wide">
        <div className="flex items-center gap-2">
          {summary?.approval && <span className={`rounded px-2 py-0.5 text-xs ${APPROVAL_LABEL[summary.approval.status]?.cls ?? ""}`}>{APPROVAL_LABEL[summary.approval.status]?.label ?? summary.approval.status}</span>}
     {(!summary?.approval || summary.approval.status === "rejected") && <Button loading={busy} onClick={submitMonth} className="rounded px-3 py-1.5 text-sm text-white">月次を申請</Button>}
          <Input aria-label="対象の月" type="month" value={month} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMonth(e.target.value)} className="rounded border border-[var(--color-border)] px-2 py-1 text-sm" />
        </div>
      {error && <p className="mb-3 rounded bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p>}
      {msg && <p className="mb-3 rounded bg-[color-mix(in_srgb,var(--color-success)_8%,transparent)] px-3 py-2 text-sm text-[var(--color-success)]">{msg}</p>}

      {limits && (limits.violations.length > 0 || limits.remaining) && (
        <div className="mb-4 rounded border border-[var(--color-border)] p-3">
          <h2 className="mb-2 text-sm font-medium">
            時間外労働の上限（36 協定）
            {limits.summary.violation > 0 && (
              <span className="ml-2 rounded bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)] px-2 py-0.5 text-xs text-[var(--color-danger)]">
                違反 {limits.summary.violation} 件
              </span>
            )}
            {limits.summary.warning > 0 && (
              <span className="ml-2 rounded bg-[color-mix(in_srgb,var(--color-warning)_15%,transparent)] px-2 py-0.5 text-xs text-[var(--color-warning)]">
                注意 {limits.summary.warning} 件
              </span>
            )}
          </h2>

          {/* **「あと何時間」を常に見せる。** 上限に達してから知らせても、
              その月の業務はもう終わっている。割り振りを変えられるのは今だけ。 */}
          {limits.remaining && (
            <p className="mb-2 text-sm">
              今月あと{" "}
              <strong className={limits.remaining.remainingMinutes < 10 * 60 ? "text-[var(--color-danger)]" : ""}>
                {hm(Math.max(0, limits.remaining.remainingMinutes))}
              </strong>{" "}
              残業できます
              <span className="ml-1 text-xs text-[var(--color-muted)]">（{limits.remaining.binding} の規制で決まっています）</span>
            </p>
          )}

          {/* **深刻な順に並んでいる**ので、そのまま上から出す */}
          <ul className="space-y-1 text-sm">
            {limits.violations.slice(0, 5).map((v, i) => (
              <li
                key={`${v.kind}-${v.month}-${i}`}
                className={v.severity === "violation" ? "text-[var(--color-danger)]" : "text-[var(--color-warning)]"}
              >
                {v.severity === "violation" ? "⚠ " : "△ "}
                {v.month}: {v.message}
              </li>
            ))}
          </ul>
          {limits.violations.length > 5 && (
            <p className="mt-1 text-xs text-[var(--color-muted)]">ほか {limits.violations.length - 5} 件</p>
          )}
        </div>
      )}

      {summary && (
        <div className="mb-4 grid grid-cols-4 gap-2 text-center text-sm">
          <div className="rounded bg-[var(--color-subtle)] p-3"><div className="text-xs text-[var(--color-muted)]">実労働</div><div className="font-medium">{hm(summary.totalMinutes)}</div></div>
          <div className="rounded bg-[color-mix(in_srgb,var(--color-warning)_8%,transparent)] p-3"><div className="text-xs text-[var(--color-warning)]">時間外</div><div className="font-medium">{hm(summary.overtimeMinutes)}</div></div>
          <div className="rounded bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)] p-3"><div className="text-xs text-[var(--color-primary)]">深夜</div><div className="font-medium">{hm(summary.nightMinutes)}</div></div>
          <div className="rounded bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] p-3"><div className="text-xs text-[var(--color-danger)]">法定休日</div><div className="font-medium">{hm(summary.holidayMinutes)}</div></div>
        </div>
      )}

      <div className="mb-6 rounded border border-[var(--color-border)] p-4">
        <h2 className="mb-3 text-sm font-medium">打刻を記録</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-[var(--color-muted)]">日付<Input type="date" value={form.date} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, date: e.target.value })} className="mt-0.5 block rounded border border-[var(--color-border)] px-2 py-1 text-sm" /></label>
          <label className="text-xs text-[var(--color-muted)]">出勤<Input type="time" value={form.clockIn} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, clockIn: e.target.value })} className="mt-0.5 block rounded border border-[var(--color-border)] px-2 py-1 text-sm" /></label>
          <label className="text-xs text-[var(--color-muted)]">退勤<Input type="time" value={form.clockOut} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, clockOut: e.target.value })} className="mt-0.5 block rounded border border-[var(--color-border)] px-2 py-1 text-sm" /></label>
          <label className="text-xs text-[var(--color-muted)]">休憩(分)<Input value={form.breakMinutes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, breakMinutes: e.target.value })} inputMode="numeric" className="mt-0.5 block w-20 rounded border border-[var(--color-border)] px-2 py-1 text-sm" /></label>
          <label className="flex items-center gap-1 text-xs text-[var(--color-muted)]"><Checkbox  checked={form.isHoliday} onCheckedChange={(v) => setForm({ ...form, isHoliday: !!v })} />法定休日</label>
     <Button onClick={submit} className="rounded px-4 py-1.5 text-sm text-white">記録</Button>
        </div>
        <p className="mt-2 text-xs text-[var(--color-muted)]">退勤が出勤より前の場合は日をまたぐ勤務として扱います。深夜は 22:00〜翌5:00。</p>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted)]">
            <th className="px-2 py-1">日付</th><th className="px-2 py-1">出勤</th><th className="px-2 py-1">退勤</th><th className="px-2 py-1 text-right">休憩</th>
            <th className="px-2 py-1 text-right">実働</th><th className="px-2 py-1 text-right">時間外</th><th className="px-2 py-1 text-right">深夜</th><th className="px-2 py-1">区分</th>
          </tr>
        </thead>
        <tbody>
          {(summary?.days ?? []).map((d) => (
            <tr key={d.date} className="border-b border-[var(--color-border)]">
              <td className="px-2 py-2">{d.date}</td>
              <td className="px-2 py-2">{d.clockIn}</td>
              <td className="px-2 py-2">{d.clockOut}</td>
              <td className="px-2 py-2 text-right text-[var(--color-muted)]">{d.breakMinutes ?? 0}分</td>
              <td className="px-2 py-2 text-right font-medium">{hm(d.totalMinutes)}</td>
              <td className="px-2 py-2 text-right">{d.overtimeMinutes > 0 ? <span className="text-[var(--color-warning)]">{hm(d.overtimeMinutes)}</span> : "—"}</td>
              <td className="px-2 py-2 text-right">{d.nightMinutes > 0 ? <span className="text-[var(--color-primary)]">{hm(d.nightMinutes)}</span> : "—"}</td>
              <td className="px-2 py-2">{d.isHoliday && <span className="rounded bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)] px-1.5 py-0.5 text-xs text-[var(--color-danger)]">休日</span>}</td>
            </tr>
          ))}
          {(summary?.days.length ?? 0) === 0 && <tr><td colSpan={8} className="px-2 py-4 text-center text-sm text-[var(--color-muted)]">この月の打刻はありません。</td></tr>}
        </tbody>
      </table>
    </PageShell>
  );
}
