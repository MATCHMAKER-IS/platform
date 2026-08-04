import { describe, it, expect } from "vitest";
import { lookupWithholdingTax, validateWithholdingTable, buildMonthlyDeductions, type WithholdingTable } from "./withholding";

/** 実際の月額表（甲欄）の一部。 */
const table: WithholdingTable = {
  year: "2026",
  rows: [
    { from: 0, to: 254_000, tax: [6_640, 5_020, 3_410, 1_790, 170, 0, 0, 0] },
    { from: 254_000, to: 257_000, tax: [6_750, 5_130, 3_510, 1_890, 280, 0, 0, 0] },
    { from: 257_000, to: Number.POSITIVE_INFINITY, tax: [6_850, 5_240, 3_620, 2_000, 380, 0, 0, 0] },
  ],
};

describe("lookupWithholdingTax(税額表を引く)", () => {
  it("扶養の数で列が変わる", () => {
    expect(lookupWithholdingTax(table, 255_930, 0)).toBe(6_750);
    expect(lookupWithholdingTax(table, 255_930, 1)).toBe(5_130);
    expect(lookupWithholdingTax(table, 255_930, 4)).toBe(280);
  });

  it("境目は「以上・未満」", () => {
    expect(lookupWithholdingTax(table, 253_999, 0)).toBe(6_640);
    expect(lookupWithholdingTax(table, 254_000, 0)).toBe(6_750);
  });

  it("8 人以上は 7 人の列を使う", () => {
    expect(lookupWithholdingTax(table, 255_930, 99)).toBe(0);
  });

  it("表に無い額なら例外（黙って 0 を返さない）", () => {
    const narrow: WithholdingTable = { year: "x", rows: [{ from: 0, to: 100, tax: [0, 0, 0, 0, 0, 0, 0, 0] }] };
    expect(() => lookupWithholdingTax(narrow, 1_000, 0)).toThrow();
  });
});

describe("validateWithholdingTable(表の検査)", () => {
  it("正しい表は問題なし", () => {
    expect(validateWithholdingTable(table)).toEqual([]);
  });

  it("**扶養が増えて税額が上がる**のは誤り", () => {
    const bad: WithholdingTable = { year: "x", rows: [{ from: 0, to: Number.POSITIVE_INFINITY, tax: [0, 1, 0, 0, 0, 0, 0, 0] }] };
    expect(validateWithholdingTable(bad).length).toBeGreaterThan(0);
  });

  it("列が足りない表を検出", () => {
    const bad: WithholdingTable = { year: "x", rows: [{ from: 0, to: Number.POSITIVE_INFINITY, tax: [0, 0] }] };
    expect(validateWithholdingTable(bad).length).toBeGreaterThan(0);
  });

  it("行の隙間を検出（引けない額ができる）", () => {
    const bad: WithholdingTable = {
      year: "x",
      rows: [
        { from: 0, to: 100, tax: [0, 0, 0, 0, 0, 0, 0, 0] },
        { from: 200, to: Number.POSITIVE_INFINITY, tax: [0, 0, 0, 0, 0, 0, 0, 0] },
      ],
    };
    expect(validateWithholdingTable(bad).some((p) => p.includes("隙間"))).toBe(true);
  });

  it("最終行に上限があると高給で引けなくなる", () => {
    const bad: WithholdingTable = { year: "x", rows: [{ from: 0, to: 100, tax: [0, 0, 0, 0, 0, 0, 0, 0] }] };
    expect(validateWithholdingTable(bad).some((p) => p.includes("最終行"))).toBe(true);
  });
});

describe("buildMonthlyDeductions(手取りまで)", () => {
  it("**社会保険料を引いた後**の額で税額表を引く", () => {
    const d = buildMonthlyDeductions({
      grossPay: 300_000, socialInsurance: 44_070, dependents: 1, table, residentTax: 12_000,
    });
    expect(d.taxableAmount).toBe(255_930); // 300,000 - 44,070
    expect(d.incomeTax).toBe(5_130);
    expect(d.netPay).toBe(300_000 - (44_070 + 5_130 + 12_000));
  });

  it("住民税は省略できる（前年の所得で決まるため計算しない）", () => {
    const d = buildMonthlyDeductions({ grossPay: 300_000, socialInsurance: 44_070, dependents: 1, table });
    expect(d.residentTax).toBe(0);
  });
});
