/**
 * 通知リレーの定期実行。Outbox に積まれた承認通知メールを一定間隔で確実に送る。
 * 分散ロックで複数インスタンスでの重複実行を防ぎ、オーバーラップも抑止する。
 * メトリクスに結果を出力し、observability と連動する。
 * @packageDocumentation
 */
import { createScheduler, createMemoryLockStore, type Scheduler } from "@platform/cron";
import { relayExpenseNotifications } from "./expense-notify-service";
import { metrics } from "./observability";
import { log } from "./services";

/** 通知リレーのスケジューラを作る(まだ start はしない)。 */
export function createNotifyScheduler(): Scheduler {
  // 実運用では Redis ロックに差し替え(複数インスタンスでの重複実行防止)。
  const lockStore = createMemoryLockStore();
  return createScheduler(
    [
      {
        name: "relay-expense-notifications",
        schedule: "*/1 * * * *", // 毎分
        preventOverlap: true, // 前回が長引いても多重実行しない
        jitterMs: 5_000, // 発火を最大5秒ずらす
        lock: { store: lockStore, ttlMs: 55_000 }, // 実行間隔より短いTTL
        handler: async () => {
          const r = await relayExpenseNotifications();
          if (r.sent > 0 || r.failed > 0 || r.exhausted > 0) {
            log.info({ ...r }, "通知リレー実行");
          }
        },
      },
    ],
    (name, err) => log.error({ name, err: err.message }, "通知リレーが失敗しました"),
    (result) => {
      // 実行結果をメトリクスへ(cron_runs_total{job,outcome})
      metrics.incrementCounter("cron_runs_total", 1, { job: result.name, outcome: result.outcome });
      if (result.durationMs > 0) metrics.observeHistogram("cron_duration_ms", result.durationMs, { job: result.name });
    },
  );
}
