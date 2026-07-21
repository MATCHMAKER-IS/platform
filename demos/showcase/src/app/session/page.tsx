"use client";
/**
 * セッションのデモ。総当たり対策・放置ログアウト・再認証・監査。
 *
 * **API 経由(/api/login)は封緘クッキーの実物**、それ以外は基盤の純ロジックを画面で動かす。
 * UI は **@platform/ui の部品だけ**で組む(CLAUDE.md「UI 部品は @platform/ui を使う」)。
 */
import * as React from "react";
import { Button, Input, Badge, Alert, Switch, toast } from "@platform/ui";
import {
  createLoginThrottle,
  createMemoryThrottleStore,
  stepUpRequired,
  markAuthenticated,
  sessionMaxAge,
  createLoginAudit,
  summarizeLoginEvent,
  serializeCookie,
  type LoginAuditEvent,
  type ThrottleCheck,
} from "@platform/session";

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" };

export default function Page() {
  // ── 実物のセッション(API 経由) ──
  const [email, setEmail] = React.useState("");
  const [me, setMe] = React.useState<{ email: string; loginAt: number } | null>(null);

  // ── 純ロジックのデモ(時計を注入して動かす) ──
  const [clock, setClock] = React.useState(0);
  const clockRef = React.useRef(0);
  clockRef.current = clock;

  const [check, setCheck] = React.useState<ThrottleCheck | null>(null);
  const [authAt, setAuthAt] = React.useState<number | undefined>(undefined);
  const [remember, setRemember] = React.useState(false);
  const [events, setEvents] = React.useState<LoginAuditEvent[]>([]);

  const throttle = React.useMemo(() => {
    const store = createMemoryThrottleStore(() => clockRef.current);
    // ★progressive: ロックのたびに時間が延びる(総当たりを諦めさせる)
    return createLoginThrottle({ maxFails: 3, windowMs: 900_000, lockMs: 60_000, progressive: true, maxLockMs: 86_400_000, store, now: () => clockRef.current });
  }, []);

  const audit = React.useMemo(
    () => createLoginAudit({ record: (e) => setEvents((l) => [e, ...l].slice(0, 8)) }, { now: () => new Date(2026, 6, 17, 10, 0, clockRef.current / 1000) }),
    [],
  );

  const refresh = async () => {
    const res = await fetch("/api/me");
    const data = (await res.json()) as { user: { email: string; loginAt: number } | null };
    setMe(data.user);
  };
  React.useEffect(() => {
    void refresh();
  }, []);

  const login = async () => {
    const res = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    if (res.ok) {
      toast.success("ログインしました");
      setEmail("");
      await refresh();
    } else toast.error("ログインに失敗しました");
  };
  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    toast.success("ログアウトしました");
    await refresh();
  };

  async function tryFail() {
    const c = await throttle.check("yamada@example.co.jp");
    if (!c.allowed) {
      setCheck(c);
      audit.loginFailure({ subject: "yamada@example.co.jp", ip: "198.51.100.7", reason: "ロック中" });
      return;
    }
    await throttle.recordFailure("yamada@example.co.jp");
    const after = await throttle.check("yamada@example.co.jp");
    setCheck(after);
    audit.loginFailure({ subject: "yamada@example.co.jp", ip: "198.51.100.7", reason: "パスワード不一致" });
    if (!after.allowed) audit.accountLocked({ subject: "yamada@example.co.jp", ip: "198.51.100.7", reason: "3 回連続失敗" });
  }
  async function trySuccess() {
    const c = await throttle.check("yamada@example.co.jp");
    if (!c.allowed) {
      setCheck(c);
      return;
    }
    await throttle.recordSuccess("yamada@example.co.jp");
    setCheck(await throttle.check("yamada@example.co.jp"));
    setAuthAt(markAuthenticated(() => clockRef.current));
    audit.loginSuccess({ subject: "yamada@example.co.jp", ip: "203.0.113.10", method: "password" });
  }

  const stepCfg = { freshnessSec: 300, now: () => clockRef.current };
  const needStepUp = stepUpRequired(authAt, stepCfg);
  const rememberCfg = { defaultMaxAgeSec: 3600, rememberMaxAgeSec: 2592000 };
  const maxAge = sessionMaxAge(remember, rememberCfg);

  const cookieStr = serializeCookie("session", "eyJhbGciOi...(封緘済み)", {
    maxAge,
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
  });

  return (
    <main style={{ maxWidth: 900, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>セッション</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        <strong>「ログインできる」だけでは足りません。</strong>
        総当たりを止め、放置で切り、重要操作の前に再認証し、誰がいつログインしたかを残す——
        <code>@platform/session</code> はそれを全部持ちます。
      </p>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>① 実物のセッション（封緘クッキー）</h2>
        {me !== null ? (
          <div>
            <p style={{ fontSize: 13 }}>
              ログイン中: <strong>{me.email}</strong>
            </p>
            <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 10 }}>
              ログイン時刻: {new Date(me.loginAt).toLocaleString("ja-JP")}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="secondary" onClick={() => void logout()}>
                ログアウト
              </Button>
              <Button variant="ghost" onClick={() => (window.location.href = "/dashboard")}>
                保護ページへ →
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="メールアドレス" style={{ flex: 1, minWidth: 200 }} />
            <Button onClick={() => void login()}>ログイン</Button>
          </div>
        )}
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <strong>クッキーの中身は暗号化 + 署名されています</strong>（封緘）。
          サーバに持たないので<strong>DB もセッションストアも要りません</strong>。
          保護ページは <code>requireSession()</code> でガードします。
        </p>
      </div>

      <div style={{ ...box, background: "var(--color-bg)", borderStyle: "dashed" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--color-muted)" }}>
            以下は<strong>基盤の純ロジック</strong>を画面で動かしています（時計を注入できるため）
          </span>
          <span style={{ marginLeft: "auto", fontSize: 12 }}>
            時計 <b style={mono}>{(clock / 1000).toFixed(0)}秒</b>
          </span>
          <Button size="sm" variant="secondary" onClick={() => setClock((c) => c + 30_000)}>
            +30 秒
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setClock((c) => c + 300_000)}>
            +5 分
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setClock(0)}>
            戻す
          </Button>
        </div>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>② 総当たり対策</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          <Button variant="danger" onClick={() => void tryFail()}>
            ログイン失敗
          </Button>
          <Button onClick={() => void trySuccess()}>ログイン成功</Button>
          {check !== null && (
            <>
              {check.allowed ? (
                <Badge variant={(check.remaining ?? 0) <= 1 ? "warning" : "secondary"}>あと {check.remaining ?? 0} 回</Badge>
              ) : (
                <Badge variant="danger">ロック中 — あと {Math.ceil((check.retryAfterMs ?? 0) / 1000)} 秒</Badge>
              )}
            </>
          )}
        </div>

        <Alert variant="warning" title="ロックのたびに時間が延びます（progressive）" style={{ marginTop: 10 }}>
          <span style={{ fontSize: 12, lineHeight: 1.8 }}>
            <strong>3 回失敗 → 60 秒ロック。「+30 秒」を 2 回押して解除 → もう 1 回失敗 → 120 秒</strong>。
            さらに次は 240 秒——<strong>総当たりを諦めさせる</strong>ための設計です。
            <br />
            <strong>「ログイン成功」を押すとリセットされます</strong>——
            正当な利用者が 2 回打ち間違えても、成功すれば影響が残りません。
            <br />
            上限は 24 時間（<code>maxLockMs</code>）。無限に延ばすと<strong>正当な利用者を締め出します</strong>。
          </span>
        </Alert>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>③ 重要操作の前に再認証（step-up）</h2>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <Badge variant={needStepUp ? "danger" : "success"}>{needStepUp ? "再認証が必要" : "再認証は不要"}</Badge>
          <span style={{ fontSize: 12, color: "var(--color-muted)" }}>
            {authAt === undefined ? "未認証" : `最終認証: ${((clock - authAt) / 1000).toFixed(0)} 秒前（鮮度 300 秒）`}
          </span>
          <Button size="sm" variant="secondary" onClick={() => setAuthAt(markAuthenticated(() => clockRef.current))}>
            いま認証した
          </Button>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.8 }}>
          <strong>「いま認証した」→「+5 分」を押すと、再認証が必要になります。</strong>
          <br />
          <strong>ログインしていれば何でもできる、ではありません。</strong>
          支払い・権限変更・退職処理のような<strong>取り返しのつかない操作</strong>の前に、
          直近の認証を求めます——<strong>離席中に PC を触られても被害を抑えられます</strong>。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>④ ログイン状態を保持</h2>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 10 }}>
          <Switch checked={remember} onCheckedChange={setRemember} />
          ログイン状態を保持する
        </label>
        <div style={{ fontSize: 13, marginBottom: 8 }}>
          有効期間: <b>{maxAge.toLocaleString()}</b> 秒 ={" "}
          <b>{remember ? `${maxAge / 86400} 日` : `${maxAge / 3600} 時間`}</b>
        </div>
        <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 6 }}>
          <code>serializeCookie()</code> が返すヘッダ
        </div>
        <span style={{ ...mono, display: "block", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 4, padding: "6px 8px" }}>
          {cookieStr}
        </span>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 8, lineHeight: 1.8 }}>
          <strong>属性を手で書かないための関数です。</strong>
          <code>HttpOnly</code>（JS から読めない = XSS で盗まれない）、
          <code>Secure</code>（HTTPS のみ）、<code>SameSite=Lax</code>（CSRF 対策）——
          <strong>1 つ書き忘れても動いてしまう</strong>ので、各アプリで書くと必ず漏れます。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>⑤ 監査ログ</h2>
        {events.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--color-muted)" }}>上の②でログインを試すと記録されます。</p>
        ) : (
          <div style={{ ...mono, background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 4, padding: "8px 10px", lineHeight: 1.9 }}>
            {events.map((e, i) => (
              <div key={i} style={{ color: e.event.includes("failure") || e.event === "account_locked" ? "var(--color-danger)" : undefined }}>
                {summarizeLoginEvent(e)}
              </div>
            ))}
          </div>
        )}
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <strong>10 種類のイベント</strong>を持ちます——
          <code>login_success</code> / <code>login_failure</code> / <code>logout</code> /
          <code>account_locked</code> / <code>session_expired</code> / <code>idle_logout</code> /
          <code>step_up_success</code> / <code>step_up_failure</code> / <code>password_changed</code> /
          <code>all_sessions_revoked</code>。
          <br />
          <strong>「誰が」は <code>subject</code>（<code>userId</code> ではありません）。</strong>
          IP と失敗理由も残るので、<strong>「どこから何回攻撃されたか」が追えます</strong>
          （<code>/audit</code> の監査ログへ流します）。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>放置で自動ログアウト（createIdleTimer）</h2>
        <span style={{ ...mono, display: "block", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 4, padding: "8px 10px", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
{`const timer = createIdleTimer({
  timeoutMs: 30 * 60 * 1000,      // 30 分で自動ログアウト
  warnBeforeMs: 2 * 60 * 1000,    // 2 分前に警告
  onWarn: (ms) => toast.warning(\`あと \${ms / 1000} 秒でログアウトします\`),
  onIdle: () => void logout(),
  onActive: () => toast.dismiss(),  // 操作が戻ったら警告を消す
});
timer.start();

// 操作イベントを購読(戻り値は解除関数。**画面を離れるときに必ず呼ぶ**)
const unbind = bindActivityListeners(timer);
return () => { unbind(); timer.stop(); };`}
        </span>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <strong>共有 PC・受付端末で要ります。</strong>
          <code>warnBeforeMs</code> が無いと<strong>入力中に突然消えます</strong>——
          警告を出して、操作が戻れば取り消すのが親切です。
          <br />
          <strong><code>bindActivityListeners()</code> の戻り値（解除関数）を必ず呼んでください</strong>——
          呼ばないとイベントリスナーがリークします。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>設計について</h2>
        <p style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.9, margin: 0 }}>
          <strong>すべて <code>now</code> / <code>scheduler</code> を注入できます。</strong>
          このページが時計を進められるのはそのためで、
          <strong>時間に依存する処理は、時計を注入できないとテストが書けません</strong>。
          <br />
          <br />
          <code>createSession()</code> は <strong><code>salt</code> が必須</strong>です——
          固定の共有既定値があると<strong>複数環境で同一鍵になり</strong>、
          レインボーテーブル攻撃に弱くなります。本番は <code>env.SESSION_SALT</code> から渡してください
          （<a href="/secrets" style={{ color: "var(--color-primary)" }}>シークレット管理</a>と組み合わせます）。
          <br />
          <br />
          <strong>封緘クッキー（<code>createSession</code>）とサーバ側セッション（<code>createServerSession</code>）</strong>
          の 2 方式があります。前者は DB 不要で速い、後者は<strong>「全セッションを即座に無効化」ができます</strong>
          （退職者のアカウント停止で要る）。
        </p>
      </div>
    </main>
  );
}
