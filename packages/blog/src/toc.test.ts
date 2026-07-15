import { describe, it, expect } from "vitest";
import { extractHeadings } from "./toc.js";
const doc = "# タイトル\n\n## セクションA\n本文\n\n## セクションB\n\n### 詳細\n\n```\n# コード\n```\n\n## セクションA";
describe("toc", () => {
  it("extracts headings with unique anchors", () => {
    const toc = extractHeadings(doc, { allowUnicode: true });
    expect(toc).toHaveLength(5);
    expect(toc.some((e) => e.text.includes("コード"))).toBe(false);
    expect(toc[0]!.level).toBe(1);
    expect(toc[1]!.slug).toBe("セクションa");
    expect(toc[4]!.slug).toBe("セクションa-2");
    expect(extractHeadings(doc, { maxLevel: 2, allowUnicode: true }).every((e) => e.level <= 2)).toBe(true);
  });
});
