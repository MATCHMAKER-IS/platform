/**
 * **遅いクエリを集める。**
 *
 * 【なぜ必要か】
 * `createDb` の `onQuery` で**1 件ずつは測れます**が、
 * **「どれが遅いか」を人が見るには集める必要**があります。
 *
 * 「なんとなく遅い」を**数字にできない**と、
 * **どこを直せばよいか分かりません**——
 * 索引を足すにも、**どのクエリか**が要ります。
 *
 * 【100 人規模で効きます】
 * **数人の間はどのクエリも速い**ので、これを入れても何も出ません。
 * **件数が増えたときに初めて意味を持ちます**——
 * だから**先に入れておく**必要があります。
 * 遅くなってから入れるのでは、**比べる相手がありません**。
 *
 * 【メモリに持ちます】
 * **再起動すると消えます。** それでよいと考えています——
 * **長期の傾向は監視の仕組みで見る**もので、
 * ここは**「いま何が遅いか」を見るため**のものです。
 *
 * @packageDocumentation
 */

/** 遅かったクエリの 1 件。 */
export interface SlowQueryEntry {
  /** 何のクエリか（**SQL そのものではありません**）。 */
  label: string;
  /** かかった時間（ミリ秒）。 */
  durationMs: number;
  /** いつ（ISO 8601）。 */
  at: string;
}

/** ある種類のクエリの集計。 */
export interface SlowQuerySummary {
  label: string;
  /** 遅かった回数。 */
  count: number;
  /** 一番遅かったとき。 */
  maxMs: number;
  /** 平均（**外れ値に弱いので、`maxMs` と合わせて見てください**）。 */
  avgMs: number;
}

/**
 * 遅いクエリを集める器を作る。
 *
 * 【しきい値の決め方】
 * **既定は 500ms** です。これは**利用者が「遅い」と感じ始める境目**より
 * 少し手前——**画面全体で 1 秒**を目安にすると、
 * **1 クエリは 500ms 以内**であってほしいためです。
 *
 * **低くしすぎないでください。** 100ms にすると**ほとんどのクエリが載り**、
 * **本当に遅いものが埋もれます**。
 *
 * 【SQL をそのまま持たないこと】
 * **SQL には値が入ります**——`WHERE email = 'yamada@example.com'` のように。
 * **そのまま記録すると個人情報が残ります**。
 *
 * `createDb` の `summarizeSql` を通した**要約**を渡してください
 * ——「どの表を、どう引いたか」だけが残ります。
 *
 * @param options `thresholdMs`（既定 500）と `maxEntries`（既定 200）
 * @returns 遅いクエリを集める器
 */
export function createSlowQueryLog(options: {
  thresholdMs?: number;
  maxEntries?: number;
} = {}): {
  /**
   * 1 件を記録する（**しきい値より速ければ何もしません**）。
   *
   * `createDb({ onQuery })` から呼んでください。
   */
  record(input: { label: string; durationMs: number }): void;
  /** 遅かったもの（**遅い順**）。 */
  entries(): readonly SlowQueryEntry[];
  /**
   * 種類ごとの集計（**回数の多い順**）。
   *
   * **1 回だけ遅いものより、毎回遅いものを先に直してください**——
   * 効果が大きいためです。
   */
  summary(): SlowQuerySummary[];
  /** いま何件たまっているか。 */
  size(): number;
  /** 消す。 */
  clear(): void;
} {
  const thresholdMs = options.thresholdMs ?? 500;
  const maxEntries = options.maxEntries ?? 200;
  const entries: SlowQueryEntry[] = [];

  return {
    record({ label, durationMs }) {
      if (durationMs < thresholdMs) return;
      entries.push({ label, durationMs, at: new Date().toISOString() });
      // **上限を超えたら古いものから捨てる。**
      // 捨てないと**メモリが増え続け、いつか落ちます**——
      // **遅いことを調べるために落ちる**のでは本末転倒です。
      if (entries.length > maxEntries) entries.shift();
    },

    entries: () => [...entries].sort((a, b) => b.durationMs - a.durationMs),

    summary() {
      const byLabel = new Map<string, { count: number; maxMs: number; totalMs: number }>();
      for (const e of entries) {
        const s = byLabel.get(e.label) ?? { count: 0, maxMs: 0, totalMs: 0 };
        s.count += 1;
        s.totalMs += e.durationMs;
        if (e.durationMs > s.maxMs) s.maxMs = e.durationMs;
        byLabel.set(e.label, s);
      }
      return [...byLabel.entries()]
        .map(([label, s]) => ({
          label,
          count: s.count,
          maxMs: s.maxMs,
          avgMs: Math.round(s.totalMs / s.count),
        }))
        // **回数の多い順。** 1 回だけ遅いものより、
        // **毎回遅いものを先に直す**方が効果が大きいためです。
        .sort((a, b) => b.count - a.count || b.maxMs - a.maxMs);
    },

    size: () => entries.length,
    clear: () => { entries.length = 0; },
  };
}
