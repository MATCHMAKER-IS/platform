/**
 * **各アプリが自分の CI を持っているか**を検査する。
 *   node tools/check-app-ci.mjs
 *   node tools/check-app-ci.mjs --list
 *
 * 【なぜ必要か — これが「繋ぐ」の急所】
 *
 * 基盤の `.gitignore` は `apps/*` を除外している(ADR 0021)。
 * **基盤のリポジトリにアプリのソースは入っていない。**
 *
 * ところが、**基盤の検査の半分以上はアプリを走査する**。
 * つまりこの 50 種類は、**基盤の CI では対象がほとんど存在しない**。
 *
 * 2026-08 の実測:
 *
 * | | 手元 | 基盤の CI |
 * |---|---|---|
 * | 見える API | 264 本 | **22 本** |
 * | 見えない | — | **242 本(92%)** |
 *
 * `check-api-auth` は手元で「API 264 本 / どちらも無い 0」と緑を出すが、
 * **CI が見ているのは showcase と crud-template だけ**である。
 *
 * **残り 242 本を見る手段は、アプリ側リポジトリの CI しかない。**
 * そのテンプレートは `apps/crud-template/.github/workflows/ci.yml` にあり、
 * `pnpm new-app` がコピーする。しかし 2026-08 の時点で、
 * **実アプリ 3 つ(internal-app / public-site / line-console)には
 * 1 つも置かれていなかった**——テンプレートは存在したが、誰も配っていなかった。
 *
 * **「テンプレートがある」は「使われている」ではない。**
 * これは基盤全体の弱点と同じ形で、`check-safety-parts` が
 * 部品について見ているものを、この検査は CI について見ている。
 *
 * 【何を見るか】
 *   1. `apps/<名前>/` に `.github/workflows/ci.yml` があるか
 *   2. その中身がテンプレートから**ずれていないか**(基盤側でテンプレートを
 *      直しても、配った先が古いままだと意味が無い)
 *
 * 【対象外】
 * `showcase` は基盤の一部であり、**基盤の CI が直接見ている**ので不要。
 * `crud-template` は雛形そのもの(コピー元)。
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPS = path.join(ROOT, "apps");
const TEMPLATE = path.join(APPS, "crud-template/.github/workflows/ci.yml");
const WORKFLOW = ".github/workflows/ci.yml";

/**
 * 検査しないアプリと、その理由。
 *
 * **理由を書かずに足さないこと。** 除外は増える一方になりやすく、
 * 理由が無いと後から来た人が減らせない。
 */
const EXEMPT = {
  showcase: "基盤の一部。基盤の CI が直接見ている（.gitignore の例外）",
  "crud-template": "雛形そのもの（このファイルのコピー元）",
};

/** `apps/` 直下のアプリ名を集める。 */
function listApps() {
  if (!existsSync(APPS)) return [];
  return readdirSync(APPS)
    .filter((name) => {
      const p = path.join(APPS, name);
      return statSync(p).isDirectory() && existsSync(path.join(p, "package.json"));
    })
    .sort();
}

/**
 * テンプレートとの本質的な差を見る。
 *
 * **コメントと空行は無視する。** アプリ側で説明を足すのは自然で、
 * そこまで揃えろと言うと**テンプレートを剥がされる**。
 * 見るのは「実行される行」だけ。
 */
function meaningfulLines(text) {
  return text
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.trim() !== "" && !l.trim().startsWith("#"));
}

export function check({ list = false } = {}) {
  if (!existsSync(TEMPLATE)) {
    console.error(`❌ テンプレートがありません: apps/crud-template/${WORKFLOW}`);
    return { ok: false };
  }
  const templateLines = meaningfulLines(readFileSync(TEMPLATE, "utf8"));
  const apps = listApps();
  const missing = [];
  const drifted = [];
  let checked = 0;

  for (const name of apps) {
    if (name in EXEMPT) continue;
    checked += 1;
    const fp = path.join(APPS, name, WORKFLOW);
    if (!existsSync(fp)) {
      missing.push(name);
      continue;
    }
    const lines = meaningfulLines(readFileSync(fp, "utf8"));
    // **テンプレートの実行行がすべて含まれていること。**
    // 完全一致は求めない——アプリ固有の手順（seed・E2E など）を足すのは正しい。
    const missingSteps = templateLines.filter((l) => !lines.includes(l));
    if (missingSteps.length > 0) {
      drifted.push({ name, missingSteps });
    }
  }

  if (list) {
    for (const name of apps) {
      const why = EXEMPT[name];
      const state = why ? `対象外（${why}）` : existsSync(path.join(APPS, name, WORKFLOW)) ? "あり" : "**なし**";
      console.log(`  ${name.padEnd(16)} ${state}`);
    }
    return { ok: true };
  }

  if (missing.length > 0 || drifted.length > 0) {
    if (missing.length > 0) {
      console.error(`❌ 自分の CI を持たないアプリが ${missing.length} 件あります: ${missing.join(" ")}`);
      console.error(`   基盤の CI はこのアプリを見ていません。**誰も検査していない状態**です。`);
      console.error(`   → cp apps/crud-template/${WORKFLOW} apps/<アプリ>/${WORKFLOW}`);
      console.error(`     コピー後、\`repository: <あなたの組織>/platform\` を自組織名に書き換えてください`);
    }
    for (const d of drifted) {
      console.error(`❌ ${d.name}: テンプレートから ${d.missingSteps.length} 行ぶんずれています`);
      for (const l of d.missingSteps.slice(0, 5)) console.error(`     欠けている行: ${l.trim()}`);
      if (d.missingSteps.length > 5) console.error(`     ほか ${d.missingSteps.length - 5} 行`);
    }
    return { ok: false };
  }

  console.log(
    `✅ 全アプリが自分の CI を持っています(${checked} 件を検査 / 対象外 ${Object.keys(EXEMPT).length} 件)`,
  );
  return { ok: true };
}

// **`file://${process.argv[1]}` で比べない。** Windows では
// `import.meta.url` が `file:///C:/…`、`process.argv[1]` が `C:\…` になり、
// **一致しないので本体が動かない**(何も出力せず終わる。エラーも出ないので気づけない)。
// 2026-08、`node tools/check-coverage.mjs --set-floor` が Windows で無反応だった。
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = check({ list: process.argv.includes("--list") });
  process.exit(r.ok ? 0 : 1);
}
