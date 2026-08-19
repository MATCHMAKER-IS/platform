/**
 * **資料に書いてあるコマンドが実際に動くか**を検査する。
 *   node tools/check-doc-commands.mjs
 *
 * 【なぜ必要か】
 * 資料の `pnpm dev:showcase` のようなコマンドは、**書いた時点では正しくても
 * あとで名前が変わる**。読む側は「書いてあるのに動かない」に出くわし、
 * そこで資料全体を信用しなくなる。
 *
 * 2026-08 に実際に見つかった例:
 *   - `pnpm dev:showcase` … 正しくは `pnpm dev:showcase`（HANDOVER に残っていた）
 *   - `pnpm dev:balance` … 資料にあるのに package.json に無かった
 *
 * コード内の import は `check-imports` が、資料のリンクは `check-docs-links` が
 * 見ている。**コマンドだけ誰も見ていなかった**ので、ここで埋める。
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * pnpm 自身のサブコマンド。package.json のスクリプトではないので対象外。
 * （`pnpm install` などを「存在しないスクリプト」と誤検知しないため）
 */
const PNPM_BUILTINS = new Set([
  "install", "add", "remove", "update", "exec", "dlx", "run", "start",
  "store", "why", "ls", "list", "outdated", "audit", "link", "unlink",
  "publish", "pack", "init", "config", "env", "setup", "prune", "import",
  "rebuild", "root", "bin", "licenses", "patch", "deploy", "fetch",
]);

/** 走査する資料。 */

/**
 * **資料に載せなくてよいコマンド。**
 *
 * ここに無いコマンドが `package.json` にあれば、`COMMANDS.md` に載せること
 * ——**載っていないコマンドは、使えることを知る手段が無い**。
 * 2026-08 に 29 件が漏れていた(`advisor find` / `new-app` など、
 * **知らないと同じものを作ってしまう**ものを含む)。
 */
const INTERNAL_ONLY = new Set([
  // **turbo の内部呼び出し**(利用者は `pnpm build` を使う)
  "build:turbo", "dev:turbo", "lint:turbo", "test:turbo", "typecheck:turbo",
  "build:no-turbo", "dev:no-turbo", "test:no-turbo",
  // **自動で走るもの**
  "postinstall", "version-packages",
  // **別名**(`pnpm debt` は `tools/debt.mjs` として資料に載っている)
  "debt", "debt:tighten", "debt:record", "dup", "test:watch",
]);

/** `package.json` にあるのに資料へ載っていないコマンドを探す。 */
function findUndocumented() {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const doc = readFileSync(path.join(ROOT, "docs/ops/COMMANDS.md"), "utf8");
  return Object.keys(pkg.scripts ?? {}).filter(
    (k) => !INTERNAL_ONLY.has(k) && !doc.includes(`pnpm ${k}`) && !doc.includes(`\`${k}\``),
  );
}

function collectDocs() {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules") continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".md")) out.push(p);
    }
  };
  walk(path.join(ROOT, "docs"));
  // **ツールが「人に実行させる」コマンドも見る。** 資料だけを見ていると、
  // `drill.mjs` が案内する `pnpm dev:internal` のような**コピーして貼る文字列**が
  // 対象外になる。存在しなければ、訓練はそこで止まる(2026-08)。
  //
  // **`console.log` で出す行だけを見る。** 説明文(`pnpm xxx` のような例)や
  // 検証用の文字列まで拾うと、誤検出だらけになる。
  for (const f of readdirSync(path.join(ROOT, "tools"))) {
    if (f.endsWith(".mjs")) out.push(path.join(ROOT, "tools", f));
  }
  for (const f of ["README.md", "CLAUDE.md"]) {
    const p = path.join(ROOT, f);
    try { statSync(p); out.push(p); } catch { /* 無ければ飛ばす */ }
  }
  return out;
}

const scripts = new Set(Object.keys(JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")).scripts ?? {}));

const problems = [];
for (const file of collectDocs()) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  const isTool = rel.startsWith("tools/");
  lines.forEach((line, i) => {
    // **ツールでは `console.log` の行だけを見る。** 説明文の例(`pnpm xxx`)や
    // 検証用の文字列まで拾うと誤検出だらけになる(2026-08 に 6 件出た)
    if (isTool && !line.includes("console.log")) return;
    // **この検査自身は対象外。** 説明の中で `pnpm xxx` を例として出すのが仕事
    if (rel === "tools/check-doc-commands.mjs") return;
    // バッククォートで囲まれた `pnpm xxx` を拾う。
    // **`--filter` 付きは対象外**（スクリプト名ではなくパッケージ指定のため）
    // **ツールでは囲みを求めない。** `console.log(\`… pnpm dev:internal\`)` のように
    // テンプレート文字列の一部として出すのが普通で、個別にバッククォートで
    // 囲まれてはいない(2026-08 にこれで発火しなかった)
    // **変数展開を含むものは判定できない。** `pnpm dev:${name}` の `name` は
    // 実行時にしか決まらないので、そこで切れた `pnpm dev:` を誤検出しないよう飛ばす
    const re = isTool ? /pnpm ([a-z][a-z0-9:._-]*)(?!\$\{)/g : /`pnpm ([a-z][a-z0-9:._-]*)`/g;
    for (const m of line.matchAll(re)) {
      const name = m[1];
      if (PNPM_BUILTINS.has(name)) continue;
      if (scripts.has(name)) continue;
      // 末尾が `:` なら変数が続いていた形(`pnpm dev:${name}`)
      if (isTool && name.endsWith(":")) continue;
      problems.push({ rel, line: i + 1, name });
    }
  });
}

if (problems.length === 0) {
  // **逆方向も見る。** 「書いてあるのに動かない」だけでなく、
  // **「動くのに載っていない」**も問題——使えることを知る手段が無く、
  // **同じものを作ってしまう**(2026-08 に `advisor find` で実際に起きた)
  const undocumented = findUndocumented();
  if (undocumented.length > 0) {
    console.error(`❌ package.json にあるのに COMMANDS.md へ載っていないコマンドが ${undocumented.length} 件あります:`);
    console.error(`   ${undocumented.join(" ")}`);
    console.error("");
    console.error("   `docs/ops/COMMANDS.md` に追記するか、内部用なら `INTERNAL_ONLY` に載せてください。");
    console.error("   **載っていないコマンドは、使えることを知る手段がありません**。");
    process.exitCode = 1;
  } else {
    console.log(`✅ 資料に書かれた pnpm コマンドはすべて package.json にあります(${collectDocs().length} ファイル検査)`);
    console.log("   逆に、package.json のコマンドもすべて COMMANDS.md に載っています");
  }
  process.exit(0);
}

console.error("❌ 資料に書いてあるのに実行できないコマンドがあります:");
for (const p of problems) {
  console.error(`   ${p.rel}:${p.line}  pnpm ${p.name}`);
}
console.error("\n   資料の書き換え、または package.json への追加が要ります。");
console.error("   **書いてあるのに動かない**と、資料全体が信用されなくなります。");
process.exitCode = 1;
