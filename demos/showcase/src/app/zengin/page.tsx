"use client";
/** 全銀フォーマットのデモ: 総合振込データの生成・半角カナ変換・件数/合計の自動集計。 */
import * as React from "react";
import { buildZenginTransfer, toHankakuKana, type Consignor, type TransferRecord, type AccountType } from "@platform/zengin";

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "1", label: "普通" },
  { value: "2", label: "当座" },
  { value: "4", label: "貯蓄" },
];

const CONSIGNOR: Consignor = {
  code: "0123456789",
  name: "ｶ)ﾏﾂﾁﾒｰｶｰ",
  bankCode: "0001",
  branchCode: "001",
  accountType: "1",
  accountNumber: "1234567",
};

interface Row {
  bankCode: string;
  branchCode: string;
  accountType: AccountType;
  accountNumber: string;
  /** 全角のまま持つ。送信時に半角カナへ変換する。 */
  name: string;
  amount: number;
}

const INITIAL: Row[] = [
  { bankCode: "0005", branchCode: "123", accountType: "1", accountNumber: "7654321", name: "ヤマダ タロウ", amount: 120000 },
  { bankCode: "0009", branchCode: "045", accountType: "1", accountNumber: "1112223", name: "カ）スズキショウジ", amount: 385400 },
  { bankCode: "0033", branchCode: "700", accountType: "2", accountNumber: "9998887", name: "サトウ ハナコ", amount: 58000 },
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

export default function Page() {
  const [rows, setRows] = React.useState<Row[]>(INITIAL);
  const [date, setDate] = React.useState("0731");

  const update = (i: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r, j) => (i === j ? { ...r, ...patch } : r)));
  };

  const result = React.useMemo(() => {
    const records: TransferRecord[] = rows.map((r) => ({
      bankCode: r.bankCode,
      branchCode: r.branchCode,
      accountType: r.accountType,
      accountNumber: r.accountNumber,
      recipientName: toHankakuKana(r.name),
      amount: r.amount,
    }));
    return buildZenginTransfer(CONSIGNOR, records, date);
  }, [rows, date]);

  function download() {
    // 銀行の仕様に合わせて CRLF のまま出す
    const blob = new Blob([result.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zengin_${date}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main style={{ maxWidth: 900, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>全銀フォーマット（総合振込）</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        銀行へ渡す総合振込データを組み立てます。<strong>受取人名の半角カナ変換</strong>、
        <strong>件数と合計金額のトレーラ自動集計</strong>、<strong>改行は CRLF</strong>（銀行の仕様）まで
        <code>@platform/zengin</code> が面倒を見ます。表を編集すると下の出力が即座に変わります。
      </p>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>委託者（自社）</h2>
        <div style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.9 }}>
          コード {CONSIGNOR.code} / 名義 {CONSIGNOR.name} / 仕向 {CONSIGNOR.bankCode}-{CONSIGNOR.branchCode} / 口座 {CONSIGNOR.accountNumber}
        </div>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, marginTop: 10 }}>
          振込指定日（MMDD）
          <input value={date} onChange={(e) => setDate(e.target.value)} style={{ ...cell, width: 80 }} />
        </label>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>振込先</h2>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
              <th style={{ padding: 4 }}>銀行</th>
              <th style={{ padding: 4 }}>支店</th>
              <th style={{ padding: 4 }}>種目</th>
              <th style={{ padding: 4 }}>口座</th>
              <th style={{ padding: 4, minWidth: 150 }}>受取人名（全角で入力）</th>
              <th style={{ padding: 4 }}>金額</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: 4, width: 70 }}>
                  <input value={r.bankCode} onChange={(e) => update(i, { bankCode: e.target.value })} style={cell} />
                </td>
                <td style={{ padding: 4, width: 60 }}>
                  <input value={r.branchCode} onChange={(e) => update(i, { branchCode: e.target.value })} style={cell} />
                </td>
                <td style={{ padding: 4, width: 70 }}>
                  <select value={r.accountType} onChange={(e) => update(i, { accountType: e.target.value as AccountType })} style={cell}>
                    {ACCOUNT_TYPES.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={{ padding: 4, width: 90 }}>
                  <input value={r.accountNumber} onChange={(e) => update(i, { accountNumber: e.target.value })} style={cell} />
                </td>
                <td style={{ padding: 4 }}>
                  <input value={r.name} onChange={(e) => update(i, { name: e.target.value })} style={cell} />
                  <div style={{ fontSize: 10, color: "var(--color-muted)", marginTop: 2 }}>→ {toHankakuKana(r.name)}</div>
                </td>
                <td style={{ padding: 4, width: 90 }}>
                  <input
                    type="number"
                    value={r.amount}
                    onChange={(e) => update(i, { amount: Number(e.target.value) })}
                    style={{ ...cell, textAlign: "right" }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 8 }}>
          受取人名は全角で入力してください。<code>toHankakuKana()</code> が銀行の要求する半角カナへ変換します
          （<code>）</code> → <code>)</code> のような記号も含めて）。
        </p>
      </div>

      <div style={box}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>生成結果</h2>
          <div style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 13 }}>
            <span>
              明細 <b>{result.count}</b> 件
            </span>
            <span>
              合計 <b>¥{result.totalAmount.toLocaleString()}</b>
            </span>
            <button
              onClick={download}
              style={{ padding: "6px 14px", borderRadius: "var(--radius)", border: "none", background: "var(--color-primary)", color: "var(--color-primary-fg)", cursor: "pointer" }}
            >
              ダウンロード
            </button>
          </div>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 8 }}>
          件数と合計はトレーラレコードに自動集計されます（手で数えません）。最終行の <code>9</code> がエンドレコードです。
        </p>
        <pre
          style={{
            fontSize: 11,
            fontFamily: "monospace",
            background: "var(--color-bg)",
            padding: 12,
            borderRadius: "var(--radius)",
            overflowX: "auto",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          {result.content}
        </pre>
      </div>
    </main>
  );
}
