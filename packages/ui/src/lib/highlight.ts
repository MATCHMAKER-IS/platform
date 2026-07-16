/**
 * 検索語のハイライト用セグメント分割(純関数)。フレームワーク非依存。
 * @packageDocumentation
 */

/** ハイライト対象かを示すテキスト片。 */
export interface HighlightSegment {
  text: string;
  highlight: boolean;
}

/**
 * クエリを検索語に分ける(空白区切り・重複除去・長い順)。
 *
 *
 * @param query 検索語(空白区切り)
 * @returns 語の配列(**空白で分ける**ので「経費 締切」で 2 語として扱う)
 */
export function queryTerms(query: string): string[] {
  const terms = query.trim().split(/\s+/).filter((t) => t.length > 0);
  return [...new Set(terms)].sort((a, b) => b.length - a.length);
}

/**
 * テキストを、検索語に一致する部分としない部分に分割する(大文字小文字無視)。
 * 連続一致はまとめ、非一致部分も 1 セグメントにまとめる。
 *
 * @param text 対象の文字列
 * @param terms 検索語
 * @returns `{ text, matched }` の配列(**HTML を組み立てずに返す**ので、エスケープ漏れによる XSS を避けられる)
 */
export function highlightSegments(text: string, query: string): HighlightSegment[] {
  const terms = queryTerms(query);
  if (terms.length === 0 || text.length === 0) return text ? [{ text, highlight: false }] : [];

  const lower = text.toLowerCase();
  // 各位置がハイライト対象かをマーク
  const marked = new Array<boolean>(text.length).fill(false);
  for (const term of terms) {
    const t = term.toLowerCase();
    let from = 0;
    while (from <= lower.length - t.length) {
      const idx = lower.indexOf(t, from);
      if (idx < 0) break;
      for (let i = idx; i < idx + t.length; i++) marked[i] = true;
      from = idx + t.length;
    }
  }

  // 連続する同種をセグメントにまとめる
  const segments: HighlightSegment[] = [];
  let start = 0;
  for (let i = 1; i <= text.length; i++) {
    if (i === text.length || marked[i] !== marked[start]) {
      segments.push({ text: text.slice(start, i), highlight: marked[start] ?? false });
      start = i;
    }
  }
  return segments;
}
