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

/** しきい値 or プロファイル名から具体的なしきい値を解決する。 */
export function resolveThresholds(t?: ConfidenceThresholds | ConfidenceProfile): ConfidenceThresholds {
  if (t == null) return DEFAULT_THRESHOLDS;
  if (typeof t === "string") return CONFIDENCE_PROFILES[t];
  return t;
}

/** 信頼度を階層に分類する。未指定(undefined)は low。 */
export function classifyConfidence(confidence: number | undefined, thresholds?: ConfidenceThresholds | ConfidenceProfile): ConfidenceTier {
  const th = resolveThresholds(thresholds);
  if (confidence == null) return "low";
  if (confidence >= th.high) return "high";
  if (confidence >= th.medium) return "medium";
  return "low";
}

/** 単語(text/confidence)に階層を付与する。 */
export function bucketWords<T extends { confidence?: number }>(words: T[], thresholds?: ConfidenceThresholds): (T & { tier: ConfidenceTier })[] {
  return words.map((w) => ({ ...w, tier: classifyConfidence(w.confidence, thresholds) }));
}

/** 階層ごとの件数を数える。 */
export function countByTier<T extends { confidence?: number }>(words: T[], thresholds?: ConfidenceThresholds): Record<ConfidenceTier, number> {
  const out: Record<ConfidenceTier, number> = { high: 0, medium: 0, low: 0 };
  for (const w of words) out[classifyConfidence(w.confidence, thresholds)]++;
  return out;
}
