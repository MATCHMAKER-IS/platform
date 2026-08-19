/**
 * **検査が本当に発火するか**を確かめる(自己検証)。
 *   node tools/verify-checks.mjs
 *
 * 【上限方式の検査を確かめるとき】
 * **上限が 0 の項目を選ぶ。**
 * `check-tsdoc-params` の検証が「存在しないプロパティ」(P3・上限 252)に
 * 当たっており、**1 件置いても上限内で通っていた**(2026-08 に気づいた)。
 * 上限を持たない P1(並び順)に差し替えて解決した。
 *
 * 上限が 0 でないもの:
 * - `tsdoc-params` の P2 / P3 / P4 … P1(並び順)で確かめる
 * - `app-bypass` … 生タグ(上限 0)で確かめる
 * - `maintainability` … **仕組み上できない**(ファイルを大きくしないと発火しない)
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
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { createHash } from "node:crypto";
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
    // **公開漏れは実際に作れる。** `index.ts` から出ていないファイルを置けば発火する
    name: "check-unreachable-modules: index から出ていない実装を足す",
    tool: "check-unreachable-modules.mjs",
    file: "packages/utils/src/__verify_unreachable__.ts",
    content: "export function verifyUnreachable(): number {\n  return 1;\n}\n",
  },
  {
    name: "check-unguarded-json-parse: try/catch で守られていない JSON.parse",
    tool: "check-unguarded-json-parse.mjs",
    file: "packages/utils/src/__verify_parse__.ts",
    content: "export function verifyParse(text: string): unknown {\n"
      + "  return JSON.parse(text);\n}\n",
  },
  {
    name: "check-server-localtime: サーバ側でローカル時刻を使う",
    tool: "check-server-localtime.mjs",
    file: "apps/internal-app/src/server/__verify_tz__.ts",
    content: "export function verifyTz(d: Date): number {\n"
      + "  return d.getFullYear();\n}\n",
  },
  {
    // **索引の無い列で絞ると落ちる。**
    // **数人の間はどう書いても速い**ので、**遅くなってから気づきます**。
    name: "check-missing-index: 索引の無い列で findMany を絞る",
    tool: "check-missing-index.mjs",
    file: "apps/internal-app/src/server/dummy-missing-index.ts",
    content: `export async function listByNoIndexColumn(db) {
  return db.expenseRequest.findMany({ where: { applicant: "x" }, take: 10, orderBy: { id: "asc" } });
}
`,
  },
  {
    // **2 実装（メモリ / Prisma）で引数が食い違うと落ちる。**
    // **片方だけ直すと、試験では通るのに本番で落ちます**（逆もあります）。
    name: "check-dual-impl-args: メモリと Prisma で引数の数が違う",
    tool: "check-dual-impl-args.mjs",
    file: "apps/internal-app/src/server/dummy-dual-repo.ts",
    content: `export function createMemoryDummyStore() {
  return {
    async save(a, b) { return [a, b]; },
  };
}

export function createPrismaDummyStore() {
  return {
    async save(a) { return [a]; },
  };
}
`,
  },
  {
    // **上限（take）の無い一覧で落ちる。**
    // **全件を読むので、数人の間は速く、100 人で急に遅くなります**。
    name: "check-unbounded-query: take の無い findMany が増える",
    tool: "check-unbounded-query.mjs",
    file: "apps/internal-app/src/server/dummy-unbounded.ts",
    content: `export async function listAll(db) {
  return db.expenseRow.findMany({ where: { status: "pending" }, orderBy: { id: "asc" } });
}
`,
  },
  {
    name: "check-dual-impl-args: メモリ実装と Prisma 実装で引数が揃っているかしない findMany",
    name: "check-unbounded-query: 一覧に上限(take)があるかしない findMany",
    name: "check-order-by: 並び順を指定しない findMany",
    tool: "check-order-by.mjs",
    file: "packages/utils/src/__verify_order__.ts",
    content: "export async function verifyOrder(db: { row: { findMany(a?: unknown): Promise<unknown[]> } }) {\n"
      + "  return db.row.findMany({ where: { id: 1 } });\n}\n",
  },
  {
    name: "check-style-literals: 文字サイズの直書き",
    tool: "check-style-literals.mjs",
    file: "packages/ui/src/components/__verify_style__.tsx",
    content: "export function VerifyStyle() {\n"
      + "  return <div style={{ fontSize: 13 }}>x</div>;\n}\n",
  },
  {
    name: "check-delete-confirm: 確認なしで削除する画面",
    tool: "check-delete-confirm.mjs",
    file: "apps/internal-app/src/app/__verify_delete__/verify-client.tsx",
    content: "\"use client\";\nexport function VerifyDelete() {\n"
      + "  const go = () => { void fetch(\"/api/x\", { method: \"DELETE\" }); };\n"
      + "  return <button onClick={go}>削除</button>;\n}\n",
  },
  {
    name: "check-file-input-disabled: 処理中に無効化しないファイル選択",
    tool: "check-file-input-disabled.mjs",
    file: "apps/internal-app/src/app/__verify_file__/verify-client.tsx",
    content: "\"use client\";\nexport function VerifyFile() {\n"
      + "  return <FileInput label=\"選ぶ\" onSelect={() => {}} />;\n}\n",
  },
  {
    name: "check-returns-mismatch: 説明は undefined だが null を返す",
    tool: "check-returns-mismatch.mjs",
    file: "packages/utils/src/__verify_returns__.ts",
    content: "/**\n * 検証用。\n *\n * @returns 見つからなければ undefined\n */\n"
      + "export function verifyReturns(): string | null {\n  return null;\n}\n",
  },
  {
    name: "check-docs-links: 存在しない資料へのリンク",
    tool: "check-docs-links.mjs",
    file: "docs/ops/__verify_link__.md",
    // **対象を手書きしていたため確かめられなかった。**
    // 18 件を手で並べており、置いたファイルが対象外だった。
    // `docs/` を歩く形にしたら発火するようになった(2026-08)
    content: "# 検証用\n\n[存在しない資料](./NOT_EXISTS_onboarding/05-verify.md)\n",
  },
  {
    name: "check-locale-format: ロケールを渡さず金額を整形する",
    tool: "check-locale-format.mjs",
    file: "packages/core/src/__verify_locfmt__.ts",
    content: "export const y = (n: number) => `¥${n.toLocaleString()}`;\n",
  },
  {
    name: "check-permissions: policy に無い権限を渡す",
    tool: "check-permissions.mjs",
    file: "apps/internal-app/src/server/__verify_perm__.ts",
    content: 'import { currentUser, requirePermission } from "./authorize";\n'
      + 'export function g(req: Request): void { requirePermission(currentUser(req), "no-such:permission"); }\n',
  },
  {
    name: "check-showcase-deps: 宣言していないパッケージを import する",
    tool: "check-showcase-deps.mjs",
    file: "apps/showcase/src/app/__verify_dep__.ts",
    content: 'import { x } from "@platform/no-such-package";\nexport const v = x;\n',
  },
  {
    name: "check-e2e-quality: 固定待ちを書く",
    tool: "check-e2e-quality.mjs",
    file: "e2e/__verify_e2e__.spec.ts",
    content: 'import { test } from "@playwright/test";\n'
      + 'test("x", async ({ page }) => { await page.waitForTimeout(5000); });\n',
  },
  {
    name: "check-risky-duplicates: 実害のある同名関数を増やす",
    tool: "check-risky-duplicates.mjs",
    // **既存の関数と同名にする。** `@platform/security` の `sanitize` を
    // `core` にも作れば 2 パッケージになり、ALLOW に無いので落ちる。
    // (1 ファイル置くだけで重複が成立する名前を選ぶ)
    file: "packages/core/src/__verify_dup__.ts",
    content: "/** 検証用。 */\nexport function sanitize(x: string): string {\n  return x;\n}\n",
  },
  {
    name: "check-regex-pitfalls: 範囲を取り違える正規表現を書く",
    tool: "check-regex-pitfalls.mjs",
    file: "tools/check-verify-regex.mjs",
    // **`\\(` の直後に `[^)]*` が来る形。** バックスラッシュ 1 つで書くこと
    // (2 つにすると `check-regex-pitfalls` のパターンに一致せず、発火しない)
    content: 'const re = /new Date\\([^)]*\\)/;\nconsole.log(re, "0 件");\n',
  },
  {
    name: "check-server-fonts: サーバに無いフォントだけを指定する",
    tool: "check-server-fonts.mjs",
    file: "packages/report/src/__verify_font__.ts",
    content: 'export const CSS = `body { font-family: "Hiragino Sans", "Noto Sans JP", sans-serif; }`;\n',
  },
  {
    name: "check-doc-examples: TSDoc の例と実装が食い違う",
    tool: "check-doc-examples.mjs",
    // **`node_modules` 無しでも読めるパッケージに置く**(依存を持たない utils 系)
    file: "packages/utils/src/__verify_example__.ts",
    content: "/**\n * 検証用。\n *\n * @example\n * ```ts\n * verifyExample(); // \"うそ\"\n * ```\n */\nexport function verifyExample(): string {\n  return \"ほんと\";\n}\n",
  },
  {
    name: "check-leftover-fixtures: 検証用の一時ファイルを残す",
    tool: "check-leftover-fixtures.mjs",
    // **このツール自身の残骸**を模す。名前の規則で拾えることを確かめる
    file: "packages/core/src/__verify_leftover__.ts",
    content: "export const LEFTOVER = 1;\n",
  },
  {
    name: "check-preflight-coverage: preflight に登録しない検査を置く",
    tool: "check-preflight-coverage.mjs",
    // **ファイルはあるのに CI で走らない**形。手で叩けば動くので気づきにくい
    file: "tools/check-verify-unregistered.mjs",
    content: 'console.log("✅ 0 件を検査しました");\n',
  },
  {
    name: "check-scan-reporting: 走査量を出さない検査を置く",
    tool: "check-scan-reporting.mjs",
    // **成功しても数を出さない検査**。対象が縮んでも緑のままになる
    file: "tools/check-verify-silent.mjs",
    content: 'console.log("✅ 問題ありません");\n',
  },
  {
    name: "check-locale-compare: ロケールを渡さず日本語を並べ替える",
    tool: "check-locale-compare.mjs",
    file: "packages/core/src/__verify_locale__.ts",
    content: 'export const s = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label);\n',
  },
  {
    name: "check-ime-enter: 変換中を見ずに Enter を拾う",
    tool: "check-ime-enter.mjs",
    file: "apps/crud-template/src/app/__verify_ime__.tsx",
    content: 'export const V = () => <input onChange={() => {}} onKeyDown={(e) => { if (e.key === "Enter") alert(1); }} />;\n',
  },
  {
    name: "check-allow-lists: 除外リストにキーを二重に書く",
    tool: "check-allow-lists.mjs",
    // **`tools/` 直下に置く必要がある**(この検査は tools/*.mjs だけを見る)
    file: "tools/__verify_allow__.mjs",
    content: 'const ALLOW = {\n  "x": "1",\n  "x": "2",\n};\nexport default ALLOW;\n',
  },
  {
    name: "check-css-vars: 定義されていない CSS 変数を参照する",
    tool: "check-css-vars.mjs",
    // フォールバック付きでも**テーマが効かない**ので違反として数える
    file: "packages/core/src/__verify_cssvar__.ts",
    content: 'export const S = { color: "var(--no-such-token-verify, #fff)" };\n',
  },
  {
    name: "check-api-error-shape: ラッパーを通さないルートを足す",
    tool: "check-api-error-shape.mjs",
    file: "apps/crud-template/src/app/api/__verify_err__/route.ts",
    // 包まれていないので例外が Next 既定の 500 になり、traceId も返らない
    content: 'export async function GET(): Promise<Response> {\n  return Response.json({ error: "x" }, { status: 400 });\n}\n',
  },
  {
    name: "check-cookie-parsing: クッキーを正規表現で自作解析する",
    tool: "check-cookie-parsing.mjs",
    // **249 か所にコピーされていた形**。部分一致するので
    // `zoho_session=...` があるとそちらの値を返す(2026-08 に一掃)
    file: "apps/crud-template/src/server/__verify_cookie__.ts",
    content: 'export const v = (r: Request) => r.headers.get("cookie")?.match(/session=([^;]+)/)?.[1];\n',
  },
  {
    name: "check-debt-slack: 直したのに上限を下げ忘れる",
    tool: "check-debt-slack.mjs",
    // **既存の上限ファイルを一時的に緩める。** 実測 0 に対して上限 5 なら、
    // 色を 5 か所まで直書きしても検査が通る = 緑のまま守れていない状態
    file: "tools/hardcoded-colors-limit.json",
    content: '{\n  "limit": 5,\n  "updatedAt": "2026-08-03"\n}\n',
  },
  {
    name: "check-source-paths: ソースが存在しないパスを指す",
    tool: "check-source-paths.mjs",
    file: "packages/core/src/__verify_srcpath__.ts",
    // **消えたアプリを指す案内**は型検査も lint も通る。
    // 読み手が探しに行くまで誰も気づかないので、機械で見張る(2026-08)
    content: "// 実例は `apps/no-such-app-verify/src/index.ts` を参照。\nexport const VERIFY = 1;\n",
  },
  {
    name: "check-app-transpile: 宣言していないパッケージを import する",
    tool: "check-app-transpile.mjs",
    file: "apps/crud-template/src/server/__verify_tr__.ts",
    // **これも「突き合わせだから」と諦めていた。**
    // 依存に無いパッケージを import すれば発火する。
    // next build が落ちる形なので、確かめる価値が高い
    content: "import { isSafeExternalUrl } from \"@platform/net\";\n"
      + "export const verifyTr = isSafeExternalUrl;\n",
  },
  {
    name: "check-env-example: .env.example に無い変数を読む",
    tool: "check-env-example.mjs",
    file: "apps/crud-template/src/server/__verify_env__.ts",
    // **「突き合わせだから確かめられない」ではなかった。**
    // 記載の無い変数を 1 つ読むファイルを置けば発火する(2026-08 に気づいた)。
    // **できないと決める前に、一度試す**
    content: "import { optionalEnv } from \"@platform/env\";\n"
      + "export const verifyValue = optionalEnv(\"VERIFY_NOT_IN_EXAMPLE\");\n",
  },
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
    name: "check-braces: 閉じていない括弧",
    tool: "check-braces.mjs",
    // **`.ts` に置く。** `.tsx` は対象外(JSX の `<` を演算子と誤認するため)
    file: "packages/core/src/__verify__-braces.ts",
    // 私が実際に壊した形(一括置換で `try {` を挿入して閉じ忘れた)
    content: 'export function x() {\n  try {\n  return 1;\n}\n',
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
    // **今回いちばん効く検査。** 画面が「読み込み中…」の代わりに白くなる形を捕まえる
    name: "check-async-boundary: 中身が判定より先に評価される",
    tool: "check-async-boundary.mjs",
    file: "apps/internal-app/src/app/__verify__/asyncboundary.tsx",
    content:
      'import { AsyncBoundary } from "@platform/ui";\n'
      + "export function X({ data }: { data: { total: number } | null }) {\n"
      + '  return (<AsyncBoundary loading={data === null} error="">\n'
      + "    <p>{data.total}</p>\n"
      + "  </AsyncBoundary>);\n"
      + "}\n",
  },
  {
    // **安全な書き方を赤にしないこと。** 誤検出は検査ごと信用を失わせる。
    // ここは「守っている形」を置いて、**緑のままであること**を確かめる
    name: "check-async-boundary: 中で守っていれば通す(誤検出の見張り)",
    tool: "check-async-boundary.mjs",
    file: "apps/showcase/src/app/__verify_ab_ok__.tsx",
    expectFail: false,
    content:
      'import { AsyncBoundary } from "@platform/ui";\n'
      + "export function Ok({ data }: { data: { x: number } | null }) {\n"
      + '  return (<AsyncBoundary loading={data === null} error="">\n'
      + "    {data === null ? <p>なし</p> : <p>{data.x}</p>}\n"
      + "  </AsyncBoundary>);\n"
      + "}\n",
  },
  {
    // **無意味な属性そのものより、検査を黙らせることの方が高くつく**
    name: "check-intrinsic-props: 生タグに部品の props",
    tool: "check-intrinsic-props.mjs",
    file: "apps/internal-app/src/app/__verify__/intrinsic.tsx",
    content: 'export function X() { return <td variant="secondary">x</td>; }\n',
  },
  {
    // **Windows でだけ壊れる**ので、Linux の CI では実害が出るまで気づけない
    name: "check-node-portability: Windows で静かに壊れる書き方",
    tool: "check-node-portability.mjs",
    file: "tools/__verify_portability__.mjs",
    content:
      'const root = new URL("..", import.meta.url).pathname;\n'
      + "if (import.meta.url === `file://${process.argv[1]}`) { console.log(root); }\n",
  },
  {
    // **半年後に「消してよいか分からない」状態を作らない**
    //
    // **仮のアプリを 1 つ置いて確かめる。** 既存の `package.json` を
    // 書き換える形にすると、**途中で止まったとき本物が壊れます**
    // (このツールは `__verify` を含むものしか後始末しません)。
    name: "check-unused-deps: 依存に入れたまま使っていない",
    tool: "check-unused-deps.mjs",
    file: "apps/__verify_unused__/package.json",
    content:
      "{\n"
      + '  "name": "@apps/verify-unused",\n'
      + '  "private": true,\n'
      + '  "dependencies": { "@platform/stripe": "workspace:*" }\n'
      + "}\n",
  },
  {
    // **古い数値はそのまま信じられる**(資料を AI が読む前提のリポジトリ)
    name: "check-stale-counts: 説明文に固定で書いた数値",
    tool: "check-stale-counts.mjs",
    file: "packages/utils/src/__verify_counts__.ts",
    content:
      "/**\n"
      + " * このリポジトリは 999 パッケージあります。\n"
      + " */\n"
      + "export const verifyCounts = 1;\n",
  },
  {
    // **原因と無関係なエラーになる**ので、機械に見つけさせる価値が高い
    name: "check-comment-terminators: コメントが途中で終わる",
    tool: "check-comment-terminators.mjs",
    file: "packages/utils/src/__verify_comment__.ts",
    // **終端そのものはソースに直接書けない**(この注記が終わってしまう)ので組み立てる
    content: [
      "/**",
      ` * 説明の途中に ${"*"}${"/"} を書いてしまった形。`,
      " * まだ続けるつもりだった行。",
      ` ${"*"}${"/"}`,
      "export const verifyComment = 1;",
      "",
    ].join("\n"),
  },
  {
    // **本番で db push になる**のを止める検査。実害が最も大きい
    name: "check-empty-branches: 条件だけあって中身が無い",
    tool: "check-empty-branches.mjs",
    file: "packages/utils/src/__verify_branch__.ts",
    content:
      "export function verifyBranch(flag: boolean): number {\n"
      + "  if (flag) {\n"
      + "    // あとで実装する\n"
      + "  }\n"
      + "  return 1;\n"
      + "}\n",
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
    file: "apps/showcase/src/app/__verify__/node-in-client.tsx",
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
    file: "apps/showcase/src/app/api/__verify__/route.ts",
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
    name: "check-tsdoc-params: @param の並びが実装と違う",
    tool: "check-tsdoc-params.mjs",
    file: "packages/core/src/__verify_props__.ts",
    // **P1(並び順)で確かめる。**
    // 「存在しないプロパティ」は P3 で**上限方式**なので、
    // 1 件増えても上限内で通ってしまい、発火を確かめられない
    // (2026-08 に気づいた)。
    // 並び順は型が同じだと黙って入れ替わるため、上限を持たず常に 0。
    content: "/**\n * 検証用。\n *\n * @param second 2 番目\n * @param first 1 番目\n * @returns 値\n */\n"
      + "export function verifyOrder(first: number, second: number): number {\n  return first + second;\n}\n",
  },
  {
    // **P5(同じ引数を 2 回)も上限を持たない。**
    // 説明を書き足すとき、既にあることに気づかず追記すると起きる
    // ——**どちらが正しいか分からず、片方だけ直されて食い違いが残る**。
    name: "check-tsdoc-params: 同じ引数を 2 回説明している",
    tool: "check-tsdoc-params.mjs",
    file: "packages/core/src/__verify_dup__.ts",
    content: "/**\n * 検証用。\n *\n * @param value 値\n * @param value 値(重複)\n * @returns 値\n */\n"
      + "export function verifyDup(value: number): number {\n  return value;\n}\n",
  },
  {
    // **Next の版が上がって落ちること**を確かめる。
    // 手元では 16 でも動くので、**検査が生きていないと本番でしか分からない**。
    name: "check-next-version: Amplify の対応範囲を超えた Next",
    tool: "check-next-version.mjs",
    file: "apps/__verify_next__/package.json",
    content: '{\n  "name": "__verify_next__",\n  "dependencies": { "next": "^16.2.0" }\n}\n',
  },
  {
    // **上限 9 に 1 件足して超えさせる。** ブラウザ側から
    // Node 専用パッケージを取る形が、増えたら止まることを確かめる
    name: "check-runtime-boundary: 画面から Node 専用パッケージ",
    tool: "check-runtime-boundary.mjs",
    file: "apps/showcase/src/app/__verify_rb__/page.tsx",
    content: '"use client";\nimport { totp } from "@platform/auth";\nexport default function P() { return String(totp); }\n',
  },
  {
    // **`"use client"` は位置が命。** import より下だとビルドが落ちるが、
    // 型検査も試験も通るので、ここで見張らないと本番まで分からない
    name: "check-build-ready[A7]: use client が先頭にない",
    tool: "check-build-ready.mjs",
    file: "apps/showcase/src/app/__verify_uc__/page.tsx",
    content: 'import * as React from "react";\n"use client";\nexport default function P() { return String(React.version); }\n',
  },
  {
    // **App Router のルートは決まった名前しか export できない。**
    name: "check-build-ready[A8]: route が余分な名前を export",
    tool: "check-build-ready.mjs",
    file: "apps/showcase/src/app/api/__verify_rt__/route.ts",
    content: 'export const spec = { a: 1 };\nexport async function GET() { return Response.json(spec); }\n',
  },
  {
    // **上限 0 なので、1 件置けば赤になる。**
    // 「上限ラチェットだから確かめられない」は**上限が 0 のときは当てはまりません**
    // ——0 を超えた時点で落ちるので、普通に検証できます(2026-08 に見直し)。
    name: "check-query-in-loop: ループの中で DB を引く",
    tool: "check-query-in-loop.mjs",
    file: "apps/internal-app/src/server/__verify_loop__.ts",
    content: 'export async function f(db: any, ids: string[]) {\n'
      + '  const out = [];\n'
      + '  for (const id of ids) {\n'
      + '    out.push(await db.user.findUnique({ where: { id } }));\n'
      + '  }\n  return out;\n}\n',
  },
  {
    // **stable が incubating に依存すると落ちる。**
    // 「形が変わることがある」ものに、安定版がぶら下がってはいけない
    name: "check-package-tier: stable が incubating に依存",
    tool: "check-package-tier.mjs",
    file: "packages/__verify_tier__/package.json",
    content: '{\n  "name": "@platform/__verify_tier__",\n  "version": "0.1.0",\n'
      + '  "main": "./src/index.ts",\n'
      + '  "dependencies": { "@platform/address": "workspace:*" },\n'
      + '  "platform": { "tier": "stable" }\n}\n',
  },
  {
    // **循環依存を作って確かめる。** `core` は多くのパッケージが依存する土台なので、
    // そこへ依存し返すものを 1 つ置けば輪ができる。
    // 「package.json を見る検査だから確かめられない」ではなく、
    // **package.json を 1 つ置けば確かめられます**(2026-08 に見直し)。
    name: "check-deps: 循環依存",
    tool: "check-deps.mjs",
    file: "packages/__verify_cycle__/package.json",
    content: '{\n  "name": "@platform/__verify_cycle__",\n  "version": "0.1.0",\n'
      + '  "main": "./src/index.ts",\n'
      + '  "dependencies": { "@platform/__verify_cycle__": "workspace:*" },\n'
      + '  "platform": { "tier": "stable" }\n}\n',
  },
  {
    // **未検証 0 なので 1 本置けば落ちる。**
    // 「1 本足しても閾値内」という除外理由は、上限が 0 になった時点で
    // 古くなっていました(2026-08 に見直し)。
    name: "check-input-validation: 本文を検証しないルート",
    tool: "check-input-validation.mjs",
    file: "apps/showcase/src/app/api/__verify_iv__/route.ts",
    content: 'export async function POST(req: Request) {\n'
      + '  const body = await req.json();\n'
      + '  return Response.json({ got: body });\n}\n',
  },
  {
    // **基盤にある名前をアプリ側で作れば落ちる。**
    // 「意図的な同名との区別が要る」のはそのとおりですが、
    // **区別のための仕組み（ALLOW）がある**ので検証はできます。
    name: "check-reimplementation: 基盤と同名の実装",
    tool: "check-reimplementation.mjs",
    file: "apps/showcase/src/server/__verify_reimpl__.ts",
    content: '/** 基盤にある名前をわざと作る（検証用）。 */\n'
      + 'export function formatYen(n: number): string {\n  return `${n} 円`;\n}\n',
  },
  {
    // **上限 0 なので 1 件置けば落ちる。**
    // 自前でグラフを描くと、**目盛りも凡例も読み上げも自分で用意する**ことになり、
    // 画面ごとに出来が変わります（`@platform/ui` のグラフを使うこと）。
    name: "check-handmade-chart: 自前でグラフを描く",
    tool: "check-handmade-chart.mjs",
    file: "apps/showcase/src/app/__verify_chart__/chart.tsx",
    content: '"use client";\n'
      + 'export function C({ data }: { data: number[] }) {\n'
      + '  const max = Math.max(...data);\n'
      + '  return (\n'
      + '    <svg viewBox="0 0 100 50">\n'
      + '      {data.map((v, i) => <rect key={i} x={i * 10} y={50 - (v / max) * 50} width={8} height={(v / max) * 50} />)}\n'
      + '    </svg>\n  );\n}\n',
  },
  {
    // **package.json を 1 つ置けば落ちる。**
    // 「ファイルを足すと逆に検査対象が増える」——**それがまさに検証**です
    // （増えた対象が不備を持っていれば赤くなる。2026-08 に見直し）。
    name: "check-package-shape: tsconfig の無いパッケージ",
    tool: "check-package-shape.mjs",
    file: "packages/__verify_shape__/package.json",
    content: '{\n  "name": "@platform/__verify_shape__",\n  "version": "0.1.0",\n'
      + '  "main": "./src/index.ts",\n  "platform": { "tier": "incubating" }\n}\n',
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
 *
 * 【定期的に疑うこと】
 * この一覧は**一度書くと見直されない**。2026-08 に棚卸ししたところ、
 * `check-permissions` / `check-showcase-deps` / `check-e2e-quality` の 3 本は
 * **実際にはファイル 1 つで検証できた**(それぞれ policy に無い権限、
 * 宣言していない import、固定待ちを置けば落ちる)。
 * とくに `check-permissions` は同じ月に**ロール名を権限として渡す誤りを 13 箇所**
 * 見つけた検査で、その時点では自己検証されていなかった。
 *
 * 「できない」と書いた理由が今も正しいかは、**実際に置いて試すのが唯一の確認方法**。
 * `node tools/verify-checks.mjs --try <検査名>` で 1 本だけ試せる。
 */
/**
 * **ダミーファイルを置く方式では確かめられない検査。**
 *
 * **「確かめなくてよい」ではありません**——**この仕組みでは無理**というだけです。
 * **手で壊して確かめてください**（手順は `docs/ops/CHECKS.md`）。
 *
 * 【なぜ無理か（2026-08 に整理）】
 *
 * | 種類 | 検査 | なぜ |
 * |---|---|---|
 * | **設定ファイルを見る** | `deps` `lockfile` `schema` `package-shape` `ports` `win-setup` `test-setup` `pwa` | **ダミーの `.ts` を置いても対象外**です。`package.json` などを書き換える必要があります |
 * | **既存ファイルの書き換えが要る** | `doc-numbers` `generated` `docs-orphans` `docs-duplication` `tsdoc` `core-signatures` | **新しいファイルを足しても落ちません**——**既にあるものを壊す**必要があります（`doc-numbers` は `CLAUDE.md` の数字を変えれば落ちることを確認済み） |
 * | **実機が要る** | `drill` `contract` `security-headers` | **DB や外部サービス**が要ります |
 * | **上限方式で 1 件では足りない** | `maintainability` `handmade-chart` `reimplementation` `path-length` `placeholders` `syntax` | **上限に余裕がある**と、1 件足しても落ちません。**上限を下げて確かめて**ください |
 *
 * **ここに足すときは、必ず理由を書いてください**——
 * **書かないと、「本当は確かめられるのに諦めている」のか分かりません**。
 */
const NOT_VERIFIABLE = {
  "check-codeowners": "リポジトリ唯一の .github/CODEOWNERS を見る検査。違反を作るにはそれを壊すしかなく、**中断すると本物のレビュー必須設定が消えます**。判定は実行すれば目視できる（実在しないパスを 1 行足すと落ちる）。",
  "check-placeholders": "**落とさない検査**なので、違反を置いても赤にならない。"
    + "サンプル値(`@your-org` など)は**開発中なら正しい**——CI で落とすと"
    + "**引き継ぎ前の作業が止まる**。一覧を出して `docs/onboarding/README.md` の"
    + "「引き継いだ人が最初にやること」へ誘導するだけにしてある。",
  "check-ops-hygiene": "compose と scripts という**リポジトリ唯一のファイル**を見る検査。"
    + "違反を作るにはそれらを壊すしかない。ログ上限を消して赤になることは手で確認済み(2026-08)。",
  "check-db-indexes": "上限ラチェット方式(現状 0 件)。違反を作るには**実在の schema.prisma に"
    + "列を足す**必要があり、戻し忘れると生成物と DB がずれる。判定は --list で目視できる。",
  "check-incubating-review": "package.json の `platform.incubatingReviewedAt` を見る。"
    + "違反を作るには実在パッケージの宣言を書き換えるしかなく、戻し忘れると"
    + "**棚卸しの記録そのものが嘘になる**。記録を汚さないため、ここでは分類のみ。",
  "check-mail-dns": "DNS を実際に引く道具(CI では走らせない)。"
    + "違反の再現には**自分のドメインの DNS を壊す**必要があり、検証にならない。",
  "check-rollback-ready": "compose / release / 手順書という**リポジトリ唯一のファイル**を見る検査。"
    + "違反を作るにはそれらを壊すしかなく、その状態では他の検査も落ちる。"
    + "代わりに、タグ固定・変数の不一致・sha タグ欠落・手順書の未記載の**4 通りを個別に判定**する。",
  "check-openapi-coverage": "未宣言数の上限ラチェット。**上限を刻む前は skip**、刻んだ後も"
    + "ルートを 1 本置けば上限を超えるが、その 1 本は他の検査(認可・入力検証)にも引っかかる。"
    + "上限方式の検証は現実的でないため、ここでは分類のみ。",
  "check-licenses": "依存のライセンスを見る。違反を作るには**実際に GPL の依存を入れる**しかなく、"
    + "検証のために入れて消すのは `pnpm-lock.yaml` を汚す。"
    + "代わりに禁止一覧・OR 表記・スコープ付きの判定を疑似ストアで確かめてある(2026-08)。",
  "check-bundle-size": "上限ラチェット方式(ビルド結果が要る)。手元にビルドが無ければ skip する。"
    + "**上限を刻む前は常に skip** なので、違反を置いても赤にならない。",
  "check-migration-mode": "CI・Dockerfile・setup スクリプトという**リポジトリ唯一のファイル**を見る検査。"
    + "違反を作るにはそれらを壊すしかなく、その状態では他の検査も落ちるので単体の検証にならない。"
    + "代わりに、直接呼び出しと空の migrations の**2 通りを個別に判定**して、どちらかを出力する。",
  "check-coverage-scope": "ルートの vitest.config.ts と計測結果を見る検査。"
    + "違反を作るには**リポジトリ唯一の設定を壊す**しかなく、"
    + "その状態では他の検査も軒並み落ちるので、単体の検証にならない。"
    + "代わりに、設定が無い/include が無い/生成物を除外していない/thresholds がある、の"
    + "**4 通りを個別に判定**して、どれが欠けているかを出力するようにしてある。",
  // **下限・上限ラチェット方式**は、ファイルを 1 つ置いても閾値を超えない
  // (超えるまで大量に置く必要があり、検証としては現実的でない)。
  // 代わりに `--list` で中身を目視できるようにしてある。
  "check-safety-parts": "被覆率の下限ラチェット(部品ごとの分母と分子を数える)",
  "check-schema-types": "schema の型の上限ラチェット(Prisma schema を書き換える必要がある)",
  "check-coverage": "カバレッジの下限ラチェット(テストを流さないと数字が出ない)",
  // **アプリ単位・パッケージ単位で見る**ので、ファイル 1 つでは発火しない
  "check-app-ci": "アプリごとの CI ファイルの有無とテンプレートずれを見る",
  "check-lockfile": "pnpm-lock.yaml と package.json の突き合わせ",
  "check-security-headers": "アプリ単位で見る(next.config と middleware.ts の組。ファイル 1 つでは足りない)",
  "check-generated": "生成物の再生成と差分比較(ファイルを足しても関係しない)",
  "check-doc-numbers": "資料の数値と実測の突き合わせ",
  "check-drill": "訓練記録の日付を見る",
  "check-contract": "契約ファイルと実装の突き合わせ",
  "check-path-length": "ファイルパスの長さ(環境依存)",
  "check-win-setup": "setup.ps1 の構文",
  "check-schema": "prisma/schema.prisma の構造",
  "check-ports": "各アプリの package.json のポート指定",
  "check-tsdoc": "公開 API の TSDoc(足したファイルの分だけ不足が増えるので、意図と逆になる)",
  // **既存ファイルの書き換えが要る。** 新規ファイルを足しても差分にならない
  // (関数が増えるのは正常な変更なので、それで落ちては使い物にならない)。
  // 対象は `core` / `integrations` / `auth` / `datetime` の 4 パッケージで、
  // どれも小さく、丸ごと置き換えると復元に失敗したときの損失が大きい。
  // **手で確かめる方法**: `httpStatusFor(error: unknown)` に引数を 1 つ足すと落ちる(確認済み)
  "check-core-signatures": "基盤の公開シグネチャの差分(既存ファイルの書き換えが要る。手順は上のコメント)",
  "check-docs-orphans": "資料への到達性",
  "check-docs-duplication": "資料間の重複",
  "check-syntax": "全ファイルのパース(壊れたファイルを置けば当然落ちるので、検証の意味が薄い)",
  "check-test-setup": "テスト設定ファイルの整合",
  "check-pwa": "manifest と service worker の設定",
  "check-maintainability": "行数・ファイルサイズ(上限方式。1 ファイルでは超えない)",
};

/**
 * `--try <検査名>` で 1 本だけ試す。
 *
 * **`NOT_VERIFIABLE` の理由が今も正しいかを確かめるため**にある。
 * 全部流すと数分かかるので、疑ったものだけを手早く試せるようにした。
 */
// **絞り込む前に、全ケース分の残骸を控えておく。**
// `--try` で CASES を切り詰めてから掃除すると、
// **他のケースの残骸が掃除されない**まま残る(2026-08 に実際に起きた)。
const ALL_CASE_FILES = CASES.map((c) => c.file);

const tryIdx = process.argv.indexOf("--try");
const only = tryIdx >= 0 ? process.argv[tryIdx + 1] : null;
if (only !== null && only !== undefined) {
  const hit = CASES.filter((c) => c.tool.replace(/\.mjs$/, "").includes(only));
  if (hit.length === 0) {
    const reason = NOT_VERIFIABLE[only] ?? NOT_VERIFIABLE[`check-${only}`];
    console.log(reason === undefined
      ? `"${only}" は CASES にも NOT_VERIFIABLE にもありません`
      : `"${only}" は検証対象外です: ${reason}\n  → 実際に違反を置いて落ちるなら、CASES へ移してください`);
    process.exit(0);
  }
  CASES.length = 0;
  CASES.push(...hit);
}

/**
 * 前回「発火した」と確認した検査の指紋。
 *
 * **見張っているのは「検査が壊れていないか」**なので、
 * 検査ファイルが変わっていなければ結果も変わらない。
 * 38 ケースそれぞれで「違反を置く → 検査を走らせる → 消す」を繰り返すため、
 * **全体で 2 分以上**かかっていた(2026-08)。
 *
 * **指紋には共通ライブラリも含める。** `tools/lib/*` が変われば、
 * それを使う検査の挙動も変わりうる。含めないと**直したのに再検証されない**。
 *
 * 並列化も検討したが**採らなかった**——ケース X が置いた違反ファイルを、
 * 同時に走る別の検査(`check-tsdoc` など)が見て落ちる。
 * 実際、残骸が残っただけで `check-tsdoc` が落ちた前例がある。
 */
const libFingerprint = (() => {
  const dir = path.join(ROOT, "tools", "lib");
  if (!existsSync(dir)) return "";
  const h = createHash("sha1");
  for (const f of readdirSync(dir).sort()) {
    h.update(f).update(readFileSync(path.join(dir, f), "utf8"));
  }
  return h.digest("hex");
})();

const fingerprintOf = (tool) => {
  const p = path.join(ROOT, "tools", tool);
  const src = existsSync(p) ? readFileSync(p, "utf8") : "";
  return createHash("sha1").update(src).update(libFingerprint).digest("hex");
};

const verifiedCache = path.join(ROOT, "node_modules", ".cache", "verify-checks-ok.json");
const prevVerified = (() => {
  try { return JSON.parse(readFileSync(verifiedCache, "utf8")); } catch { return {}; }
})();
const nextVerified = {};
let cached = 0;

/** 確認できたケースを記録する(`--try` では保存しない)。 */
function saveVerified() {
  // **`--try` では保存しない。** 1 本だけ流した結果で全体のキャッシュを
  // 上書きすると、他のケースが「確認済み」の記録を失う
  if (only !== null && only !== undefined) return;
  try {
    mkdirSync(path.dirname(verifiedCache), { recursive: true });
    writeFileSync(verifiedCache, JSON.stringify(nextVerified));
  } catch { /* 書けなくても検証は成立する */ }
}

let ok = 0;
const failed = [];

// **前回の残骸を先に掃除する。**
// このツールが途中で止まると(タイムアウト・Ctrl-C)、置いた検証用ファイルが残る。
// 残ると `check-tsdoc` などが「説明の無い関数がある」と落ち、
// **原因と無関係な検査が赤くなる**ので追いにくい(2026-08 に実際に起きた)。
for (const file of ALL_CASE_FILES) {
  const abs = path.join(ROOT, file);
  // 既存ファイルを一時的に書き換える形(`restore`)は掃除しない——本物を消してしまう
  if (!/__verify|check-verify-/.test(file)) continue;
  if (existsSync(abs)) {
    unlinkSync(abs);
    console.log(`   (前回の残骸を削除: ${file})`);
  }
  const dir = path.dirname(abs);
  if (/__verify/.test(path.basename(dir)) && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

/**
 * いま置いている検証用ファイル(中断時に消すため)。
 *
 * **`finally` だけでは足りない。** タイムアウトや Ctrl-C で殺されると
 * `finally` は動かず、**違反ファイルが残ったまま**になる。
 * 残ると `check-tsdoc` や `check-scan-reporting` が別の理由で赤くなり、
 * 「直したのに落ちる」形で作業を止める(2026-08 に何度も起きた)。
 */
let placing = null;

/** 置きかけのファイルを消す(中断時)。 */
function cleanupPlacing() {
  if (placing === null) return;
  const { abs, original } = placing;
  try {
    if (original !== null) writeFileSync(abs, original);
    else if (existsSync(abs)) unlinkSync(abs);
    const dir = path.dirname(abs);
    if (/__verify/.test(path.basename(dir)) && existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  } catch { /* 掃除に失敗しても、これ以上できることは無い */ }
  placing = null;
}

for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => { cleanupPlacing(); process.exit(130); });
}
process.on("exit", cleanupPlacing);

for (const c of CASES) {
  const abs = path.join(ROOT, c.file);
  // **ディレクトリはキャッシュ判定の後で作る。**
  // 先に作ると、飛ばすケースでも**空の `__verify__` が残る**——
  // 実行前の掃除は「ファイルの親」を消すので、ファイルが無い空ディレクトリは
  // 対象外で、`check-leftover-fixtures` が毎回落ちていた(2026-08)。
  // **既存ファイルを対象にする検査もある。**
  // 上限ファイルのように「置く」のではなく「書き換える」形でしか
  // 違反を作れないものは、消さずに元へ戻す(2026-08、check-debt-slack で必要になった)。
  // **前回と同じ検査なら飛ばす。** 指紋(検査本体 + tools/lib)で判定する
  const fp = fingerprintOf(c.tool);
  if (prevVerified[c.name] === fp) {
    nextVerified[c.name] = fp;
    cached += 1;
    ok += 1;
    // **`verified` はここで触らない。** 後段で CASES 全体から作られるので、
    // 飛ばしたケースも自動的に含まれる(先に触ると初期化前アクセスになる)
    continue;
  }

  mkdirSync(path.dirname(abs), { recursive: true });
  const existed = existsSync(abs);
  const original = existed ? readFileSync(abs, "utf8") : null;
  placing = { abs, original };
  writeFileSync(abs, c.content);
  let fired = false;
  try {
    const actual = fires(c.tool);
    // **`expectFail: false` は「安全な書き方を赤にしないこと」を見る。**
    // 検出力だけでなく**誤検出の無さ**も固定する——安全な形を赤にする検査は、
    // そのうち誰も見なくなる(2026-08、`AsyncBoundary` を三項で守った形を
    // 赤にしていた)。
    const want = c.expectFail !== false;
    fired = actual === want;
    if (!fired && !want) {
      console.log(`  ⚠ ${c.name}: **安全な書き方を赤にしています**(誤検出)`);
    }
    // **合っていたものだけ記録する。** 落ちたケースを記録すると、
    // 直さないまま次回から飛ばされる
    if (fired) {
      nextVerified[c.name] = fp;
      // **1 ケースごとに書く。** 全部終わってから 1 回だけ書くと、
      // **途中で止まったときに何も残らない**——次回もまた最初から
      // 159 秒かかる(2026-08 に実際に起きた)。数 KB なので書き込みの負荷は無視できる。
      saveVerified();
    }
  } finally {
    if (original !== null) {
      // **元の中身に戻す。** 消すと本番の検査が別の理由で赤くなる
      writeFileSync(abs, original);
      placing = null;
    } else {
      // **必ず消す。** 残すと本番の検査が赤のままになる
      if (existsSync(abs)) unlinkSync(abs);
      placing = null;
      const dir = path.dirname(abs);
      if (/__verify/.test(path.basename(dir))) rmSync(dir, { recursive: true, force: true });
    }
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
// **`--try` のときは全体の集計を出さない。** 1 本だけ流したのに
// 「未分類 37 件」と出ると、直すべき問題があるように見えてしまう
if (only === null || only === undefined) {
console.log(`   検査 ${allTools.length} 件 / 発火を確認 ${verified.size} 件 / 仕組み上できない ${Object.keys(NOT_VERIFIABLE).length} 件`);
if (unknown.length > 0) {
  console.log(`   ⚠ 未分類 ${unknown.length} 件: ${unknown.join(", ")}`);
  console.log("     CASES に足すか、できない理由を NOT_VERIFIABLE に書いてください");
}
}

if (failed.length === 0) {
  console.log(`✅ ${ok} 件の検査が、違反を置くと赤になります(見張りが生きています)`);
  process.exit(unknown.length > 0 ? 1 : 0);
}
console.log(`❌ ${failed.length} 件の検査が発火しません。**緑でも守れていない状態です**。`);
console.log("   対象範囲(どのディレクトリを見ているか)と判定条件を確かめてください。");
process.exitCode = 1;
