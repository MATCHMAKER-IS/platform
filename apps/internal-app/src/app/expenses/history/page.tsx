"use client";
/** 取込履歴。ImportHistoryTable で一覧表示し、ロールバック(取消)を実行する。 */
import { useState } from "react";
import { ImportHistoryTable, type ImportHistoryRow } from "@platform/ui";

const SAMPLE_HISTORY: ImportHistoryRow[] = [
  { importId: "b3", source: "CSV", userId: "u1", importedAt: "2024-05-01T02:00:00Z", total: 5, inserted: 5, errorCount: 0, status: "success" },
  { importId: "b2", source: "CSV", userId: "u1", importedAt: "2024-04-20T05:30:00Z", total: 8, inserted: 6, errorCount: 2, status: "partial" },
  { importId: "b1", source: "CSV", userId: "u2", importedAt: "2024-04-10T01:15:00Z", total: 4, inserted: 4, errorCount: 0, status: "rolled_back" },
];

export default function HistoryPage() {
  const [rows, setRows] = useState<ImportHistoryRow[]>(SAMPLE_HISTORY);

  const onRollback = async (importId: string) => {
    // 楽観的に取消済へ更新
    setRows((prev) => prev.map((r) => (r.importId === importId ? { ...r, status: "rolled_back" } : r)));
    try {
      await fetch(`/api/expenses/batches/${importId}`, { method: "DELETE" });
    } catch {
      // デモではネットワーク不通でも表示は継続
    }
  };

  return (
    <main style={{ maxWidth: 900, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>取込履歴</h1>
      <ImportHistoryTable rows={rows} onRollback={onRollback} actorRoles={["manager"]} allowedRoles={["manager", "admin"]} />
    </main>
  );
}
