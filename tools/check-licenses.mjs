#!/usr/bin/env node
/**
 * **依存ライブラリのライセンス**を確かめる。
 *
 * ```bash
 * node tools/check-licenses.mjs            # 禁止ライセンスがあれば失敗
 * node tools/check-licenses.mjs --list     # 内訳を出す
 * node tools/check-licenses.mjs --set-allow # いま入っている不明分を許可一覧へ
 * ```
 *
 * 【なぜ要るか】
 * `pnpm audit` は**脆弱性**を見るが、**ライセンスは見ていない**。
 *
 * 社内利用だけなら多くのライセンスは問題ない。**問題になるのは配る瞬間**:
 *
 * | 場面 | 何が起きるか |
 * |---|---|
 * | 顧客へ納品する | **GPL / AGPL** を含むと、**自社のソース開示を求められうる** |
 * | SaaS として提供する | **AGPL** はネットワーク越しの利用でも開示義務が及ぶ |
 * | 取引先の調達審査 | ライセンス一覧の提出を求められる。**その場で作れない** |
 *
 * **後から剥がすのは高くつく。** 深く使ってから気づくと、代替探しと書き直しになる。
 * **入った時点で気づく**のが唯一安いタイミング。
 *
 * 【判定】
 * `node_modules/.pnpm` 配下の `package.json` から `license` を集め、
 * - **禁止**(copyleft の強いもの)があれば**失敗**
 * - **不明**なものは `tools/license-allow.json` に記録した分だけ通す(ラチェット)
 *
 * 【この検査がしないこと】
 * **法的な判断はしない。** ライセンス名を機械的に照合するだけで、
 * デュアルライセンスの選択や例外条項(GPL linking exception など)は読まない。
 * **判断は人がする**——ここは「見落とさない」ための道具。
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ALLOW_FILE = path.join(ROOT, "tools", "license-allow.json");
const STORE = path.join(ROOT, "node_modules", ".pnpm");

const list = process.argv.includes("--list");
const setAllow = process.argv.includes("--set-allow");

/**
 * **配布すると自社ソースの開示を求められうるもの。**
 *
 * LGPL は動的リンクなら通常は問題にならないが、**バンドルすると静的リンク相当**
 * になりうる——Next のビルドは依存を 1 つのファイルへまとめるので、ここに入れる。
 */
const FORBIDDEN = [
  "GPL-2.0", "GPL-3.0", "GPL-2.0-only", "GPL-3.0-only",
  "GPL-2.0-or-later", "GPL-3.0-or-later",
  "AGPL-1.0", "AGPL-3.0", "AGPL-3.0-only", "AGPL-3.0-or-later",
  "LGPL-2.1", "LGPL-3.0", "LGPL-2.1-only", "LGPL-3.0-only",
  "LGPL-2.1-or-later", "LGPL-3.0-or-later",
  "SSPL-1.0",           // MongoDB。SaaS 提供で問題になる
  "BUSL-1.1",           // 期限付きで商用利用に制限
  "CC-BY-NC-4.0",       // 非商用のみ
  "Commons-Clause",
];

/**
 * **社内利用でも配布でも問題にならないもの。**
 * ここに無いものが「不明」として一覧に出る(禁止ではない)。
 */
const PERMISSIVE = new Set([
  "MIT", "ISC", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "0BSD",
  "Unlicense", "CC0-1.0", "WTFPL", "Zlib", "BlueOak-1.0.0",
  "Python-2.0", "MIT-0", "Artistic-2.0", "CC-BY-4.0", "MPL-2.0",
]);

/** ライセンス表記を正規化する(`(MIT OR Apache-2.0)` のような書き方がある)。 */
function normalize(raw) {
  if (raw === undefined || raw === null) return [];
  const text = typeof raw === "string" ? raw : (raw.type ?? "");
  if (text === "") return [];
  // **OR は「どれか 1 つを選べる」。** 1 つでも通れば通す
  return text
    .replace(/[()]/g, " ")
    .split(/\s+(?:OR|AND)\s+/i)
    .map((s) => s.trim())
    .filter((s) => s !== "" && s !== "SEE" && s !== "LICENSE");
}

