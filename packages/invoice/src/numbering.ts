/**
 * 請求書番号の採番(自社番号。適格請求書の登録番号 T+13桁とは別物)。
 * @packageDocumentation
 */

/** 採番オプション。 */
export interface InvoiceNumberOptions {
  /** 接頭辞(既定 "INV")。 */
  prefix?: string;
  /** 発行日(YYYYMM を番号に含める)。 */
  date?: Date;
  /** 連番の桁数(ゼロ埋め。既定 4)。 */
  padding?: number;
}

/**
 * 連番から請求書番号を作る(例: INV-202507-0001)。
 *
 *
 * @param seq 連番
 * @param options.prefix / date 形式の指定
 * @returns 請求書番号(`INV-202507-0001`)。**飛び番や重複は会計上の問題になる**ので、採番は `@platform/sequence` に任せる
 */
export function formatInvoiceNumber(sequence: number, options: InvoiceNumberOptions = {}): string {
  const prefix = options.prefix ?? "INV";
  const padding = options.padding ?? 4;
  const seq = String(sequence).padStart(padding, "0");
  if (options.date) {
    const ym = `${options.date.getFullYear()}${String(options.date.getMonth() + 1).padStart(2, "0")}`;
    return `${prefix}-${ym}-${seq}`;
  }
  return `${prefix}-${seq}`;
}

/**
 * 番号から連番部分を取り出す(逆引き。失敗で null)。
 *
 *
 * @param number 請求書番号
 * @returns 連番。**形式が違えば null**
 */
export function parseInvoiceSequence(number: string): number | null {
  const m = /(\d+)$/.exec(number);
  return m ? Number(m[1]) : null;
}
