/**
 * **テストが実行できる形になっているか**を検査する。
 *   node tools/check-test-setup.mjs
 *
 * 【なぜ必要か】
 * `pnpm test` は 2 つの理由で**一度も成功していなかった**。どちらもテストの中身とは
 * 無関係な「設定の事故」で、しかも**個々のテストを見ても分からない**。
 *
 * 1. `vitest.workspace.ts` が `"demos/*"` と書かれており、`demos/README.md` にも
 *    マッチしていた。vitest がそれを設定ファイルとして読もうとして
 *    `No loader is configured for ".md" files` になり、**全パッケージの設定が
 *    読み込み失敗**した(テストが 1 件も動かない)。
 *
 * 2. 共通プリセットが `vitest.preset.ts` だった。各パッケージの `vitest.config.ts` から
 *    ワークスペース外の依存として import されると、vite はバンドルせず Node に渡す。
 *    Node は `.ts` を読めないため `ERR_UNKNOWN_FILE_EXTENSION` で落ちる。
 *
 * どちらも「テストが 0 件で緑」ではなく「起動しない」形で出るが、
 * **CI のログを最後まで読まないと気づけない**(先頭は警告の山になる)。
 * 検査として明示しておく。
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { collectFiles } from "./lib/collect-files.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const problems = [];

// ── 1. ワークスペースのグロブが設定ファイルを指しているか ──────────────────
const wsPath = path.join(ROOT, "vitest.workspace.ts");
if (existsSync(wsPath)) {
  const text = readFileSync(wsPath, "utf8");
  for (const m of text.matchAll(/"([^"]+)"/g)) {
    const pattern = m[1];
    if (!pattern.includes("*")) continue;
    if (pattern.endsWith("vitest.config.ts")) continue; // 設定ファイル直指定なので安全
    problems.push(
      `vitest.workspace.ts の "${pattern}" はディレクトリを指しています。` +
      `\n     → "${pattern.replace(/\/$/, "")}/vitest.config.ts" のように**設定ファイルを直接指して**ください` +
      `\n       (ディレクトリ指定は README.md などにも当たり、ワークスペース全体が起動しなくなります)`,
    );
  }
}

// ── 1b. ワークスペースのコメントが途中で終わっていないか ────────────────────
// グロブを説明しようとして `"demos/*/"` のようにコメント内へ書くと、
// **`*/` がブロックコメントを早期終了させる**。以降がコードとして解釈され、
// `Unterminated string literal` で起動しない。実際にこれで踏んだ。
if (existsSync(wsPath)) {
  const text = readFileSync(wsPath, "utf8");
  const firstEnd = text.indexOf("*/");
  const exportAt = text.indexOf("export default");
  if (firstEnd !== -1 && exportAt !== -1 && firstEnd > exportAt) {
    problems.push("vitest.workspace.ts: ブロックコメントが export より後で終わっています(コメント内の */ を疑ってください)");
  }
  for (const [i, line] of text.split("\n").entries()) {
    if (/^\s*\*\s/.test(line) && line.includes("*/") && !/^\s*\*\/\s*$/.test(line)) {
      problems.push(
        `vitest.workspace.ts:${i + 1} コメント行に */ が含まれ、**コメントがここで終わります**` +
        `\n     → グロブを書くなら「末尾をスラッシュで終える」のように文章で説明してください`,
      );
    }
  }
}

// ── 2. 共通プリセットが Node から読める拡張子か ────────────────────────────
const configPkgPath = path.join(ROOT, "packages", "config", "package.json");
if (existsSync(configPkgPath)) {
  const pkg = JSON.parse(readFileSync(configPkgPath, "utf8"));
  for (const [name, target] of Object.entries(pkg.exports ?? {})) {
    if (typeof target !== "string") continue;
    if (target.endsWith(".json")) continue;
    // ここは **`@platform/config` の exports が指す先**の拡張子。
    // 設定ファイルなので `.tsx` はありえない(`.tsx` 漏れではない)
    if (target.endsWith(".ts")) {
      problems.push(
        `@platform/config の exports "${name}" が ${target} を指しています。` +
        `\n     → Node は .ts を読めません(ERR_UNKNOWN_FILE_EXTENSION)。.mjs にしてください`,
      );
    }
  }
}

