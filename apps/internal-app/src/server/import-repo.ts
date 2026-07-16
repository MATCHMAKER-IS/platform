/**
 * 取込バッチの記録・一覧・ロールバック(Prisma + トランザクション + 監査ログ)。
 * @packageDocumentation
 */
import { withTransaction, recordAudit, type Result } from "@platform/db";
import type { ImportHistoryRow } from "@platform/ui";
import { db } from "./services";
import { expenseToCreateData } from "./expense-repo";
import type { Expense } from "../lib/expense";

/** ImportBatch 行(Prisma 生成型の必要部分)。 */
export interface ImportBatchRow {
  id: string;
  source: string;
  userId: string;
  total: number;
  inserted: number;
  errorCount: number;
  status: string;
  createdAt: Date;
}

/** ImportBatch 行 → UI の履歴行に変換する。 */
export function toImportHistoryRow(row: ImportBatchRow): ImportHistoryRow {
  const status: ImportHistoryRow["status"] =
    row.status === "partial" || row.status === "failed" || row.status === "rolled_back" ? row.status : "success";
  return {
    importId: row.id,
    source: row.source,
    userId: row.userId,
    importedAt: row.createdAt.toISOString(),
    total: row.total,
    inserted: row.inserted,
    errorCount: row.errorCount,
    status,
  };
}

/** 取込を確定する: バッチ作成 + 経費一括作成 + 監査記録をトランザクションで実行。 */
export async function recordImportBatch(params: {
  source: string;
  userId: string;
  expenses: Expense[];
  errorCount?: number;
}): Promise<Result<ImportBatchRow>> {
  const { source, userId, expenses, errorCount = 0 } = params;
  return withTransaction(db, async (tx) => {
    const status = errorCount > 0 ? "partial" : "success";
    const batch = (await tx.importBatch.create({
      data: { source, userId, total: expenses.length + errorCount, inserted: expenses.length, errorCount, status },
    })) as ImportBatchRow;
    if (expenses.length > 0) {
      await tx.expense.createMany({ data: expenses.map((e) => ({ ...expenseToCreateData(e), batchId: batch.id })) });
    }
    await recordAudit(tx as never, { actor: userId, action: "expense.import", target: batch.id, metadata: { source, inserted: expenses.length, errorCount } });
    return batch;
  });
}

/** 取込のロールバック: 当該バッチの経費を削除し、バッチを取消済にして監査記録。 */
export async function rollbackImportBatch(importId: string, actor: string): Promise<Result<number>> {
  return withTransaction(db, async (tx) => {
    const batch = (await tx.importBatch.findUnique({ where: { id: importId } })) as ImportBatchRow | null;
    if (!batch) throw new Error("取込バッチが見つかりません");
    if (batch.status === "rolled_back") throw new Error("既に取り消し済みです");
    const del = await tx.expense.deleteMany({ where: { batchId: importId } });
    await tx.importBatch.update({ where: { id: importId }, data: { status: "rolled_back" } });
    await recordAudit(tx as never, { actor, action: "expense.import.rollback", target: importId, metadata: { deleted: del.count } });
    return del.count;
  });
}

/** 取込履歴の一覧(新しい順)を UI 行で返す。 */
export async function listImportBatches(limit = 50): Promise<ImportHistoryRow[]> {
  const rows = (await db.importBatch.findMany({ orderBy: { createdAt: "desc" }, take: limit })) as ImportBatchRow[];
  return rows.map(toImportHistoryRow);
}
