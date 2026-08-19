"use client";
/** 給与。本人の月次給与明細（基本・割増・手当・控除・差引支給）を表示。管理者は時給・手当・控除を設定。 */
import * as React from "react";
import { formatYen } from "@platform/report";
import { formatMonthJst } from "@platform/datetime";
import { Button, Input, PageShell } from "@platform/ui";

interface Item { name: string; amount: number; }
interface Breakdown { base: number; overtimePremium: number; over60Premium: number; nightPremium: number; holidayPay: number; total: number; }
interface Payslip { base: number; premiums: number; allowances: Item[]; grossPay: number; deductions: Item[]; totalDeductions: number; netPay: number; }
interface Attendance { totalMinutes: number; overtimeMinutes: number; nightMinutes: number; holidayMinutes: number; over60Minutes: number; workedDays: number; }
interface PayrollResult {
  month: string;
  userId: string;
  hourlyWage: number;
  attendance: Attendance;
  breakdown: Breakdown;
  payslip: Payslip;
  insurance?: { health: number; longTermCare: number; pension: number; employmentInsurance: number; total: number };
}
interface WageConfig { userId: string; hourlyWage: number; allowances: Item[]; deductions: Item[]; }

const yen = (n: number) => formatYen(n);
const hm = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
const thisMonth = () => formatMonthJst();

export interface PayrollClientProps { fetchImpl?: typeof fetch; canAdmin?: boolean; }

