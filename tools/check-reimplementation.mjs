/**
 * 基盤にある機能を、アプリ側で作り直していないか検査する。
 *
 * 108 パッケージあると「**あることに気づけない**」。実際、次のような重複が起きていた。
 *
 *   - `hashPassword` / `verifyPassword` を 2 つのアプリが自作(基盤: @platform/crypto)
 *   - ログイン試行の回数制限を自作(基盤: @platform/session の createLoginThrottle)
 *   - Cookie を文字列で組み立て(基盤: @platform/session の serializeCookie)
 *
 * 重複の害は「無駄」ではなく、**直す場所が増えること**にある。
 * 実際、自作側の scrypt は 32 byte、基盤は 64 byte と強度が違っていた。
 *
 * 判定は単純に「アプリが export する関数名が、基盤の公開 API と一致するか」。
 * 名前が同じなら、まず基盤を見てから書いたかを疑う。
 *
 * 例外は `ALLOW` に**理由付きで**登録する(偶然の同名は必ずあるため)。
 *
 * 実行:
 *   node tools/check-reimplementation.mjs         … 上限(ラチェット)方式
 *   node tools/check-reimplementation.mjs --list  … 一覧
 *   node tools/check-reimplementation.mjs --set-limit … 減らしたら上限を下げる
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ALWAYS_SKIP } from "./lib/collect-files.mjs";

let scanned = 0;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SURFACE = path.join(ROOT, "docs/platform/api-surface.json");
const LIMIT_FILE = new URL("./reimplementation-limit.json", import.meta.url);

/**
 * 偶然の同名。**理由を書く**こと。
 * ここに足すのは「基盤と別物である」と確認したときだけ。
 */
const ALLOW = {
  // **基盤の `definePolicy()` で作った値**であって、作り直しではない。
  // 権限表は**アプリごとに中身が違う**ので、アプリ側に置くのが正しい形
  // （基盤側の同名は `rbac.ts` の TSDoc に載っている使用例。2026-08）
  policy: "基盤の definePolicy() で作った値(権限表はアプリごとに違う)",
  // **偶然の同名**。アプリ側は React のコンテキスト提供者
  // (`<AuthProvider>{children}</AuthProvider>`)、基盤側は
  // **ログイン方法の型**(`"zoho" | "google" | ...`)。用途が全く違う(2026-08)
  AuthProvider: "偶然の同名(アプリは React コンポーネント / 基盤はログイン方法の型)",
  // **基盤への委譲ラッパー**(中身は `@platform/guard` の guardWrite)。
  // アプリごとに上限とレート制限のストアが違うので、
  // **設定を束ねる薄い層**だけを置いている(2026-08)
  guardWrite: "基盤への委譲ラッパー(上限とストアの設定を束ねるだけ)",
  // Next.js のルートハンドラ。HTTP メソッド名なので基盤の同名とは無関係
  GET: "Next.js のルートハンドラ(HTTP メソッド名)",
  POST: "Next.js のルートハンドラ(HTTP メソッド名)",
  PUT: "Next.js のルートハンドラ(HTTP メソッド名)",
  PATCH: "Next.js のルートハンドラ(HTTP メソッド名)",
  DELETE: "Next.js のルートハンドラ(HTTP メソッド名)",
  // アプリごとにロールと権限が違うため、判定の入口はアプリ側に置く(中身は @platform/auth の can)
  requirePermission: "アプリ固有のポリシーを既定値に束ねる薄い層(判定は @platform/auth)",
  currentUser: "セッションの取り出し方がアプリごとに異なる",
  // 監査の保存先はアプリが決める
  recordAudit: "保存先(メモリ/DB)をアプリが決めるため",
  // **どの環境変数が要るかはアプリごとに違う。**
  // 基盤に定義を置くと、全アプリが全アプリの変数を要求することになる。
  // 検証そのものは @platform/env の parseEnv に任せており、
  // ここにあるのは「このアプリのスキーマ」だけ。全アプリが同じ名前で公開している
  env: "アプリごとに必要な環境変数が違うため(検証は @platform/env の parseEnv)",
};

if (!existsSync(SURFACE)) {
  console.log("⚠ docs/platform/api-surface.json がありません(node tools/api-surface.mjs --update)");
  process.exit(0);
}

