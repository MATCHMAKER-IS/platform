import { describe, it, expect } from "vitest";
import {
  threeWayMatch, findDuplicatePayments, DEFAULT_TOLERANCE,
  type MatchLine, type ProcessedInvoice,
} from "./three-way-match";

const ordered: MatchLine[] = [{ description: "部品A", quantity: 10, unitPrice: 1_000 }];

describe("threeWayMatch(三点照合)", () => {
  it("3 者が一致すれば支払ってよい", () => {
    const r = threeWayMatch({ orderNumber: "PO1", ordered, received: ordered, invoiced: ordered });
    expect(r.payable).toBe(true);
    expect(r.mismatches).toHaveLength(0);
    expect(r.payableAmount).toBe(10_000);
  });

  it("**発注していない品目の請求は止める**", () => {
    const r = threeWayMatch({
      orderNumber: "PO2", ordered, received: ordered,
      invoiced: [...ordered, { description: "部品X", quantity: 1, unitPrice: 5_000 }],
    });
    expect(r.payable).toBe(false);
    expect(r.mismatches.some((m) => m.kind === "not-ordered")).toBe(true);
  });

  it("**入荷していないのに請求されたら止める**", () => {
    const r = threeWayMatch({ orderNumber: "PO3", ordered, received: [], invoiced: ordered });
    expect(r.payable).toBe(false);
    expect(r.mismatches.some((m) => m.kind === "not-received")).toBe(true);
  });

  it("入荷より多い請求は止め、支払可能額は入荷分まで", () => {
    const r = threeWayMatch({
      orderNumber: "PO4", ordered,
      received: [{ description: "部品A", quantity: 8, unitPrice: 1_000 }], invoiced: ordered,
    });
    expect(r.payable).toBe(false);
    expect(r.payableAmount).toBe(8_000);
  });

  it("**合計が同じでも単価が違えば止める**（数量を減らして単価を上げる手口）", () => {
    const r = threeWayMatch({
      orderNumber: "PO5", ordered, received: ordered,
      invoiced: [{ description: "部品A", quantity: 5, unitPrice: 2_000 }],
    });
    expect(r.payable).toBe(false);
    expect(r.mismatches.some((m) => m.kind === "price-changed")).toBe(true);
  });

  it("**端数程度の差は許容する**（毎回止めると確認が形骸化する）", () => {
    const r = threeWayMatch({
      orderNumber: "PO6", ordered, received: ordered,
      invoiced: [{ description: "部品A", quantity: 10, unitPrice: 1_000.5 }],
    });
    expect(r.payable).toBe(true);
  });

  it("入荷したのに請求が来ていないことも挙げる（後でまとめて来る）", () => {
    const r = threeWayMatch({ orderNumber: "PO7", ordered, received: ordered, invoiced: [] });
    expect(r.mismatches.some((m) => m.kind === "not-invoiced")).toBe(true);
  });

  it("同じ品目が複数行あればまとめる", () => {
    const split: MatchLine[] = [
      { description: "部品A", quantity: 6, unitPrice: 1_000 },
      { description: "部品A", quantity: 4, unitPrice: 1_000 },
    ];
    expect(threeWayMatch({ orderNumber: "PO8", ordered, received: split, invoiced: ordered }).payable).toBe(true);
  });

  it("既定の許容差は数量 0（1 個でも違えば確認する）", () => {
    expect(DEFAULT_TOLERANCE.quantity).toBe(0);
  });

  it("blocking が先に並ぶ", () => {
    const r = threeWayMatch({
      orderNumber: "PO9", ordered,
      received: [{ description: "部品A", quantity: 12, unitPrice: 1_000 }],
      invoiced: [...ordered, { description: "部品X", quantity: 1, unitPrice: 100 }],
    });
    expect(r.mismatches[0]?.severity).toBe("blocking");
  });
});

describe("findDuplicatePayments(二重払い)", () => {
  const history: ProcessedInvoice[] = [
    { invoiceNumber: "INV-100", supplier: "A社", amount: 50_000, paidOn: "2026-06-01" },
    { invoiceNumber: "INV-200", supplier: "B社", amount: 30_000, paidOn: "2026-07-01" },
  ];

  it("**請求書番号が同じなら certain**", () => {
    const d = findDuplicatePayments({ invoiceNumber: "INV-100", supplier: "A社", amount: 50_000, paidOn: "2026-08-01" }, history);
    expect(d[0]?.confidence).toBe("certain");
  });

  it("**番号が違っても、同額・同社・日付が近ければ likely**", () => {
    const d = findDuplicatePayments({ invoiceNumber: "INV-999", supplier: "A社", amount: 50_000, paidOn: "2026-07-01" }, history);
    expect(d[0]?.confidence).toBe("likely");
  });

  it("日付が離れていれば疑わない", () => {
    expect(findDuplicatePayments({ invoiceNumber: "INV-999", supplier: "A社", amount: 50_000, paidOn: "2026-10-01" }, history)).toHaveLength(0);
  });

  it("仕入先が違えば疑わない", () => {
    expect(findDuplicatePayments({ invoiceNumber: "INV-999", supplier: "C社", amount: 50_000, paidOn: "2026-06-05" }, history)).toHaveLength(0);
  });

  it("同一のレコードは自分自身として除く", () => {
    expect(findDuplicatePayments(history[0]!, history)).toHaveLength(0);
  });

  it("certain が先に並ぶ", () => {
    const h: ProcessedInvoice[] = [
      { invoiceNumber: "INV-999", supplier: "A社", amount: 50_000, paidOn: "2026-06-01" },
      { invoiceNumber: "INV-100", supplier: "A社", amount: 50_000, paidOn: "2026-05-01" },
    ];
    const d = findDuplicatePayments({ invoiceNumber: "INV-100", supplier: "A社", amount: 50_000, paidOn: "2026-06-15" }, h);
    expect(d[0]?.confidence).toBe("certain");
  });
});
