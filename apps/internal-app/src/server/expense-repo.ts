/**
 * 経費データアクセス(Prisma)。基盤 `@platform/db`(createDb/paginate)を用い、
 * Prisma 行とアプリの Expense 型を相互変換する。
 * @packageDocumentation
 */
import { paginate, type Paginated } from "@platform/db";
import { db } from "./services.js";
import type { Expense } from "../lib/expense.js";

/** Prisma の Expense 行(生成型の必要部分)。 */
export interface PrismaExpenseRow {
  id: string;
  date: Date;
  category: string;
  amount: number;
  note: string | null;
}

/** Prisma 行 → アプリの Expense(date は YYYY-MM-DD、note は null→undefined)。 */
export function prismaExpenseToExpense(row: PrismaExpenseRow): Expense {
  return {
    id: row.id,
    date: row.date.toISOString().slice(0, 10),
    category: row.category,
    amount: row.amount,
    note: row.note ?? undefined,
  };
}

/** アプリの Expense → Prisma の作成データ。 */
export function expenseToCreateData(e: Expense): { date: Date; category: string; amount: number; note: string | null } {
  return { date: new Date(`${e.date}T00:00:00Z`), category: e.category, amount: e.amount, note: e.note ?? null };
}

/** 経費一覧をページネーションで取得(新しい順)。 */
export async function listExpenses(options: { page?: number; pageSize?: number } = {}): Promise<Paginated<Expense>> {
  const result = await paginate<PrismaExpenseRow>(db.expense, {
    orderBy: { date: "desc" },
    page: options.page,
    pageSize: options.pageSize,
  });
  return { ...result, items: result.items.map(prismaExpenseToExpense) };
}

/** 取込確定: 複数の経費を一括作成し、作成件数を返す。 */
export async function createExpenses(expenses: Expense[]): Promise<number> {
  if (expenses.length === 0) return 0;
  const result = await db.expense.createMany({ data: expenses.map(expenseToCreateData) });
  return result.count;
}