/** 公開名 → 最初に見つかったパッケージ。 */
const owner = new Map();
for (const [pkg, names] of Object.entries(JSON.parse(readFileSync(SURFACE, "utf8")))) {
  for (const n of names) if (!owner.has(n)) owner.set(n, pkg);
}

function collect(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
  scanned += 1;
    if (ALWAYS_SKIP.has(e.name)) continue;
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) collect(fp, out);
    else if (/\.tsx?$/.test(e.name) && !e.name.endsWith(".test.ts") && !e.name.endsWith(".test.tsx")) out.push(fp);
  }
  return out;
}

const hits = [];
/**
 * 実際に効いた除外。
 *
 * **効かなくなった除外は消します。** 残っていると、
 * **同じ名前で本物の作り直しが起きたときに素通り**します
 * ——「昔ここで許したから」という理由で、**未来の違反まで許すことになります**。
 */
const usedAllow = new Set();

for (const area of ["apps"]) {
  for (const f of collect(path.join(ROOT, area))) {
    const rel = path.relative(ROOT, f).replace(/\\/g, "/");
    const src = readFileSync(f, "utf8");
    // 「基盤を使っている」と明記していれば対象外(移行層など)
    if (/@platform\/[a-z-]+ に一本化|基盤の実装を使/.test(src)) continue;
    for (const m of src.matchAll(/^export (?:async )?(?:function|const) ([A-Za-z][A-Za-z0-9_]*)/gm)) {
      const name = m[1];
      if (ALLOW[name]) { usedAllow.add(name); continue; }
      if (!owner.has(name)) continue;
      hits.push({ rel, name, pkg: owner.get(name) });
    }
  }
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
    _comment: "基盤と同名の関数をアプリ側で定義している数の上限。増やさないための歯止め。偶然の同名は tools/check-reimplementation.mjs の ALLOW へ理由付きで登録する。",
    limit: hits.length,
    updatedAt: new Date().toISOString().slice(0, 10),
  }, null, 2)}\n`);
  console.log(`✅ 上限を ${hits.length} に更新しました`);
  process.exit(0);
}

if (process.argv.includes("--list")) {
  for (const h of hits) console.log(`  ${h.rel}: ${h.name}() は ${h.pkg} にもあります`);
}

const limit = readLimit();
if (hits.length > limit) {
  console.log(`❌ 基盤と同名の実装が ${hits.length} 件に増えました(上限 ${limit})。`);
  console.log("   基盤に同じものが無いか確認してください(search_platform / /assistant で探せます)。");
  console.log("   別物なら tools/check-reimplementation.mjs の ALLOW に理由付きで登録してください。");
  console.log("   一覧: node tools/check-reimplementation.mjs --list");
  process.exit(1);
}

if (hits.length > 0) {
  console.log(`⚠ 基盤と同名の実装が ${hits.length} 件あります(上限 ${limit})。一覧: node tools/check-reimplementation.mjs --list`);
  if (hits.length < limit) console.log(`   ${limit - hits.length} 件減りました。--set-limit で上限を下げてください`);
  process.exit(0);
}

// **効かなくなった除外を知らせる。**
//
// 除外の理由は「書いた時点の状態」でしかありません。
// 元の実装が消えたり名前が変わったりすると、**除外だけが残ります**。
// そのまま置いておくと、**同じ名前で本物の作り直しが起きたときに素通り**します
// ——「昔ここで許したから」という理由で、未来の違反まで許すことになります。
//
// **落とさず、知らせるだけ**にしてあります。消すかどうかは人が決めること
// （一時的に実装を外している最中かもしれません）。
const staleAllow = Object.keys(ALLOW).filter((k) => !usedAllow.has(k));
if (staleAllow.length > 0) {
  console.log(`⚠ 効いていない除外が ${staleAllow.length} 件あります: ${staleAllow.join(", ")}`);
  console.log("   もう要らないなら ALLOW から消してください（残すと、同じ名前の作り直しを素通りさせます）");
}

console.log(`✅ 基盤と同名の実装はありません(${scanned} ファイルを検査)`);
process.exit(0);
