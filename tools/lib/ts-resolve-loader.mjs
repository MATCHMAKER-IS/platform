/**
 * **拡張子なしの相対 import を `.ts` に解決する**モジュールローダー。
 *
 * この基盤は `import { can } from "./rbac"` のように**拡張子を書かない**
 * (481 ファイルがこの形。TypeScript の標準的な書き方で、bundler が解決する)。
 * ところが Node で直接読むと `ERR_MODULE_NOT_FOUND` になる。
 *
 * `check-doc-examples` が TSDoc の例を実行するとき、これが無いと
 * **同じパッケージ内で分割されているだけのファイルが読めない**
 * (`auth/hierarchy.ts` が `./rbac` を読めず、検証対象から漏れていた)。
 *
 * **`@platform/*` の解決はしない。** それは `node_modules` の仕事で、
 * ここで肩代わりすると「手元では通るが本番構成では違う」状態を作る。
 *
 * @packageDocumentation
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * 拡張子なしの相対指定を `.ts` / `.tsx` / `index.ts` の順に探す。
 *
 * @param specifier import に書かれた文字列
 * @param context 親モジュールの情報
 * @param nextResolve 既定の解決処理
 * @returns 解決したモジュールの位置
 */
export async function resolve(specifier, context, nextResolve) {
  // 相対指定で、拡張子が無いものだけを対象にする
  if (specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier) && context.parentURL) {
    const base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
      if (existsSync(candidate)) {
        // **`format` を指定しない。** `"module"` と書くと Node が
        // 「型除去が済んだ JS」として扱い、`.ts` の型注釈で構文エラーになる
        // (`--experimental-strip-types` の処理が飛ばされる)。
        // URL だけ返して、形式の判定は Node に任せる。
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
  }
  return nextResolve(specifier, context);
}
