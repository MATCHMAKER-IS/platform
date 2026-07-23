"use client";
/** 見積のデモ: 有効期限・状態遷移・請求書への変換（@platform/invoice を再利用）。 */
import * as React from "react";
import { Button, Input, Select } from "@platform/ui";
import { buildQuote, quoteStatus, daysUntilExpiry, convertToInvoice, type Quote, type QuoteStatus } from "@platform/quote";
import { formatInvoiceNumber, endOfNextMonth, lineNet, type InvoiceLine, type Invoice } from "@platform/invoice";
import type { TaxRate } from "@platform/tax";

const INITIAL: InvoiceLine[] = [
  { description: "社内基盤 設計・構築", quantity: 1, unitPrice: 1800000, taxRate: 10 },
  { description: "初期データ移行", quantity: 1, unitPrice: 350000, taxRate: 10, discount: 50000 },
  { description: "操作研修（1日×3回）", quantity: 3, unitPrice: 80000, taxRate: 10 },
];

const STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: "下書き",
  sent: "送付済",
  accepted: "受注",
  rejected: "失注",
  expired: "有効期限切れ",
};

const STATUS_COLOR: Record<QuoteStatus, string> = {
  draft: "var(--color-muted)",
  sent: "var(--color-primary)",
  accepted: "var(--color-success)",
  rejected: "var(--color-danger)",
  expired: "var(--color-warning)",
};

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

const cell: React.CSSProperties = {
  padding: "4px 6px",
  borderRadius: 4,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-fg)",
  fontSize: 12,
  width: "100%",
};

const yen = (n: number) => `¥${n.toLocaleString()}`;

