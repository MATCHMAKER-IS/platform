/**
 * **サニタイズしていない HTML を描画していないか**を検査する。
 *   node tools/check-unsafe-html.mjs
 *
 * 【なぜ必要か】
 * `dangerouslySetInnerHTML` に外部由来の文字列を渡すと **XSS** になる。
 * `<script>` を仕込まれれば、その画面を開いた人のセッションが奪われる。
 *
 * 「管理者しか入力しないから安全」という前提は崩れやすい:
 *   - 管理画面に入れる人は時間とともに増える
 *   - **乗っ取られた 1 アカウント**で全ページに仕込まれる
 *   - 外部連携で入ってきたデータが、いつの間にか同じ経路に載る
 *
 * 実際にこの基盤でも、CMS の「埋め込み」ブロックが素通しになっていた
 * (`embedHtml` は引数をそのまま返すだけの関数だった)。
 *
 * 【安全とみなすもの】
 *   - `sanitize()` / `sanitizeEmbed()`(@platform/security)を通している
 *   - `escapeHtml()` / `linkify()` / `nl2br()`(@platform/html)を通している
 *   - 同じファイルで組み立てた定数(外部由来でない)
 *   - `// unsafe-html: 理由` を直前に書いてある(意図的な例外)
 *
 * 【実行】
 *   node tools/check-unsafe-html.mjs          … 検査する
 *   node tools/check-unsafe-html.mjs --list   … 該当箇所を一覧
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { argsAt } from "./lib/source-text.mjs";
import { fileURLToPath } from "node:url";
import { ALWAYS_SKIP } from "./lib/collect-files.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TARGET_DIRS = ["apps", "packages"];

/**
 * 通していれば安全とみなす関数。
 *
 * 2 種類ある:
 *   1. **無害化するもの** … sanitize / escapeHtml など。外部由来でも安全になる
 *   2. **基盤が組み立てるもの** … qrSvg / renderErrorPage など。
 *      入力から HTML を生成する側なので、そもそも外部の HTML が入らない
 */
const SAFE_FUNCTIONS = new RegExp(
  "\\b(" + [
    // 無害化
    "sanitize", "sanitizeEmbed", "escapeHtml", "escapeAttribute", "linkify", "nl2br",
    // 基盤が組み立てる(外部の HTML をそのまま通さない)
    "embedIframe", "qrSvg", "barcodeSvg", "renderErrorPage", "buildThemeStylesheet",
  ].join("|") + ")\\s*\\(",
);

/** 意図的な例外の宣言。`// public-api:` と同じ作法。 */
// **コメントの書き方は 1 つに絞らない。** `//` `/* */` `{/* */}` `* `(TSDoc)の
// どれでもよい。書式を強いると、その形にできない場所で宣言を諦めることになる
const DECLARED = /unsafe-html:/;

/** 走査対象の .tsx を集める。 */
function collect(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (ALWAYS_SKIP.has(e.name)) continue;
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) collect(fp, out);
    else if (e.name.endsWith(".tsx") && !e.name.includes(".test.")) out.push(fp);
  }
  return out;
}

const problems = [];
let scanned = 0;

for (const base of TARGET_DIRS) {
  for (const file of collect(path.join(ROOT, base))) {
    scanned += 1;
    const src = readFileSync(file, "utf8");
    if (!src.includes("dangerouslySetInnerHTML")) continue;
    const rel = path.relative(ROOT, file).replace(/\\/g, "/");
    const lines = src.split("\n");

    for (let i = 0; i < lines.length; i += 1) {
      if (!lines[i].includes("dangerouslySetInnerHTML")) continue;
      // **コメント内の言及は対象外。**
      // 「以前は dangerouslySetInnerHTML で流していた」という
      // 説明文まで拾うと、直した箇所が指摘され続ける(2026-08)
      const t = lines[i].trim();
      if (/^(\/\/|\*|\{?\/\*)/.test(t)) continue;
      // 実際に渡している行だけ(`dangerouslySetInnerHTML={` や `: {`)
      if (!/dangerouslySetInnerHTML\s*[:=]/.test(lines[i])) continue;

      // 前後 3 行を見る。`__html:` が次の行にあることが多い
      const around = lines.slice(Math.max(0, i - 3), i + 4).join("\n");
      if (SAFE_FUNCTIONS.test(around)) continue;
      // **宣言はファイルのどこにあってもよい。** 関数の TSDoc に理由を書くのが自然で、
      // 描画箇所から離れることがある(近くに書けと強いると、読みにくいコードになる)
      if (DECLARED.test(src)) continue;

      // 同じファイル内で組み立てた変数なら、その定義を追って判定する。
      // `const x = sanitize(...)` のように、離れた場所で通していることがある
      const m = /__html:\s*([A-Za-z_$][\w$.]*)/.exec(around);
      if (m) {
        const name = m[1].split(".")[0];
        // その変数の定義を追う。**さらにその元も追う**
        // (`const a = html.slice(...)` → `const html = renderErrorPage(...)` のような連鎖)
        let cur = name;
        let safe = false;
        for (let depth = 0; depth < 3 && !safe; depth += 1) {
          const def = new RegExp(`(const|let)\\s+${cur}\\s*=([^;\\n]*)`).exec(src);
          if (!def) break;
          if (SAFE_FUNCTIONS.test(def[2])) { safe = true; break; }
          const next = /([A-Za-z_$][\w$]*)\s*\./.exec(def[2]);
          if (!next || next[1] === cur) break;
          cur = next[1];
        }
        if (safe) continue;
        // useState の初期値が空文字なら、setter に入る値を見る
        const setter = `set${name.charAt(0).toUpperCase()}${name.slice(1)}`;
        if (src.includes(setter)) {
          // **`[^)]*` で引数を取らない。** `setX(sanitize(escape(v)))` のように
          // 入れ子があると `escape(v` で切れ、SAFE_FUNCTIONS の判定を誤る。
          // ここは切れても「安全と認めない」側に倒れるので実害は無かったが、
          // **同じ書き方を他所へ写されると誤検出の側に倒れる**ので正しくする。
          const calls = [...src.matchAll(new RegExp(`${setter}\\(`, "g"))]
            .map((m) => [m[0], argsAt(src, m.index + m[0].length - 1)]);
          if (calls.length > 0 && calls.every((c) => /^\s*("".*|''.*|r\.value|[a-z]+\.value)\s*$/.test(c[1]) || SAFE_FUNCTIONS.test(c[1]))) continue;
        }
      }

      problems.push({ rel, line: i + 1, snippet: lines[i].trim().slice(0, 80) });
    }
  }
}

if (process.argv.includes("--list")) {
  for (const p of problems) console.log(`  ${p.rel}:${p.line}  ${p.snippet}`);
}

if (problems.length === 0) {
  console.log(`✅ サニタイズしていない HTML の描画はありません(${scanned} ファイルを検査)`);
  process.exit(0);
}

for (const p of problems) {
  console.error(`❌ ${p.rel}:${p.line} サニタイズを通していない可能性があります`);
}
console.error("");
console.error("   外部由来の文字列を dangerouslySetInnerHTML に渡すと XSS になります。");
console.error("   `sanitize()` / `sanitizeEmbed()`(@platform/security)を通してください。");
console.error("   意図的なら、直前に `// unsafe-html: 理由` と書いてください。");
process.exitCode = 1;
