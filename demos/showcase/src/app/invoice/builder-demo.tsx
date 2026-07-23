"use client";
/** 請求書のデモ: 明細→税率別集計→適格請求書・支払期限(翌月末)・入金ステータス。 */
import * as React from "react";
import { Input, Select } from "@platform/ui";
import {
  buildInvoice,
  formatInvoiceNumber,
  dueDateFrom,
  endOfNextMonth,
  paymentStatus,
  balanceDue,
  daysUntilDue,
  lineNet,
  type InvoiceLine,
  type InvoiceHeader,
  type PaymentStatus,
} from "@platform/invoice";
import type { TaxRate, Rounding } from "@platform/tax";

const ISSUE_DATE = "2026-07-17";

const INITIAL: InvoiceLine[] = [
  { description: "社内基盤 構築一式", quantity: 1, unitPrice: 800000, taxRate: 10 },
  { description: "保守サポート（月額）", quantity: 3, unitPrice: 50000, taxRate: 10, discount: 15000 },
  { description: "技術書（軽減税率対象）", quantity: 10, unitPrice: 2000, taxRate: 8, reducedRate: true },
];

const TERMS: { label: string; due: (d: string) => string }[] = [
  { label: "翌月末払い", due: (d) => endOfNextMonth(d) },
  { label: "30日後", due: (d) => dueDateFrom(d, 30) },
  { label: "60日後", due: (d) => dueDateFrom(d, 60) },
];

const STATUS_LABEL: Record<PaymentStatus, string> = {
  draft: "下書き",
  issued: "発行済（未入金）",
  paid: "入金済",
  overdue: "期限超過",
  cancelled: "取消",
};

