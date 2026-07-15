/**
 * 文字列類似度・あいまい一致(純)。名寄せ・重複検出・誤字許容検索に。
 * @packageDocumentation
 */

/** Levenshtein 距離(挿入/削除/置換の最小回数)。 */
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

/** Levenshtein に基づく類似度(0〜1・1 が完全一致)。 */
export function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max([...a].length, [...b].length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/** Jaro 類似度(0〜1)。 */
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

/** Jaro-Winkler 類似度(接頭辞一致に重みづけ・0〜1)。 */
export function jaroWinkler(a: string, b: string, prefixScale = 0.1): number {
  const j = jaro(a, b);
  const s = [...a], t = [...b];
  let prefix = 0;
  for (let i = 0; i < Math.min(4, s.length, t.length); i++) {
    if (s[i] === t[i]) prefix++; else break;
  }
  return j + prefix * prefixScale * (1 - j);
}

/** 候補から最も似ているものを閾値つきで返す。 */
export function bestMatch<T extends string>(query: string, candidates: readonly T[], options: { threshold?: number } = {}): { value: T; score: number } | null {
  const threshold = options.threshold ?? 0;
  let best: { value: T; score: number } | null = null;
  for (const c of candidates) {
    const score = jaroWinkler(query, c);
    if (score >= threshold && (!best || score > best.score)) best = { value: c, score };
  }
  return best;
}
