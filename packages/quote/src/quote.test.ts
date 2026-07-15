import { describe, it, expect } from "vitest";
import { buildQuote, isExpired, quoteStatus, daysUntilExpiry, convertToInvoice } from "./quote.js";
describe("quote", () => {
  const lines = [{ description: "開発", quantity: 1, unitPrice: 100000 }, { description: "書籍", quantity: 2, unitPrice: 1000, taxRate: 8 as const }];
  const q = buildQuote({ number: "QUO-0001", issueDate: "2025-07-01", validUntil: "2025-07-31", billTo: "株式会社テスト" }, lines);
  it("builds and totals", () => {
    expect(q.totals.subtotal).toBe(102000);
    expect(q.totals.tax).toBe(10160);
    expect(q.totals.total).toBe(112160);
  });
  it("status and expiry", () => {
    expect(isExpired(q, new Date("2025-08-01"))).toBe(true);
    expect(quoteStatus({ validUntil: "2025-07-31", state: "sent" }, new Date("2025-07-15"))).toBe("sent");
    expect(quoteStatus({ validUntil: "2025-07-01" }, new Date("2025-07-15"))).toBe("expired");
    expect(quoteStatus({ validUntil: "2025-01-01", state: "accepted" }, new Date("2025-07-15"))).toBe("accepted");
    expect(daysUntilExpiry({ validUntil: "2025-07-31" }, new Date("2025-07-15"))).toBe(16);
  });
  it("converts to invoice", () => {
    const inv = convertToInvoice(q, { number: "INV-202507-0001", issueDate: "2025-07-16", dueDate: "2025-08-31" });
    expect(inv.billTo).toBe("株式会社テスト");
    expect(inv.totals.total).toBe(112160);
    expect(inv.lines).toHaveLength(2);
  });
});
