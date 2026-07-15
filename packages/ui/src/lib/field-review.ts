/**
 * 信頼度による確認要否の判定(純関数)。
 * @packageDocumentation
 */

/** レビュー対象フィールド。 */
export interface ReviewField {
  key: string;
  label: string;
  value: string;
  /** 0〜100。未指定は「不明」扱いで要確認。 */
  confidence?: number;
}

/** threshold 未満(または不明)を要確認とみなして分ける。 */
export function splitByConfidence(fields: ReviewField[], threshold = 70): { review: ReviewField[]; confirmed: ReviewField[] } {
  const review: ReviewField[] = [];
  const confirmed: ReviewField[] = [];
  for (const f of fields) {
    if (f.confidence == null || f.confidence < threshold) review.push(f);
    else confirmed.push(f);
  }
  return { review, confirmed };
}

/** そのフィールドが要確認か。 */
export function needsReview(confidence: number | undefined, threshold = 70): boolean {
  return confidence == null || confidence < threshold;
}
