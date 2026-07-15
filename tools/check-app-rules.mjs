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
 *
 * 業務ロジック(勤怠の集計・経費の承認判定など)は **apps に書くのが正しい**ので検出しない。
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = new URL("..", import.meta.url).pathname;

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
  return { scanned, issues };
}

function main() {
  const { scanned, issues } = check();
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
