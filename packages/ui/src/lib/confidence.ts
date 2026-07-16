/**
 * 信頼度の階層分け(高/中/低)。手書き数字など、認識の確からしさで色分けする。
 * @packageDocumentation
 */

/** 信頼度の階層。 */
export type ConfidenceTier = "high" | "medium" | "low";

/** しきい値(既定: high>=85, medium>=60)。 */
export interface ConfidenceThresholds { high: number; medium: number }

const DEFAULT_THRESHOLDS: ConfidenceThresholds = { high: 85, medium: 60 };

/** 業務別のしきい値プロファイル。 */
export const CONFIDENCE_PROFILES = {
  strict: { high: 95, medium: 80 },
  standard: { high: 85, medium: 60 },
  lenient: { high: 70, medium: 45 },
} as const;

/** プロファイル名。 */
export type ConfidenceProfile = keyof typeof CONFIDENCE_PROFILES;

/**
 * しきい値を解決する。
 *
 * **用途で基準が違う**(請求書は厳しく、メモは緩く)。プロファイル名で
 * 選べるようにしてある。
 *
 * @param input しきい値の数値、またはプロファイル名(`strict` / `normal` / `loose`)
 * @returns 具体的なしきい値
 */
export function resolveThresholds(t?: ConfidenceThresholds | ConfidenceProfile): ConfidenceThresholds {
  if (t == null) return DEFAULT_THRESHOLDS;
  if (typeof t === "string") return CONFIDENCE_PROFILES[t];
  return t;
}

/**
 * 信頼度を階層に分類する。
 *
 * **未指定は low**(「分からない」を「高い」と扱わない。安全側)。
 *
 * @param confidence 信頼度(0–1)
 * @param thresholds しきい値
 * @returns `high` / `medium` / `low`
 */
export function classifyConfidence(confidence: number | undefined, thresholds?: ConfidenceThresholds | ConfidenceProfile): ConfidenceTier {
  const th = resolveThresholds(thresholds);
  if (confidence == null) return "low";
  if (confidence >= th.high) return "high";
  if (confidence >= th.medium) return "medium";
  return "low";
}

/**
 * 単語に信頼度の階層を付ける。
 *
 * **低い単語を画面で強調する**(人が確認すべき箇所が一目で分かる)。
 *
 * @param words 単語と信頼度
 * @param thresholds しきい値
 * @returns 階層を付けた単語
 */
export function bucketWords<T extends { confidence?: number }>(words: T[], thresholds?: ConfidenceThresholds): (T & { tier: ConfidenceTier })[] {
  return words.map((w) => ({ ...w, tier: classifyConfidence(w.confidence, thresholds) }));
}

/**
 * 階層ごとの件数を数える。
 *
 * @param words 階層を付けた単語
 * @returns 階層 → 件数(**low が多ければ、再スキャンを促す**)
 */
export function countByTier<T extends { confidence?: number }>(words: T[], thresholds?: ConfidenceThresholds): Record<ConfidenceTier, number> {
  const out: Record<ConfidenceTier, number> = { high: 0, medium: 0, low: 0 };
  for (const w of words) out[classifyConfidence(w.confidence, thresholds)]++;
  return out;
}
