import { env, featureEnv } from "./server/env";

/**
 * 初期化できたエラー追跡。**無ければ undefined**(使わない構成もある)。
 *
 * 致命的な例外を送るのに使う——`installProcessGuards` の `onFatal` は
 * **プロセスが終わる直前**なので、ここで送らないと**何が起きたか残らない**。
 */
let errorTracking: { captureException: (e: unknown) => void } | undefined;
/**
 * Next.js の instrumentation フック。プロセス起動時に一度だけ実行される。
 * ここでエラー追跡(Sentry 等)を初期化する。
 *
 * 使う場合: `@sentry/nextjs` を導入し、SENTRY_DSN を env に追加してから
 * 下記コメントを有効化する。DSN 未設定なら何もしない(no-op)。
 */
export async function register(): Promise<void> {
  // ─── エラー追跡(任意) ───────────────────────────────────────────────
  // **`SENTRY_DSN` があるときだけ初期化する。** 無ければ何もしない。
  //
  // **依存は宣言しない。** `@sentry/nextjs` は重く、使わない会社もある。
  // 入れていなければ import が失敗するので、**その旨を出して先へ進む**
  // ——ここで落とすと、エラー追跡を使わない構成でアプリが起動しなくなる。
  //
  // 2026-08 まで**コメントアウトされたまま**で、`INCIDENT_RESPONSE.md` は
  // 「Sentry で見る」と書いていた。**手順書だけが存在する**状態だった
  // (ADR 0024 の「作ったが繋いでいない」)。
  if (featureEnv.SENTRY_DSN !== undefined && featureEnv.SENTRY_DSN !== "") {
    try {
      // **モジュール名を変数にしてある。** 直接書くと、
      // `@sentry/nextjs` を入れていない構成で **`pnpm typecheck` が
      // `TS2307: Cannot find module` で落ちる**——「入れなくても動く」ための
      // 分岐なのに、入れないと型検査が通らないのでは意味がない。
      // 解決は実行時に任せる(`webpackIgnore` でバンドルからも外す)。
      const moduleName = "@sentry/nextjs";
      const Sentry = (await import(/* webpackIgnore: true */ moduleName)) as {
        init: (options: Record<string, unknown>) => void;
        captureException: (error: unknown) => void;
      };
      Sentry.init({
        dsn: featureEnv.SENTRY_DSN,
        // **どの環境のエラーかを分ける。** 分けないと、検証中の失敗が
        // 本番の障害として通知され、そのうち誰も見なくなる
        environment: env.APP_ENV,
        // 本番だけ抑える(開発では全部見たい)
        tracesSampleRate: env.APP_ENV === "production" ? 0.1 : 1.0,
        // **個人情報を送らない。** 既定では IP やクッキーが乗る
        sendDefaultPii: false,
      });
      errorTracking = Sentry;
    } catch {
      // **起動を止めない。** ここで落とすと、エラー追跡を使わない構成で
      // アプリが上がらなくなる。ただし黙って無効にはしない
      console.warn(
        "[instrumentation] SENTRY_DSN は設定されていますが @sentry/nextjs が入っていません。"
          + "エラー追跡は無効のまま起動します(`pnpm --filter internal-app add @sentry/nextjs`)。",
      );
    }
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
    // **トレースを送り切ってから落とす。** バッファは 5 秒ごとに送るので、
    // ここで流さないと**終了直前の数秒分が消える**——
    // 「落ちる直前に何が起きていたか」が、いちばん見たいところ
    lifecycle.onShutdown("trace-exporter", async () => {
      const { traceExporter } = await import("./server/observability");
      traceExporter?.stop();
      await traceExporter?.flush();
    });
    lifecycle.onShutdown("database", () => db.$disconnect());           // 最後に DB 切断
    lifecycle.install();

    // プロセス安全網: 未処理拒否は記録、致命例外は記録→後始末→終了。
    installProcessGuards({
      logger: log,
      onFatal: (error) => {
        // **落ちる前に送る。** ログはローカルのファイルに出るだけなので、
        // コンテナが入れ替わると読めなくなる
        errorTracking?.captureException(error);
        return lifecycle.shutdown("uncaughtException");
      },
    });
  }
}
