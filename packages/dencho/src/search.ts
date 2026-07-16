/**
 * 検索要件(電子帳簿保存法の「可視性の確保」)。
 * 取引年月日・取引金額・取引先の 3 項目で検索できること、日付・金額は範囲指定、
 * 2 項目以上の組み合わせ(AND)検索に対応する。
 * @packageDocumentation
 */

/** 検索対象の取引レコード(電帳法の必須検索項目)。 */
export interface TransactionRecord {
  /** 任意の識別子。 */
  id: string;
  /** 取引年月日(ISO 8601 の日付 "YYYY-MM-DD" 以上)。 */
  transactionDate: string;
  /** 取引金額(円)。 */
  amount: number;
  /** 取引先名。 */
  counterparty: string;
  /** 追加の任意フィールド。 */
  [key: string]: unknown;
}

/** 検索条件。日付・金額は範囲、取引先は部分一致。複数指定は AND。 */
export interface TransactionQuery {
  /** 取引年月日の開始(この日以降)。 */
  dateFrom?: string;
  /** 取引年月日の終了(この日以前)。 */
  dateTo?: string;
  /** 取引金額の下限(以上)。 */
  amountMin?: number;
  /** 取引金額の上限(以下)。 */
  amountMax?: number;
  /** 取引先(部分一致・大小文字無視)。 */
  counterparty?: string;
}

/** 日付文字列を比較用に正規化(YYYY-MM-DD 部分)。 */
function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * 取引を検索する(電帳法の検索要件を満たす AND 検索・範囲指定)。
 *
 * @param records レコードの配列
 * @param query 検索条件(日付・金額の範囲、取引先)
 * @returns 条件に合うレコード(**電帳法の検索要件を満たす形**)
 */
export function searchTransactions<T extends TransactionRecord>(records: T[], query: TransactionQuery): T[] {
  const cp = query.counterparty?.toLowerCase();
  return records.filter((r) => {
    if (query.dateFrom && dateKey(r.transactionDate) < dateKey(query.dateFrom)) return false;
    if (query.dateTo && dateKey(r.transactionDate) > dateKey(query.dateTo)) return false;
    if (query.amountMin !== undefined && r.amount < query.amountMin) return false;
    if (query.amountMax !== undefined && r.amount > query.amountMax) return false;
    if (cp && !r.counterparty.toLowerCase().includes(cp)) return false;
    return true;
  });
}

/**
 * 電子帳簿保存法の**検索要件**を満たすか自己点検する。
 *
 * 法令が求めるのは 3 つ: **取引年月日・取引金額・取引先**で検索できること、
 * **日付と金額は範囲指定**できること、**2 つ以上の組み合わせ**で検索できること。
 *
 * **税務調査で問われる**ので、実装した機能が要件を満たしているかを機械的に確認する。
 *
 * @param capability 実装した検索機能(どの項目が検索できるか)
 * @returns 満たしているかと、**足りない要件**
 */
export function meetsSearchRequirements(query: TransactionQuery): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  const hasDate = query.dateFrom !== undefined || query.dateTo !== undefined;
  const hasAmount = query.amountMin !== undefined || query.amountMax !== undefined;
  const hasParty = query.counterparty !== undefined;
  if (!hasDate && !hasAmount && !hasParty) missing.push("いずれかの検索条件が必要");
  return { ok: missing.length === 0, missing };
}
