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

/**
 * 本文から読了時間を推定する。
 *
 * **日本語と英語で読む速さが違う**ので、文字種で判定する
 * (日本語 400〜600 字/分、英語 200〜250 語/分が目安)。
 *
 * @param content 本文(Markdown 可)
 * @param options.japaneseCharsPerMinute 日本語の速さ(既定 500)
 * @param options.englishWordsPerMinute 英語の速さ(既定 220)
 * @returns 分数(**最低 1 分**。「0 分で読めます」とは出さない)
 */
export function readingTime(content: string, options: ReadingTimeOptions = {}): ReadingTime {
  const cjkPerMinute = options.cjkPerMinute ?? 500;
  const wordsPerMinute = options.wordsPerMinute ?? 250;
  const text = stripMarkdown(content);
  const cjkChars = countCjk(text);
  const words = countWords(text);
  const minutes = Math.max(1, Math.ceil(cjkChars / cjkPerMinute + words / wordsPerMinute));
  return { minutes, cjkChars, words };
}
