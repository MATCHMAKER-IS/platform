/**
 * **記録に無い名前を、その場でソースから確かめる。**
 *
 * `docs/platform/api-surface.json` は生成物なので、
 * export を足した直後は載っていない。
 * それを見るだけの検査は「実装したのに無いと言われる」状態になり、
 * `api-surface.mjs --update` を思い出すまで時間を取られる
 * (2026-08 に実際に踏んだ)。
 *
 * **記録を捨てるのではなく、外れたときだけソースを見る。**
 * 毎回すべてのパッケージを走査すると遅くなるため。
 * @packageDocumentation
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectPackageSurface } from "./package-surface.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** 1 度読んだら覚える(同じパッケージを何度も走査しない)。 */
const cache = new Map();

/**
 * パッケージが実際に export しているか。
 *
 * @param pkg `@platform/net` のようなパッケージ名
 * @param name 探す名前
 * @returns export していれば true
 *
 * @example
 * ```js
 * if (!recorded.includes(name) && !livePackageHas(pkg, name)) {
 *   issues.push(`${pkg} に ${name} はありません`);
 * }
 * ```
 */
export function livePackageHas(pkg, name) {
  if (!pkg.startsWith("@platform/")) return false;
  if (!cache.has(pkg)) {
    const dir = path.join(ROOT, "packages", pkg.slice("@platform/".length));
    try {
      const pkgJson = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8"));
      const s = collectPackageSurface(dir, pkgJson);
      // **`names` は Set とは限らない。** 配列で返る実装もある
      const names = s === null ? [] : s.names;
      cache.set(pkg, new Set(names instanceof Set ? [...names] : (names ?? [])));
    } catch {
      cache.set(pkg, new Set());
    }
  }
  return cache.get(pkg).has(name);
}
