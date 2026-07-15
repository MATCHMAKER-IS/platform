/**
 * 負荷テストのシナリオ定義。重み付けした複数ステップを並列で叩き、ステップ別＋全体の統計を出す。
 * ランプアップ（並列数を時間で徐々に増やす）にも対応。実 HTTP でもフェイクでも動く（テスト可能）。
 * @packageDocumentation
 */
import { latencyStats, type LatencyStats } from "./stats.js";
import { type RequestFn, type RequestOutcome } from "./runner.js";

/** 重み付きステップ。 */
export interface ScenarioStep {
  /** 表示名（統計のキー）。 */
  name: string;
  /** 選択される相対重み（既定 1）。 */
  weight?: number;
  /** リクエスト実行関数。 */
  request: RequestFn;
}

/** シナリオ定義。 */
export interface Scenario {
  steps: ScenarioStep[];
}

/** シナリオ実行オプション。 */
export interface ScenarioOptions {
  concurrency: number;
  durationMs?: number;
  iterations?: number;
  /** ランプアップ時間（ms）。この間に並列数を 1→concurrency へ線形に増やす。 */
  rampUpMs?: number;
  now?: () => number;
  /** 乱数（0–1、テスト注入用）。既定 Math.random。 */
  random?: () => number;
}

/** ステップ別の統計。 */
export interface StepStats {
  name: string;
  count: number;
  success: number;
  failed: number;
  latency: LatencyStats;
}

/** シナリオ実行結果。 */
export interface ScenarioResult {
  total: number;
  success: number;
  failed: number;
  errorRate: number;
  elapsedMs: number;
  throughput: number;
  latency: LatencyStats;
  steps: StepStats[];
}

/** 累積重みからステップを選ぶ（純関数）。r は 0–1。 */
export function weightedPick(steps: ScenarioStep[], r: number): ScenarioStep {
  const weights = steps.map((s) => (s.weight ?? 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let threshold = r * total;
  for (let i = 0; i < steps.length; i++) {
    threshold -= weights[i]!;
    if (threshold < 0) return steps[i]!;
  }
  return steps[steps.length - 1]!;
}

/**
 * ランプアップ中に、経過時間に応じて「今アクティブにすべきワーカー数」を返す（純関数）。
 * elapsed >= rampUpMs なら全開。rampUpMs=0 なら即全開。
 */
export function activeWorkers(concurrency: number, rampUpMs: number, elapsedMs: number): number {
  if (rampUpMs <= 0 || elapsedMs >= rampUpMs) return concurrency;
  const ratio = elapsedMs / rampUpMs;
  return Math.max(1, Math.ceil(concurrency * ratio));
}

/** シナリオを実行する。 */
export async function runScenario(scenario: Scenario, options: ScenarioOptions): Promise<ScenarioResult> {
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const concurrency = Math.max(1, options.concurrency);
  const rampUpMs = options.rampUpMs ?? 0;
  const start = now();
  const deadline = options.durationMs !== undefined ? start + options.durationMs : Infinity;
  const maxIterations = options.iterations ?? Infinity;

  const perStep = new Map<string, { latencies: number[]; success: number; failed: number }>();
  for (const step of scenario.steps) perStep.set(step.name, { latencies: [], success: 0, failed: 0 });
  const allLatencies: number[] = [];
  let dispatched = 0;
  let success = 0;
  let failed = 0;

  const shouldContinue = () => dispatched < maxIterations && now() < deadline;

  const worker = async (workerId: number) => {
    while (shouldContinue()) {
      // ランプアップ: 自分の番号がまだアクティブ枠外なら少し待つ（時計注入時は即進む）
      const active = activeWorkers(concurrency, rampUpMs, now() - start);
      if (workerId >= active) {
        // このワーカーはまだ稼働対象外。時計が実時間なら待つ、注入時計なら終了条件を優先。
        if (now() >= deadline) break;
        if (options.now) break; // 注入時計ではビジーループを避ける
        await new Promise((r) => setTimeout(r, 5));
        continue;
      }
      const index = dispatched;
      dispatched += 1;
      const step = weightedPick(scenario.steps, random());
      const bucket = perStep.get(step.name)!;
      const t0 = now();
      let outcome: RequestOutcome;
      try {
        outcome = await step.request({ index });
      } catch (e) {
        outcome = { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
      const dt = now() - t0;
      bucket.latencies.push(dt);
      allLatencies.push(dt);
      if (outcome.ok) {
        bucket.success += 1;
        success += 1;
      } else {
        bucket.failed += 1;
        failed += 1;
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i)));

  const elapsedMs = Math.max(1, now() - start);
  const total = success + failed;
  const steps: StepStats[] = scenario.steps.map((s) => {
    const b = perStep.get(s.name)!;
    return { name: s.name, count: b.latencies.length, success: b.success, failed: b.failed, latency: latencyStats(b.latencies) };
  });
  return {
    total,
    success,
    failed,
    errorRate: total === 0 ? 0 : failed / total,
    elapsedMs,
    throughput: (total / elapsedMs) * 1000,
    latency: latencyStats(allLatencies),
    steps,
  };
}
