/**
 * 条件別の承認ルート生成(金額別・部門別など)。
 * 「10万未満は課長のみ、以上は課長→部長」のような稟議ルートを宣言的に組み立てる。
 * 既存の線形エンジン(startWorkflow/approve)にそのまま渡せる WorkflowDefinition を返す。
 * @packageDocumentation
 */
import type { WorkflowDefinition, WorkflowStep } from "./index";

/** ルート分岐の 1 ルール。上から評価し、最初に一致したものを採用する。 */
export interface RouteRule<Ctx> {
  /** 適用条件。省略時は無条件一致(デフォルトルート)。 */
  when?: (ctx: Ctx) => boolean;
  /** そのルートの承認ステップ。 */
  steps: WorkflowStep[];
  /** ルールの説明(監査・表示用)。 */
  label?: string;
}

/**
 * コンテキスト(金額・部門など)からルート(WorkflowDefinition)を決定する。
 * 上から評価し、最初に条件を満たしたルールの steps を採用する。どれも満たさなければ例外。
 *
 * @param request 申請
 * @param routes ルートの定義
 * @returns 適用するルート
 * @throws {@link @platform/core#AppError} コード `CONFIG` — 該当するルートが無い場合(**申請を宙ぶらりんにしない**)
 */
export function resolveRoute<Ctx>(rules: RouteRule<Ctx>[], ctx: Ctx): WorkflowDefinition {
  for (const rule of rules) {
    if (!rule.when || rule.when(ctx)) {
      return { steps: rule.steps };
    }
  }
  throw new Error("一致する承認ルートがありません(デフォルトルールを用意してください)");
}

/** 金額しきい値ルートの 1 段。 */
export interface AmountTier {
  /** この金額「未満」まで(未指定 = 上限なし = 最終段)。 */
  under?: number;
  /** その金額帯の承認ステップ。 */
  steps: WorkflowStep[];
}

/**
 * 金額しきい値から承認ルートを組み立てる(昇順の tier を上から判定)。
 * @example
 * ```ts
 * routeByAmount(amount, [
 *   { under: 100_000, steps: [{ name: "課長承認", approverRole: "manager" }] },
 *   { under: 1_000_000, steps: [manager, director] },
 *   { steps: [manager, director, executive] }, // 上限なし
 * ]);
 * ```
 *
 * @param amount 金額
 * @param tiers 金額帯の定義
 * @returns 承認ルート(**金額で承認者が変わる**。10 万円までは課長、それ以上は部長など)
 * @throws {@link @platform/core#AppError} コード `CONFIG` — 該当する金額帯が無い場合
 */
export function routeByAmount(amount: number, tiers: AmountTier[]): WorkflowDefinition {
  for (const tier of tiers) {
    if (tier.under === undefined || amount < tier.under) {
      return { steps: tier.steps };
    }
  }
  throw new Error("金額に一致するルートがありません(上限なしの tier を末尾に用意してください)");
}
