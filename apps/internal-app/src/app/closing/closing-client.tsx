"use client";
/** 月次決算。損益計算書・貸借対照表・消費税集計表を月ごとに表示。 */
import * as React from "react";
import { formatPercent } from "@platform/utils";
import { formatYen } from "@platform/report";
import { formatMonthJst } from "@platform/datetime";
import { AsyncBoundary, Button, Input, PageShell } from "@platform/ui";
import { InfoTip } from "../../components/InfoTip";

interface PL { revenue: number; expense: number; netIncome: number; }
interface BS { assets: number; liabilities: number; equity: number; }
interface TaxRow { rate: number; salesNet: number; outputTax: number; purchaseNet: number; inputTax: number; }
interface Tax { byRate: TaxRow[]; outputTax: number; inputTax: number; netPayable: number; }
interface Statements { month: string | null; profitAndLoss: PL; balanceSheet: BS; consumptionTax: Tax; depreciation: number; balanced: boolean; }
interface ClosingRow { account: string; debit: number; credit: number; memo?: string; }
interface YearEnd { year: number; netIncome: number; retainedEarnings: number; closingRows: ClosingRow[]; }
interface Cmp { current: number; prior: number; delta: number; rate: number | null; }
interface Comparison { years: [number, number]; revenue: Cmp; expense: Cmp; netIncome: Cmp; assets: Cmp; liabilities: Cmp; equity: Cmp; }
interface Lock { period: string; lockedAt: string; lockedBy: string; }

const yen = (n: number) => formatYen(n);
const thisMonth = () => formatMonthJst();

export interface ClosingClientProps { fetchImpl?: typeof fetch; }

