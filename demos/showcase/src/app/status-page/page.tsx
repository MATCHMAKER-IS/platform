"use client";
/** ステータスページのデモ: メンテナンス判定・バイパス・各種エラー画面の実物。 */
import * as React from "react";
import { Button, Checkbox, Input } from "@platform/ui";
import {
  isInMaintenanceWindow,
  createMaintenanceGate,
  createAsyncMaintenanceGate,
  createCachedConfig,
  createMemoryMaintenanceStore,
  stateToConfig,
  renderStatusPage,
  renderMaintenancePage,
  renderErrorPage,
  renderServiceUnavailablePage,
  renderNotFoundPage,
  type MaintenanceConfig,
  type MaintenanceRequestInfo,
  type MaintenanceState,
  type MaintenanceDecision,
} from "@platform/status-page";

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

const field: React.CSSProperties = {
  height: 36,
  padding: "0 10px",
  borderRadius: "var(--radius)",
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-fg)",
  fontSize: 13,
};

const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 12 };

const REASON_LABEL: Record<string, string> = {
  disabled: "メンテナンスではない",
  allow_path: "素通しパス（ヘルスチェック等）",
  allow_ip: "許可 IP（社内・監視系）",
  allow_role: "許可ロール（管理者）",
  bypass_header: "バイパスヘッダ",
  out_of_window: "予定期間外",
};

/** 実運用の配線: DB(ここではメモリ) → TTL キャッシュ → 非同期ゲート。 */
const store = createMemoryMaintenanceStore({ enabled: false });

/** 静的ポリシー(誰を通すか)。状態と違い、コードで持つ。 */
const POLICY = {
  allowPaths: ["/api/health", "/_next/"],
  allowIps: ["203.0.113.10"],
  allowRoles: ["admin"],
  bypassHeader: { name: "x-maintenance-bypass", value: "let-me-in" },
  retryAfterSeconds: 1800,
};

/** キャッシュの時計。TTL の効き方を見せるため手で進める。 */
let cacheClock = 0;
const CACHE_TTL_MS = 5000;

const getConfig = createCachedConfig<MaintenanceConfig>(
  async () => stateToConfig(await store.get(), POLICY),
  CACHE_TTL_MS,
  () => cacheClock,
);
const asyncGate = createAsyncMaintenanceGate(getConfig, () => new Date("2026-07-20T10:00:00Z"));

/** リクエストの例。「誰が来たか」で判定が変わることを見せる。 */
const REQUESTS: { label: string; req: MaintenanceRequestInfo }[] = [
  { label: "一般利用者", req: { path: "/inquiries" } },
  { label: "監視サービス（ヘルスチェック）", req: { path: "/api/health" } },
  { label: "社内 IP から", req: { path: "/inquiries", ip: "203.0.113.10" } },
  { label: "管理者（ロール）", req: { path: "/inquiries", roles: ["admin"] } },
  {
    label: "バイパスヘッダあり",
    req: { path: "/inquiries", getHeader: (n) => (n === "x-maintenance-bypass" ? "let-me-in" : null) },
  },
  { label: "静的アセット", req: { path: "/_next/static/chunk.js" } },
];

const PAGES = [
  { key: "maintenance", label: "メンテナンス中 (503)" },
  { key: "error", label: "エラー (500)" },
  { key: "unavailable", label: "サービス停止 (503)" },
  { key: "notfound", label: "見つからない (404)" },
  { key: "custom", label: "自由に組む" },
] as const;

