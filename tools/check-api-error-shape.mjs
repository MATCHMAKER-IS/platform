#!/usr/bin/env node
/**
 * **API のエラー応答が traceId を返す経路に乗っているかを測る。**
 *
 * 【最初にこの検査を作ったときの誤り(2026-08)】
 * 「`errorResponse()` が 227 ルート中 2 つしか使われていない」と数えて
 * 検査を作ったが、**前提が誤っていた**。実際は
 * `withApiObservability()` が全体を `catch` し、`AppError` は
 * `httpStatusFor()` で正しいステータスに、応答は `toErrorEnvelope(e, span.traceId)` で
 * **traceId 付きの封筒**にして返している。**211 ルートがこのラッパーを通っている**。
 *
 * つまり `errorResponse()` の呼び出し数を数えるのは意味が無かった。
 * ラッパーが同じことを、より広い範囲でやっている。
 * **「基盤に正しいものがあるのに使われていない」と早合点した**のがこの誤りで、
 * 呼び出し側だけを見て、包んでいる側を見なかったのが原因。
 *
 * 【本当に測るべきもの】
 * **ラッパーを通っていないルート**。そこだけが
 *  - 例外を拾わないので Next 既定の 500 になり、`AppError(VALIDATION)` が 400 にならない
 *  - `x-request-id` も traceId も返さないので、利用者の申告とログを突き合わせられない
 *
 * 【今の状況】
 * 16 ルートが未使用。うち `/api/health` `/api/metrics` `/api/status` のように
 * **監視から叩かれるもの**は、観測の入れ子を避けるため意図的な可能性がある。
 * 中身を見て、意図的なら ALLOW に理由付きで登録すること。
 *
 * なお文言の揺れは別の話として残っている(未ログインが「認証が必要です」29 件と
 * 「ログインが必要です」16 件、権限不足が「管理者権限が必要です」57 件と
 * 「権限がありません」10 件)。こちらは具体的な文言のほうが親切なので、
 * 機械的に統一すると情報が減る。**揺れを消すより、既定を共通化するのが筋**。
 *
 * 実行:
 *   node tools/check-api-error-shape.mjs             件数を見る
 *   node tools/check-api-error-shape.mjs --list      該当ファイルを出す
 *   node tools/check-api-error-shape.mjs --set-limit 上限を現在値に下げる
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIMIT_FILE = path.join(ROOT, "tools", "api-error-shape-limit.json");
const LIST = process.argv.includes("--list");
const SET = process.argv.includes("--set-limit");

/** `route.ts` をすべて集める。 */
function routes(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) routes(p, acc);
    else if (e.name === "route.ts") acc.push(p);
  }
  return acc;
}

// **アプリ名を手書きしない。** `apps/` から集める。
// 手書きすると、新しいアプリが黙って対象外になる
// (smoke がこれを見張っている。最初はここを手書きして落ちた)
const APPS_DIR = path.join(ROOT, "apps");

/**
 * そのルートが属するアプリの `instrument.ts` が公開しているラッパー名を集める。
 *
 * **エラーを封筒にして返すものだけ**を数える(`toErrorEnvelope` を使っているか)。
 * 単にログを出すだけのラッパーを認めてしまうと、包んでいるのに
 * traceId が返らない状態を見逃す。
 */
