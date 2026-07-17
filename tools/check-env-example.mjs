/**
 * .env.example の網羅性チェック(ドリフト防止)。
 * 各アプリのコードが参照する環境変数(env.ts の zod キー + `process.env.X` + `env.X`)を集計し、
 * apps/<app>/.env.example に記載(コメントアウト可)されているかを検査する。
 * 使い方: node tools/check-env-example.mjs   (CI の boundaries でも実行)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const APPS = ["internal-app", "public-site", "crud-template", "equipment-app"];
// フレームワーク由来・例示不要のもの
const IGNORE = new Set(["NODE_ENV", "NEXT_RUNTIME", "CI"]);

function* walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      yield* walk(p);
    } else if (/\.(ts|tsx|mts)$/.test(e.name)) {
      yield p;
    }
  }
}

function collectVars(app) {
  const vars = new Set();
  for (const dir of ["src", "mcp"]) {
    for (const f of walk(path.join(root, "apps", app, dir))) {
      const body = fs.readFileSync(f, "utf8");
      // 直読み(なるべく無くす方針だが、フレームワーク由来などで残る)
      for (const m of body.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) vars.add(m[1]);
      // parseEnv の zod スキーマ / env.X / serverEnv.X / featureEnv.X / siteEnv.X
      for (const m of body.matchAll(/\b(?:env|serverEnv|featureEnv|siteEnv)\.([A-Z][A-Z0-9_]+)/g)) vars.add(m[1]);
      // @platform/env の読み取り口: optionalEnv("X") / requireEnv(["X", "Y"])
      for (const m of body.matchAll(/optionalEnv\(\s*"([A-Z][A-Z0-9_]+)"/g)) vars.add(m[1]);
      for (const m of body.matchAll(/requireEnv\(\s*\[([^\]]*)\]/g)) {
        for (const nm of m[1].matchAll(/"([A-Z][A-Z0-9_]+)"/g)) vars.add(nm[1]);
      }
      // zod スキーマのキー(env.ts の parseEnv(z.object({ KEY: ... })))
      if (/parseEnv\(/.test(body)) {
        for (const m of body.matchAll(/^\s{4}([A-Z][A-Z0-9_]+):\s*z\./gm)) vars.add(m[1]);
      }
    }
  }
  for (const v of IGNORE) vars.delete(v);
  return vars;
}

function exampleKeys(app) {
  const p = path.join(root, "apps", app, ".env.example");
  if (!fs.existsSync(p)) return null;
  const keys = new Set();
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^#?\s*([A-Z][A-Z0-9_]+)=/);
    if (m) keys.add(m[1]);
  }
  return keys;
}

// 記載されていても未使用でよいもの(インフラ・将来用・フレームワーク由来)
const ALLOW_UNUSED = new Set([
  "NODE_ENV", "NEXT_RUNTIME", "CI", "PORT",
  "POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB", // docker-compose 用
]);

let ng = 0;
let warn = 0;
for (const app of APPS) {
  const used = collectVars(app);
  const example = exampleKeys(app);
  if (example === null) {
    console.error(`❌ apps/${app}/.env.example がありません(参照変数 ${used.size} 個)`);
    ng += 1;
    continue;
  }
  const missing = [...used].filter((v) => !example.has(v)).sort();
  if (missing.length > 0) {
    console.error(`❌ apps/${app}: .env.example に未記載: ${missing.join(", ")}`);
    ng += 1;
  } else {
    console.log(`✅ apps/${app}: 参照 ${used.size} 変数すべて .env.example に記載あり(記載 ${example.size} 件)`);
  }
  // 逆方向: .env.example にあるがコードで使われていない(設定の残骸)
  const unused = [...example].filter((v) => !used.has(v) && !ALLOW_UNUSED.has(v)).sort();
  if (unused.length > 0) {
    console.warn(`⚠️  apps/${app}: .env.example にあるがコード未参照(残骸の可能性): ${unused.join(", ")}`);
    warn += 1;
  }
}
if (warn > 0) console.log(`\n(⚠️ は警告です。使わなくなった設定なら .env.example から削除、将来用なら ALLOW_UNUSED か コメントで意図を残してください)`);
if (ng > 0) process.exitCode = 1;
