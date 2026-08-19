/**
 * **`React` の import が過不足していないか**を検査する。
 *   node tools/check-react-import.mjs
 *
 * 【なぜ必要か】
 * `jsx` の設定で `React` import の必要性が変わる。**同じコードが、パッケージによって
 * エラーになる**ので間違えやすい。
 *
 * | `jsx` | JSX の扱い | `import * as React` |
 * |---|---|---|
 * | `react-jsx`(`packages/ui`) | `react/jsx-runtime` から自動 import | **JSX だけなら不要**。書くと `TS6133`(未使用) |
 * | `preserve`(アプリ・デモ) | TS は変換せず、`React` を参照済みと見なす | 書いても未使用にならない |
 *
 * ただし `react-jsx` でも **`React.ReactNode` のように名前空間を使うなら import が必要**
 * (`TS2686`/`TS2503`)。つまり `react-jsx` のパッケージでは
 * 「使うなら書く・使わないなら書かない」を厳密に守る必要がある。
 *
 * `noUnusedLocals: true` なので**未使用は警告ではなくエラー**。`tsc` でしか出ず、
 * vitest は型を見ないため**テストが全部緑でもビルドが落ちる**。
 *
 * 2026-07 に `packages/ui` で 23 件の未使用と 3 件の不足が同時に見つかった
 * (`turbo run build` が動いていなかったため、誰も気づけなかった)。
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { collectFiles } from "./lib/collect-files.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const IMPORT_RE = /^import \* as React from ["']react["'];$/m;

/** そのパッケージの `jsx` 設定を返す(継承は追わない。指定が無ければ null)。 */
function jsxMode(pkgDir) {
  const t = path.join(pkgDir, "tsconfig.json");
  if (!existsSync(t)) return null;
  try {
    const text = readFileSync(t, "utf8").replace(/^\s*\/\/.*$/gm, "");
    return JSON.parse(text).compilerOptions?.jsx ?? null;
  } catch {
    return null;
  }
}

const problems = [];
let scanned = 0;

for (const group of ["packages", "apps"]) {
  const groupDir = path.join(ROOT, group);
  if (!existsSync(groupDir)) continue;
  for (const rel of collectFiles([group], ROOT, { extensions: [".tsx"] })) {
    scanned += 1;
    const parts = rel.split("/");
    const pkgDir = path.join(ROOT, parts[0] ?? "", parts[1] ?? "");
    const mode = jsxMode(pkgDir);
    // `react-jsx` のときだけ厳密に判定する(`preserve` は未使用にならない)
    if (mode !== "react-jsx") continue;
    if (rel.includes(".test.")) continue;

    const src = readFileSync(path.join(ROOT, rel), "utf8");
    const hasImport = IMPORT_RE.test(src);
    const body = src.replace(IMPORT_RE, "");
    const usesNamespace = /\bReact\s*\./.test(body);

    if (usesNamespace && !hasImport) {
      problems.push({ rel, kind: "不足", hint: '`React.` を使っているので `import * as React from "react";` が必要です' });
    } else if (hasImport && !usesNamespace) {
      problems.push({ rel, kind: "未使用", hint: "JSX だけなら import は不要です(TS6133 になります)" });
    }
  }
}

if (problems.length > 0) {
  const missing = problems.filter((p) => p.kind === "不足").length;
  const unused = problems.filter((p) => p.kind === "未使用").length;
  console.error(
    `❌ React の import が過不足しています(不足 ${missing} 件 / 未使用 ${unused} 件)。` +
    "\n   `jsx: \"react-jsx\"` のパッケージでは**使うなら書く・使わないなら書かない**を守ります。" +
    "\n   **`tsc` でしか出ません**(vitest は型を見ないため、テストが全部緑でも落ちます)。",
  );
  for (const p of problems) console.error(`   [${p.kind}] ${p.rel}\n     ${p.hint}`);
  process.exitCode = 1;
} else {
  console.log(`✅ React の import は過不足ありません(${scanned} ファイルを検査)`);
}
