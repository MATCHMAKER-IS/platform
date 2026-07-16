/**
 * ESC/POS レシートビルダー。サーマルプリンタ向けのコマンド列(バイト列)を組み立てる。
 * 生成した Uint8Array は `@platform/bluetooth` の write や Web Serial/USB で送信する。
 *
 * 注意: 日本語は機種のコードページ(多くは Shift_JIS)に依存する。本ビルダーの `text` は
 * UTF-8(ASCII 範囲は安全)で出力するため、日本語印字が必要な機種では `raw()` で
 * 機種指定のコードページ設定＋エンコード済みバイトを送る。
 * @packageDocumentation
 */

/** 文字揃え。 */
export type Align = "left" | "center" | "right";

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

/** ESC/POS レシートビルダー(チェーン可能)。 */
export interface ReceiptBuilder {
  /** 初期化(ESC @)。 */
  init(): ReceiptBuilder;
  /** テキスト(改行なし)。 */
  text(value: string): ReceiptBuilder;
  /** テキスト + 改行。 */
  line(value?: string): ReceiptBuilder;
  /** 文字揃え(ESC a)。 */
  align(a: Align): ReceiptBuilder;
  /** 太字 ON/OFF(ESC E)。 */
  bold(on: boolean): ReceiptBuilder;
  /** 文字サイズ倍率(GS !)。1〜8。 */
  size(width: number, height: number): ReceiptBuilder;
  /** 改行を n 行(既定 1)。 */
  feed(n?: number): ReceiptBuilder;
  /** 用紙カット(GS V)。partial=部分カット。 */
  cut(partial?: boolean): ReceiptBuilder;
  /** 任意バイト列を挿入(コードページ設定・機種依存コマンド用)。 */
  raw(bytes: number[] | Uint8Array): ReceiptBuilder;
  /** 組み立て結果を返す。 */
  build(): Uint8Array;
}

/**
 * レシートビルダーを作る。
 * @example
 * ```ts
 * const bytes = createReceipt()
 *   .init().align("center").bold(true).size(2, 2).line("領収書").size(1, 1).bold(false)
 *   .align("left").line("合計  \\u00a51,320").feed(1).cut().build();
 * // conn.write("...serial svc...", "...", bytes) 等で送信
 * ```
 * @returns レシートビルダー。**ESC/POS はプリンタごとに方言がある**(機種で確認すること)
 */
export function createReceipt(): ReceiptBuilder {
  const chunks: number[][] = [];
  const push = (...bytes: number[]) => { chunks.push(bytes); };
  const alignCode: Record<Align, number> = { left: 0, center: 1, right: 2 };
  const enc = (s: string) => Array.from(new TextEncoder().encode(s));

  const api: ReceiptBuilder = {
    init() { push(ESC, 0x40); return api; },
    text(value) { chunks.push(enc(value)); return api; },
    line(value = "") { chunks.push(enc(value)); push(LF); return api; },
    align(a) { push(ESC, 0x61, alignCode[a]); return api; },
    bold(on) { push(ESC, 0x45, on ? 1 : 0); return api; },
    size(width, height) {
      const w = Math.max(1, Math.min(8, width)) - 1;
      const h = Math.max(1, Math.min(8, height)) - 1;
      push(GS, 0x21, (w << 4) | h);
      return api;
    },
    feed(n = 1) { for (let i = 0; i < n; i++) push(LF); return api; },
    cut(partial = false) { push(GS, 0x56, partial ? 0x01 : 0x00); return api; },
    raw(bytes) { chunks.push(Array.from(bytes)); return api; },
    build() {
      const flat = chunks.flat();
      return Uint8Array.from(flat);
    },
  };
  return api;
}
