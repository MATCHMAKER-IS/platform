import { describe, it, expect } from "vitest";
import {
  straightLineRate, decliningBalanceRate,
  straightLineSchedule, decliningBalanceSchedule, depreciationSchedule,
  bookValueAt, depreciationInYear, monthlyAmount, MEMORANDUM_VALUE,
} from "./index";

/** 償却額の合計。「取得価額 − 備忘価額」と一致するのが正しい状態。 */
const totalDepreciation = (rows: { depreciation: number }[]): number =>
  rows.reduce((sum, r) => sum + r.depreciation, 0);

describe("償却率", () => {
  it("定額法は 1 ÷ 耐用年数", () => {
    expect(straightLineRate(5)).toBeCloseTo(0.2);
    expect(straightLineRate(10)).toBeCloseTo(0.1);
  });

  it("定率法は 200% 定率法(2 ÷ 耐用年数)", () => {
    // 平成 24 年 4 月以降に取得した資産の率。それ以前は 250% 定率法なので使えない
    expect(decliningBalanceRate(5)).toBeCloseTo(0.4);
    expect(decliningBalanceRate(10)).toBeCloseTo(0.2);
  });

  it("耐用年数が 0 以下なら 0(0 除算にしない)", () => {
    expect(straightLineRate(0)).toBe(0);
    expect(decliningBalanceRate(-1)).toBe(0);
  });
});

describe("定額法", () => {
  it("耐用年数ぶんの行を作り、毎年同額を償却する", () => {
    const rows = straightLineSchedule(1_000_000, 5, 2026);
    expect(rows.length).toBe(5);
    expect(rows.slice(0, 4).map((r) => r.depreciation)).toEqual([200_000, 200_000, 200_000, 200_000]);
  });

  it("**最終年度に 1 円を残す**(備忘価額)", () => {
    // 0 にすると帳簿から消え、まだ使っている資産を管理できなくなる
    const rows = straightLineSchedule(1_000_000, 5, 2026);
    expect(rows.at(-1)?.bookValue).toBe(MEMORANDUM_VALUE);
    expect(rows.at(-1)?.depreciation).toBe(199_999); // 端数を最終年で吸収
  });

  it("償却額の合計が 取得価額 − 1 円 になる", () => {
    for (const cost of [1_000_000, 999_999, 123_457]) {
      const rows = straightLineSchedule(cost, 7, 2026);
      expect(totalDepreciation(rows)).toBe(cost - MEMORANDUM_VALUE);
    }
  });

  it("簿価は単調に減り、1 円を下回らない", () => {
    const rows = straightLineSchedule(500_000, 6, 2026);
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i]!.bookValue).toBeLessThanOrEqual(rows[i - 1]!.bookValue);
    }
    expect(rows.every((r) => r.bookValue >= MEMORANDUM_VALUE)).toBe(true);
  });

  it("累計額と簿価の関係が保たれる(累計 + 簿価 = 取得価額)", () => {
    const cost = 800_000;
    for (const row of straightLineSchedule(cost, 4, 2026)) {
      expect(row.accumulated + row.bookValue).toBe(cost);
    }
  });

  it("年度は開始年から連番になる", () => {
    expect(straightLineSchedule(300_000, 3, 2030).map((r) => r.year)).toEqual([2030, 2031, 2032]);
  });

  it("端数は切り捨て、最終年で吸収する", () => {
    // 100,000 ÷ 3 = 33,333.33… → 毎年 33,333、最終年で残りを償却
    const rows = straightLineSchedule(100_000, 3, 2026);
    expect(rows[0]?.depreciation).toBe(33_333);
    expect(totalDepreciation(rows)).toBe(99_999);
  });

  it("備忘価額以下の資産・耐用年数 0 は空(償却できない)", () => {
    expect(straightLineSchedule(1, 5, 2026)).toEqual([]);
    expect(straightLineSchedule(0, 5, 2026)).toEqual([]);
    expect(straightLineSchedule(1_000_000, 0, 2026)).toEqual([]);
  });
});

