/**
 * 各アプリの next.config の `transpilePackages` が、**実際に import している**
 * `@platform/*` をすべて含むかを検査する。
 *
 * なぜ必要か: 基盤パッケージは main が `src/index.ts`(生 TS)を指す。next.config の
 * transpilePackages に載らないパッケージを import すると **next build だけが落ちる**
 * (typecheck も smoke も通るため、ビルドするまで気づけない)。
 *
 * 【なぜ package.json ではなくソースを見るか】
 * 以前は package.json の依存と transpilePackages を突き合わせていた。だが各アプリの
 * next.config は **transpilePackages を package.json から導出している**ため、
 * これは「宣言と、その宣言から作った値」を比べているだけで、常に一致する。
 * 実際にこの検査が緑のまま、internal-app が **17 パッケージを未宣言で import** していた
 * (`@platform/auth` `@platform/security` `@platform/pii` を含む)。
 * 動いていたのは Amplify が `--node-linker=hoisted` で全部を平らに置くからで、
 * 解決方式が変われば一斉に落ちる。`.npmrc` が掲げる「隠れ依存を防ぐ」とも逆の状態だった。
 *
 * 直し方は **package.json に依存を宣言する**こと(transpilePackages は自動で追従する)。
 *
 *   node tools/check-app-transpile.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** 検査対象(アプリとデモ。どちらも next build する)。 */
const TARGETS = [
  ...fs.readdirSync(path.join(ROOT, "apps")).sort().map((n) => ["apps", n]),
];

/**
 * ソースから実際に import している `@platform/*` を集める。
 *
 * サブパス(`@platform/ui/icons`)もパッケージ名に丸める。動的 import と
 * `require` も拾う(どちらも解決時に transpile が要る)。
 *
 * @param srcDir 走査するディレクトリ
 * @returns パッケージ名の集合
 */
function importedPlatformPackages(srcDir) {
  const found = new Set();
  if (!fs.existsSync(srcDir)) return found;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) continue;
      const text = fs.readFileSync(full, "utf8");
      for (const m of text.matchAll(/(?:from|import|require)\s*\(?\s*["'`](@platform\/[a-z0-9-]+)/g)) {
        found.add(m[1]);
      }
    }
  };
  walk(srcDir);
  return found;
}

let bad = 0;
let checked = 0;
for (const [group, app] of TARGETS) {
  const dir = path.join(ROOT, group, app);
  const pj = path.join(dir, "package.json");
  const cfg = ["next.config.mjs", "next.config.js"]
    .map((f) => path.join(dir, f))
    .find((f) => fs.existsSync(f));
  if (!fs.existsSync(pj) || !cfg) continue;

  const pkg = JSON.parse(fs.readFileSync(pj, "utf8"));
  const declared = new Set(
    Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter((d) => d.startsWith("@platform/")),
  );
  const imported = importedPlatformPackages(path.join(dir, "src"));
  // 宣言だけあって使っていないものは無害なので見ない。**使っているのに載っていない**方が危ない
  const deps = [...imported];
  const undeclared = deps.filter((d) => !declared.has(d));

  let listed;
  try {
    const mod = await import(pathToFileURL(cfg).href);
    listed = new Set(mod.default?.transpilePackages ?? []);
  } catch (e) {
    bad += 1;
    console.error(`❌ ${app}: next.config の読み込みに失敗しました(${e.message})`);
    continue;
  }

  const missing = deps.filter((d) => !listed.has(d));
  checked += 1;
  if (missing.length > 0) {
    bad += 1;
    console.error(
      `❌ ${app}: import しているのに transpilePackages に無い ${missing.length} 件` +
      `(next build で失敗します): ${missing.map((d) => d.replace("@platform/", "")).join(", ")}`,
    );
    if (undeclared.length > 0) {
      console.error(
        `   原因: package.json に宣言されていません。${app}/package.json の dependencies に足してください` +
        `(transpilePackages は自動で追従します)`,
      );
    }
  } else {
    console.log(`✅ ${app}: import している @platform/* ${deps.length} 件すべてが transpilePackages にあります`);
  }
}

if (bad > 0) {
  console.error(
    `\n${bad} 件で transpilePackages が不足しています。package.json に依存を宣言してください(隠れ依存は解決方式が変わると一斉に落ちます)。`,
  );
  process.exitCode = 1;
} else {
  console.log(`\n✅ 全 ${checked} アプリ/デモの transpilePackages は、実際に import している @platform/* を網羅しています`);
}
