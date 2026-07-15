# @platform/observability

依存ゼロの軽量トレーシング・メトリクス・耐障害プリミティブ。外部連携の可視化と保護に。

```ts
import { createTracer, createMetrics, createCircuitBreaker, relayOutbox } from "@platform/observability";

const tracer = createTracer(exporter);       // W3C traceparent 対応スパン
const metrics = createMetrics();             // Prometheus テキスト出力
const breaker = createCircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 30_000 });

await breaker.execute(() => callExternalApi()); // 連続失敗で自動遮断
```

主な提供機能:
- **トレース**: `createTracer` / `createOtlpExporter`(Jaeger/Tempo/Datadog へ送信)
- **メトリクス**: `createMetrics`(Prometheus 形式)
- **サーキットブレーカー**: `createCircuitBreaker`(closed/open/half_open)
- **Outbox**: `createMemoryOutboxStore` / `createSqlOutboxStore`(確実配信)
- **冪等性**: `createMemoryIdempotencyStore` / `createRedisIdempotencyStore`
- **アラート**: `createAlertManager`(SLO 評価・発報/回復)

本番では Redis/SQL 版ストアにクライアントを注入して使います。
