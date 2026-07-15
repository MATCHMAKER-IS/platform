import { describe, it, expect } from "vitest";
import { readSheet, writeSheet } from "./index.js";

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
