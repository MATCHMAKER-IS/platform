"use client";
/** 帳票デモ(@platform/report)。請求書の計算 + 印刷用HTMLプレビュー。 */
import { useMemo, useState } from "react";
import { calculateInvoice, renderInvoiceHtml, formatYen } from "@platform/report";
import { PrintButton } from "@platform/ui";
import { pageCss } from "@platform/print";

const lines = [
  { description: "コンサルティング(11月)", quantity: 1, unitPrice: 200000, taxRate: 10 },
  { description: "保守サポート", quantity: 3, unitPrice: 15000, taxRate: 10 },
  { description: "書籍(軽減税率)", quantity: 5, unitPrice: 1500, taxRate: 8 },
];

export default function Page() {
  const [taxMode, setTaxMode] = useState<"exclusive" | "inclusive">("exclusive");
  const calc = useMemo(() => calculateInvoice({ lines, taxMode }), [taxMode]);
  const html = useMemo(() => renderInvoiceHtml({
    invoiceNumber: "INV-2026-001", issueDate: "2026-07-09", dueDate: "2026-07-31",
    seller: { name: "株式会社サンプル商会", address: "東京都千代田区1-1-1", tel: "03-1234-5678", registrationNumber: "T1234567890123" },
    buyer: { name: "取引先株式会社", address: "大阪府大阪市北区2-2-2" },
    lines, taxMode, notes: "お振込先: サンプル銀行 本店 普通 1234567",
  }), [taxMode]);

  return (
    <main style={{ maxWidth: 780, margin: "3rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>帳票(請求書)</h1>
      <p style={{ color: "var(--color-muted)", marginBottom: "1rem" }}>
        @platform/report で消費税を計算し、印刷用HTMLを生成します(PDF化は @platform/pdf に渡すだけ)。
      </p>

      <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
        <label><input type="radio" checked={taxMode === "exclusive"} onChange={() => setTaxMode("exclusive")} /> 外税(税抜単価)</label>
        <label><input type="radio" checked={taxMode === "inclusive"} onChange={() => setTaxMode("inclusive")} /> 内税(税込単価)</label>
        <span style={{ marginLeft: "auto" }}>合計: <strong>{formatYen(calc.total)}</strong>(税 {formatYen(calc.totalTax)})</span>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <PrintButton html={html} printOptions={{ title: "請求書", pageStyle: pageCss({ size: "A4" }) }}>請求書を印刷</PrintButton>
      </div>

      <iframe title="invoice" srcDoc={html} style={{ width: "100%", height: 640, border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "#fff" }} />
      <p style={{ marginTop: "1.5rem" }}><a href="/">← 戻る</a></p>
    </main>
  );
}
