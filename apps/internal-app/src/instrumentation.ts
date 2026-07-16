import { featureEnv } from "./server/env";
/**
 * Next.js の instrumentation フック。プロセス起動時に一度だけ実行される。
 * ここでエラー追跡(Sentry 等)を初期化する。
 *
 * 使う場合: `@sentry/nextjs` を導入し、SENTRY_DSN を env に追加してから
 * 下記コメントを有効化する。DSN 未設定なら何もしない(no-op)。
 */
export async function register(): Promise<void> {
  // エラー追跡(任意): SENTRY_DSN があれば初期化。
  if (featureEnv.SENTRY_DSN) {
    // const Sentry = await import("@sentry/nextjs");
    // Sentry.init({ dsn: featureEnv.SENTRY_DSN, tracesSampleRate: 0.1 });
  }

  // 通知リレーの定期実行を開始(Node ランタイムのサーバプロセスのみ)。
  // Edge や複数ワーカーでの二重起動を避けるため runtime を確認する。
  if (process.env.NEXT_RUNTIME === "nodejs" && !featureEnv.DISABLE_NOTIFY_RELAY) {
    const { createLifecycle, installProcessGuards } = await import("@platform/core");
    const { createNotifyScheduler } = await import("./server/notify-scheduler");
    const { db, log } = await import("./server/services");

    const scheduler = createNotifyScheduler();
    scheduler.start();

    // ゼロダウンタイムデプロイ用: SIGTERM/SIGINT で後始末してから終了。
    const lifecycle = createLifecycle({ logger: log, hookTimeoutMs: 15_000 });
    lifecycle.onShutdown("notify-scheduler", () => scheduler.stop());   // 先に受付停止
    lifecycle.onShutdown("database", () => db.$disconnect());           // 最後に DB 切断
    lifecycle.install();

    // プロセス安全網: 未処理拒否は記録、致命例外は記録→後始末→終了。
    installProcessGuards({
      logger: log,
      onFatal: () => lifecycle.shutdown("uncaughtException"),
    });
  }
}
