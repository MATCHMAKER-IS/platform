/**
 * ローカルディスク用 Storage Adapter。
 * ルートディレクトリ配下にキーをパスとして保存する。開発・小規模運用向け。
 * @packageDocumentation
 */
import { promises as fs } from "node:fs";
import { dirname, join, relative, sep, resolve as nodeResolve, isAbsolute as nodeIsAbsolute } from "node:path";
import type { Dirent } from "node:fs";
import type { StorageAdapter, PutOptions } from "../index";

/**
 * ローカルディスク Adapter を作る。
 * @param root 保存ルートディレクトリ(例: "./uploads")
 * @returns {@link StorageAdapter} 実装
 * @throws **保存先の外を指す key** が渡された場合（`../` を含む、絶対パスなど）。
 *   利用者が付けた名前をそのまま key にすると**この経路を踏みます**
 *   ——**key はこちらで作り**、元の名前は別に持ってください
 */
export function createLocalStorage(root: string): StorageAdapter {
  // **root の外へ出るキーを弾く。**
  //
  // `join(root, key)` は `../` をそのまま解決するので、
  // `"../../../etc/passwd"` を渡すと**root の外**を指す。
  // キーは利用者の入力から作られることがあり(ダウンロード API のパラメータ・
  // アップロード時のファイル名)、**root の外を読み書きされる**(2026-08 に対処)。
  //
  // 同じ判定は `@platform/fs` の `isSubPath` にもあるが、
  // **`@platform/storage` は `@platform/fs` に依存しない**(アダプタごとに
  // 必要な依存が違う。S3 版はファイルシステムを使わない)ので自前で持つ。
  //
  // `resolve` して `root` の下にあるかを確かめる。文字列の前方一致だけでは
  // `/var/data` と `/var/data-old` を取り違えるので、**区切り文字まで見る**。
  const rootAbs = nodeResolve(root);
  const resolve = (key: string) => {
    const abs = nodeResolve(rootAbs, key);
    // **`relative` で判定する**(`@platform/fs` の `isSubPath` と同じ形)。
    // `startsWith` だけだと `/var/data` と `/var/data-old` を取り違える。
    // 依存を増やさないため複製しているので、**片方を直したらもう片方も**。
    const rel = relative(rootAbs, abs);
    if (rel !== "" && (rel.startsWith("..") || nodeIsAbsolute(rel))) {
      throw new Error(`保存先の外を指すキーです: ${key}`);
    }
    return abs;
  };
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
        let entries: Dirent[];
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
