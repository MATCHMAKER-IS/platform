import { describe, it, expect } from "vitest";
import { toCsv, parseCsv, csvEscape } from "./index";

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

describe("csvEscape: CSV インジェクション", () => {
  // **Excel は `=` で始まるセルを数式として実行する。**
  // 業務データ(備考欄・氏名・取引先名)は利用者が自由に入力できるので、
  // そこに仕込まれた式が、CSV を受け取った人の手元で動く
  it("数式になる先頭文字を無害化する", () => {
    expect(csvEscape("=1+1")).toBe("'=1+1");
    expect(csvEscape("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvEscape("+81901234")).toBe("'+81901234");
  });
  // **クリックさせる形が最も危ない。** 表示は「請求書」に見える
  it("HYPERLINK も無害化する", () => {
    expect(csvEscape("=HYPERLINK(\"http://x\",\"請求書\")")).toContain("'=HYPERLINK");
  });
  // **負の数値は壊さない。** 差額・値引き・返金は負で入るので、
  // 一律に無害化すると Excel で合計が計算できなくなる
  it("数値として妥当なものは無害化しない", () => {
    expect(csvEscape(-500)).toBe("-500");
    expect(csvEscape("-1.5")).toBe("-1.5");
  });
  // **`-1+1` は数値ではないので無害化する**(境界)
  it("数値に見えて式のものは無害化する", () => {
    expect(csvEscape("-1+1")).toBe("'-1+1");
  });
  // **普通の値は変えない**
  it("通常の値はそのまま", () => {
    expect(csvEscape("山田")).toBe("山田");
    expect(csvEscape("0120-1234")).toBe("0120-1234");
  });
});

describe("parseCsv: 壊れた CSV を見逃さない", () => {
  // **既定は黙って通す。** 既存の呼び出しを壊さないため
  it("既定では閉じない引用符も通る", () => {
    expect(parseCsv('a,"b')).toEqual([["a", "b"]]);
  });
  // **`strict` で止める。** 引用符が閉じないと残り全部が 1 フィールドになり、
  // **行数が減って列がずれる**——取り込みは成功するのにデータが欠ける
  it("strict なら閉じない引用符で例外", () => {
    expect(() => parseCsv('a,"b', { strict: true })).toThrow();
  });
  it("strict でも正常な CSV は通る", () => {
    expect(parseCsv('a,"b",c', { strict: true })).toEqual([["a", "b", "c"]]);
  });
  // **埋め込み改行は壊れていない**(境界)
  it("strict でも引用符内の改行は通る", () => {
    expect(parseCsv('a,"b\nc"', { strict: true })).toEqual([["a", "b\nc"]]);
  });
});
