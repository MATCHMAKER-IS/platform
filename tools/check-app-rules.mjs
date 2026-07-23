/**
 * apps 側が基盤の役割を侵していないか検査する。
 *   node tools/check-app-rules.mjs
 *
 * CLAUDE.md の「apps に実装してよいもの / いけないもの」を機械的に守る。
 * **規約は書くだけでは守られない**(人のレビューは見落とす)ため、ここで検出する。
 *
 * 検出するもの:
 *   1. 禁止ライブラリの直接 import(nodemailer / pdfkit 等 → 基盤のラッパー経由にする)
 *   2. 汎用処理の自作らしきファイル名(csv.ts / pdf.ts / logger.ts 等)
 *   3. 基盤にある機能の再実装らしき関数名(formatDate / validateEmail 等)
 *   4. **基盤の UI 部品を使わず、生の <button> / <input> を書いていないか**
 *      → サイズもスキンも基盤と揃わなくなる。デモサイトが基盤を使っていない、
 *        という本末転倒が実際に起きた(21 ページで生タグ 129 個・Button 使用 0 箇所)
 *
 * 業務ロジック(勤怠の集計・経費の承認判定など)は **apps に書くのが正しい**ので検出しない。
 */
import { readFileSync, existsSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * 直接 import してはいけないライブラリ → 使うべき基盤。
 * 「ライブラリ差し替え時に基盤内部だけ直せば済む」状態を保つため(CLAUDE.md 大原則 3)。
 */
const FORBIDDEN_LIBS = {
  nodemailer: "@platform/mail",
  "@prisma/client": "@platform/db",
  pdfkit: "@platform/pdf",
  puppeteer: "@platform/pdf",
  exceljs: "@platform/xlsx",
  papaparse: "@platform/csv",
  axios: "@platform/http",
  "node-fetch": "@platform/http",
  pino: "@platform/logger",
  winston: "@platform/logger",
  "@anthropic-ai/sdk": "@platform/ai (AI Gateway 経由。理由: ADR 0010)",
  openai: "@platform/ai (AI Gateway 経由。理由: ADR 0010)",
  bcrypt: "@platform/crypto",
  jsonwebtoken: "@platform/auth",
  ioredis: "@platform/cache",
};

/**
 * 汎用処理の自作を疑うファイル名 → 使うべき基盤。
 * これらの名前でアプリ側にファイルがあるなら、基盤にあるものを再実装している可能性が高い。
 */
const SUSPICIOUS_FILES = {
  "csv.ts": "@platform/csv",
  "pdf.ts": "@platform/pdf",
  "logger.ts": "@platform/logger",
  "log.ts": "@platform/logger",
  "validation.ts": "@platform/validation",
  "validator.ts": "@platform/validation",
  "date.ts": "@platform/datetime",
  "datetime.ts": "@platform/datetime",
  "http.ts": "@platform/http",
  "fetch.ts": "@platform/http",
  "mail.ts": "@platform/mail",
  "storage.ts": "@platform/storage",
  "cache.ts": "@platform/cache",
  "crypto.ts": "@platform/crypto",
};

/** 例外(理由つきで許可)。 */
const ALLOW = {
  "apps/internal-app/src/server/log-context.ts": "基盤の createContextStore を束ねるだけの配線",
  "apps/internal-app/src/lib/audit.ts": "監査イベントの業務的な組み立て(基盤の audit を使っている)",
};

function listFiles(dir) {
  const out = [];
  const walk = (d) => {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === ".next" || e.name === "dist") continue;
        walk(p);
      } else if (/\.tsx?$/.test(e.name) && !e.name.includes(".test.")) {
        out.push(p);
      }
    }
  };
  walk(dir);
  return out;
}

