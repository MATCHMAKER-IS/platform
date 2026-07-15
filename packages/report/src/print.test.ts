import { describe, it, expect } from "vitest";
import { printPageCss, injectPrintCss, wrapForPrint, combineForPrint, printableInvoiceHtml, printableQuotationHtml } from "./print.js";
const doc = { invoiceNumber: "INV-001", issueDate: "2025-07-25", seller: { name: "自社" }, buyer: { name: "取引先" }, lines: [{ description: "作業", quantity: 1, unitPrice: 10000, taxRate: 10 }] };
describe("report print/PDF helpers", () => {
  it("builds @page css and injects", () => {
    expect(printPageCss({ format: "A4", margin: "20mm" })).toContain("@page { size: A4; margin: 20mm; }");
    expect(printPageCss({ landscape: true })).toContain("A4 landscape");
    const injected = injectPrintCss("<html><head></head><body>x</body></html>", "MYCSS");
    expect(injected).toContain("</style></head>");
    expect(injected.indexOf("MYCSS")).toBeLessThan(injected.indexOf("</head>"));
  });
  it("makes printable documents", () => {
    const p = printableInvoiceHtml(doc);
    expect(p).toContain("請求書");
    expect(p).toContain("@page");
    expect(printableQuotationHtml(doc)).toContain("見積書");
    expect(wrapForPrint("<div>x</div>")).toContain("@page");
  });
  it("combines multiple documents with page breaks", () => {
    const combined = combineForPrint([printableInvoiceHtml({ ...doc, invoiceNumber: "A" }), printableInvoiceHtml({ ...doc, invoiceNumber: "B" })]);
    expect(combined).toContain("page-break");
    expect((combined.match(/<!doctype/gi) || []).length).toBe(1);
  });
});
