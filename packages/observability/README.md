# @platform/observability

ログ・計測・追跡。**何が起きたかを後から追える**ようにします。

## これは何のためか

**「動かない」と言われたときに、何も残っていないのが一番困ります。**

このパッケージは、**リクエストごとに追跡 ID を振り**、
ログ・エラー・遅さを**その ID で繋げる**ためのものです。

## 使う前に知っておくこと

| | |
|---|---|
| **`console.log` を使わない** | **伏せ字を通りません**——個人情報がそのままログに残ります |
| **ログは検索できる形で** | 「エラー」だけでは探せません。**何の・どれが・なぜ**を入れてください |
| **アラートは鳴りすぎると無視される** | 「これが 1 件出たら誰かが動くか」で決めてください。動かないなら**メトリクスに留める** |
| **記録は消えます** | メモリ実装です。**長期の傾向は監視サービス**で見てください |

## よく使うもの

```ts
import { errorRateAbove, avgLatencyAbove, gaugeAtLeast } from "@platform/observability";
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
