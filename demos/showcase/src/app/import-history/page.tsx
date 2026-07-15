"use client";
/** 取り込み履歴一覧 + 権限つきロールバック + 挿入行の明細プレビュー。 */
import { useState } from "react";
import { ImportHistoryTable, ImportHistoryDetail, Button, Badge, type ImportHistoryRow, type SheetColumn } from "@platform/ui";

const SAMPLE: ImportHistoryRow[] = [
  { importId: "imp-1004", source: "csv", userId: "u1", importedAt: "2026-02-10T09:12:00Z", total: 3, inserted: 3, errorCount: 0, status: "success" },
  { importId: "imp-1003", source: "paste", userId: "u2", importedAt: "2026-02-09T15:40:00Z", total: 40, inserted: 37, errorCount: 3, status: "partial" },
  { importId: "imp-1002", source: "csv", userId: "u1", importedAt: "2026-02-08T11:05:00Z", total: 10, inserted: 0, errorCount: 10, status: "failed" },
];

// importId → 挿入行(実運用は fetchRows で取得)
const DETAIL: Record<string, Record<string, string>[]> = {
  "imp-1004": [
    { date: "2026-02-01", vendor: "文具堂", category: "消耗品費", amount: "3,300" },
    { date: "2026-02-03", vendor: "JR東日本", category: "交通費", amount: "1,100" },
    { date: "2026-02-05", vendor: "書店", category: "図書費", amount: "2,200" },
  ],
};
const detailCols: SheetColumn<Record<string, string>>[] = [
  { key: "date", header: "日付", width: 110 }, { key: "vendor", header: "支払先", width: 140 },
  { key: "category", header: "科目", width: 110 }, { key: "amount", header: "金額", width: 100, align: "right" },
];

export default function Page() {
  const [rows, setRows] = useState(SAMPLE);
  const [role, setRole] = useState<"approver" | "user">("approver");
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <main style={{ maxWidth: 880, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>取り込み履歴</h1>
      <div style={{ display: "flex", alignItems: "center", gap: ".5rem", margin: ".5rem 0 1rem" }}>
        <span style={{ fontSize: ".9rem", color: "var(--color-muted)" }}>操作者:</span>
        <Button variant={role === "approver" ? "primary" : "secondary"} onClick={() => setRole("approver")}>承認者</Button>
        <Button variant={role === "user" ? "primary" : "secondary"} onClick={() => setRole("user")}>一般</Button>
        <Badge variant="secondary">取消は承認者のみ</Badge>
      </div>

      <ImportHistoryTable
        rows={rows}
        actorRoles={[role]}
        allowedRoles={["approver"]}
        onRollback={(id) => { if (confirm(`${id} を取り消しますか?`)) setRows((rs) => rs.map((r) => (r.importId === id ? { ...r, status: "rolled_back" } : r))); }}
      />

      <section style={{ marginTop: "1.5rem" }}>
        <h2 style={{ fontWeight: 700, marginBottom: ".5rem" }}>明細プレビュー(挿入された行)</h2>
        <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", marginBottom: ".5rem" }}>
          {rows.map((r) => <Button key={r.importId} variant="secondary" onClick={() => setSelected(r.importId)}>{r.importId}</Button>)}
        </div>
        {selected && (
          <ImportHistoryDetail<Record<string, string>>
            importId={selected}
            columns={detailCols}
            rows={DETAIL[selected] ?? []}
          />
        )}
      </section>
      <p style={{ marginTop: "1.5rem" }}><a href="/">← 戻る</a></p>
    </main>
  );
}
