import { describe, it, expect } from "vitest";
import { percentile, latencyStats, weightedPick, activeWorkers, formatResult, type ScenarioStep } from "./index";

describe("percentile", () => {
  const samples = [10, 20, 30, 40, 50];

  it("中央値・最小・最大を求める", () => {
    expect(percentile(samples, 50)).toBe(30);
    expect(percentile(samples, 0)).toBe(10);
    expect(percentile(samples, 100)).toBe(50);
  });

  it("**線形補間する**(標本が少なくても段差にならない)", () => {
    // rank = 0.9 * 4 = 3.6 → 40 と 50 の間の 60%
    expect(percentile(samples, 90)).toBeCloseTo(46);
  });

  it("**並べ替えなくてよい**(呼ぶ側が順序を気にしない)", () => {
    expect(percentile([50, 10, 30, 20, 40], 50)).toBe(30);
  });

  it("元の配列を壊さない", () => {
    const input = [3, 1, 2];
    percentile(input, 50);
    expect(input).toEqual([3, 1, 2]);
  });

  it("空なら 0(例外にしない)", () => {
    expect(percentile([], 50)).toBe(0);
  });

  it("範囲外の指定でも端に丸める", () => {
    expect(percentile(samples, -10)).toBe(10);
    expect(percentile(samples, 200)).toBe(50);
  });

  it("1 件なら常にその値", () => {
    expect(percentile([7], 50)).toBe(7);
    expect(percentile([7], 99)).toBe(7);
  });
});

describe("latencyStats", () => {
  it("件数・最小・最大・平均・各パーセンタイルを返す", () => {
    const s = latencyStats([10, 20, 30, 40, 50]);
    expect(s.count).toBe(5);
    expect(s.min).toBe(10);
    expect(s.max).toBe(50);
    expect(s.mean).toBe(30);
    expect(s.p50).toBe(30);
  });

  it("**平均だけ見ない**(外れ値があると平均と p95 が離れる)", () => {
    // 遅いのが 1 件混ざると、平均は動くが p50 は動かない
    const s = latencyStats([10, 10, 10, 10, 1000]);
    expect(s.p50).toBe(10);
    expect(s.mean).toBeGreaterThan(s.p50);
    expect(s.p95).toBeGreaterThan(s.p50);
  });

  it("空なら全部 0(0 除算にしない)", () => {
    expect(latencyStats([])).toEqual({ count: 0, min: 0, max: 0, mean: 0, p50: 0, p90: 0, p95: 0, p99: 0 });
  });

  it("1 件でも壊れない", () => {
    const s = latencyStats([42]);
    expect(s.count).toBe(1);
    expect(s.min).toBe(42);
    expect(s.p99).toBe(42);
  });
});

describe("weightedPick(利用パターンの再現)", () => {
  // **`request` は `Promise<RequestOutcome>` を返す。**
  // `{ url }` を返しており実型と食い違っていた——`weightedPick` は
  // `request` を呼ばないのでテストは通っていたが、**型としては誤り**
  // (2026-08、型検査が回っていなかったため気づけなかった)。
  const steps: ScenarioStep[] = [
    { name: "一覧", weight: 7, request: async () => ({ ok: true }) },
    { name: "詳細", weight: 2, request: async () => ({ ok: true }) },
    { name: "更新", weight: 1, request: async () => ({ ok: true }) },
  ];

  it("**乱数を引数で受け取るので結果を固定できる**(テストが揺れない)", () => {
    expect(weightedPick(steps, 0).name).toBe("一覧");
    expect(weightedPick(steps, 0.69).name).toBe("一覧");   // 0–0.7
    expect(weightedPick(steps, 0.75).name).toBe("詳細");   // 0.7–0.9
    expect(weightedPick(steps, 0.95).name).toBe("更新");   // 0.9–1.0
  });

  it("重みの比率どおりに選ばれる", () => {
    const counts = { 一覧: 0, 詳細: 0, 更新: 0 } as Record<string, number>;
    for (let i = 0; i < 1000; i += 1) counts[weightedPick(steps, i / 1000).name] += 1;
    expect(counts["一覧"]).toBe(700);
    expect(counts["詳細"]).toBe(200);
    expect(counts["更新"]).toBe(100);
  });

  it("重み未指定は 1 として扱う", () => {
    const equal: ScenarioStep[] = [
      { name: "a", request: async () => ({ ok: true }) },
      { name: "b", request: async () => ({ ok: true }) },
    ];
    expect(weightedPick(equal, 0.2).name).toBe("a");
    expect(weightedPick(equal, 0.8).name).toBe("b");
  });

  it("r=1 でも最後の要素を返す(範囲外で undefined にしない)", () => {
    expect(weightedPick(steps, 1).name).toBe("更新");
  });
});

describe("activeWorkers(ランプアップ)", () => {
  it("**徐々に増やす**(一気に負荷をかけるとどこで壊れたか分からない)", () => {
    expect(activeWorkers(10, 1000, 0)).toBe(1);
    expect(activeWorkers(10, 1000, 500)).toBe(5);
    expect(activeWorkers(10, 1000, 1000)).toBe(10);
  });

  it("ランプアップを過ぎたら全開", () => {
    expect(activeWorkers(10, 1000, 5000)).toBe(10);
  });

  it("ランプアップ 0 なら最初から全開", () => {
    expect(activeWorkers(10, 0, 0)).toBe(10);
  });

  it("**最低 1 は動く**(0 だと何も起きず、止まったように見える)", () => {
    expect(activeWorkers(10, 100000, 1)).toBe(1);
  });
});

describe("formatResult", () => {
  const result = {
    total: 100, success: 98, failed: 2,
    errorRate: 0.02, elapsedMs: 10_000, throughput: 10,
    latency: latencyStats([10, 20, 30]),
    statusCounts: { "200": 98, "500": 2 },
  };

  it("件数・スループット・エラー率を出す", () => {
    const text = formatResult(result);
    expect(text).toContain("100 reqs");
    expect(text).toContain("10.0 req/s");
    expect(text).toContain("err 2.0%");
  });

  it("**平均ではなく p50 / p95 / p99 を出す**(遅い方の実態が見える)", () => {
    const text = formatResult(result);
    expect(text).toContain("p50");
    expect(text).toContain("p95");
    expect(text).toContain("p99");
    expect(text).not.toContain("mean");
  });

  it("結果が空でも壊れない", () => {
    const empty = { ...result, total: 0, success: 0, failed: 0, errorRate: 0, throughput: 0, latency: latencyStats([]) };
    expect(formatResult(empty)).toContain("0 reqs");
  });
});
