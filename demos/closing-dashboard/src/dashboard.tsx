"use client";
/**
 * 決算ダッシュボード。月次の損益・消費税・仕訳から KpiCard / DonutChart で可視化する。
 * @platform/accounting の集計結果を @platform/ui の部品で表示する例。
 * @packageDocumentation
 */
import * as React from "react";
import { KpiCard, DonutChart, Card, Button } from "@platform/ui";
import { filterByPeriod, profitAndLoss, balanceSheet, consumptionTaxSummary, journalToRows, type JournalEntry, type RateAmount } from "@platform/accounting";

/** {@link ClosingDashboard} の props。 */
export interface ClosingDashboardProps {
  entries: JournalEntry[];
  /** 課税売上・課税仕入(税率別。消費税集計用)。 */
  sales: RateAmount[];
  purchases: RateAmount[];
  /** 対象年月(YYYY-MM)。 */
  yearMonth: string;
  /** 前月の純利益(前期比較用)。 */
  previousNetIncome?: number;
}

function yen(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`;
}

/** 月次決算の要約ダッシュボード。 */
export function ClosingDashboard({ entries, sales, purchases, yearMonth, previousNetIncome }: ClosingDashboardProps) {
  const period = filterByPeriod(entries, yearMonth);
  const pl = profitAndLoss(period);
  const bs = balanceSheet(period);
  const tax = consumptionTaxSummary(sales, purchases);

  const rows = journalToRows(period);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{yearMonth} 月次決算</h1>
        {/* CSV は @platform/csv の toCsv(rows) をボタンで downloadCsv する想定 */}
        <Button variant="secondary" onClick={() => console.log(rows)}>仕訳CSV出力</Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="売上高" value={pl.revenue} format={yen} />
        <KpiCard label="費用" value={pl.expense} format={yen} higherIsBetter={false} />
        <KpiCard label="当期純利益" value={pl.netIncome} previous={previousNetIncome} format={yen} />
        <KpiCard label="消費税(納付)" value={tax.netPayable} format={yen} higherIsBetter={false} />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-4 text-sm font-medium text-[var(--color-muted)]">貸借の構成</h2>
          <DonutChart
            data={[
              { label: "資産", value: bs.assets },
              { label: "負債", value: bs.liabilities },
              { label: "純資産", value: Math.max(0, bs.equity) },
            ]}
            centerLabel={yen(bs.assets)}
          />
        </Card>
        <Card className="p-6">
          <h2 className="mb-4 text-sm font-medium text-[var(--color-muted)]">消費税(税率別 仮受)</h2>
          <DonutChart
            data={tax.byRate.map((r) => ({ label: `${r.rate}%`, value: r.outputTax }))}
            centerLabel={yen(tax.outputTax)}
          />
        </Card>
      </div>
    </div>
  );
}
