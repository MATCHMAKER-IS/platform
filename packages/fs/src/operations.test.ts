import { describe, it, expect, afterAll } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureDir, writeText, readText, writeJson, readJson, writeFileAtomic, remove, emptyDir, copyDir, move, walk, dirSize, pathExists, listDir } from "./index.js";

const root = join(tmpdir(), `fs-test-${Date.now()}`);
afterAll(() => remove(root));

describe("fs operations", () => {
  it("write/read text + ensureDir parent", async () => { await writeText(join(root, "a/b/c.txt"), "hi"); expect(await readText(join(root, "a/b/c.txt"))).toBe("hi"); });
  it("json", async () => { await writeJson(join(root, "d.json"), { x: 1 }); expect((await readJson<{ x: number }>(join(root, "d.json"))).x).toBe(1); });
  it("atomic", async () => { await writeFileAtomic(join(root, "atom.txt"), "a"); expect(await readText(join(root, "atom.txt"))).toBe("a"); });
  it("copyDir/move/walk/dirSize", async () => {
    await writeText(join(root, "src/one.txt"), "1"); await writeText(join(root, "src/sub/two.txt"), "2");
    await copyDir(join(root, "src"), join(root, "dst"));
    expect(await pathExists(join(root, "dst/sub/two.txt"))).toBe(true);
    expect((await walk(join(root, "src"))).length).toBe(2);
    expect(await dirSize(join(root, "src"))).toBe(2);
    await move(join(root, "dst/one.txt"), join(root, "moved.txt"));
    expect(await pathExists(join(root, "moved.txt"))).toBe(true);
  });
  it("emptyDir keeps dir", async () => { await emptyDir(join(root, "src")); expect(await pathExists(join(root, "src"))).toBe(true); expect((await listDir(join(root, "src"))).length).toBe(0); });
});
