"use client";
/** 消費税のデモ: 税率別の区分集計（適格請求書の要件）・端数処理・インボイス番号の検証。 */
import * as React from "react";
import {
  summarizeTax,
  taxAmount,
  grossFromNet,
  netFromGross,
  isValidInvoiceNumber,
  normalizeInvoiceNumber,
  type TaxLine,
  type TaxRate,
  type Rounding,
} from "@platform/tax";

interface Row {
  label: string;
  /** 入力の基準。税抜 or 税込。 */
  basis: "net" | "gross";
  amount: number;
  rate: TaxRate;
}

const INITIAL: Row[] = [
  { label: "ノート PC（税抜入力）", basis: "net", amount: 189800, rate: 10 },
  { label: "会議用の弁当（軽減税率）", basis: "net", amount: 12960, rate: 8 },
  { label: "新聞購読（税込入力）", basis: "gross", amount: 4400, rate: 8 },
  { label: "商品券（非課税）", basis: "net", amount: 30000, rate: 0 },
];

const ROUNDINGS: { value: Rounding; label: string }[] = [
  { value: "floor", label: "切り捨て" },
  { value: "round", label: "四捨五入" },
  { value: "ceil", label: "切り上げ" },
];

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

export default function Page() {
  const [rows, setRows] = React.useState<Row[]>(INITIAL);
  const [rounding, setRounding] = React.useState<Rounding>("floor");
  const [regNo, setRegNo] = React.useState("Ｔ１１８０３０１０１８７７１");

  const update = (i: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r, j) => (i === j ? { ...r, ...patch } : r)));
  };

  const summary = React.useMemo(() => {
    const lines: TaxLine[] = rows.map((r) => (r.basis === "net" ? { net: r.amount, rate: r.rate } : { gross: r.amount, rate: r.rate }));
    return summarizeTax(lines, rounding);
  }, [rows, rounding]);

  const normalized = normalizeInvoiceNumber(regNo);
  const regOk = isValidInvoiceNumber(normalized);

  return (
    <main style={{ maxWidth: 900, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>消費税・インボイス</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        適格請求書（インボイス）は<strong>「税率ごとに区分した消費税額」の記載が必須</strong>です。
        明細を混ぜて合計してから課税するのは誤りで、税率別に集計してから端数処理します。
        <code>@platform/tax</code> がその区分集計と、登録番号の検証（<strong>チェックディジット込み</strong>）を持ちます。
      </p>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>明細</h2>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
              <th style={{ padding: 4 }}>品目</th>
              <th style={{ padding: 4 }}>入力基準</th>
              <th style={{ padding: 4 }}>金額</th>
              <th style={{ padding: 4 }}>税率</th>
              <th style={{ padding: 4 }}>税抜 / 税額 / 税込</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const net = r.basis === "net" ? r.amount : netFromGross(r.amount, r.rate, rounding);
              const tax = r.basis === "net" ? taxAmount(r.amount, r.rate, rounding) : r.amount - net;
              const gross = r.basis === "net" ? grossFromNet(r.amount, r.rate, rounding) : r.amount;
              return (
                <tr key={i} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={{ padding: 4 }}>
                    <input value={r.label} onChange={(e) => update(i, { label: e.target.value })} style={cell} />
                  </td>
                  <td style={{ padding: 4, width: 80 }}>
                    <select value={r.basis} onChange={(e) => update(i, { basis: e.target.value === "gross" ? "gross" : "net" })} style={cell}>
                      <option value="net">税抜</option>
                      <option value="gross">税込</option>
                    </select>
                  </td>
                  <td style={{ padding: 4, width: 100 }}>
                    <input
                      type="number"
                      value={r.amount}
                      onChange={(e) => update(i, { amount: Number(e.target.value) })}
                      style={{ ...cell, textAlign: "right" }}
                    />
                  </td>
                  <td style={{ padding: 4, width: 80 }}>
                    <select value={r.rate} onChange={(e) => update(i, { rate: Number(e.target.value) as TaxRate })} style={cell}>
                      <option value={10}>10%</option>
                      <option value={8}>8%（軽減）</option>
                      <option value={0}>0%（非課税）</option>
                    </select>
                  </td>
                  <td style={{ padding: 4, textAlign: "right", color: "var(--color-muted)", whiteSpace: "nowrap" }}>
                    {yen(net)} / {yen(tax)} / <b style={{ color: "var(--color-fg)" }}>{yen(gross)}</b>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, marginTop: 12 }}>
          端数処理
          <select value={rounding} onChange={(e) => setRounding(e.target.value as Rounding)} style={{ ...cell, width: 120 }}>
            {ROUNDINGS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 6 }}>
          切り替えると 1 円単位で結果が変わります。<strong>どれを採用するかは自社で決めて統一する</strong>ものです
          （税法上どれでも可）。基盤が既定を押し付けず、引数で受けているのはそのためです。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>税率ごとに区分した消費税額</h2>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "right", color: "var(--color-muted)" }}>
              <th style={{ padding: 6, textAlign: "left" }}>税率</th>
              <th style={{ padding: 6 }}>税抜</th>
              <th style={{ padding: 6 }}>消費税額</th>
              <th style={{ padding: 6 }}>税込</th>
            </tr>
          </thead>
          <tbody>
            {summary.byRate.map((s) => (
              <tr key={s.rate} style={{ borderTop: "1px solid var(--color-border)", textAlign: "right" }}>
                <td style={{ padding: 6, textAlign: "left" }}>{s.rate}%</td>
                <td style={{ padding: 6 }}>{yen(s.net)}</td>
                <td style={{ padding: 6 }}>{yen(s.tax)}</td>
                <td style={{ padding: 6 }}>{yen(s.gross)}</td>
              </tr>
            ))}
            <tr style={{ borderTop: "2px solid var(--color-border)", textAlign: "right", fontWeight: 700 }}>
              <td style={{ padding: 6, textAlign: "left" }}>合計</td>
              <td style={{ padding: 6 }}>{yen(summary.net)}</td>
              <td style={{ padding: 6 }}>{yen(summary.tax)}</td>
              <td style={{ padding: 6 }}>{yen(summary.gross)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>登録番号（インボイス番号）の検証</h2>
        <input value={regNo} onChange={(e) => setRegNo(e.target.value)} style={{ ...cell, maxWidth: 320, fontSize: 14, padding: 8 }} />
        <div style={{ fontSize: 13, marginTop: 10, lineHeight: 2 }}>
          <div style={{ color: "var(--color-muted)" }}>
            正規化: <code>{normalized}</code>
          </div>
          <div style={{ color: regOk ? "var(--color-success)" : "var(--color-danger)", fontWeight: 700 }}>
            {regOk ? "○ 有効な登録番号です" : "× 無効です（形式またはチェックディジット）"}
          </div>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 8, lineHeight: 1.8 }}>
          全角の <code>Ｔ</code> や全角数字、空白が混じっていても <code>normalizeInvoiceNumber()</code> が吸収します。
          検証は形式だけでなく<strong>法人番号のチェックディジットまで見ます</strong>ので、
          桁数が合っているだけの出鱈目は弾けます（末尾の 1 桁を変えて試してください）。
        </p>
      </div>
    </main>
  );
}
