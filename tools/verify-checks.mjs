/**
 * **検査が本当に発火するか**を確かめる(自己検証)。
 *   node tools/verify-checks.mjs
 *
 * 【なぜ必要か】
 * 検査が緑でも、それが「問題が無い」からとは限らない。**検査自体が壊れていて
 * 何も見ていない**可能性がある。2026-08 に実際に見つかった例:
 *
 *   - `check-a11y` が `packages` を見ていなかった(違反 10 件が放置)
 *   - `check-jsx-tags` も同様(188 ファイルが未検査)
 *   - `check-app-transpile` が「宣言どうし」を比べており何も検出していなかった
 *   - `A11Y002` が「onKeyDown を付けろ」と言うのに、付けても消えなかった
 *
 * どれも**緑のまま守れていない**状態で、気づいたのは偶然だった。
 *
 * 【やること】
 * 各検査に対して「わざと違反したファイル」を一時的に置き、
 * **赤になること**を確かめる。終わったら必ず消す。
 *
 * 通常の検査と逆向き(緑を確かめるのではなく、赤を確かめる)なので、
 * preflight とは別に実行する。検査を足したときは、ここにも 1 件足すこと。
 */
import { writeFileSync, unlinkSync, existsSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * 検証する項目。
 *
 * `file` に `content` を書き、`tool` を実行して**失敗する**ことを見る。
 * 置き場所は実在するアプリ配下にする(検査の対象範囲に入っている必要があるため)。
 */
const CASES = [
  {
    name: "check-a11y / A11Y002: div の onClick",
    tool: "check-a11y.mjs",
    file: "apps/internal-app/src/app/__verify__/a11y-click.tsx",
    content: 'export function X() { return <div onClick={() => {}}>押す</div>; }\n',
  },
  {
    name: "check-a11y / A11Y006: outline を消して代替なし",
    tool: "check-a11y.mjs",
    file: "packages/ui/src/components/__verify__-focus.tsx",
    content: 'export function X() { return <button className="outline-none px-2">押す</button>; }\n',
  },
  {
    name: "check-a11y / A11Y001: img に alt が無い",
    tool: "check-a11y.mjs",
    file: "apps/internal-app/src/app/__verify__/a11y-img.tsx",
    content: 'export function X() { return <img src="/a.png" />; }\n',
  },
  {
    name: "check-jsx-tags: 閉じていないタグ",
    tool: "check-jsx-tags.mjs",
    file: "packages/ui/src/components/__verify__-jsx.tsx",
    // **対象はインライン要素**(strong/em/b/i/code)。div や span は見ていない
    content: 'export function X() { return <div><strong>あ</div>; }\n',
  },
  {
    name: "check-utc-date: 「今」から UTC の日付を切る",
    tool: "check-utc-date.mjs",
    file: "apps/internal-app/src/app/__verify__/utc.ts",
    content: 'export const today = new Date().toISOString().slice(0, 10);\n',
  },
  {
    name: "check-result-narrowing: f().ok && f().value",
    tool: "check-result-narrowing.mjs",
    file: "apps/internal-app/src/app/__verify__/narrow.ts",
    content: 'declare function f(): { ok: boolean; value?: number };\nexport const v = f().ok && f().value;\n',
  },
  {
    name: "check-app-rules: 生タグ",
    tool: "check-app-rules.mjs",
    file: "apps/internal-app/src/app/__verify__/rawtag.tsx",
    content: 'export function X() { return <button>押す</button>; }\n',
  },
  {
    name: "check-hardcoded-colors: アプリ側の直書き色",
    tool: "check-hardcoded-colors.mjs",
    file: "apps/internal-app/src/app/__verify__/color.tsx",
    // **上限方式**なので、1〜2 箇所では上限を超えず発火しない。
    // 上限に対して確実に超える量を置く
    content: `export function X() { return <div className="${Array.from({ length: 20 }, (_, i) => `bg-red-${(i % 9) + 1}00`).join(" ")}" />; }\n`,
  },
  {
    // **セキュリティに直結する検査**。認可の無い API を素通しすると、
    // URL を知っているだけで誰でも叩ける状態になる
    name: "check-api-auth: 認可も公開宣言も無い API",
    tool: "check-api-auth.mjs",
    file: "apps/internal-app/src/app/api/__verify__/route.ts",
    content: 'export async function GET() { return Response.json({ secret: "見えてはいけない" }); }\n',
  },
  {
    name: "check-auth-stub: 身元が偽物のまま本番ガードも宣言も無い",
    tool: "check-auth-stub.mjs",
    file: "apps/internal-app/src/app/__verify__/stub.ts",
    content: 'export function currentUser() { return { id: "u-1", roles: ["admin"] }; }\n',
  },
  {
    // DOM の型は lib に DOM が無いパッケージでは使えない(tsc が落ちる)
    name: "check-dom-lib: DOM 型を lib:ES2022 のパッケージで使う",
    tool: "check-dom-lib.mjs",
    file: "packages/core/src/__verify__-dom.ts",
    content: 'export function f(el: HTMLElement): void { void el; }\n',
  },
  {
    name: "check-react-import: jsx:react-jsx で不要な React import",
    tool: "check-react-import.mjs",
    file: "packages/ui/src/components/__verify__-react.tsx",
    content: 'import * as React from "react";\nexport function X() { return <div>あ</div>; }\n',
  },
  {
    // 基盤が console を直接使うと、秘密情報の自動マスクが効かない
    name: "check-package-rules: 基盤で console を直接使う",
    tool: "check-package-rules.mjs",
    file: "packages/core/src/__verify__-console.ts",
    content: 'export function f(): void { console.log("秘密かもしれない値"); }\n',
  },
  {
    // "use client" から node: を引き込むと Turbopack が解決できずビルドが落ちる
    name: "check-build-ready: use client から node: を import",
    tool: "check-build-ready.mjs",
    file: "demos/showcase/src/app/__verify__/node-in-client.tsx",
    content: '"use client";\nimport { readFileSync } from "node:fs";\nexport function X() { return <div>{String(readFileSync)}</div>; }\n',
  },
  {
    name: "check-doc-commands: 資料に存在しないコマンドを書く",
    tool: "check-doc-commands.mjs",
    file: "docs/__verify__-command.md",
    content: '# 検証用\n\n`pnpm this-command-does-not-exist` を実行します。\n',
  },
  {
    // CI が壊れると検査すべてが止まる。**落ちるのではなく走らない**ので気づきにくい
    name: "check-workflows: permissions の指定が無いワークフロー",
    tool: "check-workflows.mjs",
    file: ".github/workflows/__verify__.yml",
    content: 'name: verify\non: [push]\njobs:\n  x:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ok\n',
  },
  {
    // XSS。外部由来の文字列をそのまま描画すると、セッションを奪われる
    name: "check-unsafe-html: サニタイズせずに HTML を描画",
    tool: "check-unsafe-html.mjs",
    file: "apps/internal-app/src/app/__verify__/xss.tsx",
    content: 'export function X({ body }: { body: string }) { return <div dangerouslySetInnerHTML={{ __html: body }} />; }\n',
  },
  {
    // 認証の要らない口で AI を呼ぶと、叩かれた分だけ請求が来る
    name: "check-rate-limit: 資源を使う公開 API に制限が無い",
    tool: "check-rate-limit.mjs",
    file: "demos/showcase/src/app/api/__verify__/route.ts",
    content: '// public-api: 検証用\nimport { createAiGateway } from "@platform/ai";\nexport async function POST(): Promise<Response> {\n  const g = createAiGateway({} as never);\n  return Response.json({ g: typeof g });\n}\n',
  },
  {
    // ファイル名ではなく**定義している関数名**で見る検出。
    // 以前は `csv.ts` を `csv-export.ts` に改名するだけで素通りしていた
    name: "check-app-rules: 基盤にある機能をアプリで自作する",
    tool: "check-app-rules.mjs",
    file: "apps/internal-app/src/server/__verify__/bypass.ts",
    content: 'export function validateZipcode(v: string): boolean {\n  return /^\\d{7}$/.test(v);\n}\n',
  },
  {
    // `check-tsdoc` は「書いてあるか」しか見ないため、**間違った説明は 100% 完備と表示される**。
    // 並び順の食い違い(P1)は型が同じだと黙って入れ替わるので、上限を持たず 0 を保つ
    name: "check-tsdoc-params: TSDoc の @param が実装と食い違う",
    tool: "check-tsdoc-params.mjs",
    file: "packages/core/src/__verify__.ts",
    content: '/**\n * 検証用。\n *\n * @param b 2 つ目\n * @param a 1 つ目\n * @returns 和\n */\nexport function verifySwapped(a: number, b: number): number {\n  return a + b;\n}\n',
  },
  {
    // ドット付き(`@param options.foo`)は先頭だけ見ていると素通りする。
    // 実際、余分な @param を機械的に `obj.項目` へ寄せたとき、
    // **中身が出鱈目でも検査が通った**
    name: "check-tsdoc-params: 存在しないプロパティを説明する",
    tool: "check-tsdoc-params.mjs",
    file: "packages/core/src/__verify_props__.ts",
    content: 'interface VerifyOptions {\n  real?: number;\n}\n\n'
      + '/**\n * 検証用。\n *\n * @param options.notAProperty 存在しない項目\n * @returns 値\n */\n'
      + 'export function verifyProps(options: VerifyOptions = {}): number {\n  return options.real ?? 0;\n}\n',
  },
  {
    name: "check-imports: 実在しない名前の import",
    tool: "check-imports.mjs",
    file: "apps/internal-app/src/app/__verify__/import.ts",
    content: 'import { thisDoesNotExistAnywhere } from "@platform/core";\nexport const x = thisDoesNotExistAnywhere;\n',
  },
  {
    // 2026-08 まで「仕組み上できない」に分類していたが、資料を 1 枚置けば
    // 発火する。分類を疑わなかったせいで、この検査が **packages/*/README.md
    // 113 件を見ていなかった**ことに長く気づけなかった
    name: "check-doc-apis: 資料が実在しない API を使う",
    tool: "check-doc-apis.mjs",
    file: "docs/__verify__/doc-apis.md",
    content: '# 検証用\n\n```ts\nimport { thisApiDoesNotExist } from "@platform/core";\n```\n',
  },
  {
    // サブパス(@platform/db/tunnel 等)は 2026-08 まで**丸ごと未検査**だった。
    // バレルだけを試すと、その穴が空いたままでも緑になる
    name: "check-imports: サブパスから実在しない名前の import",
    tool: "check-imports.mjs",
    file: "apps/internal-app/src/app/__verify__/import-subpath.ts",
    content: 'import { thisIsNotInTunnel } from "@platform/db/tunnel";\nexport const y = thisIsNotInTunnel;\n',
  },
];

/** 検査を実行し、失敗した(=発火した)なら true。 */
function fires(tool) {
  try {
    execFileSync(process.execPath, [path.join(ROOT, "tools", tool)], { cwd: ROOT, stdio: "pipe" });
    return false; // 正常終了 = 発火しなかった
  } catch {
    return true;
  }
}

/**
 * **ファイルを 1 つ置くだけでは検証できない検査**と、その理由。
 *
 * ここに挙げたものは `verify-checks` の対象外だが、**未検証のまま忘れない**ために
 * 理由を残す。仕組みを変えて検証できるようにしたら、CASES へ移すこと。
 */
const NOT_VERIFIABLE = {
  "check-deps": "package.json の依存宣言を見る(ファイルの中の import は見ない)",
  "check-lockfile": "pnpm-lock.yaml と package.json の突き合わせ",
  "check-security-headers": "アプリ単位で見る(next.config と proxy.ts の組。ファイル 1 つでは足りない)",
  "check-generated": "生成物の再生成と差分比較(ファイルを足しても関係しない)",
  "check-doc-numbers": "資料の数値と実測の突き合わせ",
  "check-drill": "訓練記録の日付を見る",
  "check-contract": "契約ファイルと実装の突き合わせ",
  "check-path-length": "ファイルパスの長さ(環境依存)",
  "check-win-setup": "setup.ps1 の構文",
  "check-schema": "prisma/schema.prisma の構造",
  "check-env-example": ".env.example と実際の参照の突き合わせ",
  "check-package-shape": "package.json の形(ファイルを足すと逆に検査対象が増える)",
  "check-ports": "各アプリの package.json のポート指定",
  "check-tsdoc": "公開 API の TSDoc(足したファイルの分だけ不足が増えるので、意図と逆になる)",
  "check-core-signatures": "基盤の公開シグネチャの差分",
  "check-app-transpile": "next.config と package.json の突き合わせ",
  "check-showcase-deps": "import と package.json の突き合わせ",
  "check-docs-links": "資料内のリンク先の実在",
  "check-docs-orphans": "資料への到達性",
  "check-docs-duplication": "資料間の重複",
  "check-e2e-quality": "E2E の書き方(e2e/ にファイルを足すと本物の E2E とみなされる)",
  "check-syntax": "全ファイルのパース(壊れたファイルを置けば当然落ちるので、検証の意味が薄い)",
  "check-test-setup": "テスト設定ファイルの整合",
  "check-pwa": "manifest と service worker の設定",
  "check-permissions": "権限ポリシーと使用箇所の突き合わせ",
  "check-maintainability": "行数・ファイルサイズ(上限方式。1 ファイルでは超えない)",
  "check-handmade-chart": "自前グラフの検出(上限 0 なので 1 件置けば落ちるが、SVG を書くだけで誤検知しうる)",
  "check-reimplementation": "基盤と同名の実装(名前が被る関数を足せば落ちるが、意図的な同名との区別が要る)",
};

let ok = 0;
const failed = [];

for (const c of CASES) {
  const abs = path.join(ROOT, c.file);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, c.content);
  let fired = false;
  try {
    fired = fires(c.tool);
  } finally {
    // **必ず消す。** 残すと本番の検査が赤のままになる
    if (existsSync(abs)) unlinkSync(abs);
    const dir = path.dirname(abs);
    if (dir.endsWith("__verify__")) rmSync(dir, { recursive: true, force: true });
  }
  if (fired) {
    ok += 1;
    console.log(`  ✅ ${c.name}`);
  } else {
    failed.push(c.name);
    console.log(`  ❌ ${c.name} … **違反を置いても検査が通ってしまいました**`);
  }
}

