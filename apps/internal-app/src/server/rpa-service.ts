/**
 * RPA ランナーの配線(internal-app のデモ)。@platform/rpa + メモリロック + 監査シンク。
 * 実運用では createFileLockStore(単一ホスト)/createRedisLockStore(複数)を注入する。
 * ここではサンプルタスク(擬似的なポイント同期)を「安全実行の枠組み」に載せて動かす。
 * @packageDocumentation
 */
import { createRpaRunner, type RpaAuditEvent } from "@platform/rpa";
import { createMemoryLockStore } from "@platform/cron";
import { createOsNotifier, createMemoryNotifyLog, type OsPlatform, type OsNotifyLogEntry } from "@platform/os-notify";

/** 監査ログ(メモリ・デモ用。実運用は @platform/audit のチェーンや DB へ)。 */
export const rpaAuditLog: RpaAuditEvent[] = [];

/** 直近の監査イベントを返す(新しい順)。 */
export function getRecentRpaEvents(limit = 50): RpaAuditEvent[] {
  return rpaAuditLog.slice(-limit).reverse();
}

const lock = createMemoryLockStore();
const seen = new Set<string>();

// RPA の完了・失敗を実行マシンに OS 通知する(既定は dry-run。RPA_OS_NOTIFY=1 で実通知)。
// 常駐サーバーで通知を出したい場合に spawn を注入する。ここでは環境非依存に配線だけ用意。
const osNotifyEnabled = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env?.RPA_OS_NOTIFY === "1";
let injectedSpawn: ((c: string, a: string[], o?: { detached?: boolean; stdio?: string }) => { on(e: "error" | "close", cb: (arg: unknown) => void): void; unref?: () => void }) | undefined;
/** OS 通知に使う spawn を差し替える(テスト・実運用の注入点)。 */
export function setRpaNotifySpawn(spawn: typeof injectedSpawn): void { injectedSpawn = spawn; }

/** RPA の OS 通知履歴(管理画面で確認する)。 */
export const rpaNotifyLog = createMemoryNotifyLog({ max: 100 });

/** 通知履歴を取得(新しい順)。 */
export function getRpaNotifyHistory(limit = 50): OsNotifyLogEntry[] {
  return rpaNotifyLog.list(limit);
}

function detectPlatform(): OsPlatform {
  const p = (globalThis as unknown as { process?: { platform?: string } }).process?.platform;
  return p === "win32" || p === "darwin" ? p : "linux";
}

/** RPA イベントに応じて OS 通知を出す(有効時のみ)。失敗しても RPA 本体には影響させない。 */
export async function notifyRpaResult(kind: "success" | "error", detail: { name: string; message?: string }): Promise<void> {
  if (!osNotifyEnabled && !injectedSpawn) return; // 無効時は何もしない
  const notifier = createOsNotifier({ platform: detectPlatform(), log: rpaNotifyLog, ...(injectedSpawn ? { spawn: injectedSpawn } : {}) });
  const title = kind === "success" ? `RPA 完了: ${detail.name}` : `RPA 失敗: ${detail.name}`;
  const message = kind === "success" ? "処理が正常に終了しました" : (detail.message ?? "処理が失敗しました");
  await notifier.notify({ title, message, sound: kind === "error" });
}

/** アプリ共通の RPA ランナー(監査はメモリログへ)。 */
export const rpaRunner = createRpaRunner({
  lock,
  audit: (e) => { rpaAuditLog.push(e); },
  seenStore: { has: (k: string) => seen.has(k), add: (k: string) => { seen.add(k); } },
  actor: "system",
});

/** デモ実行の結果(既存 API の期待形)。 */
export type DemoRpaResult =
  | { ok: true; rows: number; attempts: number; skipped: boolean }
  | { ok: false; error: string; code: string };

/**
 * デモ用のサンプル RPA タスク(擬似的なポイント同期)。実際の外部操作の代わりに擬似待機し、
 * 途中経過を監査する。fail=true で意図的に失敗させ、リトライの様子を見せられる。
 * idempotencyKey を渡すと、同じキーの2回目以降はスキップされる。
 */
export async function runDemoPointSync(opts: { fail?: boolean; idempotencyKey?: string; steps?: number } = {}): Promise<DemoRpaResult> {
  const res = await rpaRunner.run<{ rows: number }>({
    name: "point-sync",
    lockKey: "sample-rpa", // 同じデモ RPA は直列化
    lockWaitMs: 2000,
    timeoutMs: 10_000,
    retry: { maxAttempts: 3, baseDelayMs: 50 },
    ...(opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : {}),
    run: async (ctx) => {
      const steps = opts.steps ?? 3;
      for (let i = 1; i <= steps; i += 1) {
        if (ctx.signal.aborted) throw new Error("中断されました");
        await ctx.audit("step", { step: i, of: steps });
        // fail=true なら毎回 2 ステップ目で失敗(リトライして最終的に失敗するデモ)
        if (opts.fail && i === 2) throw new Error("意図的な失敗（デモ）");
      }
      return { rows: steps };
    },
  });
  if (res.ok) {
    if (!res.value.skipped) await notifyRpaResult("success", { name: "point-sync" });
    return { ok: true, rows: res.value.value?.rows ?? 0, attempts: res.value.attempts, skipped: res.value.skipped };
  }
  await notifyRpaResult("error", { name: "point-sync", message: res.error.message });
  return { ok: false, error: res.error.message, code: res.error.code };
}
