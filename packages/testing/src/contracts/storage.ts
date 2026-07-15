/**
 * Storage 実装の契約テスト。
 * @packageDocumentation
 */
import { describe, it, expect } from "vitest";
import type { Storage } from "@platform/storage";

/**
 * Storage の契約テストを実行する。
 * @param name テスト名(実装名)
 * @param makeStorage テスト対象の Storage を生成する関数(毎回新規)
 */
export function runStorageContract(name: string, makeStorage: () => Storage): void {
  describe(`Storage 契約: ${name}`, () => {
    const bytes = new TextEncoder().encode("hello");

    it("put→get で内容が一致する", async () => {
      const s = makeStorage();
      await s.put("a/b.txt", bytes);
      const got = await s.get("a/b.txt");
      expect(got.ok).toBe(true);
      if (got.ok) expect(new TextDecoder().decode(got.value)).toBe("hello");
    });

    it("exists は保存有無を反映する", async () => {
      const s = makeStorage();
      expect((await s.exists("x")).ok && (await s.exists("x")).value ? true : false).toBe(false);
      await s.put("x", bytes);
      const ex = await s.exists("x");
      expect(ex.ok && ex.value).toBe(true);
    });

    it("delete 後は存在しない", async () => {
      const s = makeStorage();
      await s.put("y", bytes);
      await s.delete("y");
      const ex = await s.exists("y");
      expect(ex.ok && ex.value).toBe(false);
    });
  });
}
