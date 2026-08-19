/**
 * **カバレッジが前より下がっていないか**を検査する(下限ラチェット方式)。
 *
 *   pnpm test:coverage                       … 計測して JSON を出す
 *   node tools/check-coverage.mjs            … 下限と比べる
 *   node tools/check-coverage.mjs --list     … パッケージ別に一覧
 *   node tools/check-coverage.mjs --set-floor … 上がったら下限を上げる
 *
 * 【なぜ必要か】
 * `packages/config/vitest.preset.mjs` には **2026-08 の時点で
 * `thresholds: { lines: 80, ... }` が書いてあったが、CI も `pnpm check` も
 * `--coverage` を一度も付けていなかった**。つまり**書いてあるだけで、
 * 一度も評価されたことがない閾値**だった。
 *
 * 【なぜ 80% を即座に強制しないか】
 * いきなり 80% を課すと、**大半のパッケージが赤**になって CI が止まる。
 * 止まった CI は「とりあえず外す」で無効化され、結局**何も守らなくなる**——
 * `check-maintainability` が上限方式を採っているのと同じ理由。
 *
 * **下がったら止める。上がったら下限を上げる。** これだけを守れば、
 * カバレッジは単調に増える。80% に届いたパッケージから
 * `STRICT` に移し、そこからは絶対値で守る。
 *
 * 【入力】
 * `coverage/coverage-summary.json`(vitest の `json-summary` reporter)。
 * 無ければ **skip**(⏭ を出して 0 で終わる)——依存が要る検査なので、
 * `pnpm install` 前の手元では走らせられない。
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SUMMARY = path.join(ROOT, "coverage", "coverage-summary.json");
const FLOOR_FILE = path.join(ROOT, "tools", "coverage-floor.json");

/**
 * **絶対値で守るパッケージ。** 壊れたときの影響が全アプリに及ぶものだけを入れる。
 * ここに入れたら、下限ラチェットではなく **80% を下回った時点で落ちる**。
 *
 * 増やすときは、そのパッケージが実際に 80% を超えてから。
 */
const STRICT = new Set(["core", "crypto", "guard"]);

/** 絶対値で守るときの下限(%)。 */
const STRICT_MIN = 80;

/** パッケージ名をファイルパスから取り出す。`packages/<名前>/src/...` 以外は null。 */
function packageOf(file) {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  const m = rel.match(/^packages\/([^/]+)\//);
  return m ? m[1] : null;
}

/** coverage-summary.json をパッケージ別の行カバレッジ(%)に畳む。 */
function collect(summary) {
  const acc = {};
  for (const [file, data] of Object.entries(summary)) {
    if (file === "total") continue;
    const pkg = packageOf(file);
    if (pkg === null) continue;
    const cur = acc[pkg] ?? { covered: 0, total: 0 };
    cur.covered += data.lines?.covered ?? 0;
    cur.total += data.lines?.total ?? 0;
    acc[pkg] = cur;
  }
  const out = {};
  for (const [pkg, { covered, total }] of Object.entries(acc)) {
    // **0 行のパッケージは 100% にしない。** 「測れていない」と「完璧」は違う。
    if (total === 0) continue;
    out[pkg] = Math.floor((covered / total) * 1000) / 10;
  }
  return out;
}

export function check({ setFloor = false, list = false } = {}) {
  if (!existsSync(SUMMARY)) {
    const registered = existsSync(FLOOR_FILE)
      ? Object.keys(JSON.parse(readFileSync(FLOOR_FILE, "utf8")).packages ?? {}).length
      : 0;
    console.log(`⏭  check-coverage は skip しました(0 件を検査 / 下限の登録は ${registered} 件)。`);
    console.log("   coverage/coverage-summary.json がありません。`pnpm test:coverage` の後に回してください");
    return { ok: true, skipped: true };
  }

  /** @type {Record<string, { lines?: { covered?: number, total?: number } }>} */
  const summary = JSON.parse(readFileSync(SUMMARY, "utf8"));
  const current = collect(summary);
  const floor = existsSync(FLOOR_FILE)
    ? JSON.parse(readFileSync(FLOOR_FILE, "utf8")).packages ?? {}
    : {};

  if (list) {
    const rows = Object.entries(current).sort((a, b) => a[1] - b[1]);
    for (const [pkg, pct] of rows) {
      const mark = STRICT.has(pkg) ? (pct >= STRICT_MIN ? "✅" : "❌") : "  ";
      console.log(`${mark} ${pkg.padEnd(16)} ${String(pct).padStart(5)}%  (下限 ${floor[pkg] ?? "-"})`);
    }
    return { ok: true };
  }

  if (setFloor) {
    const next = { ...floor };
    let raised = 0;
    for (const [pkg, pct] of Object.entries(current)) {
      if (next[pkg] === undefined || pct > next[pkg]) {
        if (next[pkg] !== undefined) raised += 1;
        next[pkg] = pct;
      }
    }
    writeFileSync(
      FLOOR_FILE,
      JSON.stringify(
        {
          _comment: "パッケージ別の行カバレッジ下限(%)。下がったら CI が落ちる。上がったら --set-floor で引き上げる。",
          updatedAt: new Date().toISOString().slice(0, 10),
          packages: next,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(`✅ 下限を更新しました(${Object.keys(next).length} パッケージ / 引き上げ ${raised} 件)`);
    return { ok: true };
  }

  const dropped = [];
  const belowStrict = [];
  for (const [pkg, pct] of Object.entries(current)) {
    const min = floor[pkg];
    if (min !== undefined && pct < min) dropped.push(`${pkg}: ${pct}% (下限 ${min}%)`);
    if (STRICT.has(pkg) && pct < STRICT_MIN) belowStrict.push(`${pkg}: ${pct}% (必須 ${STRICT_MIN}%)`);
  }
  // **下限に登録が無いパッケージも報告する。** 新しいパッケージが
  // 「まだ下限が無いから素通り」になると、ラチェットに穴が開く。
  const unregistered = Object.keys(current).filter((p) => floor[p] === undefined);

  if (dropped.length > 0 || belowStrict.length > 0) {
    if (belowStrict.length > 0) {
      console.error("❌ 中核パッケージのカバレッジが必須値を下回っています:");
      for (const line of belowStrict) console.error(`   ${line}`);
    }
    if (dropped.length > 0) {
      console.error("❌ カバレッジが前回より下がりました:");
      for (const line of dropped) console.error(`   ${line}`);
      console.error("   テストを足すか、意図的に減らしたなら `--set-floor` で下限を引き直してください");
    }
    return { ok: false };
  }

  const note = unregistered.length > 0 ? `・未登録 ${unregistered.length} 件(--set-floor で登録)` : "";
  console.log(`✅ カバレッジは下限を維持しています(${Object.keys(current).length} パッケージ${note})`);
  return { ok: true };
}

// **`file://${process.argv[1]}` で比べない。** Windows では
// `import.meta.url` が `file:///C:/…`、`process.argv[1]` が `C:\…` になり、
// **一致しないので本体が動かない**(何も出力せず終わる。エラーも出ないので気づけない)。
// 2026-08、`node tools/check-coverage.mjs --set-floor` が Windows で無反応だった。
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = check({
    setFloor: process.argv.includes("--set-floor"),
    list: process.argv.includes("--list"),
  });
  process.exit(r.ok ? 0 : 1);
}
