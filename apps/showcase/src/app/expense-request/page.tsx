"use client";
/**
 * 経費申請の記録(実地課題の 2 つ目の題材)。
 *
 * 一覧・登録・取消と、金額の合計。認証・DB・権限は持たず、状態は画面のメモリに置く。
 *
 * **金額の整形は `@platform/report` の `formatYen` を使う。**
 * 画面ごとに `` formatYen(n) `` と書くと、桁区切り・小数・
 * 記号の位置が画面ごとに変わる(2026-08 に 12 種類あった)。
 */
import * as React from "react";
import { Button, DataTable, DatePicker, Input, NumberInput, Select, type DataTableColumn } from "@platform/ui";
import { formatYen } from "@platform/report";

/** 申請 1 件。取消すと一覧から消えるので、取消済みは保持しない。 */
type Expense = { id: string; usedOn: string; category: string; amount: number; note: string };

/** 勘定科目。**自由入力にしない**——集計できなくなる。 */
const CATEGORIES = ["交通費", "消耗品費", "会議費", "通信費", "研修費"] as const;

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

export default function Page() {
  const [rows, setRows] = React.useState<Expense[]>([
    { id: "e1", usedOn: "2026-08-03", category: "交通費", amount: 1320, note: "客先訪問(往復)" },
    { id: "e2", usedOn: "2026-08-05", category: "消耗品費", amount: 4980, note: "プリンタ用紙" },
  ]);
  const [usedOn, setUsedOn] = React.useState("");
  const [category, setCategory] = React.useState<string>(CATEGORIES[0]);
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState("");

  function add() {
    const yen = Number(amount);
    if (usedOn === "" || amount === "" || note.trim() === "") {
      setError("利用日・金額・摘要をすべて入力してください");
      return;
    }
    // **金額の妥当性は登録時に弾く。** 0 円や負の申請は承認側で気づきにくい
    if (!Number.isInteger(yen) || yen <= 0) {
      setError("金額は 1 円以上の整数で入力してください");
      return;
    }
    setError("");
    setRows((prev) => [
      { id: `e${Date.now()}`, usedOn, category, amount: yen, note: note.trim() },
      ...prev,
    ]);
    setUsedOn("");
    setAmount("");
    setNote("");
  }

  /**
   * Enter で追加する。
   *
   * **`isComposing` を必ず見る。** 日本語入力では漢字を選ぶ操作が Enter なので、
   * 見ないと摘要の変換を確定した瞬間に登録される(英語で試すと気づけない)。
   */
  function onEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) add();
  }

  const total = rows.reduce((a, r) => a + r.amount, 0);

  const columns: DataTableColumn<Expense & Record<string, unknown>>[] = React.useMemo(
    () => [
      { key: "usedOn", header: "利用日", sortable: true, format: "date", sticky: true },
      { key: "category", header: "科目", sortable: true },
      {
        key: "amount",
        header: "金額",
        sortable: true,
        align: "right",
        render: (row) => formatYen(row.amount),
      },
      { key: "note", header: "摘要" },
      {
        key: "action",
        header: "操作",
        align: "right",
        render: (row) => (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
          >
            取消
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <div style={{ maxWidth: 980, margin: "16px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>経費申請</h1>

      <div style={box}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "grid", gap: 4, flex: "0 1 170px" }}>
            <span style={{ fontSize: 12, color: "var(--color-muted)" }}>利用日</span>
            <DatePicker value={usedOn} onChange={(e) => setUsedOn(e.target.value)} />
          </label>
          <label style={{ display: "grid", gap: 4, flex: "0 1 150px" }}>
            <span style={{ fontSize: 12, color: "var(--color-muted)" }}>科目</span>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </label>
          <label style={{ display: "grid", gap: 4, flex: "0 1 140px" }}>
            {/* **単位は入力欄の外に置く。** 中に入れると値と混ざる(NumberInput の指針) */}
            <span style={{ fontSize: 12, color: "var(--color-muted)" }}>金額(円)</span>
            <NumberInput
              value={amount}
              min={1}
              step={1}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={onEnter}
            />
          </label>
          <label style={{ display: "grid", gap: 4, flex: "1 1 220px" }}>
            <span style={{ fontSize: 12, color: "var(--color-muted)" }}>摘要</span>
            <Input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={onEnter} placeholder="客先訪問(往復)" />
          </label>
          <Button onClick={add}>追加</Button>
        </div>
        {error !== "" && (
          <p role="alert" style={{ marginTop: 8, fontSize: 13, color: "var(--color-danger)" }}>
            {error}
          </p>
        )}
      </div>

      <div style={box}>
        <p style={{ marginBottom: 8, fontSize: 14 }}>
          {rows.length} 件 / 合計 <strong>{formatYen(total)}</strong>
        </p>
        <DataTable rows={rows} columns={columns} searchKeys={["category", "note"]} pageSize={10} />
      </div>
    </div>
  );
}
