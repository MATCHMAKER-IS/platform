/**
 * 負荷テストのランナー。指定した並列数で、時間または回数だけ非同期リクエスト関数を叩き、
 * レイテンシ統計・スループット・エラー率を集計する。実 HTTP でもフェイク関数でも動く（テスト可能）。
 * @packageDocumentation
 */
import { latencyStats, type LatencyStats } from "./stats.js";

/** 1 リクエストの結果。 */
export interface RequestOutcome {
  ok: boolean;
  /** 任意のステータス（HTTP 等）。 */
  status?: number;
  error?: string;
}

/** リクエスト関数（呼ぶたびに 1 リクエストを実行）。 */
export type RequestFn = (ctx: { index: number }) => Promise<RequestOutcome>;

/** 実行オプション。durationMs か iterations のどちらかを指定。 */
export interface LoadOptions {
  /** 並列ワーカー数。 */
  concurrency: number;
  /** 実行時間（ms）。iterations と併用時は先に満了した方で停止。 */
  durationMs?: number;
  /** 総リクエスト数（未指定なら durationMs による）。 */
  iterations?: number;
  /** 現在時刻取得（テスト注入用、既定 Date.now）。 */
  now?: () => number;
}

/** 集計結果。 */
export interface LoadResult {
  /** 総リクエスト数。 */
  total: number;
  success: number;
  failed: number;
  /** エラー率（0–1）。 */
  errorRate: number;
  /** 実測経過時間（ms）。 */
  elapsedMs: number;
  /** スループット（req/s）。 */
  throughput: number;
  /** レイテンシ統計（ms）。 */
  latency: LatencyStats;
  /** ステータス別の件数。 */
  statusCounts: Record<string, number>;
}

/**
 * 負荷テストを実行する。並列ワーカーが、停止条件を満たすまでリクエスト関数を呼び続ける。
 */
export async function runLoad(request: RequestFn, options: LoadOptions): Promise<LoadResult> {
  const now = options.now ?? Date.now;
  const concurrency = Math.max(1, options.concurrency);
  const start = now();
  const deadline = options.durationMs !== undefined ? start + options.durationMs : Infinity;
  const maxIterations = options.iterations ?? Infinity;

  const latencies: number[] = [];
  const statusCounts: Record<string, number> = {};
  let dispatched = 0;
  let success = 0;
  let failed = 0;

  const shouldContinue = () => dispatched < maxIterations && now() < deadline;

  const worker = async () => {
    while (shouldContinue()) {
      const index = dispatched;
      dispatched += 1;
      const t0 = now();
      let outcome: RequestOutcome;
      try {
        outcome = await request({ index });
      } catch (e) {
        outcome = { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
      const dt = now() - t0;
      latencies.push(dt);
      const key = outcome.status !== undefined ? String(outcome.status) : outcome.ok ? "ok" : "error";
      statusCounts[key] = (statusCounts[key] ?? 0) + 1;
      if (outcome.ok) success += 1;
      else failed += 1;
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const elapsedMs = Math.max(1, now() - start);
  const total = success + failed;
  return {
    total,
    success,
    failed,
    errorRate: total === 0 ? 0 : failed / total,
    elapsedMs,
    throughput: (total / elapsedMs) * 1000,
    latency: latencyStats(latencies),
    statusCounts,
  };
}

/** 結果を人間可読な 1 行サマリーにする。 */
export function formatResult(r: LoadResult): string {
  return `${r.total} reqs, ${(r.throughput).toFixed(1)} req/s, err ${(r.errorRate * 100).toFixed(1)}%, p50 ${r.latency.p50.toFixed(0)}ms / p95 ${r.latency.p95.toFixed(0)}ms / p99 ${r.latency.p99.toFixed(0)}ms`;
}
