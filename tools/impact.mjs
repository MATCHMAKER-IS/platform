/**
 * **変更した基盤パッケージが、どこに影響するか**を出す。
 *   node tools/impact.mjs <変更したファイル...>
 *   node tools/impact.mjs --base origin/main     … git 差分から自動で拾う
 *
 * 【なぜ必要か】
 * この基盤は 113 パッケージあり、`@platform/core` は **54 パッケージから使われている**。
 * つまり core の 1 行を変えると、54 パッケージ + それを使う全アプリに影響しうる。
 *
 * ところが PR の画面に出るのは「変更したファイル」だけで、**影響範囲は見えない**。
 * レビューする人も、出した人も、どこまで確認すべきか分からないまま通してしまう。
 *
 * このツールは依存グラフを逆にたどり、**「この変更が届く先」**を一覧にする。
 * CI から呼んで PR にコメントすると、レビューの前に影響が見える。
 *
 * 【出力の見方】
 *   直接使っている   … その基盤を import しているパッケージ・アプリ
 *   間接的に届く     … その先まで連鎖して届く範囲
 *
 * 影響が大きいものほど、**壊したときに気づくのが遅れる**(使う側のテストで初めて落ちる)。
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** `@platform/x` → それを依存に持つ名前の集合。 */
function buildReverseDeps() {
  /** @type {Map<string, Set<string>>} */
  const reverse = new Map();
  const add = (dep, user) => {
    if (!reverse.has(dep)) reverse.set(dep, new Set());
    reverse.get(dep).add(user);
  };

  for (const base of ["packages", "apps", "demos"]) {
    const dir = path.join(ROOT, base);
    if (!existsSync(dir)) continue;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const pkgPath = path.join(dir, e.name, "package.json");
      if (!existsSync(pkgPath)) continue;
      let json;
      try {
        json = JSON.parse(readFileSync(pkgPath, "utf8"));
      } catch {
        continue;
      }
      const self = json.name ?? `${base}/${e.name}`;
      const deps = { ...(json.dependencies ?? {}), ...(json.devDependencies ?? {}) };
      for (const d of Object.keys(deps)) {
        if (d.startsWith("@platform/")) add(d, self);
      }
    }
  }
  return reverse;
}

/** 変更ファイルのパスから、対象の `@platform/x` を割り出す。 */
function toPackageName(rel) {
  const m = /^packages[/\\]([a-z0-9-]+)[/\\]/.exec(rel);
  return m ? `@platform/${m[1]}` : null;
}

/** 直接 + 間接の影響先を集める(循環しても止まる)。 */
function collectImpact(reverse, start) {
  const direct = [...(reverse.get(start) ?? [])].sort();
  const all = new Set(direct);
  const queue = [...direct];
  while (queue.length > 0) {
    const cur = queue.shift();
    for (const next of reverse.get(cur) ?? []) {
      if (all.has(next)) continue;
      all.add(next);
      queue.push(next);
    }
  }
  const indirect = [...all].filter((n) => !direct.includes(n)).sort();
  return { direct, indirect };
}

// ── 入力(変更したファイル)を決める ──
const args = process.argv.slice(2);
let files = args.filter((a) => !a.startsWith("--"));

const baseIdx = args.indexOf("--base");
if (baseIdx !== -1) {
  const base = args[baseIdx + 1] ?? "origin/main";
  files = files.filter((f) => f !== base);
  try {
    files = execSync(`git diff --name-only ${base}...HEAD`, { cwd: ROOT, encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
  } catch {
    console.error(`❌ git 差分を取れません(${base})。ファイルを直接渡してください。`);
    process.exit(1);
  }
}

if (files.length === 0) {
  console.log("変更ファイルの指定がありません。");
  console.log("  node tools/impact.mjs packages/core/src/index.ts");
  console.log("  node tools/impact.mjs --base origin/main");
  process.exit(0);
}

const reverse = buildReverseDeps();
const changed = [...new Set(files.map(toPackageName).filter(Boolean))].sort();

if (changed.length === 0) {
  console.log("✅ 基盤(`packages/`)の変更はありません。影響はアプリ内に閉じています。");
  process.exit(0);
}

console.log("## この変更が届く範囲\n");
let widest = 0;
for (const pkg of changed) {
  const { direct, indirect } = collectImpact(reverse, pkg);
  const total = direct.length + indirect.length;
  widest = Math.max(widest, total);

  console.log(`### \`${pkg}\` → **${total}** か所に影響\n`);
  if (total === 0) {
    console.log("まだどこからも使われていません(未実戦)。**最初に使う人がバグを踏みます。**\n");
    continue;
  }
  console.log(`- 直接使っている(${direct.length}): ${direct.map((d) => `\`${d}\``).join(", ") || "なし"}`);
  if (indirect.length > 0) {
    console.log(`- そこから先へ届く(${indirect.length}): ${indirect.map((d) => `\`${d}\``).join(", ")}`);
  }
  console.log("");
}

// 影響が広いときは、確認すべきことを添える。
// **数字だけ出しても行動は変わらない**ので、何をすればよいかまで書く。
if (widest >= 10) {
  console.log("---\n");
  console.log(`⚠ **${widest} か所に影響します。** 次を確認してください:\n`);
  console.log("- `pnpm smoke` が通るか(依存なしで動く。10 秒)");
  console.log("- 公開 API を変えたなら `node tools/api-surface.mjs` で破壊的変更が出ていないか");
  console.log("- 使う側の画面を 1 つ以上、実際に動かしたか");
}
