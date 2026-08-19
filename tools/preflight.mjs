/**
 * オフライン検証ゲートの一括実行(依存インストール不要)。人も CI(boundaries)もこれ1本。
 *   node tools/preflight.mjs      (= pnpm verify:offline)
 * 内容: smoke / check-deps / api-surface(差分検査) / check-core-signatures / check-schema ×3 / check-env-example / check-generated / check-doc-numbers / check-ports / check-package-shape / check-docs-links / check-source-paths / check-debt-slack / check-cookie-parsing / check-api-error-shape / check-css-vars / check-allow-lists / check-ime-enter / check-locale-compare / check-locale-format / check-scan-reporting / check-preflight-coverage / check-leftover-fixtures / check-doc-examples / check-server-fonts / check-regex-pitfalls / check-risky-duplicates / check-docs-duplication / check-docs-orphans / check-doc-apis / check-tsdoc-params / check-e2e-quality / check-package-rules / check-app-rules / check-api-auth / check-auth-stub / check-permissions / check-async-boundary / check-intrinsic-props / check-node-portability / check-comment-terminators / check-coverage-scope / check-migration-mode / check-empty-branches / check-licenses / check-bundle-size / check-openapi-coverage / check-rollback-ready / check-incubating-review / check-db-indexes / check-ops-hygiene / check-query-in-loop / check-stale-counts / check-unused-deps / check-reimplementation / check-handmade-chart / check-utc-date / check-test-setup / check-path-length / check-dom-lib / check-result-narrowing / check-react-import / check-showcase-deps / check-app-transpile / check-braces / check-syntax / check-jsx-tags / check-a11y / check-pwa / check-maintainability / check-hardcoded-colors / check-contract / check-drill / check-imports / check-lockfile / check-unreachable-modules / check-input-validation / check-schema-types / check-app-ci / check-safety-parts / check-package-tier / check-coverage / check-build-ready / verify-checks / setup.sh 構文
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

/**
 * skip した検査の数。
 *
 * **skip を ✅ で描いてはいけない。** 実際に 2026-07、check-syntax が
 * typescript 未インストールで skip したのに ✅ と出ており、
 * 「preflight は全部緑なのに `pnpm build` が構文エラーで落ちる」が起きた。
 * 検査ツール側は `⏭` と正しく報告していたので、**穴は表示側**にあった。
 * 緑が信じられないゲートは、無いのと同じになる。
 */
const skipped = [];
// **落ちた検査の名前を集める。** 出力が長いので、
// **最後にもう一度まとめて出す**——「上の出力を確認」だけでは追えない
const failedChecks = [];

/**
 * 各検査の出力を記録する。
 *
 * **`check-scan-reporting` が全検査を再実行するのを避けるため。**
 * あちらは「走査量を報告しているか」を見るために 64 本を叩き直しており、
 * preflight 全体が**実質 2 倍**の時間になっていた(実測 196 秒。2026-08)。
 * 引き継ぐ人が最初に叩くコマンドなので、遅いと信用されない。
 */
const outputs = {};

/**
 * **アプリ側 CI では飛ばしてよい検査。**
 *
 * ADR 0024 で「アプリ側リポジトリの CI が `preflight` を回す」と決めたが、
 * **全 79 種類を毎回回すと重すぎる**。実測(2026-08):
 *
 * | 検査 | 時間 |
 * |---|---|
 * | `verify-checks` | **174 秒** |
 * | `smoke` | **113 秒** |
 * | ほか 76 種類 | 合計 40 秒ほど |
 *
 * ここに挙げるのは「**基盤そのものの健全性**」を見る検査で、
 * アプリのソースを 1 行も見ない。基盤の CI が回せば十分であり、
 * **アプリごとに N 回繰り返す意味がない**。
 *
 * **アプリを走査する検査は絶対に入れないこと。**
 * ここへ入れた瞬間、そのアプリは**誰にも検査されなくなる**
 * (基盤の CI からはアプリのソースが見えないため)。
 */
