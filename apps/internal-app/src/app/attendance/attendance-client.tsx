"use client";
/** 勤怠。月を選んで勤務表を表示（実働・残業・深夜・休日）、打刻を記録、月次集計。 */
import * as React from "react";

interface Day { date: string; clockIn: string; clockOut: string; breakMinutes?: number; isHoliday?: boolean; totalMinutes: number; overtimeMinutes: number; nightMinutes: number; holidayMinutes: number; }
interface Approval { status: string; submittedAt: string; history: { action: string; actor: string }[]; }
interface Summary { month: string; days: Day[]; totalMinutes: number; overtimeMinutes: number; nightMinutes: number; holidayMinutes: number; approval?: Approval | null; }
const APPROVAL_LABEL: Record<string, { label: string; cls: string }> = { pending: { label: "承認待ち", cls: "bg-amber-100 text-amber-800" }, approved: { label: "承認済", cls: "bg-green-100 text-green-800" }, rejected: { label: "却下", cls: "bg-red-100 text-red-800" } };

const hm = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;

function thisMonth(): string { return new Date().toISOString().slice(0, 7); }

export interface AttendanceClientProps { fetchImpl?: typeof fetch; }

export function AttendanceClient({ fetchImpl }: AttendanceClientProps) {
  const [month, setMonth] = React.useState(thisMonth());
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [form, setForm] = React.useState({ date: "", clockIn: "09:00", clockOut: "18:00", breakMinutes: "60", isHoliday: false });
  const [error, setError] = React.useState("");
  const [msg, setMsg] = React.useState("");
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  const reload = React.useCallback(async () => {
    const res = await doFetch(`/api/attendance?month=${month}`);
    if (res.ok) setSummary((await res.json()) as Summary);
  }, [doFetch, month]);
  React.useEffect(() => { void reload(); }, [reload]);

  const submitMonth = async () => {
    setMsg(""); setError("");
    const res = await doFetch("/api/attendance/submit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ month }) });
    if (res.ok) { setMsg("当月を上長承認へ申請しました"); await reload(); }
    else setError(((await res.json()) as { error?: string }).error ?? "申請に失敗しました");
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
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">勤怠</h1>
        <div className="flex items-center gap-2">
          {summary?.approval && <span className={`rounded px-2 py-0.5 text-xs ${APPROVAL_LABEL[summary.approval.status]?.cls ?? ""}`}>{APPROVAL_LABEL[summary.approval.status]?.label ?? summary.approval.status}</span>}
          {(!summary?.approval || summary.approval.status === "rejected") && <button onClick={submitMonth} className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white">月次を申請</button>}
          <input type="month" value={month} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMonth(e.target.value)} className="rounded border border-neutral-300 px-2 py-1 text-sm" />
        </div>
      </div>
      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {msg && <p className="mb-3 rounded bg-green-50 px-3 py-2 text-sm text-green-700">{msg}</p>}

      {summary && (
        <div className="mb-4 grid grid-cols-4 gap-2 text-center text-sm">
          <div className="rounded bg-neutral-50 p-3"><div className="text-xs text-neutral-500">実労働</div><div className="font-medium">{hm(summary.totalMinutes)}</div></div>
          <div className="rounded bg-amber-50 p-3"><div className="text-xs text-amber-700">時間外</div><div className="font-medium">{hm(summary.overtimeMinutes)}</div></div>
          <div className="rounded bg-indigo-50 p-3"><div className="text-xs text-indigo-700">深夜</div><div className="font-medium">{hm(summary.nightMinutes)}</div></div>
          <div className="rounded bg-red-50 p-3"><div className="text-xs text-red-700">法定休日</div><div className="font-medium">{hm(summary.holidayMinutes)}</div></div>
        </div>
      )}

      <div className="mb-6 rounded border border-neutral-200 p-4">
        <h2 className="mb-3 text-sm font-medium">打刻を記録</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-neutral-500">日付<input type="date" value={form.date} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, date: e.target.value })} className="mt-0.5 block rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
          <label className="text-xs text-neutral-500">出勤<input type="time" value={form.clockIn} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, clockIn: e.target.value })} className="mt-0.5 block rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
          <label className="text-xs text-neutral-500">退勤<input type="time" value={form.clockOut} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, clockOut: e.target.value })} className="mt-0.5 block rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
          <label className="text-xs text-neutral-500">休憩(分)<input value={form.breakMinutes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, breakMinutes: e.target.value })} inputMode="numeric" className="mt-0.5 block w-20 rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
          <label className="flex items-center gap-1 text-xs text-neutral-600"><input type="checkbox" checked={form.isHoliday} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, isHoliday: e.target.checked })} />法定休日</label>
          <button onClick={submit} className="rounded bg-neutral-900 px-4 py-1.5 text-sm text-white">記録</button>
        </div>
        <p className="mt-2 text-xs text-neutral-400">退勤が出勤より前の場合は日をまたぐ勤務として扱います。深夜は 22:00〜翌5:00。</p>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
            <th className="px-2 py-1">日付</th><th className="px-2 py-1">出勤</th><th className="px-2 py-1">退勤</th><th className="px-2 py-1 text-right">休憩</th>
            <th className="px-2 py-1 text-right">実働</th><th className="px-2 py-1 text-right">時間外</th><th className="px-2 py-1 text-right">深夜</th><th className="px-2 py-1">区分</th>
          </tr>
        </thead>
        <tbody>
          {(summary?.days ?? []).map((d) => (
            <tr key={d.date} className="border-b border-neutral-100">
              <td className="px-2 py-2">{d.date}</td>
              <td className="px-2 py-2">{d.clockIn}</td>
              <td className="px-2 py-2">{d.clockOut}</td>
              <td className="px-2 py-2 text-right text-neutral-500">{d.breakMinutes ?? 0}分</td>
              <td className="px-2 py-2 text-right font-medium">{hm(d.totalMinutes)}</td>
              <td className="px-2 py-2 text-right">{d.overtimeMinutes > 0 ? <span className="text-amber-700">{hm(d.overtimeMinutes)}</span> : "—"}</td>
              <td className="px-2 py-2 text-right">{d.nightMinutes > 0 ? <span className="text-indigo-700">{hm(d.nightMinutes)}</span> : "—"}</td>
              <td className="px-2 py-2">{d.isHoliday && <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">休日</span>}</td>
            </tr>
          ))}
          {(summary?.days.length ?? 0) === 0 && <tr><td colSpan={8} className="px-2 py-4 text-center text-sm text-neutral-500">この月の打刻はありません。</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
