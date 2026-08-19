/**
 * **「認可は書いてあるが、身元が偽物」** を検出する。
 *   node tools/check-auth-stub.mjs
 *
 * 【なぜ必要か】
 * `check-api-auth` は「API が `requirePermission` などを通しているか」を見る。
 * だが**通した先が本物かどうか**は見ていない。実際、雛形 `crud-template` の
 * `currentUser()` は固定値を返すだけだった:
 *
 *   export function currentUser(_req: Request): CurrentUser | null {
 *     return { id: "demo-user", roles: ["editor"] };   // ← リクエストを一切見ていない
 *   }
 *
 * この状態でも `requirePermission(currentUser(req), "item:write")` は通る。
 * つまり **「全検査グリーンなのに、誰でも全操作できるアプリ」** が作れてしまう。
 * 雛形はコピーされる前提なので、気づかないまま複製される。
 *
 * しかも初心者ほど「preflight が緑だから大丈夫」と判断する。
 * **緑を信じられなくする種類の穴**なので、ここを塞ぐ。
 *
 * 【何を見るか】
 * 身元を返す関数(`currentUser` 等)が、
 *   - リクエストから何も読んでいない(Cookie/セッション/トークン/ヘッダに触れていない)
 *   - なのに固定の利用者を返している
 * とき、それを**スタブ**と判定する。
 *
 * スタブ自体は開発中に必要なので禁止はしない。**本番に出られないこと**だけを求める:
 *   1. 同じファイルに本番ガードがある(`NODE_ENV === "production"` で throw)、または
 *   2. ファイル冒頭に `// auth-stub: 理由` と宣言してある(`// public-api:` と同じ作法)
 *
 * 【この検査の限界】
 * 構文の形しか見ない。セッションを読んでいても検証が甘い、権限表が間違っている、
 * といった中身の誤りは検出できない。**「認証を書き忘れた」だけを捕まえる**検査。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { collectFiles } from "./lib/collect-files.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** 身元を返す役割の関数名。ここに該当するものだけを見る。 */
const IDENTITY_FUNCTIONS = /^(current|get|require|resolve|fetch)?(User|CurrentUser|Session|CurrentSession|Actor|Principal)(OrThrow)?$/i;

/** 「リクエストから身元を読んでいる」と見なす手がかり。1 つでもあれば本物とみなす。 */
const REAL_AUTH_HINTS = /cookie|session|token|jwt|bearer|headers?\s*\.|authenticate|verify|decode|apikey|api_key|oauth|oidc|getServerSession|auth\(/i;

/** 「固定の利用者を返している」と見なす手がかり。 */
const HARDCODED_IDENTITY = /\{[^{}]*\bid\s*:\s*["'`]/;

/** 本番ガード(本番なら例外を投げる)。 */
// **上限の理由**: `NODE_ENV` の判定から `throw` までの距離。
// 本番ガードは数行で書くものなので、これで足りる（**見つからなければ落ちる**ので、
// 切れても見逃しにはならず、うるさくなるだけ）。
const PRODUCTION_GUARD = /NODE_ENV[\s\S]{0,120}?["'`]production["'`][\s\S]{0,400}?throw/;

/** 明示的な宣言。`// public-api:` と同じ作法。 */
const DECLARATION = /^\s*\/\/\s*auth-stub:\s*\S/m;

/**
 * 関数本体を波括弧の対応で切り出す。
 *
 * 正規表現だけで本体を取ると、途中の `}` で切れて誤判定する。
 *
 * @param text 全文
 * @param from 本体の `{` 以降を探し始める位置
 * @returns 本体の中身。対応が取れなければ空文字
 */
function functionBody(text, from) {
  const open = text.indexOf("{", from);
  if (open === -1) return "";
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  return "";
}

/**
 * モジュール直下の「固定の利用者」定数名を集める。
 *
 * `const STUB_USER = { id: "demo-user", roles: [...] }` のように定数へ逃がしてあると、
 * 関数本体だけ見ても固定値と分からないため。
 *
 * @param text ファイル全文
 * @returns 定数名の集合
 */
function hardcodedIdentityConsts(text) {
  const names = new Set();
// **上限の理由**: 判定から throw までの距離（上と同じ。見つからなければ落ちる）。
  const re = /\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(\{[\s\S]{0,300}?\})/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (HARDCODED_IDENTITY.test(m[2])) names.add(m[1]);
  }
  return names;
}

// `find` は Windows で別コマンドになるため使わない(tools/lib/collect-files.mjs 参照)
const files = collectFiles(["apps"], ROOT, { extensions: [".ts", ".tsx"] })
  .filter((f) => f.includes("/src/"));

const problems = [];
let stubs = 0;
let checked = 0;

for (const rel of files) {
  const text = readFileSync(path.join(ROOT, rel), "utf8");
  if (!/\b(current|get|require)(User|Session)/i.test(text)) continue;

  const consts = hardcodedIdentityConsts(text);
  const declared = DECLARATION.test(text);
  const guarded = PRODUCTION_GUARD.test(text);

  const re = /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const name = m[1];
    if (!IDENTITY_FUNCTIONS.test(name)) continue;
    checked += 1;

    const body = functionBody(text, m.index);
    if (body === "") continue;
    if (REAL_AUTH_HINTS.test(body)) continue; // リクエストから読んでいる = 本物

    const returnsConst = [...consts].some((c) => new RegExp(`return\\s+${c}\\b|=\\s*${c}\\b`).test(body));
    if (!HARDCODED_IDENTITY.test(body) && !returnsConst) continue;

    stubs += 1;
    if (guarded || declared) continue;

    const line = text.slice(0, m.index).split("\n").length;
    problems.push(
      `${rel}:${line} ${name}() がリクエストを見ずに固定の利用者を返しています` +
      "\n      → 認可は通るのに誰でも全操作できます(check-api-auth は緑のままです)" +
      "\n      → 本番ガード(NODE_ENV === \"production\" で throw)を入れるか、" +
      "\n        ファイル冒頭に `// auth-stub: 理由` を書いてください",
    );
  }
}

if (problems.length > 0) {
  console.error(`❌ 本番に出せない認証が ${problems.length} 件あります(身元が固定値のまま)。`);
  console.error("");
  for (const p of problems) console.error("  - " + p);
  console.error("");
  console.error("  実際に動く認証の例: apps/internal-app/src/server/authorize.ts / policy.ts");
  process.exitCode = 1;
} else if (stubs > 0) {
  console.log(`✅ 認証は本物か、スタブなら本番に出られません(身元を返す関数 ${checked} 個 / 宣言・ガード済みのスタブ ${stubs} 個)`);
} else {
  console.log(`✅ 身元を返す関数 ${checked} 個すべてがリクエストから認証しています`);
}
