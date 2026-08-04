/**
 * オフライン検証ゲートの一括実行(依存インストール不要)。人も CI(boundaries)もこれ1本。
 *   node tools/preflight.mjs      (= pnpm verify:offline)
 * 内容: smoke / check-deps / api-surface(差分検査) / check-core-signatures / check-schema ×3 / check-env-example / check-generated / check-doc-numbers / check-ports / check-package-shape / check-docs-links / check-docs-duplication / check-docs-orphans / check-doc-apis / check-tsdoc-params / check-e2e-quality / check-package-rules / check-app-rules / check-api-auth / check-auth-stub / check-permissions / check-reimplementation / check-handmade-chart / check-utc-date / check-test-setup / check-path-length / check-dom-lib / check-result-narrowing / check-react-import / check-showcase-deps / check-app-transpile / check-syntax / check-jsx-tags / check-a11y / check-pwa / check-maintainability / check-hardcoded-colors / check-contract / check-drill / check-imports / check-lockfile / check-build-ready / verify-checks / setup.sh 構文
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
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

const run = (name, cmd, args) => {
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8" });
  const ok = r.status === 0;
  const ms = Date.now() - t0;
  const out = (r.stdout + r.stderr).trim();
  // 検査ツールが自分で「skip した」と言っている場合(依存が無い等)
  const isSkip = ok && out.includes("⏭");
  const tail = out.split("\n").filter(Boolean).slice(-1)[0] ?? "";
  const mark = !ok ? "❌" : isSkip ? "⏭ " : "✅";
  console.log(`${mark} ${name.padEnd(22)} ${String(ms).padStart(5)}ms  ${tail}`);
  if (isSkip) skipped.push(name);
  if (!ok) {
    console.error(`----- ${name} の出力 -----`);
    console.error(out);
    console.error("-".repeat(30));
  }
  return ok;
};

console.log("▶ preflight(オフライン検証ゲート)\n");
let allOk = true;
allOk = run("smoke", "node", ["--experimental-strip-types", "tools/smoke.mjs"]) && allOk;
allOk = run("check-deps", "node", ["tools/check-deps.mjs"]) && allOk;
allOk = run("api-surface(差分)", "node", ["tools/api-surface.mjs"]) && allOk;
allOk = run("check-core-signatures", "node", ["tools/check-core-signatures.mjs"]) && allOk;  // 依存の多い基盤の形が変わっていないか
for (const app of ["internal-app", "crud-template", "equipment-app"]) {
  allOk = run(`check-schema:${app}`, "node", ["tools/check-schema.mjs", `apps/${app}/prisma/schema.prisma`]) && allOk;
}
allOk = run("check-env-example", "node", ["tools/check-env-example.mjs"]) && allOk;
allOk = run("check-generated", "node", ["tools/check-generated.mjs"]) && allOk;  // 生成物が古いまま気づかないのを防ぐ
allOk = run("check-doc-numbers", "node", ["tools/check-doc-numbers.mjs"]) && allOk;  // 手書き資料の数値ドリフト(AIが読む前提資料)
allOk = run("check-ports", "node", ["tools/check-ports.mjs"]) && allOk;  // 開発ポートの重複(pnpm dev は一斉起動するため)
allOk = run("check-package-shape", "node", ["tools/check-package-shape.mjs"]) && allOk;  // tsconfig/scripts 欠落(型チェックが素通りする)
allOk = run("check-docs-links", "node", ["tools/check-docs-links.mjs"]) && allOk;
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
allOk = run("check-handmade-chart", "node", ["tools/check-handmade-chart.mjs"]) && allOk;
allOk = run("check-utc-date", "node", ["tools/check-utc-date.mjs"]) && allOk;
allOk = run("check-test-setup", "node", ["tools/check-test-setup.mjs"]) && allOk;
allOk = run("check-path-length", "node", ["tools/check-path-length.mjs"]) && allOk;
allOk = run("check-dom-lib", "node", ["tools/check-dom-lib.mjs"]) && allOk;
allOk = run("check-result-narrowing", "node", ["tools/check-result-narrowing.mjs"]) && allOk;
allOk = run("check-react-import", "node", ["tools/check-react-import.mjs"]) && allOk;
allOk = run("check-showcase-deps", "node", ["tools/check-showcase-deps.mjs"]) && allOk;  // デモサイトの依存漏れ(ビルドしないと気づけない)
allOk = run("check-app-transpile", "node", ["tools/check-app-transpile.mjs"]) && allOk;  // apps の transpilePackages 漏れ(next build だけが落ちる。typecheck/smoke は通る)
allOk = run("check-syntax", "node", ["tools/check-syntax.mjs"]) && allOk;  // 本物のパーサで構文エラーを検出(これが無く、全項目グリーンのまま next build が落ちた)
allOk = run("check-jsx-tags", "node", ["tools/check-jsx-tags.mjs"]) && allOk;
allOk = run("check-a11y", "node", ["tools/check-a11y.mjs"]) && allOk;
allOk = run("check-pwa", "node", ["tools/check-pwa.mjs"]) && allOk;  // PWA の設定が揃っているか(壊れても気づきにくい)
allOk = run("check-maintainability", "node", ["tools/check-maintainability.mjs"]) && allOk;  // 次に触る人が読める大きさか(上限つき)
allOk = run("check-hardcoded-colors", "node", ["tools/check-hardcoded-colors.mjs"]) && allOk;  // 色の直書き(テーマを切り替えても変わらない)
allOk = run("check-contract", "node", ["tools/check-contract.mjs"]) && allOk;
allOk = run("check-drill", "node", ["tools/check-drill.mjs"]) && allOk;  // 復元訓練の鮮度(バックアップは戻せて初めて完成する)  // 外部SaaSとの契約(依存フィールド)と実装のズレを検知  // アクセシビリティの静的検査(キーボード操作・読み上げが壊れる実装を検知)  // JSX インラインタグの閉じ忘れ(next build を構文エラーで落とす。tsc 無しでも一次検知)
allOk = run("check-imports", "node", ["tools/check-imports.mjs"]) && allOk;  // 存在しない名前の取り込み(next build が落ちる)
allOk = run("check-lockfile", "node", ["tools/check-lockfile.mjs"]) && allOk;  // pnpm-lock.yaml と package.json の一致(CI の frozen-lockfile で落ちる前に検知。Amplify で実際に落ちた)
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

console.log("");
if (skipped.length > 0) {
  // 見落とすと「緑なのに落ちる」に戻るので、最後にもう一度出す
  console.log(`⚠ ${skipped.length} 項目を skip しました: ${skipped.join(", ")}`);
  console.log("  依存が要る検査です。`pnpm install` 後に再実行してください(CI では必ず走ります)。\n");
}
if (allOk) {
  console.log(skipped.length > 0 ? "preflight: 失敗なし(ただし skip あり ⚠)" : "preflight: すべて緑 ✅");
} else {
  console.error("preflight: 失敗あり ❌(上の出力を確認)");
  process.exitCode = 1;
}
