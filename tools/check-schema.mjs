/**
 * Prisma schema の軽量検査(オフライン)。prisma CLI 無しで最低限の壊れを検知する。
 * - model 名の重複
 * - 各 model に @id または @@id があるか
 * - 波括弧の対応
 * 使い方: node tools/check-schema.mjs [schemaパス]
 */
import fs from "node:fs";

const path = process.argv[2] ?? new URL("../apps/internal-app/prisma/schema.prisma", import.meta.url);
const src = fs.readFileSync(path, "utf8");

const errors = [];
const open = (src.match(/\{/g) ?? []).length;
const close = (src.match(/\}/g) ?? []).length;
if (open !== close) errors.push(`波括弧の対応が取れていません: { ${open} 個 / } ${close} 個`);

const models = [...src.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)];
const names = models.map((m) => m[1]);
const dupes = names.filter((n, i) => names.indexOf(n) !== i);
if (dupes.length > 0) errors.push(`model 名が重複: ${[...new Set(dupes)].join(", ")}`);
for (const [, name, body] of models) {
  if (!/@id\b/.test(body) && !/@@id\b/.test(body)) errors.push(`model ${name} に @id / @@id がありません`);
}

if (errors.length > 0) {
  for (const e of errors) console.error(`❌ ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ schema OK: ${models.length} models(重複なし・全modelに@id・括弧整合)`);
}
