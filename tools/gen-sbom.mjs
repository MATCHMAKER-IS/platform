#!/usr/bin/env node
/**
 * **SBOM**(ソフトウェア部品表)を作る。CycloneDX 形式。
 *
 * ```bash
 * node tools/gen-sbom.mjs                 # docs/platform/sbom.json に出力
 * node tools/gen-sbom.mjs --out /tmp/x.json
 * ```
 *
 * 【何のためにあるか】
 * **「このシステムは何でできているか」の一覧**です。
 *
 * | 場面 | 無いとどうなるか |
 * |---|---|
 * | 取引先の調達審査 | 提出を求められて**その場で作れない**。数日止まる |
 * | 脆弱性の一報が出た | 「うちは影響あるか」を**すぐ答えられない**(log4j のとき各社が困った) |
 * | 引き継ぎ | 何に依存しているかが、**人の記憶**にしか無い |
 *
 * **作るのは一瞬、要求されてから作るのは遅い。** リリースのたびに自動で出す。
 *
 * 【なぜ外部ツールを使わないか】
 * `@cyclonedx/cyclonedx-npm` は pnpm のワークスペースを正しく辿れないことがあり、
 * **依存を 1 つ増やす**ことにもなる。必要なのは
 * 「名前・版・ライセンス・PURL」だけなので、`node_modules/.pnpm` から直接集める。
 *
 * 【この SBOM に**入らない**もの】
 * - **OS のパッケージ**(コンテナのベースイメージ側)。Docker の SBOM は別途必要
 * - **実行時にだけ取ってくるもの**(CDN のスクリプトなど)
 *
 * つまり**これだけで「全部」ではない**。そう書いてある前提で使うこと。
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STORE = path.join(ROOT, "node_modules", ".pnpm");

const outArg = process.argv.indexOf("--out");
const OUT = outArg >= 0
  ? path.resolve(process.argv[outArg + 1] ?? "")
  : path.join(ROOT, "docs", "platform", "sbom.json");

if (!existsSync(STORE)) {
  console.log("⏭  gen-sbom は skip しました(node_modules がありません)。`pnpm install` 後に再実行してください");
  process.exit(0);
}

/** ライセンス表記を配列にする。 */
function licensesOf(pkg) {
  const raw = pkg.license ?? pkg.licenses;
  if (typeof raw === "string") {
    return raw.includes(" OR ") || raw.includes(" AND ")
      ? [{ expression: raw }]
      : [{ license: { id: raw } }];
  }
  if (Array.isArray(raw)) return raw.map((l) => ({ license: { id: l.type ?? String(l) } }));
  if (raw !== null && typeof raw === "object" && typeof raw.type === "string") {
    return [{ license: { id: raw.type } }];
  }
  return [];
}

const components = new Map();

for (const entry of readdirSync(STORE)) {
  const modules = path.join(STORE, entry, "node_modules");
  if (!existsSync(modules)) continue;
  for (const first of readdirSync(modules)) {
    const dirs = first.startsWith("@")
      ? readdirSync(path.join(modules, first)).map((n) => path.join(first, n))
      : [first];
    for (const rel of dirs) {
      const pkgPath = path.join(modules, rel, "package.json");
      if (!existsSync(pkgPath) || !statSync(pkgPath).isFile()) continue;
      let pkg;
      try {
        pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      } catch {
        continue;
      }
      if (typeof pkg.name !== "string" || typeof pkg.version !== "string") continue;
      // **社内パッケージは「部品」ではなく「本体」。** 外部依存だけを載せる
      if (pkg.name.startsWith("@platform/")) continue;
      const key = `${pkg.name}@${pkg.version}`;
      if (components.has(key)) continue;
      components.set(key, {
        type: "library",
        name: pkg.name,
        version: pkg.version,
        // PURL(Package URL)。**照合の鍵になる**ので必ず入れる
        purl: `pkg:npm/${pkg.name.replace("@", "%40")}@${pkg.version}`,
        ...(licensesOf(pkg).length > 0 ? { licenses: licensesOf(pkg) } : {}),
        ...(typeof pkg.description === "string" ? { description: pkg.description.slice(0, 200) } : {}),
      });
    }
  }
}

const rootPkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));

const sbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.5",
  version: 1,
  metadata: {
    // **生成日時は入れない。** 中身が同じでも毎回差分が出て、
    // 「何が変わったか」が読めなくなる(コミットするファイルなので)
    tools: [{ vendor: "in-house", name: "tools/gen-sbom.mjs" }],
    component: {
      type: "application",
      name: rootPkg.name ?? "platform",
      version: rootPkg.version ?? "0.0.0",
    },
    properties: [
      {
        name: "scope:note",
        value:
          "npm の依存のみ。OS パッケージ(コンテナのベースイメージ)と、"
          + "実行時に取得するもの(CDN のスクリプト等)は含まない",
      },
    ],
  },
  components: [...components.values()].sort((a, b) => (a.purl < b.purl ? -1 : 1)),
};

mkdirSync(path.dirname(OUT), { recursive: true });
const json = `${JSON.stringify(sbom, null, 2)}\n`;
writeFileSync(OUT, json, "utf8");

const digest = createHash("sha256").update(json).digest("hex").slice(0, 12);
console.log(`✅ SBOM を出力しました: ${path.relative(ROOT, OUT)}`);
console.log(`   部品 ${sbom.components.length} 件 / sha256:${digest}`);
console.log("   ※ npm の依存のみ。OS パッケージと実行時取得分は含みません");
