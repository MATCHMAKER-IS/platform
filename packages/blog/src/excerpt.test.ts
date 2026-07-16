import { describe, it, expect } from "vitest";
import { stripMarkdown, excerpt } from "./excerpt";
describe("excerpt", () => {
  it("strips markdown", () => {
    const md = "# 見出し\n\nこれは**本文**です。[リンク](http://x.com)や`code`を含む。\n\n```js\nconst a=1;\n```";
    const t = stripMarkdown(md);
    expect(t).toContain("これは本文です");
    expect(t).not.toContain("**");
    expect(t).not.toContain("const a");
  });
  it("truncates", () => {
    expect(excerpt("短い本文")).toBe("短い本文");
    const long = "これは長い本文です。".repeat(20);
    expect(excerpt(long, { maxLength: 30 }).endsWith("…")).toBe(true);
    expect(excerpt("The quick brown fox jumps over the lazy dog runs fast", { maxLength: 20 }).endsWith("…")).toBe(true);
  });
});
