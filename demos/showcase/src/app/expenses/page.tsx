"use client";
/** 経費一覧(DataTable: 検索・ソート・ページング・CSV出力)+ 月次締めレポート。 */
import { useMemo, useState } from "react";
import { DataTable, SheetGrid, Button, downloadBlob, type DataTableColumn, type SheetColumn } from "@platform/ui";
import { monthlyExpenseSummary, renderMonthlyReportHtml, monthlyReportSheets, type ExpenseRecord } from "@platform/report";
import { writeWorkbook } from "@platform/xlsx";

// サンプル経費(実運用は repository.paginate で取得)
const EXPENSES: (ExpenseRecord & { vendor: string; status: string })[] = [
  { amount: 842, date: "2026-01-05", vendor: "スーパー○○", category: "消耗品費", taxRate: 8, status: "承認済" },
  { amount: 1100, date: "2026-01-08", vendor: "JR東日本", category: "交通費", taxRate: 10, status: "承認済" },
  { amount: 3300, date: "2026-01-12", vendor: "文具堂", category: "消耗品費", taxRate: 10, status: "申請中" },
  { amount: 5500, date: "2026-01-18", vendor: "○○書店", category: "図書費", taxRate: 10, status: "承認済" },
  { amount: 780, date: "2026-01-22", vendor: "カフェABC", category: "会議費", taxRate: 8, status: "却下" },
  { amount: 2200, date: "2026-01-25", vendor: "タクシー", category: "交通費", taxRate: 10, status: "承認済" },
  { amount: 4400, date: "2026-01-28", vendor: "家電量販店", category: "備品費", taxRate: 10, status: "申請中" },
  { amount: 990, date: "2026-02-02", vendor: "スーパー○○", category: "消耗品費", taxRate: 8, status: "承認済" },
];

const columns: DataTableColumn<(typeof EXPENSES)[number]>[] = [
  { key: "date", header: "日付", sortable: true },
  { key: "vendor", header: "支払先", sortable: true },
  { key: "category", header: "科目", sortable: true },
  { key: "amount", header: "金額", sortable: true, align: "right", render: (r) => `¥${r.amount.toLocaleString()}` },
  { key: "status", header: "状態", align: "center" },
];

const sheetColumns: SheetColumn<(typeof EXPENSES)[number]>[] = [
  { key: "date", header: "日付", width: 110 },
  { key: "vendor", header: "支払先", width: 140 },
  { key: "category", header: "科目", width: 110 },
  { key: "amount", header: "金額", width: 100, align: "right", render: (r) => `¥${r.amount.toLocaleString()}`, footer: `¥${EXPENSES.reduce((a, b) => a + b.amount, 0).toLocaleString()}` },
  { key: "taxRate", header: "税率", width: 80, align: "center", render: (r) => `${r.taxRate ?? 10}%` },
  { key: "status", header: "状態", width: 90, align: "center" },
];

export default function Page() {
  const [html, setHtml] = useState("");
  const summary = useMemo(() => monthlyExpenseSummary(EXPENSES, "2026-01"), []);

  return (
    <main style={{ maxWidth: 860, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>経費一覧</h1>
      <p style={{ color: "var(--color-muted)", margin: ".5rem 0 1rem", fontSize: ".9rem" }}>
        検索・列ソート・ページング・CSV出力に対応。大量データはサーバの repository.paginate と併用します。
      </p>

      <DataTable rows={EXPENSES} columns={columns} searchKeys={["vendor", "category", "status"]} pageSize={5} csvFilename="expenses-2026-01.csv" />

      <section style={{ marginTop: "2rem" }}>
        <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>月次締めレポート(2026-01)</h2>
        <div style={{ display: "flex", gap: "1rem", marginBottom: ".75rem", flexWrap: "wrap" }}>
          <Kpi label="税込合計" value={`¥${summary.total.toLocaleString()}`} />
          <Kpi label="件数" value={`${summary.count}件`} />
          <Kpi label="消費税" value={`¥${summary.tax.toLocaleString()}`} />
        </div>
        <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
          <Button onClick={() => setHtml(renderMonthlyReportHtml(summary))}>締めレポートを生成</Button>
          <Button variant="secondary" onClick={async () => {
            const res = await writeWorkbook(monthlyReportSheets(summary));
            if (res.ok) downloadBlob(new Blob([res.value], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `expense-2026-01.xlsx`);
          }}>Excel(xlsx)出力</Button>
        </div>
        {html && <iframe title="monthly" srcDoc={html} style={{ width: "100%", height: 460, marginTop: "1rem", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "#fff" }} />}
      </section>
      <section style={{ marginTop: "2rem" }}>
        <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>シート表示(ヘッダ/フッタ/左列固定・縦横スクロール・ドラッグ選択→Ctrl+Cでコピー)</h2>
        <SheetGrid<(typeof EXPENSES)[number]>
          rows={[...EXPENSES, ...EXPENSES, ...EXPENSES]}
          freezeLeft={1}
          showFooter
          height={320}
          columns={sheetColumns}
        />
      </section>
      <p style={{ marginTop: "1.5rem" }}><a href="/">← 戻る</a></p>
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: ".5rem 1rem" }}>
      <div style={{ fontSize: ".8rem", color: "var(--color-muted)" }}>{label}</div>
      <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>{value}</div>
    </div>
  );
}