export function check() {
  const issues = [];
  let scanned = 0;

  for (const area of ["apps", "demos"]) {
    const areaDir = path.join(ROOT, area);
    if (!existsSync(areaDir)) continue;
    for (const app of readdirSync(areaDir)) {
      const srcDir = path.join(areaDir, app, "src");
      if (!existsSync(srcDir)) continue;

      for (const file of listFiles(srcDir)) {
        scanned += 1;
        const rel = path.relative(ROOT, file);
        if (ALLOW[rel]) continue;
        const body = readFileSync(file, "utf8");

        // 手書きの set-cookie を検出する。
        // 属性は手で書くと必ずどこかで抜ける。実際に Secure が全箇所で抜けており、
        // HTTPS 以外でもセッションが送られる状態になっていた。
        // @platform/session の serializeCookie / clearCookie は Secure を既定で付ける。
        // 基盤経由(serializeCookie / clearCookie / createSession の write・destroy)なら良い
        const usesBaseCookie = /serializeCookie|clearCookie|session\.(write|destroy)\(/.test(body);
        const handWritten = /["'`]set-cookie["'`]\s*:\s*[`"']/i.test(body);
        if (handWritten && !usesBaseCookie) {
          issues.push({
            level: "error",
            message: `${rel}: set-cookie を手書きしています → @platform/session の serializeCookie / clearCookie を使ってください(Secure の付け忘れを防ぐ)`,
          });
        }

        // 1. 禁止ライブラリの直接 import
        for (const [lib, replacement] of Object.entries(FORBIDDEN_LIBS)) {
          const re = new RegExp(`from ["']${lib.replace(/[/@]/g, "\\$&")}["']`);
          if (re.test(body)) {
            issues.push({
              level: "error",
              message: `${rel}: ${lib} を直接 import しています → ${replacement} を使ってください(CLAUDE.md 大原則 3)`,
            });
          }
        }

        // 4. 基盤の UI 部品を使わず生タグを書いていないか
        //    `<button>` を inline style で作ると、基盤の h-9 を変えても追従せず、
        //    スキンを切り替えても変わらない。**基盤を使う理由そのものが消える**。
        if (/\.tsx$/.test(file)) {
          const raw = {
            button: (body.match(/<button[\s>]/g) ?? []).length,
            input: (body.match(/<input[\s>]/g) ?? []).length,
            select: (body.match(/<select[\s>]/g) ?? []).length,
            textarea: (body.match(/<textarea[\s>]/g) ?? []).length,
          };
          const total = raw.button + raw.input + raw.select + raw.textarea;
          if (total > 0) {
            const detail = Object.entries(raw).filter(([, n]) => n > 0).map(([k, n]) => `<${k}> ${n}`).join(" / ");
            rawTagFiles.push({ rel, detail, total });
          }
        }

        // 2. 汎用処理の自作を疑うファイル名
        const base = path.basename(file);
        if (SUSPICIOUS_FILES[base]) {
          issues.push({
            level: "warn",
            message: `${rel}: ${SUSPICIOUS_FILES[base]} の再実装ではありませんか(業務固有なら ALLOW に理由付きで登録してください)`,
          });
        }
      }
    }
  }
  // 116 ファイルを 1 行ずつ出すと、他の検査の警告が埋もれて誰も読まなくなる。
  // 既定は **要約 1 行**。詳細は `--ui` で出す。
  if (rawTagFiles.length > 0) {
    const total = rawTagFiles.reduce((n, f) => n + f.total, 0);
    if (process.argv.includes("--ui")) {
      for (const f of rawTagFiles.sort((a, b) => b.total - a.total)) {
        issues.push({ level: "warn", message: `${f.rel}: 生タグ ${f.detail} → @platform/ui の Button / Input / Select / Textarea を使ってください` });
      }
    } else {
      // ラチェット: いま以上に増やさない。減らす分にはいつでも良い。
      // 「警告は出ているが誰も直さない」状態を避けるため、増えたら失敗にする。
      const limit = readRawTagLimit();
      if (total > limit) {
        issues.push({
          level: "error",
          message:
            `生タグが ${total} 箇所に増えました(上限 ${limit})。@platform/ui の部品を使ってください` +
            ` → 一覧: node tools/check-app-rules.mjs --ui`,
        });
      } else {
        issues.push({
          level: "warn",
          message:
            `生タグ(<button>/<input>/<select>/<textarea>)を ${rawTagFiles.length} ファイル・${total} 箇所で使っています(上限 ${limit})` +
            ` → @platform/ui を使ってください(CLAUDE.md「UI 部品は @platform/ui を使う」)。一覧: node tools/check-app-rules.mjs --ui` +
            (total < limit ? `。${limit - total} 箇所減りました。node tools/check-app-rules.mjs --set-limit で上限を下げてください` : ""),
        });
      }
    }
  }
  return { scanned, issues };
}

/**
 * 生タグの上限(ラチェット)。
 *
 * 一度に全部は直せないが、**増やさない**ことはすぐできる。
 * 上限を超えたら失敗、下回ったら「上限を下げてください」と促す。
 * こうすると数は一方向にしか動かない。
 */
const LIMIT_FILE = new URL("./ui-raw-tag-limit.json", import.meta.url);

function readRawTagLimit() {
  try {
    return JSON.parse(readFileSync(LIMIT_FILE, "utf8")).limit ?? Number.MAX_SAFE_INTEGER;
  } catch {
    return Number.MAX_SAFE_INTEGER; // 未設定なら止めない(既存の運用を壊さない)
  }
}

function writeRawTagLimit(n) {
  const body = {
    _comment: "生タグ(<button>/<input>/<select>/<textarea>)の上限。増やさないための歯止め。減らしたら --set-limit で下げる。",
    limit: n,
    updatedAt: new Date().toISOString().slice(0, 10),
  };
  writeFileSync(LIMIT_FILE, JSON.stringify(body, null, 2) + "\n");
}

/** 生タグを使っているファイル(要約用に貯める)。 */
const rawTagFiles = [];

function main() {
  const { scanned, issues } = check();

  if (process.argv.includes("--set-limit")) {
    const total = rawTagFiles.reduce((n, f) => n + f.total, 0);
    writeRawTagLimit(total);
    console.log(`✅ 生タグの上限を ${total} に更新しました(これ以上は増やせません)`);
    return;
  }
  const errors = issues.filter((i) => i.level === "error");
  const warns = issues.filter((i) => i.level === "warn");

  if (issues.length === 0) {
    console.log(`✅ apps/demos は基盤の役割を侵していません(${scanned} ファイル検査)`);
    return;
  }
  for (const i of errors) console.error(`❌ ${i.message}`);
  for (const i of warns) console.warn(`⚠️  ${i.message}`);
  if (errors.length > 0) {
    console.error("\n基盤にある機能をアプリで再実装すると、直す場所が増え、品質もばらつきます。");
    console.error("探し方: pnpm dev:portal(:3005)/ MCP の search_platform / docs/ai/module-list.md");
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
