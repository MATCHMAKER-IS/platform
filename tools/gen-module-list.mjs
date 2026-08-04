/**
 * docs/ai/module-list.md を自動生成する。パッケージをカテゴリ別に一覧化し、
 * 各パッケージの1行説明(README冒頭)と主なエクスポート(api-surface)を載せる。
 * AI(Claude Code等)が「使える部品」を素早く把握するためのインデックス。
 * 使い方: node tools/gen-module-list.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { CATEGORIES } from "./package-categories.mjs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const surface = JSON.parse(fs.readFileSync(path.join(root, "docs/platform/api-surface.json"), "utf8"));


/**
 * package.json の `exports` から、バレル(`.`)以外の入口を取り出す。
 *
 * CSS やビルド設定(`@platform/config/vitest`)は import して使うものでは
 * ないので外す。
 */
function subpathsOf(pkg) {
  const p = path.join(root, "packages", pkg, "package.json");
  if (!fs.existsSync(p)) return [];
  const field = JSON.parse(fs.readFileSync(p, "utf8")).exports;
  if (field === undefined || typeof field === "string") return [];
  return Object.entries(field)
    .filter(([k, v]) => k !== "." && typeof v === "string" && /\.tsx?$/.test(v))
    .map(([k]) => k)
    .sort();
}

function firstLine(pkg) {
  const readme = path.join(root, "packages", pkg, "README.md");
  if (!fs.existsSync(readme)) return "";
  const lines = fs.readFileSync(readme, "utf8").split("\n").map((l) => l.trim());
  return lines.find((l) => l && !l.startsWith("#")) ?? "";
}

const all = new Set(fs.readdirSync(path.join(root, "packages")).filter((d) => fs.statSync(path.join(root, "packages", d)).isDirectory()));

/**
 * どこから使われているかを、**利用側の種類ごとに**集める。
 *
 * 【なぜ種類を分けるか】
 * 以前は apps / demos / packages をまとめて「使われている」と数えていた。
 * その結果 **114 個中 112 個が「実戦投入済み」**と表示されていたが、
 * 実際にアプリで使われているのは 69 個で、**38 個はデモでしか動いていなかった**。
 *
 * デモは正常系を見せるためのもので、実データ・実負荷・異常系を通らない。
 * 「デモで動いた」と「業務で使われている」を同じ印にすると、
 * **選ぶ人が検証の度合いを誤解する**。中核の `validation` や `guard` が
 * デモのみだった事実も、まとめていたせいで見えなかった。
 */
const usedBy = { apps: new Set(), demos: new Set(), packages: new Set() };
for (const group of ["apps", "demos", "packages"]) {
  const groupDir = path.join(root, group);
  if (!fs.existsSync(groupDir)) continue;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) continue;
      // 生成物は対象外。リファレンスデータには**全パッケージ名が載る**ため、
      // 含めると「全部使われている」ことになり判定が意味を失う
      if (entry.name.includes(".generated.")) continue;
      // **import 文だけ**を見る。TSDoc の言及まで数えると「関連パッケージを
      // 説明しているだけ」で使用済みになり、判定が甘くなる
      const text = fs.readFileSync(full, "utf8");
      // 自分自身への参照は「使われている」に数えない
      const owner = group === "packages" ? full.slice(groupDir.length + 1).split(path.sep)[0] : null;
      for (const m of text.matchAll(/(?:from|import|require)\s*\(?\s*["'`]@platform\/([a-z0-9-]+)/g)) {
        if (m[1] !== owner) usedBy[group].add(m[1]);
      }
    }
  };
  walk(groupDir);
}
const categorized = new Set(Object.values(CATEGORIES).flat());
/**
 * 未実戦のままにしている理由。
 *
 * **「作り忘れ」と「意図して使っていない」は違う。** 理由を書かないと、
 * 次の人が「デモを作らなければ」と考えて無駄な労力を使うか、逆に
 * 「使われていないから消してよい」と誤解する。
 *
 * ここに載せても **⚠ は消さない**(実際に動作は確かめられていないため)。
 * 添えるのは理由だけ。
 */
