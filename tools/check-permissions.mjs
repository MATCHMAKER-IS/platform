/**
 * コードが使っている権限が、ポリシーに定義されているかを検査する。
 *
 * `requirePermission(user, "expense:read")` と書いても、
 * ポリシーに `expense:read` が無ければ**誰も通れない**。
 * 画面が 403 になって初めて気づく類の不具合で、
 * 権限名の綴り違い(`read` と `read:own`)で簡単に起きる。
 *
 * 逆に、定義したのに使われていない権限も報告する(消し忘れ・実装漏れの手がかり)。
 *
 * 実行: node tools/check-permissions.mjs
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** ポリシー定義のあるアプリだけを対象にする。 */
const APPS = readdirSync(path.join(ROOT, "apps"), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .filter((a) => existsSync(path.join(ROOT, "apps", a, "src/server/policy.ts")) ||
                 existsSync(path.join(ROOT, "apps", a, "src/server/authorize.ts")));

function collect(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", "dist"].includes(e.name)) continue;
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) collect(fp, out);
    else if (/\.tsx?$/.test(e.name)) out.push(fp);
  }
  return out;
}

const issues = [];
let checkedApps = 0;

for (const app of APPS) {
  const base = path.join(ROOT, "apps", app);
  const policyFile = ["src/server/policy.ts", "src/server/authorize.ts"]
    .map((f) => path.join(base, f))
    .find((f) => existsSync(f) && readFileSync(f, "utf8").includes("resolveHierarchy"));
  if (!policyFile) continue;
  checkedApps += 1;

  // 定義側: ポリシー内の "xxx:yyy" をすべて拾う
  const defined = new Set([...readFileSync(policyFile, "utf8").matchAll(/"([a-z][a-z0-9]*:[a-z:*]+)"/g)].map((m) => m[1]));
  const wildcard = defined.has("*");

  // 使用側: requirePermission(..., "xxx:yyy")
  const used = new Map();
  for (const f of collect(path.join(base, "src"))) {
    const body = readFileSync(f, "utf8");
    for (const m of body.matchAll(/requirePermission\([^,]+,\s*"([^"]+)"/g)) {
      // ロール名(":" を含まない)は権限ではないので対象外
      if (!m[1].includes(":")) continue;
      used.set(m[1], path.relative(ROOT, f).replace(/\\/g, "/"));
    }
  }

  for (const [perm, file] of used) {
    if (!defined.has(perm)) {
      issues.push(`${file}: 権限 "${perm}" がポリシーに定義されていません → 誰も通れず 403 になります`);
    }
  }
  // 使われていない権限は情報として出す(失敗にはしない)
  const unused = [...defined].filter((p) => p !== "*" && !used.has(p));
  if (unused.length > 0 && process.argv.includes("--unused")) {
    console.log(`  ${app}: 未使用の権限 ${unused.length} 件 — ${unused.join(", ")}`);
  }
  if (wildcard) {
    // "*" があると未定義でも通ってしまうロールが存在する。気づけるように一言出す
    console.log(`  ${app}: 管理者に "*"(全権限)があります。未定義の権限も管理者だけは通ります`);
  }
}

if (issues.length === 0) {
  console.log(`✅ 使用している権限はすべてポリシーに定義されています(${checkedApps} アプリ検査)`);
  process.exit(0);
}
for (const i of issues) console.log(`❌ ${i}`);
console.log(`❌ 未定義の権限が ${issues.length} 件。画面が 403 になります。`);
process.exit(1);