const PLATFORM_ONLY = new Set([
  "verify-checks(検査の自己検証)",
  "check-scan-reporting",      // 検査が走査量を報告しているか
  "check-preflight-coverage",  // 検査が preflight に登録されているか
  "check-regex-pitfalls",      // 検査自身の正規表現
  "check-leftover-fixtures",   // verify-checks の残骸
  "check-package-rules",       // 基盤自身が作法を守っているか
  "check-package-shape",       // packages/ の構成
  "check-package-tier",        // packages/ の成熟度
  "check-risky-duplicates",    // packages/ の同名関数
  "check-core-signatures",     // packages/core の署名
  "check-generated",           // 基盤の生成物の drift
  "check-docs-links",
  "check-docs-orphans",
  "check-docs-duplication",
  "check-doc-numbers",
  "check-doc-commands",
  "check-doc-apis",
  "check-doc-examples",
  "check-tsdoc-params",
  "check-debt-slack",          // 上限ファイルの余裕
  "check-lockfile",            // 基盤の lockfile
  "check-drill",               // 復元訓練の記録
  "check-win-setup",           // 基盤の setup スクリプト
  "check-node-portability",    // tools / scripts の書き方(アプリのソースは見ない)
  "check-coverage-scope",      // 基盤のカバレッジ設定
  "check-licenses",            // 基盤の依存ライセンス(アプリのソースは見ない)
  "check-rollback-ready",      // 基盤の compose / release / 手順書
  "check-incubating-review",   // 基盤パッケージの成熟度(アプリのソースは見ない)
  "check-ops-hygiene",         // 基盤の compose / scripts(アプリのソースは見ない)
]);

/** `--apps-only` … 基盤そのものを見る検査を飛ばす(アプリ側 CI 用)。 */
const appsOnly = process.argv.includes("--apps-only");
const skippedPlatform = [];

const run = (name, cmd, args) => {
  if (appsOnly && PLATFORM_ONLY.has(name)) {
    skippedPlatform.push(name);
    return true;
  }
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8" });
  const ok = r.status === 0;
  const ms = Date.now() - t0;
  const out = (r.stdout + r.stderr).trim();
  outputs[name] = { status: r.status, out };
  // 検査ツールが自分で「skip した」と言っている場合(依存が無い等)
  const isSkip = ok && out.includes("⏭");
  // **失敗のときは理由の行を出す。**
  // 最終行だけを見ると、`❌ … ✅ 25 件の検査が…` のように
  // **赤の隣に緑の文が並ぶ**(verify-checks が末尾に成功メッセージを出しつつ
  // 未分類があって 1 を返すため)。読む人が混乱する。
  const lines = out.split("\n").filter(Boolean);
  const tail = ok
    ? (lines.at(-1) ?? "")
    : (lines.find((l) => /❌|⚠|Error|error/.test(l)) ?? lines.at(-1) ?? "");
  const mark = !ok ? "❌" : isSkip ? "⏭ " : "✅";
  console.log(`${mark} ${name.padEnd(22)} ${String(ms).padStart(5)}ms  ${tail}`);
  if (isSkip) skipped.push(name);
  if (!ok) {
    console.error(`----- ${name} の出力 -----`);
    console.error(out);
    console.error("-".repeat(30));
  }
  if (!ok) failedChecks.push(name);
  return ok;
};

