"use client";
/**
 * 備品貸出の記録(実地課題 docs/onboarding/04-task.md の成果物)。
 *
 * 一覧・登録・返却のみ。認証・DB・権限は持たず、状態は画面のメモリに置く。
 */
import * as React from "react";
import { Button, DataTable, DatePicker, Input, type DataTableColumn } from "@platform/ui";

/** 貸出 1 件。返却すると一覧から消えるので、返却済みは保持しない。 */
type Lending = { id: string; item: string; borrower: string; lentOn: string };

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

export default function Page() {
  const [rows, setRows] = React.useState<Lending[]>([
    { id: "l1", item: "ノートPC A-12", borrower: "山田 太郎", lentOn: "2026-08-03" },
    { id: "l2", item: "プロジェクター P-2", borrower: "鈴木 花子", lentOn: "2026-08-06" },
  ]);
  const [item, setItem] = React.useState("");
  const [borrower, setBorrower] = React.useState("");
  const [lentOn, setLentOn] = React.useState("");
  const [error, setError] = React.useState("");

  function add() {
    if (item.trim() === "" || borrower.trim() === "" || lentOn === "") {
      setError("備品名・借りた人・貸出日をすべて入力してください");
      return;
    }
    setError("");
    setRows((prev) => [
      { id: `l${Date.now()}`, item: item.trim(), borrower: borrower.trim(), lentOn },
      ...prev,
    ]);
    setItem("");
    setBorrower("");
    setLentOn("");
  }

  // **Enter で追加できるようにする。** 課題の完了条件でもあり、
  // 入力欄が並ぶ画面では「最後にボタンへ Tab する」より速い。
  //
  // `isComposing` を必ず見る。日本語入力では漢字を選ぶ操作が Enter なので、
  // 見ないと**変換を確定した瞬間に追加される**(英語で試すと気づけない)。
  function onEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) add();
  }

  const columns: DataTableColumn<Lending & Record<string, unknown>>[] = React.useMemo(
    () => [
      { key: "item", header: "備品名", sortable: true, sticky: true },
      { key: "borrower", header: "借りた人", sortable: true },
      { key: "lentOn", header: "貸出日", sortable: true, format: "date" },
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
            返却
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <div style={{ maxWidth: 900, margin: "16px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>備品貸出</h1>

      <div style={box}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "grid", gap: 4, flex: "1 1 200px" }}>
            <span style={{ fontSize: 12, color: "var(--color-muted)" }}>備品名</span>
            <Input value={item} onChange={(e) => setItem(e.target.value)} onKeyDown={onEnter} placeholder="ノートPC A-12" />
          </label>
          <label style={{ display: "grid", gap: 4, flex: "1 1 160px" }}>
            <span style={{ fontSize: 12, color: "var(--color-muted)" }}>借りた人</span>
            <Input value={borrower} onChange={(e) => setBorrower(e.target.value)} onKeyDown={onEnter} placeholder="山田 太郎" />
          </label>
          <label style={{ display: "grid", gap: 4, flex: "0 1 170px" }}>
            <span style={{ fontSize: 12, color: "var(--color-muted)" }}>貸出日</span>
            <DatePicker value={lentOn} onChange={(e) => setLentOn(e.target.value)} />
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
        <DataTable rows={rows} columns={columns} searchKeys={["item", "borrower"]} pageSize={10} />
      </div>
    </div>
  );
}
