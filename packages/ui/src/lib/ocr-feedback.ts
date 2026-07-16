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

/**
 * 抽出値と確定値を比較して、直された項目を返す。
 *
 * **人が直したところが、AI の弱点**。これを集めることで改善点が分かる。
 *
 * @param extracted OCR / AI が抽出した値
 * @param confirmed 人が確定した値
 * @returns 変更された項目(**変わっていないものは含まない**)
 */
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

/**
 * フィードバック記録を組み立てる。
 *
 * @param meta 文書の情報
 * @param changes 変更された項目
 * @param confidences 各項目の確信度
 * @returns フィードバック記録
 */
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

/**
 * フィードバックを送るストアを作る(学習データの蓄積)。
 *
 * **送信の失敗で業務を止めない**(フィードバックは改善のためのもので、
 * 本来の処理より優先度が低い)。
 *
 * @param options.endpoint API の URL
 * @param options.fetchImpl fetch の実装(テスト注入用)
 * @returns ストア
 */
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

/**
 * フィードバックを集計する。
 *
 * **修正率が高い項目 = AI が苦手な項目**。確信度が高いのに修正率も高いなら、
 * **AI が自信満々に間違えている**(最も危険な状態)。
 *
 * @param records フィードバック記録
 * @returns 項目ごとの修正率と平均確信度
 */
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