export function ClosingClient({ fetchImpl }: ClosingClientProps) {
  const [month, setMonth] = React.useState(thisMonth());
  const [data, setData] = React.useState<Statements | null>(null);
  const [error, setError] = React.useState("");
  const [yearEnd, setYearEnd] = React.useState<YearEnd | null>(null);
  const [prior, setPrior] = React.useState("0");
  const [locks, setLocks] = React.useState<Lock[]>([]);
  const [lockMsg, setLockMsg] = React.useState("");
  const [compare, setCompare] = React.useState<Comparison | null>(null);
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  // **再試行できるように名前を付ける。**
  // 月次締めは業務に直結するので、失敗したまま気づかないのが困る
  const load = React.useCallback(async () => {
    setError("");
    try {
      const res = await doFetch(`/api/accounting/statements?month=${month}`);
      if (!res.ok) { setError("決算書を取得できませんでした"); return; }
      setData((await res.json()) as Statements);
    } catch {
      setError("通信に失敗しました。ネットワークを確認してください");
    }
  }, [doFetch, month]);

  React.useEffect(() => { void load(); }, [load]);

  const loadLocks = React.useCallback(async () => {
    const res = await doFetch("/api/accounting/locks");
    if (res.ok) setLocks(((await res.json()) as { locks: Lock[] }).locks);
  }, [doFetch]);
  React.useEffect(() => { void loadLocks(); }, [loadLocks]);

  const toggleLock = async (action: "lock" | "unlock") => {
    setLockMsg("");
    const period = month;
    const res = await doFetch("/api/accounting/locks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ period, action }) });
    if (res.ok) { await loadLocks(); setLockMsg(action === "lock" ? `${period} を締めました` : `${period} の締めを解除しました`); }
    else setLockMsg(((await res.json()) as { error?: string }).error ?? "操作に失敗しました");
  };

  const runYearEnd = async () => {
    const year = month.slice(0, 4);
    const res = await doFetch(`/api/accounting/year-end?year=${year}&priorRetained=${Number(prior) || 0}`);
    if (res.ok) setYearEnd((await res.json()) as YearEnd);
  };

  const runCompare = async () => {
    const res = await doFetch(`/api/accounting/compare?year=${month.slice(0, 4)}`);
    if (res.ok) setCompare(((await res.json()) as { comparison: Comparison }).comparison);
  };

  return (
    <PageShell title="月次決算" width="wide">
        <Input type="month" value={month} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMonth(e.target.value)} className="rounded border border-[var(--color-border)] px-2 py-1 text-sm" />
      <AsyncBoundary loading={data === null} error={error} onRetry={() => void load()}>
      {data !== null && (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-2">
            <div className="rounded border border-[var(--color-border)] p-4">
              <h2 className="mb-2 text-sm font-medium">損益計算書（P/L）</h2>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-[var(--color-border)]"><td className="py-1.5 text-[var(--color-muted)]">売上高（収益）</td><td className="py-1.5 text-right">{yen(data.profitAndLoss.revenue)}</td></tr>
                  <tr className="border-b border-[var(--color-border)]"><td className="py-1.5 text-[var(--color-muted)]">売上原価・費用</td><td className="py-1.5 text-right">{yen(data.profitAndLoss.expense)}</td></tr>
                  {data.depreciation > 0 && <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]"><td className="py-1 pl-3">うち減価償却費</td><td className="py-1 text-right">{yen(data.depreciation)}</td></tr>}
                  <tr className="font-bold"><td className="py-2">当期純利益</td><td className={`py-2 text-right ${data.profitAndLoss.netIncome >= 0 ? "" : "text-[var(--color-danger)]"}`}>{yen(data.profitAndLoss.netIncome)}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="rounded border border-[var(--color-border)] p-4">
              <h2 className="mb-2 text-sm font-medium">貸借対照表（B/S）</h2>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-[var(--color-border)]"><td className="py-1.5 text-[var(--color-muted)]">資産</td><td className="py-1.5 text-right">{yen(data.balanceSheet.assets)}</td></tr>
                  <tr className="border-b border-[var(--color-border)]"><td className="py-1.5 text-[var(--color-muted)]">負債</td><td className="py-1.5 text-right">{yen(data.balanceSheet.liabilities)}</td></tr>
                  <tr className="font-bold"><td className="py-2">純資産</td><td className="py-2 text-right">{yen(data.balanceSheet.equity)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded border border-[var(--color-border)] p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-medium">消費税集計表</h2>
              <span className="text-sm">納付税額 <span className="font-bold">{yen(data.consumptionTax.netPayable)}</span>{data.consumptionTax.netPayable < 0 && <span className="text-[var(--color-success)]">（還付）</span>}</span>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted)]"><th className="px-2 py-1">税率</th><th className="px-2 py-1 text-right">課税売上(税抜)</th><th className="px-2 py-1 text-right">仮受消費税</th><th className="px-2 py-1 text-right">課税仕入(税抜)</th><th className="px-2 py-1 text-right">仮払消費税</th></tr></thead>
              <tbody>
                {data.consumptionTax.byRate.map((r) => (
                  <tr key={r.rate} className="border-b border-[var(--color-border)]">
                    <td className="px-2 py-1.5">{r.rate}%</td>
                    <td className="px-2 py-1.5 text-right">{yen(r.salesNet)}</td>
                    <td className="px-2 py-1.5 text-right">{yen(r.outputTax)}</td>
                    <td className="px-2 py-1.5 text-right">{yen(r.purchaseNet)}</td>
                    <td className="px-2 py-1.5 text-right">{yen(r.inputTax)}</td>
                  </tr>
                ))}
                {data.consumptionTax.byRate.length === 0 && <tr><td colSpan={5} className="px-2 py-3 text-center text-[var(--color-muted)]">この月の課税取引はありません。</td></tr>}
                <tr className="border-t-2 border-[var(--color-border)] font-medium"><td className="px-2 py-1.5">合計</td><td></td><td className="px-2 py-1.5 text-right">{yen(data.consumptionTax.outputTax)}</td><td></td><td className="px-2 py-1.5 text-right">{yen(data.consumptionTax.inputTax)}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6 rounded border border-[var(--color-border)] p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-medium">月次締めロック</h2>
              {locks.some((l) => l.period === month)
                ? <Button onClick={() => toggleLock("unlock")} variant="secondary" className="rounded px-4 py-1.5 text-sm">{month} の締めを解除</Button>
        : <Button onClick={() => toggleLock("lock")} className="rounded px-4 py-1.5 text-sm text-white">{month} を締める</Button>}
            </div>
            <p className="text-xs text-[var(--color-muted)]">締めた月は請求の起票・入金記録ができなくなります（後追い修正の防止）。</p>
            {lockMsg && <p className="mt-1 text-xs text-[var(--color-success)]">{lockMsg}</p>}
            {locks.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{locks.map((l) => <span key={l.period} className="rounded bg-[var(--color-subtle)] px-2 py-0.5 text-xs">{l.period} 締済</span>)}</div>}
          </div>

          <div className="mt-6 rounded border border-[var(--color-border)] p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-medium">年次決算・繰越（{month.slice(0, 4)}年度）</h2>
              <label className="ml-auto text-xs text-[var(--color-muted)]">期首繰越利益剰余金<Input value={prior} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPrior(e.target.value)} inputMode="numeric" className="ml-1 w-28 rounded border border-[var(--color-border)] px-2 py-1 text-sm" /></label>
       <Button onClick={runYearEnd} className="rounded px-4 py-1.5 text-sm text-white">決算振替を計算</Button>
            </div>
            {yearEnd && (
              <>
                <div className="mb-3 grid grid-cols-2 gap-3 text-center text-sm">
                  <div className="rounded bg-[var(--color-subtle)] p-2"><div className="text-xs text-[var(--color-muted)]">当期純利益</div><div className={`font-bold ${yearEnd.netIncome < 0 ? "text-[var(--color-danger)]" : ""}`}>{yen(yearEnd.netIncome)}</div></div>
                  <div className="rounded bg-[var(--color-subtle)] p-2"><div className="text-xs text-[var(--color-muted)]">繰越利益剰余金（翌期繰越）</div><div className="font-bold">{yen(yearEnd.retainedEarnings)}</div></div>
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted)]"><th className="px-2 py-1">決算振替仕訳</th><th className="px-2 py-1 text-right">借方</th><th className="px-2 py-1 text-right">貸方</th></tr></thead>
                  <tbody>
                    {yearEnd.closingRows.map((r, i) => <tr key={i} className="border-b border-[var(--color-border)]"><td className="px-2 py-1.5">{r.account}</td><td className="px-2 py-1.5 text-right">{r.debit ? yen(r.debit) : ""}</td><td className="px-2 py-1.5 text-right">{r.credit ? yen(r.credit) : ""}</td></tr>)}
                  </tbody>
                </table>
              </>
            )}
          </div>

          <div className="mt-6 rounded border border-[var(--color-border)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-1 text-sm font-medium">前年比較（{month.slice(0, 4)}年度 vs 前年度）<InfoTip text="増減率は（当期−前期）÷前期です。前期が0の項目は算出できないため「—」と表示されます。" /></h2>
       <Button onClick={runCompare} className="rounded px-4 py-1.5 text-sm text-white">前年比較を計算</Button>
            </div>
            {compare && (() => {
              const pct = (r: number | null) => (r === null ? "—" : `${r >= 0 ? "+" : ""}${formatPercent(r, 1)}`);
              const rowFor = (label: string, c: Cmp) => (
                <tr key={label} className="border-b border-[var(--color-border)]">
                  <td className="px-2 py-1.5">{label}</td>
                  <td className="px-2 py-1.5 text-right">{yen(c.current)}</td>
                  <td className="px-2 py-1.5 text-right text-[var(--color-muted)]">{yen(c.prior)}</td>
                  <td className={`px-2 py-1.5 text-right font-medium ${c.delta < 0 ? "text-[var(--color-danger)]" : "text-[var(--color-success)]"}`}>{c.delta >= 0 ? "+" : ""}{yen(c.delta)}</td>
                  <td className={`px-2 py-1.5 text-right text-xs ${(c.rate ?? 0) < 0 ? "text-[var(--color-danger)]" : "text-[var(--color-muted)]"}`}>{pct(c.rate)}</td>
                </tr>
              );
              return (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted)]"><th className="px-2 py-1">項目</th><th className="px-2 py-1 text-right">当期（{compare.years[0]}）</th><th className="px-2 py-1 text-right">前期（{compare.years[1]}）</th><th className="px-2 py-1 text-right">増減</th><th className="px-2 py-1 text-right">増減率</th></tr></thead>
                  <tbody>
                    {rowFor("売上高", compare.revenue)}
                    {rowFor("費用", compare.expense)}
                    {rowFor("当期純利益", compare.netIncome)}
                    {rowFor("資産", compare.assets)}
                    {rowFor("負債", compare.liabilities)}
                    {rowFor("純資産", compare.equity)}
                  </tbody>
                </table>
              );
            })()}
          </div>
        </>
      )}
      </AsyncBoundary>
    </PageShell>
  );
}
