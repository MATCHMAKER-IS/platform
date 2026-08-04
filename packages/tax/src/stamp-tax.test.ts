import { describe, it, expect } from "vitest";
import {
  stampTax, savingsByGoingElectronic, compareByTaxNotation, PENALTY_MULTIPLIER,
} from "./stamp-tax";

describe("stampTax(印紙税額)", () => {
  it("**電子契約は課税されない**（文書を作成していないため）", () => {
    expect(stampTax({ type: "contract", amount: 10_000_000 }).tax).toBe(20_000);
    expect(stampTax({ type: "contract", amount: 10_000_000, electronic: true }).tax).toBe(0);
  });

  it("電子の理由には「印刷して押印すると課税される」ことも書く", () => {
    expect(stampTax({ type: "contract", amount: 1_000_000, electronic: true }).reason).toContain("印刷");
  });

  it("**貼り忘れは過怠税で 3 倍**", () => {
    expect(PENALTY_MULTIPLIER).toBe(3);
    expect(stampTax({ type: "contract", amount: 10_000_000 }).penaltyIfMissing).toBe(60_000);
  });

  it("**基本契約書は金額によらず一律 4,000 円**（個別の請負とは違う）", () => {
    expect(stampTax({ type: "basic-agreement", amount: 100_000 }).tax).toBe(4_000);
    expect(stampTax({ type: "basic-agreement", amount: 100_000_000 }).tax).toBe(4_000);
  });

  it("**領収書は 5 万円未満なら非課税**", () => {
    expect(stampTax({ type: "receipt", amount: 49_999 }).tax).toBe(0);
    expect(stampTax({ type: "receipt", amount: 50_000 }).tax).toBe(200);
  });

  it("請負は 1 万円未満なら非課税", () => {
    expect(stampTax({ type: "contract", amount: 9_999 }).tax).toBe(0);
    expect(stampTax({ type: "contract", amount: 10_000 }).tax).toBe(200);
  });

  it("第 1 号と第 2 号では刻みが違う", () => {
    // 300 万円: 第 2 号は 1,000 円、第 1 号は 400 円
    expect(stampTax({ type: "contract", amount: 2_500_000 }).tax).toBe(1_000);
    expect(stampTax({ type: "transfer", amount: 2_500_000 }).tax).toBe(400);
  });

  it("高額でも上限で止まる", () => {
    expect(stampTax({ type: "contract", amount: 10_000_000_000 }).tax).toBe(600_000);
  });

  it("負の金額でも落ちない", () => {
    expect(stampTax({ type: "contract", amount: -1 }).tax).toBe(0);
  });
});

describe("compareByTaxNotation(消費税の書き方)", () => {
  it("**段をまたぐときだけ差が出る**", () => {
    // 税抜 999,999 → 200 円 / 税込 1,099,998 → 400 円
    const c = compareByTaxNotation(999_999, 99_999, "contract");
    expect(c.withSeparateTax).toBe(200);
    expect(c.withoutSeparateTax).toBe(400);
    expect(c.difference).toBe(200);
  });

  it("同じ段に収まれば差は無い", () => {
    expect(compareByTaxNotation(1_000_000, 100_000, "contract").difference).toBe(0);
  });
});

describe("savingsByGoingElectronic(電子化の効果)", () => {
  it("年間いくら浮くかを出す", () => {
    const s = savingsByGoingElectronic([{ type: "contract", amount: 10_000_000, count: 12 }]);
    expect(s.paperTotal).toBe(240_000);
    expect(s.savings).toBe(240_000);
  });

  it("複数の種類をまとめて計算できる", () => {
    const s = savingsByGoingElectronic([
      { type: "contract", amount: 5_000_000, count: 10 },
      { type: "basic-agreement", amount: 0, count: 5 },
    ]);
    expect(s.paperTotal).toBe(10_000 * 10 + 4_000 * 5);
  });

  it("件数が負でも落ちない", () => {
    expect(savingsByGoingElectronic([{ type: "contract", amount: 1_000_000, count: -1 }]).paperTotal).toBe(0);
  });
});
