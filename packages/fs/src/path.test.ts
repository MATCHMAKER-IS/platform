import { describe, it, expect } from "vitest";
import * as nodePath from "node:path";
import { joinPath, withoutExt, splitExt, changeExt, sanitizeFilename, uniqueFilename, isSubPath, guessMimeType } from "./path";

describe("path utils", () => {
  it("join/withoutExt/splitExt", () => {
    // joinPath は node:path なので**区切り文字は OS 依存**(Windows は \)。
    // 区切りを直接期待すると、CI(Linux)は通るのに開発機(Windows)で落ちる。
    expect(joinPath("a", "b.txt")).toBe(nodePath.join("a", "b.txt"));
    expect(joinPath("a", "b.txt").endsWith("b.txt")).toBe(true);
    expect(withoutExt("a/r.tar.gz")).toBe("a/r.tar");
    expect(splitExt("r.csv")).toEqual({ name: "r", ext: "csv" });
  });
  it("changeExt", () => { expect(changeExt("a/r.csv", "xlsx")).toBe("a/r.xlsx"); expect(changeExt("a/r.csv", ".json")).toBe("a/r.json"); });
  it("sanitizeFilename", () => { expect(sanitizeFilename("a/b:c*?.txt")).toBe("a_b_c__.txt"); expect(sanitizeFilename("  ..name..  ")).toBe("name"); expect(sanitizeFilename("CON.txt")).toBe("_CON.txt"); expect(sanitizeFilename("")).toBe("untitled"); });
  it("uniqueFilename", () => { expect(uniqueFilename("r.csv", ["r.csv"])).toBe("r (1).csv"); expect(uniqueFilename("r.csv", ["r.csv", "r (1).csv"])).toBe("r (2).csv"); });
  it("isSubPath", () => { expect(isSubPath("/data", "/data/x/y.txt")).toBe(true); expect(isSubPath("/data", "/data/../etc")).toBe(false); });
  it("guessMimeType", () => { expect(guessMimeType("a.CSV")).toBe("text/csv"); expect(guessMimeType("a.bin")).toBe("application/octet-stream"); });
});
