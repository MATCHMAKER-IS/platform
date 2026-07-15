#!/usr/bin/env node
/**
 * i18n 網羅チェック(CI 用)。
 * - コード中の t("key") 使用キーを収集
 * - 基盤カタログ(言語別ファイル)+ 追加カタログ(--catalog で指定)に対し、未定義キー・ロケール欠落を検出
 * - --report=path で Markdown サマリを出力(PR コメント用)
 * 未定義・欠落があれば exit 1。
 *
 * 使い方:
 *   node tools/i18n-check.mjs
 *   node tools/i18n-check.mjs --catalog demos/showcase/src/i18n/catalog.ts#catalogs
 *   node tools/i18n-check.mjs --report i18n-report.md
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, extname, isAbsolute } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const reportPath = (args.find((a) => a.startsWith("--report="))?.split("=")[1]) ?? (args.includes("--report") ? "i18n-report.md" : null);
const extraCatalogs = args.filter((a) => a.startsWith("--catalog=")).map((a) => a.slice("--catalog=".length));

const SCAN_DIRS = ["packages", "demos", "apps"];
const KEY_RE = /(?:^|[^.\w])t\(\s*["'`]([\w.]+)["'`]/g;

function walk(dir, acc = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return acc; }
  for (const e of entries) {
    if (e === "node_modules" || e === "dist" || e.startsWith(".")) continue;
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if ([".ts", ".tsx", ".mjs", ".js"].includes(extname(p))) acc.push(p);
  }
  return acc;
}

function collectUsedKeys() {
  const keys = new Map(); // key -> Set(files)
  for (const d of SCAN_DIRS) {
    for (const file of walk(join(root, d))) {
      if (file.includes("catalogs/") || file.includes("i18n-check")) continue;
      const src = readFileSync(file, "utf8");
      let m;
      while ((m = KEY_RE.exec(src))) {
        if (!keys.has(m[1])) keys.set(m[1], new Set());
        keys.get(m[1]).add(file.replace(root + "/", ""));
      }
    }
  }
  return keys;
}

async function loadBaseCatalogs() {
  const dir = join(root, "packages/i18n/src/catalogs");
  const out = {};
  for (const loc of ["ja", "en", "zh", "ko"]) {
    const mod = await import(pathToFileURL(join(dir, `${loc}.ts`)).href);
    out[loc] = mod[loc];
  }
  return out;
}

async function loadExtraCatalog(spec) {
  // spec: path#exportName(default: catalogs)
  const [rel, exp = "catalogs"] = spec.split("#");
  const p = isAbsolute(rel) ? rel : join(root, rel);
  const mod = await import(pathToFileURL(p).href);
  return mod[exp] ?? {};
}

function mergeInto(target, cats) {
  for (const loc of Object.keys(cats)) {
    target[loc] = { ...(target[loc] ?? {}), ...(cats[loc] ?? {}) };
  }
}

const usedMap = collectUsedKeys();
const used = new Set(usedMap.keys());
const catalogs = await loadBaseCatalogs();
for (const spec of extraCatalogs) {
  try { mergeInto(catalogs, await loadExtraCatalog(spec)); }
  catch (e) { console.error(`⚠️ 追加カタログ読込失敗: ${spec}: ${e.message}`); }
}

const locales = Object.keys(catalogs);
const allKeys = new Set(locales.flatMap((l) => Object.keys(catalogs[l] ?? {})));
const base = catalogs.ja ?? catalogs[locales[0]] ?? {};

const missing = [...used].filter((k) => !allKeys.has(k)).sort();
const perLocaleMissing = {};
for (const l of locales) {
  const have = new Set(Object.keys(catalogs[l] ?? {}));
  const miss = [...allKeys].filter((k) => !have.has(k));
  if (miss.length) perLocaleMissing[l] = miss;
}
const unused = [...Object.keys(base)].filter((k) => !used.has(k)).sort();

const failed = missing.length > 0 || Object.keys(perLocaleMissing).length > 0;

console.log(`使用キー: ${used.size} / カタログキー: ${allKeys.size} / ロケール: ${locales.join(", ")}${extraCatalogs.length ? ` (+追加辞書 ${extraCatalogs.length})` : ""}`);
if (missing.length) { console.error(`\n❌ カタログ未定義のキー (${missing.length}):`); for (const k of missing) console.error(`   - ${k}  [${[...usedMap.get(k)].slice(0, 2).join(", ")}]`); }
if (Object.keys(perLocaleMissing).length) { console.error(`\n❌ ロケール間のキー欠落:`); for (const [l, m] of Object.entries(perLocaleMissing)) console.error(`   [${l}] ${m.length}件: ${m.slice(0, 8).join(", ")}${m.length > 8 ? " …" : ""}`); }
if (unused.length) console.log(`\nℹ️  未使用の基盤キー(参考) ${unused.length}件`);

if (reportPath) {
  let md = `## i18n チェック結果\n\n- 使用キー: **${used.size}** / カタログキー: **${allKeys.size}** / ロケール: ${locales.join(", ")}\n`;
  md += failed ? `\n### ❌ 問題あり\n` : `\n### ✅ 問題なし\n`;
  if (missing.length) md += `\n**カタログ未定義キー (${missing.length})**\n\n${missing.map((k) => `- \`${k}\` — ${[...usedMap.get(k)].slice(0, 2).join(", ")}`).join("\n")}\n`;
  for (const [l, m] of Object.entries(perLocaleMissing)) md += `\n**\`${l}\` に欠落 (${m.length})**\n\n${m.slice(0, 30).map((k) => `- \`${k}\``).join("\n")}${m.length > 30 ? "\n- …" : ""}\n`;
  if (!failed) md += `\nすべての使用キーが 4 言語で定義されています。\n`;
  const outPath = isAbsolute(reportPath) ? reportPath : join(root, reportPath);
  writeFileSync(outPath, md);
  console.log(`\n📝 レポート出力: ${reportPath}`);
}

if (failed) { console.error("\ni18n チェック失敗。"); process.exit(1); }
console.log("\n✅ i18n チェック通過(未定義キー・ロケール欠落なし)。");
