#!/usr/bin/env node
/**
 * 使用例のソースを JSON に固める(統合デモサイト用)。
 *
 * **実行時にファイルを読まない**ようにするため。`process.cwd()` は Amplify の SSR で
 * 想定と違う場所を指し、ソースが読めずに画面が壊れる。ビルド時に固めれば確実に動く。
 *
 * 入力: demos/showcase/src/examples/*.ts(取り込んだ使用例のソース)
 * 出力: demos/showcase/src/lib/example-sources.generated.ts
 *
 * 使い方: node tools/gen-example-sources.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC_DIR = path.join(ROOT, "demos/showcase/src/examples");
const OUT = path.join(ROOT, "demos/showcase/src/lib/example-sources.generated.ts");

/** 先頭の packageDocumentation を落とす(画面には要点だけ出す)。 */
function stripPackageDoc(source) {
  return source.replace(/^\/\*\*[\s\S]*?@packageDocumentation[\s\S]*?\*\/\n*/, "").trim();
}

/** 生成する。 */
export function generate() {
  const files = readdirSync(SRC_DIR).filter((f) => /\.tsx?$/.test(f));
  const entries = {};
  for (const f of files) {
    const key = f.replace(/\.tsx?$/, "");
    entries[key] = stripPackageDoc(readFileSync(path.join(SRC_DIR, f), "utf8"));
  }

  const body = Object.entries(entries)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    .join("\n");

  const content = `/**
 * 使用例のソース(自動生成・手で編集しない)。
 *
 * **実行時にファイルを読まない**ため、ビルド時に固めてある。
 * \`process.cwd()\` は Amplify の SSR で想定と違う場所を指すので、
 * ファイル I/O に頼ると画面が壊れる。
 *
 * 再生成: \`node tools/gen-example-sources.mjs\`(\`pnpm gen:all\` に含まれる)
 *
 * @packageDocumentation
 */

/** 使用例の名前 → ソースコード。 */
export const EXAMPLE_SOURCES: Record<string, string> = {
${body}
};
`;
  writeFileSync(OUT, content);
  return { count: files.length, out: OUT };
}

const { count, out } = generate();
console.log(`✅ ${path.relative(ROOT, out)} 生成(${count} ファイル)`);
