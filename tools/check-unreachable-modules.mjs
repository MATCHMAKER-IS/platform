/**
 * **基盤のファイルが、どこからも届かない状態になっていないか**を検査する。
 *   node tools/check-unreachable-modules.mjs
 *   node tools/check-unreachable-modules.mjs --list
 *
 * 【なぜ必要か】
 *
 * 2026-08、`packages/tax/src/stamp-tax.ts`（印紙税。約 300 行・号別判定・
 * 過怠税・電子化の節税額まで実装済み）が **`index.ts` から一度も
 * export されていない**ことが分かった。
 *
 * これは「部品はあるのに使われていない」の中でも**最も気づきにくい形**である:
 *
 *   - アプリから `import { stampTax } from "@platform/tax"` が**型エラーになる**
 *   - `pnpm advisor find "印紙税"` でも**出てこない**（公開 API を見ているため）
 *   - `docs/ai/module-list.md` にも載らない
 *   - **存在自体が見えない**
 *
 * 使われていない部品は「繋げば済む」が、**公開されていない部品は
 * 繋ごうとして初めて気づく**。実際、印紙税の API を書いていて
 * 型エラーが出るまで誰も気づけなかった。
 *
 * `check-package-shape` は tsconfig と scripts の有無しか見ておらず、
 * `check-imports` は「書いた import が実在するか」を見る——
 * **逆向き（実装があるのに出口が無い）を見る検査が無かった。**
 *
 * 【何を「届かない」とみなすか】
 *
 * 次のどれにも当てはまらないファイルを指摘する:
 *
 *   1. `index.ts` から `export * from "./x"` などで再輸出されている
 *   2. 同じパッケージの別ファイルから import されている（内部モジュール）
 *   3. `package.json` の `exports` に subpath として載っている
 *      （`./browser` `./icons` など。**ブラウザ専用の入口はこの形が正しい**）
 *   4. `export` を 1 つも持たない（型だけの断片・定数の下書きなど）
 *
 * 【直し方】
 *
 * **公開するか、消すか、どちらかにすること。**
 * 「そのうち使う」で置いておくと、次の人が同じものを書く。
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PKG_DIR = path.join(ROOT, "packages");

/**
 * 例外（理由を必ず書く）。`<パッケージ>/<ファイル>` で指定する。
 *
 * **「まだ繋いでいない」を理由にしないこと。** それは指摘そのものである。
 */
const ALLOW = {};

/** `src` 直下の実装ファイルを集める（テストと index は除く）。 */
function sourceFiles(srcDir) {
  return readdirSync(srcDir)
    .filter((f) => /\.tsx?$/.test(f))
    .filter((f) => !/\.(test|spec)\.tsx?$/.test(f))
    .filter((f) => f !== "index.ts" && f !== "index.tsx");
}

/** そのファイルが持つ `export` の数。 */
function exportCount(file) {
  return (readFileSync(file, "utf8").match(/^export /gm) ?? []).length;
}

/** `package.json` の `exports` に載っているパスの集合。 */
function subpathTargets(pkgDir) {
  const fp = path.join(pkgDir, "package.json");
  if (!existsSync(fp)) return new Set();
  const pkg = JSON.parse(readFileSync(fp, "utf8"));
  const out = new Set();
  const walk = (v) => {
    if (typeof v === "string") out.add(v.replace(/^\.\//, ""));
    else if (v !== null && typeof v === "object") for (const x of Object.values(v)) walk(x);
  };
  walk(pkg.exports ?? {});
  return out;
}

/** パッケージ内のどこかから import されているか。 */
function importedInside(srcDir, stem) {
  const stack = [srcDir];
  const pattern = new RegExp(`from "\\.{1,2}/(?:[^"]*/)?${stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`);
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { stack.push(p); continue; }
      if (!/\.tsx?$/.test(e.name)) continue;
      if (pattern.test(readFileSync(p, "utf8"))) return true;
    }
  }
  return false;
}

export function check({ list = false } = {}) {
  const unreachable = [];
  let scanned = 0;

  for (const name of readdirSync(PKG_DIR)) {
    const pkgDir = path.join(PKG_DIR, name);
    const srcDir = path.join(pkgDir, "src");
    const indexFile = path.join(srcDir, "index.ts");
    if (!existsSync(indexFile)) continue;
    const index = readFileSync(indexFile, "utf8");
    const subpaths = subpathTargets(pkgDir);

    for (const file of sourceFiles(srcDir)) {
      scanned += 1;
      const stem = file.replace(/\.tsx?$/, "");
      const key = `${name}/${file}`;
      if (key in ALLOW) continue;
      // 1. index から再輸出されている
      if (new RegExp(`from "\\./${stem}"`).test(index)) continue;
      // 3. package.json の exports に載っている（ブラウザ専用の入口など）
      if (subpaths.has(`src/${file}`)) continue;
      // 4. export を持たない
      const exports = exportCount(path.join(srcDir, file));
      if (exports === 0) continue;
      // 2. パッケージ内から import されている（内部モジュール）
      if (importedInside(srcDir, stem)) continue;
      unreachable.push({ pkg: name, file, exports });
    }
  }

  if (list) {
    for (const u of unreachable) {
      console.log(`  packages/${u.pkg}/src/${u.file}  (export ${u.exports} 件)`);
    }
    console.log(`\n(${scanned} ファイルを検査)`);
    return { ok: true };
  }

  if (unreachable.length > 0) {
    console.error(`❌ どこからも届かない実装が ${unreachable.length} 件あります:`);
    for (const u of unreachable) {
      console.error(`   packages/${u.pkg}/src/${u.file}（export ${u.exports} 件）`);
    }
    console.error("");
    console.error("   **アプリから import できず、`pnpm advisor find` でも出てきません。**");
    console.error("   実装があるのに存在自体が見えない状態です（2026-08 の `stamp-tax.ts` がこれでした）。");
    console.error("   → `index.ts` で公開するか、`package.json` の exports に足すか、消してください。");
    return { ok: false };
  }

  console.log(`✅ すべての実装が公開されています(${scanned} ファイルを検査)`);
  return { ok: true };
}

// **`file://${process.argv[1]}` で比べない。** Windows では
// `import.meta.url` が `file:///C:/…`、`process.argv[1]` が `C:\…` になり、
// **一致しないので本体が動かない**(何も出力せず終わる。エラーも出ないので気づけない)。
// 2026-08、`node tools/check-coverage.mjs --set-floor` が Windows で無反応だった。
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = check({ list: process.argv.includes("--list") });
  process.exit(r.ok ? 0 : 1);
}
