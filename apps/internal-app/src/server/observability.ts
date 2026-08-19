/**
 * アプリ全体で共有する観測性インスタンス(トレーサ + メトリクス)。
 *
 * 【トレースはどこへ行くか】
 *
 * | `OTLP_ENDPOINT` | 行き先 |
 * |---|---|
 * | 未設定(既定) | **構造化ログだけ**。`docker logs` で追えるが、**入れ替えで消える** |
 * | 設定あり | ログ **＋** OTLP(Grafana Cloud / Tempo / Jaeger / Datadog など) |
 *
 * **送り先を決めるまでは未設定で構いません。** 決めたときに
 * **環境変数を 1 つ足すだけ**で送れるようにしてあります——
 * 2026-08 まで「実運用では OTLP エクスポータ等へ差し替え」というコメントだけがあり、
 * **差し替えるコードは無い**状態でした(ADR 0024 の「作ったが繋いでいない」)。
 *
 * @packageDocumentation
 */
import { createTracer, createMetrics, createOtlpExporter, type Span } from "@platform/observability";
import { featureEnv } from "./env";
import { log } from "./services";

/** メトリクスレジストリ(/api/metrics で公開)。 */
export const metrics = createMetrics();

/**
 * `名前: 値,名前: 値` を解析する。
 *
 * **値にコロンが入りうる**(`Bearer xxx:yyy`)ので、**最初のコロンだけ**で切る。
 *
 * @param raw 環境変数の値
 * @returns ヘッダの組
 */
function parseHeaders(raw: string | undefined): Record<string, string> {
  if (raw === undefined || raw === "") return {};
  const out: Record<string, string> = {};
  for (const pair of raw.split(",")) {
    const at = pair.indexOf(":");
    if (at < 0) continue;
    const name = pair.slice(0, at).trim();
    const value = pair.slice(at + 1).trim();
    if (name !== "") out[name] = value;
  }
  return out;
}

const endpoint = featureEnv.OTLP_ENDPOINT;

/**
 * OTLP への送信。**未設定なら undefined**(送らない)。
 *
 * `flush()` を終了時に呼ぶこと——**呼ばないと最後の数秒分が消えます**
 * (`instrumentation.ts` の lifecycle に登録済み)。
 */
export const traceExporter = endpoint === undefined || endpoint === ""
  ? undefined
  : createOtlpExporter({
      endpoint,
      serviceName: "internal-app",
      headers: parseHeaders(featureEnv.OTLP_HEADERS),
      // **送信の失敗でアプリを止めない。** ただし黙って捨てない——
      // 「監視しているつもりで何も届いていない」が一番まずい
      onError: (error, dropped) => {
        log.warn({ err: String(error), dropped }, "otlp-export-failed");
      },
    });

/** 完了スパンをログへ(構造化)。設定があれば OTLP へも送る。 */
const exportSpan = (span: Span) => {
  // **pino 流儀: (obj, msg) の順。** メッセージを第 1 引数に書くと型が合わない
  log.info({
    traceId: span.traceId, spanId: span.spanId, parentSpanId: span.parentSpanId,
    name: span.name, durationMs: span.durationMs, status: span.status, ...(span.error ? { error: span.error } : {}),
  }, "trace");
  // **ログにも残す。** 送り先が落ちている間も、手元で追えるようにしておく
  traceExporter?.export(span);
};

/** アプリ共有トレーサ。 */
export const tracer = createTracer(exportSpan);
