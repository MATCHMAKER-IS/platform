/**
 * 個人情報保護法の本人の権利対応(開示・削除・利用停止)。
 * 保有個人データの開示請求への回答(内容・利用目的・第三者提供先を含む)、
 * 削除/利用停止請求の適用(匿名化または削除)、保持期間超過データの抽出を提供する。
 * マスク・暗号化・匿名化の下位部品(index.ts / identity-mask.ts)の上に構築。
 * @packageDocumentation
 */
import { anonymizeRecord, isRetentionExpired } from "./index.js";

/** 保有個人データのカテゴリ(利用目的・保持・第三者提供)。 */
export interface PersonalDataCategory {
  /** カテゴリ ID。 */
  id: string;
  /** 名称(例 "会員基本情報")。 */
  name: string;
  /** 利用目的(個人情報保護法の開示事項)。 */
  purpose: string;
  /** 取得・利用の根拠(同意 / 契約 / 法令 など)。 */
  legalBasis?: string;
  /** 保持期間(日)。 */
  retentionDays?: number;
  /** 第三者提供先。 */
  thirdParties?: string[];
}

/** 本人のデータ 1 カテゴリぶん。 */
export interface SubjectDataEntry {
  categoryId: string;
  data: Record<string, unknown>;
}

/** 開示レポートの 1 項目。 */
export interface DisclosureHolding {
  category: string;
  purpose: string;
  legalBasis?: string;
  retentionDays?: number;
  thirdParties: string[];
  data: Record<string, unknown>;
}

/** 開示レポート(保有個人データの開示請求への回答)。 */
export interface DisclosureReport {
  subjectId: string;
  generatedAt: string;
  holdings: DisclosureHolding[];
}

/**
 * 本人の保有個人データから開示レポートを組み立てる。
 * 各データにカテゴリ情報(利用目的・保持期間・第三者提供先)を付与して返す。
 *
 * @param subject 本人
 * @param sources データの所在(テーブルごと)
 * @returns 開示レポート(**本人に渡す形**)
 */
export function buildDisclosureReport(input: {
  subjectId: string;
  entries: SubjectDataEntry[];
  categories: PersonalDataCategory[];
  generatedAt?: Date;
}): DisclosureReport {
  const catMap = new Map(input.categories.map((c) => [c.id, c]));
  const holdings: DisclosureHolding[] = input.entries.map((e) => {
    const cat = catMap.get(e.categoryId);
    return {
      category: cat?.name ?? e.categoryId,
      purpose: cat?.purpose ?? "(利用目的 未登録)",
      ...(cat?.legalBasis ? { legalBasis: cat.legalBasis } : {}),
      ...(cat?.retentionDays !== undefined ? { retentionDays: cat.retentionDays } : {}),
      thirdParties: cat?.thirdParties ?? [],
      data: e.data,
    };
  });
  return { subjectId: input.subjectId, generatedAt: (input.generatedAt ?? new Date()).toISOString(), holdings };
}

/**
 * 開示レポートを JSON にする(**データポータビリティ対応**)。
 *
 * 本人から「自分のデータを全部出して」と求められたときに使う
 * (GDPR・改正個人情報保護法)。**機械可読な形式で渡す**のが要件。
 *
 * @param report 開示レポート
 * @returns 整形済みの JSON 文字列
 */
export function disclosureToJson(report: DisclosureReport): string {
  return JSON.stringify(report, null, 2);
}

/** 削除の方式。anonymize=PII を伏字化して関連データは残す, delete=キー自体を除去。 */
export type ErasureMethod = "anonymize" | "delete";

/**
 * レコードから指定フィールドを削除する(削除/利用停止請求への適用)。
 * anonymize は既存の {@link anonymizeRecord}(伏字化)、delete はキーを除去。
 * @returns 処理後レコードと、実際に消したフィールド
 */
export function erasePersonalData<T extends Record<string, unknown>>(
  record: T,
  fields: (keyof T)[],
  options?: { method?: ErasureMethod },
): { record: Record<string, unknown>; erasedFields: string[] } {
  const method = options?.method ?? "anonymize";
  const present = fields.filter((f) => record[f] !== null && record[f] !== undefined);
  if (method === "delete") {
    const copy: Record<string, unknown> = { ...record };
    for (const f of present) delete copy[f as string];
    return { record: copy, erasedFields: present.map(String) };
  }
  return { record: anonymizeRecord(record, present), erasedFields: present.map(String) };
}

/** 削除受付の証跡(いつ・何を・どの方式で消したか)。 */
export interface ErasureReceipt {
  subjectId: string;
  erasedAt: string;
  method: ErasureMethod;
  erasedFields: string[];
}

/**
 * 削除処理の証跡を作る。
 *
 * **「消しました」と言うだけでは足りない**。いつ・何を・どの範囲で消したかを
 * 記録しておかないと、後から問われたときに答えられない。
 *
 * @param request 削除依頼
 * @param result 削除の結果(対象と件数)
 * @param now 現在時刻(テスト注入用)
 * @returns 証跡
 */
export function buildErasureReceipt(subjectId: string, erasedFields: string[], method: ErasureMethod, erasedAt: Date = new Date()): ErasureReceipt {
  return { subjectId, erasedAt: erasedAt.toISOString(), method, erasedFields };
}

/** 保持期間つきのレコード(抽出対象)。 */
export interface RetainableRecord {
  id: string;
  createdAt: number;
  retentionDays: number;
}

/**
 * 保持期間を過ぎたレコードの ID を返す(定期削除バッチ用)。
 * 個人情報は利用目的の達成後・保持期間経過後に遅滞なく消去する必要がある。
 *
 * @param subject 本人
 * @param sources データの所在
 * @returns 削除対象。**法令で保持が必要なものは除く**(会計帳簿は 7 年保存が義務。全部消すと別の違反になる)
 */
export function recordsToErase(records: RetainableRecord[], now: number = Date.now()): string[] {
  return records.filter((r) => isRetentionExpired(r.createdAt, r.retentionDays, now)).map((r) => r.id);
}
