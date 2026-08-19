"use client";
/** 取込履歴。ImportHistoryTable で一覧表示し、ロールバック(取消)を実行する。 */
import { useState } from "react";
import { ConfirmDialog } from "@platform/ui";
import { submitJson } from "@platform/form";
import { ImportHistoryTable, type ImportHistoryRow } from "@platform/ui";

const SAMPLE_HISTORY: ImportHistoryRow[] = [
  { importId: "b3", source: "CSV", userId: "u1", importedAt: "2024-05-01T02:00:00Z", total: 5, inserted: 5, errorCount: 0, status: "success" },
  { importId: "b2", source: "CSV", userId: "u1", importedAt: "2024-04-20T05:30:00Z", total: 8, inserted: 6, errorCount: 2, status: "partial" },
  { importId: "b1", source: "CSV", userId: "u2", importedAt: "2024-04-10T01:15:00Z", total: 4, inserted: 4, errorCount: 0, status: "rolled_back" },
];

export default function HistoryPage() {
  const [rows, setRows] = useState<ImportHistoryRow[]>(SAMPLE_HISTORY);

  // **取り消しの前に確認を挟む。**
  // **一括で取り込んだ経費が、まとめて取消済になります**——
  // **1 件ずつ戻す手段はありません**。**押した人が件数を知らない**まま
  // 押せてしまうのが危ないところです。
  const [rollbackId, setRollbackId] = useState<string | null>(null);

  const onRollback = async (importId: string) => {
    // 楽観的に取消済へ更新
    setRows((prev) => prev.map((r) => (r.importId === importId ? { ...r, status: "rolled_back" } : r)));
    // 取消は素の fetch を使わない(タイムアウトが無いと押し直されて二重になる)
    await submitJson(`/api/expenses/batches/${encodeURIComponent(importId)}`, undefined, { method: "DELETE" });
  };

  return (
    <main style={{ maxWidth: 900, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>取込履歴</h1>
      <ImportHistoryTable rows={rows} onRollback={(id) => { setRollbackId(id); }} actorRoles={["manager"]} allowedRoles={["manager", "admin"]} />
    
      {/* **取り消しの前に確認。** **一括で取り込んだ経費が、まとめて取消済**に
          なります——**1 件ずつ戻す手段はありません**。 */}
      <ConfirmDialog
        open={rollbackId !== null}
        onOpenChange={(o) => { if (!o) setRollbackId(null); }}
        title="この取り込みを取り消します"
        description="この取り込みで登録された経費が、まとめて取消済になります。1 件ずつ戻す手段はありません。"
        confirmText="取り消す"
        destructive
        onConfirm={() => {
          const id = rollbackId;
          setRollbackId(null);
          if (id !== null) void onRollback(id);
        }}
      />
    </main>
  );
}