// ── 3. テストがあるのに実行されないパッケージ ──────────────────────────────
// 設定が無い / test スクリプトが echo などで**素通り**していると、
// テストが書かれていても一度も動かない。実際に @platform/ui(83 件)と
// internal-app(16 件)がこの状態で放置されていた。
for (const group of ["packages", "apps"]) {
  const groupDir = path.join(ROOT, group);
  if (!existsSync(groupDir)) continue;
  for (const name of readdirSync(groupDir)) {
    const dir = path.join(groupDir, name);
    if (!statSync(dir).isDirectory()) continue;
    const src = path.join(dir, "src");
    if (!existsSync(src)) continue;
    const hasTest = readdirSync(src, { recursive: true, withFileTypes: true })
      .some((e) => e.isFile() && /\.test\.tsx?$/.test(e.name));
    if (!hasTest) continue;

    if (!existsSync(path.join(dir, "vitest.config.ts"))) {
      problems.push(`${group}/${name}: テストがあるのに vitest.config.ts がありません`);
      continue;
    }
    const pkgPath = path.join(dir, "package.json");
    if (!existsSync(pkgPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    const testScript = pkg.scripts?.test ?? "";
    if (!testScript.includes("vitest")) {
      problems.push(
        `${group}/${name}: テストがあるのに test スクリプトが vitest を呼んでいません(現在: ${testScript || "(未設定)"})`,
      );
    }
    // vitest.config.ts が共通プリセットを読むなら、依存として宣言が要る
    const configText = readFileSync(path.join(dir, "vitest.config.ts"), "utf8");
    if (configText.includes("@platform/config") && !(pkg.devDependencies?.["@platform/config"])) {
      problems.push(
        `${group}/${name}: vitest.config.ts が @platform/config を読むのに devDependencies に宣言がありません` +
        `\n     → pnpm はワークスペース外の未宣言依存を解決できません(ERR_MODULE_NOT_FOUND)`,
      );
    }
  }
}

// ── 4. アプリのテストに必要な環境変数が揃っているか ────────────────────────
// サーバ側のモジュールは読み込み時に parseEnv が走り、欠けていれば落ちる。
// **テストの中身とは無関係に「環境変数の検証に失敗しました」で全部落ちる**ので、
// vitest.config.ts の test.env に必須項目が揃っているかを機械的に照合する。
const appsDir = path.join(ROOT, "apps");
if (existsSync(appsDir)) {
  for (const name of readdirSync(appsDir)) {
    const envFile = path.join(appsDir, name, "src", "server", "env.ts");
    const cfgFile = path.join(appsDir, name, "vitest.config.ts");
    if (!existsSync(envFile) || !existsSync(cfgFile)) continue;

    const envSrc = readFileSync(envFile, "utf8");
    const required = new Set();
    // parseEnv のスキーマで default/optional が無いもの
    const schema = envSrc.split("parseEnv(")[1] ?? "";
    for (const line of schema.split("\n")) {
      const m = /^\s*([A-Z_0-9]+):\s*z\.(.+?),\s*$/.exec(line);
      if (m && m[2] && !m[2].includes(".default(") && !m[2].includes(".optional(")) required.add(m[1]);
    }
    // requireEnv([...]) も必須
    for (const m of envSrc.matchAll(/requireEnv\(\[([^\]]+)\]\)/g)) {
      for (const k of (m[1] ?? "").matchAll(/"([A-Z_0-9]+)"/g)) required.add(k[1]);
    }

    const cfgSrc = readFileSync(cfgFile, "utf8");
    const provided = new Set([...cfgSrc.matchAll(/^\s+([A-Z_0-9]+):/gm)].map((m) => m[1]));
    const missing = [...required].filter((k) => !provided.has(k));
    if (missing.length > 0) {
      problems.push(
        `apps/${name}: テストに必要な環境変数が vitest.config.ts にありません(${missing.join(", ")})` +
        `\n     → test.env にダミー値を入れてください(**本番の値は書かない**)`,
      );
    }
  }
}

// ── 5.(削除)Prisma の生成物の有無は検査しない ────────────────────────────
// かつて `node_modules/.prisma/client` の存在を見ていたが、**生成先は
// Prisma と pnpm のバージョンで変わる**(Prisma 7 は `@prisma/client` の中へ生成する)。
// 決め打ちすると環境によって誤検知するため、検査ではなく資料で案内する
// (`docs/ops/TESTING_GUIDE.md` の「実行のしかた」)。
//
// 実運用では `pnpm test`(turbo 経由)が `^build` で `prisma generate` を先に走らせる。

// ── 6. Prisma 7 の schema が旧形式のままでないか ──────────────────────────
// Prisma 7 から `datasource.url` が **schema.prisma では使えない**(`P1012`)。
// 接続先は `prisma.config.ts` に移す。残っていると `prisma generate` が落ち、
// **`build` も CI のデプロイも通らない**(generate は build の前段)。
for (const schemaPath of collectFiles(["packages", "apps"], ROOT, { extensions: [".prisma"] })) {
  const text = readFileSync(path.join(ROOT, schemaPath), "utf8");
  if (!/^\s*url\s*=/m.test(text)) continue;
  problems.push(
    `${schemaPath}: Prisma 7 では datasource の url を schema に書けません(P1012)` +
    `\n     → url の行を消し、同じパッケージに prisma.config.ts を置いてください`,
  );
}
// **schema があるディレクトリには prisma.config.ts が要る。**
// Prisma 7 は接続先を config で受け取る(schema の url は P1012)。
// アプリごとに schema と生成先(output)を分けているので、config もアプリごとに置く。
for (const schemaPath of collectFiles(["packages", "apps"], ROOT, { extensions: [".prisma"] })) {
  const pkgRoot = schemaPath.split("/").slice(0, 2).join("/");
  if (!existsSync(path.join(ROOT, pkgRoot, "prisma.config.ts"))) {
    problems.push(`${pkgRoot}/prisma.config.ts がありません(Prisma 7 では接続先をここで渡します)`);
  }
}

// **schema があるパッケージは Prisma の依存を宣言する。**
// pnpm は未宣言の依存を解決しないので、`prisma generate` が
// `Could not resolve @prisma/client` で落ちる(生成物のランタイムに必要)。
for (const schemaPath of collectFiles(["packages", "apps"], ROOT, { extensions: [".prisma"] })) {
  const pkgRoot = schemaPath.split("/").slice(0, 2).join("/");
  const pkgPath = path.join(ROOT, pkgRoot, "package.json");
  if (!existsSync(pkgPath)) continue;
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const all = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const need of ["@prisma/client", "prisma"]) {
    if (!all[need]) {
      problems.push(
        `${pkgRoot}: schema.prisma があるのに ${need} を宣言していません` +
        `\n     → pnpm は未宣言の依存を解決しません(prisma generate が落ちます)`,
      );
    }
  }
}