const STATUS_COLOR: Record<PaymentStatus, string> = {
  draft: "var(--color-muted)",
  issued: "var(--color-primary)",
  paid: "var(--color-success)",
  overdue: "var(--color-danger)",
  cancelled: "var(--color-muted)",
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

export function InvoiceBuilderDemo() {
  const [lines, setLines] = React.useState<InvoiceLine[]>(INITIAL);
  const [seq, setSeq] = React.useState(1);
  const [termIndex, setTermIndex] = React.useState(0);
  const [rounding, setRounding] = React.useState<Rounding>("floor");
  const [paid, setPaid] = React.useState(0);
  const [today, setToday] = React.useState("2026-07-20");

  const update = (i: number, patch: Partial<InvoiceLine>) => {
    setLines((prev) => prev.map((l, j) => (i === j ? { ...l, ...patch } : l)));
  };

  const invoice = React.useMemo(() => {
    const term = TERMS[termIndex] ?? TERMS[0];
    const header: InvoiceHeader = {
      number: formatInvoiceNumber(seq, { prefix: "INV", padding: 5 }),
      issueDate: ISSUE_DATE,
      dueDate: (term ?? TERMS[0])!.due(ISSUE_DATE),
      registrationNumber: "T1180301018771",
      billTo: "株式会社サンプル 御中",
    };
    return buildInvoice(header, lines, rounding);
  }, [lines, seq, termIndex, rounding]);

  const now = React.useMemo(() => {
    const d = new Date(`${today}T00:00:00`);
    return Number.isNaN(d.getTime()) ? new Date(ISSUE_DATE) : d;
  }, [today]);

  const status = paymentStatus(
    { issued: true, dueDate: invoice.dueDate, paidAmount: paid, total: invoice.totals.total },
    now,
  );
  const balance = balanceDue(invoice.totals.total, paid);
  const untilDue = daysUntilDue(invoice.dueDate, now);

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>請求書（適格請求書）</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        明細から請求書を組み立てます。<code>@platform/invoice</code> は <code>@platform/tax</code> に依存していて、
        <strong>税率別の区分集計はそちらの実装をそのまま使います</strong>。同じ計算を 2 回書かない、というのが基盤の要点です。
        支払期限の<strong>「翌月末」</strong>や入金ステータスの判定も持っています。
      </p>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>明細</h2>
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
                <td style={{ padding: 4, width: 90 }}>
                  <Input type="number" value={l.unitPrice} onChange={(e) => update(i, { unitPrice: Number(e.target.value) })} style={{ ...cell, textAlign: "right" }} />
                </td>
                <td style={{ padding: 4, width: 80 }}>
                  <Input type="number" value={l.discount ?? 0} onChange={(e) => update(i, { discount: Number(e.target.value) })} style={{ ...cell, textAlign: "right" }} />
                </td>
                <td style={{ padding: 4, width: 80 }}>
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
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 8 }}>
          値引を単価×数量より大きくしても、<strong>税抜金額はマイナスになりません</strong>（<code>lineNet()</code> が 0 で止めます）。
        </p>
      </div>

      <div style={box}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>連番</div>
            <Input type="number" value={seq} onChange={(e) => setSeq(Number(e.target.value))} style={{ ...cell, width: 80, textAlign: "right" }} />
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>支払条件</div>
            <select value={termIndex} onChange={(e) => setTermIndex(Number(e.target.value))} style={{ ...cell, width: 130 }}>
              {TERMS.map((t, i) => (
                <option key={t.label} value={i}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>端数処理</div>
            <Select value={rounding} onChange={(e) => setRounding(e.target.value as Rounding)} style={{ ...cell, width: 110 }} options={[{ label: "切り捨て", value: "floor" }, { label: "四捨五入", value: "round" }, { label: "切り上げ", value: "ceil" }]} />
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>入金額</div>
            <Input type="number" value={paid} onChange={(e) => setPaid(Number(e.target.value))} style={{ ...cell, width: 110, textAlign: "right" }} />
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>今日（変えられます）</div>
            <Input type="date" value={today} onChange={(e) => setToday(e.target.value)} style={{ ...cell, width: 140 }} />
          </label>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10 }}>
          「今日」を支払期限より後にすると<strong>期限超過</strong>に、入金額を合計以上にすると<strong>入金済</strong>に変わります。
        </p>
      </div>

      {/* 請求書プレビュー */}
      <div style={{ ...box, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>請求書</h2>
            <div style={{ fontSize: 13, lineHeight: 1.9 }}>
              <div>{invoice.billTo}</div>
              <div style={{ color: "var(--color-muted)" }}>請求書番号: {invoice.number}</div>
              <div style={{ color: "var(--color-muted)" }}>発行日: {invoice.issueDate}</div>
              <div style={{ color: "var(--color-muted)" }}>
                支払期限: {invoice.dueDate}
                {untilDue >= 0 ? `（あと ${untilDue} 日）` : `（${-untilDue} 日超過）`}
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 13, lineHeight: 1.9 }}>
            <div
              style={{
                display: "inline-block",
                padding: "3px 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                color: STATUS_COLOR[status],
                border: `1px solid ${STATUS_COLOR[status]}`,
                marginBottom: 8,
              }}
            >
              {STATUS_LABEL[status]}
            </div>
            <div style={{ color: "var(--color-muted)" }}>登録番号</div>
            <div style={{ fontFamily: "monospace" }}>{invoice.registrationNumber}</div>
          </div>
        </div>

        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", marginBottom: 16 }}>
          <thead>
            <tr style={{ textAlign: "right", color: "var(--color-muted)", borderBottom: "2px solid var(--color-border)" }}>
              <th style={{ padding: 6, textAlign: "left" }}>品目</th>
              <th style={{ padding: 6 }}>数量</th>
              <th style={{ padding: 6 }}>単価</th>
              <th style={{ padding: 6 }}>税抜金額</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--color-border)", textAlign: "right" }}>
                <td style={{ padding: 6, textAlign: "left" }}>
                  {l.description}
                  {l.reducedRate === true && <span style={{ fontSize: 11, color: "var(--color-warning)", marginLeft: 6 }}>※軽減</span>}
                </td>
                <td style={{ padding: 6 }}>{l.quantity}</td>
                <td style={{ padding: 6 }}>{yen(l.unitPrice)}</td>
                <td style={{ padding: 6 }}>{yen(lineNet(l))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginLeft: "auto", maxWidth: 340, fontSize: 13 }}>
          {invoice.totals.taxByRate.map((t) => (
            <div key={t.rate} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "var(--color-muted)" }}>
              <span>
                {t.rate}% 対象 {yen(t.net)} / 消費税
              </span>
              <span>{yen(t.tax)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid var(--color-border)" }}>
            <span>小計</span>
            <span>{yen(invoice.totals.subtotal)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
            <span>消費税</span>
            <span>{yen(invoice.totals.tax)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "2px solid var(--color-border)", fontSize: 16, fontWeight: 700 }}>
            <span>合計</span>
            <span>{yen(invoice.totals.total)}</span>
          </div>
          {paid > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "var(--color-success)" }}>
                <span>入金済</span>
                <span>-{yen(paid)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontWeight: 700 }}>
                <span>残額</span>
                <span>{yen(balance)}</span>
              </div>
            </>
          )}
        </div>

        <p style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 20, lineHeight: 1.8, borderTop: "1px solid var(--color-border)", paddingTop: 12 }}>
          「※軽減」の表示と<strong>税率ごとに区分した消費税額</strong>の記載が、適格請求書の必須要件です。
          <code>@platform/tax</code> の <code>summarizeTax()</code> がこの区分を作っており、
          <code>@platform/invoice</code> はそれを呼んでいるだけです。
        </p>
      </div>
    </>
  );
}
