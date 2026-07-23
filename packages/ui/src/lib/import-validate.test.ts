import { describe, it, expect } from "vitest";
import {
  validateImportRows, cellErrorLookup, errorRowIndices, filterErrorRows,
  summarizeImport, validRows, partitionRows, canRollback, canRollbackWith,
  type ImportField,
} from "./import-validate";

/**
 * CSV 取込の検証。
 *
 * ここが誤ると、**間違ったデータがそのまま業務システムに入る**。
 * 取込は一度に数百行を扱うため、1 件の見逃しが後から探しにくい。
 */

const fields: ImportField[] = [
  { key: "code", label: "コード", required: true, unique: true },
  { key: "name", label: "名称", required: true },
  { key: "price", label: "単価", type: "number" },
  { key: "since", label: "取引開始日", type: "date" },
];

describe("validateImportRows", () => {
  it("正しい行はエラーにならない", () => {
    const v = validateImportRows(
      [{ code: "A1", name: "商品A", price: "1200", since: "2026-04-01" }],
      fields,
    );
    expect(v.valid).toBe(true);
    expect(v.errorCount).toBe(0);
  });

  it("必須が空ならエラーにする", () => {
    const v = validateImportRows([{ code: "", name: "商品A" }], fields);
    expect(v.rows[0]?.errors).toContainEqual({ key: "code", message: "必須です" });
  });

  it("空白だけの値も未入力として扱う(見た目では気づけない)", () => {
    const v = validateImportRows([{ code: "   ", name: "商品A" }], fields);
    expect(v.rows[0]?.errors.some((e) => e.key === "code")).toBe(true);
  });

  it("必須でない項目は空でも通す", () => {
    const v = validateImportRows([{ code: "A1", name: "商品A", price: "" }], fields);
    expect(v.valid).toBe(true);
  });

  it("数値でない単価を弾く", () => {
    const v = validateImportRows([{ code: "A1", name: "商品A", price: "千二百" }], fields);
    expect(v.rows[0]?.errors).toContainEqual({ key: "price", message: "数値で入力してください" });
  });

  it("桁区切りのある数値は通す(Excel から貼ると入る)", () => {
    const v = validateImportRows([{ code: "A1", name: "商品A", price: "1,200" }], fields);
    expect(v.valid).toBe(true);
  });

  it("負の数と小数を通す", () => {
    const v = validateImportRows([{ code: "A1", name: "商品A", price: "-12.5" }], fields);
    expect(v.valid).toBe(true);
  });

  it("日付でない値を弾く", () => {
    const v = validateImportRows([{ code: "A1", name: "商品A", since: "令和8年" }], fields);
    expect(v.rows[0]?.errors.some((e) => e.key === "since")).toBe(true);
  });

  it("スラッシュ区切りの日付を通す(日本の様式で貼られることが多い)", () => {
    const v = validateImportRows([{ code: "A1", name: "商品A", since: "2026/04/01" }], fields);
    expect(v.valid).toBe(true);
  });

  it("重複するコードを検出し、どの行と同じかを示す", () => {
    const v = validateImportRows(
      [
        { code: "A1", name: "商品A" },
        { code: "B1", name: "商品B" },
        { code: "A1", name: "商品C" },
      ],
      fields,
    );
    // 3 行目が 1 行目と重複
    expect(v.rows[2]?.errors[0]?.message).toContain("1行目");
    expect(v.rows[0]?.errors).toHaveLength(0);
  });

  it("1 行に複数のエラーがあれば全部返す(直すたびに再取込させない)", () => {
    const v = validateImportRows([{ code: "", name: "", price: "abc" }], fields);
    expect(v.rows[0]?.errors.length).toBeGreaterThanOrEqual(3);
  });

  it("空の入力は妥当として扱う(取り込むものが無いだけ)", () => {
    const v = validateImportRows([], fields);
    expect(v.valid).toBe(true);
    expect(v.rows).toHaveLength(0);
  });
});

describe("エラーの取り出し", () => {
  const validation = validateImportRows(
    [
      { code: "A1", name: "商品A" },
      { code: "", name: "商品B" },
      { code: "A1", name: "商品C" },
    ],
    fields,
  );

  it("セル単位でエラー文言を引ける(画面で赤くする用)", () => {
    const lookup = cellErrorLookup(validation);
    expect(lookup(1, "code")).toBe("必須です");
    expect(lookup(0, "code")).toBeNull();  // エラーが無ければ null(undefined ではない)
  });

  it("エラーのある行番号だけを返す", () => {
    // 2 行目は必須が空、3 行目は 1 行目とコードが重複
    expect(errorRowIndices(validation)).toEqual([1, 2]);
  });

  it("エラー行だけを元データから抜き出す(直す対象を見せる)", () => {
    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(filterErrorRows(rows, validation).map((r) => r.index)).toEqual([1, 2]);
  });

  it("正しい行だけを取り出す(部分取込)", () => {
    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(validRows(rows, validation)).toEqual([{ id: 1 }]);
  });

  it("正しい行とエラー行に分ける", () => {
    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const { valid, invalid } = partitionRows(rows, validation);
    expect(valid).toHaveLength(1);
    expect(invalid).toHaveLength(2);
  });

  it("件数をまとめる(取込前に見せる)", () => {
    const s = summarizeImport(validation);
    expect(s.total).toBe(3);
    expect(s.valid).toBe(1);
    expect(s.errorRows).toBe(2);
    expect(s.ok).toBe(false);
  });
});

describe("取り消し(ロールバック)の可否", () => {
  it("成功・一部成功だけ取り消せる(失敗したものは戻すものが無い)", () => {
    expect(canRollback("success")).toBe(true);
    expect(canRollback("partial")).toBe(true);
    expect(canRollback("failed")).toBe(false);
    expect(canRollback("rolled_back")).toBe(false);
  });

  it("権限を持つ人だけが取り消せる(誤って全件消されると戻せない)", () => {
    expect(canRollbackWith("success", ["admin"], ["admin"])).toBe(true);
    expect(canRollbackWith("success", ["staff"], ["admin"])).toBe(false);
  });

  it("許可ロールを指定しなければ、状態だけで判断する", () => {
    expect(canRollbackWith("success", ["staff"])).toBe(true);
  });
});
