"use client";
/** 月次レポート。対象月・言語を選び、集計とプレビュー(HTML)を表示・ダウンロードする。 */
import { useMemo, useState, type ChangeEvent } from "react";
import { Button } from "@platform/ui";
import { formatNumber } from "@platform/utils";
import { buildMonthlyReport, availableMonths } from "../../../lib/expense-report";
import { SAMPLE_EXPENSES } from "../../../lib/sample-expenses";
import type { ReportLocale } from "@platform/report";

const yen = (n: number) => `¥${formatNumber(n, {})}`;
const LOCALES: ReportLocale[] = ["ja", "en", "zh", "ko"];

export default function ReportPage() {
  const months = useMemo(() => availableMonths(SAMPLE_EXPENSES), []);
  const [month, setMonth] = useState(months[0] ?? "");
  const [locale, setLocale] = useState<ReportLocale>("ja");
  const report = useMemo(() => buildMonthlyReport(SAMPLE_EXPENSES, month, { locale }), [month, locale]);

  const download = () => {
    const blob = new Blob([report.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `expense-report-${month}.html`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main style={{ maxWidth: 860, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>月次レポート</h1>

      <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap" }}>
        <label>対象月:
          <select value={month} onChange={(e: ChangeEvent<HTMLSelectElement>) => setMonth(e.target.value)} style={{ marginLeft: ".5rem", padding: ".25rem .5rem" }}>
            {months.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label>言語:
          <select value={locale} onChange={(e: ChangeEvent<HTMLSelectElement>) => setLocale(e.target.value as ReportLocale)} style={{ marginLeft: ".5rem", padding: ".25rem .5rem" }}>
            {LOCALES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <Button onClick={download}>HTML ダウンロード</Button>
        <a href={`/api/expenses/report?month=${month}`} style={{ textDecoration: "none" }}><Button>Excel ダウンロード</Button></a>
      </div>

      <div style={{ display: "flex", gap: ".75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <StatBox label="件数" value={String(report.summary.count)} />
        <StatBox label="合計(税込)" value={yen(report.summary.total)} />
        <StatBox label="税抜" value={yen(report.summary.subtotal)} />
        <StatBox label="消費税" value={yen(report.summary.tax)} />
      </div>

      <h2 style={{ fontWeight: 700, margin: "1rem 0 .5rem" }}>プレビュー</h2>
      <iframe title="report" srcDoc={report.html} style={{ width: "100%", height: 480, border: "1px solid var(--color-border)", borderRadius: 8, background: "#fff" }} />
    </main>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: ".5rem 1rem", minWidth: 120 }}>
      <div style={{ fontSize: ".8rem", color: "var(--color-muted)" }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{value}</div>
    </div>
  );
}