export default function Page() {
  // ── 切り替え体験(実運用の形) ──
  const [state, setState] = React.useState<MaintenanceState>({ enabled: false });
  const [decision, setDecision] = React.useState<MaintenanceDecision | null>(null);
  const [log, setLog] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);

  // ── 判定ルールの説明用 ──
  const [enabled, setEnabled] = React.useState(false);
  const [now, setNow] = React.useState("2026-07-20T03:00");
  const [useWindow, setUseWindow] = React.useState(true);
  const [preview, setPreview] = React.useState<(typeof PAGES)[number]["key"]>("maintenance");

  const config: MaintenanceConfig = React.useMemo(
    () => ({
      enabled,
      ...(useWindow ? { window: { start: "2026-07-20T02:00:00Z", end: "2026-07-20T04:00:00Z" } } : {}),
      allowPaths: ["/api/health", "/_next/"],
      allowIps: ["203.0.113.10"],
      allowRoles: ["admin"],
      bypassHeader: { name: "x-maintenance-bypass", value: "let-me-in" },
      estimatedRecovery: "2026-07-20 13:00 頃",
      retryAfterSeconds: 3600,
    }),
    [enabled, useWindow],
  );

  const nowDate = React.useMemo(() => {
    const d = new Date(`${now}:00Z`);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }, [now]);

  const gate = React.useMemo(() => createMaintenanceGate(() => config, () => nowDate), [config, nowDate]);
  const inWindow = useWindow ? isInMaintenanceWindow(config, nowDate) : false;
  const decisions = REQUESTS.map((r) => ({ ...r, d: gate.evaluate(r.req) }));

  /** 管理画面から切り替える(DB に書く)。 */
  async function toggle(on: boolean) {
    setBusy(true);
    await store.set({
      enabled: on,
      estimatedRecovery: "2026-07-20 13:00 頃",
      message: ["基幹システムの入れ替えを行っています。", "13:00 頃に復旧予定です。"],
      updatedBy: "u-admin",
      updatedAt: new Date().toISOString(),
    });
    setState(await store.get());
    setLog((p) => [`[管理] enabled=${on} を保存(updatedBy=u-admin)`, ...p].slice(0, 8));
    setBusy(false);
  }

  /** 利用者としてアクセスしてみる(キャッシュ経由で設定を読む)。 */
  async function access() {
    const d = await asyncGate.evaluate({ path: "/inquiries" });
    setDecision(d);
    setLog((p) => [
      `[利用者] /inquiries → ${d.active ? `503(Retry-After: ${d.retryAfterSeconds})` : `通す(${d.reason ?? "-"})`}` +
      `  [キャッシュ時計 ${cacheClock}ms]`,
      ...p,
    ].slice(0, 8));
  }

  /** キャッシュの TTL を跨がせる。 */
  function tick(ms: number) {
    cacheClock += ms;
    setLog((p) => [`[時間] ${ms}ms 経過(キャッシュ時計 ${cacheClock}ms)`, ...p].slice(0, 8));
  }

  /** 利用者に出る画面(保存した message をそのまま使う)。 */
  const liveHtml = React.useMemo(
    () =>
      renderStatusPage({
        title: "メンテナンス中",
        message: state.message ?? "ただいま調整中です。",
        brand: "社内基盤",
        ...(state.estimatedRecovery !== undefined ? { footer: `復旧予定: ${state.estimatedRecovery}` } : {}),
        showReload: true,
      }),
    [state],
  );

  const html = React.useMemo(() => {
    if (preview === "maintenance") return renderMaintenancePage({ brand: "社内基盤", estimatedRecovery: "13:00 頃" });
    if (preview === "error") return renderErrorPage({ brand: "社内基盤", referenceId: "ERR-7f3a91" });
    if (preview === "unavailable") return renderServiceUnavailablePage({ brand: "社内基盤" });
    if (preview === "notfound") return renderNotFoundPage({ brand: "社内基盤" });
    return renderStatusPage({
      title: "ただいま調整中です",
      message: ["基幹システムの入れ替えを行っています。", "9:00 から 13:00 の間、順次復旧します。"],
      brand: "社内基盤",
      accent: "var(--color-primary)",
      referenceId: "MNT-2026-0720",
      action: { label: "問い合わせフォームへ", href: "/inquiries" },
      showReload: true,
      footer: "情報システム部",
    });
  }, [preview]);

  return (
    <main style={{ maxWidth: 900, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>ステータスページ・メンテナンス</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        メンテナンス中でも<strong>監視は通し、管理者は操作でき、利用者だけ止める</strong> —— この判定を
        各アプリで書くと必ず穴が空きます（ヘルスチェックまで止めて監視が誤検知する、が定番です）。
        エラー画面の HTML も基盤が持つので、<strong>アプリが落ちていても出せます</strong>。
      </p>

      {/* ── 切り替え体験(このページの本題) ── */}
      <div style={{ ...box, borderColor: state.enabled ? "var(--color-danger)" : "var(--color-border)" }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>① 切り替えてみる</h2>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 12, lineHeight: 1.8 }}>
          実運用と同じ配線です:{" "}
          <strong>
            DB(<code>MaintenanceStore</code>) → TTL キャッシュ(<code>createCachedConfig</code>) →
            ゲート(<code>createAsyncMaintenanceGate</code>)
          </strong>
          。デプロイし直さずに、管理画面のスイッチだけで止められます。
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {/* 管理側 */}
          <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>管理画面（情シス）</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <Button size="sm" variant={state.enabled ? "secondary" : "primary"} disabled={busy || !state.enabled} onClick={() => void toggle(false)}>
                稼働中にする
              </Button>
              <Button size="sm" variant={state.enabled ? "primary" : "danger"} disabled={busy || state.enabled} onClick={() => void toggle(true)}>
                メンテナンスにする
              </Button>
            </div>
            <div style={{ ...mono, fontSize: 11, color: "var(--color-muted)", lineHeight: 1.8 }}>
              <div>enabled: <b style={{ color: state.enabled ? "var(--color-danger)" : "var(--color-success)" }}>{String(state.enabled)}</b></div>
              <div>updatedBy: {state.updatedBy ?? "—"}</div>
              <div>updatedAt: {state.updatedAt?.slice(11, 19) ?? "—"}</div>
            </div>
            <p style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 8, lineHeight: 1.7 }}>
              <code>updatedBy</code> / <code>updatedAt</code> を型が持っています。
              <strong>「誰がいつ止めたか」が残らない仕組みは、障害対応で必ず困ります。</strong>
            </p>
          </div>

          {/* 利用者側 */}
          <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>利用者のアクセス</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <Button size="sm" onClick={() => void access()}>/inquiries を開く</Button>
              <Button size="sm" variant="secondary" onClick={() => tick(2000)}>2秒 経過</Button>
              <Button size="sm" variant="secondary" onClick={() => tick(6000)}>6秒 経過</Button>
            </div>
            {decision === null ? (
              <p style={{ fontSize: 12, color: "var(--color-muted)" }}>「開く」を押してください</p>
            ) : (
              <div
                style={{
                  padding: "8px 10px",
                  borderRadius: "var(--radius)",
                  fontSize: 12,
                  fontWeight: 700,
                  color: decision.active ? "var(--color-danger)" : "var(--color-success)",
                  border: `1px solid ${decision.active ? "var(--color-danger)" : "var(--color-success)"}`,
                }}
              >
                {decision.active ? `503 メンテナンス中（Retry-After: ${decision.retryAfterSeconds}）` : "200 通常どおり"}
              </div>
            )}
            <p style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 8, lineHeight: 1.7 }}>
              キャッシュ TTL は <b>{CACHE_TTL_MS}ms</b>。
              <strong>切り替えた直後に開いても、まだ古い判定が返ります。</strong>
              「6秒 経過」を押してから開くと反映されます。
            </p>
          </div>
        </div>

        {log.length > 0 && (
          <pre style={{ ...mono, fontSize: 11, background: "var(--color-bg)", padding: 10, borderRadius: "var(--radius)", marginTop: 12, marginBottom: 0, lineHeight: 1.8 }}>
            {log.join("\n")}
          </pre>
        )}

        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 12, lineHeight: 1.8 }}>
          <strong>この順で試すと、TTL の意味が分かります:</strong>
          <br />
          ① 「メンテナンスにする」→ ②すぐ「開く」→ <strong>まだ 200 が返る</strong>（キャッシュが古い）→
          ③「6秒 経過」→ ④「開く」→ <strong>503 になる</strong>
          <br />
          <code>createCachedConfig</code> の TSDoc にこう書いてあります —
          <strong>「DB を毎回叩かない(全リクエストで読むと負荷になる)が、TTL のぶん反映が遅れる(緊急停止には向かない)」</strong>。
          <strong>緊急で今すぐ止めたいなら TTL を 0 にするか、環境変数で落とします。</strong>
          この判断を各アプリで再発明すると、「止めたはずなのに止まらない」が起きます。
        </p>
      </div>

      {state.enabled && (
        <div style={box}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>利用者に出ている画面</h2>
          <iframe
            title="現在のメンテナンス画面"
            srcDoc={liveHtml}
            style={{ width: "100%", height: 300, border: "1px solid var(--color-danger)", borderRadius: "var(--radius)", background: "#fff" }}
          />
          <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 8 }}>
            管理画面で保存した <code>message</code> と <code>estimatedRecovery</code> が、そのまま出ています。
            <strong>文言を変えるのにデプロイは要りません。</strong>
          </p>
        </div>
      )}

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>② メンテナンスの入り方（判定ルール）</h2>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <Checkbox checked={enabled} onCheckedChange={(v) => setEnabled(!!v)} />
            手動フラグ（<code>enabled</code>）
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <Checkbox checked={useWindow} onCheckedChange={(v) => setUseWindow(!!v)} />
            予定期間（02:00〜04:00 UTC）
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--color-muted)" }}>
            今
            {/* datetime-local に対応する部品が基盤に無いため生タグ。DatePicker は日付のみ。
                時刻まで要る画面が増えたら基盤に DateTimePicker を足すこと。 */}
            <Input type="datetime-local" value={now} onChange={(e) => setNow(e.target.value)} style={{ ...field, width: 190 }} />
          </label>
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.9 }}>
          <div>
            予定期間内か: <b style={{ color: inWindow ? "var(--color-warning)" : "var(--color-muted)" }}>{inWindow ? "はい" : "いいえ"}</b>
          </div>
          <div style={{ color: "var(--color-muted)", fontSize: 12 }}>
            <strong>手動フラグ か 予定期間内なら、メンテナンス扱い</strong>になります。
            「今」を <code>2026-07-20T03:00</code>（期間内）と <code>05:00</code>（期間外）で切り替えてみてください。
          </div>
        </div>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>③ 誰を通すか</h2>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
              <th style={{ padding: 5 }}>リクエスト</th>
              <th style={{ padding: 5 }}>パス</th>
              <th style={{ padding: 5 }}>判定</th>
              <th style={{ padding: 5 }}>理由</th>
            </tr>
          </thead>
          <tbody>
            {decisions.map((x) => (
              <tr key={x.label} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: 5 }}>{x.label}</td>
                <td style={{ padding: 5, ...mono, color: "var(--color-muted)" }}>{x.req.path}</td>
                <td style={{ padding: 5, fontWeight: 700, color: x.d.active ? "var(--color-danger)" : "var(--color-success)" }}>
                  {x.d.active ? `503 で止める（Retry-After: ${x.d.retryAfterSeconds}）` : "通す"}
                </td>
                <td style={{ padding: 5, fontSize: 11, color: "var(--color-muted)" }}>
                  {x.d.reason !== undefined ? REASON_LABEL[x.d.reason] ?? x.d.reason : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          「手動フラグ」を入れてから見てください。<strong>一般利用者だけが止まり、
          監視・社内 IP・管理者・静的アセットは通ります。</strong>
          <br />
          <strong><code>/api/health</code> を止めないのが要点</strong>です。ここを止めると、
          メンテナンス中に監視が「障害だ」と鳴り続けます。
          <code>reason</code> は<strong>ログ用</strong>で、利用者には返しません（`/apikey` と同じ考え方）。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>④ 画面の実物（5 種類）</h2>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {PAGES.map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant={preview === p.key ? "primary" : "secondary"}
              onClick={() => setPreview(p.key)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <iframe
          title="ステータスページのプレビュー"
          srcDoc={html}
          style={{ width: "100%", height: 380, border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "#fff" }}
        />
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <strong>これは実物です</strong>（<code>renderStatusPage()</code> が返した HTML を iframe に流し込んでいます）。
          <br />
          <strong>依存ゼロの単一 HTML 文字列</strong>なのが要点です。React も CSS ファイルも要らないので、
          <strong>アプリが起動できない状態でも返せます</strong>。エラー画面を React で作ると、
          「React が壊れているときにエラー画面が出ない」という笑えない事態になります。
          <br />
          <code>noindex</code> も入っているので、障害時のページが検索に載りません。
        </p>
        <details style={{ marginTop: 10 }}>
          <summary style={{ fontSize: 12, color: "var(--color-primary)", cursor: "pointer" }}>返している HTML を見る（{html.length} 文字）</summary>
          <pre style={{ ...mono, fontSize: 11, background: "var(--color-bg)", padding: 10, borderRadius: "var(--radius)", marginTop: 8, maxHeight: 220, overflow: "auto" }}>
            {html}
          </pre>
        </details>
      </div>
    </main>
  );
}