if (!existsSync(STORE)) {
  // **skip でも数を出す。** 「何も見ていない」ことが分かるようにする
  console.log("⏭  check-licenses は skip しました(0 パッケージ / node_modules がありません)。`pnpm install` 後に再実行してください");
  console.log("   ※ この検査だけは依存が要ります。CI では install 済みなので必ず走ります");
  process.exit(0);
}

/** パッケージ名 → ライセンス一覧。 */
const found = new Map();
let scanned = 0;

for (const entry of readdirSync(STORE)) {
  const modules = path.join(STORE, entry, "node_modules");
  if (!existsSync(modules)) continue;
  // スコープ付き(@scope/name)も辿る
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
      if (typeof pkg.name !== "string") continue;
      scanned += 1;
      const licenses = normalize(pkg.license ?? pkg.licenses);
      const key = `${pkg.name}@${pkg.version ?? "?"}`;
      if (!found.has(key)) found.set(key, licenses);
    }
  }
}

const allow = existsSync(ALLOW_FILE)
  ? JSON.parse(readFileSync(ALLOW_FILE, "utf8"))
  : { unknown: [], note: "" };

const forbidden = [];
const unknown = [];
const counts = new Map();

for (const [name, licenses] of found) {
  if (licenses.length === 0) {
    unknown.push({ name, license: "(記載なし)" });
    continue;
  }
  for (const l of licenses) counts.set(l, (counts.get(l) ?? 0) + 1);
  // OR のうち 1 つでも許容できれば通す
  if (licenses.some((l) => PERMISSIVE.has(l))) continue;
  const bad = licenses.find((l) => FORBIDDEN.includes(l));
  if (bad !== undefined) {
    forbidden.push({ name, license: bad });
    continue;
  }
  unknown.push({ name, license: licenses.join(" OR ") });
}

if (list) {
  console.log(`ライセンスの内訳(${found.size} パッケージ / ${scanned} 件を走査):`);
  for (const [l, n] of [...counts].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(5)}  ${l}`);
  }
  if (unknown.length > 0) {
    console.log(`\n判断が要るもの(${unknown.length} 件):`);
    for (const u of unknown) console.log(`  ${u.name}: ${u.license}`);
  }
  process.exit(0);
}

if (setAllow) {
  const next = {
    note:
      "許容と判断した依存。**名前を足す前に、その依存のライセンスを実際に読むこと。**"
      + "この一覧は「確認済み」の記録であって、免罪符ではない。",
    unknown: unknown.map((u) => `${u.name}: ${u.license}`).sort(),
  };
  writeFileSync(ALLOW_FILE, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  console.log(`✅ ${path.relative(ROOT, ALLOW_FILE)} に ${next.unknown.length} 件を記録しました`);
  console.log("   **中身を必ず読んでください。** 記録しただけでは確認したことになりません");
  process.exit(0);
}

const allowSet = new Set(allow.unknown ?? []);
const newUnknown = unknown.filter((u) => !allowSet.has(`${u.name}: ${u.license}`));

if (forbidden.length === 0 && newUnknown.length === 0) {
  console.log(
    `✅ 依存のライセンスは基準内(${found.size} パッケージ / 禁止 0 件 / 確認済み ${allowSet.size} 件)`,
  );
  process.exit(0);
}

if (forbidden.length > 0) {
  console.error(`❌ 配布できないライセンスの依存が ${forbidden.length} 件あります(${found.size} パッケージを検査):`);
  for (const f of forbidden) console.error(`   ${f.name}: ${f.license}`);
  console.error("");
  console.error("   **顧客へ納品する・SaaS として提供する場合、自社ソースの開示を求められうる**ものです。");
  console.error("   代替を探すか、法務の判断を仰いでください。");
  console.error("   社内利用に限ると決めたなら、その判断を ADR に残してから許可一覧へ入れてください。");
}

if (newUnknown.length > 0) {
  console.error(`\n⚠ 判断が要る依存が ${newUnknown.length} 件あります(前回まで無かったもの):`);
  for (const u of newUnknown.slice(0, 20)) console.error(`   ${u.name}: ${u.license}`);
  if (newUnknown.length > 20) console.error(`   …ほか ${newUnknown.length - 20} 件`);
  console.error("");
  console.error("   中身を読んで問題なければ: node tools/check-licenses.mjs --set-allow");
  console.error("   **読まずに登録しないこと。** 記録は「確認済み」の意味を持ちます。");
}

process.exit(1);
