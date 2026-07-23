"use client";
/** 可観測性のデモ: サーキットブレーカー・メトリクス・アラート・冪等性・分散トレース。 */
import * as React from "react";
import { Button } from "@platform/ui";
import {
  createCircuitBreaker,
  createMetrics,
  createAlertManager,
  errorRateAbove,
  avgLatencyAbove,
  gaugeAtLeast,
  createMemoryIdempotencyStore,
  withIdempotency,
  createTracer,
  toTraceparent,
  type CircuitState,
  type AlertRule,
  type Alert,
  type Span,
} from "@platform/observability";

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

const btn: React.CSSProperties = {
  height: 36,
  padding: "0 14px",
  borderRadius: "var(--radius)",
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-fg)",
  cursor: "pointer",
  fontSize: 13,
};

const primary: React.CSSProperties = { ...btn, border: "none", background: "var(--color-primary)", color: "var(--color-primary-fg)" };
const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 12 };

const STATE_LABEL: Record<CircuitState, string> = { closed: "closed（正常）", open: "open（遮断中）", half_open: "half_open（試行中）" };
const STATE_COLOR: Record<CircuitState, string> = { closed: "var(--color-success)", open: "var(--color-danger)", half_open: "var(--color-warning)" };

const RULES: AlertRule[] = [
  {
    name: "error-rate",
    severity: "critical",
    condition: errorRateAbove("http.requests", "http.errors", 0.2),
    describe: (m) => `エラー率が 20% を超えています（${m.counters["http.errors"] ?? 0} / ${m.counters["http.requests"] ?? 0}）`,
    forEvaluations: 2,
  },
  {
    name: "latency",
    severity: "warning",
    condition: avgLatencyAbove("http.latency", 300),
    describe: (m) => {
      const h = m.histograms["http.latency"];
      const avg = h && h.count > 0 ? Math.round(h.sum / h.count) : 0;
      return `平均レイテンシが ${avg}ms（閾値 300ms）`;
    },
  },
  {
    name: "queue-depth",
    severity: "warning",
    condition: gaugeAtLeast("queue.depth", 50),
    describe: (m) => `キューが滞留しています（${m.gauges["queue.depth"] ?? 0} 件）`,
  },
];

