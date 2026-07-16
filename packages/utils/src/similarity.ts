/**
 * 文字列類似度・あいまい一致(純)。名寄せ・重複検出・誤字許容検索に。
 * @packageDocumentation
 */

/**
 * Levenshtein 距離を求める(挿入・削除・置換の最小回数)。
 *
 * **距離なので小さいほど似ている**。0 なら完全一致。
 * 「似ている度合い」が欲しいなら {@link levenshteinSimilarity}(0〜1)を使う。
 *
 * @param a 比較する文字列
 * @param b 比較する文字列
 * @returns 距離(0 以上の整数)
 */
export function levenshtein(a: string, b: string): number {
  const s = [...a], t = [...b];
  if (s.length === 0) return t.length;
  if (t.length === 0) return s.length;
  let prev = Array.from({ length: t.length + 1 }, (_, i) => i);
  for (let i = 1; i <= s.length; i++) {
    const curr = [i];
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      curr[j] = Math.min((curr[j - 1] as number) + 1, (prev[j] as number) + 1, (prev[j - 1] as number) + cost);
    }
    prev = curr;
  }
  return prev[t.length] as number;
}

/**
 * Levenshtein 距離に基づく類似度を求める。
 *
 * @param a 比較する文字列
 * @param b 比較する文字列
 * @returns 0〜1(**1 が完全一致**)。両方空なら 1
 */
export function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max([...a].length, [...b].length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * Jaro 類似度を求める。
 *
 * **短い文字列(氏名など)に向く**。Levenshtein より「入れ替わり」に寛容。
 *
 * @param a 比較する文字列
 * @param b 比較する文字列
 * @returns 0〜1(1 が完全一致)
 */
export function jaro(a: string, b: string): number {
  const s = [...a], t = [...b];
  if (s.length === 0 && t.length === 0) return 1;
  if (s.length === 0 || t.length === 0) return 0;
  const matchDistance = Math.max(0, Math.floor(Math.max(s.length, t.length) / 2) - 1);
  const sMatches = new Array<boolean>(s.length).fill(false);
  const tMatches = new Array<boolean>(t.length).fill(false);
  let matches = 0;
  for (let i = 0; i < s.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, t.length);
    for (let j = start; j < end; j++) {
      if (tMatches[j] || s[i] !== t[j]) continue;
      sMatches[i] = true; tMatches[j] = true; matches++; break;
    }
  }
  if (matches === 0) return 0;
  let transpositions = 0, k = 0;
  for (let i = 0; i < s.length; i++) {
    if (!sMatches[i]) continue;
    while (!tMatches[k]) k++;
    if (s[i] !== t[k]) transpositions++;
    k++;
  }
  const m = matches;
  return (m / s.length + m / t.length + (m - transpositions / 2) / m) / 3;
}

/**
 * Jaro-Winkler 類似度を求める(**先頭が一致するものを高く評価**)。
 *
 * **氏名・会社名の名寄せに向く**(「山田太郎」と「山田太朗」のように、
 * 先頭が同じものは同一人物である可能性が高い)。
 *
 * @param a 比較する文字列
 * @param b 比較する文字列
 * @param prefixScale 接頭辞の重み(既定 0.1。**0.25 を超えると 1 を超えうる**)
 * @returns 0〜1(1 が完全一致)
 */
export function jaroWinkler(a: string, b: string, prefixScale = 0.1): number {
  const j = jaro(a, b);
  const s = [...a], t = [...b];
  let prefix = 0;
  for (let i = 0; i < Math.min(4, s.length, t.length); i++) {
    if (s[i] === t[i]) prefix++; else break;
  }
  return j + prefix * prefixScale * (1 - j);
}

/**
 * 候補の中から最も似ているものを返す。
 *
 * 「もしかして: ◯◯」の実装に使う。
 *
 * @param input 入力文字列
 * @param candidates 候補
 * @param threshold この類似度を下回れば「該当なし」(既定 0.7)
 * @returns 最も似ているものと類似度。**閾値未満なら undefined**
 *   (無理に候補を出すと、かえって混乱させる)
 */
export function bestMatch<T extends string>(query: string, candidates: readonly T[], options: { threshold?: number } = {}): { value: T; score: number } | null {
  const threshold = options.threshold ?? 0;
  let best: { value: T; score: number } | null = null;
  for (const c of candidates) {
    const score = jaroWinkler(query, c);
    if (score >= threshold && (!best || score > best.score)) best = { value: c, score };
  }
  return best;
}