export function QuoteDemo() {
  const [lines, setLines] = React.useState<InvoiceLine[]>(INITIAL);
  const [state, setState] = React.useState<"draft" | "sent" | "accepted" | "rejected">("sent");
  const [validUntil, setValidUntil] = React.useState("2026-08-16");
  const [today, setToday] = React.useState("2026-08-01");
  const [invoice, setInvoice] = React.useState<Invoice | null>(null);

  const update = (i: number, patch: Partial<InvoiceLine>) => {
    setLines((prev) => prev.map((l, j) => (i === j ? { ...l, ...patch } : l)));
  };

  const quote: Quote = React.useMemo(
    () => buildQuote({ number: "QT-2026-0001", issueDate: "2026-07-17", validUntil, billTo: "株式会社サンプル 御中", state }, lines, "floor"),
    [lines, validUntil, state],
  );

  const now = React.useMemo(() => {
    const d = new Date(`${today}T00:00:00`);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }, [today]);

  const status = quoteStatus(quote, now);
  const rest = daysUntilExpiry(quote, now);

  function toInvoice() {
    const issueDate = today;
    setInvoice(
      convertToInvoice(
        quote,
        {
          number: formatInvoiceNumber(1, { prefix: "INV", padding: 5 }),
          issueDate,
          dueDate: endOfNextMonth(issueDate),
          registrationNumber: "T1180301018771",
        },
        "floor",
      ),
    );
  }

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>見積 → 請求</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        <code>@platform/quote</code> のコメントにはこう書いてあります —
        <strong>「税計算は @platform/invoice に委譲（請求書と同じ計算にする）」</strong>。
        見積で出した金額と請求で出した金額が食い違わないのは、
        <strong>同じ計算を 2 回書いていないから</strong>です。下の「請求書へ変換」で確かめられます。
      </p>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>見積明細</h2>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
              <th style={{ padding: 4 }}>品目</th>
              <th style={{ padding: 4 }}>数量</th>
              <th style={{ padding: 4 }}>単価</th>
              <th style={{ padding: 4 }}>値引</th>
              <th style={{ padding: 4 }}>税率</th>
              <th style={{ padding: 4, textAlign: "right" }}>税抜金額</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: 4 }}>
                  <Input value={l.description} onChange={(e) => update(i, { description: e.target.value })} style={cell} />
                </td>
                <td style={{ padding: 4, width: 60 }}>
                  <Input type="number" value={l.quantity} onChange={(e) => update(i, { quantity: Number(e.target.value) })} style={{ ...cell, textAlign: "right" }} />
                </td>
                <td style={{ padding: 4, width: 100 }}>
                  <Input type="number" value={l.unitPrice} onChange={(e) => update(i, { unitPrice: Number(e.target.value) })} style={{ ...cell, textAlign: "right" }} />
                </td>
                <td style={{ padding: 4, width: 80 }}>
                  <Input type="number" value={l.discount ?? 0} onChange={(e) => update(i, { discount: Number(e.target.value) })} style={{ ...cell, textAlign: "right" }} />
                </td>
                <td style={{ padding: 4, width: 75 }}>
                  <select value={l.taxRate ?? 10} onChange={(e) => update(i, { taxRate: Number(e.target.value) as TaxRate })} style={cell}>
                    <option value={10}>10%</option>
                    <option value={8}>8%</option>
                    <option value={0}>0%</option>
                  </select>
                </td>
                <td style={{ padding: 4, textAlign: "right", fontWeight: 700 }}>{yen(lineNet(l))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={box}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>記録上の状態</div>
            <Select
              value={state}
              onChange={(e) => {
                const v = e.target.value;
                setState(v === "draft" || v === "sent" || v === "accepted" || v === "rejected" ? v : "sent");
              }}
              style={{ ...cell, width: 120 }} options={[{ label: "下書き", value: "draft" }, { label: "送付済", value: "sent" }, { label: "受注", value: "accepted" }, { label: "失注", value: "rejected" }]} />
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>有効期限</div>
            <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} style={{ ...cell, width: 140 }} />
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>今日（変えられます）</div>
            <Input type="date" value={today} onChange={(e) => setToday(e.target.value)} style={{ ...cell, width: 140 }} />
          </label>
          <div
            style={{
              padding: "5px 14px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              color: STATUS_COLOR[status],
              border: `1px solid ${STATUS_COLOR[status]}`,
            }}
          >
            {STATUS_LABEL[status]}
            {status === "sent" && rest >= 0 && `（あと ${rest} 日）`}
          </div>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          「今日」を有効期限より後にすると<strong>有効期限切れ</strong>になります。ただし
          <strong>「受注」「失注」は明示操作なので、期限を過ぎても上書きされません</strong>
          （状態を「受注」にして今日を 2026-09-01 にすると確認できます）。
          この区別を各アプリで書くと必ずどこかが間違います。
        </p>
      </div>

      <div style={box}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>見積 {quote.number}</h2>
            <div style={{ fontSize: 12, color: "var(--color-muted)" }}>
              {quote.billTo} / 発行 {quote.issueDate} / 有効期限 {quote.validUntil}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "var(--color-muted)" }}>
              小計 {yen(quote.totals.subtotal)} + 消費税 {yen(quote.totals.tax)}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{yen(quote.totals.total)}</div>
          </div>
        </div>
        <Button
          onClick={toInvoice}
          style={{ marginTop: 12, padding: "8px 18px", borderRadius: "var(--radius)", border: "none", background: "var(--color-primary)", color: "var(--color-primary-fg)", cursor: "pointer" }}
        >
          請求書へ変換
        </Button>
      </div>

      {invoice !== null && (
        <div style={{ ...box, borderColor: "var(--color-success)" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>変換された請求書 {invoice.number}</h2>
          <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 10 }}>
            {invoice.billTo} / 発行 {invoice.issueDate} / 支払期限 {invoice.dueDate}（翌月末）/ 登録番号 {invoice.registrationNumber}
          </div>

          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13, marginBottom: 12 }}>
            <span>
              見積合計 <b>{yen(quote.totals.total)}</b>
            </span>
            <span>
              請求合計 <b>{yen(invoice.totals.total)}</b>
            </span>
            <span style={{ color: quote.totals.total === invoice.totals.total ? "var(--color-success)" : "var(--color-danger)", fontWeight: 700 }}>
              {quote.totals.total === invoice.totals.total ? "○ 完全に一致" : "× 食い違っています"}
            </span>
          </div>

          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "right", color: "var(--color-muted)" }}>
                <th style={{ padding: 4, textAlign: "left" }}>税率</th>
                <th style={{ padding: 4 }}>対象（税抜）</th>
                <th style={{ padding: 4 }}>消費税額</th>
              </tr>
            </thead>
            <tbody>
              {invoice.totals.taxByRate.map((t) => (
                <tr key={t.rate} style={{ borderTop: "1px solid var(--color-border)", textAlign: "right" }}>
                  <td style={{ padding: 4, textAlign: "left" }}>{t.rate}%</td>
                  <td style={{ padding: 4 }}>{yen(t.net)}</td>
                  <td style={{ padding: 4 }}>{yen(t.tax)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
            <code>convertToInvoice()</code> は明細をそのまま引き継ぎ、
            <strong>請求書側で改めて集計します</strong>。同じ <code>@platform/tax</code> を通るので、
            端数処理まで含めて必ず一致します。見積の金額を編集してから再変換しても、ずれません。
          </p>
        </div>
      )}
    </>
  );
}
