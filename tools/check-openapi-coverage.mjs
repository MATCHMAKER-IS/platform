#!/usr/bin/env node
/**
 * **別のアプリから叩ける API が、OpenAPI に宣言されているか**を見る(上限ラチェット)。
 *
 * ```bash
 * node tools/check-openapi-coverage.mjs
 * node tools/check-openapi-coverage.mjs --list       # 宣言していない API の一覧
 * node tools/check-openapi-coverage.mjs --set-limit  # いまの数を上限に刻む
 * ```
 *
 * 【なぜ要るか】
 * アプリは別リポジトリなので、**TypeScript の型を直接 import できません**
 * (ADR 0021)。呼ぶ側は形を**手で書き写す**ことになり、**必ずずれます**。
 *
 * `defineRoute` で宣言すれば OpenAPI に載り、呼ぶ側は
 * **型付きクライアントを生成**できます。ただし——
 *
 * > **宣言し忘れても、API は動きます。**
 *
 * 動くので、忘れたことに気づけません。気づくのは
 * **別のアプリが叩こうとしたとき**で、そのときには相手を待たせています。
 *
 * 【全部を宣言しろとは言いません】
 * **画面専用の API**(その画面からしか呼ばれない)まで載せると、
 * 一覧が大きくなって**本当に使ってよいものが埋もれます**。
 *
 * そこで**上限ラチェット**にしてあります——
 * **いまの「未宣言」の数を上限に刻み、増えたら落とす**。
 * 新しい API を足すときに「これは外から叩くか」を一度考える、という仕掛けです。
 * 外から叩かないと決めたなら、`--set-limit` で上限を上げて構いません
 * (**PR に理由を書いてから**)。
 *
 * 【数え方】
 * `apps/<アプリ>/src/app/api/**\/route.ts` を数え、
 * そのうち `defineRoute` を含まないものを「未宣言」とします。
 *
 * 実行: node tools/check-openapi-coverage.mjs
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIMIT_FILE = path.join(ROOT, "tools", "openapi-coverage-limit.json");

const list = process.argv.includes("--list");
const setLimit = process.argv.includes("--set-limit");

/** ルートハンドラを集める。 */
function collectRoutes(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) collectRoutes(full, out);
    else if (e.name === "route.ts" || e.name === "route.tsx") out.push(full);
  }
  return out;
}

const appsDir = path.join(ROOT, "apps");
const apps = existsSync(appsDir)
  ? readdirSync(appsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
  : [];

const undeclared = [];
let total = 0;

for (const app of apps) {
  const apiDir = path.join(appsDir, app, "src", "app", "api");
  for (const file of collectRoutes(apiDir)) {
    total += 1;
    const body = readFileSync(file, "utf8");
    // **隣の `spec.ts` も見る。** App Router のルートは決まった名前しか
    // export できないので、宣言は同じフォルダの `spec.ts` に置いてある
    // (Next 15 で `export const spec` が型検査に落ちたため。2026-08)
    const specFile = path.join(path.dirname(file), "spec.ts");
    const declared = body.includes("defineRoute")
      || (existsSync(specFile) && readFileSync(specFile, "utf8").includes("defineRoute"));
    if (declared) continue;
    const rel = path.relative(ROOT, file).split(path.sep).join("/");
    undeclared.push(rel);
  }
}

if (total === 0) {
  console.log("⏭  check-openapi-coverage は skip しました(API ルートがありません)");
  process.exit(0);
}

undeclared.sort();

if (list) {
  console.log(`宣言していない API(${undeclared.length} / ${total} 本):`);
  for (const u of undeclared) console.log(`  ${u}`);
  console.log("");
  console.log("**全部を宣言する必要はありません。** 画面専用の API は載せない方が、");
  console.log("一覧が読みやすくなります。**外から叩くもの**だけ `defineRoute` を足してください。");
  process.exit(0);
}

if (setLimit) {
  const next = {
    note:
      "OpenAPI に宣言していない API の上限。**増やす方向に手で書き換えないこと。**"
      + "新しい API を足すときに「これは別のアプリから叩くか」を一度考えるための上限で、"
      + "外から叩かないと決めたなら PR に理由を書いてから --set-limit で刻む。",
    maxUndeclared: undeclared.length,
    total,
  };
  writeFileSync(LIMIT_FILE, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  console.log(`✅ 上限を刻みました: 未宣言 ${undeclared.length} / 全 ${total} 本`);
  process.exit(0);
}

if (!existsSync(LIMIT_FILE)) {
  console.log(`⏭  check-openapi-coverage は skip しました(上限が未設定。未宣言 ${undeclared.length} / 全 ${total} 本)`);
  console.log("   `node tools/check-openapi-coverage.mjs --set-limit` で刻んでください");
  process.exit(0);
}

const limit = JSON.parse(readFileSync(LIMIT_FILE, "utf8"));
const max = limit.maxUndeclared ?? 0;

if (undeclared.length <= max) {
  const declared = total - undeclared.length;
  console.log(`✅ OpenAPI の宣言は基準内(宣言済み ${declared} / 全 ${total} 本 / 未宣言の上限 ${max})`);
  process.exit(0);
}

console.error(`❌ OpenAPI に宣言していない API が増えました(${max} → ${undeclared.length} / 全 ${total} 本)`);
console.error("");
console.error("   増えたもの(一覧は --list):");
for (const u of undeclared.slice(0, 10)) console.error(`     ${u}`);
if (undeclared.length > 10) console.error(`     …ほか ${undeclared.length - 10} 件`);
console.error("");
console.error("   **別のアプリから叩く API なら**、ハンドラと同じファイルに宣言を足してください:");
console.error("     export const spec = defineRoute({ method: \"post\", path: \"/api/…\", summary: \"…\" });");
console.error("     → apps/<アプリ>/src/server/api-spec.ts の routes に 1 行足す");
console.error("");
console.error("   **画面専用で、外から叩かないと決めたなら**、理由を PR に書いてから:");
console.error("     node tools/check-openapi-coverage.mjs --set-limit");
process.exit(1);
