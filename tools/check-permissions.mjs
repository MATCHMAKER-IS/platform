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
import { ALWAYS_SKIP } from "./lib/collect-files.mjs";

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
    if (ALWAYS_SKIP.has(e.name)) continue;
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
    // **コメントを先に落とす。** `[^,]+` は改行をまたぐので、
    // コメントに `requirePermission(` と書いてあるだけで、**その先の
    // 別の行の文字列**を権限名として拾ってしまう(2026-08 に実際に起きた——
    // 「入れ子にしない」と注意書きを添えた行が、この検査を落とした)。
    // **`//` をどこでも消さない。** `https://…` の `//` を巻き込み、
    // **その行の後半が丸ごと消えます**(`check-regex-pitfalls` の指摘)。
    // 行頭(空白のみが先行する)のコメントだけを落とせば、目的は足りる
    const scanned = body
      .replace(/^\s*\/\/[^\n]*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of scanned.matchAll(/requirePermission\([^,]+,\s*"([^"]+)"/g)) {
      // **`:` を含まないものを飛ばさない。**
      // 2026-08 まで「ロール名は権限ではないので対象外」として除外していたが、
      // **その除外がまさに検出したかった誤りを素通りさせていた**。
      // 13 か所が `requirePermission(user, "admin")` と**ロール名を権限として**渡しており、
      // admin ロールの `"*"`(全許可)に救われて動いていた。
      // `"*"` を外した瞬間に管理者まで 403 になる状態で、しかもこの検査は緑だった。
      //
      // ロール名を渡すのは**いちばん起きやすい間違い**(名前が短く、意味も通って見える)。
      // 飛ばすのではなく、ロール名だと分かったら**そう指摘する**。
      used.set(m[1], path.relative(ROOT, f).replace(/\\/g, "/"));
    }
  }

  // policy のロール名(`  admin: {` の形)。取り違えをそれと指摘するために拾う
  const roles = new Set([...readFileSync(policyFile, "utf8").matchAll(/^\s{2}(\w+):\s*\{/gm)].map((m) => m[1]));

  for (const [perm, file] of used) {
    if (defined.has(perm)) continue;
    issues.push(roles.has(perm)
      ? `${file}: "${perm}" は**ロール名**です。権限名(\`対象:動作\`)を渡してください`
        + " → ワイルドカードを持つロールでは通ってしまい、外した途端に壊れます"
      : `${file}: 権限 "${perm}" がポリシーに定義されていません → 誰も通れず 403 になります`);
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
