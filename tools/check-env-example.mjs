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
// **手書きの一覧を持たない。** アプリを足しても消しても必ず追随が漏れる
// (equipment-app を統合したとき、ここだけ残って検査が落ちた)。
// `.env.example` を持つアプリが対象。
const APPS = fs.readdirSync(path.join(root, "apps"), { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(root, "apps", d.name, ".env.example")))
  .map((d) => d.name);
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
      // **自動生成物は見ない。** `portal-reference.generated.ts` は
      // 全パッケージの TSDoc を JSON で抱えており、**説明文に出てくる
      // 環境変数名まで「参照している」と数えてしまう**
      // (2026-08、showcase が使っていない `CRON_TOKEN` を要求された)。
      // 直すなら生成する側なので、ここで数えても意味がない
      if (/\.generated\.(ts|tsx|mts)$/.test(e.name)) continue;
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
      //
      // **インデントと定義の形を決め打ちしない。**
      // 以前は「4 字下げ + `z.`」だけを見ており、
      // 2 字下げのものや `optionalEnv(...)` / `requiredAtRuntime(...)` で
      // 定義した 22 変数が検査から漏れていた(2026-08)。
      if (/parseEnv\(/.test(body)) {
        for (const m of body.matchAll(/^\s+([A-Z][A-Z0-9_]{2,}):\s*(?:z\.|optionalEnv|requiredAtRuntime)/gm)) {
          vars.add(m[1]);
        }
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
  // **セッションの暗号化に使う塩。まだ差し替えていない**(2026-08)。
  // `zoho-session.ts` は今も HMAC 署名だけで、**クッキーを見れば
  // email と roles が読める**。暗号化へ移す準備として先に置いてある——
  // **差し替えた瞬間に全員がログアウト**するので、出す時間帯を決めてから。
  // 手順は `apps/internal-app/src/server/zoho-session.ts` の冒頭
  "SESSION_SALT",
  // **showcase の接続テスト画面は、キー名を文字列として持つ。**
  // `{ key: "STRIPE_SECRET_KEY", label: "シークレットキー" }` のように
  // 一覧を組み立てるので `process.env.X` の形では現れない。
  // この検査は `process.env.` 経由だけを見るため未参照に見える(2026-08 に確認)。
  "STRIPE_SECRET_KEY",
  "SLACK_BOT_TOKEN",
  // 同じ理由(接続テスト画面が**キー名を文字列として持つ**)。
  // **2026-08 に自動生成物を走査対象から外して浮上した**——
  // `portal-reference.generated.ts` が全パッケージの TSDoc を抱えており、
  // **説明文に出てくる変数名を「参照」と数えて**いたため隠れていた。
  // **生成物を数えると、本物の残骸が見えなくなる。**
  "GOOGLE_MAPS_API_KEY",
  "LINE_CHANNEL_ACCESS_TOKEN",
  "MICROSOFT_TENANT_ID",
  "REDIS_URL",
  // 暗号のデモ画面が「設定名」として表示する(値は使わない)
  "ENCRYPTION_SECRET",
  "ENCRYPTION_SALT",
  // 開発ツールの説明で名前だけ出てくる(showcase は本番向けの分岐を持たない)
  "DEBUG_TOOL",
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
