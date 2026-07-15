/**
 * 確定した取り込みデータの一括保存(トランザクション)+ 取り込み履歴の記録。
 * db の bulkInsertReturning / withTransaction と、ui の buildImportHistory を組み合わせる。
 * 実運用は apps/* のサービス層に置く。ここは型と流れの参照用。
 */
import { withTransaction } from "@platform/db";
import { expenseToRow, type ExpenseRecord } from "@platform/report";
import { buildImportHistory, type ImportSummary } from "@platform/ui";
import type { PrismaClient, Prisma } from "@prisma/client";

/** 確定済み経費を一括保存し、同一トランザクションで履歴を残す。全件成功か全件失敗。 */
export async function saveConfirmedExpenses(
  db: PrismaClient,
  records: ExpenseRecord[],
  meta: { source: string; userId: string },
  summary: ImportSummary,
) {
  return withTransaction(db, async (tx: Prisma.TransactionClient) => {
    // createMany 相当(ID を取りたいので tx 内で create ループ = all-or-nothing)
    const rows = records.map(expenseToRow);
    const created: unknown[] = [];
    for (const data of rows) created.push(await (tx as unknown as { expense: { create(a: { data: unknown }): Promise<unknown> } }).expense.create({ data }));

    // 取り込み履歴(同じトランザクション)
    const history = buildImportHistory(meta, summary, created.length);
    await (tx as unknown as { importHistory: { create(a: { data: unknown }): Promise<unknown> } }).importHistory.create({ data: history });

    return { inserted: created.length, history };
  });
}

/** 取り込みのロールバック: 該当 importId の挿入行を削除し、履歴を rolled_back に更新(1トランザクション)。 */
export async function rollbackImport(db: PrismaClient, importId: string) {
  return withTransaction(db, async (tx: Prisma.TransactionClient) => {
    const t = tx as unknown as {
      expense: { deleteMany(a: { where: { importId: string } }): Promise<{ count: number }> };
      importHistory: { update(a: { where: { importId: string }; data: unknown }): Promise<unknown> };
    };
    const del = await t.expense.deleteMany({ where: { importId } });
    await t.importHistory.update({ where: { importId }, data: { status: "rolled_back" } });
    return { deleted: del.count };
  });
}
