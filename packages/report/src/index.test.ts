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

describe("formatYen: 負の金額", () => {
  // **`¥-5,000` と書かない。** 消費税の還付・返金・差額で実際に出る値で、
  // 記号の前に符号が来るのが読み手の期待(2026-08 に修正)
  it("既定は記号の前に符号を置く", () => {
    expect(formatYen(-5000)).toBe("-¥5,000");
  });
  // **日本の会計帳票は △。** 決算書・試算表はこの書き方
  it("triangle は会計帳票の書き方", () => {
    expect(formatYen(-5000, "triangle")).toBe("△5,000");
  });
  it("paren は英文会計の書き方", () => {
    expect(formatYen(-5000, "paren")).toBe("(¥5,000)");
  });
  // **0 と正の値は書き方に関係なく同じ**(符号の分岐に入らない)
  it("0 と正の値は変わらない", () => {
    expect(formatYen(0, "triangle")).toBe("¥0");
    expect(formatYen(1234567, "paren")).toBe("¥1,234,567");
  });
  // **端数は絶対値で切り捨てる。** -1234.9 は △1,234(△1,235 ではない)
  it("負の端数は絶対値で切り捨てる", () => {
    expect(formatYen(-1234.9, "triangle")).toBe("△1,234");
  });
});