describe("定率法", () => {
  it("期首簿価 × 償却率で、償却額が年々減る", () => {
    const rows = decliningBalanceSchedule(1_000_000, 5, 2026);
    expect(rows[0]?.depreciation).toBe(400_000); // 1,000,000 × 0.4
    expect(rows[1]?.depreciation).toBe(240_000); // 600,000 × 0.4
    expect(rows[2]?.depreciation).toBe(144_000); // 360,000 × 0.4
  });

  it("**途中で均等償却に切り替わる**(切り替えないと耐用年数内に償却しきれない)", () => {
    const rows = decliningBalanceSchedule(1_000_000, 5, 2026);
    // 4 年目は定率だと 86,400 だが、残存年数での均等額(107,999)の方が大きいので切り替わる
    expect(rows[3]?.depreciation).toBe(107_999);
    expect(rows[3]!.depreciation).toBeGreaterThan(Math.floor(rows[2]!.bookValue * 0.4));
  });

  it("耐用年数内に 1 円まで償却しきる", () => {
    for (const life of [4, 5, 8, 10]) {
      const rows = decliningBalanceSchedule(1_000_000, life, 2026);
      expect(rows.length).toBe(life);
      expect(rows.at(-1)?.bookValue).toBe(MEMORANDUM_VALUE);
      expect(totalDepreciation(rows)).toBe(1_000_000 - MEMORANDUM_VALUE);
    }
  });

  it("償却率を明示できる(250% 定率法など、取得時期の違いに対応する)", () => {
    const rows = decliningBalanceSchedule(1_000_000, 5, 2026, 0.5);
    expect(rows[0]?.depreciation).toBe(500_000);
  });

  it("簿価は単調に減り、1 円を下回らない", () => {
    const rows = decliningBalanceSchedule(1_234_567, 8, 2026);
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i]!.bookValue).toBeLessThanOrEqual(rows[i - 1]!.bookValue);
    }
    expect(rows.every((r) => r.bookValue >= MEMORANDUM_VALUE)).toBe(true);
  });

  it("備忘価額以下の資産・耐用年数 0 は空", () => {
    expect(decliningBalanceSchedule(1, 5, 2026)).toEqual([]);
    expect(decliningBalanceSchedule(1_000_000, 0, 2026)).toEqual([]);
  });
});

describe("depreciationSchedule(方法の振り分け)", () => {
  it("method で定額法・定率法を切り替える", () => {
    const asset = { cost: 1_000_000, usefulLifeYears: 5, method: "straight_line" as const };
    expect(depreciationSchedule(asset, 2026)[0]?.depreciation).toBe(200_000);
    expect(depreciationSchedule({ ...asset, method: "declining_balance" }, 2026)[0]?.depreciation).toBe(400_000);
  });

  it("定率法では rate を渡せる", () => {
    const rows = depreciationSchedule(
      { cost: 1_000_000, usefulLifeYears: 5, method: "declining_balance", rate: 0.3 },
      2026,
    );
    expect(rows[0]?.depreciation).toBe(300_000);
  });
});

describe("bookValueAt", () => {
  const cost = 1_000_000;
  const schedule = straightLineSchedule(cost, 5, 2026);

  it("指定した**西暦**の期末簿価を返す", () => {
    expect(bookValueAt(schedule, 2026, cost)).toBe(800_000);
    expect(bookValueAt(schedule, 2028, cost)).toBe(400_000);
  });

  it("取得前の年度は取得価額を返す", () => {
    expect(bookValueAt(schedule, 2025, cost)).toBe(cost);
  });

  it("償却後の年度は最終簿価(1 円)を返す", () => {
    expect(bookValueAt(schedule, 2099, cost)).toBe(MEMORANDUM_VALUE);
  });

  it("スケジュールが空なら取得価額(例外にしない)", () => {
    expect(bookValueAt([], 2026, cost)).toBe(cost);
  });
});

describe("depreciationInYear", () => {
  const schedule = straightLineSchedule(1_000_000, 5, 2026);

  it("指定した**西暦**の償却額を返す", () => {
    expect(depreciationInYear(schedule, 2026)).toBe(200_000);
    expect(depreciationInYear(schedule, 2030)).toBe(199_999);
  });

  it("該当年度が無ければ 0(1 始まりの連番では引けない)", () => {
    // 「年度(1 始まり)」だと誤解して 3 を渡すと 0 が返る。西暦で引くこと
    expect(depreciationInYear(schedule, 3)).toBe(0);
    expect(depreciationInYear(schedule, 2099)).toBe(0);
  });
});

describe("monthlyAmount(期中取得の月割)", () => {
  it("既定は 1 か月分", () => {
    expect(monthlyAmount(200_000)).toBe(16_666); // 円未満切り捨て
  });

  it("月数を指定できる", () => {
    expect(monthlyAmount(200_000, 6)).toBe(100_000);
    expect(monthlyAmount(200_000, 12)).toBe(200_000);
  });

  it("**円未満は切り捨てる**(切り上げると過大計上になる)", () => {
    expect(monthlyAmount(100_000, 1)).toBe(8_333); // 8,333.33…
    expect(monthlyAmount(1, 1)).toBe(0);
  });

  it("0 か月は 0", () => {
    expect(monthlyAmount(200_000, 0)).toBe(0);
  });
});
