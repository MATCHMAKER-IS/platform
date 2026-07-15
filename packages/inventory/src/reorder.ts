/**
 * 発注点・補充提案(純ロジック)。安全在庫とリードタイム需要から発注点や発注量を求める。
 * @packageDocumentation
 */

/** 発注点の設定。 */
export interface ReorderPolicy {
  /** 安全在庫(最低確保数)。 */
  safetyStock: number;
  /** 1 日あたり平均需要。 */
  dailyDemand: number;
  /** 補充リードタイム(日）。 */
  leadTimeDays: number;
  /** 補充後の目標在庫(発注量の上限計算に使う)。未指定なら発注点の 2 倍。 */
  targetLevel?: number;
}

/** 発注点 = 安全在庫 + リードタイム needs（リードタイム中の需要）。 */
export function reorderPoint(policy: ReorderPolicy): number {
  return policy.safetyStock + Math.ceil(policy.dailyDemand * policy.leadTimeDays);
}

/** 補充が必要か(現在庫 <= 発注点）。 */
export function needsReorder(onHandQty: number, policy: ReorderPolicy): boolean {
  return onHandQty <= reorderPoint(policy);
}

/** 発注すべき数量（目標在庫まで補充。不要なら 0）。 */
export function reorderQuantity(onHandQty: number, policy: ReorderPolicy): number {
  if (!needsReorder(onHandQty, policy)) return 0;
  const target = policy.targetLevel ?? reorderPoint(policy) * 2;
  return Math.max(0, target - onHandQty);
}
