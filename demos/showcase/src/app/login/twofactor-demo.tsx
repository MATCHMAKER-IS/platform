"use client";
/**
 * 2 要素認証（TOTP）のデモ。
 *
 * パスワードだけだと、漏れた時点で入られる。2 要素目は
 * 「**その端末を持っていること**」を確かめるためのもの。
 *
 * 基盤（@platform/auth）が担当するのは純ロジック:
 *   generateTotpSecret … 端末と共有する秘密を作る
 *   totpAuthUri        … 認証アプリに読ませる URI（QR にする元）
 *   totp / verifyTotp  … 6 桁コードの生成と検証（時刻ずれを許容）
 *   generateBackupCodes / verifyBackupCode … 端末を失くしたときの逃げ道
 */
import * as React from "react";
import { generateTotpSecret, totp, verifyTotp, totpAuthUri, generateBackupCodes, verifyBackupCode, type BackupCodeRecord } from "@platform/auth";
import { Button, Input, Badge, Alert } from "@platform/ui";

const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };
/** 予備コードのハッシュに混ぜる秘密。実運用では @platform/env 経由で環境変数から読む。 */
const BACKUP_SECRET = "demo-backup-secret-change-me";

const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" };

export function TwoFactorDemo() {
  const [secret, setSecret] = React.useState("");
  const [codes, setCodes] = React.useState<string[]>([]);
  // 保存するのはハッシュを含むレコード。平文のコードは保持しない
  const [records, setRecords] = React.useState<BackupCodeRecord[]>([]);
  const [input, setInput] = React.useState("");
  const [result, setResult] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [nowCode, setNowCode] = React.useState("");
  const [drift, setDrift] = React.useState(0);

  // 登録: 秘密と予備コードを作る
  const enroll = () => {
    const s = generateTotpSecret();
    // 予備コードのハッシュ化には、アプリ固有の秘密を混ぜる(漏れても総当たりしにくくする)
    const backup = generateBackupCodes(BACKUP_SECRET, { count: 5 });
    setSecret(s);
    setCodes(backup.codes);
    setRecords(backup.records);
    setResult(null);
  };

  // 認証アプリが今表示するはずのコード（30 秒ごとに変わる）
  React.useEffect(() => {
    if (secret === "") return;
    const tick = () => setNowCode(totp(secret));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [secret]);

  const check = () => {
    const code = input.trim();
    if (code === "") return;
    // まず TOTP として検証（時刻のずれを ±1 枠まで許容）
    if (verifyTotp(secret, code, { window: 1 }, new Date(Date.now() + drift * 1000))) {
      setResult({ ok: true, text: "認証できました（TOTP）" });
      return;
    }
    // 通らなければ予備コードとして検証（1 回使ったら無効）
    const r = verifyBackupCode(code, records, BACKUP_SECRET);
    if (r.valid) {
      setRecords(r.records); // 使用済みを反映して保存し直す
      const left = r.records.filter((x) => x.usedAt === undefined).length;
      setResult({ ok: true, text: `認証できました（予備コード。残り ${left} 個）` });
      return;
    }
    setResult({ ok: false, text: "コードが違います（期限切れか、既に使った予備コードの可能性）" });
  };

  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 16 }}>
        パスワードが漏れても、<strong>端末を持っている人だけ</strong>が入れるようにする仕組みです。
        コードは 30 秒ごとに変わり、時計のずれを ±30 秒まで許容します。
      </p>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>1. 登録する</div>
        <Button onClick={enroll}>2 要素認証を有効にする</Button>
        {secret !== "" && (
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--color-muted)" }}>共有する秘密（認証アプリに登録する値）</div>
              <div style={{ ...mono, padding: "6px 10px", borderRadius: 6, background: "var(--color-bg)", border: "1px solid var(--color-border)" }}>{secret}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--color-muted)" }}>認証アプリ用の URI（実運用ではこれを QR コードにする）</div>
              <div style={{ ...mono, padding: "6px 10px", borderRadius: 6, background: "var(--color-bg)", border: "1px solid var(--color-border)" }}>
                {totpAuthUri(secret, { account: "yamada@example.co.jp", issuer: "社内システム" })}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--color-muted)" }}>予備コード（端末を失くしたとき用。1 回ずつ使える）</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                {codes.map((c, i) => {
                  const spent = records[i]?.usedAt !== undefined;
                  return (
                    <code key={c} style={{ ...mono, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-bg)", textDecoration: spent ? "line-through" : undefined, opacity: spent ? 0.5 : 1 }}>{c}</code>
                  );
                })}
              </div>
            </div>
            <Alert variant="warning" title="保存の仕方に注意">
              予備コードは<strong>ハッシュにして保存</strong>します（画面が持っているのはハッシュを含むレコードだけです）。
              利用者に見せるのは<strong>この 1 回だけ</strong>で、後から再表示はできません。
            </Alert>
          </div>
        )}
      </div>

      {secret !== "" && (
        <div style={box}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>2. ログイン時に確かめる</div>
          <div style={{ fontSize: 12.5, color: "var(--color-muted)", marginBottom: 10 }}>
            認証アプリが今表示しているはずのコード: <code style={{ ...mono, fontSize: 15, fontWeight: 700 }}>{nowCode}</code>
            <span style={{ marginLeft: 8 }}>（残り {30 - (Math.floor(Date.now() / 1000) % 30)} 秒）</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="6 桁または予備コード" style={{ maxWidth: 220, fontFamily: "monospace" }} />
            <Button onClick={check}>確かめる</Button>
            <Button variant="secondary" onClick={() => { setInput(nowCode); }}>今のコードを入れる</Button>
            <Button variant="secondary" onClick={() => setDrift((d) => (d === 0 ? 120 : 0))}>
              {drift === 0 ? "端末の時計を 2 分ずらす" : "時計を戻す"}
            </Button>
            {drift !== 0 && <Badge variant="warning">時計が 2 分ずれています</Badge>}
          </div>
          {result !== null && (
            <div style={{ marginTop: 12 }}>
              <Alert variant={result.ok ? "success" : "danger"}>{result.text}</Alert>
            </div>
          )}
          <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
            「時計を 2 分ずらす」と、正しいコードでも通らなくなります。端末の時計が狂っていると認証できない、という
            実際に起きる問い合わせを再現しています（許容は ±30 秒）。そのときの逃げ道が<strong>予備コード</strong>です。
          </p>
        </div>
      )}

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>運用で決めておくこと</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.9 }}>
          <li><strong>誰に必須にするか</strong> — 全社員か、管理者権限を持つ人だけか</li>
          <li><strong>端末を失くした人をどう戻すか</strong> — 予備コード、または本人確認のうえで管理者が解除</li>
          <li><strong>解除も監査に残す</strong> — 2 要素の解除は、乗っ取りの足がかりになりうる操作</li>
          <li><strong>秘密は暗号化して保存</strong> — <code>@platform/crypto</code> で暗号化（漏れると 2 要素の意味が無くなる）</li>
        </ul>
      </div>
    </div>
  );
}
