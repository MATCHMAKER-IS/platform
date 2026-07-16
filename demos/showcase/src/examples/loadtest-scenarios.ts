/**
 * 実際の業務パターンを模した負荷シナリオ集。
 *
 * 「何 req/s 出るか」を測るだけでは意味がありません。**業務で実際に起きる形**で
 * 負荷をかけて初めて、「朝の打刻に耐えられるか」が分かります。
 *
 * 使い方:
 *   import { morningRush, buildHttpStep } from "@demos/loadtest-scenarios";
 *   const result = await runScenario(morningRush(buildHttpStep("http://localhost:3000")), {
 *     concurrency: 200, durationMs: 60_000, rampUpMs: 10_000,
 *   });
 *
 * @packageDocumentation
 */
import type { Scenario, RequestFn, RequestOutcome } from "@platform/loadtest";

/** HTTP リクエストを組み立てるための最小の依存。テストではモックを渡す。 */
export interface HttpDeps {
  /** ベース URL(例: http://localhost:3000)。 */
  baseUrl: string;
  /** fetch 実装(既定: グローバル fetch)。テストで差し替える。 */
  fetchImpl?: typeof fetch;
  /** 認証済みリクエストにする Cookie(例: "session=xxx")。 */
  cookie?: string;
  /** 時刻の取得(テスト注入用)。 */
  now?: () => number;
}

/**
 * URL とメソッドから RequestFn を作る。所要時間を測り、ok/status を返す。
 * 失敗しても例外にせず `{ ok: false }` を返す(負荷テストは止めない)。
 */