export function ObsDemo() {
  // ── サーキットブレーカー ──
  const breaker = React.useMemo(() => createCircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 5000, successThreshold: 2 }), []);
  const [cbStats, setCbStats] = React.useState(() => breaker.stats());
  const [cbLog, setCbLog] = React.useState<string[]>([]);

  async function hit(shouldFail: boolean) {
    let msg: string;
    try {
      await breaker.execute(async () => {
        if (shouldFail) throw new Error("外部 API が 500 を返した");
        return "ok";
      });
      msg = "○ 成功";
    } catch (e) {
      msg = `× ${e instanceof Error ? e.message : String(e)}`;
    }
    setCbStats(breaker.stats());
    setCbLog((prev) => [`${msg}  → ${breaker.state()}`, ...prev].slice(0, 8));
  }

  // ── メトリクス + アラート ──
  const metrics = React.useMemo(() => createMetrics(), []);
  const alertManager = React.useMemo(() => createAlertManager(RULES), []);
  const [snapshot, setSnapshot] = React.useState(() => metrics.snapshot());
  const [alerts, setAlerts] = React.useState<Alert[]>([]);
  const [prom, setProm] = React.useState("");

  function record(kind: "ok" | "error" | "slow" | "queue") {
    if (kind === "ok") {
      metrics.incrementCounter("http.requests");
      metrics.observeHistogram("http.latency", 80 + Math.round(Math.random() * 60));
    } else if (kind === "error") {
      metrics.incrementCounter("http.requests");
      metrics.incrementCounter("http.errors");
      metrics.observeHistogram("http.latency", 200);
    } else if (kind === "slow") {
      metrics.incrementCounter("http.requests");
      metrics.observeHistogram("http.latency", 800 + Math.round(Math.random() * 400));
    } else {
      metrics.setGauge("queue.depth", (snapshot.gauges["queue.depth"] ?? 0) + 20);
    }
    const snap = metrics.snapshot();
    setSnapshot(snap);
    setAlerts(alertManager.evaluate(snap));
    setProm(metrics.toPrometheus());
  }

  // ── 冪等性 ──
  const idemStore = React.useMemo(() => createMemoryIdempotencyStore(), []);
  const [payLog, setPayLog] = React.useState<string[]>([]);
  const chargeCount = React.useRef(0);

  async function pay(key: string) {
    const r = await withIdempotency(idemStore, key, async () => {
      chargeCount.current += 1;
      return { paymentId: `PAY-${String(chargeCount.current).padStart(4, "0")}`, at: new Date().toISOString().slice(11, 19) };
    });
    setPayLog((prev) => [`key=${key} → ${JSON.stringify(r)}（実際の課金は ${chargeCount.current} 回）`, ...prev].slice(0, 6));
  }

  // ── トレース ──
  const [spans, setSpans] = React.useState<Span[]>([]);
  const [traceparent, setTraceparent] = React.useState("");

  async function trace() {
    const collected: Span[] = [];
    const tracer = createTracer((s) => collected.push(s));
    await tracer.withSpan("POST /api/invoices", async (root) => {
      root.setAttribute("http.method", "POST");
      const parent = { traceId: root.traceId, spanId: root.spanId };
      await tracer.withSpan("db.insert", async () => new Promise((r) => setTimeout(r, 12)), { parent });
      await tracer.withSpan("mail.send", async () => new Promise((r) => setTimeout(r, 8)), { parent });
      setTraceparent(toTraceparent(root.traceId, root.spanId, true));
    });
    setSpans(collected);
  }

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>可観測性</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        <strong>「落ちたときに、落ちたと分かる」ための仕組み</strong>です。
        外部 API の障害を巻き込まないサーキットブレーカー、Prometheus 形式のメトリクス、
        二重課金を防ぐ冪等性、リクエストを横断で追う分散トレース。
        どれも各アプリで自作すると必ず事故る類で、基盤が持つべき部分です。
      </p>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>① サーキットブレーカー</h2>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 10, lineHeight: 1.8 }}>
          外部 API が落ちているのに叩き続けると、<strong>タイムアウト待ちで自分のスレッドが枯れて、
          自社システムまで巻き込まれます</strong>。連続失敗したら一定時間<strong>叩くのをやめる</strong>のがこれです。
          <br />
          「失敗」を <b>3 回</b>押すと <code>open</code> になり、<strong>即座に拒否</strong>されるようになります。
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          <Button onClick={() => void hit(false)} style={primary}>成功する呼び出し</Button>
          <Button onClick={() => void hit(true)} style={{ ...btn, borderColor: "var(--color-danger)", color: "var(--color-danger)" }}>失敗する呼び出し</Button>
          <Button
            onClick={() => {
              breaker.reset();
              setCbStats(breaker.stats());
              setCbLog([]);
            }}
            style={btn}
          >
            リセット
          </Button>
          <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: STATE_COLOR[cbStats.state] }}>{STATE_LABEL[cbStats.state]}</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 8 }}>
          連続失敗 {cbStats.failures} / 3 ・ 連続成功 {cbStats.successes} ・ 復帰まで 5 秒
        </div>
        {cbLog.length > 0 && (
          <pre style={{ ...mono, background: "var(--color-bg)", padding: 10, borderRadius: "var(--radius)", margin: 0, lineHeight: 1.7 }}>
            {cbLog.join("\n")}
          </pre>
        )}
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 8 }}>
          <code>open</code> のまま 5 秒待ってから押すと <code>half_open</code> になり、
          <strong>試しに 1 回だけ通します</strong>。そこで 2 回成功すれば <code>closed</code> に戻ります。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>② メトリクスとアラート</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <Button onClick={() => record("ok")} style={primary}>正常なリクエスト</Button>
          <Button onClick={() => record("error")} style={{ ...btn, borderColor: "var(--color-danger)", color: "var(--color-danger)" }}>エラー</Button>
          <Button onClick={() => record("slow")} style={{ ...btn, borderColor: "var(--color-warning)", color: "var(--color-warning)" }}>遅いリクエスト</Button>
          <Button onClick={() => record("queue")} style={btn}>キューを +20</Button>
        </div>

        {alerts.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            {alerts.map((a) => (
              <div
                key={a.name}
                style={{
                  padding: "8px 12px",
                  borderRadius: "var(--radius)",
                  marginBottom: 6,
                  fontSize: 13,
                  border: `1px solid ${a.severity === "critical" ? "var(--color-danger)" : "var(--color-warning)"}`,
                  color: a.severity === "critical" ? "var(--color-danger)" : "var(--color-warning)",
                }}
              >
                <b>[{a.severity}] {a.name}</b> — {a.message}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 4 }}>snapshot（アラート判定に使う形）</div>
            <pre style={{ ...mono, background: "var(--color-bg)", padding: 10, borderRadius: "var(--radius)", margin: 0, overflowX: "auto" }}>
              {JSON.stringify(snapshot, null, 2)}
            </pre>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 4 }}>toPrometheus()（/metrics で公開する形）</div>
            <pre style={{ ...mono, background: "var(--color-bg)", padding: 10, borderRadius: "var(--radius)", margin: 0, overflowX: "auto", minHeight: 60 }}>
              {prom === "" ? "（ボタンを押すと出ます）" : prom}
            </pre>
          </div>
        </div>

        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <strong>「エラー」は 2 回連続で押さないと発報しません</strong>（<code>forEvaluations: 2</code>）。
          1 回のスパイクで夜中に電話が鳴るのを防ぐためです。
          <code>toPrometheus()</code> があるので、Grafana などにそのまま繋がります。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>③ 冪等性（二重課金を防ぐ）</h2>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 10, lineHeight: 1.8 }}>
          利用者が<strong>送信ボタンを 2 回押した</strong>、<strong>ネットワークが切れて再送された</strong> —
          このとき同じ処理が 2 回走ると二重課金になります。
          <strong>同じキーなら、前回の結果をそのまま返す</strong>のが冪等性です。
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <Button onClick={() => void pay("order-1001")} style={primary}>order-1001 を決済</Button>
          <Button onClick={() => void pay("order-1002")} style={btn}>order-1002 を決済</Button>
        </div>
        {payLog.length > 0 && (
          <pre style={{ ...mono, background: "var(--color-bg)", padding: 10, borderRadius: "var(--radius)", margin: 0, lineHeight: 1.8, overflowX: "auto" }}>
            {payLog.join("\n")}
          </pre>
        )}
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 8 }}>
          <strong>「order-1001 を決済」を何回押しても、実際の課金は 1 回だけ</strong>で、
          返る paymentId も同じです。キーを変えれば新しく課金されます。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>④ 分散トレース</h2>
        <Button onClick={() => void trace()} style={{ ...primary, marginBottom: 10 }}>
          リクエストを 1 本流す
        </Button>
        {spans.length > 0 && (
          <>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
                  <th style={{ padding: 5 }}>span</th>
                  <th style={{ padding: 5 }}>spanId</th>
                  <th style={{ padding: 5 }}>parent</th>
                  <th style={{ padding: 5, textAlign: "right" }}>所要</th>
                </tr>
              </thead>
              <tbody>
                {spans.map((s) => (
                  <tr key={s.spanId} style={{ borderTop: "1px solid var(--color-border)" }}>
                    <td style={{ padding: 5 }}>
                      {s.parentSpanId !== undefined && <span style={{ color: "var(--color-muted)" }}>└ </span>}
                      {s.name}
                    </td>
                    <td style={{ padding: 5, ...mono, color: "var(--color-muted)" }}>{s.spanId}</td>
                    <td style={{ padding: 5, ...mono, color: "var(--color-muted)" }}>{s.parentSpanId ?? "—"}</td>
                    <td style={{ padding: 5, textAlign: "right" }}>{s.endTime !== undefined ? `${s.endTime - s.startTime}ms` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10 }}>
              traceparent ヘッダ: <span style={mono}>{traceparent}</span>
            </div>
          </>
        )}
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          全 span が<strong>同じ traceId</strong>を共有し、親子関係を持ちます。
          「この API が遅い。DB とメール送信のどっちだ？」が分かります。
          <code>traceparent</code> は <strong>W3C の標準ヘッダ</strong>なので、
          これを付けて他サービスを呼べば<strong>システムを跨いで 1 本のトレースとして追えます</strong>。
        </p>
      </div>
    </>
  );
}
