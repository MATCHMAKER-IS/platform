/**
 * SMS の文字数・分割ユーティリティ(純)。GSM-7 / UCS-2 を判定し、送信分割数を計算する。
 * @packageDocumentation
 */

// GSM 03.38 基本文字集合(抜粋・実務的な範囲)。
const GSM_BASIC = new Set(
  ("@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ ÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
    "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà").split(""),
);
// GSM 拡張(送信時 2 文字分を消費)。
const GSM_EXT = new Set("^{}\\[~]|€".split(""));

/** SMS のエンコーディング種別。 */
export type SmsEncoding = "GSM-7" | "UCS-2";

/** 本文が GSM-7 で送れるか、UCS-2 が必要かを判定する。 */
export function smsEncoding(text: string): SmsEncoding {
  for (const ch of text) {
    if (!GSM_BASIC.has(ch) && !GSM_EXT.has(ch)) return "UCS-2";
  }
  return "GSM-7";
}

/** 送信文字数(GSM-7 は拡張文字を 2 と数える。UCS-2 はコードユニット数)。 */
export function smsLength(text: string): number {
  if (smsEncoding(text) === "UCS-2") {
    // UTF-16 コードユニット数(サロゲートペアは 2)。
    return text.length;
  }
  let n = 0;
  for (const ch of text) n += GSM_EXT.has(ch) ? 2 : 1;
  return n;
}

/** 送信に必要な分割(セグメント)数を計算する。 */
export function smsSegments(text: string): number {
  const len = smsLength(text);
  if (len === 0) return 0;
  const encoding = smsEncoding(text);
  const single = encoding === "GSM-7" ? 160 : 70;
  const multi = encoding === "GSM-7" ? 153 : 67;
  return len <= single ? 1 : Math.ceil(len / multi);
}

/** SMS 情報のまとめ。 */
export interface SmsInfo { encoding: SmsEncoding; length: number; segments: number; }

/** 本文の SMS 情報(エンコーディング・文字数・分割数)を返す。 */
export function smsInfo(text: string): SmsInfo {
  return { encoding: smsEncoding(text), length: smsLength(text), segments: smsSegments(text) };
}
