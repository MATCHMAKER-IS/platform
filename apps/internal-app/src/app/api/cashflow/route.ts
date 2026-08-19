/** 資金繰り: 営業キャッシュフローの月次(GET)。入金(収入)と支払・経費・報酬(支出)から算出。?from=&to=&opening=。accounting:read。 */
import { withApiObservability } from "../../../server/instrument";
import { formatDateJst } from "@platform/datetime";
import { currentUser, requirePermission } from "../../../server/authorize";
import "../../../server/env";
import { receiptStore, purchasePaymentStore, feePaymentStore } from "../../../server/platform-services";
import { listExpenses } from "../../../server/expense-repo";
import { monthlyCashFlow, summarizeCashFlow, type CashMovement } from "../../../server/cashflow";
import { monthRange } from "../../../server/trend";

function defaultRange(): { from: string; to: string } {
  // **JST の「今日」から数える。**
  //
  // `new Date()` はサーバのタイムゾーン（コンテナは UTC）で解釈されるので、
  // **JST の月初 0 時〜9 時は、UTC ではまだ前月**です——
  // **「直近 6 か月」が 1 か月ずれます**。
  //
  // **月初の朝だけ結果が変わる**ので、**気づくのは月次の集計をする人**です。
  // **`todayJst()` は `Date` を返す。** 文字列が要るのは `formatDateJst()`
  // ——`.slice()` を呼んでいたため、**この行から先が実行時に落ちていた**。
  const today = formatDateJst();       // "YYYY-MM-DD"
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));

  // **5 か月前の 1 日**（当月を含めて 6 か月）
  const fromMonth = month - 5;
  const fromYear = fromMonth <= 0 ? year - 1 : year;
  const normalized = fromMonth <= 0 ? fromMonth + 12 : fromMonth;

  return {
    from: `${String(fromYear)}-${String(normalized).padStart(2, "0")}`,
    to: today.slice(0, 7),
  };
}

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req);
  requirePermission(user, "accounting:read");
  const params = new URL(req.url).searchParams;
  const def = defaultRange();
  const from = params.get("from") ?? def.from;
  const to = params.get("to") ?? def.to;
  const opening = Number(params.get("opening") ?? 0);
  const months = monthRange(from, to);

  const inflows: CashMovement[] = (await receiptStore.list()).map((r) => ({ date: r.receivedAt, amount: r.amount }));
  const purchasePays: CashMovement[] = (await purchasePaymentStore.list()).map((p) => ({ date: p.paidAt, amount: p.amount }));
  const feePays: CashMovement[] = (await feePaymentStore.list()).map((f) => ({ date: f.paidAt, amount: f.net }));
  const expensePays: CashMovement[] = (await listExpenses({ pageSize: 1000 })).items.map((e) => ({ date: e.date, amount: e.amount }));
  const outflows: CashMovement[] = [...purchasePays, ...feePays, ...expensePays];

  const rows = monthlyCashFlow(inflows, outflows, months, opening);
  return Response.json({ from, to, opening, rows, summary: summarizeCashFlow(rows, opening) });
}

export const GET = withApiObservability("/api/cashflow", handleGET);
