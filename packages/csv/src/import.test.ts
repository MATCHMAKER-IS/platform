import { describe, it, expect } from "vitest";
import { detectEncoding, coerceValue, importRows, errorRowsToCsv, type ColumnSpec } from "./import";

describe("detectEncoding(文字コードの判定)", () => {
  it("**BOM があればそれに従う**（最も確実）", () => {
    expect(detectEncoding(new Uint8Array([0xef, 0xbb, 0xbf, 0x41]))).toBe("utf-8");
    expect(detectEncoding(new Uint8Array([0xff, 0xfe, 0x41, 0x00]))).toBe("utf-16le");
  });

  it("UTF-8 の日本語を判別する", () => {
    expect(detectEncoding(new TextEncoder().encode("日付,金額"))).toBe("utf-8");
  });

  it("**Shift_JIS を見分ける**（日本の業務では今も主流）", () => {
    // 「日付」= 0x93 0xFA 0x95 0x74
    expect(detectEncoding(new Uint8Array([0x93, 0xFA, 0x95, 0x74]))).toBe("shift_jis");
  });

  it("ASCII だけなら UTF-8 として扱う", () => {
    expect(detectEncoding(new TextEncoder().encode("date,amount"))).toBe("utf-8");
  });

  it("空でも落ちない", () => {
    expect(detectEncoding(new Uint8Array([]))).toBe("utf-8");
  });
});

describe("coerceValue(型変換)", () => {
  it("**数値の表記ゆれを吸収する**", () => {
    expect(coerceValue("1,000", "number")).toBe(1000);
    expect(coerceValue("1000円", "number")).toBe(1000);
    expect(coerceValue("¥1,000", "number")).toBe(1000);
    expect(coerceValue("１２３", "number")).toBe(123);
  });

  it("**括弧は負の数**（会計ソフトの出力によくある）", () => {
    expect(coerceValue("(500)", "number")).toBe(-500);
  });

  it("整数を求めたのに小数なら undefined", () => {
    expect(coerceValue("1.5", "integer")).toBeUndefined();
    expect(coerceValue("1.5", "number")).toBe(1.5);
  });

  it("**日付の表記ゆれを吸収して YYYY-MM-DD に揃える**", () => {
    expect(coerceValue("2026/8/3", "date")).toBe("2026-08-03");
    expect(coerceValue("2026.8.3", "date")).toBe("2026-08-03");
    expect(coerceValue("２０２６年８月３日", "date")).toBe("2026-08-03");
  });

  it("ありえない日付は undefined", () => {
    expect(coerceValue("2026-13-01", "date")).toBeUndefined();
    expect(coerceValue("2026-01-99", "date")).toBeUndefined();
  });

  it("真偽値は日本語も受ける", () => {
    expect(coerceValue("○", "boolean")).toBe(true);
    expect(coerceValue("はい", "boolean")).toBe(true);
    expect(coerceValue("×", "boolean")).toBe(false);
    expect(coerceValue("無", "boolean")).toBe(false);
  });

  it("空文字は undefined（未入力）", () => {
    expect(coerceValue("", "string")).toBeUndefined();
    expect(coerceValue("   ", "number")).toBeUndefined();
  });
});

describe("importRows(取り込み)", () => {
  const cols: ColumnSpec[] = [
    { header: "日付", field: "date", type: "date", required: true },
    { header: "金額", field: "amount", type: "number", required: true, aliases: ["額"] },
    { header: "摘要", field: "note", type: "string" },
  ];
  const rows = [
    { "日付": "2026/8/1", "額": "1,000", "摘要": "A" },
    { "日付": "", "額": "2000", "摘要": "B" },
    { "日付": "2026/8/3", "額": "abc", "摘要": "C" },
    { "日付": "2026/8/4", "額": "3000", "摘要": "D" },
  ];

  it("**成功した行と失敗した行を両方返す**（1 行の誤りで全部止めない）", () => {
    const r = importRows(rows, cols);
    expect(r.rows).toHaveLength(2);
    expect(r.errors).toHaveLength(2);
  });

  it("**見出しの別名を解決する**（「額」→「金額」）", () => {
    const r = importRows(rows, cols);
    expect(r.missingColumns).toHaveLength(0);
    expect(r.rows[0]?.amount).toBe(1000);
  });

  it("**行番号は見出し行を含む**（画面と CSV で一致する）", () => {
    const r = importRows(rows, cols);
    expect(r.errors[0]?.line).toBe(3);
    expect(r.errors[1]?.line).toBe(4);
  });

  it("必須でない列が空でもエラーにしない", () => {
    const r = importRows([{ "日付": "2026-08-01", "額": "100", "摘要": "" }], cols);
    expect(r.errors).toHaveLength(0);
    expect(r.rows[0]?.note).toBeUndefined();
  });

  it("**見つからなかった列を挙げる**（見出しの表記ゆれ）", () => {
    const r = importRows([{ "date": "2026-08-01" }], cols);
    expect(r.missingColumns).toContain("日付");
  });

  it("定義に無い列を挙げる（無視したことを伝える）", () => {
    const r = importRows([{ "日付": "2026-08-01", "額": "100", "余計な列": "x" }], cols);
    expect(r.unknownColumns).toContain("余計な列");
  });

  it("**エラーがあった行は取り込まない**（半端なデータを入れない）", () => {
    const r = importRows([{ "日付": "", "額": "100" }], cols);
    expect(r.rows).toHaveLength(0);
  });

  it("空でも落ちない", () => {
    const r = importRows([], cols);
    expect(r.rows).toHaveLength(0);
    expect(r.errors).toHaveLength(0);
  });
});

describe("errorRowsToCsv(再取り込み用)", () => {
  const cols: ColumnSpec[] = [
    { header: "日付", field: "date", type: "date", required: true },
    { header: "金額", field: "amount", type: "number", required: true },
  ];

  it("**エラー内容を先頭列に足す**（何が悪かったか見ながら直せる）", () => {
    const r = importRows([{ "日付": "", "金額": "100" }], cols);
    const csv = errorRowsToCsv(r.errors, ["日付", "金額"]);
    expect(csv.split("\n")[0]).toBe("エラー内容,元の行番号,日付,金額");
    expect(csv).toContain("「日付」が空です");
  });

  it("同じ行の複数のエラーをまとめる", () => {
    const r = importRows([{ "日付": "", "金額": "" }], cols);
    const csv = errorRowsToCsv(r.errors, ["日付", "金額"]);
    // 見出し + 1 行
    expect(csv.split("\n")).toHaveLength(2);
    expect(csv).toContain(" / ");
  });

  it("カンマや引用符を含む値を正しく囲む", () => {
    const r = importRows([{ "日付": "", "金額": '1,000"x' }], cols);
    const csv = errorRowsToCsv(r.errors, ["日付", "金額"]);
    expect(csv).toContain('"1,000""x"');
  });
});
