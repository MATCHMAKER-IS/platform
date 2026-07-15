"use client";
/**
 * レポート一括エクスポート画面。会計・在庫の集計をシート化し、各帳票を CSV で出力する。
 * シート整形は @platform/report、CSV 出力は @platform/ui の CsvExportButton。
 * @packageDocumentation
 */
import * as React from "react";
import { Card, CsvExportButton, DataTable } from "@platform/ui";
import { trialBalanceSheet, agingSheet, taxReportSheet, inventoryValuationSheet, combineSheets, type ReportSheet } from "@platform/report";

/** {@link ReportExportScreen} の props(集計済みデータを受け取る)。 */
export interface ReportExportScreenProps {
  trialBalance: { account: string; debit: number; credit: number; balance: number }[];
  aging: { current: number; d1_30: number; d31_60: number; d61_90: number; over90: number; total: number };
  taxReport: { byRate: { rate: number; salesNet: number; outputTax: number; purchaseNet: number; inputTax: number }[]; outputTax: number; inputTax: number; netPayable: number };
  inventory: { item: string; onHand: number; averageCost: number; value: number }[];
}

/** 帳票一覧を一括で確認・エクスポートする画面。 */
export function ReportExportScreen({ trialBalance, aging, taxReport, inventory }: ReportExportScreenProps) {
  const sheets = combineSheets(
    trialBalanceSheet(trialBalance),
    agingSheet(aging),
    taxReportSheet(taxReport),
    inventoryValuationSheet(inventory),
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <h1 className="text-xl font-semibold">帳票エクスポート</h1>
      {sheets.map((sheet: ReportSheet) => (
        <Card key={sheet.name} className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{sheet.name}</h2>
            <CsvExportButton rows={sheet.rows} filename={`${sheet.name}.csv`} variant="secondary" size="sm">
              CSV出力
            </CsvExportButton>
          </div>
          <DataTable rows={sheet.rows} pageSize={6} />
        </Card>
      ))}
    </div>
  );
}