export function PayrollClient({ fetchImpl, canAdmin = false }: PayrollClientProps) {
  const [month, setMonth] = React.useState(thisMonth());
  const [result, setResult] = React.useState<PayrollResult | null>(null);
  const [wages, setWages] = React.useState<WageConfig[]>([]);
  const [wageForm, setWageForm] = React.useState({ userId: "", hourlyWage: "2000" });
  // **プロファイル(生年月日・扶養人数)は賃金と別フォームにする。**
  // 個人情報を扱う入力なので、時給の設定とは操作を分けて誤入力を減らす。
  const [profileForm, setProfileForm] = React.useState({ userId: "", birthDate: "", dependents: "0" });
  // **一括PDF生成は非同期。** ジョブIDを受けたら、進捗をポーリングで見る
  // (画面を待たせない設計——同期処理だと全社員分の生成中リクエストが固まる)。
  interface BatchJob { id: string; status: "queued" | "running" | "done" | "failed"; total: number; completed: number; failed: number; failedUserIds: string[]; }
  const [batchJob, setBatchJob] = React.useState<BatchJob | null>(null);
  const [batchError, setBatchError] = React.useState("");
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

  const saveProfile = async () => {
    setError("");
    if (!profileForm.userId || !/^\d{4}-\d{2}-\d{2}$/.test(profileForm.birthDate)) {
      setError("従業員IDと生年月日(YYYY-MM-DD)を入力してください"); return;
    }
    const res = await doFetch("/api/payroll/profile", {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: profileForm.userId, birthDate: profileForm.birthDate, dependents: Number(profileForm.dependents) }),
    });
    if (res.ok) { setProfileForm({ userId: "", birthDate: "", dependents: "0" }); await reload(); }
    else setError(((await res.json()) as { error?: string }).error ?? "保存に失敗しました");
  };

  const startBatch = async () => {
    setBatchError(""); setBatchJob(null);
    const res = await doFetch("/api/payroll/batch", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ month }),
    });
    const d = (await res.json().catch(() => ({}))) as { jobId?: string; total?: number; error?: string };
    if (!res.ok || !d.jobId) { setBatchError(d.error ?? "開始に失敗しました"); return; }
    setBatchJob({ id: d.jobId, status: "queued", total: d.total ?? 0, completed: 0, failed: 0, failedUserIds: [] });
  };

  // **ポーリングで進捗を追う。** 終了(done/failed)したら止める——
  // 終わったジョブを叩き続けるのは無駄で、サーバへの負荷にもなる。
  React.useEffect(() => {
    if (!batchJob || batchJob.status === "done" || batchJob.status === "failed") return;
    const timer = setInterval(async () => {
      const res = await doFetch(`/api/payroll/batch/${batchJob.id}`);
      if (res.ok) setBatchJob((await res.json()) as BatchJob);
    }, 2000);
    return () => clearInterval(timer);
  }, [batchJob, doFetch]);

  return (
    <PageShell title="給与">
        <Input type="month" value={month} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMonth(e.target.value)} className="rounded border border-[var(--color-border)] px-2 py-1 text-sm" />
      {error && <p className="mb-3 rounded bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p>}

      {result && !result.insurance && (
        <p className="mb-3 rounded bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)] px-3 py-2 text-sm text-[var(--color-warning)]">
          社会保険料は<strong>未計算</strong>です。生年月日・扶養人数が未登録のため、
          健康保険・厚生年金・雇用保険を控除に含めていません。管理者に登録を依頼してください。
        </p>
      )}

      {result && (
        <div className="mb-6 rounded border border-[var(--color-border)] p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-sm text-[var(--color-muted)]">{result.month}・時給 {yen(result.hourlyWage)}・{result.attendance.workedDays}日勤務</span>
            <span className="text-lg font-bold">差引支給 {yen(result.payslip.netPay)}</span>
          </div>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-[var(--color-border)]"><td className="py-1.5 text-[var(--color-muted)]">基本賃金（実労働 {hm(result.attendance.totalMinutes - result.attendance.holidayMinutes)}）</td><td className="py-1.5 text-right">{yen(result.breakdown.base)}</td></tr>
              <tr className="border-b border-[var(--color-border)]"><td className="py-1.5 text-[var(--color-muted)]">時間外割増（{hm(result.attendance.overtimeMinutes)}）</td><td className="py-1.5 text-right">{yen(result.breakdown.overtimePremium)}</td></tr>
              {result.breakdown.over60Premium > 0 && <tr className="border-b border-[var(--color-border)]"><td className="py-1.5 text-[var(--color-muted)]">月60h超割増（{hm(result.attendance.over60Minutes)}）</td><td className="py-1.5 text-right">{yen(result.breakdown.over60Premium)}</td></tr>}
              <tr className="border-b border-[var(--color-border)]"><td className="py-1.5 text-[var(--color-muted)]">深夜割増（{hm(result.attendance.nightMinutes)}）</td><td className="py-1.5 text-right">{yen(result.breakdown.nightPremium)}</td></tr>
              {result.breakdown.holidayPay > 0 && <tr className="border-b border-[var(--color-border)]"><td className="py-1.5 text-[var(--color-muted)]">法定休日（{hm(result.attendance.holidayMinutes)}）</td><td className="py-1.5 text-right">{yen(result.breakdown.holidayPay)}</td></tr>}
              {result.payslip.allowances.map((a) => <tr key={a.name} className="border-b border-[var(--color-border)]"><td className="py-1.5 text-[var(--color-muted)]">{a.name}</td><td className="py-1.5 text-right">{yen(a.amount)}</td></tr>)}
              <tr className="border-b-2 border-[var(--color-border)] font-medium"><td className="py-1.5">総支給額</td><td className="py-1.5 text-right">{yen(result.payslip.grossPay)}</td></tr>
              {result.payslip.deductions.map((d) => <tr key={d.name} className="border-b border-[var(--color-border)]"><td className="py-1.5 text-[var(--color-muted)]">（控除）{d.name}</td><td className="py-1.5 text-right text-[var(--color-danger)]">-{yen(d.amount)}</td></tr>)}
              {result.payslip.totalDeductions > 0 && <tr className="border-b border-[var(--color-border)]"><td className="py-1.5 text-[var(--color-muted)]">控除合計</td><td className="py-1.5 text-right text-[var(--color-danger)]">-{yen(result.payslip.totalDeductions)}</td></tr>}
              <tr className="font-bold"><td className="py-2">差引支給額</td><td className="py-2 text-right">{yen(result.payslip.netPay)}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {canAdmin && (
        <div className="rounded border border-[var(--color-border)] p-4">
          <h2 className="mb-3 text-sm font-medium">給与設定（管理）</h2>
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <label className="text-xs text-[var(--color-muted)]">従業員ID（メール）<Input value={wageForm.userId} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWageForm({ ...wageForm, userId: e.target.value })} placeholder="taro@example.com" className="mt-0.5 block rounded border border-[var(--color-border)] px-2 py-1 text-sm" /></label>
            <label className="text-xs text-[var(--color-muted)]">時給<Input value={wageForm.hourlyWage} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWageForm({ ...wageForm, hourlyWage: e.target.value })} inputMode="numeric" className="mt-0.5 block w-24 rounded border border-[var(--color-border)] px-2 py-1 text-sm" /></label>
      <Button onClick={saveWage} className="rounded px-4 py-1.5 text-sm text-white">保存</Button>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted)]"><th className="px-2 py-1">従業員</th><th className="px-2 py-1 text-right">時給</th></tr></thead>
            <tbody>
              {wages.map((w) => <tr key={w.userId} className="border-b border-[var(--color-border)]"><td className="px-2 py-1.5">{w.userId}</td><td className="px-2 py-1.5 text-right">{yen(w.hourlyWage)}</td></tr>)}
              {wages.length === 0 && <tr><td colSpan={2} className="px-2 py-3 text-center text-[var(--color-muted)]">設定がありません（未登録者は時給 ¥2,000 で計算）。</td></tr>}
            </tbody>
          </table>

          <h2 className="mb-3 mt-6 text-sm font-medium">
            社会保険料の算出用プロファイル
            <span className="ml-2 text-xs font-normal text-[var(--color-muted)]">生年月日・扶養人数（未登録なら社会保険料は控除されません）</span>
          </h2>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-[var(--color-muted)]">従業員ID（メール）<Input value={profileForm.userId} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfileForm({ ...profileForm, userId: e.target.value })} placeholder="taro@example.com" className="mt-0.5 block rounded border border-[var(--color-border)] px-2 py-1 text-sm" /></label>
            <label className="text-xs text-[var(--color-muted)]">生年月日<Input type="date" value={profileForm.birthDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfileForm({ ...profileForm, birthDate: e.target.value })} className="mt-0.5 block rounded border border-[var(--color-border)] px-2 py-1 text-sm" /></label>
            <label className="text-xs text-[var(--color-muted)]">扶養人数<Input value={profileForm.dependents} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfileForm({ ...profileForm, dependents: e.target.value })} inputMode="numeric" className="mt-0.5 block w-16 rounded border border-[var(--color-border)] px-2 py-1 text-sm" /></label>
            <Button onClick={saveProfile} className="rounded px-4 py-1.5 text-sm text-white">保存</Button>
          </div>
          {/* **機微な個人情報なので一覧は出さない。** 時給と違い、誰がいくらの
              生年月日・扶養人数かを一覧で見せる必要は無い(必要な人だけ都度確認する)。 */}

          <h2 className="mb-3 mt-6 text-sm font-medium">給与明細の一括 PDF 出力</h2>
          <p className="mb-3 text-xs text-[var(--color-muted)]">
            全社員分の給与明細を PDF にまとめて生成します。人数が多いと数分かかるため、進捗をここで確認できます。
          </p>
          <Button onClick={() => void startBatch()} disabled={batchJob !== null && batchJob.status !== "done" && batchJob.status !== "failed"}>
            {month} 分を一括出力する
          </Button>
          {batchError && <p className="mt-2 text-sm text-[var(--color-danger)]">{batchError}</p>}
          {batchJob && (
            <div className="mt-3 rounded border border-[var(--color-border)] p-3 text-sm">
              <p>
                状態: {batchJob.status === "queued" ? "待機中" : batchJob.status === "running" ? "生成中" : batchJob.status === "done" ? "完了" : "失敗"}
                {" "}({batchJob.completed + batchJob.failed} / {batchJob.total})
              </p>
              {/* **失敗した従業員IDを表示する。** 誰の分が抜けたか分からないと、
                  「明細が届いていない」という問い合わせに対応できない。 */}
              {batchJob.failedUserIds.length > 0 && (
                <p className="mt-1 text-[var(--color-danger)]">
                  失敗: {batchJob.failedUserIds.join("、")}(給与データを確認してください)
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
