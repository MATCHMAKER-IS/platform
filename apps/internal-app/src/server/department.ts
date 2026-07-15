/**
 * 部門別会計（アプリ側の組み合わせ）。予算（部門×区分）と経費実績を突き合わせ、部門ごとの予実を出す。
 * また、部門タグ付き仕訳から部門別損益を集計する。純粋な組み立てのみ。
 * @packageDocumentation
 */
import { type JournalEntry } from "@platform/accounting";

/** 部門別の予実 1 行。 */
export interface DepartmentVariance {
  department: string;
  budget: number;
  actual: number;
  /** 差異（予算 − 実績）。 */
  variance: number;
}

/** 未配賦（どの部門の予算区分にも該当しない経費）の部門名。 */
export const UNALLOCATED = "(未配賦)";

/**
 * 予算（部門×区分）と経費を突き合わせ、部門ごとの予算・実績・差異を出す。
 * 経費は、その区分を予算計上している部門へ按分（複数部門なら予算額で比例配分）する。
 * どの部門も計上していない区分の経費は「未配賦」に集める。
 */
export function departmentBudgetVsActual(budgets: { department: string; category: string; amount: number }[], expenses: { category: string; amount: number }[]): DepartmentVariance[] {
  // 部門別予算合計
  const budgetByDept = new Map<string, number>();
  const order: string[] = [];
  // 区分 → [(部門, 予算額)]
  const catToDepts = new Map<string, { department: string; amount: number }[]>();
  for (const b of budgets) {
    if (!budgetByDept.has(b.department)) { budgetByDept.set(b.department, 0); order.push(b.department); }
    budgetByDept.set(b.department, budgetByDept.get(b.department)! + b.amount);
    const list = catToDepts.get(b.category) ?? [];
    list.push({ department: b.department, amount: b.amount });
    catToDepts.set(b.category, list);
  }
  // 部門別実績（経費の按分）
  const actualByDept = new Map<string, number>();
  const add = (dept: string, amt: number) => {
    if (!budgetByDept.has(dept) && !actualByDept.has(dept)) order.push(dept);
    actualByDept.set(dept, (actualByDept.get(dept) ?? 0) + amt);
  };
  for (const e of expenses) {
    const depts = catToDepts.get(e.category);
    if (!depts || depts.length === 0) { add(UNALLOCATED, e.amount); continue; }
    const totalBudget = depts.reduce((s, d) => s + d.amount, 0);
    if (totalBudget <= 0) { add(depts[0]!.department, e.amount); continue; }
    let assigned = 0;
    depts.forEach((d, i) => {
      const share = i === depts.length - 1 ? e.amount - assigned : Math.floor((e.amount * d.amount) / totalBudget);
      assigned += share;
      add(d.department, share);
    });
  }
  return order.map((dept) => {
    const budget = budgetByDept.get(dept) ?? 0;
    const actual = actualByDept.get(dept) ?? 0;
    return { department: dept, budget, actual, variance: budget - actual };
  });
}

/** 部門別損益 1 行。 */
export interface DepartmentPnl {
  department: string;
  revenue: number;
  expense: number;
  profit: number;
}

/** 未指定部門の表示名。 */
export const NO_DEPARTMENT = "(部門なし)";

/**
 * 部門タグ（JournalLine.department）付きの仕訳から部門別損益を集計する。
 * 収益は貸方残、費用は借方残。ここでは勘定科目区分の代わりに、金額の符号ではなく
 * 収益/費用の判定を呼び出し側の科目名集合で行うため、シンプルに「売上高＝収益」「その他費用勘定＝費用」で扱う。
 */
export function departmentPnl(entries: JournalEntry[], revenueAccounts: string[], expenseAccounts: string[]): DepartmentPnl[] {
  const rev = new Set(revenueAccounts);
  const exp = new Set(expenseAccounts);
  const byDept = new Map<string, DepartmentPnl>();
  const order: string[] = [];
  const get = (d: string) => {
    let row = byDept.get(d);
    if (!row) { row = { department: d, revenue: 0, expense: 0, profit: 0 }; byDept.set(d, row); order.push(d); }
    return row;
  };
  for (const entry of entries) {
    for (const line of entry.lines) {
      const dept = line.department ?? NO_DEPARTMENT;
      if (rev.has(line.account)) get(dept).revenue += line.credit - line.debit;
      else if (exp.has(line.account)) get(dept).expense += line.debit - line.credit;
    }
  }
  return order.map((d) => {
    const row = byDept.get(d)!;
    row.profit = row.revenue - row.expense;
    return row;
  });
}
