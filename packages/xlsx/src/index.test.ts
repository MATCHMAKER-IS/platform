import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { readSheet, writeSheet } from "./index";

describe("xlsx", () => {
  it("書き出した内容を読み戻せる(往復)", async () => {
    const rows = [
      { 氏名: "山田太郎", 金額: 1000 },
      { 氏名: "鈴木花子", 金額: 2500 },
    ];
    const written = await writeSheet(rows);
    expect(written.ok).toBe(true);
    if (!written.ok) return;

    const read = await readSheet(written.value);
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.value).toHaveLength(2);
      expect(read.value[0]?.["氏名"]).toBe("山田太郎");
      expect(read.value[1]?.["金額"]).toBe(2500);
    }
  });
});

describe("readSheet: 基本型でないセルを落とす", () => {
  /** 数式・リンク・書式付き文字列を含むブックを作る。 */
  async function makeBook(): Promise<Uint8Array> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sheet1");
    ws.addRow(["合計", "リンク", "書式付き"]);
    const row = ws.addRow([]);
    // **利用者が Excel で合計欄を作ると、こうなる**
    row.getCell(1).value = { formula: "1+1", result: 2 } as ExcelJS.CellFormulaValue;
    row.getCell(2).value = { text: "請求書", hyperlink: "http://example.jp" };
    row.getCell(3).value = { richText: [{ text: "山" }, { text: "田" }] };
    return new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
  }

  // **`as` で押し込むと `"[object Object]"` になる。**
  // 型検査は `as` を信じるので通ってしまい、取り込んだ後で気づく
  it("数式は計算結果を採る", async () => {
    const read = await readSheet(await makeBook());
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.value[0]?.["合計"]).toBe(2);
  });
  // **ハイパーリンクは表示文字列。** 取り込み先の列は見えている値を期待している
  it("ハイパーリンクは表示文字列を採る", async () => {
    const read = await readSheet(await makeBook());
    if (read.ok) expect(read.value[0]?.["リンク"]).toBe("請求書");
  });
  // **書式付き文字列は連結する**(部分ごとに分かれている)
  it("書式付き文字列は連結する", async () => {
    const read = await readSheet(await makeBook());
    if (read.ok) expect(read.value[0]?.["書式付き"]).toBe("山田");
  });
});
