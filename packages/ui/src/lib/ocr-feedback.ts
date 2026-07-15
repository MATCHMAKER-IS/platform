/**
 * OCR 抽出の学習用フィードバック。ユーザーの修正(OCR値→確定値)を記録する。
 * @packageDocumentation
 */

/** 1 フィールドの修正。 */
export interface FieldCorrection { field: string; ocrValue: string; correctedValue: string; confidence?: number }

/** フィードバック記録。 */
export interface OcrFeedback {
  at: string;
  userId: string;
  docId?: string;
  source?: string;
  corrections: FieldCorrection[];
  /** 修正が無かった(=抽出が正しかった)フィールド数。 */
  acceptedCount: number;
}

/** 抽出値と確定値を比較し、変更されたフィールドの一覧を返す。 */
export function collectCorrections(
  original: Record<string, string>,
  corrected: Record<string, string>,
  confidences: Record<string, number> = {},
): FieldCorrection[] {
  const keys = new Set([...Object.keys(original), ...Object.keys(corrected)]);
  const out: FieldCorrection[] = [];
  for (const field of keys) {
    const a = (original[field] ?? "").trim();
    const b = (corrected[field] ?? "").trim();
    if (a !== b) out.push({ field, ocrValue: a, correctedValue: b, confidence: confidences[field] });
  }
  return out;
}

/** フィードバック記録を組み立てる。 */
export function buildOcrFeedback(
  meta: { userId: string; docId?: string; source?: string; at?: string },
  original: Record<string, string>,
  corrected: Record<string, string>,
  confidences?: Record<string, number>,
): OcrFeedback {
  const corrections = collectCorrections(original, corrected, confidences);
  const fieldCount = new Set([...Object.keys(original), ...Object.keys(corrected)]).size;
  return {
    at: meta.at ?? new Date().toISOString(),
    userId: meta.userId,
    docId: meta.docId,
    source: meta.source,
    corrections,
    acceptedCount: fieldCount - corrections.length,
  };
}

/** フィードバック保存先。 */
export interface OcrFeedbackStore {
  record(feedback: OcrFeedback): Promise<void>;
}

/** サーバにフィードバックを送る fetch ストア(学習データ蓄積)。 */
export function createOcrFeedbackStore(options: { endpoint: string; headers?: Record<string, string>; fetch?: typeof fetch }): OcrFeedbackStore {
  const doFetch = options.fetch ?? (typeof fetch !== "undefined" ? fetch : undefined);
  return {
    async record(feedback) {
      if (!doFetch) return;
      await doFetch(options.endpoint, { method: "POST", headers: { "content-type": "application/json", ...options.headers }, body: JSON.stringify(feedback) });
    },
  };
}

/** フィールド別の集計。 */
export interface FieldFeedbackStat { field: string; corrections: number; total: number; correctionRate: number; avgConfidence: number | null }

/** フィードバック全体の集計。 */
export interface FeedbackAggregate {
  totalDocs: number;
  totalFields: number;
  totalCorrections: number;
  acceptanceRate: number;
  byField: FieldFeedbackStat[];
}

/** フィードバック記録群を集計する(フィールド別の修正率・平均信頼度)。 */
export function aggregateOcrFeedback(feedbacks: OcrFeedback[]): FeedbackAggregate {
  const fieldTotal = new Map<string, number>();
  const fieldCorr = new Map<string, number>();
  const fieldConfSum = new Map<string, number>();
  const fieldConfCount = new Map<string, number>();
  let totalFields = 0, totalCorrections = 0;

  for (const fb of feedbacks) {
    const touched = fb.corrections.length + fb.acceptedCount;
    totalFields += touched;
    totalCorrections += fb.corrections.length;
    for (const c of fb.corrections) {
      fieldTotal.set(c.field, (fieldTotal.get(c.field) ?? 0) + 1);
      fieldCorr.set(c.field, (fieldCorr.get(c.field) ?? 0) + 1);
      if (c.confidence != null) {
        fieldConfSum.set(c.field, (fieldConfSum.get(c.field) ?? 0) + c.confidence);
        fieldConfCount.set(c.field, (fieldConfCount.get(c.field) ?? 0) + 1);
      }
    }
  }
  const byField: FieldFeedbackStat[] = [...fieldTotal.keys()].map((field) => {
    const corrections = fieldCorr.get(field) ?? 0;
    const total = fieldTotal.get(field) ?? 0;
    const cnt = fieldConfCount.get(field) ?? 0;
    return {
      field, corrections, total,
      correctionRate: total === 0 ? 0 : corrections / total,
      avgConfidence: cnt === 0 ? null : Math.round((fieldConfSum.get(field) ?? 0) / cnt),
    };
  }).sort((a, b) => b.corrections - a.corrections);

  return {
    totalDocs: feedbacks.length,
    totalFields,
    totalCorrections,
    acceptanceRate: totalFields === 0 ? 1 : (totalFields - totalCorrections) / totalFields,
    byField,
  };
}
