/**
 * 検索結果の並べ替え(再ランク)。
 * @packageDocumentation
 */

/**
 * 問い合わせ語と**完全一致する目印**を持つ結果を前に出す。
 *
 * キーワード検索(BM25)は語の出現頻度で並べるため、
 * 「CSV を出力したい」のように**一般的な語が多い質問**では、
 * 肝心の「csv」より「出力」「したい」を多く含む文書が上位に来てしまう。
 *
 * 一方で利用者は、部品名・製品名のような**固有の語**を手がかりにしていることが多い。
 * そこで「その語と完全に一致する目印(パッケージ名など)を持つ結果」に下駄を履かせる。
 *
 * 検索そのものを作り替えるより副作用が小さく、なぜ上位に来たかを説明しやすい。
 *
 * @param hits    検索結果(score の降順である必要はない)
 * @param query   利用者が入力した文字列
 * @param keyOf   結果から目印を取り出す関数(無ければ undefined)
 * @param factor  一致したときに score へ掛ける倍率(既定 3)
 * @returns score 降順に並べ替えた新しい配列
 *
 * @example
 * ```ts
 * const ranked = boostExactKeyword(hits, "CSV を出力したい", (h) => h.pkg);
 * // pkg === "csv" の結果が前に出る
 * ```
 */
export function boostExactKeyword<T extends { score: number }>(
  hits: readonly T[],
  query: string,
  keyOf: (hit: T) => string | undefined,
  factor = 3,
): T[] {
  // 記号で区切り、2 文字以上の語を候補にする(1 文字は偶然一致しやすい)
  const terms = new Set(
    query
      .toLowerCase()
      .split(/[^0-9a-z\u3040-\u30ff\u4e00-\u9fff]+/i)
      .filter((t) => t.length >= 2),
  );
  return [...hits]
    .map((h) => {
      const key = keyOf(h)?.toLowerCase();
      return key && terms.has(key) ? { ...h, score: h.score * factor } : h;
    })
    .sort((a, b) => b.score - a.score);
}
