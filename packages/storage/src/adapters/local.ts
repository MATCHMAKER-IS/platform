/**
 * ローカルディスク用 Storage Adapter。
 * ルートディレクトリ配下にキーをパスとして保存する。開発・小規模運用向け。
 * @packageDocumentation
 */
import { promises as fs } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import type { StorageAdapter, PutOptions } from "../index.js";

/**
 * ローカルディスク Adapter を作る。
 * @param root 保存ルートディレクトリ(例: "./uploads")
 * @returns {@link StorageAdapter} 実装
 */
export function createLocalStorage(root: string): StorageAdapter {
  const resolve = (key: string) => join(root, key);
  return {
    async put(key: string, body: Uint8Array, _options?: PutOptions) {
      const path = resolve(key);
      await fs.mkdir(dirname(path), { recursive: true });
      await fs.writeFile(path, body);
    },
    async get(key: string) {
      return new Uint8Array(await fs.readFile(resolve(key)));
    },
    async delete(key: string) {
      await fs.rm(resolve(key), { force: true });
    },
    async exists(key: string) {
      try {
        await fs.access(resolve(key));
        return true;
      } catch {
        return false;
      }
    },
    async list(prefix = "") {
      const base = resolve(prefix);
      const out: string[] = [];
      async function walk(dir: string) {
        let entries: Awaited<ReturnType<typeof fs.readdir>>;
        try {
          entries = await fs.readdir(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const e of entries) {
          const full = join(dir, e.name);
          if (e.isDirectory()) await walk(full);
          else out.push(relative(root, full).split(sep).join("/"));
        }
      }
      await walk(base);
      return out;
    },
  };
}