export function buildHttpStep(deps: HttpDeps) {
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  return (path: string, init?: RequestInit): RequestFn =>
    async (): Promise<RequestOutcome> => {
      try {
        const headers: Record<string, string> = { ...(init?.headers as Record<string, string> | undefined) };
        if (deps.cookie) headers.cookie = deps.cookie;
        const res = await fetchImpl(`${deps.baseUrl}${path}`, { ...init, headers });
        return { ok: res.ok, status: res.status };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    };
}

/**
 * 【朝の一斉打刻】9:00 前後に全社員が同時に出勤打刻する。
 *
 * 最も過酷な瞬間。**書き込みが一点に集中**するため、DB のロック競合が出やすい。
 * ランプアップ無し(rampUpMs: 0)で撃つと、実際の「9:00 きっかり」に近い形になる。
 *
 * 想定: 打刻 8 割 / 自分の勤怠確認 2 割(打刻後に確認する人)
 */
export function morningRush(step: ReturnType<typeof buildHttpStep>): Scenario {
  return {
    steps: [
      { name: "打刻(出勤)", weight: 8, request: step("/api/attendance", { method: "POST", body: JSON.stringify({ type: "clockIn" }) }) },
      { name: "自分の勤怠確認", weight: 2, request: step("/api/attendance") },
    ],
  };
}

/**
 * 【月初の経費申請ラッシュ】月初 3 日間に経費申請が集中する。
 *
 * 打刻と違い**読み書きが混ざる**。一覧の取得が重いと全体が遅くなる。
 *
 * 想定: 一覧を見る 5 / 申請する 3 / 添付を上げる 1 / 承認する 1
 */
export function expenseRush(step: ReturnType<typeof buildHttpStep>): Scenario {
  return {
    steps: [
      { name: "経費一覧", weight: 5, request: step("/api/expenses") },
      { name: "経費申請", weight: 3, request: step("/api/expenses", { method: "POST", body: JSON.stringify({ amount: 1200, category: "transport" }) }) },
      { name: "添付アップロード", weight: 1, request: step("/api/expenses/attachments", { method: "POST" }) },
      { name: "承認", weight: 1, request: step("/api/expenses/approvals/decision", { method: "POST", body: JSON.stringify({ decision: "approve" }) }) },
    ],
  };
}

/**
 * 【日中の平常運転】業務時間中の普通のアクセス。
 *
 * **読み取りが大半**。ここが遅いと「システムが重い」と言われる。
 * ランプアップを入れて(rampUpMs: 10_000 等)、徐々に負荷を上げるのが現実的。
 *
 * 想定: ダッシュボード 4 / 各種一覧 4 / 検索 1 / 書き込み 1
 */
export function normalDay(step: ReturnType<typeof buildHttpStep>): Scenario {
  return {
    steps: [
      { name: "ダッシュボード", weight: 4, request: step("/api/dashboard/summary") },
      { name: "請求一覧", weight: 2, request: step("/api/v1/invoices") },
      { name: "勤怠一覧", weight: 2, request: step("/api/attendance") },
      { name: "文書検索(RAG)", weight: 1, request: step("/api/rag/search?q=%E8%A6%8F%E7%A8%8B", { method: "GET" }) },
      { name: "経費申請", weight: 1, request: step("/api/expenses", { method: "POST", body: JSON.stringify({ amount: 800 }) }) },
    ],
  };
}

/**
 * 【月次決算】集計処理が走る。件数に比例して重くなる典型。
 *
 * 同時実行数は少ないが**1 本が重い**。タイムアウトしないかを見る。
 * `concurrency: 1〜3` 程度で、`p95` より **max** を見るべきシナリオ。
 */
export function monthlyClosing(step: ReturnType<typeof buildHttpStep>): Scenario {
  return {
    steps: [
      { name: "月次集計", weight: 3, request: step("/api/accounting/closing", { method: "POST", body: JSON.stringify({ month: "2026-07" }) }) },
      { name: "帳票出力", weight: 1, request: step("/api/reports/monthly") },
    ],
  };
}

/**
 * 【ヘルスチェックのみ】疎通と最低限の性能確認。
 *
 * 「そもそも繋がるか」「基礎的な応答は何 ms か」を測る。**最初にこれで足場を確認**してから
 * 本番シナリオへ進むと、原因の切り分けが楽になる。
 */
export function healthOnly(step: ReturnType<typeof buildHttpStep>): Scenario {
  return { steps: [{ name: "health", request: step("/api/health") }] };
}

/** 用意しているシナリオの一覧(名前 → 生成関数)。 */
export const scenarios = {
  "morning-rush": morningRush,
  "expense-rush": expenseRush,
  "normal-day": normalDay,
  "monthly-closing": monthlyClosing,
  "health": healthOnly,
} as const;

export type ScenarioName = keyof typeof scenarios;

/** シナリオごとの推奨設定と、見るべき指標。 */
export const scenarioGuide: Record<ScenarioName, { concurrency: number; durationMs: number; rampUpMs: number; watch: string }> = {
  "morning-rush": { concurrency: 200, durationMs: 60_000, rampUpMs: 0, watch: "エラー率と p99。ロック競合で一部が極端に遅くなる" },
  "expense-rush": { concurrency: 50, durationMs: 120_000, rampUpMs: 10_000, watch: "一覧のステップ別 p95。ここが遅いと全体が遅い" },
  "normal-day": { concurrency: 30, durationMs: 300_000, rampUpMs: 30_000, watch: "p95 が時間とともに悪化しないか(メモリリーク・接続枯渇)" },
  "monthly-closing": { concurrency: 2, durationMs: 180_000, rampUpMs: 0, watch: "max。タイムアウトしないか" },
  "health": { concurrency: 10, durationMs: 10_000, rampUpMs: 0, watch: "疎通と基礎レイテンシ" },
};

/** ステップ別の結果を人が読める表にする。 */
export function formatSteps(steps: { name: string; count: number; success: number; failed: number; latency: { p50: number; p95: number; max: number } }[]): string {
  const lines = ["ステップ           件数   成功   失敗   p50    p95    max"];
  for (const s of steps) {
    lines.push(
      `${s.name.padEnd(18)} ${String(s.count).padStart(5)} ${String(s.success).padStart(6)} ${String(s.failed).padStart(6)} ` +
        `${`${Math.round(s.latency.p50)}ms`.padStart(6)} ${`${Math.round(s.latency.p95)}ms`.padStart(6)} ${`${Math.round(s.latency.max)}ms`.padStart(6)}`,
    );
  }
  return lines.join("\n");
}
