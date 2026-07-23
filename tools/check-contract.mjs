/**
 * 外部SaaSとの「契約」検査。
 *
 * 外部 API はこちらの都合と関係なく変わる。モックのテストは通り続けるので、
 * 壊れたことに気づくのは利用者からの連絡になりがち。これを防ぐために
 * 「うちのコードが相手の応答の“どのフィールド”に依存しているか」を契約として明文化し、
 * 実際に記録した応答(フィクスチャ)と突き合わせる。
 *
 * 検査するもの:
 *  C001 契約ファイルの形式が正しいか
 *  C002 契約が指す実装ファイルが存在するか
 *  C003 契約に書いた必須フィールドを、実装が本当に参照しているか(契約と実装のズレ検知)
 *  C004 記録済みフィクスチャに、必須フィールドが揃っているか(相手のAPI変更を検知)
 *  C005 フィクスチャが古すぎないか(既定 90 日。契約は放置すると腐る)
 *
 * 実行:
 *   node tools/check-contract.mjs           … 通常(未記録は警告どまり)
 *   CONTRACT_STRICT=1 node tools/check-contract.mjs
 *                                           … 本番前/定期CI用(未記録・期限切れも失敗)
 *
 * フィクスチャの記録方法は docs/ops/CONTRACT_TESTING.md を参照。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "tests", "contracts");
const STRICT = process.env.CONTRACT_STRICT === "1";
const MAX_AGE_DAYS = Number(process.env.CONTRACT_MAX_AGE_DAYS ?? 90);

const errors = [];
const warns = [];

/** オブジェクトから dot 記法でフィールドを取り出す(存在確認用)。 */
function hasField(obj, dotPath) {
  let cur = obj;
  for (const key of dotPath.split(".")) {
    if (cur === null || typeof cur !== "object" || !(key in cur)) return false;
    cur = cur[key];
  }
  return true;
}

if (!fs.existsSync(DIR)) {
  console.log("⚠ tests/contracts がありません(契約テスト未整備)");
  process.exit(STRICT ? 1 : 0);
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".contract.json")).sort();
const covered = new Set();
let recorded = 0;

for (const f of files) {
  const rel = path.join("tests/contracts", f);
  let c;
  try {
    c = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
  } catch (e) {
    errors.push(`[C001] ${rel}: JSON として読めません(${e.message})`);
    continue;
  }

  for (const key of ["connector", "endpoint", "sourceFile", "requiredFields"]) {
    if (!c[key]) errors.push(`[C001] ${rel}: 必須項目 ${key} がありません`);
  }
  if (!Array.isArray(c.requiredFields) || c.requiredFields.length === 0) {
    errors.push(`[C001] ${rel}: requiredFields が空です(依存フィールドを1つ以上書く)`);
    continue;
  }
  covered.add(c.connector);

  // C002/C003: 契約と実装のズレ
  const srcPath = path.join(ROOT, c.sourceFile ?? "");
  if (!c.sourceFile || !fs.existsSync(srcPath)) {
    errors.push(`[C002] ${rel}: sourceFile が見つかりません(${c.sourceFile})`);
  } else {
    const src = fs.readFileSync(srcPath, "utf8");
    for (const field of c.requiredFields) {
      const leaf = field.split(".").pop();
      if (!src.includes(leaf)) {
        errors.push(`[C003] ${rel}: 実装(${c.sourceFile})が "${field}" を参照していません(契約が古い可能性)`);
      }
    }
  }

  // C004/C005: 記録済み応答との突き合わせ
  if (c.fixture === null || c.fixture === undefined) {
    warns.push(`[C004] ${rel}: 実応答が未記録です(${c.connector} の変更を検知できません)`);
    continue;
  }
  recorded++;
  for (const field of c.requiredFields) {
    if (!hasField(c.fixture, field)) {
      errors.push(`[C004] ${rel}: 記録した応答に "${field}" がありません → ${c.connector} の API が変わった可能性`);
    }
  }
  if (!c.capturedAt) {
    warns.push(`[C005] ${rel}: capturedAt がありません(いつ記録したか不明)`);
  } else {
    const days = (Date.now() - Date.parse(c.capturedAt)) / 86_400_000;
    if (Number.isNaN(days)) warns.push(`[C005] ${rel}: capturedAt の日付を解釈できません(${c.capturedAt})`);
    else if (days > MAX_AGE_DAYS) warns.push(`[C005] ${rel}: 記録から ${Math.floor(days)} 日経過(${MAX_AGE_DAYS}日超) → 取り直してください`);
  }
}

for (const e of errors) console.log(`❌ ${e}`);
for (const w of warns) console.log(`⚠ ${w}`);

const summary = `契約 ${files.length} 件 / 実応答を記録済み ${recorded} 件 / 対象コネクタ ${[...covered].join(", ") || "なし"}`;

if (errors.length > 0) {
  console.log(`❌ 契約検査に ${errors.length} 件の不一致。${summary}`);
  process.exit(1);
}
if (STRICT && warns.length > 0) {
  console.log(`❌ [strict] 未記録・期限切れが ${warns.length} 件。${summary}`);
  process.exit(1);
}
console.log(`✅ 契約と実装は一致しています(${summary})`);
process.exit(0);