const wrapperCache = new Map();
function wrappersFor(routeFile) {
  const rel = path.relative(APPS_DIR, routeFile).split(path.sep)[0];
  if (wrapperCache.has(rel)) return wrapperCache.get(rel);
  const inst = path.join(APPS_DIR, rel, "src", "server", "instrument.ts");
  let names = [];
  if (existsSync(inst)) {
    const src = readFileSync(inst, "utf8");
    // **封筒を自分で作る場合と、基盤に委譲する場合の両方を認める。**
    // 2026-08 まで `toErrorEnvelope` を直接呼ぶことだけを条件にしていたが、
    // `handleRoute`(`@platform/http`)に委譲する書き方も同じ結果になる
    // ——むしろ**そちらの方が望ましい**(同じラッパーのコピーを増やさない)。
    // 条件を「自作していること」にすると、正しい書き方が減点される。
    if (/toErrorEnvelope\s*\(/.test(src) || /\bhandleRoute\s*\(/.test(src)) {
      names = [...src.matchAll(/export function (with[A-Za-z]+)/g)].map((m) => m[1]);
    }
  }
  wrapperCache.set(rel, names);
  return names;
}
const files = readdirSync(APPS_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .flatMap((e) => routes(path.join(APPS_DIR, e.name, "src", "app", "api")));

/**
 * 意図的にラッパーを通していないもの。**理由を必ず添える。**
 */
const ALLOW = [
  // **`ready` も同類。** ロードバランサが認可なしで叩く(振り分けの判断に使う)。
  // 観測に包むと、監視のリクエストが業務の指標に混ざる
  { re: /\/api\/(health|ready|metrics|status)\/route\.ts$/, why: "監視・振り分けから叩かれる。観測の入れ子を避ける" },
  // **相手が JSON の封筒を読まないもの。**
  // LINE の Webhook は署名不正に素の 401 を返すのが仕様どおりで、
  // traceId を載せても相手(LINE のサーバ)は読まないし、
  // 載せると「こちらの内部 ID」を外部へ渡すことになる。
  { re: /\/api\/line\/webhook\/route\.ts$/, why: "外部 Webhook。素の 401 が仕様。内部 ID を外へ出さない" },
  // **MCP は JSON-RPC 2.0 の独自エラー形式が仕様。**
  // `handleHttpMcp`(@platform/mcp)が `{ jsonrpc, id, error: { code, message } }` を返す——
  // これは MCP プロトコルの規定で、`withApiObservability` の traceId 付き封筒を
  // 被せると **MCP クライアントが仕様外の形として読めなくなる**。
  { re: /\/api\/mcp\/route\.ts$/, why: "JSON-RPC 2.0 が仕様。traceId 付きの封筒を被せるとプロトコル違反になる" },
  // 社外の人が使う公開フォーム。**内部の相関 ID を外へ出さない**
  // (問い合わせ者に見せても意味が無く、内部構造の手がかりになる)
  { re: /public-site\/.*\/api\/contact\/route\.ts$/, why: "社外向け公開フォーム。内部 ID を外へ出さない" },
  // ログイン・ログアウトはリダイレクトが本体で、エラー応答を返さない
  // (dev-login は本番で 404 を返して存在自体を隠す)
  { re: /\/api\/auth\/(logout|dev-login)\/route\.ts$/, why: "リダイレクトが本体。JSON の封筒を返さない" },
  // **長時間つなぎっぱなしのもの。** SSE は 1 リクエストが数分〜数時間続くため、
  // 観測ラッパで包むと「終わらないリクエスト」として計測が歪む
  // (ファイル冒頭にも「長時間接続のため観測ラッパは付けない」と書いてある)
  { re: /\/api\/chat\/rooms\/\[roomId\]\/stream\/route\.ts$/, why: "SSE の長時間接続。観測ラッパで包むと計測が歪む" },
  // **認可の前段・自分自身を締め出さないもの。**
  // `auth/methods` はログイン画面が認可の前に呼ぶ。`maintenance-state` は
  // proxy が全リクエストの前に読む(認可を要求するとメンテ中に管理画面へ入れなくなる)
  { re: /\/api\/auth\/methods\/route\.ts$/, why: "認可の前段。ログイン画面が呼ぶ" },
  { re: /\/api\/maintenance-state\/route\.ts$/, why: "proxy が全リクエストの前に読む。包むと入れ子になる" },
];

const offenders = [];
for (const f of files) {
  const rel = path.relative(ROOT, f).split(path.sep).join("/");
  if (ALLOW.some((a) => a.re.test(rel))) continue;
  const src = readFileSync(f, "utf8");
  // **ラッパーの名前を決め打ちしない。**
  // 最初は `withApiObservability` だけを見ていたが、`crud-template` は
  // 同じことを `withApi` という名前でやっており(**しかも雛形**)、
  // 「包まれていない」と誤って数えていた。名前は アプリごとに違って当然で、
  // 見たいのは**そのアプリの instrument が持つラッパーを通っているか**。
  if (wrappersFor(f).some((w) => new RegExp(`\\b${w}\\s*\\(`).test(src))) continue;
  // `errorResponse()` と `handleRoute()` も traceId 付きの封筒を作る。
  // **`handleRoute` は 2026-08 に traceId を返すようになった**(それまでは落としていた)。
  if (/\berrorResponse\s*\(/.test(src) || /\bhandleRoute\s*\(/.test(src)) continue;
  offenders.push(rel);
}

const limit = (() => {
  try { return JSON.parse(readFileSync(LIMIT_FILE, "utf8")).limit ?? 0; } catch { return offenders.length; }
})();

if (SET) {
  writeFileSync(LIMIT_FILE, `${JSON.stringify({
    _comment: "エラー応答を手書きしているルートの上限。errorResponse() に寄せると減る。増やさないための歯止め。減らしたら --set-limit で下げる。",
    limit: offenders.length,
    updatedAt: new Date().toISOString().slice(0, 10),
  }, null, 2)}\n`);
  console.log(`✅ 上限を更新しました(${offenders.length})`);
  process.exit(0);
}

if (LIST) for (const o of offenders) console.log(`   ${o}`);

if (offenders.length > limit) {
  console.error(`❌ traceId を返さないルートが ${offenders.length} 件に増えました(上限 ${limit})`);
  console.error("   `withApiObservability(\"/api/…\", handler)` で包んでください。");
  console.error("   例外が拾われ、AppError は正しいステータスに、応答に x-request-id が付きます。");
  console.error("   意図的に外すなら ALLOW に理由付きで登録すること。");
  process.exit(1);
}

const ok = files.length - offenders.length;
console.log(`⚠ traceId を返さないルート ${offenders.length} 件 / 全 ${files.length}(上限 ${limit}・包まれている ${ok})`);
console.log("   例外が拾われないため 500 になり、利用者の申告とログも突き合わせられません。");
console.log("✅ 上限内です(詳細は --list)");
