/**
 * 予算実績リポジトリ。部門×区分×期間の予算を保持し、実績（経費など）と突き合わせて差異を出す。
 * @packageDocumentation
 */

/** 予算 1 行。 */
export interface BudgetLine {
  department: string;
  category: string;
  /** 期間（YYYY-MM）。 */
  period: string;
  amount: number;
}

/** 予算実績の差異 1 行。 */
export interface VarianceRow {
  category: string;
  period: string;
  budget: number;
  actual: number;
  /** 差異（予算 − 実績。プラスは予算内、マイナスは超過）。 */
  variance: number;
  /** 消化率（実績 ÷ 予算。予算0なら null）。 */
  rate: number | null;
}

function key(category: string, period: string): string {
  return `${category}\u0000${period}`;
}

/**
 * 予算と実績を突き合わせて差異を出す。予算は区分×期間で合算（部門をまたいで集計）。
 * @param budgets 予算行。
 * @param actuals 区分×期間ごとの実績額（key = `${category}\u0000${period}`）。
 */
export function budgetVariance(budgets: BudgetLine[], actuals: Record<string, number>): VarianceRow[] {
  const byKey = new Map<string, VarianceRow>();
  const order: string[] = [];
  for (const b of budgets) {
    const k = key(b.category, b.period);
    let row = byKey.get(k);
    if (!row) {
      row = { category: b.category, period: b.period, budget: 0, actual: 0, variance: 0, rate: null };
      byKey.set(k, row);
      order.push(k);
    }
    row.budget += b.amount;
  }
  // 実績のみ存在する区分も行に含める
  for (const k of Object.keys(actuals)) {
    if (!byKey.has(k)) {
      const sep = k.indexOf("\u0000");
      const row: VarianceRow = { category: k.slice(0, sep), period: k.slice(sep + 1), budget: 0, actual: 0, variance: 0, rate: null };
      byKey.set(k, row);
      order.push(k);
    }
  }
  for (const k of order) {
    const row = byKey.get(k)!;
    row.actual = actuals[k] ?? 0;
    row.variance = row.budget - row.actual;
    row.rate = row.budget > 0 ? row.actual / row.budget : null;
  }
  return order.map((k) => byKey.get(k)!);
}

/** 経費レコード（date=YYYY-MM-DD, category, amount）を区分×期間の実績マップに集計する。 */
export function actualsFromExpenses(expenses: { date: string; category: string; amount: number }[], period?: string): Record<string, number> {
  const map: Record<string, number> = {};
  for (const e of expenses) {
    const p = e.date.slice(0, 7);
    if (period && p !== period) continue;
    const k = key(e.category, p);
    map[k] = (map[k] ?? 0) + e.amount;
  }
  return map;
}

/** 予算ストア。 */
export interface BudgetStore {
  list(period?: string): Promise<BudgetLine[]>;
  add(line: BudgetLine): Promise<BudgetLine>;
}

/** インメモリ実装。 */
export function createMemoryBudgetStore(): BudgetStore {
  const lines: BudgetLine[] = [];
  return {
    async list(period) {
      return lines.filter((l) => !period || l.period === period);
    },
    async add(line) {
      lines.push(line);
      return line;
    },
  };
}

// ── Prisma 実装 ──

/** BudgetRow の必要部分。 */
export interface BudgetRow {
  id: string;
  department: string;
  category: string;
  period: string;
  amount: number;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface BudgetStoreDb {
  budgetRow: {
    findMany(args: { orderBy: { period: "asc" } }): Promise<BudgetRow[]>;
    create(args: { data: { department: string; category: string; period: string; amount: number } }): Promise<BudgetRow>;
  };
}

/** Prisma 実装。 */
export function createPrismaBudgetStore(db: BudgetStoreDb): BudgetStore {
  return {
    async list(period) {
      return (await db.budgetRow.findMany({ orderBy: { period: "asc" } })).map((r) => ({ department: r.department, category: r.category, period: r.period, amount: r.amount })).filter((l) => !period || l.period === period);
    },
    async add(line) {
      await db.budgetRow.create({ data: { department: line.department, category: line.category, period: line.period, amount: line.amount } });
      return line;
    },
  };
}
