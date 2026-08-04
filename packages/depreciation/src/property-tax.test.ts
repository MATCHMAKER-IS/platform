import { describe, it, expect } from "vitest";
import {
  evaluateAsset, isTaxable, buildDeclaration, findStaleAssets, decayRate,
  TAX_FREE_THRESHOLD, RESIDUAL_RATE, type TaxableAsset,
} from "./property-tax";

const machine: TaxableAsset = {
  name: "機械", acquisitionCost: 1_000_000, acquiredOn: "2024-06", usefulLifeYears: 5,
};

describe("decayRate(減価残存率)", () => {
  it("**旧定率法の率**（会計の 200% 定率法とは別）", () => {
    // 耐用 5 年は償却率 0.369 → 残存率 0.631
    expect(decayRate(5)).toBe(0.631);
  });

  it("表に無い年数は近似する", () => {
    expect(decayRate(23)).toBeGreaterThan(0.8);
    expect(decayRate(23)).toBeLessThan(1);
  });
});

describe("evaluateAsset(評価額)", () => {
  it("**取得年は半年分**だけ償却する（会計のような月割りではない）", () => {
    // 取得翌年 = 1,000,000 × (1 - (1-0.631)/2) = 815,500
    expect(evaluateAsset(machine, 2025).value).toBe(815_500);
  });

  it("2 年目以降は 1 年分ずつ", () => {
    expect(evaluateAsset(machine, 2026).value).toBe(Math.floor(815_500 * 0.631));
  });

  it("**取得価額の 5% で下げ止まる**（会計は 1 円まで償却する）", () => {
    const v = evaluateAsset(machine, 2040);
    expect(v.value).toBe(machine.acquisitionCost * RESIDUAL_RATE);
    expect(v.atFloor).toBe(true);
  });

  it("取得年（まだ 1 月 1 日を迎えていない）は取得価額のまま", () => {
    expect(evaluateAsset(machine, 2024).value).toBe(1_000_000);
  });
});

describe("isTaxable(課税対象か)", () => {
  it("10 万円未満は対象外", () => {
    expect(isTaxable({ name: "椅子", acquisitionCost: 99_999, acquiredOn: "2024-01", usefulLifeYears: 5 }, 2026)).toBe(false);
    expect(isTaxable({ name: "机", acquisitionCost: 100_000, acquiredOn: "2024-01", usefulLifeYears: 5 }, 2026)).toBe(true);
  });

  it("**除却済みは外す**（外し忘れると捨てた資産の税を払い続ける）", () => {
    expect(isTaxable({ ...machine, disposedOn: "2025-03" }, 2026)).toBe(false);
  });

  it("申告年に取得したものは対象外（1 月 1 日時点で保有していない）", () => {
    expect(isTaxable(machine, 2024)).toBe(false);
    expect(isTaxable(machine, 2025)).toBe(true);
  });
});

describe("buildDeclaration(申告のまとめ)", () => {
  it("**免税点未満なら税額 0 だが、課税標準は計算される**（申告は必要）", () => {
    const d = buildDeclaration([machine], 2026);
    expect(d.belowThreshold).toBe(true);
    expect(d.tax).toBe(0);
    expect(d.taxableBase).toBeGreaterThan(0);
  });

  it("課税標準は 1,000 円未満・税額は 100 円未満を切り捨て", () => {
    const big: TaxableAsset[] = Array.from({ length: 3 }, (_, i) => ({
      name: `設備${i}`, acquisitionCost: 3_000_000, acquiredOn: "2024-01", usefulLifeYears: 10,
    }));
    const d = buildDeclaration(big, 2026);
    expect(d.taxableBase % 1000).toBe(0);
    expect(d.tax % 100).toBe(0);
    expect(d.taxableBase).toBeGreaterThanOrEqual(TAX_FREE_THRESHOLD);
  });

  it("対象外の資産は含めない", () => {
    const d = buildDeclaration([machine, { ...machine, name: "除却済", disposedOn: "2025-01" }], 2026);
    expect(d.assets).toHaveLength(1);
  });

  it("資産が無くても落ちない", () => {
    const d = buildDeclaration([], 2026);
    expect(d.taxableBase).toBe(0);
    expect(d.tax).toBe(0);
  });
});

describe("findStaleAssets(外し忘れ)", () => {
  it("耐用年数を大きく過ぎた資産を挙げる", () => {
    const old: TaxableAsset = { name: "旧サーバ", acquisitionCost: 500_000, acquiredOn: "2015-04", usefulLifeYears: 5 };
    const issues = findStaleAssets([old], 2026);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.name).toBe("旧サーバ");
  });

  it("まだ償却中の資産は挙げない", () => {
    expect(findStaleAssets([machine], 2026)).toHaveLength(0);
  });
});
