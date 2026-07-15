import { describe, it, expect } from "vitest";
import { toCsv, parseCsv, csvEscape } from "./index.js";

describe("csv", () => {
  it("toCsv: 特殊文字をエスケープ", () => {
    const csv = toCsv([{ a: "x,y", b: 'he said "hi"', c: "line\nbreak" }], { header: false });
    expect(csv).toBe('"x,y","he said ""hi""","line\nbreak"');
  });
  it("toCsv: ヘッダと列指定", () => {
    const csv = toCsv([{ name: "山田", age: 30 }], { columns: [{ key: "name", header: "氏名" }, { key: "age", header: "年齢" }] });
    expect(csv).toBe("氏名,年齢\r\n山田,30");
  });
  it("parseCsv: 引用符・埋め込みカンマ", () => {
    const rows = parseCsv('a,b\r\n"x,y",z', { header: true }) as Record<string, string>[];
    expect(rows[0]).toEqual({ a: "x,y", b: "z" });
  });
  it("round-trip", () => {
    const data = [{ a: "1,2", b: 'q"q' }, { a: "3", b: "4" }];
    const parsed = parseCsv(toCsv(data), { header: true }) as Record<string, string>[];
    expect(parsed).toEqual([{ a: "1,2", b: 'q"q' }, { a: "3", b: "4" }]);
  });
  it("csvEscape", () => {
    expect(csvEscape("plain")).toBe("plain");
    expect(csvEscape("a,b")).toBe('"a,b"');
  });
});
