/**
 * 金額閾値つき承認ルーティング（アプリ側の組み合わせ）。金額に応じて承認段数を切り替える。
 * ルーティングは @platform/workflow の routeByAmount に委譲する。
 * @packageDocumentation
 */
import { routeByAmount, type AmountTier, type WorkflowDefinition } from "@platform/workflow";

/**
 * 金額別の承認ルート（社内規程の例）。
 * - 10万円未満: 上長（manager）1 段。
 * - 50万円未満: 上長 → 経理（finance）2 段。
 * - それ以上: 上長 → 経理 → 管理者（admin）3 段。
 */
export const AMOUNT_TIERS: AmountTier[] = [
  { under: 100000, steps: [{ name: "上長承認", approverRole: "manager" }] },
  { under: 500000, steps: [{ name: "上長承認", approverRole: "manager" }, { name: "経理承認", approverRole: "finance" }] },
  { steps: [{ name: "上長承認", approverRole: "manager" }, { name: "経理承認", approverRole: "finance" }, { name: "役員承認", approverRole: "admin" }] },
];

/** 金額から承認ワークフロー定義を決める。 */
export function routeForAmount(amount: number): WorkflowDefinition {
  return routeByAmount(amount, AMOUNT_TIERS);
}

/** 金額に対する承認段数。 */
export function stepCountForAmount(amount: number): number {
  return routeForAmount(amount).steps.length;
}
