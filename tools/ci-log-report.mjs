/**
 * CI 実走ログ(GitHub Actions のジョブログ)を解析して要約する。
 *   node tools/ci-log-report.mjs <ログファイル>          … 人が読む要約を表示
 *   node tools/ci-log-report.mjs <ログファイル> --json    … JSON で出力(機械処理向け)
 *   cat ci.log | node tools/ci-log-report.mjs             … 標準入力からも読める
 *
 * 目的: CI が失敗したとき「どのステップが・なぜ落ちたか」を素早く掴む。ログを貼るだけで、
 *       失敗ステップ・エラー行・所要時間・警告数を抽出する。GitHub の raw ログ形式に対応。
 *
 * GitHub Actions の raw ログは各行が ISO タイムスタンプで始まる:
 *   2026-07-14T05:12:33.1234567Z ##[group]Run node tools/preflight.mjs
 *   2026-07-14T05:12:34.7654321Z ##[error]Process completed with exit code 1.
 * ##[group]/##[endgroup] でステップが区切られ、##[error] が失敗を示す。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const TS_RE = /^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s?/;

/** 1 行からタイムスタンプを剥がし、{ time, text } を返す。 */
function stripTimestamp(line) {
  const m = line.match(TS_RE);
  if (m) return { time: Date.parse(m[1]), text: line.slice(m[0].length) };
  return { time: null, text: line };
}

/**
 * ログ全体を解析。ステップ(##[group]〜##[endgroup])ごとに、
 * 名前・所要秒・エラー行・警告数を集める。グループ外のエラーも拾う。
 */
export function parseCiLog(raw) {
  const lines = raw.split(/\r?\n/);
  const steps = [];
  let current = null; // { name, start, end, errors:[], warnings:0 }
  const looseErrors = []; // グループ外のエラー

  for (const rawLine of lines) {
    const { time, text } = stripTimestamp(rawLine);

    const groupStart = text.match(/^##\[group\](.*)$/);
    if (groupStart) {
      if (current) steps.push(current);
      current = { name: groupStart[1].trim(), start: time, end: time, errors: [], warnings: 0 };
      continue;
    }
    if (/^##\[endgroup\]/.test(text)) {
      if (current) { current.end = time ?? current.end; steps.push(current); current = null; }
      continue;
    }

    if (time != null) {
      if (current) current.end = time;
    }

    const err = text.match(/^##\[error\](.*)$/);
    if (err) {
      const msg = err[1].trim();
      if (current) current.errors.push(msg);
      else looseErrors.push(msg);
      continue;
    }
    if (/^##\[warning\]/.test(text)) {
      if (current) current.warnings += 1;
      continue;
    }
    // 素の "error TS...", "FAIL", "✗", "failed" なども弱いシグナルとして拾う(グループ内のみ)
    if (current && /\b(error TS\d+|FAILED|✗ |\bfailed\b)/.test(text) && current.errors.length < 20) {
      current.errors.push(text.trim());
    }
  }
  if (current) steps.push(current);

  const failedSteps = steps.filter((s) => s.errors.length > 0);
  const durationOf = (s) => (s.start != null && s.end != null ? Math.max(0, Math.round((s.end - s.start) / 1000)) : null);
  const totalWarnings = steps.reduce((a, s) => a + s.warnings, 0);

  return {
    stepCount: steps.length,
    failed: failedSteps.length > 0 || looseErrors.length > 0,
    failedSteps: failedSteps.map((s) => ({ name: s.name, durationSec: durationOf(s), errors: s.errors.slice(0, 5) })),
    looseErrors: looseErrors.slice(0, 5),
    totalWarnings,
    slowestSteps: steps
      .map((s) => ({ name: s.name, durationSec: durationOf(s) }))
      .filter((s) => s.durationSec != null)
      .sort((a, b) => b.durationSec - a.durationSec)
      .slice(0, 5),
  };
}

/** 要約を人が読むテキストに整形。 */
export function formatReport(r) {
  const out = [];
  out.push(r.failed ? "❌ CI 失敗" : "✅ CI 成功");
  out.push(`  ステップ数: ${r.stepCount} / 警告合計: ${r.totalWarnings}`);
  if (r.failedSteps.length > 0) {
    out.push("\n失敗ステップ:");
    for (const s of r.failedSteps) {
      out.push(`  ▶ ${s.name}${s.durationSec != null ? `(${s.durationSec}s)` : ""}`);
      for (const e of s.errors) out.push(`      ${e}`);
    }
  }
  if (r.looseErrors.length > 0) {
    out.push("\nグループ外エラー:");
    for (const e of r.looseErrors) out.push(`  ${e}`);
  }
  if (r.slowestSteps.length > 0) {
    out.push("\n遅いステップ(上位):");
    for (const s of r.slowestSteps) out.push(`  ${s.durationSec}s  ${s.name}`);
  }
  return out.join("\n");
}

function readInput(arg) {
  if (arg && arg !== "--json") return readFileSync(arg, "utf8");
  // 標準入力
  try { return readFileSync(0, "utf8"); } catch { return ""; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const fileArg = args.find((a) => a !== "--json");
  const raw = readInput(fileArg);
  if (!raw.trim()) {
    console.error("使い方: node tools/ci-log-report.mjs <ログファイル> [--json]  (標準入力も可)");
    process.exit(2);
  }
  const report = parseCiLog(raw);
  if (asJson) console.log(JSON.stringify(report, null, 2));
  else console.log(formatReport(report));
  if (report.failed) process.exitCode = 1;
}
