/**
 * パッケージの公開 API(export 名)を、**package.json `exports` に載っている
 * 入口すべて**から集める。
 *
 * `tools/api-surface.mjs`(記録と破壊的変更の検出)と
 * `tools/check-imports.mjs`(存在しない名前の取り込み検出)が同じ判定を使う。
 * **別々に実装すると必ずずれる**ため、ここに 1 つだけ置く。
 *
 * 【なぜ index.ts だけでは足りないか】
 * `@platform/db/tunnel` のように、バレル(`src/index.ts`)から再 export
 * **しない**サブパスがある。node 依存をバレルに引き込ませない
 * (`@platform/db/tunnel`)、ブラウザから使える部分だけを切り出す
 * (`@platform/fs/magic`)といった理由があり、意図的な設計。
 *
 * 入口の正解は package.json の `exports` が持っているので、そこから辿る。
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

const EXPORT_DECL = /export\s+(?:async\s+)?(?:function|const|class|interface|type|enum)\s+([A-Za-z0-9_$]+)/g;
// `export { a, b }` と `export type { A, B }` の両方を拾う。
// type を落とすと、型だけを外に出しているパッケージ(theme など)の記録が空になる。
const EXPORT_NAMED = /export\s+(?:type\s+)?\{([^}]*)\}/g;

/**
 * ソースから export 名を抽出する(re-export の `X as Y` は Y を採用)。
 *
 * @param src ソースコード
 * @returns export されている名前(昇順)
 */
export function extractExports(src) {
  const names = new Set();
  for (const m of src.matchAll(EXPORT_DECL)) names.add(m[1]);
  for (const m of src.matchAll(EXPORT_NAMED)) {
    for (const part of m[1].split(",")) {
      const token = part.trim().replace(/^type\s+/, "");
      if (!token) continue;
      const asMatch = token.split(/\s+as\s+/);
      const name = (asMatch[1] ?? asMatch[0]).trim();
      if (/^[A-Za-z0-9_$]+$/.test(name)) names.add(name);
    }
  }
  return [...names].sort();
}

/**
 * package.json の `exports` から、TypeScript の入口ファイルを取り出す。
 *
 * `.css` や `.json`、ビルド設定の `.mjs` は API を持たないので外す。
 * 条件付き exports(`{ "import": "…", "default": "…" }`)にも備える。
 *
 * @param pkgDir パッケージのディレクトリ(絶対パス)
 * @param pkgJson 読み込み済みの package.json
 * @returns 入口ファイルの絶対パス(存在するものだけ)
 */
export function entryPointFiles(pkgDir, pkgJson) {
  const field = pkgJson.exports;
  // exports を書いていない古い形。従来どおり src/index.ts を見る
  if (field === undefined) return [join(pkgDir, "src/index.ts")].filter((p) => existsSync(p));

  const values = typeof field === "string"
    ? [field]
    : Object.values(field).map((v) =>
        typeof v === "string" ? v : (v?.default ?? v?.import ?? v?.types));

  return values
    .filter((v) => typeof v === "string" && /\.tsx?$/.test(v))
    .map((v) => join(pkgDir, v))
    .filter((p) => existsSync(p));
}

/**
 * パッケージの公開 API を集める。
 *
 * @param pkgDir パッケージのディレクトリ(絶対パス)
 * @param pkgJson 読み込み済みの package.json
 * @returns `names` は export 名(昇順)。`complete` は**名前を数え切れたか**。
 *   入口が 1 つも無ければ `null`(`@platform/config` のようにランタイム
 *   コードを持たないパッケージ)。
 *
 * @example
 * ```js
 * const s = collectPackageSurface(dir, pkgJson);
 * if (s?.complete === false) {
 *   // 外部パッケージを丸ごと再 export しているので、名前の検査はできない
 * }
 * ```
 */
export function collectPackageSurface(pkgDir, pkgJson) {
  const entries = entryPointFiles(pkgDir, pkgJson);
  if (entries.length === 0) return null;

  const seen = new Set();
  const names = new Set();
  // `export * from "lucide-react"` のように**外部を丸ごと**再 export していると、
  // その先の名前はここでは分からない。数え漏れを「無い」と誤解しないよう旗を立てる
  // (@platform/ui/icons が該当。これを見落とすと、実在する import を
  //  「存在しない」と誤検知する)。
  let complete = true;

  function walk(filePath) {
    if (seen.has(filePath) || !existsSync(filePath)) return;
    seen.add(filePath);
    const src = readFileSync(filePath, "utf8");
    for (const n of extractExports(src)) names.add(n);

    for (const m of src.matchAll(/export\s+\*\s+from\s+["']([^"']+)["']/g)) {
      if (!m[1].startsWith(".")) { complete = false; continue; }
      // 拡張子は付いていないのが既定(moduleResolution: Bundler)。
      // 古いコードが .js を付けている場合にも備える。
      const stem = m[1].replace(/\.js$/, "");
      // 相対パスは**そのファイルのある場所**から解決する。
      // src/ 起点で解決すると、入れ子(src/core/index.ts の "./datacenter")を辿れず、
      // その配下の export がすべて記録から漏れる(実際に @platform/zoho で起きていた)。
      const fromDir = dirname(filePath);
      for (const cand of [`${stem}.ts`, `${stem}.tsx`, `${stem}/index.ts`]) {
        const p = join(fromDir, cand);
        if (existsSync(p)) { walk(p); break; }
      }
    }
  }

  // seen / names は入口をまたいで共有する。
  // バレルとサブパスが同じファイルを再 export していても二重に数えない
  for (const entry of entries) walk(entry);

  return { names: [...names].sort(), complete };
}
