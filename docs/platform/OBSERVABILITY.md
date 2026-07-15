# 可観測性(ログ・エラー追跡)

3 層で本番の状態を把握する。

1. **構造化ログ** … `@platform/logger`(pino)。JSON + requestId。機微情報は既定でマスク。
   - 収集: ConoHa なら journald / ファイル → 任意のログ基盤、AWS なら CloudWatch Logs。
2. **エラー追跡** … Sentry(`@sentry/nextjs`)。`apps/internal-app/src/instrumentation.ts`
   で初期化。`SENTRY_DSN` 未設定時は no-op。例外の能動的な通知・スタックトレース集約に使う。
3. **ヘルスチェック** … `/api/health`(DB ping)。LB / オーケストレータの死活監視に使う。

> ログは「起きたことの記録」、エラー追跡は「即座に気づくための通知」。役割が違うので併用する。
