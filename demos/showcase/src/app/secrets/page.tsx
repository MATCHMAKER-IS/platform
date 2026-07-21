"use client";
/**
 * シークレット管理のデモ。環境変数の平文直読みを避け、取得元を差し替え可能にする。
 *
 * UI は **@platform/ui の部品だけ**で組む(CLAUDE.md「UI 部品は @platform/ui を使う」)。
 */
import * as React from "react";
import { Button, Badge, Alert, Separator, Slider } from "@platform/ui";
import { createSecretStore, createEnvProvider, createFetchProvider, createChainProvider, type SecretStore } from "@platform/secrets";
import { maskPartial } from "@platform/pii";

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" };

/** 実行ログ 1 行。 */
interface LogRow {
  at: number;
  name: string;
  value: string | null;
  hit: boolean;
  fetched: number;
}

/** 環境変数（開発機の .env にあるもの）。 */
const ENV: Record<string, string | undefined> = {
  DB_URL: "postgres://app:pass@localhost:5432/dev",
  LOG_LEVEL: "debug",
};

/** Secrets Manager にあるもの（本番の値・ローテーションされる）。 */
const REMOTE_NAMES = ["STRIPE_KEY", "DB_URL"];

export default function Page() {
  const [ttl, setTtl] = React.useState(5000);
  const [clock, setClock] = React.useState(0);
  const [log, setLog] = React.useState<LogRow[]>([]);
  const [name, setName] = React.useState("STRIPE_KEY");
  const [reveal, setReveal] = React.useState(false);
  const [requireErr, setRequireErr] = React.useState("");

  // 外部サービスを何回叩いたか（キャッシュの効きを見る）
  const fetchCount = React.useRef(0);
  // ローテーションで値が変わったことにする
  const version = React.useRef(1);
  const clockRef = React.useRef(0);
  clockRef.current = clock;

  const store: SecretStore = React.useMemo(() => {
    const env = createEnvProvider(ENV);
    const remote = createFetchProvider(async (n) => {
      if (!REMOTE_NAMES.includes(n)) return null;
      fetchCount.current += 1;
      // Secrets Manager 側の値（ローテーションすると v2, v3… になる）
      return n === "STRIPE_KEY" ? `sk_live_${"x".repeat(20)}_v${version.current}` : `postgres://app:pass@prod:5432/main?v=${version.current}`;
    });
    // ★env → remote の順。**開発機の .env が本番より優先される**
    const chain = createChainProvider([env, remote]);
    return createSecretStore(chain, { ttlMs: ttl, now: () => clockRef.current });
  }, [ttl]);

  async function get(n: string) {
    const before = fetchCount.current;
    const v = await store.get(n);
    setLog((l) => [{ at: clock, name: n, value: v, hit: fetchCount.current === before, fetched: fetchCount.current }, ...l].slice(0, 8));
  }

  async function req(n: string) {
    setRequireErr("");
    try {
      const v = await store.require(n);
      setLog((l) => [{ at: clock, name: n, value: v, hit: true, fetched: fetchCount.current }, ...l].slice(0, 8));
    } catch (e) {
      setRequireErr(e instanceof Error ? e.message : String(e));
    }
  }

  function rotate() {
    version.current += 1;
    setLog((l) => [{ at: clock, name: "（ローテーション実施）", value: `v${version.current} に更新`, hit: false, fetched: fetchCount.current }, ...l].slice(0, 8));
  }

  const show = (v: string | null) => (v === null ? "null" : reveal ? v : maskPartial(v, 8));

  return (
    <main style={{ maxWidth: 900, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>シークレット管理</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        <strong><code>process.env.STRIPE_KEY</code> を直に読まないための基盤</strong>です。
        取得元（環境変数 / AWS Secrets Manager / Vault）を差し替えられ、
        <strong>TTL でローテーションに追随</strong>します。
      </p>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>取得元のチェーン</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13, marginBottom: 10 }}>
          <Badge variant="secondary">① 環境変数</Badge>
          <span style={{ color: "var(--color-muted)" }}>→</span>
          <Badge variant="secondary">② Secrets Manager</Badge>
          <span style={{ color: "var(--color-muted)", fontSize: 12 }}>（先に見つかった方を返す）</span>
        </div>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
              <th style={{ padding: 4 }}>名前</th>
              <th style={{ padding: 4 }}>① 環境変数</th>
              <th style={{ padding: 4 }}>② Secrets Manager</th>
              <th style={{ padding: 4 }}>どちらが使われるか</th>
            </tr>
          </thead>
          <tbody>
            {["DB_URL", "STRIPE_KEY", "LOG_LEVEL", "NOPE"].map((n) => {
              const inEnv = ENV[n] !== undefined;
              const inRemote = REMOTE_NAMES.includes(n);
              return (
                <tr key={n} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={{ padding: 4, ...mono }}>{n}</td>
                  <td style={{ padding: 4 }}>{inEnv ? "✓" : "—"}</td>
                  <td style={{ padding: 4 }}>{inRemote ? "✓" : "—"}</td>
                  <td style={{ padding: 4, fontWeight: 700, color: inEnv ? "var(--color-primary)" : inRemote ? "var(--color-success)" : "var(--color-danger)" }}>
                    {inEnv ? "① 環境変数" : inRemote ? "② Secrets Manager" : "見つからない（null）"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Alert variant="warning" title="DB_URL は両方にあります" style={{ marginTop: 12 }}>
          <span style={{ fontSize: 12, lineHeight: 1.8 }}>
            <strong>環境変数が優先されるので、本番の値は使われません。</strong>
            これは<strong>意図した順序</strong>です——開発機で <code>.env</code> を置けば、
            そちらが勝ちます。本番では環境変数を置かないことで Secrets Manager が使われます。
            <br />
            <strong>順序を逆にすると、開発機から本番の DB を触ります。</strong>
            <code>createChainProvider([env, remote])</code> の並びがそのまま優先順位です。
          </span>
        </Alert>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>取得してみる</h2>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {["STRIPE_KEY", "DB_URL", "LOG_LEVEL", "NOPE"].map((n) => (
            <Button key={n} size="sm" variant={name === n ? "primary" : "secondary"} onClick={() => setName(n)}>
              {n}
            </Button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <Button onClick={() => void get(name)}>get()</Button>
          <Button variant="secondary" onClick={() => void req(name)}>
            require()
          </Button>
          <Button variant="ghost" onClick={() => store.invalidate(name)}>
            invalidate()
          </Button>
          <Button variant="ghost" onClick={() => setReveal((r) => !r)}>
            {reveal ? "隠す" : "値を表示"}
          </Button>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: "var(--color-muted)", width: 90 }}>TTL</span>
          <Slider value={[ttl]} min={0} max={30000} step={1000} onValueChange={([v]) => setTtl(v ?? 0)} style={{ flex: 1, maxWidth: 220 }} />
          <span style={{ ...mono, width: 60 }}>{ttl === 0 ? "無効" : `${ttl / 1000}秒`}</span>
          <span style={{ fontSize: 12, color: "var(--color-muted)", marginLeft: 12 }}>
            時計 <b style={mono}>{(clock / 1000).toFixed(0)}秒</b>
          </span>
          <Button size="sm" variant="secondary" onClick={() => setClock((c) => c + 3000)}>
            +3 秒
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setClock(0)}>
            時計を戻す
          </Button>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <Button size="sm" variant="danger" onClick={rotate}>
            ローテーションを実施（v{version.current} → v{version.current + 1}）
          </Button>
          <span style={{ fontSize: 12, color: "var(--color-muted)" }}>
            外部への問い合わせ: <b>{fetchCount.current}</b> 回
          </span>
        </div>

        {requireErr !== "" && (
          <Alert variant="danger" title="require() が失敗しました" style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 12, lineHeight: 1.8 }}>
              {requireErr}
              <br />
              <strong>起動時にこれを呼べば、設定漏れが本番で発覚するのを防げます。</strong>
              「本番で初めて `undefined` が出て落ちる」が典型的な事故です。
            </span>
          </Alert>
        )}

        {log.length > 0 && (
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
                <th style={{ padding: 4, width: 50 }}>時刻</th>
                <th style={{ padding: 4, width: 100 }}>名前</th>
                <th style={{ padding: 4 }}>値</th>
                <th style={{ padding: 4, width: 90 }}>キャッシュ</th>
              </tr>
            </thead>
            <tbody>
              {log.map((r, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={{ padding: 4, ...mono, color: "var(--color-muted)" }}>{(r.at / 1000).toFixed(0)}秒</td>
                  <td style={{ padding: 4, ...mono }}>{r.name}</td>
                  <td style={{ padding: 4, ...mono, color: r.value === null ? "var(--color-danger)" : undefined }}>{show(r.value)}</td>
                  <td style={{ padding: 4 }}>
                    {r.name.startsWith("（") ? "—" : <Badge variant={r.hit ? "success" : "warning"}>{r.hit ? "ヒット" : "再取得"}</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>試してみてください</h2>
        <ul style={{ fontSize: 13, lineHeight: 2, margin: 0, paddingLeft: "1.2em", color: "var(--color-muted)" }}>
          <li>
            <strong>STRIPE_KEY を 2 回 get()</strong> → 2 回目は<b>キャッシュヒット</b>。
            外部への問い合わせは増えません
          </li>
          <li>
            <strong>「ローテーションを実施」→ すぐ get()</strong> → <b>古い値のまま</b>です（TTL 内なので）
          </li>
          <li>
            <strong>その後「+3 秒」を 2 回 → get()</strong> → <b>新しい値</b>になります（TTL 超過で再取得）
          </li>
          <li>
            <strong>ローテーション直後に invalidate() → get()</strong> → <b>即座に新しい値</b>。
            TTL を待たずに済みます
          </li>
          <li>
            <strong>NOPE で require()</strong> → 例外。<b>get() は null を返すだけ</b>で止まりません
          </li>
          <li>
            <strong>TTL を 0 にする</strong> → キャッシュ無効。毎回外部を叩きます（<b>問い合わせ回数が増える</b>）
          </li>
        </ul>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>なぜ環境変数を直に読まないか</h2>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <tbody>
            {[
              { k: "ローテーション", v: "process.env は起動時に固定。**鍵を替えたら再起動が要る**。TTL があれば自動で追随" },
              { k: "取得元の差し替え", v: "開発は .env、本番は Secrets Manager。**アプリのコードは変わらない**" },
              { k: "設定漏れの検知", v: "`require()` を起動時に呼べば、**本番で undefined が出る前に落ちる**" },
              { k: "問い合わせ回数", v: "Secrets Manager は**呼ぶたびに課金**。キャッシュが要る" },
            ].map((r) => (
              <tr key={r.k} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: 5, fontWeight: 600, width: 130 }}>{r.k}</td>
                <td style={{ padding: 5, color: "var(--color-muted)", lineHeight: 1.7 }}>{r.v}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <Separator style={{ margin: "12px 0" }} />

        <p style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.8, margin: 0 }}>
          <strong>このページでは値を <code>maskPartial()</code>（<code>@platform/pii</code>）で伏せています。</strong>
          「値を表示」を押すと出ますが、<strong>本番の画面・ログには出さないでください</strong>。
          シークレットがログに残るのは、漏洩の典型的な経路です（<code>/pii</code> のマスキングと同じ考え方）。
          <br />
          <code>createSecretStore()</code> の <code>now</code> は<strong>テスト用の注入口</strong>です。
          このデモが時計を進められるのは、それがあるからです。
          <strong>時間に依存する処理は、時計を注入できないとテストが書けません。</strong>
        </p>
      </div>
    </main>
  );
}
