import { describe, it, expect } from "vitest";
import { renderInvoiceHtml, renderQuotationHtml, renderDeliveryNoteHtml } from "./render.js";
const doc = {
  invoiceNumber: "INV-001", issueDate: "2025-07-25", dueDate: "2025-08-31",
  seller: { name: "株式会社テスト" }, buyer: { name: "取引先" },
  lines: [{ description: "デザイン制作", quantity: 1, unitPrice: 500_000, taxRate: 10 }],
};
describe("business document types", () => {
  it("renders invoice with withholding rows", () => {
    const html = renderInvoiceHtml({ ...doc, withholding: 51_050 });
    expect(html).toContain("源泉徴収税");
    expect(html).toContain("差引お支払額");
    expect(html).toContain("¥498,950");
  });
  it("renders quotation and delivery note with proper labels", () => {
    const quo = renderQuotationHtml(doc);
    expect(quo).toContain("見積書");
    expect(quo).toContain("見積番号");
    expect(quo).not.toContain("請求書番号");
    expect(renderDeliveryNoteHtml(doc)).toContain("納品書");
  });
});
