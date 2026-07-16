import { describe, it, expect } from "vitest";
import { lineNet, lineTaxRate } from "./line";
import { invoiceTotals, buildInvoice } from "./invoice";
import { formatInvoiceNumber, parseInvoiceSequence } from "./numbering";
import { dueDateFrom, endOfNextMonth, paymentStatus, balanceDue, daysUntilDue } from "./payment";
describe("invoice", () => {
  it("computes lines and totals (qualified invoice per-rate tax)", () => {
    expect(lineNet({ description: "A", quantity: 3, unitPrice: 1000 })).toBe(3000);
    expect(lineNet({ description: "C", quantity: 1, unitPrice: 100, discount: 200 })).toBe(0);
    expect(lineTaxRate({ description: "y", quantity: 1, unitPrice: 1, taxRate: 8 })).toBe(8);
    const lines = [
      { description: "10%", quantity: 1, unitPrice: 10000 },
      { description: "8%", quantity: 2, unitPrice: 1000, taxRate: 8 as const },
      { description: "10%b", quantity: 1, unitPrice: 5000 },
    ];
    const t = invoiceTotals(lines);
    expect(t.subtotal).toBe(17000);
    expect(t.tax).toBe(1660);
    expect(t.total).toBe(18660);
    expect(t.taxByRate.find((r) => r.rate === 10)!.tax).toBe(1500);
    expect(buildInvoice({ number: "INV-0001", issueDate: "2025-07-01", dueDate: "2025-07-31", billTo: "x" }, lines).totals.total).toBe(18660);
  });
  it("numbers, dues and statuses", () => {
    expect(formatInvoiceNumber(1, { date: new Date("2025-07-15") })).toBe("INV-202507-0001");
    expect(formatInvoiceNumber(42, { prefix: "SEIKYU", padding: 6 })).toBe("SEIKYU-000042");
    expect(parseInvoiceSequence("INV-202507-0001")).toBe(1);
    expect(dueDateFrom("2025-07-01", 30)).toBe("2025-07-31");
    expect(endOfNextMonth("2025-07-15")).toBe("2025-08-31");
    expect(paymentStatus({ issued: true, dueDate: "2025-07-01", paidAmount: 0, total: 1000 }, new Date("2025-07-15"))).toBe("overdue");
    expect(paymentStatus({ issued: true, dueDate: "2025-07-31", paidAmount: 1000, total: 1000 })).toBe("paid");
    expect(balanceDue(1000, 300)).toBe(700);
    expect(daysUntilDue("2025-07-31", new Date("2025-07-15"))).toBe(16);
  });
});

import { applyPayment, reconcile, outstandingTotal, agingBuckets } from "./reconcile";
import { renderInvoiceHtml } from "./html";
describe("invoice reconcile & html", () => {
  const invs = [
    { number: "INV-001", dueDate: "2025-05-31", total: 10000, paidAmount: 0 },
    { number: "INV-002", dueDate: "2025-06-30", total: 20000, paidAmount: 0 },
    { number: "INV-003", dueDate: "2025-07-31", total: 5000, paidAmount: 0 },
  ];
  it("applies payments FIFO and buckets aging", () => {
    const r = applyPayment(invs, 15000);
    expect(r.invoices.find((i) => i.number === "INV-001")!.paidAmount).toBe(10000);
    expect(r.invoices.find((i) => i.number === "INV-002")!.paidAmount).toBe(5000);
    expect(applyPayment(invs, 40000).unapplied).toBe(5000);
    expect(reconcile(invs, [10000, 10000]).invoices.find((i) => i.number === "INV-002")!.paidAmount).toBe(10000);
    expect(outstandingTotal(invs)).toBe(35000);
    const aging = agingBuckets(invs, new Date("2025-07-15"));
    expect(aging.current).toBe(5000);
    expect(aging.d1_30).toBe(20000);
    expect(aging.d31_60).toBe(10000);
  });
  it("renders invoice html with escaping", () => {
    const inv = { number: "INV-0001", issueDate: "2025-07-01", dueDate: "2025-07-31", registrationNumber: "T1234567890123", billTo: "株式会社テスト", lines: [{ description: "x", quantity: 1, unitPrice: 10000 }], totals: { subtotal: 10000, tax: 1000, total: 11000, taxByRate: [{ rate: 10 as const, net: 10000, tax: 1000, gross: 11000 }] } };
    const html = renderInvoiceHtml(inv);
    expect(html).toContain("INV-0001");
    expect(html).toContain("T1234567890123");
    expect(renderInvoiceHtml({ ...inv, billTo: "<b>x</b>" })).toContain("&lt;b&gt;");
  });
});
