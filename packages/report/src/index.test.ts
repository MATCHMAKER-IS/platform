import { describe, it, expect } from "vitest";
import { calculateInvoice, renderInvoiceHtml, formatYen } from "./index";

describe("calculateInvoice", () => {
  it("外税・複数税率", () => {
    const c = calculateInvoice({ lines: [
      { description: "A", quantity: 1, unitPrice: 1000, taxRate: 10 },
      { description: "食", quantity: 2, unitPrice: 500, taxRate: 8 },
    ]});
    expect(c.subtotal).toBe(2000);
    expect(c.totalTax).toBe(180);
    expect(c.total).toBe(2180);
    expect(c.taxBreakdown).toHaveLength(2);
  });
  it("内税", () => {
    const c = calculateInvoice({ lines: [{ description: "A", quantity: 1, unitPrice: 330, taxRate: 10 }], taxMode: "inclusive" });
    expect(c.subtotal).toBe(300);
    expect(c.totalTax).toBe(30);
  });
  it("税率ごとに1回端数処理", () => {
    const c = calculateInvoice({ lines: Array.from({ length: 3 }, () => ({ description: "x", quantity: 1, unitPrice: 33, taxRate: 10 })) });
    expect(c.totalTax).toBe(10);
  });
});

describe("renderInvoiceHtml", () => {
  it("必須要素を含む", () => {
    const html = renderInvoiceHtml({
      invoiceNumber: "INV-001", issueDate: "2026-07-09",
      seller: { name: "株式会社サンプル", registrationNumber: "T1234567890123" },
      buyer: { name: "取引先株式会社" },
      lines: [{ description: "商品A", quantity: 2, unitPrice: 1500, taxRate: 10 }],
    });
    expect(html).toContain("請求書");
    expect(html).toContain("取引先株式会社 御中");
    expect(html).toContain("T1234567890123"); // 登録番号
    expect(html).toContain(formatYen(3300));   // 税込合計
  });
});
