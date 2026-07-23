"use client";
/**
 * 構造化ログのデモ。
 *
 * 実基盤の @platform/logger は pino ベースで **Node 専用**のため、
 * ブラウザで動くこのデモは同じ挙動をローカルで再現している。
 * ただしマスク対象は実基盤の DEFAULT_REDACT_PATHS をそのまま写している
 * （password / token / accessToken / authorization / email / phone と、その入れ子）。
 */
import * as React from "react";
import { Alert, Badge, Button, Checkbox, Input, Select } from "@platform/ui";

// 実基盤 @platform/logger の DEFAULT_REDACT_PATHS と同じ内容
const REDACT_PATHS = [
  "password", "*.password", "token", "*.token", "accessToken", "*.accessToken",
  "authorization", "*.authorization", "email", "*.email", "phone", "*.phone",
];
const REDACT_KEYS = new Set(REDACT_PATHS.filter((p) => !p.startsWith("*.")));

type Level = "debug" | "info" | "warn" | "error";
const LEVELS: Level[] = ["debug", "info", "warn", "error"];
const RANK: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const LV_VARIANT: Record<Level, "secondary" | "success" | "warning" | "danger"> = { debug: "secondary", info: "success", warn: "warning", error: "danger" };

type Entry = { id: string; level: Level; msg: string; fields: Record<string, unknown>; at: string; requestId: string };

/** 入れ子も含めてマスクする（`*.password` はどの階層の password も対象、という意味）。 */
function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = REDACT_KEYS.has(k) ? "[Redacted]" : redact(v);
    }
    return out;
  }
  return value;
}

/** ログの元になる出来事。実運用で出しがちな「入れてはいけない値」を意図的に含めている。 */
const SAMPLES: Record<Level, { msg: string; fields: Record<string, unknown> }> = {
  debug: { msg: "キャッシュ参照", fields: { key: "user:101", hit: true, elapsedMs: 2 } },
  info: { msg: "注文を確定", fields: { orderId: "o_5001", amount: 5000, user: { id: "u_101", email: "taro@example.co.jp", phone: "090-1234-5678" } } },
  warn: { msg: "外部APIの応答が遅い", fields: { target: "freee", elapsedMs: 3200, retry: 1 } },
  error: { msg: "決済に失敗", fields: { orderId: "o_5001", code: "card_declined", authorization: "Bearer sk_live_abc123", password: "p@ssw0rd" } },
};

const newRequestId = () => `req_${Math.random().toString(36).slice(2, 8)}`;
const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };

