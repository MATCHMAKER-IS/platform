"use client";
/** 給与。本人の月次給与明細（基本・割増・手当・控除・差引支給）を表示。管理者は時給・手当・控除を設定。 */
import * as React from "react";

interface Item { name: string; amount: number; }
interface Breakdown { base: number; overtimePremium: number; over60Premium: number; nightPremium: number; holidayPay: number; total: number; }
interface Payslip { base: number; premiums: number; allowances: Item[]; grossPay: number; deductions: Item[]; totalDeductions: number; netPay: number; }
interface Attendance { totalMinutes: number; overtimeMinutes: number; nightMinutes: number; holidayMinutes: number; over60Minutes: number; workedDays: number; }
interface PayrollResult { month: string; userId: string; hourlyWage: number; attendance: Attendance; breakdown: Breakdown; payslip: Payslip; }
interface WageConfig { userId: string; hourlyWage: number; allowances: Item[]; deductions: Item[]; }

const yen = (n: number) => `¥${n.toLocaleString()}`;
const hm = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
const thisMonth = () => new Date().toISOString().slice(0, 7);

export interface PayrollClientProps { fetchImpl?: typeof fetch; canAdmin?: boolean; }

export function PayrollClient({ fetchImpl, canAdmin = false }: PayrollClientProps) {
  const [month, setMonth] = React.useState(thisMonth());
  const [result, setResult] = React.useState<PayrollResult | null>(null);
  const [wages, setWages] = React.useState<WageConfig[]>([]);
  const [wageForm, setWageForm] = React.useState({ userId: "", hourlyWage: "2000" });
  const [error, setError] = React.useState("");
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  const reload = React.useCallback(async () => {
    const res = await doFetch(`/api/payroll?month=${month}`);
    if (res.ok) setResult((await res.json()) as PayrollResult);
    if (canAdmin) { const w = await doFetch("/api/payroll/wage"); if (w.ok) setWages(((await w.json()) as { wages: WageConfig[] }).wages); }
  }, [doFetch, month, canAdmin]);
  React.useEffect(() => { void reload(); }, [reload]);

  const saveWage = async () => {
    setError("");
    if (!wageForm.userId || !(Number(wageForm.hourlyWage) > 0)) { setError("従業員IDと正の時給を入力してください"); return; }
    const res = await doFetch("/api/payroll/wage", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: wageForm.userId, hourlyWage: Number(wageForm.hourlyWage), allowances: [], deductions: [] }) });
    if (res.ok) { setWageForm({ userId: "", hourlyWage: "2000" }); await reload(); }
    else setError(((await res.json()) as { error?: string }).error ?? "保存に失敗しました");
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">給与</h1>
        <input type="month" value={month} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMonth(e.target.value)} className="rounded border border-neutral-300 px-2 py-1 text-sm" />
      </div>
      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {result && (
        <div className="mb-6 rounded border border-neutral-200 p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-sm text-neutral-500">{result.month}・時給 {yen(result.hourlyWage)}・{result.attendance.workedDays}日勤務</span>
            <span className="text-lg font-bold">差引支給 {yen(result.payslip.netPay)}</span>
          </div>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-neutral-100"><td className="py-1.5 text-neutral-600">基本賃金（実労働 {hm(result.attendance.totalMinutes - result.attendance.holidayMinutes)}）</td><td className="py-1.5 text-right">{yen(result.breakdown.base)}</td></tr>
              <tr className="border-b border-neutral-100"><td className="py-1.5 text-neutral-600">時間外割増（{hm(result.attendance.overtimeMinutes)}）</td><td className="py-1.5 text-right">{yen(result.breakdown.overtimePremium)}</td></tr>
              {result.breakdown.over60Premium > 0 && <tr className="border-b border-neutral-100"><td className="py-1.5 text-neutral-600">月60h超割増（{hm(result.attendance.over60Minutes)}）</td><td className="py-1.5 text-right">{yen(result.breakdown.over60Premium)}</td></tr>}
              <tr className="border-b border-neutral-100"><td className="py-1.5 text-neutral-600">深夜割増（{hm(result.attendance.nightMinutes)}）</td><td className="py-1.5 text-right">{yen(result.breakdown.nightPremium)}</td></tr>
              {result.breakdown.holidayPay > 0 && <tr className="border-b border-neutral-100"><td className="py-1.5 text-neutral-600">法定休日（{hm(result.attendance.holidayMinutes)}）</td><td className="py-1.5 text-right">{yen(result.breakdown.holidayPay)}</td></tr>}
              {result.payslip.allowances.map((a) => <tr key={a.name} className="border-b border-neutral-100"><td className="py-1.5 text-neutral-600">{a.name}</td><td className="py-1.5 text-right">{yen(a.amount)}</td></tr>)}
              <tr className="border-b-2 border-neutral-300 font-medium"><td className="py-1.5">総支給額</td><td className="py-1.5 text-right">{yen(result.payslip.grossPay)}</td></tr>
              {result.payslip.deductions.map((d) => <tr key={d.name} className="border-b border-neutral-100"><td className="py-1.5 text-neutral-600">（控除）{d.name}</td><td className="py-1.5 text-right text-red-600">-{yen(d.amount)}</td></tr>)}
              {result.payslip.totalDeductions > 0 && <tr className="border-b border-neutral-100"><td className="py-1.5 text-neutral-500">控除合計</td><td className="py-1.5 text-right text-red-600">-{yen(result.payslip.totalDeductions)}</td></tr>}
              <tr className="font-bold"><td className="py-2">差引支給額</td><td className="py-2 text-right">{yen(result.payslip.netPay)}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {canAdmin && (
        <div className="rounded border border-neutral-200 p-4">
          <h2 className="mb-3 text-sm font-medium">給与設定（管理）</h2>
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <label className="text-xs text-neutral-500">従業員ID（メール）<input value={wageForm.userId} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWageForm({ ...wageForm, userId: e.target.value })} placeholder="taro@example.com" className="mt-0.5 block rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
            <label className="text-xs text-neutral-500">時給<input value={wageForm.hourlyWage} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWageForm({ ...wageForm, hourlyWage: e.target.value })} inputMode="numeric" className="mt-0.5 block w-24 rounded border border-neutral-300 px-2 py-1 text-sm" /></label>
            <button onClick={saveWage} className="rounded bg-neutral-900 px-4 py-1.5 text-sm text-white">保存</button>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-neutral-200 text-left text-xs text-neutral-500"><th className="px-2 py-1">従業員</th><th className="px-2 py-1 text-right">時給</th></tr></thead>
            <tbody>
              {wages.map((w) => <tr key={w.userId} className="border-b border-neutral-100"><td className="px-2 py-1.5">{w.userId}</td><td className="px-2 py-1.5 text-right">{yen(w.hourlyWage)}</td></tr>)}
              {wages.length === 0 && <tr><td colSpan={2} className="px-2 py-3 text-center text-neutral-500">設定がありません（未登録者は時給 ¥2,000 で計算）。</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
