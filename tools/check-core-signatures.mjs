/**
 * **多くのパッケージが依存する基盤**の、関数の形（引数と戻り値）を守る。
 *
 * `api-surface` は名前の削除だけを見る。しかし実際に壊れるのは、
 * **名前は同じまま引数が変わったとき**の方が多い。
 * 型検査でしか分からず、依存が広いほど気づくのが遅れる。
 *
 * 実測（`@platform/core`）:
 *   - **54 パッケージ**が依存
 *   - **142 ファイル**が取り込む
 *
 * ここが変わると全体が止まるため、他のパッケージと同じ扱いにはしない。
 * 署名を記録し、変わったときに**意図した変更かを確かめさせる**。
 *
 * 実行:
 *   node tools/check-core-signatures.mjs          … 記録と比べる
 *   node tools/check-core-signatures.mjs --update … 意図した変更なら記録を更新
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SNAPSHOT = path.join(ROOT, "docs/platform/core-signatures.json");

/**
 * 守る対象。**依存の数で決める**（多いほど壊れたときの影響が広い）。
 * 数が増えたら足す。減らすときは、なぜ守らなくてよいかを添えること。
 */
const GUARDED = ["core", "integrations", "auth", "datetime"];

/** 関数・定数の署名を取り出す。 */
function extractSignatures(pkgDir) {
  const out = {};
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, e.name);
      if (e.isDirectory()) { walk(fp); continue; }
      if (!fp.endsWith(".ts") || fp.includes(".test.")) continue;
      const src = readFileSync(fp, "utf8");

      // export function 名(引数): 戻り値
      for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*(\([\s\S]*?\))\s*:\s*([^{;]+)/g)) {
        out[m[1]] = normalize(`${m[2]}: ${m[3]}`);
      }
      // export interface / type の中身（形が変わると使う側が壊れる）
      for (const m of src.matchAll(/export\s+interface\s+([A-Za-z0-9_$]+)\s*(?:extends[^{]*)?\{([\s\S]*?)\n\}/g)) {
        out[`interface ${m[1]}`] = normalize(m[2]);
      }
    }
  };
  walk(path.join(pkgDir, "src"));
  return out;
}

/** 空白とコメントを落として、書式の違いを差分にしない。 */
function normalize(text) {
  return text
    .replace(/\/\*\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function collectAll() {
  const all = {};
  for (const name of GUARDED) {
    const dir = path.join(ROOT, "packages", name);
    if (!existsSync(dir)) continue;
    all[`@platform/${name}`] = extractSignatures(dir);
  }
  return all;
}

/** そのパッケージに依存しているパッケージの数（影響の広さ）。 */
function dependantCount(pkgName) {
  const base = path.join(ROOT, "packages");
  let n = 0;
  for (const d of readdirSync(base)) {
    const p = path.join(base, d, "package.json");
    if (!existsSync(p)) continue;
    const deps = JSON.parse(readFileSync(p, "utf8")).dependencies ?? {};
    if (Object.keys(deps).includes(pkgName)) n += 1;
  }
  return n;
}

const current = collectAll();

if (process.argv.includes("--update")) {
  writeFileSync(SNAPSHOT, `${JSON.stringify(current, null, 2)}\n`);
  const total = Object.values(current).reduce((s, v) => s + Object.keys(v).length, 0);
  console.log(`✅ 署名を記録しました（${Object.keys(current).length} パッケージ / ${total} 件）`);
  process.exit(0);
}

if (!existsSync(SNAPSHOT)) {
  console.log("⚠ 記録がありません。`node tools/check-core-signatures.mjs --update` で作成してください");
  process.exit(0);
}

const before = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
const changes = [];

for (const [pkg, sigs] of Object.entries(current)) {
  const old = before[pkg] ?? {};
  for (const [name, sig] of Object.entries(sigs)) {
    if (old[name] === undefined) continue;          // 追加は許容
    if (old[name] !== sig) {
      changes.push({ pkg, name, kind: "変更", before: old[name], after: sig });
    }
  }
  for (const name of Object.keys(old)) {
    if (sigs[name] === undefined) changes.push({ pkg, name, kind: "削除" });
  }
}

if (changes.length === 0) {
  const total = Object.values(current).reduce((s, v) => s + Object.keys(v).length, 0);
  console.log(`✅ 依存の多い基盤の形は変わっていません（${total} 件を照合）`);
  process.exit(0);
}

console.log("❌ 依存の多い基盤で、関数や型の形が変わりました。");
console.log("   使う側は型検査でしか気づけません。意図した変更か確かめてください。\n");

for (const c of changes) {
  const n = dependantCount(c.pkg);
  console.log(`  [${c.kind}] ${c.pkg} の ${c.name}（${n} パッケージが依存）`);
  if (c.kind === "変更") {
    console.log(`     前: ${c.before.slice(0, 120)}`);
    console.log(`     後: ${c.after.slice(0, 120)}`);
  }
}

console.log("\n   意図した変更なら `node tools/check-core-signatures.mjs --update` で記録を更新し、");
console.log("   **なぜ変えたか**をコミットメッセージに書いてください。");
process.exit(1);
