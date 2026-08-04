/**
 * **セキュリティヘッダが全アプリに付いているか**を検査する。
 *   node tools/check-security-headers.mjs
 *
 * 【なぜ必要か】
 * ブラウザに渡すヘッダは、アプリが**明示的に付けないと付かない**。
 * 付け忘れても画面は普通に動くので、**動作確認では絶対に気づけない**。
 *
 * 付いていないと起きること:
 *   - `Content-Security-Policy`   … XSS が入ったとき、外部スクリプトの読み込みを止められない
 *   - `X-Frame-Options`           … 別サイトの iframe に埋め込まれ、クリックジャッキングに使われる
 *   - `X-Content-Type-Options`    … ブラウザが中身を推測し、画像を JavaScript として実行しうる
 *   - `Strict-Transport-Security` … 一度でも HTTP で開くと、中間者に書き換えられる
 *
 * 2026-08 の時点で、**6 アプリ中 5 つが未適用**だった（`internal-app` だけ付いていた）。
 * 基盤に `securityHeaders()` があるのに、使われていなかった。
 *
 * 【検査するもの】
 *  SH001 `src/proxy.ts` が無い          … ヘッダを付ける場所そのものが無い
 *  SH002 `securityHeaders()` を通していない … proxy はあるが付けていない
 *  SH003 ヘッダを手書きしている          … 基盤と食い違う（1 か所で直せなくなる）
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Next.js のアプリを集める（`next.config.*` があるもの）。 */
function collectApps() {
  const out = [];
  for (const base of ["apps", "demos"]) {
    const dir = path.join(ROOT, base);
    if (!existsSync(dir)) continue;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const appDir = path.join(dir, e.name);
      const hasNext = ["next.config.mjs", "next.config.js", "next.config.ts"]
        .some((f) => existsSync(path.join(appDir, f)));
      if (hasNext) out.push({ rel: `${base}/${e.name}`, dir: appDir });
    }
  }
  return out;
}

/** 手書きされていたら基盤と食い違う恐れがあるヘッダ。 */
const MANUAL_HEADERS = /"(Content-Security-Policy|X-Frame-Options|Strict-Transport-Security|X-Content-Type-Options)"\s*[,:]/;

const problems = [];
const apps = collectApps();

for (const app of apps) {
  const proxyPath = ["src/proxy.ts", "src/middleware.ts"]
    .map((p) => path.join(app.dir, p))
    .find((p) => existsSync(p));

  if (proxyPath === undefined) {
    problems.push({ app: app.rel, code: "SH001", message: "`src/proxy.ts` がありません（セキュリティヘッダを付ける場所が無い）" });
    continue;
  }

  const src = readFileSync(proxyPath, "utf8");
  if (!/securityHeaders\s*\(/.test(src)) {
    problems.push({ app: app.rel, code: "SH002", message: "`securityHeaders()` を通していません（@platform/security）" });
  }

  // 基盤を通したうえで個別に足すのは正常。**基盤を使わずに手書き**しているものだけ指摘する
  if (MANUAL_HEADERS.test(src) && !/securityHeaders\s*\(/.test(src)) {
    problems.push({ app: app.rel, code: "SH003", message: "ヘッダを手書きしています（基盤と食い違い、1 か所で直せなくなります）" });
  }
}

if (problems.length === 0) {
  console.log(`✅ セキュリティヘッダは全アプリに付いています(${apps.length} アプリ検査)`);
  process.exit(0);
}

for (const p of problems) {
  console.error(`❌ ${p.app} [${p.code}] ${p.message}`);
}
console.error("");
console.error("   付け忘れても画面は動くため、動作確認では気づけません。");
console.error("   `src/proxy.ts` で `securityHeaders()`(@platform/security)を全レスポンスに付けてください。");
process.exitCode = 1;
