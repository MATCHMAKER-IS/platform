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

/**
 * **順位で統合する（Reciprocal Rank Fusion / RRF）。**
 *
 * 【なぜ必要か】
 * ハイブリッド検索では **BM25 の点数**と**ベクトルの類似度**を混ぜますが、
 * **この 2 つは尺度が違います**:
 *
 * | | 範囲 | 性質 |
 * |---|---|---|
 * | BM25 | **0〜数十**（文書数や語の珍しさで変わる） | 語が一致した強さ |
 * | ベクトルの類似度 | **-1〜1**（コサイン） | 意味の近さ |
 *
 * **大きい方を採る**と、**常に BM25 が勝ちます**——ベクトル検索が事実上
 * 効かなくなります（2026-08 まで実際にそうなっていました）。
 * かといって単純に足すのも、**片方のスケールが変わると結果が変わる**ので不安定です。
 *
 * 【RRF の考え方】
 * **点数を捨てて順位だけを使います。** それぞれの検索で何位だったかを
 * `1 / (k + 順位)` に直して足すので、**尺度の違いが消えます**。
 *
 * ```
 * BM25 で 1 位 → 1/61 ≒ 0.0164
 * ベクトルで 3 位 → 1/63 ≒ 0.0159
 * 両方に出た → 0.0323（片方だけより高い）
 * ```
 *
 * **両方の検索に出たものが上に来る**のが要点です——
 * 「語も一致し、意味も近い」ものが最も確からしいためです。
 *
 * 【k をなぜ 60 にするか】
 * **上位の差を緩めるため**です。k が小さいと 1 位と 2 位の差が極端になり、
 * **片方の検索の 1 位がほぼ確定**してしまいます。60 は原論文（Cormack 2009）
 * が使い、多くの検索エンジンが既定にしている値です。
 *
 * （`rerank.ts` に同居しています）
 */
/** 統合するときの 1 件。 */
export interface RankedItem<T> {
  /** 同じものかを判断する鍵。 */
  id: string;
  /** 中身。 */
  item: T;
}

/**
 * 複数の検索結果を**順位で統合**する。
 *
 * **各リストは「良い順」に並んでいる前提**です（点数は見ません）。
 *
 * @param lists 統合する検索結果（順位順）
 * @param options `k` … 上位の差を緩める定数（既定 60）
 * @returns 統合後の並び（良い順）。`score` は RRF の値で、**検索の点数ではありません**
 */
export function fuseByRank<T>(
  lists: readonly (readonly RankedItem<T>[])[],
  options: { k?: number } = {},
): { id: string; item: T; score: number; foundIn: number }[] {
  const k = options.k ?? 60;
  const acc = new Map<string, { item: T; score: number; foundIn: number }>();

  for (const list of lists) {
    for (let rank = 0; rank < list.length; rank += 1) {
      const entry = list[rank];
      if (entry === undefined) continue;
      // **順位は 1 始まりで数える。** 0 始まりだと 1 位が `1/k` になり、
      // 2 位との差が k の値に強く依存します。
      const contribution = 1 / (k + rank + 1);
      const cur = acc.get(entry.id);
      if (cur === undefined) {
        acc.set(entry.id, { item: entry.item, score: contribution, foundIn: 1 });
      } else {
        cur.score += contribution;
        cur.foundIn += 1;
      }
    }
  }

  return [...acc.entries()]
    .map(([id, v]) => ({ id, item: v.item, score: v.score, foundIn: v.foundIn }))
    // **同点なら「両方に出た方」を上に。** RRF の値が同じでも、
    // **2 つの検索が揃って選んだもの**の方が確からしいためです。
    .sort((a, b) => b.score - a.score || b.foundIn - a.foundIn);
}

/**
 * 2 つのベクトルの近さ（コサイン類似度）。
 *
 * **`index.ts` にも同じものがありますが、ここでは自前で持ちます**——
 * `index.ts` が `rerank.ts` を取り込んでいるので、
 * **逆向きに取り込むと循環**になります。
 */
function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  // **どちらかが零ベクトルなら 0。** 割り算で NaN を出さないためです
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * **似た内容ばかりを返さないようにする**（MMR / Maximal Marginal Relevance）。
 *
 * 【なぜ必要か】
 * 検索は「質問に近い順」に返すので、**同じ文書の隣り合った部分が上位を埋めます**。
 * 就業規則を検索すると、**第 12 条の前半・中盤・後半**が 1〜3 位を占め、
 * **別の条文にある大事な例外**が押し出されます。
 *
 * **AI に渡す文脈は限られています**（数千トークン）。
 * **同じことを 3 回渡すより、違う観点を 3 つ渡す**方が良い答えになります。
 *
 * 【どう選ぶか】
 * 1 件目は**一番近いもの**。2 件目以降は
 * **「質問への近さ」と「すでに選んだものとの違い」を天秤にかけて**選びます。
 *
 * `lambda` がその重みです:
 *
 * | 値 | 動き |
 * |---|---|
 * | **1.0** | 近さだけ（**MMR を使わないのと同じ**） |
 * | **0.7**（既定） | 近さ重視だが、似すぎたものは落とす |
 * | **0.5** | 近さと違いが半々 |
 * | **0.0** | 違いだけ（**質問と関係ないものが混ざる**） |
 *
 * **0.5 を下回ると精度が落ちます。** 「多様性が欲しい」からと
 * 下げすぎると、**関係ない文書が入って AI が混乱**します。
 *
 * @param queryVector 質問のベクトル
 * @param candidates 候補（**ベクトルが要ります**）
 * @param options `limit`（返す件数）と `lambda`（既定 0.7）
 * @returns 選ばれた候補（良い順）
 */
export function selectDiverse<T extends { vector: readonly number[] }>(
  queryVector: readonly number[],
  candidates: readonly T[],
  options: { limit?: number; lambda?: number } = {},
): T[] {
  const limit = Math.max(1, options.limit ?? 5);
  const lambda = Math.min(1, Math.max(0, options.lambda ?? 0.7));
  if (candidates.length === 0) return [];

  const remaining = [...candidates];
  const selected: T[] = [];

  while (selected.length < limit && remaining.length > 0) {
    let bestIndex = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i += 1) {
      const item = remaining[i];
      if (item === undefined) continue;
      const relevance = cosineSimilarity(queryVector, item.vector);
      // **すでに選んだものと一番似ている度合い**を引く。
      // 1 件目は比べる相手がいないので、近さだけで決まります。
      let maxSimilarity = 0;
      for (const chosen of selected) {
        const sim = cosineSimilarity(item.vector, chosen.vector);
        if (sim > maxSimilarity) maxSimilarity = sim;
      }
      const score = lambda * relevance - (1 - lambda) * maxSimilarity;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    const picked = remaining.splice(bestIndex, 1)[0];
    if (picked !== undefined) selected.push(picked);
  }

  return selected;
}
