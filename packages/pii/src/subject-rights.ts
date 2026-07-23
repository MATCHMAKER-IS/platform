/**
 * 個人情報保護法の本人の権利対応(開示・削除・利用停止)。
 * 保有個人データの開示請求への回答(内容・利用目的・第三者提供先を含む)、
 * 削除/利用停止請求の適用(匿名化または削除)、保持期間超過データの抽出を提供する。
 * マスク・暗号化・匿名化の下位部品(index.ts / identity-mask.ts)の上に構築。
 * @packageDocumentation
 */
import { anonymizeRecord, isRetentionExpired } from "./index";

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
 * **この関数は法令の保存義務を見ない。** 会計帳簿の 7 年保存のような義務があるものを
 * 含めて消すと別の違反になるため、削除要求への対応には decideErasure を使うこと。
 *
 * @param records 保持期間つきのレコード
 * @param now     現在時刻(ミリ秒)
 * @returns 保持期間を過ぎたレコードの ID
 */
export function recordsToErase(records: RetainableRecord[], now: number = Date.now()): string[] {
  return records.filter((r) => isRetentionExpired(r.createdAt, r.retentionDays, now)).map((r) => r.id);
}

/**
 * 法令で保存が義務づけられたデータ。
 *
 * 本人から削除を求められても、**法令の保存義務が優先する**。
 * 例: 会計帳簿・証憑は 7 年(電子帳簿保存法・法人税法)、
 *     労働者名簿と賃金台帳は 5 年(労働基準法)。
 */
export interface LegalHold {
  /** 対象レコードの ID。 */
  recordId: string;
  /** 根拠(例: "電子帳簿保存法 7年")。**空にしない**。後から説明できなくなる。 */
  basis: string;
  /** 保存期限(この日を過ぎたら削除してよい)。 */
  until: string;
}

/** 削除要求に対する判断。 */
export interface ErasureDecision {
  recordId: string;
  /** 消してよいか。 */
  canErase: boolean;
  /** そう判断した理由(本人に説明する内容)。 */
  reason: string;
  /** 消せない場合、いつになれば消せるか。 */
  erasableFrom?: string;
}

/**
 * 削除要求に対して、レコードごとに消してよいかを判断する。
 *
 * **保存義務と削除要求は逆を向く。** 個人情報保護法は「利用目的の達成後は遅滞なく消去」を求め、
 * 電子帳簿保存法は「7 年間の保存」を求める。どちらも守るには、
 * **法令の保存義務があるものは残し、その旨を本人に説明する**しかない。
 *
 * 「全部消す」も「全部残す」も、どちらかの違反になる。
 *
 * @param records レコード(保持期間つき)
 * @param holds   法令による保存義務
 * @param asOf    基準日(YYYY-MM-DD)
 * @returns レコードごとの判断
 *
 * @example
 * ```ts
 * const decisions = decideErasure(records, [
 *   { recordId: "invoice-1", basis: "電子帳簿保存法 7年", until: "2033-03-31" },
 * ], "2026-07-23");
 * const erasable = decisions.filter((d) => d.canErase).map((d) => d.recordId);
 * ```
 */
export function decideErasure(
  records: readonly RetainableRecord[],
  holds: readonly LegalHold[],
  asOf: string,
): ErasureDecision[] {
  const now = Date.parse(`${asOf}T00:00:00Z`);
  const byId = new Map(holds.map((h) => [h.recordId, h]));

  return records.map((r) => {
    const hold = byId.get(r.id);
    // 法令の保存義務が生きているなら、削除要求より優先する
    if (hold && hold.until > asOf) {
      return {
        recordId: r.id,
        canErase: false,
        reason: `法令により保存義務があります(${hold.basis})`,
        erasableFrom: hold.until,
      };
    }
    // 義務が切れていれば、自社の保持期間で判断する
    if (!isRetentionExpired(r.createdAt, r.retentionDays, now)) {
      const from = new Date(r.createdAt + r.retentionDays * 86_400_000).toISOString().slice(0, 10);
      return {
        recordId: r.id,
        canErase: false,
        reason: "保持期間が残っています(利用目的の達成前)",
        erasableFrom: from,
      };
    }
    return {
      recordId: r.id,
      canErase: true,
      reason: hold ? `保存義務が終了しています(${hold.basis}・${hold.until}まで)` : "保持期間を過ぎています",
    };
  });
}

/**
 * 本人へ返す説明文を組み立てる。
 *
 * 「消せません」だけでは納得が得られない。**根拠といつ消せるか**を必ず示す。
 *
 * @param decisions 判断の一覧
 * @returns 本人向けの説明(そのまま通知に使える)
 */
export function explainErasure(decisions: readonly ErasureDecision[]): string {
  const erased = decisions.filter((d) => d.canErase);
  const kept = decisions.filter((d) => !d.canErase);
  const lines: string[] = [];

  if (erased.length > 0) {
    lines.push(`${erased.length} 件を削除しました。`);
  }
  if (kept.length > 0) {
    lines.push(`${kept.length} 件は、次の理由により削除できませんでした。`);
    // 同じ理由はまとめる(件数が多いと読めなくなる)
    const grouped = new Map<string, { count: number; from?: string }>();
    for (const k of kept) {
      const cur = grouped.get(k.reason) ?? { count: 0, from: k.erasableFrom };
      grouped.set(k.reason, { count: cur.count + 1, from: cur.from });
    }
    for (const [reason, { count, from }] of grouped) {
      lines.push(`・${reason}（${count} 件${from ? `／${from} 以降に削除できます` : ""}）`);
    }
  }
  return lines.join("\n");
}