// **アプリの schema には output が要る。** 既定のままだと全アプリが
// node_modules/@prisma/client を奪い合い、**最後に generate したものしか型が通らない**。
for (const schemaPath of collectFiles(["apps"], ROOT, { extensions: [".prisma"] })) {
  const text = readFileSync(path.join(ROOT, schemaPath), "utf8");
  const gen = /generator\s+\w+\s*\{([\s\S]*?)\}/.exec(text);
  if (gen && !/^\s*output\s*=/m.test(gen[1] ?? "")) {
    problems.push(
      `${schemaPath}: generator に output がありません` +
      `\n     → 生成先を分けないと、**最後に generate したアプリしか型が通りません**`,
    );
  }
}

// ── 7. turbo の UI モード ────────────────────────────────────────────────
// `"ui": "tui"` は Windows でクラッシュする報告がある
// (turborepo の既知バグ #8861 / #9999 / #11434)。
// この基盤は Windows での開発を支援しているので `stream` を使う。
//
// 注意: 2026-07 時点で `stream` にしても turbo 2.10.5 は Windows で落ちる
// (別原因・未解決)。回避策は `pnpm -r run build`(HANDOVER 参照)。
const turboPath = path.join(ROOT, "turbo.json");
if (existsSync(turboPath)) {
  const turbo = JSON.parse(readFileSync(turboPath, "utf8"));
  if (turbo.ui === "tui" || turbo.global?.ui === "tui") {
    problems.push(
      'turbo.json の "ui" が "tui" です。**Windows で turbo がクラッシュします**' +
      "\n     → \"stream\" にしてください(turborepo の既知バグ #8861 / #9999 / #11434)",
    );
  }
}

if (problems.length > 0) {
  console.error("❌ テストを実行できない設定があります。**テストの中身ではなく設定の問題**です。");
  for (const p of problems) console.error(`   - ${p}`);
  process.exitCode = 1;
} else {
  console.log(`✅ テストを実行できる設定です(${problems.length === 0 ? "すべて" : ""}ワークスペース・共通プリセット・各パッケージの設定 3 種を確認)`);
}