const UNUSED_REASONS = {
  stripe: "公式 SDK(`stripe`)のラッパーで、**fetch を差し替える口が無い**。"
    + "注入口を足すと SDK の使い方を歪めるため、デモ化は見送っている。"
    + "**契約テストも効かない**(ラッパーが応答のフィールドを直接参照せず SDK に委ねているため、"
    + "`check-contract` の C003 が「実装が参照していない」と判定する)。"
    + "確認は sandbox キーでの実接続に頼るしかない。",
  testing: "テストを書くための支援ツール。**テストの中から使う**ものなので、"
    + "アプリやデモから import されないのが正常。",
};

const uncat = [...all].filter((p) => !categorized.has(p));

let out = "# パッケージ一覧(カテゴリ別)\n\n"
  + "> 自動生成: `node tools/gen-module-list.mjs`(手で編集しない)。\n"
  + "> 目的: AI・新規参加者が「既にある部品」を再実装せず使うためのインデックス。詳細は各 `packages/<name>/README.md` を参照。\n"
  + ">\n"
  + "> 印は**どこまで動作が確かめられているか**を示す(自動判定)。\n"
  + ">\n"
  + "> - 印なし … `apps/` の実アプリで使われている\n"
  + "> - **⚠ デモのみ** … `demos/` でしか使われていない。**正常系しか通っていない**ので、\n"
  + ">   実データ・異常系で最初に使う人がバグを踏む可能性がある\n"
  + "> - **⚠ 未実戦** … どこからも import されていない。動作が一度も確かめられていない\n"
  + ">\n"
  + "> 意図して使っていないものには「未実戦の理由」を添えてある。\n\n";
let count = 0;
for (const [cat, pkgs] of Object.entries(CATEGORIES)) {
  const present = pkgs.filter((p) => all.has(p));
  if (present.length === 0) continue;
  out += `## ${cat}\n\n`;
  for (const p of present) {
    const exports = surface[`@platform/${p}`] ?? [];
    const desc = firstLine(p);
    const top = exports.slice(0, 6).join(", ") + (exports.length > 6 ? `, …(全${exports.length})` : "");
    // 3 段階で示す。**「デモのみ」を実戦と同じ扱いにしない**
    const mark = usedBy.apps.has(p) ? ""
      : usedBy.demos.has(p) ? " **⚠ デモのみ**"
      : " **⚠ 未実戦**";
    out += `- **@platform/${p}**${mark} — ${desc}\n  - 主なexport: ${top || "(api-surface未計上)"}\n`;
    // **サブパスは名前だけでは辿り着けない。**
    // 主なexport は先頭 6 件しか出さないので、バレルから再 export しない
    // `@platform/db/tunnel` のような入口は「…(全75)」に畳まれて見えなくなる。
    // import 文をそのまま書けるよう、入口を明示する
    const subpaths = subpathsOf(p);
    if (subpaths.length > 0) out += `  - サブパス: ${subpaths.map((s) => `\`@platform/${p}${s.slice(1)}\``).join(" / ")}\n`;
    // 意図して使っていないものは、その理由を添える(作り忘れと区別できるように)
    const reason = usedBy.apps.has(p) ? undefined : UNUSED_REASONS[p];
    if (reason !== undefined) out += `  - 未実戦の理由: ${reason}\n`;
    count += 1;
  }
  out += "\n";
}
if (uncat.length > 0) out += `## 未分類\n\n${uncat.map((p) => `- @platform/${p}`).join("\n")}\n`;
fs.writeFileSync(path.join(root, "docs/ai/module-list.md"), out);
const inApps = [...all].filter((p) => usedBy.apps.has(p)).sort();
const demoOnly = [...all].filter((p) => !usedBy.apps.has(p) && usedBy.demos.has(p)).sort();
const unused = [...all].filter((p) => !usedBy.apps.has(p) && !usedBy.demos.has(p)).sort();
console.log(`✅ docs/ai/module-list.md 生成: ${count} パッケージ / 未分類 ${uncat.length}`);
console.log(`   アプリで使用 ${inApps.length} / デモのみ ${demoOnly.length} / 未実戦 ${unused.length}`);
if (demoOnly.length > 0) console.log(`   デモのみ: ${demoOnly.join(", ")}`);
if (unused.length > 0) console.log(`   未実戦: ${unused.join(", ")}`);
