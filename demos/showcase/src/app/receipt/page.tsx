"use client";
/** OCR→帳票フロー: 抽出 → 低信頼度フィールド確認(FieldReview)→ 経費帳票(renderExpenseHtml)。 */
import { useState } from "react";
import { extractReceiptFieldsWithConfidence, extractInvoiceFields, extractLineItems, extractTaxBreakdown } from "@platform/ocr";
import { expenseFromReceiptFields, renderExpenseHtml } from "@platform/report";
import { FieldReview, ConfidenceHighlight, OcrFeedbackDashboard, buildOcrFeedback, createOcrFeedbackStore, Button, Textarea, type ReviewField, type ConfidenceToken, type OcrFeedback } from "@platform/ui";

const SAMPLE = `スーパーマーケット○○ 本店
2026年1月5日
TEL 03-1234-5678
登録番号 T1234567890123
合計            ¥842`;

export default function Page() {
  const [text, setText] = useState(SAMPLE);
  const [fields, setFields] = useState<ReviewField[] | null>(null);
  const [html, setHtml] = useState<string>("");
  const [items, setItems] = useState<{ name: string; amount: number }[]>([]);
  const [invoice, setInvoice] = useState<ReturnType<typeof extractInvoiceFields> | null>(null);
  const [taxLines, setTaxLines] = useState<ReturnType<typeof extractTaxBreakdown>>([]);
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [feedbacks, setFeedbacks] = useState<OcrFeedback[]>([]);
  // 手書き数字の擬似トークン(実運用は ocr.recognize の words)
  const digitTokens: ConfidenceToken[] = [
    { text: "8", confidence: 96 }, { text: "4", confidence: 62 }, { text: "2", confidence: 34 },
  ];
  const feedbackStore = createOcrFeedbackStore({ endpoint: "/api/ocr-feedback", fetch: async () => ({ ok: true } as Response) });

  const extract = () => {
    // 実運用は ocr.recognize の結果(text+words)を渡す。デモは擬似的に単語信頼度を付与。
    const words = [
      { text: "2026", confidence: 96 }, { text: "T1234567890123", confidence: 92 },
      { text: "842", confidence: 58 }, { text: "03-1234-5678", confidence: 74 },
    ];
    const f = extractReceiptFieldsWithConfidence({ text, confidence: 80, words });
    const rows: ReviewField[] = [];
    if (f.amount) rows.push({ key: "amount", label: "金額", value: String(f.amount.value), confidence: f.amount.confidence });
    if (f.date) rows.push({ key: "date", label: "日付", value: f.date.value, confidence: f.date.confidence });
    if (f.registrationNumber) rows.push({ key: "registrationNumber", label: "登録番号", value: f.registrationNumber.value, confidence: f.registrationNumber.confidence });
    if (f.phone) rows.push({ key: "phone", label: "電話", value: f.phone.value, confidence: f.phone.confidence });
    setFields(rows);
    setItems(extractLineItems(text));
    setInvoice(extractInvoiceFields(text));
    setTaxLines(extractTaxBreakdown(text));
    setHtml("");
  };

  const originalValues = () => Object.fromEntries((fields ?? []).map((f) => [f.key, f.value]));
  const confirm = (values: Record<string, string>) => {
    // 学習用フィードバック(OCR値 → 修正後)を記録
    const fb = buildOcrFeedback({ userId: "demo-user", source: "receipt" }, originalValues(), values, Object.fromEntries((fields ?? []).map((f) => [f.key, f.confidence ?? 0])));
    void feedbackStore.record(fb);
    setFeedbacks((fs) => [...fs, fb]);
    setFeedbackMsg(`フィードバック記録: 修正 ${fb.corrections.length} 件 / そのまま ${fb.acceptedCount} 件`);
    const record = expenseFromReceiptFields(
      { amount: Number(values.amount), date: values.date, registrationNumber: values.registrationNumber },
      { vendor: "スーパー○○", category: "消耗品費", taxRate: 8 },
    );
    setHtml(renderExpenseHtml(record));
  };

  return (
    <main style={{ maxWidth: 680, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>領収書 → 確認 → 帳票化</h1>
      <p style={{ color: "var(--color-muted)", margin: ".5rem 0 1rem", fontSize: ".9rem" }}>
        OCRテキストから抽出 → 信頼度の低い項目を確認・修正 → 経費帳票に流し込みます。
      </p>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} style={{ fontFamily: "monospace" }} />
      <div style={{ margin: "1rem 0" }}><Button onClick={extract}>抽出する</Button></div>

      {items.length > 0 && (
        <section style={{ marginBottom: "1rem" }}>
          <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>明細({items.length}件)</h2>
          <ul style={{ fontSize: ".9rem" }}>
            {items.map((it, i) => <li key={i}>{it.name} … ¥{it.amount.toLocaleString()}</li>)}
          </ul>
        </section>
      )}
      {invoice && (invoice.invoiceNumber || invoice.dueDate) && (
        <section style={{ marginBottom: "1rem", fontSize: ".9rem" }}>
          <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>請求書フィールド</h2>
          <div>請求書番号: {invoice.invoiceNumber ?? "—"} / 発行日: {invoice.issueDate ?? "—"} / 支払期限: {invoice.dueDate ?? "—"}</div>
          <div>小計: {invoice.subtotal != null ? `¥${invoice.subtotal.toLocaleString()}` : "—"} / 消費税: {invoice.tax != null ? `¥${invoice.tax.toLocaleString()}` : "—"} / 合計: {invoice.total != null ? `¥${invoice.total.toLocaleString()}` : "—"}</div>
        </section>
      )}
      {taxLines.length > 0 && (
        <section style={{ marginBottom: "1rem", fontSize: ".9rem" }}>
          <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>税率別内訳</h2>
          {taxLines.map((t) => (
            <div key={t.rate}>{t.rate}% 対象: ¥{t.subtotal.toLocaleString()}{t.tax != null ? ` / 消費税 ¥${t.tax.toLocaleString()}` : ""}</div>
          ))}
        </section>
      )}
      <section style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>手書き数字(信頼度で色分け)</h2>
        <div style={{ fontSize: "1.4rem", letterSpacing: ".1em" }}><ConfidenceHighlight tokens={digitTokens} /></div>
        <p style={{ fontSize: ".8rem", color: "var(--color-muted)", marginTop: ".25rem" }}>緑=高 / 黄=中 / 赤(波線)=低。低信頼度は要確認。</p>
      </section>
      {fields && (
        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>抽出結果の確認</h2>
          <FieldReview fields={fields} threshold={70} onConfirm={confirm} />
        </section>
      )}

      {html && (
        <section>
          <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>経費帳票</h2>
          <div style={{ marginBottom: ".5rem", color: "var(--color-primary)", fontSize: ".9rem" }}>{feedbackMsg}</div>
          <iframe title="expense" srcDoc={html} style={{ width: "100%", height: 360, border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "#fff" }} />
        </section>
      )}
      {feedbacks.length > 0 && (
        <section style={{ marginTop: "2rem" }}>
          <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>フィードバック集計({feedbacks.length}件)</h2>
          <OcrFeedbackDashboard feedbacks={feedbacks} labelOf={(f) => ({ date: "日付", amount: "金額", vendor: "支払先", registrationNumber: "登録番号" }[f] ?? f)} />
        </section>
      )}
      <p style={{ marginTop: "1.5rem" }}><a href="/">← 戻る</a></p>
    </main>
  );
}
