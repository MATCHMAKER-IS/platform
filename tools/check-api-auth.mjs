/**
 * 認可のない API ルートを検出する。
 *
 * API に認可を入れ忘れると、**URL を知っているだけで誰でも叩ける**。
 * 画面に出していなくても、ブラウザの開発者ツールや通信を見れば URL は分かる。
 * 「画面で制御しているから大丈夫」は成立しない。
 *
 * ただし、認可を通さないのが**正しい** API もある(ログイン・CSRF トークン取得・
 * 公開フォームの受付など)。それらは黙って除外せず、ファイル冒頭に理由を書かせる:
 *
 *   // public-api: ログイン前に呼ぶため認可を通さない
 *
 * こうしておくと、後から読んだ人が「抜けているのか、意図なのか」を判断できる。
 *
 * 実行:
 *   node tools/check-api-auth.mjs        … 上限(ラチェット)方式。増えたら失敗
 *   node tools/check-api-auth.mjs --list … 認可も宣言も無いものを一覧表示
 *   node tools/check-api-auth.mjs --set-limit … 減らしたあとに上限を下げる
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIMIT_FILE = new URL("./api-auth-limit.json", import.meta.url);

/** 認可を通していると判断する呼び出し。 */
const AUTH_MARKERS =
  /requirePermission|requireRole|requireSession|currentUser|assertCan\b|requireUser|authenticateKey|requireApiKey|bearerToken/;

/** 「認可を通さないのが正しい」ことの宣言。理由まで書かせる。 */
const PUBLIC_MARK = /\/\/\s*public-api:\s*\S+/;

function collectRoutes(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", "dist"].includes(e.name)) continue;
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) collectRoutes(fp, out);
    else if (e.name === "route.ts" && fp.includes(`${path.sep}api${path.sep}`)) out.push(fp);
  }
  return out;
}

const routes = [
  ...collectRoutes(path.join(ROOT, "apps")),
  ...collectRoutes(path.join(ROOT, "demos")),
];

const missing = [];
let declared = 0;
let guarded = 0;

for (const f of routes) {
  const src = readFileSync(f, "utf8");
  const rel = path.relative(ROOT, f).replace(/\\/g, "/");
  if (AUTH_MARKERS.test(src)) { guarded += 1; continue; }
  if (PUBLIC_MARK.test(src)) { declared += 1; continue; }
  missing.push(rel);
}

function readLimit() {
  try {
    return JSON.parse(readFileSync(LIMIT_FILE, "utf8")).limit ?? Number.MAX_SAFE_INTEGER;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

if (process.argv.includes("--set-limit")) {
  writeFileSync(LIMIT_FILE, `${JSON.stringify({
    _comment: "認可も public-api 宣言も無い API ルートの上限。増やさないための歯止め。減らしたら --set-limit で下げる。",
    limit: missing.length,
    updatedAt: new Date().toISOString().slice(0, 10),
  }, null, 2)}\n`);
  console.log(`✅ 上限を ${missing.length} に更新しました(これ以上は増やせません)`);
  process.exit(0);
}

if (process.argv.includes("--list")) {
  for (const m of missing) console.log(`  ${m}`);
}

const limit = readLimit();
const summary = `API ${routes.length} 本 / 認可あり ${guarded} / 公開宣言あり ${declared} / どちらも無い ${missing.length}`;

if (missing.length > limit) {
  console.log(`❌ 認可も public-api 宣言も無い API が ${missing.length} 本に増えました(上限 ${limit})。`);
  console.log("   認可を入れるか、通さない理由を `// public-api: 理由` として冒頭に書いてください。");
  console.log(`   一覧: node tools/check-api-auth.mjs --list`);
  console.log(`   ${summary}`);
  process.exit(1);
}

if (missing.length > 0) {
  console.log(`⚠ 認可も public-api 宣言も無い API が ${missing.length} 本あります(上限 ${limit})。${summary}`);
  console.log("   一覧: node tools/check-api-auth.mjs --list");
  if (missing.length < limit) console.log(`   ${limit - missing.length} 本減りました。node tools/check-api-auth.mjs --set-limit で上限を下げてください`);
  process.exit(0);
}

console.log(`✅ すべての API が認可を通すか、通さない理由を宣言しています(${summary})`);
process.exit(0);