// **網羅状況を出す。** 「15 件通った」だけだと、残りが見えず
// 「全部確かめた」と誤解する。何を確かめていないかを毎回示す。
const allTools = readdirSync(path.join(ROOT, "tools"))
  .filter((f) => f.startsWith("check-") && f.endsWith(".mjs"))
  .map((f) => f.replace(/\.mjs$/, ""));
const verified = new Set(CASES.map((c) => c.tool.replace(/\.mjs$/, "")));
const unknown = allTools.filter((t) => !verified.has(t) && !(t in NOT_VERIFIABLE));

console.log("");
console.log(`   検査 ${allTools.length} 件 / 発火を確認 ${verified.size} 件 / 仕組み上できない ${Object.keys(NOT_VERIFIABLE).length} 件`);
if (unknown.length > 0) {
  console.log(`   ⚠ 未分類 ${unknown.length} 件: ${unknown.join(", ")}`);
  console.log("     CASES に足すか、できない理由を NOT_VERIFIABLE に書いてください");
}

if (failed.length === 0) {
  console.log(`✅ ${ok} 件の検査が、違反を置くと赤になります(見張りが生きています)`);
  process.exit(unknown.length > 0 ? 1 : 0);
}
console.log(`❌ ${failed.length} 件の検査が発火しません。**緑でも守れていない状態です**。`);
console.log("   対象範囲(どのディレクトリを見ているか)と判定条件を確かめてください。");
process.exitCode = 1;