export default function Page() {
  const [logs, setLogs] = React.useState<Entry[]>([]);
  const [filter, setFilter] = React.useState<Level>("debug");
  const [q, setQ] = React.useState("");
  const [masked, setMasked] = React.useState(true);
  const [requestId, setRequestId] = React.useState("req_a1b2c3");

  const emit = (level: Level) => {
    const s = SAMPLES[level];
    setLogs((l) => [{ id: `${Date.now()}${Math.random()}`, level, msg: s.msg, fields: s.fields, at: new Date().toISOString(), requestId }, ...l].slice(0, 30));
  };

  const shown = logs.filter((e) =>
    RANK[e.level] >= RANK[filter] &&
    (q === "" || JSON.stringify(e).includes(q)));

  const render = (e: Entry) => JSON.stringify({
    level: e.level, time: e.at, requestId: e.requestId, msg: e.msg,
    ...(masked ? (redact(e.fields) as Record<string, unknown>) : e.fields),
  });

  const copyAll = async () => {
    try { await navigator.clipboard.writeText(shown.map(render).join("\n")); } catch { /* noop */ }
  };

  return (
    <main style={{ maxWidth: 880, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 6 }}>構造化ログ（秘密情報の自動マスク）</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 16 }}>
        なぜ <code>console.log</code> を禁止するのかを、実際に出力して確かめるデモです。
        マスク対象は実基盤の <code>DEFAULT_REDACT_PATHS</code> と同じ（password / token / accessToken / authorization / email / phone と、その入れ子）。
      </p>

      <div style={box}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {LEVELS.map((lv) => (
            <Button key={lv} size="sm" variant={lv === "error" ? "primary" : "secondary"} onClick={() => emit(lv)}>{lv} を出力</Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => { setRequestId(newRequestId()); }}>別のリクエストとして続ける</Button>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={lb}>表示レベル（これ以上）
            <Select value={filter} onChange={(e) => setFilter(e.target.value as Level)}
              options={LEVELS.map((lv) => ({ label: lv, value: lv }))} />
          </label>
          <label style={lb}>絞り込み
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="orderId など" style={{ maxWidth: 200 }} />
          </label>
          <label style={{ ...lb, gap: 6 }}>マスク
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--color-fg)" }}>
              <Checkbox  checked={masked} onCheckedChange={(v) => setMasked(!!v)} />
              有効（外すと危険性が見えます）
            </label>
          </label>
          <span style={{ fontSize: 12, color: "var(--color-muted)" }}>現在の requestId: <code>{requestId}</code></span>
        </div>
      </div>

      {!masked && (
        <div style={{ marginBottom: 16 }}>
          <Alert variant="danger" title="これが console.log で起きること">
            メールアドレス・電話番号・パスワード・アクセストークンが、そのままログ基盤や画面に残ります。
            ログは長期間保管され、閲覧できる人も広いため、事故が起きたときの影響が大きくなります。
          </Alert>
        </div>
      )}

      <div style={box}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>出力（1行1JSON）</span>
          <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--color-muted)" }}>{shown.length} 件</span>
            <Button size="sm" variant="secondary" onClick={copyAll} disabled={shown.length === 0}>コピー</Button>
            <Button size="sm" variant="secondary" onClick={() => setLogs([])} disabled={logs.length === 0}>消去</Button>
          </span>
        </div>
        {shown.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--color-muted)" }}>上のボタンでログを出力してください。秘密情報は <code>[Redacted]</code> に伏せられます。</div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {shown.map((e) => (
              <li key={e.id} style={{ fontFamily: "monospace", fontSize: 11.5, padding: "8px 10px", borderRadius: 6, background: "var(--color-bg)", border: "1px solid var(--color-border)", wordBreak: "break-all" }}>
                <Badge variant={LV_VARIANT[e.level]}>{e.level}</Badge>{" "}{render(e)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>console.log と何が違うか</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead><tr><th style={th}>観点</th><th style={th}>console.log</th><th style={th}>構造化ログ</th></tr></thead>
          <tbody>
            {[
              ["秘密情報", "そのまま出る", "既定でマスクされる"],
              ["検索", "文字列を目で探す", "フィールドで絞り込める"],
              ["追跡", "どの処理のログか分からない", "requestId で1リクエストを追える"],
              ["本番の出し分け", "全部出るか、消すか", "レベルで制御できる"],
              ["転送", "標準出力に流れるだけ", "そのままログ基盤へ取り込める"],
            ].map(([a, b, c]) => (
              <tr key={a} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={td}>{a}</td><td style={{ ...td, color: "var(--color-danger, #c00)" }}>{b}</td><td style={td}>{c}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Alert variant="info" title="実基盤では">
        <code>@platform/logger</code> は pino ベース（Node 専用のため、このデモはブラウザ用に同じ挙動を再現しています）。
        <code>createLogger</code> の <code>redact</code> でマスク対象を追加でき、<code>contextProvider</code> と
        <code>@platform/context</code> を組み合わせると requestId が全ログに自動で付きます。
      </Alert>
    </main>
  );
}

const lb: React.CSSProperties = { display: "grid", gap: 4, fontSize: 12, color: "var(--color-muted)" };
const th: React.CSSProperties = { textAlign: "left", padding: "6px 8px", color: "var(--color-muted)", fontWeight: 600 };
const td: React.CSSProperties = { padding: "6px 8px" };
