/**
 * 読了時間の推定。純ロジック。
 * 日本語(CJK 文字)と欧文(単語)を別々に数え、合算して分を出す。
 * @packageDocumentation
 */
import { stripMarkdown } from "./excerpt.js";

/** 読了時間推定のオプション。 */
export interface ReadingTimeOptions {
  /** 1 分あたりの CJK 文字数(既定 500)。 */
  cjkPerMinute?: number;
  /** 1 分あたりの欧文単語数(既定 250)。 */
  wordsPerMinute?: number;
}

/** 読了時間の結果。 */
export interface ReadingTime {
  /** 推定分(最低 1)。 */
  minutes: number;
  /** CJK 文字数。 */
  cjkChars: number;
  /** 欧文単語数。 */
  words: number;
}

/** CJK(漢字・かな・ハングル等)の文字数を数える。 */
function countCjk(text: string): number {
  const m = text.match(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/g);
  return m ? m.length : 0;
}

/** 欧文の単語数を数える(CJK を除いたラテン語)。 */
function countWords(text: string): number {
  const latin = text.replace(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/g, " ");
  const m = latin.match(/[A-Za-z0-9]+/g);
  return m ? m.length : 0;
}

/** 本文(Markdown 可)から読了時間を推定する。 */
export function readingTime(content: string, options: ReadingTimeOptions = {}): ReadingTime {
  const cjkPerMinute = options.cjkPerMinute ?? 500;
  const wordsPerMinute = options.wordsPerMinute ?? 250;
  const text = stripMarkdown(content);
  const cjkChars = countCjk(text);
  const words = countWords(text);
  const minutes = Math.max(1, Math.ceil(cjkChars / cjkPerMinute + words / wordsPerMinute));
  return { minutes, cjkChars, words };
}
