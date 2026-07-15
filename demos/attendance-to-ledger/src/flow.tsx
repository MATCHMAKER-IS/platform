"use client";
/**
 * 勤怠 → 給与 → 仕訳の通し画面。勤怠集計から給与を計算し、明細を表示、給与仕訳を起票するまでを可視化。
 * @platform/payroll(計算・明細)+ @platform/accounting(仕訳)を @platform/ui で表示する。
 * @packageDocumentation
 */
import * as React from "react";
import { Steps, Card, StatCard, DescriptionList } from "@platform/ui";
import { calcPay, buildPayslip, type PayInput } from "@platform/payroll";
import { payrollJournal, isBalanced } from "@platform/accounting";

const STEP_LABELS = ["勤怠集計", "給与計算", "給与明細", "仕訳起票"];

/** {@link AttendanceToLedgerScreen} の props。 */
export interface AttendanceToLedgerScreenProps {
  /** 勤怠から算出した給与計算入力。 */
  payInput: PayInput;
  /** 控除(健康保険・源泉など)。 */
  deductions?: { name: string; amount: number }[];
  employeeName?: string;
  department?: string;
}

function yen(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`;
}

/** 勤怠→給与→仕訳を辿る画面。 */
export function AttendanceToLedgerScreen({ payInput, deductions = [], employeeName, department }: AttendanceToLedgerScreenProps) {
  const [step, setStep] = React.useState(0);

  const breakdown = calcPay(payInput);
  const payslip = buildPayslip(breakdown, { deductions });
  const withholding = deductions.find((d) => d.name.includes("源泉"))?.amount ?? 0;
  const social = deductions.filter((d) => !d.name.includes("源泉")).reduce((s, d) => s + d.amount, 0);
  const journal = payrollJournal({ date: new Date().toISOString().slice(0, 10), gross: payslip.grossPay, withholdingTax: withholding, socialInsurance: social, department });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Steps steps={STEP_LABELS} current={step} />

      {step === 0 && (
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">勤怠集計{employeeName ? `（${employeeName}）` : ""}</h2>
          <DescriptionList items={[
            { term: "所定内労働", description: `${payInput.regularMinutes ?? 0} 分` },
            { term: "時間外労働", description: `${payInput.overtimeMinutes ?? 0} 分` },
          ]} />
        </Card>
      )}

      {step === 1 && (
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">給与計算</h2>
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="基本賃金" value={breakdown.base} format={yen} />
            <StatCard label="割増合計" value={breakdown.overtimePremium + breakdown.over60Premium + breakdown.nightPremium + breakdown.holidayPay} format={yen} />
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">給与明細</h2>
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="総支給" value={payslip.grossPay} format={yen} />
            <StatCard label="控除合計" value={payslip.totalDeductions} format={yen} />
            <StatCard label="差引支給" value={payslip.netPay} format={yen} />
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">給与仕訳{isBalanced(journal) ? "（貸借一致）" : ""}</h2>
          <table className="w-full text-sm">
            <thead><tr className="border-b"><th className="py-2 text-left">勘定科目</th><th className="text-right">借方</th><th className="text-right">貸方</th></tr></thead>
            <tbody>
              {journal.lines.map((l, i) => (
                <tr key={i} className="border-b border-[var(--color-border)]">
                  <td className="py-2">{l.account}{l.department ? `（${l.department}）` : ""}</td>
                  <td className="text-right">{l.debit ? yen(l.debit) : ""}</td>
                  <td className="text-right">{l.credit ? yen(l.credit) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className="flex justify-between">
        <button className="rounded-[var(--radius)] border border-[var(--color-border)] px-4 py-2 text-sm disabled:opacity-40" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>戻る</button>
        <button className="rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-sm text-white disabled:opacity-40" onClick={() => setStep((s) => Math.min(STEP_LABELS.length - 1, s + 1))} disabled={step === STEP_LABELS.length - 1}>次へ</button>
      </div>
    </div>
  );
}
