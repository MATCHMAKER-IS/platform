/**
 * ファイル走査の共通処理(**OS 非依存**)。
 *
 * 【なぜ必要か】
 * 検査ツールは `execSync("find ...")` でファイルを集めていた。これは Unix の `find` 前提で、
 * **Windows では別のコマンド**(`C:\Windows\System32\find.exe` = 文字列検索ツール)が起動し、
 * `FIND: パラメーターが違います` で落ちる。
 *
 * この基盤は Windows での開発を明示的に支援している(`scripts/setup.ps1`・
 * `docs/ops/GETTING_STARTED.md`・`check-win-setup`)にもかかわらず、
 * **`preflight` の一部が Windows では一度も動いていなかった**。
 * 「動かないことに気づけない」型なので、共通処理として Node だけで書き直す。
 *
 * `readdirSync` で自前に歩けば外部コマンドに依存せず、結果も OS で変わらない。
 * @packageDocumentation
 */
import { readdirSync, existsSync } from "node:fs";
import path from "node:path";

/** 走査から常に外すディレクトリ(生成物・依存)。 */
const ALWAYS_SKIP = new Set(["node_modules", ".next", ".turbo", "dist", ".git", "coverage"]);

/**
 * 走査の条件。
 *
 * @typedef {object} CollectOptions
 * @property {string[]} [extensions] 拾う拡張子(`.ts` のようにドット付き)。省略すると全ファイル
 * @property {number}   [maxDepth]   何段まで潜るか(起点を 1 とする)。省略すると無制限
 * @property {string[]} [skipDirs]   追加で無視するディレクトリ名
 * @property {boolean}  [includeHidden] 隠しディレクトリ(`.` 始まり)も対象にするか(既定 false)
 */

/**
 * ディレクトリ配下のファイルを集める。
 *
 * **`find` コマンドの置き換え。** 返すパスは常に `/` 区切りの相対パスにする
 * (Windows の `\` が混ざると、検査結果の文字列比較や上限ファイルの記録が
 * OS によって食い違うため)。
 *
 * @param {string[]} roots 起点(リポジトリルートからの相対パス)
 * @param {string} baseDir リポジトリルート
 * @param {CollectOptions} [options] 拡張子・深さ・除外
 * @returns {string[]} 相対パスの配列(**存在しない起点は黙って飛ばす**)
 *
 * @example
 * ```js
 * const files = collectFiles(["packages", "apps"], ROOT, { extensions: [".ts", ".tsx"] });
 * ```
 */
export function collectFiles(roots, baseDir, options = {}) {
  const exts = options.extensions;
  const skip = new Set([...ALWAYS_SKIP, ...(options.skipDirs ?? [])]);
  const out = [];

  const walk = (absDir, relDir, depth) => {
    let entries;
    try {
      entries = readdirSync(absDir, { withFileTypes: true });
    } catch {
      return; // 読めないものは黙って飛ばす(権限・壊れたリンク)
    }
    for (const entry of entries) {
      if (skip.has(entry.name)) continue;
      if (!options.includeHidden && entry.name.startsWith(".")) continue;
      const abs = path.join(absDir, entry.name);
      const rel = relDir === "" ? entry.name : `${relDir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (options.maxDepth !== undefined && depth >= options.maxDepth) continue;
        walk(abs, rel, depth + 1);
      } else if (!exts || exts.some((e) => entry.name.endsWith(e))) {
        out.push(rel);
      }
    }
  };

  for (const root of roots) {
    const abs = root === "." ? baseDir : path.join(baseDir, root);
    if (!existsSync(abs)) continue;
    walk(abs, root === "." ? "" : root, 1);
  }
  return out.sort();
}