console.log("▶ preflight(オフライン検証ゲート)\n");
let allOk = true;
allOk = run("smoke", "node", ["--experimental-strip-types", "tools/smoke.mjs"]) && allOk;
allOk = run("check-deps", "node", ["tools/check-deps.mjs"]) && allOk;
allOk = run("api-surface(差分)", "node", ["tools/api-surface.mjs"]) && allOk;
allOk = run("check-core-signatures", "node", ["tools/check-core-signatures.mjs"]) && allOk;  // 依存の多い基盤の形が変わっていないか
// **アプリ名を手で並べない。** schema.prisma を持つアプリが対象
const dbApps = readdirSync(new URL("../apps", import.meta.url), { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(new URL(`../apps/${d.name}/prisma/schema.prisma`, import.meta.url)))
  .map((d) => d.name);
for (const app of dbApps) {
  allOk = run(`check-schema:${app}`, "node", ["tools/check-schema.mjs", `apps/${app}/prisma/schema.prisma`]) && allOk;
}
allOk = run("check-env-example", "node", ["tools/check-env-example.mjs"]) && allOk;
allOk = run("check-generated", "node", ["tools/check-generated.mjs"]) && allOk;  // 生成物が古いまま気づかないのを防ぐ
allOk = run("check-doc-numbers", "node", ["tools/check-doc-numbers.mjs"]) && allOk;  // 手書き資料の数値ドリフト(AIが読む前提資料)
allOk = run("check-ports", "node", ["tools/check-ports.mjs"]) && allOk;  // 開発ポートの重複(pnpm dev は一斉起動するため)
allOk = run("check-package-shape", "node", ["tools/check-package-shape.mjs"]) && allOk;  // tsconfig/scripts 欠落(型チェックが素通りする)
allOk = run("check-docs-links", "node", ["tools/check-docs-links.mjs"]) && allOk;
// **ソース側の「ここを見ろ」も見張る。** docs だけ見ていると、
// コメントや例外メッセージが消えたアプリを指したまま残る(2026-08 に 2 件)
allOk = run("check-source-paths", "node", ["tools/check-source-paths.mjs"]) && allOk;
// **上限のたるみを止める。** 直したのに上限を下げ忘れると、
// その差分だけ後戻りが素通りする(緑のまま守れていない状態になる)
allOk = run("check-debt-slack", "node", ["tools/check-debt-slack.mjs"]) && allOk;
// **クッキーの自作解析を止める。** 249 か所にコピーされた正規表現が
// 部分一致のバグを持ったまま、型検査も lint も通っていた
allOk = run("check-cookie-parsing", "node", ["tools/check-cookie-parsing.mjs"]) && allOk;
// **エラー応答の作法。** 例外が拾われないと 500 になり、traceId も返らない
allOk = run("check-api-error-shape", "node", ["tools/check-api-error-shape.mjs"]) && allOk;
// **参照している CSS 変数が実在するか。** 直書きは検査で見つかるが、
// 未定義の変数を参照する形は通ってしまう(テーマが効かないのに気づけない)
allOk = run("check-css-vars", "node", ["tools/check-css-vars.mjs"]) && allOk;
// **除外リストの重複。** 後の値が静かに勝ち、先に書いた理由が消える
allOk = run("check-allow-lists", "node", ["tools/check-allow-lists.mjs"]) && allOk;
// **日本語入力の変換確定で送信されないか。** 英語で試すと気づけない種類のバグ
allOk = run("check-ime-enter", "node", ["tools/check-ime-enter.mjs"]) && allOk;
// **日本語の並び順が環境で変わらないか。** localeCompare のロケール指定漏れ
allOk = run("check-locale-compare", "node", ["tools/check-locale-compare.mjs"]) && allOk;
// **整形のロケール指定。** サーバの LANG が変われば帳票やメールの金額表記が変わる
allOk = run("check-locale-format", "node", ["tools/check-locale-format.mjs"]) && allOk;
// **検査が走査量を報告しているか。** 緑の検査は読まれないので、
// 対象が縮んでも気づけない(実際に 4 件の取りこぼしがこの形で起きた)
// **作った検査が CI で走るか。** 登録し忘れると、ファイルはあるのに一度も動かない
// (2026-08 に 8 本がこの状態だった。作った本人は「入れた」と思っている)
allOk = run("check-preflight-coverage", "node", ["tools/check-preflight-coverage.mjs"]) && allOk;
// **verify-checks の残骸を検出する。** 途中で止まると検証用ファイルが残り、
// 原因と無関係な検査(TSDoc の完備・資料の数値)が落ちて追えなくなる
allOk = run("check-leftover-fixtures", "node", ["tools/check-leftover-fixtures.mjs"]) && allOk;
// **TSDoc の例を実行して確かめる。** この基盤では「説明が実装より多くを約束する」
// 形が繰り返し出た(和暦の月日・郵便番号の桁・単位の取り違え)
allOk = run("check-doc-examples", "node", ["--experimental-strip-types", "tools/check-doc-examples.mjs"]) && allOk;
// **サーバで PDF 化する HTML のフォント。** 画面は端末のフォントで描けるので、
// 開発中は気づけない(サーバ側だけ □ になる)
allOk = run("check-server-fonts", "node", ["tools/check-server-fonts.mjs"]) && allOk;
// **検査自身の正規表現。** 範囲を取り違えると「緑」を返し、
// 隠れた問題に気づけない(2026-08 に 3 件が本物の欠陥を隠していた)
allOk = run("check-regex-pitfalls", "node", ["tools/check-regex-pitfalls.mjs"]) && allOk;
// **実害のある同名関数の重複。** 片方だけ弱いと、どちらを使ったかで守りが変わる
// (2026-08 に 7 件洗って 5 件で対応が要った)
allOk = run("check-risky-duplicates", "node", ["tools/check-risky-duplicates.mjs"]) && allOk;
// **資料に書いたコマンドが実際に動くか。** 書いてあるのに動かないと、
// 読む側は資料全体を信用しなくなる
allOk = run("check-doc-commands", "node", ["tools/check-doc-commands.mjs"]) && allOk;  // 手書き資料のリンク切れ・存在しないコマンド案内
run("check-docs-duplication", "node", ["tools/check-docs-duplication.mjs"]);
allOk = run("check-docs-orphans", "node", ["tools/check-docs-orphans.mjs"]) && allOk;  // どこからも辿り着けない資料を検出  // 資料の重複(警告のみ・CI は落とさない)
allOk = run("check-doc-apis", "node", ["tools/check-doc-apis.mjs"]) && allOk;  // 資料のコード例が実在する API を使っているか
allOk = run("check-tsdoc-params", "node", ["tools/check-tsdoc-params.mjs"]) && allOk;  // TSDoc の @param が実装と一致するか(並び順の食い違いは黙って壊れる)
allOk = run("check-e2e-quality", "node", ["tools/check-e2e-quality.mjs"]) && allOk;  // E2E の Flaky リスク(固定待ち等)
allOk = run("check-package-rules", "node", ["tools/check-package-rules.mjs"]) && allOk;  // 基盤自身が作法を守っているか
allOk = run("check-app-rules", "node", ["tools/check-app-rules.mjs"]) && allOk;  // apps が基盤の役割を侵していないか(CLAUDE.md の規約)
allOk = run("check-api-auth", "node", ["tools/check-api-auth.mjs"]) && allOk;  // 認可も公開宣言も無い API を検出(上限つき)
allOk = run("check-auth-stub", "node", ["tools/check-auth-stub.mjs"]) && allOk;
allOk = run("check-permissions", "node", ["tools/check-permissions.mjs"]) && allOk;  // 使用している権限がポリシーに定義されているか
allOk = run("check-reimplementation", "node", ["tools/check-reimplementation.mjs"]) && allOk;  // 基盤にある機能をアプリで作り直していないか
allOk = run("check-async-boundary", "node", ["tools/check-async-boundary.mjs"]) && allOk;  // AsyncBoundary の中身が判定より先に評価されていないか
allOk = run("check-intrinsic-props", "node", ["tools/check-intrinsic-props.mjs"]) && allOk;  // 生タグに部品の props が残っていないか(検査を黙らせる)
allOk = run("check-node-portability", "node", ["tools/check-node-portability.mjs"]) && allOk;  // Windows で静かに壊れる書き方(tools / scripts)
allOk = run("check-comment-terminators", "node", ["tools/check-comment-terminators.mjs"]) && allOk;  // ブロックコメントの途中終了(原因と無関係なエラーになる)
allOk = run("check-coverage-scope", "node", ["tools/check-coverage-scope.mjs"]) && allOk;  // カバレッジが生成物や tools を測っていないか
allOk = run("check-migration-mode", "node", ["tools/check-migration-mode.mjs"]) && allOk;  // スキーマ適用方式の固定(本番で db push になる)
allOk = run("check-empty-branches", "node", ["tools/check-empty-branches.mjs"]) && allOk;  // 条件だけあって中身が無い分岐(設定すれば動くように見える)
allOk = run("check-licenses", "node", ["tools/check-licenses.mjs"]) && allOk;  // 配布できないライセンス(pnpm audit は見ていない)
allOk = run("check-bundle-size", "node", ["tools/check-bundle-size.mjs"]) && allOk;  // 初期 JS の増加(上限ラチェット)
allOk = run("check-openapi-coverage", "node", ["tools/check-openapi-coverage.mjs"]) && allOk;  // 別アプリから叩く API が宣言されているか(上限ラチェット)
allOk = run("check-rollback-ready", "node", ["tools/check-rollback-ready.mjs"]) && allOk;  // 前の版へ戻せるか(タグ固定だと戻せない)
allOk = run("check-incubating-review", "node", ["tools/check-incubating-review.mjs"]) && allOk;  // incubating の棚卸し(判断の先送りを止める)
allOk = run("check-db-indexes", "node", ["tools/check-db-indexes.mjs"]) && allOk;  // 外部キーの索引(100 人規模で急に遅くなる)
allOk = run("check-ops-hygiene", "node", ["tools/check-ops-hygiene.mjs"]) && allOk;  // ログ肥大・バックアップ未自動化(静かに壊れる)
allOk = run("check-query-in-loop", "node", ["tools/check-query-in-loop.mjs"]) && allOk;  // ループ内の DB 呼び出し(件数ぶん往復する)
allOk = run("check-stale-counts", "node", ["tools/check-stale-counts.mjs"]) && allOk;  // 説明文に固定で書いた数値(誰も直さない)
allOk = run("check-unused-deps", "node", ["tools/check-unused-deps.mjs"]) && allOk;  // 依存に入れたまま使っていないもの
allOk = run("check-handmade-chart", "node", ["tools/check-handmade-chart.mjs"]) && allOk;
allOk = run("check-utc-date", "node", ["tools/check-utc-date.mjs"]) && allOk;
allOk = run("check-server-localtime", "node", ["tools/check-server-localtime.mjs"]) && allOk;
allOk = run("check-unguarded-json-parse", "node", ["tools/check-unguarded-json-parse.mjs"]) && allOk;
allOk = run("check-returns-mismatch", "node", ["tools/check-returns-mismatch.mjs"]) && allOk;
allOk = run("check-file-input-disabled", "node", ["tools/check-file-input-disabled.mjs"]) && allOk;
allOk = run("check-delete-confirm", "node", ["tools/check-delete-confirm.mjs"]) && allOk;
allOk = run("check-style-literals", "node", ["tools/check-style-literals.mjs"]) && allOk;
allOk = run("check-order-by", "node", ["tools/check-order-by.mjs"]) && allOk;
run("check-unbounded-query", "node", ["tools/check-unbounded-query.mjs"]) && allOk;
run("check-dual-impl-args", "node", ["tools/check-dual-impl-args.mjs"]) && allOk;
run("check-missing-index", "node", ["tools/check-missing-index.mjs"]) && allOk;
// **落とさない検査。** サンプル値は開発中なら正しいので、
// `&& allOk` を付けない——**知らせるだけ**
run("check-placeholders", "node", ["tools/check-placeholders.mjs"]);
allOk = run("check-test-setup", "node", ["tools/check-test-setup.mjs"]) && allOk;
allOk = run("check-path-length", "node", ["tools/check-path-length.mjs"]) && allOk;
allOk = run("check-dom-lib", "node", ["tools/check-dom-lib.mjs"]) && allOk;
allOk = run("check-result-narrowing", "node", ["tools/check-result-narrowing.mjs"]) && allOk;
allOk = run("check-react-import", "node", ["tools/check-react-import.mjs"]) && allOk;
allOk = run("check-showcase-deps", "node", ["tools/check-showcase-deps.mjs"]) && allOk;  // デモサイトの依存漏れ(ビルドしないと気づけない)
allOk = run("check-app-transpile", "node", ["tools/check-app-transpile.mjs"]) && allOk;  // apps の transpilePackages 漏れ(next build だけが落ちる。typecheck/smoke は通る)
// **`check-syntax` の前に置く。** あちらは TypeScript が要るので
// 依存が入っていないと skip する。その隙に 2 回壊した(2026-08、
// 一括置換で 32 ファイル / `</div>` で 19 画面)。
// こちらは依存ゼロで動く最後の砦
allOk = run("check-braces", "node", ["tools/check-braces.mjs"]) && allOk;
allOk = run("check-syntax", "node", ["tools/check-syntax.mjs"]) && allOk;  // 本物のパーサで構文エラーを検出(これが無く、全項目グリーンのまま next build が落ちた)
allOk = run("check-jsx-tags", "node", ["tools/check-jsx-tags.mjs"]) && allOk;
allOk = run("check-a11y", "node", ["tools/check-a11y.mjs"]) && allOk;
allOk = run("check-pwa", "node", ["tools/check-pwa.mjs"]) && allOk;  // PWA の設定が揃っているか(壊れても気づきにくい)
// **CI では上限を書き換えない。** 手元では減った分を自動で下げるが、
// CI で書き換えても誰もコミットしないので、差分が残るだけになる
allOk = run("check-maintainability", "node",
  ["tools/check-maintainability.mjs", ...(process.env["CI"] !== undefined ? ["--no-ratchet"] : [])]) && allOk;  // 次に触る人が読める大きさか(上限つき)
allOk = run("check-hardcoded-colors", "node", ["tools/check-hardcoded-colors.mjs"]) && allOk;  // 色の直書き(テーマを切り替えても変わらない)
allOk = run("check-contract", "node", ["tools/check-contract.mjs"]) && allOk;
allOk = run("check-drill", "node", ["tools/check-drill.mjs"]) && allOk;  // 復元訓練の鮮度(バックアップは戻せて初めて完成する)  // 外部SaaSとの契約(依存フィールド)と実装のズレを検知  // アクセシビリティの静的検査(キーボード操作・読み上げが壊れる実装を検知)  // JSX インラインタグの閉じ忘れ(next build を構文エラーで落とす。tsc 無しでも一次検知)
allOk = run("check-imports", "node", ["tools/check-imports.mjs"]) && allOk;  // 存在しない名前の取り込み(next build が落ちる)
allOk = run("check-lockfile", "node", ["tools/check-lockfile.mjs"]) && allOk;  // pnpm-lock.yaml と package.json の一致(CI の frozen-lockfile で落ちる前に検知。Amplify で実際に落ちた)
allOk = run("check-unreachable-modules", "node", ["tools/check-unreachable-modules.mjs"]) && allOk;  // 実装があるのに index から出ていないファイル(存在自体が見えなくなる)
allOk = run("check-input-validation", "node", ["tools/check-input-validation.mjs"]) && allOk;  // API が入力を検証しているか(未検証は上限・スキーマ検証は下限)
allOk = run("check-schema-types", "node", ["tools/check-schema-types.mjs"]) && allOk;  // 金額が Float・日時が String になっていないか(上限方式)
allOk = run("check-app-ci", "node", ["tools/check-app-ci.mjs"]) && allOk;  // 各アプリが自分の CI を持っているか(基盤の CI はアプリを見られないため)
allOk = run("check-safety-parts", "node", ["tools/check-safety-parts.mjs"]) && allOk;  // 安全に関わる部品が「必要な場所で」使われているか(繋ぎ込みの被覆)
allOk = run("check-package-tier", "node", ["tools/check-package-tier.mjs"]) && allOk;  // 成熟度(stable/incubating)の宣言と、stable→incubating の依存禁止
allOk = run("check-coverage", "node", ["tools/check-coverage.mjs"]) && allOk;  // カバレッジの下限ラチェット(coverage-summary.json が無ければ skip)
allOk = run("check-build-ready", "node", ["tools/check-build-ready.mjs"]) && allOk;  // next build が通る前提(エントリ/重複export/use client/import)
// **検査そのものが生きているか**を確かめる。
// わざと違反したファイルを一時的に置き、赤になることを見る(終わったら消す)。
// 検査が緑でも「何も見ていない」ことがあるため、最後に必ず通す。
// **CI が壊れると、検査すべてが動かなくなる**(落ちるのではなく走らない)。
// ワークフローは手元で試しにくいので、機械的に拾えるものだけ先に見る。
// **XSS の入口を塞ぐ。** dangerouslySetInnerHTML に外部由来の文字列を渡すと、
// その画面を開いた人のセッションが奪われる
// **付け忘れても画面は動く**ので、動作確認では気づけない
// **連打されるだけで被害が出る**口を塞ぐ(AI の費用・ディスク・CPU)
allOk = run("check-rate-limit", "node", ["tools/check-rate-limit.mjs"]) && allOk;
allOk = run("check-security-headers", "node", ["tools/check-security-headers.mjs"]) && allOk;
allOk = run("check-next-version", "node", ["tools/check-next-version.mjs"]) && allOk;
allOk = run("check-runtime-boundary", "node", ["tools/check-runtime-boundary.mjs"]) && allOk;
allOk = run("check-codeowners", "node", ["tools/check-codeowners.mjs"]) && allOk;
allOk = run("check-unsafe-html", "node", ["tools/check-unsafe-html.mjs"]) && allOk;
allOk = run("check-workflows", "node", ["tools/check-workflows.mjs"]) && allOk;
allOk = run("verify-checks(検査の自己検証)", "node", ["tools/verify-checks.mjs"]) && allOk;
allOk = run("advisor(dup検出)", "node", ["tools/advisor.mjs", "dup"]) && allOk;
if (existsSync("/bin/bash") || existsSync("/usr/bin/bash")) {
  allOk = run("setup.sh 構文", "bash", ["-n", "scripts/setup.sh"]) && allOk;
  allOk = run("Windows setup 検査", "node", ["tools/check-win-setup.mjs"]) && allOk;
} else {
  console.log("⏭  setup.sh 構文        (bash なしのためスキップ)");
}

// **最後に動かす。** ここまでの全検査の出力が揃っているので、
// check-scan-reporting は 1 本も再実行しなくてよい。
// 途中に置くと、それ以降の検査(46 本)を叩き直すことになる(2026-08)。
// **ここまでの出力を渡す。** check-scan-reporting が全検査を叩き直さずに済む
{
  const cache = path.join(root, "node_modules", ".cache", "preflight-outputs.json");
  mkdirSync(path.dirname(cache), { recursive: true });
  writeFileSync(cache, JSON.stringify(outputs));
  allOk = run("check-scan-reporting", "node", ["tools/check-scan-reporting.mjs", "--from-cache"]) && allOk;
}

// **機械可読で出す（`--json`）。**
//
// AI のエージェントに検査を回させるとき、**日本語の画面出力を読ませるのは無駄**です
// ——どれが落ちたかを取り出すために、毎回書式を推測させることになります。
// 落ちた検査の名前と出力だけを JSON で渡せば、
// **「直す → もう一度回す」を機械が回せます**（AI-DLC のような仕組みで使う想定）。
//
// **人向けの出力は消しません。** `--json` を付けたときだけ、最後に 1 行足します。
if (process.argv.includes("--json")) {
  const failed = Object.entries(outputs)
    .filter(([, v]) => v.status !== 0)
    .map(([name, v]) => ({ name, output: v.out.trim() }));
  console.log(JSON.stringify({
    ok: allOk,
    total: Object.keys(outputs).length,
    failed,
    skipped,
  }));
}

console.log("");
if (appsOnly) {
  // **飛ばした数を必ず出す。** 黙って減らすと「全部通した」と誤解される。
  // 基盤そのものを見る検査は、基盤の CI が回している前提。
  console.log(`ℹ  --apps-only: 基盤自身を見る検査 ${skippedPlatform.length} 件を飛ばしました`);
  console.log("   アプリのソースを見る検査はすべて実行しています(基盤の CI では全件が走ります)\n");
}
if (skipped.length > 0) {
  // 見落とすと「緑なのに落ちる」に戻るので、最後にもう一度出す
  console.log(`⚠ ${skipped.length} 項目を skip しました: ${skipped.join(", ")}`);
  console.log("  依存が要る検査です。`pnpm install` 後に再実行してください(CI では必ず走ります)。\n");
}
if (allOk) {
  console.log(skipped.length > 0 ? "preflight: 失敗なし(ただし skip あり ⚠)" : "preflight: すべて緑 ✅");
  // **preflight の緑は「型が通る」ことを意味しない。**
  // 2026-08、apps 側に**実行すると 500 になる箇所が 25 以上**あった
  // (import 漏れ 20 ファイル・`Date` に `.slice()` が 12 箇所・書き誤り)。
  // preflight は全部緑で、smoke も 2,500 件緑だった——
  // **静的検査は「そう書いてあるか」しか見ない**ためである。
  //
  // `check-syntax` は括弧の対応しか見ず、`check-imports` は
  // 「書いた import が実在するか」を見る(**書いていない import は見えない**)。
  console.log("");
  console.log("  ※ preflight が緑でも **型が通るとは限りません**。`pnpm typecheck` を必ず回してください。");
  console.log("     (2026-08、preflight 全緑・smoke 2,500 件緑のまま、実行時に落ちる箇所が 25 以上ありました)");
} else {
  console.error("");
  console.error(`preflight: 失敗あり ❌ — ${failedChecks.length} 件`);
  for (const name of failedChecks) console.error(`   ${name}`);
  console.error("");
  console.error("  **何を守る検査かは `docs/ops/CHECKS.md` に書いてあります**（79 種類の一覧）。");
  console.error("  意図した変更で落ちたなら、そこに「意図した変更で落ちたとき」の節があります。");
  process.exitCode = 1;
}
