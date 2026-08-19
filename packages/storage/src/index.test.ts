import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStorage, createLocalStorage } from "./index";

describe("storage (local adapter)", () => {
  let root: string;

  beforeAll(async () => {
    root = await fs.mkdtemp(join(tmpdir(), "storage-test-"));
  });
  afterAll(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("put→get→exists→list→delete が動く", async () => {
    const storage = createStorage(createLocalStorage(root));
    const bytes = new TextEncoder().encode("hello");

    expect((await storage.put("docs/a.txt", bytes)).ok).toBe(true);

    const got = await storage.get("docs/a.txt");
    expect(got.ok).toBe(true);
    if (got.ok) expect(new TextDecoder().decode(got.value)).toBe("hello");

    const ex = await storage.exists("docs/a.txt");
    expect(ex.ok && ex.value).toBe(true);

    const list = await storage.list("docs");
    expect(list.ok && list.value).toContain("docs/a.txt");

    expect((await storage.delete("docs/a.txt")).ok).toBe(true);
    const ex2 = await storage.exists("docs/a.txt");
    expect(ex2.ok && ex2.value).toBe(false);
  });

  it("存在しないファイルの get は EXTERNAL エラー", async () => {
    const storage = createStorage(createLocalStorage(root));
    const res = await storage.get("nope.txt");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("EXTERNAL");
  });
});

describe("保存先の外を指すキーを弾く", () => {
  const a = createLocalStorage("/tmp/storage-verify");

  // **`join(root, key)` は `../` をそのまま解決する。**
  // キーは利用者の入力から作られることがあり(ダウンロード API のパラメータ・
  // アップロード時のファイル名)、**root の外を読み書きされる**(2026-08 に対処)
  it("上へ抜けるキーで例外", async () => {
    await expect(a.get("../../../etc/passwd")).rejects.toThrow(/保存先の外/);
  });
  it("途中で上へ抜けるキーも弾く", async () => {
    await expect(a.get("sub/../../secret.txt")).rejects.toThrow(/保存先の外/);
  });
  // **正常なキーは通る**(入れ子も可)
  it("入れ子のキーは通る", async () => {
    await a.put("sub/dir/b.txt", new Uint8Array([4]));
    expect((await a.get("sub/dir/b.txt")).length).toBe(1);
  });
});
