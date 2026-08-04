#!/usr/bin/env node
/**
 * パッケージ雛形の生成(scaffold)。基盤の規約に沿った新パッケージの骨格を作る。
 * 使い方: node tools/scaffold.mjs <name> ["<summary>"]
 *   例: node tools/scaffold.mjs shipping "配送(送り状・追跡)"
 * 属人化・ブラックボックス化を防ぐため、雛形を統一する。
 */
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const name = process.argv[2];
const summary = process.argv[3] ?? `${name} パッケージ`;
if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error("使い方: node tools/scaffold.mjs <name(小文字英数-)> [\"<summary>\"]");
  process.exit(1);
}

const pkgDir = join(root, "packages", name);
const scope = `@platform/${name}`;

async function exists(p) { try { await access(p); return true; } catch { return false; } }

async function main() {
  if (await exists(pkgDir)) {
    console.error(`✗ ${scope} は既に存在します: ${pkgDir}`);
    process.exit(1);
  }
  await mkdir(join(pkgDir, "src"), { recursive: true });

  const files = {
    "package.json": JSON.stringify({
      name: scope, version: "0.1.0", private: true, type: "module",
      main: "./src/index.ts", types: "./src/index.ts", exports: { ".": "./src/index.ts" },
      scripts: { build: "tsc -p tsconfig.json", typecheck: "tsc -p tsconfig.json --noEmit", lint: "eslint src", test: "vitest run" },
      devDependencies: { "@platform/config": "workspace:*", typescript: "^5.7.3" },
    }, null, 2) + "\n",
    // 共通のカバレッジ閾値を効かせる(check-package-shape が存在を検査する)
    "vitest.config.ts": 'import { basePreset } from "@platform/config/vitest";\nexport default basePreset;\n',
    "tsconfig.json": JSON.stringify({
      extends: "../../tsconfig.base.json",
      compilerOptions: { rootDir: "src", outDir: "dist" }, include: ["src"],
      // **テストはビルド対象から外す。** 入れると dist にテストが出て、
      // smoke の「全パッケージの tsconfig がテストを exclude」が落ちる
      exclude: ["**/*.test.ts", "**/*.test.tsx"],
    }, null, 2) + "\n",
    "src/index.ts": `/**\n * \`${scope}\` — ${summary}\n * @packageDocumentation\n */\nexport * from "./${name}";\n`,
    [`src/${name}.ts`]: `/**\n * ${summary}(純ロジック）。\n * @packageDocumentation\n */\n\n/**\n * 例: 何かを計算する。\n *\n * **TSDoc は必ず書く**(このコメントを書き換えて使う)。型だけでは「何を渡すのか」\n * 「何が返るのか」が分からず、リファレンスサイト(pnpm site)にも出ない。\n *\n * @param input 入力値(何を渡すのかを書く。「数値」とは書かない。型で分かるため)\n * @returns 何が返るのか(void 以外なら必ず書く)\n */\nexport function placeholder(input: number): number {\n  return input;\n}\n`,
    [`src/${name}.test.ts`]: `import { describe, it, expect } from "vitest";\nimport { placeholder } from "./${name}";\n\ndescribe("${name}", () => {\n  it("works", () => {\n    expect(placeholder(1)).toBe(1);\n  });\n});\n`,
    "README.md": `# ${scope} — ${summary}\n\n（ここに概要とAPIを書く）\n\n## 方針\n- ロジックは基盤（この package）に置き、アプリはこれを組み合わせるだけにする。\n- 外部 I/O は注入可能にし、純ロジックは副作用なしでテスト可能に保つ。\n`,
  };

  for (const [rel, content] of Object.entries(files)) {
    await writeFile(join(pkgDir, rel), content);
  }

  console.log(`✅ ${scope} を生成しました: packages/${name}/`);

  // **生成した直後に検査を流す。**
  // 2026-08 に、雛形そのものが規約違反のコードを吐いていたことが分かった:
  //   - `export * from "./x.js"` … 相対 import の拡張子。tsc は通るが next build だけが落ちる
  //   - tsconfig に exclude が無い … テストがビルド対象に入り smoke が落ちる
  // どちらも**新しい部品を作るたびに必ず踏む**もので、しかも
  // 「作った人が悪い」ように見えるため原因に辿り着きにくい。
  // 雛形が規約を満たすことは、下流すべてに効くので機械で保証する。
  const failed = await verifyGenerated(name);
  if (failed.length > 0) {
    console.error("\n❌ 生成物が規約に違反しています(**雛形のバグ**です)。");
    for (const f of failed) console.error(`   - ${f}`);
    console.error(`\n   生成物は残してあります: packages/${name}/`);
    console.error("   tools/scaffold.mjs の雛形を直してから、作り直してください。");
    process.exit(1);
  }
  console.log("   ✅ 生成物は規約を満たしています(build-ready / package-shape)");

  console.log("   次の手順:");
  console.log(`   1. packages/${name}/src/${name}.ts に実装`);
  console.log(`   2. node --experimental-strip-types で動作確認 → tsc で型チェック`);
  console.log(`   3. tools/smoke.mjs にスモーク追加、docs/platform/capabilities.json に登録`);
  console.log(`   4. tools/package-categories.mjs にカテゴリを登録(未分類だと module-list に出ない)`);
  console.log(`   5. node tools/check-deps.mjs で循環依存・層破りを確認`);
}

/**
 * 生成したパッケージが規約を満たすかを、既存の検査で確かめる。
 *
 * 検査は**リポジトリ全体**を見るものなので、出力に対象パッケージ名が
 * 含まれる行だけを拾う(他所の既存の違反を、雛形のせいにしないため)。
 *
 * @param name パッケージ名(ディレクトリ名)
 * @returns 違反の説明。空なら問題なし
 */
async function verifyGenerated(name) {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const run = promisify(execFile);
  const found = [];
  for (const tool of ["check-build-ready.mjs", "check-package-shape.mjs"]) {
    let out = "";
    try {
      const r = await run(process.execPath, [join(root, "tools", tool)], { cwd: root });
      out = `${r.stdout}${r.stderr}`;
    } catch (e) {
      // 検査が失敗すると非ゼロで終わる。出力は e に入る
      out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
    }
    for (const line of out.split("\n")) {
      if (line.includes(`packages/${name}/`) && /❌|⚠/.test(line)) found.push(line.trim());
    }
  }
  return found;
}

main();
