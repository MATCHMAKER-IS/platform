"use client";
/**
 * パスワード再設定（忘れたとき）のデモ。
 *
 * 手順は単純だが、間違えると乗っ取りに直結する。基盤（@platform/auth）は
 * **危ない部分を既定で塞いだ形**で提供する:
 *   issuePasswordReset  … 使い捨てトークンを発行し、ハッシュだけ保存
 *   verifyPasswordReset … 期限・使用済み・存在を確かめる（理由は画面に出さない）
 *   completePasswordReset … 使用済みにする
 *
 * メール送信は @platform/mail の担当。ここでは送る内容を表示する。
 */
import * as React from "react";
import {
  issuePasswordReset, verifyPasswordReset, completePasswordReset,
  createMemoryPasswordResetStore, hashResetToken,
} from "@platform/auth";
// 強度の判定は暗号まわりの担当(@platform/crypto)。auth には無い
import { passwordStrength } from "@platform/crypto";
import { Button, Input, Badge, Alert } from "@platform/ui";

const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };
const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" };

const USERS: Record<string, string> = { "yamada@example.co.jp": "u-1001" };

export function PasswordResetDemo() {
  const store = React.useRef(createMemoryPasswordResetStore());
  const [email, setEmail] = React.useState("yamada@example.co.jp");
  const [mail, setMail] = React.useState<{ to: string; body: string; token: string } | null>(null);
  const [token, setToken] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [log, setLog] = React.useState<string[]>([]);
  const [drift, setDrift] = React.useState(0);
  const [done, setDone] = React.useState(false);

  const now = React.useCallback(() => Date.now() + drift, [drift]);
  const add = (t: string) => setLog((l) => [`${new Date().toLocaleTimeString()}  ${t}`, ...l].slice(0, 8));

  // 1. 申請（存在しないメールでも同じ応答を返す）
  const request = async () => {
    const userId = USERS[email.trim()];
    if (!userId) {
      // ここが要点: 登録の有無を漏らさない
      add(`申請を受け付けました（${email} は未登録だが、応答は同じ）`);
      setMail(null);
      return;
    }
    const issued = await issuePasswordReset(store.current, userId, { expiresInMinutes: 30, now });
    setMail({
      to: email,
      token: issued.token,
      body: `パスワード再設定のご案内\n\n下のリンクから再設定してください（30分間有効・1回のみ）。\nhttps://example.co.jp/reset?token=${issued.token}\n\n心当たりが無い場合は、この案内を破棄してください。`,
    });
    setToken("");
    setDone(false);
    add(`トークンを発行（保存されるのはハッシュ ${hashResetToken(issued.token).slice(0, 16)}… のみ）`);
  };

  // 2. リンクを開いて再設定
  const submit = async () => {
    const v = await verifyPasswordReset(store.current, token.trim(), now);
    if (!v.ok) {
      // 理由（not_found / expired / used）は画面に出さない
      add(`照合に失敗（内部理由: ${v.reason}）→ 画面には「無効なリンク」とだけ出す`);
      setDone(false);
      return;
    }
    const s = passwordStrength(password);
    if (s.score < 2) {
      add(`パスワードが弱いため拒否（${s.label}）`);
      return;
    }
    await completePasswordReset(store.current, v.tokenHash, now);
    setDone(true);
    add(`再設定を確定（${v.userId}）→ 既存セッションを無効化する`);
  };

  const strength = password === "" ? null : passwordStrength(password);

  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 16 }}>
        使い捨てのリンクをメールで送り、<strong>1 回だけ・30 分だけ</strong>有効にします。
        保存するのは<strong>ハッシュだけ</strong>なので、保存先が漏れてもそのままでは使えません。
      </p>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>1. 「パスワードを忘れた」から申請</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="メールアドレス" style={{ maxWidth: 280 }} />
          <Button onClick={() => void request()}>再設定メールを送る</Button>
          <Button variant="secondary" onClick={() => { setEmail("unknown@example.co.jp"); }}>未登録のアドレスで試す</Button>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          未登録のアドレスでも<strong>同じ応答</strong>を返します。「そのアドレスは登録されていません」と出すと、
          誰が利用者かを外部から調べられてしまうためです。
        </p>
      </div>

      {mail !== null && (
        <div style={box}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>2. 送られるメール（@platform/mail が送信）</div>
          <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 6 }}>宛先: {mail.to}</div>
          <pre style={{ ...mono, margin: 0, padding: 12, borderRadius: 6, background: "var(--color-bg)", border: "1px solid var(--color-border)", whiteSpace: "pre-wrap" }}>{mail.body}</pre>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <Button size="sm" variant="secondary" onClick={() => setToken(mail.token)}>リンクを開いた状態にする</Button>
            <Button size="sm" variant="secondary" onClick={() => setDrift(31 * 60_000)}>31 分経過させる</Button>
            {drift !== 0 && <Badge variant="warning">31 分経過</Badge>}
          </div>
        </div>
      )}

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>3. 新しいパスワードを設定</div>
        <div style={{ display: "grid", gap: 10, maxWidth: 420 }}>
          <label style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--color-muted)" }}>トークン（リンクに含まれる値）
            <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="メールのリンクから" style={{ fontFamily: "monospace" }} />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--color-muted)" }}>新しいパスワード
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {strength && (
            <div style={{ fontSize: 12.5 }}>
              強度: {"★".repeat(strength.score + 1)}{"☆".repeat(4 - strength.score)} {strength.label}
              {strength.suggestions.length > 0 && <span style={{ color: "var(--color-muted)" }}> — {strength.suggestions.join(" / ")}</span>}
            </div>
          )}
          <div><Button onClick={() => void submit()} disabled={token === "" || password === ""}>再設定する</Button></div>
        </div>
        {done && (
          <div style={{ marginTop: 12 }}>
            <Alert variant="success" title="再設定できました">
              このトークンは<strong>使用済み</strong>になりました。同じリンクをもう一度開いても通りません。
              実運用では、ここで<strong>既存のセッションをすべて無効化</strong>します
              （新しいパスワードにしても、盗まれたセッションが生きていては意味がないため）。
            </Alert>
          </div>
        )}
      </div>

      {log.length > 0 && (
        <div style={box}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>サーバ側で起きたこと</div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, ...mono, lineHeight: 1.9 }}>
            {log.map((l, i) => <li key={i} style={{ color: i === 0 ? "var(--color-fg)" : "var(--color-muted)" }}>{l}</li>)}
          </ul>
        </div>
      )}

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>間違えやすい点</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.9 }}>
          <li><strong>生のトークンを保存する</strong> — 保存先が漏れた時点で、全員のアカウントが取れる</li>
          <li><strong>失敗理由を画面に出す</strong> — 「期限切れ」と「存在しない」の違いが、有効なリンクを探る手がかりになる</li>
          <li><strong>期限が長すぎる</strong> — メールが残っている限り使える状態になる（30 分程度に）</li>
          <li><strong>再設定後にセッションを切らない</strong> — 乗っ取られたままになる</li>
          <li><strong>何度でも申請できる</strong> — メール爆撃に使われる。レート制限（<code>@platform/ratelimit</code>）をかける</li>
        </ul>
      </div>
    </div>
  );
}
