"use client";
/**
 * ログイン画面のデモ。
 * - メール+パスワードは **決め打ち**(画面に明記)。DB を持たないため。
 * - ソーシャルは **認可 URL の組み立てまで**を見せる(実際の往復には Client ID と Secret が要る)。
 */
import * as React from "react";
import { Button, EmailLoginForm, type EmailLoginValues } from "@platform/ui";
import { buildGoogleAuthUrl } from "@platform/google";
import { buildAuthorizationUrl, accountsUrl, type ZohoDataCenter } from "@platform/zoho";

/** デモ用の決め打ちアカウント。**本物の認証は @platform/auth + DB で行う。** */
const DEMO_USERS = [
  { email: "admin@example.co.jp", password: "Demo1234!", role: "管理者", perms: "すべての操作" },
  { email: "staff@example.co.jp", password: "Staff1234!", role: "一般社員", perms: "閲覧・申請のみ" },
];

const REDIRECT_BASE = "http://localhost:3001/api/auth";

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 20,
  marginBottom: 16,
};

const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" };

/** CSRF 対策の state（本来はサーバで発行してセッションに紐付ける）。 */
function newState(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export function LoginDemo() {
  const [user, setUser] = React.useState<(typeof DEMO_USERS)[number] | null>(null);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [attempts, setAttempts] = React.useState(0);

  const [dc, setDc] = React.useState<ZohoDataCenter>("jp");
  const [shownUrl, setShownUrl] = React.useState<{ provider: string; url: string } | null>(null);

  // EmailLoginValues は remember も持つが、このデモは使わない。
  // Pick で必要な分だけ受けると、フォームからも「これで入る」ボタンからも同じ関数を呼べる。
  function login(values: Pick<EmailLoginValues, "email" | "password">) {
    setLoading(true);
    setError("");
    // 実際のログインは非同期なので、それらしく待つ
    setTimeout(() => {
      const hit = DEMO_USERS.find((u) => u.email === values.email.trim().toLowerCase() && u.password === values.password);
      if (hit) {
        setUser(hit);
        setAttempts(0);
      } else {
        // 「メールが違う」「パスワードが違う」を区別しない(どちらか教えると総当たりの手がかりになる)
        setError("メールアドレスまたはパスワードが違います");
        setAttempts((a) => a + 1);
      }
      setLoading(false);
    }, 400);
  }

  function showGoogle() {
    setShownUrl({
      provider: "Google",
      url: buildGoogleAuthUrl({
        clientId: "1234567890-demo.apps.googleusercontent.com",
        redirectUri: `${REDIRECT_BASE}/google/callback`,
        scopes: ["openid", "email", "profile"],
        state: newState(),
        offline: true,
      }),
    });
  }

  function showZoho() {
    setShownUrl({
      provider: "Zoho",
      url: buildAuthorizationUrl({
        dataCenter: dc,
        clientId: "1000.DEMOCLIENTID0000000000",
        redirectUri: `${REDIRECT_BASE}/zoho/callback`,
        scope: ["openid", "email", "profile"],
        state: newState(),
        accessType: "offline",
      }),
    });
  }

  if (user !== null) {
    return (
      <>
        <div style={{ ...box, borderColor: "var(--color-success)", textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-success)", marginBottom: 12 }}>ログインしました</div>
          <div style={{ fontSize: 14, lineHeight: 2 }}>
            <div>{user.email}</div>
            <div style={{ color: "var(--color-muted)" }}>
              {user.role} / {user.perms}
            </div>
          </div>
          <Button
            onClick={() => setUser(null)}
            style={{ marginTop: 16, height: 36, padding: "0 20px", borderRadius: "var(--radius)", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)", cursor: "pointer", fontSize: 13 }}
          >
            ログアウト
          </Button>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.8 }}>
          このデモは<strong>画面の中だけ</strong>で完結しています。実際のセッション（封緘 Cookie の発行と検証）は
          <a href="/session" style={{ color: "var(--color-primary)", margin: "0 4px" }}>セッション / クッキー</a>
          のデモで見られます。権限判定は
          <a href="/security" style={{ color: "var(--color-primary)", margin: "0 4px" }}>暗号化と権限(RBAC)</a>
          です。
        </p>
      </>
    );
  }

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>ログイン</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        <code>@platform/ui</code> の <code>EmailLoginForm</code> をそのまま使っています。
        入力検証・パスワード表示切替・送信中の制御は基盤側が持っているので、アプリは
        <code>onSubmit</code> を書くだけです。
      </p>

      {/* 決め打ちアカウントの明記 */}
      <div style={{ ...box, background: "var(--color-bg)", borderStyle: "dashed", padding: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "var(--color-muted)" }}>
          デモ用アカウント（DB を持たないので決め打ちです）
        </div>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
              <th style={{ padding: 4 }}>メールアドレス</th>
              <th style={{ padding: 4 }}>パスワード</th>
              <th style={{ padding: 4 }}>権限</th>
              <th style={{ padding: 4 }}></th>
            </tr>
          </thead>
          <tbody>
            {DEMO_USERS.map((u) => (
              <tr key={u.email} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: 4, ...mono }}>{u.email}</td>
                <td style={{ padding: 4, ...mono }}>{u.password}</td>
                <td style={{ padding: 4, color: "var(--color-muted)" }}>{u.role}</td>
                <td style={{ padding: 4 }}>
                  <Button
                    onClick={() => login({ email: u.email, password: u.password })}
                    style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-fg)", cursor: "pointer" }}
                  >
                    これで入る
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={box}>
        <EmailLoginForm onSubmit={login} loading={loading} showRemember forgotHref="#" minPasswordLength={8} />

        {error !== "" && (
          <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--color-danger)", color: "var(--color-danger)", fontSize: 13 }}>
            {error}
            {attempts >= 3 && (
              <div style={{ fontSize: 11, marginTop: 4, color: "var(--color-muted)" }}>
                {attempts} 回失敗しています。本番では <code>@platform/ratelimit</code> で 5 回/分に制限します
                （<code>/api/login</code> が実装例です）。
              </div>
            )}
          </div>
        )}

        <p style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 12, lineHeight: 1.8 }}>
          <strong>「メールが違う」「パスワードが違う」を区別していません。</strong>
          どちらか教えると「そのメールは登録されている」と分かってしまい、総当たりの手がかりになります。
          <code>/apikey</code> で理由を返さないのと同じ考え方です。
        </p>

        {/* ソーシャルログイン */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0 16px" }}>
          <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
          <span style={{ fontSize: 11, color: "var(--color-muted)" }}>または</span>
          <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Button
            onClick={showGoogle}
            style={{ height: 40, borderRadius: "var(--radius)", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
          >
            Google でログイン
          </Button>
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              onClick={showZoho}
              style={{ flex: 1, height: 40, borderRadius: "var(--radius)", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
            >
              Zoho でログイン
            </Button>
            <select
              value={dc}
              onChange={(e) => setDc(e.target.value as ZohoDataCenter)}
              title="Zoho のデータセンター"
              style={{ width: 100, height: 40, borderRadius: "var(--radius)", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)", fontSize: 12 }}
            >
              {(["jp", "com", "eu", "in", "com.au", "ca"] as ZohoDataCenter[]).map((d) => (
                <option key={d} value={d}>
                  .{d}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {shownUrl !== null && (
        <div style={{ ...box, borderColor: "var(--color-primary)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{shownUrl.provider} の認可 URL</div>
          <pre style={{ ...mono, background: "var(--color-bg)", padding: 12, borderRadius: "var(--radius)", margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
            {shownUrl.url}
          </pre>
          <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
            <strong>ここへ遷移させるのがソーシャルログインの入口です。</strong>
            このデモは<strong>URL を組み立てるところまで</strong>で止めています。
            実際に飛ばすには Client ID と Secret の登録が要り、デモサイトには置けないからです。
            <br />
            押すたびに <code>state</code> が変わります。<strong>CSRF 対策</strong>で、
            コールバックで突き合わせて「自分が始めた認証か」を確認します。
            <br />
            <code>access_type=offline</code> は <code>refresh_token</code> を得るためです。これが無いと
            1 時間で切れて、利用者に再ログインを強いることになります。
          </p>
        </div>
      )}

      <div style={box}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>基盤が持っているもの</div>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <tbody>
            {[
              ["EmailLoginForm", "@platform/ui", "入力検証・表示切替・送信中の制御"],
              ["buildGoogleAuthUrl", "@platform/google", "Google の認可 URL 組み立て"],
              ["buildAuthorizationUrl", "@platform/zoho", "Zoho の認可 URL 組み立て（DC ごとに別ドメイン）"],
              ["createGoogleTokenManager", "@platform/google", "トークンの保持と自動更新"],
              ["createZohoTokenManager", "@platform/zoho", "同上"],
              ["enforceRateLimit", "@platform/guard", "ログイン試行の制限（/api/login で使用）"],
              ["session.write / read", "@platform/session", "封緘 Cookie の発行と検証"],
              ["can / definePolicy", "@platform/auth", "ログイン後の権限判定（RBAC）"],
            ].map(([fn, pkg, desc]) => (
              <tr key={fn} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: 4, ...mono, fontWeight: 700 }}>{fn}</td>
                <td style={{ padding: 4, color: "var(--color-muted)" }}>{pkg}</td>
                <td style={{ padding: 4, color: "var(--color-muted)" }}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          Zoho は<strong>データセンターごとにドメインが違います</strong>（日本は{" "}
          <code>{accountsUrl(dc)}</code>）。ここを間違えると、動くはずの設定で延々と弾かれます。
          <code>accountsUrl()</code> が知っているので、アプリは DC を渡すだけです。
        </p>
      </div>
    </>
  );
}
