/**
 * **GitHub Actions のワークフローが壊れていないか**を検査する。
 *   node tools/check-workflows.mjs
 *
 * 【なぜ必要か】
 * CI が壊れると、**42 種類の検査すべてが動かなくなる**。
 * しかも「落ちる」のではなく「そもそも走らない」ため、緑に見えてしまう。
 *
 * ワークフローは手元で試しにくく（push しないと動かない）、
 * 間違いに気づくまでに時間がかかる。オフラインで機械的に拾えるものだけを見る。
 *
 * 【検査するもの】
 *  W001 `git diff` を使うのに `fetch-depth: 0` が無い
 *       … 既定は浅いクローン(depth 1)。差分が取れず、その処理だけ黙って失敗する
 *  W002 秘密情報の直書き
 *       … `secrets.` を使わず値を書いている
 *  W003 `permissions` の指定が無い
 *       … 既定の権限は広い。書き込みが要らないなら明示して絞る
 *  W004 使っているスクリプトが実在しない
 *       … `node tools/xxx.mjs` と書いてあるのにファイルが無い
 *  W005 `pnpm` を使うのに `pnpm/action-setup` が無い
 *       … 「pnpm: command not found」で落ちる
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIR = path.join(ROOT, ".github/workflows");

/** 見つかった問題。 */
const issues = [];
const add = (file, code, message) => issues.push({ file, code, message });

if (!existsSync(DIR)) {
  console.log("✅ .github/workflows がありません(検査対象なし)");
  process.exit(0);
}

const files = readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f));

for (const name of files) {
  const src = readFileSync(path.join(DIR, name), "utf8");

  // W001: git diff を使うのに履歴が浅い
  // **既定は depth 1** なので、origin/main との差分が取れない。
  // エラーにならず「差分なし」として扱われることもあり、気づきにくい。
  if (/git\s+(diff|log|merge-base)|--base\s+origin\//.test(src) && !/fetch-depth:\s*0/.test(src)) {
    add(name, "W001", "git の差分を使っていますが `fetch-depth: 0` がありません(既定は浅いクローンで、差分が取れません)");
  }

  // W002: 秘密情報の直書き
  //
  // **CI の中だけで使う値は対象外**にする。次のものは外に漏れないので問題ない:
  //   - CI 専用と分かる名前(`ci-` / `-for-build-only` / `dummy` / `test` を含む)
  //   - CI 内で立てるコンテナの設定(`POSTGRES_PASSWORD: postgres` など)
  // これを見分けないと、直しようのない指摘が残って検査そのものが疎まれる。
  const CI_ONLY = /^(ci-|dummy|test|localhost|postgres$|example)|(-for-(build|ci|test)-only|dummy|placeholder)/i;
  for (const m of src.matchAll(/^\s*([A-Z_]*(?:TOKEN|SECRET|PASSWORD|API_KEY)[A-Z_]*)\s*:\s*(["']?)([^\s"'#]+)\2\s*$/gim)) {
    const key = m[1];
    const value = m[3];
    if (value.startsWith("${{")) continue;  // secrets 経由なら正常
    if (CI_ONLY.test(value)) continue;      // CI 内だけで使う値
    add(name, "W002", `秘密情報らしき値が直接書かれています(\`${key}\`)。\`\${{ secrets.NAME }}\` を使ってください`);
  }

  // W003: permissions が無い
  // 既定の GITHUB_TOKEN は広い権限を持つ。**要らない権限は与えない**。
  if (!/^permissions:/m.test(src)) {
    add(name, "W003", "`permissions:` の指定がありません(既定は広い権限。必要なものだけ書いてください)");
  }

  // W004: 呼んでいるスクリプトが実在しない
  for (const m of src.matchAll(/node\s+(tools\/[\w.-]+\.m?[jt]s)/g)) {
    const rel = m[1];
    if (!existsSync(path.join(ROOT, rel))) {
      add(name, "W004", `\`${rel}\` がありません(名前を変えたか、消したまま残っています)`);
    }
  }

  // W005: pnpm を使うのに setup が無い
  if (/\brun:\s*.*\bpnpm\b/.test(src) && !/pnpm\/action-setup/.test(src)) {
    add(name, "W005", "`pnpm` を使っていますが `pnpm/action-setup` がありません(`pnpm: command not found` で落ちます)");
  }
}

if (issues.length === 0) {
  console.log(`✅ GitHub Actions のワークフローに問題はありません(${files.length} ファイル検査)`);
  process.exit(0);
}

for (const i of issues) {
  console.error(`❌ .github/workflows/${i.file} [${i.code}] ${i.message}`);
}
console.error(`\n❌ ワークフローの問題が ${issues.length} 件。**CI が動かないと、検査すべてが止まります。**`);
process.exitCode = 1;
