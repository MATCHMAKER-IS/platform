#!/usr/bin/env node
/**
 * 負荷テスト CLI。@platform/loadtest を使って指定 URL を並列で叩き、レイテンシ統計を出力する。
 *
 * 使い方:
 *   node --experimental-strip-types tools/loadtest.mjs --url http://localhost:3000/api/health --concurrency 20 --duration 10000
 *   node --experimental-strip-types tools/loadtest.mjs --url ... --iterations 1000 --concurrency 50 --method GET
 *
 * ネットワーク制限下では --dry を付けるとフェイクターゲット（ランダム遅延）で動作確認できる。
 */
import { runLoad, formatResult } from "@platform/loadtest";

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

const args = parseArgs(process.argv);
const concurrency = Number(args.concurrency ?? 10);
const durationMs = args.duration ? Number(args.duration) : undefined;
const iterations = args.iterations ? Number(args.iterations) : undefined;
const method = args.method ?? "GET";
const url = args.url;

if (!args.dry && !url) {
  console.error("エラー: --url を指定してください（または --dry でフェイク実行）");
  process.exit(1);
}
if (!durationMs && !iterations) {
  console.error("エラー: --duration(ms) か --iterations のどちらかを指定してください");
  process.exit(1);
}

const request = args.dry
  ? async () => {
      // フェイク: 5–50ms のランダム遅延、5% で失敗
      const delay = 5 + Math.random() * 45;
      await new Promise((r) => setTimeout(r, delay));
      return Math.random() < 0.05 ? { ok: false, status: 500 } : { ok: true, status: 200 };
    }
  : async () => {
      try {
        const res = await fetch(url, { method });
        return { ok: res.ok, status: res.status };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    };

const opts = { concurrency };
if (durationMs !== undefined) opts.durationMs = durationMs;
if (iterations !== undefined) opts.iterations = iterations;

console.log(`負荷テスト開始: ${args.dry ? "(dry-run)" : `${method} ${url}`} concurrency=${concurrency} ${durationMs ? `duration=${durationMs}ms` : `iterations=${iterations}`}`);
const result = await runLoad(request, opts);
console.log(formatResult(result));
console.log(JSON.stringify(result.latency, null, 2));
console.log("statusCounts:", JSON.stringify(result.statusCounts));
