/**
 * **資源を消費する公開 API にレート制限が付いているか**を検査する。
 *   node tools/check-rate-limit.mjs
 *
 * 【なぜ必要か】
 * 認証の要らない口（`// public-api:`）で、1 回ごとに**お金や資源を使う**処理を
 * 無防備に置くと、叩かれた分だけ被害が出る。
 *
 *   - AI の呼び出し   … 1 回ごとに費用。**叩かれた分だけ請求が来る**
 *   - ファイル受け取り … ディスクを消費。**容量を埋め尽くされる**
 *   - 外部プロセス起動 … CPU を占有。**サーバが応答しなくなる**
 *   - メール・SMS 送信 … 費用に加え、**送信元の評判**まで落ちる
 *
 * 攻撃と呼ぶほどのものは要らない。**スクリプトで連打されるだけ**で起きる。
 *
 * 【検査するもの】
 * `// public-api:` と書かれた route.ts のうち、下の語を含むものに
 * レート制限（`limiter.check` など）があるかを見る。
 *
 * 意図的に付けない場合は `// no-rate-limit: 理由` を書く
 * （ヘルスチェックなど、処理が軽く連打されても困らないもの）。
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** 1 回ごとに資源を使う処理の目印。 */
const COSTLY = [
  { re: /createAiGateway|aiGateway|\.chat\(|generateText/, what: "AI の呼び出し（1 回ごとに費用）" },
  { re: /handleUpload|formData\(\)|\.arrayBuffer\(\)/, what: "ファイルの受け取り（ディスクを消費）" },
  { re: /execFile|spawn\(|createMediaProcessor|ffmpeg/, what: "外部プロセスの起動（CPU を占有）" },
  { re: /sendMail|sendSms|createSms\(/, what: "メール・SMS の送信（費用と送信元の評判）" },
];

/** レート制限が付いている目印。 */
const GUARDED = /limiter\.check|createRateLimiter|checkLoginAttempt|rateLimit/;

/** 意図的に付けない宣言。`// public-api:` と同じ作法。 */
const DECLARED = /no-rate-limit:/;

/** route.ts を集める。 */
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

const problems = [];
let publicCount = 0;

for (const base of ["apps", "demos"]) {
  for (const file of collectRoutes(path.join(ROOT, base))) {
    const src = readFileSync(file, "utf8");
    // 認証が要るものは対象外（叩けるのは正規の利用者だけ）
    if (!/\/\/\s*public-api:/.test(src)) continue;
    // 読み取りだけなら対象外
    if (!/export\s+(async\s+)?function\s+(POST|PUT|DELETE|PATCH)/.test(src)) continue;
    publicCount += 1;

    if (GUARDED.test(src) || DECLARED.test(src)) continue;

    const hit = COSTLY.find((c) => c.re.test(src));
    if (hit === undefined) continue;

    problems.push({
      rel: path.relative(ROOT, file).replace(/\\/g, "/"),
      what: hit.what,
    });
  }
}

if (problems.length === 0) {
  console.log(`✅ 資源を使う公開 API にはレート制限が付いています(公開 API ${publicCount} 本を検査)`);
  process.exit(0);
}

for (const p of problems) {
  console.error(`❌ ${p.rel}: ${p.what} にレート制限がありません`);
}
console.error("");
console.error("   認証の要らない口で資源を使う処理は、**連打されるだけ**で被害が出ます。");
console.error("   `createRateLimiter`(@platform/ratelimit)で回数を制限してください。");
console.error("   軽い処理で連打されても困らないなら、`// no-rate-limit: 理由` と書いてください。");
process.exitCode = 1;
