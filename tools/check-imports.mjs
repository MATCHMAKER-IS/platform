/**
 * `@platform/*` から取り込んでいる名前が、**本当に存在するか**を検査する。
 *
 * 存在しない名前を import すると `next build` が落ちる。
 * ただし型チェックを通すまで気づけないため、依存を入れていない環境
 * (この検査が動く場所)でも先に分かるようにする。
 *
 * 実際に起きたこと:
 *   - `passwordStrength` を `@platform/auth` から取り込んでいた(正しくは `@platform/crypto`)
 *   - `Result` を `@platform/db` から取り込んでいた(正しくは `@platform/core`)
 *   - `Invoice` を `@platform/quote` から取り込んでいた(正しくは `@platform/invoice`)
 *
 * いずれも**ビルドするまで気づけなかった**。
 *
 * 判定は `docs/platform/api-surface.json`(生成物)を基準にする。
 * 基準が古いと誤検知するため、`pnpm gen:all` の後に実行する。
 *
 * 実行: node tools/check-imports.mjs
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectPackageSurface } from "./lib/package-surface.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SURFACE = path.join(ROOT, "docs/platform/api-surface.json");

if (!existsSync(SURFACE)) {
  console.log("⚠ docs/platform/api-surface.json がありません(node tools/api-surface.mjs --update)");
  process.exit(0);
}

const surface = JSON.parse(readFileSync(SURFACE, "utf8"));

/**
 * **名前を数え切れないパッケージ**。検査から外す。
 *
 * `@platform/ui/icons` は `export * from "lucide-react"` で外部を丸ごと
 * 再 export しており、記録に名前が載らない。そのまま検査すると
 * **実在する `import { Home } from "@platform/ui/icons"` を「存在しない」と
 * 報告する**(誤検知は検査そのものを信用されなくする)。
 */
const INCOMPLETE = new Set();
for (const dir of readdirSync(path.join(ROOT, "packages"), { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const pkgPath = path.join(ROOT, "packages", dir.name, "package.json");
  if (!existsSync(pkgPath)) continue;
  const pkgJson = JSON.parse(readFileSync(pkgPath, "utf8"));
  const s = collectPackageSurface(path.join(ROOT, "packages", dir.name), pkgJson);
  if (s !== null && !s.complete) INCOMPLETE.add(pkgJson.name);
}

/**
 * コメントを空白に置き換える。
 *
 * TSDoc の `@example` には `import { Home } from "@platform/ui/icons";` のような
 * **使用例**が書いてある。取り除かずに走査すると、説明のためのコードを
 * 実際の import と取り違える(実際に 2 件を誤検知した)。
 * 長さを保つために同じ字数の空白へ置き換える。
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));
}

/**
 * import { A, B as C, type D } from "@platform/xxx"(サブパスも拾う)。
 *
 * `@platform/db/tunnel` のようなサブパスも対象にする。
 * 以前はサブパスを正規表現から外していたが、api-surface が
 * **サブパスの export も記録するようになった**ので検証できる
 * (それまでは 13 パッケージのサブパス import が丸ごと未検査だった)。
 */
const IMPORT = /import\s+(?:type\s+)?\{([^}]+)\}\s*from\s*["'](@platform\/[a-z0-9-]+(?:\/[a-z0-9./-]+)?)["']/g;

/** `@platform/db/tunnel` → `@platform/db`(記録はパッケージ単位のため)。 */
function packageOf(specifier) {
  const parts = specifier.split("/");
  return `${parts[0]}/${parts[1]}`;
}

function collect(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", "dist"].includes(e.name)) continue;
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) collect(fp, out);
    else if (/\.tsx?$/.test(e.name) && !e.name.includes(".test.")) out.push(fp);
  }
  return out;
}

const files = [
  ...collect(path.join(ROOT, "apps")),
  ...collect(path.join(ROOT, "demos")),
  ...collect(path.join(ROOT, "packages")),
  ...collect(path.join(ROOT, "tools")),
];

const issues = [];
let checked = 0;

for (const f of files) {
  const rel = path.relative(ROOT, f).replace(/\\/g, "/");
  const body = stripComments(readFileSync(f, "utf8"));

  for (const m of body.matchAll(IMPORT)) {
    const specifier = m[2];
    const pkg = packageOf(specifier);
    // 記録に無いパッケージ(@platform/config のようにランタイムコードを
    // 持たないもの)は対象外
    const exported = surface[pkg];
    if (!exported) continue;
    // 名前を数え切れないパッケージは判定できない(誤検知になる)
    if (INCOMPLETE.has(pkg)) continue;

    const names = m[1]
      .split(",")
      .map((s) => s.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim())
      // コメントが混ざることがあるので、識別子だけを対象にする
      .filter((s) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(s));

    for (const n of names) {
      checked += 1;
      if (!exported.includes(n)) {
        // どのパッケージにあるかを示す(直す手間を減らす)
        const found = Object.entries(surface).filter(([, v]) => v.includes(n)).map(([k]) => k);
        const hint = found.length > 0 ? ` → ${found.join(" か ")} にあります` : "";
        issues.push(`${rel}: ${specifier} に ${n} はありません${hint}`);
      }
    }
  }
}

if (issues.length === 0) {
  console.log(`✅ 取り込んでいる名前はすべて実在します(${checked} 件を検査)`);
  process.exit(0);
}

for (const i of issues) console.log(`❌ ${i}`);
console.log(`❌ 存在しない名前を ${issues.length} 件取り込んでいます。next build が落ちます。`);
process.exit(1);
