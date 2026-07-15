/**
 * コピーライト表記の生成（純関数）。
 * @packageDocumentation
 */

/** コピーライト設定。 */
export interface CopyrightOptions {
  /** 権利者名。 */
  holder: string;
  /** 開始年（省略時は現在年のみ表示）。 */
  startYear?: number;
  /** 現在時刻（テスト注入用）。 */
  now?: Date;
  /** 記号（既定 "©"）。 */
  symbol?: string;
  /** "All rights reserved." などの後置テキスト。 */
  rightsText?: string;
}

/**
 * コピーライト文字列を作る。
 * 例: "© 2020–2025 サンプル社"、開始年と現在年が同じなら "© 2025 サンプル社"。
 */
export function copyrightText(options: CopyrightOptions): string {
  const symbol = options.symbol ?? "©";
  const year = (options.now ?? new Date()).getFullYear();
  const range = options.startYear && options.startYear < year ? `${options.startYear}–${year}` : String(options.startYear ?? year);
  const base = `${symbol} ${range} ${options.holder}`;
  return options.rightsText ? `${base}. ${options.rightsText}` : base;
}
