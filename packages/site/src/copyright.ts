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
 *
 * @param options.startYear 開始年
 * @param options.holder 権利者名(**`owner` ではない**)。`startYear` は開始年、
 *   `symbol` は記号(既定 ©)、`rightsText` は末尾の文言、`now` はテスト注入用
 * @param options.now 現在時刻(テスト注入用)
 * @returns コピーライト文字列(**年は自動で更新される**。手書きだと年明けに古いままになる)
 */
export function copyrightText(options: CopyrightOptions): string {
  const symbol = options.symbol ?? "©";
  // **JST の年で出す。** UTC のサーバでは、**元日の朝 8:59 までが前年**になり、
  // 年明けのアクセスで去年の表示が出る(9 時間だけの現象なので気づきにくい)。
  const nowRef = options.now ?? new Date();
  const year = new Date(nowRef.getTime() + 9 * 60 * 60 * 1000).getUTCFullYear();
  const range = options.startYear && options.startYear < year ? `${options.startYear}–${year}` : String(options.startYear ?? year);
  const base = `${symbol} ${range} ${options.holder}`;
  return options.rightsText ? `${base}. ${options.rightsText}` : base;
}
