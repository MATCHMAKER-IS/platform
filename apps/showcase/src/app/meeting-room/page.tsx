"use client";
/**
 * 会議室予約の記録(実地課題 docs/onboarding/04-task.md の題材)。
 *
 * 一覧・登録・取消のみ。認証・DB・権限は持たず、状態は画面のメモリに置く。
 */
import * as React from "react";
import { Button, DataTable, DatePicker, Input, type DataTableColumn } from "@platform/ui";

/** 予約 1 件。取消すと一覧から消えるので、取消済みは保持しない。 */
type Booking = { id: string; room: string; booker: string; usedOn: string };

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

export default function Page() {
  const [rows, setRows] = React.useState<Booking[]>([
    { id: "b1", room: "会議室A", booker: "山田 太郎", usedOn: "2026-08-11" },
    { id: "b2", room: "会議室B(小)", booker: "鈴木 花子", usedOn: "2026-08-12" },
  ]);
  const [room, setRoom] = React.useState("");
  const [booker, setBooker] = React.useState("");
  const [usedOn, setUsedOn] = React.useState("");
  const [error, setError] = React.useState("");

  function add() {
    if (room.trim() === "" || booker.trim() === "" || usedOn === "") {
      setError("会議室名・予約者・利用日をすべて入力してください");
      return;
    }
    // **同じ会議室・同じ日は取らせない。** 二重予約は当日に発覚すると手戻りが大きい
    if (rows.some((r) => r.room === room.trim() && r.usedOn === usedOn)) {
      setError(`${room.trim()} は ${usedOn} に既に予約があります`);
      return;
    }
    setError("");
    setRows((prev) => [
      { id: `b${Date.now()}`, room: room.trim(), booker: booker.trim(), usedOn },
      ...prev,
    ]);
    setRoom("");
    setBooker("");
    setUsedOn("");
  }

  // **Enter で追加できるようにする。** 課題の完了条件でもあり、
  // 入力欄が並ぶ画面では「最後にボタンへ Tab する」より速い。
  //
  // `isComposing` を必ず見る。日本語入力では漢字を選ぶ操作が Enter なので、
  // 見ないと**変換を確定した瞬間に追加される**(英語で試すと気づけない)。
  function onEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) add();
  }

  const columns: DataTableColumn<Booking & Record<string, unknown>>[] = React.useMemo(
    () => [
      { key: "room", header: "会議室", sortable: true, sticky: true },
      { key: "booker", header: "予約者", sortable: true },
      { key: "usedOn", header: "利用日", sortable: true, format: "date" },
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
    <div style={{ maxWidth: 900, margin: "16px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>会議室予約</h1>

      <div style={box}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "grid", gap: 4, flex: "1 1 200px" }}>
            <span style={{ fontSize: 12, color: "var(--color-muted)" }}>会議室名</span>
            <Input value={room} onChange={(e) => setRoom(e.target.value)} onKeyDown={onEnter} placeholder="会議室A" />
          </label>
          <label style={{ display: "grid", gap: 4, flex: "1 1 160px" }}>
            <span style={{ fontSize: 12, color: "var(--color-muted)" }}>予約者</span>
            <Input value={booker} onChange={(e) => setBooker(e.target.value)} onKeyDown={onEnter} placeholder="山田 太郎" />
          </label>
          <label style={{ display: "grid", gap: 4, flex: "0 1 170px" }}>
            <span style={{ fontSize: 12, color: "var(--color-muted)" }}>利用日</span>
            <DatePicker value={usedOn} onChange={(e) => setUsedOn(e.target.value)} />
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
        <DataTable rows={rows} columns={columns} searchKeys={["room", "booker"]} pageSize={10} />
      </div>
    </div>
  );
}
