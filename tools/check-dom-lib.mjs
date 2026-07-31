/**
 * **DOM の型を使っているのに tsconfig の `lib` に DOM が無い**パッケージを検出する。
 *   node tools/check-dom-lib.mjs
 *
 * 【なぜ必要か】
 * 共通設定(`tsconfig.base.json`)の `lib` は `["ES2022"]` で、**DOM を含まない**。
 * サーバ側で動く部品にブラウザの型を混ぜないための方針だが、
 * `BlobPart` や `HTMLElement` のような DOM 固有の型を書くと
 * `TS2304: Cannot find name 'BlobPart'` で**ビルドだけが落ちる**。
 *
 * 厄介なのは**テストが通ること**。vitest は型を見ないので、
 * 1,447 件のテストが全部緑でも `tsc` で落ちる。`pnpm test` では気づけない。
 *
 * **自分の tsconfig に DOM があっても安全ではない。** このリポジトリはパッケージ間で
 * **ソースを直接 import** するため、`@platform/integrations`(DOM あり)を
 * `@platform/ekyc`(DOM なし)が使うと、**ekyc の設定で integrations が型検査され**、
 * `TS2304` で ekyc のビルドが落ちる。
 * つまり **DOM 無しのパッケージから使われうる場所には DOM の型を書けない**。
 *
 * 2026-07 に `@platform/image`(自分が DOM 無し)と
 * `@platform/integrations`(利用側が DOM 無し)の両方で踏んだ。
 *
 * 【直し方】
 * - サーバ側の部品なら、**DOM の型を使わない**書き方にする
 *   (`new Blob([uint8Array])` は `BlobPart` へのキャスト無しで通る)
 * - ブラウザ側の部品なら、そのパッケージの tsconfig に `"lib": ["ES2022", "DOM"]` を足す
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { collectFiles } from "./lib/collect-files.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * DOM にしか無い型。**Node のグローバルにあるものは含めない**
 * (`Blob` `FormData` `Response` `URL` などは Node 18+ にあるので DOM は不要)。
 */
const DOM_ONLY_TYPES = [
  // fetch まわり。**実際に踏んだもの**(値としては Node にあるが、型名は DOM 側)
  "BodyInit", "RequestInit", "ResponseInit", "BlobPart", "BufferSource", "HeadersInit",
  // 要素・イベント
  "HTMLElement", "HTMLInputElement", "HTMLDivElement", "HTMLCanvasElement", "HTMLImageElement",
  "Window", "Document", "NodeList", "ShadowRoot",
  "MouseEvent", "KeyboardEvent", "PointerEvent", "TouchEvent", "DragEvent", "FocusEvent",
  "IntersectionObserver", "ResizeObserver", "MutationObserver",
];

/** そのパッケージの tsconfig が DOM を含むか(継承先も見る)。 */
function hasDomLib(pkgDir) {
  const tsconfigPath = path.join(pkgDir, "tsconfig.json");
  if (!existsSync(tsconfigPath)) return true; // 判定できないものは対象外にする
  let text = readFileSync(tsconfigPath, "utf8");
  // コメント付き JSON でも読めるように最小限だけ落とす
  text = text.replace(/^\s*\/\/.*$/gm, "");
  let config;
  try {
    config = JSON.parse(text);
  } catch {
    return true; // 読めないものは判定しない
  }
  const lib = config.compilerOptions?.lib;
  if (Array.isArray(lib)) return lib.some((l) => String(l).toUpperCase().startsWith("DOM"));
  return false; // 指定が無ければ共通設定(ES2022 のみ)を継承
}

const problems = [];
const pkgRoot = path.join(ROOT, "packages");
const names = existsSync(pkgRoot) ? readdirSync(pkgRoot).filter((n) => existsSync(path.join(pkgRoot, n, "src"))) : [];

/** そのパッケージを import している利用側(依存元)を集める。 */
const consumers = new Map(names.map((n) => [n, []]));
for (const n of names) {
  const pkgPath = path.join(pkgRoot, n, "package.json");
  if (!existsSync(pkgPath)) continue;
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
    const m = /^@platform\/([a-z0-9-]+)$/.exec(dep);
    if (m && consumers.has(m[1])) consumers.get(m[1]).push(n);
  }
}

for (const name of names) {
  const dir = path.join(pkgRoot, name);
  // 自分に DOM があっても、**DOM 無しの利用側から使われるなら書けない**
  const selfHasDom = hasDomLib(dir);
  const domlessConsumers = (consumers.get(name) ?? []).filter((c) => !hasDomLib(path.join(pkgRoot, c)));
  if (selfHasDom && domlessConsumers.length === 0) continue;
  const reason = selfHasDom
    ? `DOM 無しの利用側から使われています(${domlessConsumers.slice(0, 3).join(", ")}${domlessConsumers.length > 3 ? " ほか" : ""})`
    : "このパッケージの lib に DOM がありません";

  // .tsx は React の型が入るので対象外。.ts だけを見る
  const files = collectFiles([`packages/${name}/src`], ROOT, { extensions: [".ts"] })
    .filter((f) => !f.includes(".test."));

  for (const rel of files) {
    const lines = readFileSync(path.join(ROOT, rel), "utf8").split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? "";
      // コメント行は対象外(「使わない」と書いた注意書きが引っかかる)
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
      for (const t of DOM_ONLY_TYPES) {
        if (new RegExp(`\\b${t}\\b`).test(line)) {
          problems.push({ rel, line: i + 1, type: t, text: line.trim().slice(0, 70), reason });
        }
      }
    }
  }
}

if (problems.length > 0) {
  console.error(
    `❌ DOM の型を使っているのに tsconfig の lib に DOM がありません(${problems.length} 件)。` +
    "\n   **テストは通るのに `tsc` だけが落ちます**(vitest は型を見ないため)。",
  );
  for (const p of problems) {
    console.error(`   ${p.rel}:${p.line}  ${p.type} — ${p.reason}`);
    console.error(`     ${p.text}`);
  }
  console.error(
    "\n   直し方: DOM の型名を使わない書き方にする" +
    "\n     ・new Blob([new Uint8Array(bytes)]) … BlobPart の代わり。" +
    "\n       **`new Uint8Array(x)` で包むこと**。TypeScript 5.7 以降 Uint8Array は" +
    "\n       裏付けバッファの型でジェネリックになり、DOM 側は ArrayBuffer 裏付けを" +
    "\n       要求するため、そのまま渡すと TS2322 になる" +
    "\n     ・FormData | string                 … BodyInit の代わり" +
    "\n     ・Parameters<typeof fetch>[1]       … RequestInit の代わり" +
    "\n   利用側も含めてブラウザ専用なら、各 tsconfig に \"lib\": [\"ES2022\", \"DOM\"] を足す",
  );
  process.exitCode = 1;
} else {
  console.log("✅ DOM の型と tsconfig の lib は整合しています");
}
