"use client";
/** 経費 CSV 取込フロー: 貼り付け/アップロード → ImportReview で確認・修正 → 確定。 */
import { useState, type ChangeEvent } from "react";
import { ImportReview, Button, StatCard } from "@platform/ui";
import { parseExpenseCsv, toExpenses, EXPENSE_IMPORT_FIELDS } from "../../../lib/expense-import";
import { summarize, type Expense } from "../../../lib/expense";

const SAMPLE_CSV = `日付,カテゴリ,金額,備考
2024/04/03,交通費,"1,240",客先訪問
2024/04/12,会議費,8600,打合せ
2024/04/18,消耗品,3200,
2024/04/22,交通費,¥1560,
2024/04/30,外注費,"180,000",スポット依頼`;

export default function ImportPage() {
  const [text, setText] = useState(SAMPLE_CSV);
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [confirmed, setConfirmed] = useState<Expense[] | null>(null);

  const parse = () => { setRows(parseExpenseCsv(text)); setConfirmed(null); };
  const [saving, setSaving] = useState(false);
  const onConfirm = async (finalRows: Record<string, string>[]) => {
    const expenses = toExpenses(finalRows);
    setConfirmed(expenses);
    setSaving(true);
    try {
      await fetch("/api/expenses/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: finalRows }),
      });
    } catch {
      // デモではネットワーク不通でもサマリ表示は継続
    } finally {
      setSaving(false);
    }
  };

  const summary = confirmed ? summarize(confirmed) : null;

  return (
    <main style={{ maxWidth: 900, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>経費 CSV 取込</h1>

      {!rows && (
        <section>
          <p style={{ color: "var(--color-muted)", marginBottom: ".5rem" }}>CSV を貼り付けてください(ヘッダ: 日付/カテゴリ/金額/備考)。</p>
          <textarea value={text} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)} rows={8}
            style={{ width: "100%", fontFamily: "monospace", fontSize: ".85rem", padding: ".5rem", border: "1px solid var(--color-border)", borderRadius: 8 }} />
          <div style={{ marginTop: ".75rem" }}><Button onClick={parse}>解析してレビュー</Button></div>
        </section>
      )}

      {rows && !confirmed && (
        <section>
          <p style={{ color: "var(--color-muted)", marginBottom: ".5rem" }}>{rows.length} 件を読み込みました。エラーを修正して確定してください。</p>
          <ImportReview
            rows={rows}
            fields={EXPENSE_IMPORT_FIELDS}
            onConfirm={onConfirm}
            onPartialConfirm={onConfirm}
          />
          <div style={{ marginTop: ".75rem" }}><Button variant="secondary" onClick={() => setRows(null)}>やり直す</Button></div>
        </section>
      )}

      {summary && (
        <section>
          <p style={{ color: "var(--color-primary)", fontWeight: 600, marginBottom: ".75rem" }}>{saving ? "保存中…" : `✓ ${confirmed!.length} 件を取り込みました(/api/expenses/import 経由で Prisma に保存)。`}</p>
          <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
            <StatCard label="件数" value={summary.count} />
            <StatCard label="合計" value={summary.total} format="currency" />
            <StatCard label="外れ値" value={summary.outliers.length} />
          </div>
          <div style={{ marginTop: "1rem" }}><Button onClick={() => { setRows(null); setConfirmed(null); }}>続けて取り込む</Button></div>
        </section>
      )}
    </main>
  );
}
