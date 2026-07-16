import { describe, it, expect } from "vitest";
import { currencyMeta, roundMoney, money, formatMoney, convert, addMoney, sumMoney, totalInBaseCurrency } from "./index";

describe("currency", () => {
  it("meta + round", () => { expect(currencyMeta("JPY").decimals).toBe(0); expect(roundMoney(1234.56, "JPY")).toBe(1235); expect(roundMoney(1.005, "USD")).toBe(1.01); expect(roundMoney(2.5, "JPY", "bankers")).toBe(2); });
  it("format", () => { expect(formatMoney(money(1234567, "JPY"))).toBe("¥1,234,567"); expect(formatMoney(money(1234.5, "USD"))).toBe("$1,234.50"); expect(formatMoney({ amount: 1000, currency: "JPY" }, { code: true })).toBe("¥1,000 JPY"); });
  it("convert/add/sum", () => { expect(convert({ amount: 100, currency: "USD" }, "JPY", 150).amount).toBe(15000); expect(addMoney({ amount: 1, currency: "JPY" }, { amount: 1, currency: "USD" })).toBeNull(); expect(sumMoney([{ amount: 100, currency: "JPY" }, { amount: 200, currency: "JPY" }])!.amount).toBe(300); });
  it("multi-currency total", () => { expect(totalInBaseCurrency([{ amount: 1000, currency: "JPY" }, { amount: 10, currency: "USD" }], "JPY", { USD: 150 }).amount).toBe(2500); });
});
