/**
 * **利用者の画面がどれだけ速いか**を測る。
 *
 * 【なぜサーバ側の計測では足りないか】
 * サーバが 100ms で返しても、**画面に出るまでが遅ければ意味がありません**。
 * 通信、JavaScript の実行、描画——**利用者が待つのはその全部**です。
 *
 * **100 人いれば、遅い端末の人が必ずいます。**
 * 開発機は速いので、**作った人には見えません**。
 *
 * 【何を測るか】
 * ブラウザが数える 3 つだけにしています。**多く測っても見きれません**。
 *
 * | 指標 | 何を表すか | 目安 |
 * |---|---|---|
 * | **LCP** | **主な内容が出るまで** | 2.5 秒以内 |
 * | **INP** | **押してから反応するまで** | 200ms 以内 |
 * | **CLS** | **表示のずれ**（押そうとしてずれる） | 0.1 以内 |
 *
 * **CLS を軽く見ないでください。** 「押そうとしたらボタンがずれて、
 * 別のものを押した」——**承認画面で起きると事故**になります。
 *
 * 【送りすぎないこと】
 * **全部の画面から毎回送ると、それ自体が負荷**になります。
 * `sampleRate` で**一部だけ**（1 割など）にしてください——
 * **傾向を知るには十分**です。
 *
 * @packageDocumentation
 */

/** 測った値。 */
export interface WebVitalMetric {
  /** どの指標か。 */
  name: "LCP" | "INP" | "CLS";
  /** 値（LCP と INP はミリ秒、CLS は比率）。 */
  value: number;
  /** どの画面か。 */
  path: string;
  /** いつ（ISO 8601）。 */
  at: string;
}

/** 目安に対する判定。 */
export type VitalVerdict = "good" | "needs-improvement" | "poor";

/**
 * **目安に照らして判定する。**
 *
 * 【なぜ 3 段階か】
 * **良い / 悪いの 2 つだと、境目で騒ぎすぎます。**
 * 「もう少し」の段階があると、**すぐ直すか、様子を見るか**を分けられます。
 *
 * @param name 指標
 * @param value 値
 * @returns 判定
 */
export function judgeVital(name: WebVitalMetric["name"], value: number): VitalVerdict {
  // **Google が示す目安**に合わせています。
  // 独自の基準にすると、**外部の資料と比べられなくなります**。
  if (name === "LCP") {
    if (value <= 2500) return "good";
    return value <= 4000 ? "needs-improvement" : "poor";
  }
  if (name === "INP") {
    if (value <= 200) return "good";
    return value <= 500 ? "needs-improvement" : "poor";
  }
  // CLS
  if (value <= 0.1) return "good";
  return value <= 0.25 ? "needs-improvement" : "poor";
}

/**
 * **集めた値をまとめる。**
 *
 * 【平均ではなく p75 を出します】
 * **平均は速い人に引っ張られます。** 100 人のうち
 * 75 人が 1 秒、25 人が 10 秒でも、**平均は 3.25 秒**——
 * 「まあまあ」に見えますが、**4 人に 1 人が 10 秒待っています**。
 *
 * **p75 は「4 人に 3 人がこれより速い」**という意味で、
 * **遅い人の存在が見えます**。
 *
 * @param metrics 集めた値
 * @returns 画面ごと・指標ごとのまとめ
 */
export function summarizeVitals(
  metrics: readonly WebVitalMetric[],
): { path: string; name: string; p75: number; count: number; verdict: VitalVerdict }[] {
  const groups = new Map<string, number[]>();
  for (const m of metrics) {
    const key = `${m.path}\u0000${m.name}`;
    const list = groups.get(key) ?? [];
    list.push(m.value);
    groups.set(key, list);
  }

  const out: { path: string; name: string; p75: number; count: number; verdict: VitalVerdict }[] = [];
  for (const [key, values] of groups) {
    const [path, name] = key.split("\u0000");
    if (path === undefined || name === undefined) continue;
    const sorted = [...values].sort((a, b) => a - b);
    // **p75 の位置。** 小さい方から数えて 4 分の 3 のところです
    const index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75));
    const p75 = sorted[index] ?? 0;
    out.push({
      path,
      name,
      p75: Math.round(p75 * 1000) / 1000,
      count: values.length,
      verdict: judgeVital(name as WebVitalMetric["name"], p75),
    });
  }

  // **悪い順に返す。** 直すべきものが上に来ます
  const rank: Record<VitalVerdict, number> = { poor: 0, "needs-improvement": 1, good: 2 };
  return out.sort((a, b) => rank[a.verdict] - rank[b.verdict] || b.count - a.count);
}

/**
 * **ブラウザで測って送る**器を作る。
 *
 * 【使い方】
 * 画面の共通部分（レイアウト）で 1 回だけ呼んでください。
 * **画面ごとに呼ぶと二重に測ります**。
 *
 * 【この関数はブラウザでしか動きません】
 * サーバ側で呼ぶと**何もしません**（例外にはなりません）——
 * Next.js では同じコードが両方で動くためです。
 *
 * @param options `send`（送る処理）と `sampleRate`（既定 0.1 = 1 割）
 * @returns 測るのを止める処理
 */
export function observeWebVitals(options: {
  send: (metric: WebVitalMetric) => void;
  sampleRate?: number;
  path?: string;
}): () => void {
  // **ブラウザでなければ何もしない。** Next.js では
  // 同じコードがサーバでも動くので、**ここで止めないと落ちます**。
  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") {
    return () => {};
  }

  // **一部だけ測る。** 全部の画面から毎回送ると、
  // **それ自体が負荷**になります。
  if (Math.random() >= (options.sampleRate ?? 0.1)) return () => {};

  const path = options.path ?? window.location.pathname;
  const observers: PerformanceObserver[] = [];

  const observe = (
    type: string,
    handle: (entries: PerformanceEntryList) => void,
  ): void => {
    try {
      const po = new PerformanceObserver((list) => handle(list.getEntries()));
      po.observe({ type, buffered: true });
      observers.push(po);
    } catch {
      // **古いブラウザは対応していない指標があります。**
      // 落とさず、測れるものだけ測ります。
    }
  };

  observe("largest-contentful-paint", (entries) => {
    const last = entries[entries.length - 1];
    if (last === undefined) return;
    options.send({
      name: "LCP", value: last.startTime, path, at: new Date().toISOString(),
    });
  });

  observe("event", (entries) => {
    for (const e of entries) {
      const duration = (e as PerformanceEntry & { duration?: number }).duration ?? 0;
      // **短い反応は送りません。** 全部送ると件数が膨れます
      if (duration < 40) continue;
      options.send({
        name: "INP", value: duration, path, at: new Date().toISOString(),
      });
    }
  });

  let clsValue = 0;
  observe("layout-shift", (entries) => {
    for (const e of entries) {
      const shift = e as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
      // **利用者の操作で起きたずれは数えません。**
      // 押したから動いた、は問題ではありません。
      if (shift.hadRecentInput === true) continue;
      clsValue += shift.value ?? 0;
    }
    options.send({ name: "CLS", value: clsValue, path, at: new Date().toISOString() });
  });

  return () => {
    for (const po of observers) po.disconnect();
  };
}
