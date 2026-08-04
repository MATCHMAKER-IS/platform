import { describe, it, expect } from "vitest";
import { applyDiscount, addRevision, diffRevisions, calcMargin, maxDiscountForMargin } from "./pricing";
import type { InvoiceLine } from "@platform/invoice";

const lines: InvoiceLine[] = [
  { description: "A", quantity: 1, unitPrice: 70_000 },
  { description: "B", quantity: 1, unitPrice: 30_000 },
];

describe("applyDiscount(全体値引きの按分)", () => {
  it("**明細の金額に比例して配分する**（税込から単純に引かない）", () => {
    const d = applyDiscount(lines, { type: "amount", value: 10_000 });
    expect(d.lines[0]?.discount).toBe(7_000);
    expect(d.lines[1]?.discount).toBe(3_000);
    expect(d.discountTotal).toBe(10_000);
  });

  it("率でも指定できる", () => {
    expect(applyDiscount(lines, { type: "rate", value: 0.1 }).discountTotal).toBe(10_000);
  });

  it("**総額を超えない**（マイナスの見積は作れない）", () => {
    expect(applyDiscount(lines, { type: "amount", value: 999_999 }).discountTotal).toBe(100_000);
  });

  it("**端数は最後の明細に寄せる**（配りきらないと合計が合わない）", () => {
    const three: InvoiceLine[] = [
      { description: "A", quantity: 1, unitPrice: 100 },
      { description: "B", quantity: 1, unitPrice: 100 },
      { description: "C", quantity: 1, unitPrice: 100 },
    ];
    const d = applyDiscount(three, { type: "amount", value: 10 });
    const sum = d.lines.reduce((s, l) => s + (l.discount ?? 0), 0);
    expect(sum).toBe(10);
    expect(d.roundingAdjustment).toBeGreaterThan(0);
  });

  it("既存の明細割引に足す（上書きしない）", () => {
    const withDiscount: InvoiceLine[] = [{ description: "A", quantity: 1, unitPrice: 100_000, discount: 5_000 }];
    const d = applyDiscount(withDiscount, { type: "amount", value: 10_000 });
    expect(d.lines[0]?.discount).toBe(15_000);
  });

  it("金額が 0 なら何もしない", () => {
    const zero: InvoiceLine[] = [{ description: "A", quantity: 0, unitPrice: 0 }];
    expect(applyDiscount(zero, { type: "amount", value: 1_000 }).discountTotal).toBe(0);
  });

  it("負の値引きは 0 として扱う", () => {
    expect(applyDiscount(lines, { type: "amount", value: -100 }).discountTotal).toBe(0);
  });
});

describe("addRevision / diffRevisions(改訂)", () => {
  const v1: InvoiceLine[] = [
    { description: "開発", quantity: 1, unitPrice: 1_000_000 },
    { description: "保守", quantity: 1, unitPrice: 200_000 },
  ];
  const v2: InvoiceLine[] = [
    { description: "開発", quantity: 1, unitPrice: 1_000_000 },
    { description: "保守", quantity: 3, unitPrice: 200_000 },
    { description: "研修", quantity: 1, unitPrice: 100_000 },
  ];

  it("**前の版を消さない**（後から証拠になる）", () => {
    let revs = addRevision([], v1, { revisedOn: "2026-07-01", changeReason: "初版" });
    revs = addRevision(revs, v2, { revisedOn: "2026-08-01", changeReason: "保守を延長" });
    expect(revs).toHaveLength(2);
    expect(revs[0]?.lines).toHaveLength(2);
    expect(revs[1]?.version).toBe(2);
  });

  it("**変更理由が空なら受け付けない**（後から正しい版が分からなくなる）", () => {
    expect(() => addRevision([], v1, { revisedOn: "2026-07-01", changeReason: "" })).toThrow();
    expect(() => addRevision([], v1, { revisedOn: "2026-07-01", changeReason: "   " })).toThrow();
  });

  it("追加・変更・合計の差を出す", () => {
    let revs = addRevision([], v1, { revisedOn: "2026-07-01", changeReason: "初版" });
    revs = addRevision(revs, v2, { revisedOn: "2026-08-01", changeReason: "延長" });
    const d = diffRevisions(revs, 1, 2);
    expect(d.added.map((l) => l.description)).toEqual(["研修"]);
    expect(d.changed[0]?.description).toBe("保守");
    expect(d.totalDiff).toBe(500_000);
  });

  it("削除された明細も分かる", () => {
    let revs = addRevision([], v2, { revisedOn: "2026-07-01", changeReason: "初版" });
    revs = addRevision(revs, v1, { revisedOn: "2026-08-01", changeReason: "研修を削除" });
    expect(diffRevisions(revs, 1, 2).removed.map((l) => l.description)).toEqual(["研修"]);
  });

  it("存在しない版なら例外", () => {
    const revs = addRevision([], v1, { revisedOn: "2026-07-01", changeReason: "初版" });
    expect(() => diffRevisions(revs, 1, 9)).toThrow();
  });
});

describe("calcMargin(粗利)", () => {
  const v2: InvoiceLine[] = [
    { description: "開発", quantity: 1, unitPrice: 1_000_000 },
    { description: "保守", quantity: 3, unitPrice: 200_000 },
    { description: "研修", quantity: 1, unitPrice: 100_000 },
  ];
  const costs = [
    { description: "開発", unitCost: 600_000 },
    { description: "保守", unitCost: 80_000 },
  ];

  it("**原価が未設定の明細を挙げる**（無視すると粗利が過大に出る）", () => {
    expect(calcMargin(v2, costs).missingCost).toEqual(["研修"]);
  });

  it("粗利と粗利率を出す", () => {
    const m = calcMargin(v2, costs);
    expect(m.revenue).toBe(1_700_000);
    expect(m.cost).toBe(600_000 + 240_000);
    expect(m.grossProfit).toBe(m.revenue - m.cost);
  });

  it("**粗利率が低い順に並べる**（値引きの余地を探すとき）", () => {
    const m = calcMargin(v2, costs);
    expect(m.byLine[0]?.marginRate).toBeLessThanOrEqual(m.byLine[1]?.marginRate ?? 1);
  });

  it("明細が無くても落ちない", () => {
    expect(calcMargin([], []).marginRate).toBe(0);
  });
});

describe("maxDiscountForMargin(値引きの上限)", () => {
  const v1: InvoiceLine[] = [
    { description: "開発", quantity: 1, unitPrice: 1_000_000 },
    { description: "保守", quantity: 1, unitPrice: 200_000 },
  ];
  const costs = [
    { description: "開発", unitCost: 600_000 },
    { description: "保守", unitCost: 80_000 },
  ];

  it("目標粗利率を保てる上限を出す", () => {
    const max = maxDiscountForMargin(v1, costs, 0.25);
    expect(max).toBeGreaterThan(0);
    // 値引き後も粗利率が目標を下回らない
    const after = applyDiscount(v1, { type: "amount", value: max });
    expect(calcMargin(after.lines, costs).marginRate).toBeGreaterThanOrEqual(0.25);
  });

  it("**原価が分からなければ 0**（憶測で答えない）", () => {
    expect(maxDiscountForMargin(v1, [costs[0]!], 0.25)).toBe(0);
  });

  it("目標が 100% なら引けない", () => {
    expect(maxDiscountForMargin(v1, costs, 1)).toBe(0);
  });
});
