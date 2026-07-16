import { describe, it, expect } from "vitest";
import { buildZenginTransfer, toHankakuKana, buildDataRecord } from "./index";
const consignor = { code: "1234567890", name: "テスト", bankCode: "0001", branchCode: "001", accountType: "1" as const, accountNumber: "1234567" };
const records = [{ bankCode: "0005", branchCode: "100", accountType: "1" as const, accountNumber: "7654321", recipientName: "ヤマダタロウ", amount: 150000 }];
describe("zengin", () => {
  it("builds transfer with correct record types", () => {
    const r = buildZenginTransfer(consignor, records, "0725");
    const lines = r.content.split("\r\n");
    expect(lines[0]![0]).toBe("1");
    expect(lines[1]![0]).toBe("2");
    expect(lines[2]![0]).toBe("8");
    expect(lines[3]).toBe("9");
    expect(r.totalAmount).toBe(150000);
  });
  it("converts kana and validates amount", () => {
    expect(toHankakuKana("ダ")).toBe("ﾀﾞ");
    expect(() => buildDataRecord({ ...records[0]!, amount: -1 })).toThrow();
  });
});
