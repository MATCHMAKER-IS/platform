"use client";
/**
 * 外部サービス接続チェック。
 *
 * 「連携するには何が必要で、どこで取れて、いま手元の値で本当に通るのか」を
 * 1 画面で確かめられるようにする。
 *
 * 扱いは慎重に:
 *  - 入力値は**保存しない**（localStorage にも書かない。再読み込みで消える）
 *  - 形式の確認はブラウザ内だけで行う（どこにも送らない）
 *  - 接続テストを押したときだけ、**このデモサイト自身のサーバ**へ送って1回試す
 *  - サーバは記録もログ出力もせず、「通ったか / 通らなかった理由」だけを返す
 */
import * as React from "react";
import { Alert, Badge, Button, Checkbox, Input, Select } from "@platform/ui";

const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: 16, marginBottom: 16 };
const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" };
const lb: React.CSSProperties = { display: "grid", gap: 4, fontSize: 12, color: "var(--color-muted)" };

type Field = {
  key: string;
  label: string;
  secret: boolean;
  /** 形式の目安。ブラウザ内だけで確認する */
  pattern?: RegExp;
  patternHint?: string;
  placeholder?: string;
  options?: { label: string; value: string }[];
};
type Service = {
  id: string;
  name: string;
  what: string;          // 何ができるようになるか
  where: string;         // どこで取るか
  scope?: string;        // 必要な権限
  test: string;          // テストで何を叩くか(未対応なら理由)
  /** 疎通テストに対応していないサービスは false。形式の確認だけを行う */
  testable?: boolean;
  fields: Field[];
};

const SERVICES: Service[] = [
  {
    id: "freee", name: "freee（会計）",
    what: "請求書・仕訳の連携、取引先や勘定科目の取得",
    where: "freee アプリストア → アプリ管理 → 「アプリを作成」でクライアント ID / シークレットを発行し、認可の流れでリフレッシュトークンを取得",
    scope: "read（参照）／write（登録）を用途に応じて",
    test: "リフレッシュトークンからアクセストークンを取り直せるか",
    fields: [
      { key: "FREEE_CLIENT_ID", label: "クライアント ID", secret: false, placeholder: "英数字" },
      { key: "FREEE_CLIENT_SECRET", label: "クライアントシークレット", secret: true },
      { key: "FREEE_REFRESH_TOKEN", label: "リフレッシュトークン", secret: true },
    ],
  },
  {
    id: "google", name: "Google（カレンダー / スプレッドシート）",
    what: "予定の読み書き、スプレッドシートの取得・更新",
    where: "Google Cloud Console → API とサービス → 認証情報 → OAuth クライアント ID を作成",
    scope: "calendar / spreadsheets など、使う API ごとに追加",
    test: "リフレッシュトークンをアクセストークンに交換できるか",
    fields: [
      { key: "GOOGLE_CLIENT_ID", label: "クライアント ID", secret: false, pattern: /\.apps\.googleusercontent\.com$/, patternHint: ".apps.googleusercontent.com で終わります", placeholder: "xxxx.apps.googleusercontent.com" },
      { key: "GOOGLE_CLIENT_SECRET", label: "クライアントシークレット", secret: true },
      { key: "GOOGLE_REFRESH_TOKEN", label: "リフレッシュトークン", secret: true, pattern: /^1\/\/|^ya29\.|^.{20,}$/, patternHint: "認可時に一度だけ表示されます" },
    ],
  },
  {
    id: "stripe", name: "Stripe（決済）",
    what: "支払いの作成・確定・返金、Webhook の受信",
    where: "Stripe ダッシュボード → 開発者 → API キー",
    scope: "シークレットキー（sk_）。公開キー（pk_）はサーバ側では使いません",
    test: "残高の参照（読み取りのみ）で鍵が有効か",
    fields: [
      { key: "STRIPE_SECRET_KEY", label: "シークレットキー", secret: true, pattern: /^sk_(test|live)_/, patternHint: "sk_test_ または sk_live_ で始まります", placeholder: "sk_test_..." },
    ],
  },
  {
    id: "paypal", name: "PayPal（決済）",
    what: "注文の作成・確定・返金",
    where: "PayPal Developer → My Apps & Credentials",
    scope: "サンドボックスと本番で鍵が別です",
    test: "client_credentials でトークンを取得できるか",
    fields: [
      { key: "PAYPAL_CLIENT_ID", label: "クライアント ID", secret: false },
      { key: "PAYPAL_CLIENT_SECRET", label: "シークレット", secret: true },
      { key: "PAYPAL_ENV", label: "環境", secret: false, options: [{ label: "サンドボックス", value: "sandbox" }, { label: "本番", value: "live" }] },
    ],
  },
  {
    id: "line", name: "LINE（メッセージ配信）",
    what: "社員・顧客への通知配信、応答メッセージ",
    where: "LINE Developers → チャネル → Messaging API 設定",
    scope: "チャネルアクセストークン（長期）",
    test: "ボット情報の取得（送信はしません）",
    fields: [
      { key: "LINE_CHANNEL_ACCESS_TOKEN", label: "チャネルアクセストークン", secret: true, pattern: /^.{50,}$/, patternHint: "長い文字列です（50 文字以上）" },
    ],
  },
  {
    id: "microsoft", name: "Microsoft 365 / Entra ID",
    what: "Outlook のメール送信、予定の作成・参照、社員情報の取得、Teams 会議リンクの発行",
    where: "Azure ポータル → Microsoft Entra ID → アプリの登録 → 証明書とシークレット / API のアクセス許可",
    scope: "User.Read / Mail.Send / Calendars.ReadWrite など、使う操作の分だけ。組織全体に関わる権限は管理者の同意が必要",
    test: "リフレッシュトークンからアクセストークンを取り直せるか",
    fields: [
      { key: "MICROSOFT_TENANT_ID", label: "テナント ID", secret: false, placeholder: "00000000-0000-0000-0000-000000000000",
        pattern: /^[0-9a-f-]{36}$/i, patternHint: "自社のテナント ID。common にすると他社アカウントも通るため使いません" },
      { key: "MICROSOFT_CLIENT_ID", label: "アプリ(クライアント)ID", secret: false, pattern: /^[0-9a-f-]{36}$/i, patternHint: "GUID 形式です" },
      { key: "MICROSOFT_CLIENT_SECRET", label: "クライアントシークレット", secret: true, patternHint: "有効期限があります（既定 6〜24 か月）" },
      { key: "MICROSOFT_REFRESH_TOKEN", label: "リフレッシュトークン", secret: true, patternHint: "更新のたびに新しい値へ回転します。保存し直さないと失効します" },
    ],
  },
  {
    id: "slack-api", name: "Slack（Web API・受信）",
    what: "スレッドへの返信、メッセージの更新、利用者の照会、スラッシュコマンドの受信",
    where: "Slack API → Your Apps → OAuth & Permissions（ボットトークン）/ Basic Information（Signing Secret）",
    scope: "chat:write / users:read.email など、使う操作の分だけ。通知を送るだけなら Webhook で足ります",
    test: "auth.test で認証情報を確認（投稿はしません）",
    fields: [
      { key: "SLACK_BOT_TOKEN", label: "ボットトークン", secret: true, pattern: /^xoxb-/, patternHint: "xoxb- で始まります" },
    ],
  },
  {
    id: "notion", name: "Notion",
    what: "データベースの照会、ページの作成・更新、本文の取得（議事録・手順書・案件管理）",
    where: "Notion → 設定 → コネクト → インテグレーションを開発 → 内部インテグレーション",
    scope: "**連携したいページ/DB を、そのインテグレーションに共有する**必要があります（共有忘れが最も多いつまずき）",
    test: "users/me でトークンの有効性を確認",
    fields: [
      { key: "NOTION_TOKEN", label: "インテグレーショントークン", secret: true, pattern: /^(ntn_|secret_)/, patternHint: "ntn_ または secret_ で始まります" },
    ],
  },
  {
    id: "zoho", name: "Zoho（CRM / Books）",
    what: "顧客・商談・見積の連携",
    where: "Zoho API Console → Self Client / Server-based Application で発行し、認可コードからトークンを取得",
    scope: "ZohoCRM.modules.ALL など、使うモジュールごとに",
    test: "現在のユーザー情報の取得（読み取りのみ）",
    fields: [
      { key: "ZOHO_API_DOMAIN", label: "API ドメイン", secret: false, placeholder: "https://www.zohoapis.jp", pattern: /^https:\/\/.+/, patternHint: "日本のアカウントは .jp です" },
      { key: "ZOHO_ACCESS_TOKEN", label: "アクセストークン", secret: true, patternHint: "1 時間で切れます。運用ではリフレッシュトークンから都度取得します" },
    ],
  },
  {
    id: "resend", name: "Resend（メール送信）",
    what: "通知メール・パスワード再設定メールの送信",
    where: "Resend ダッシュボード → API Keys",
    scope: "送信のみなら Sending access で足ります",
    test: "送信元ドメインの一覧取得（メールは送りません）",
    fields: [
      { key: "RESEND_API_KEY", label: "API キー", secret: true, pattern: /^re_/, patternHint: "re_ で始まります" },
    ],
  },
  {
    id: "meilisearch", name: "Meilisearch（全文検索）",
    what: "日本語の全文検索・あいまい検索",
    where: "自前で立てるサーバ。起動時のマスターキーを使います",
    scope: "検索だけなら検索用の鍵を別に発行できます",
    test: "サーバの死活確認と、鍵の有効性",
    fields: [
      { key: "MEILISEARCH_HOST", label: "ホスト URL", secret: false, placeholder: "http://localhost:7700", pattern: /^https?:\/\/.+/, patternHint: "http:// または https:// から始めます" },
      { key: "MEILISEARCH_API_KEY", label: "マスターキー", secret: true },
    ],
  },
  {
    id: "postgres", name: "PostgreSQL（データベース）",
    what: "業務データの保存先。すべてのアプリの土台",
    where: "自前のサーバ、または ConoHa / RDS などのマネージドサービス",
    scope: "アプリ用のユーザーを作り、必要なデータベースにだけ権限を与えます",
    test: "ホストとポートに到達できるか（利用者名やパスワードの検証は起動時に行われます）",
    fields: [
      { key: "DATABASE_URL", label: "接続 URL", secret: true, placeholder: "postgresql://app:password@localhost:5432/app",
        pattern: /^postgres(ql)?:\/\/.+@.+\/.+/, patternHint: "postgresql://ユーザー:パスワード@ホスト:5432/データベース名" },
    ],
  },
  {
    id: "redis", name: "Redis（キャッシュ・キュー）",
    what: "キャッシュ、レート制限、ジョブキューの保存先",
    where: "自前のサーバ、またはマネージドサービス",
    scope: "パスワードを設定している場合は URL に含めます",
    test: "PING を送って PONG が返るか（実際のプロトコルで確認します）",
    fields: [
      { key: "REDIS_URL", label: "接続 URL", secret: true, placeholder: "redis://localhost:6379",
        pattern: /^rediss?:\/\/.+/, patternHint: "redis://ホスト:6379（パスワードがあれば redis://:パスワード@ホスト:6379）" },
    ],
  },
  {
    id: "anthropic", name: "Anthropic（AI）",
    what: "社内資料アシスタントの回答生成、文章の要約・下書き",
    where: "Anthropic Console → API Keys",
    scope: "鍵は必ずサーバ側に置き、@platform/ai のゲートウェイ経由でのみ使う（利用量と費用を記録するため）",
    test: "モデル一覧の取得（生成は行わないので費用は発生しません）",
    fields: [
      { key: "ANTHROPIC_API_KEY", label: "API キー", secret: true, pattern: /^sk-ant-/, patternHint: "sk-ant- で始まります" },
    ],
  },
  {
    id: "sentry", name: "Sentry（エラー収集）",
    what: "本番で起きた例外の収集と通知",
    where: "Sentry → プロジェクト設定 → Client Keys (DSN)",
    scope: "DSN は送信専用のため、漏れても読み出しはされません（それでも公開はしません）",
    test: "DSN の形式と、送信先への到達性（テスト用の記録は送りません）",
    fields: [
      { key: "SENTRY_DSN", label: "DSN", secret: true, placeholder: "https://abc123@o0.ingest.sentry.io/123456",
        pattern: /^https:\/\/[0-9a-f]+@.+\/\d+$/, patternHint: "https://<キー>@<ホスト>/<プロジェクトID> の形です" },
    ],
  },
  {
    id: "smtp", name: "SMTP（メール送信・自社サーバ）",
    what: "社内のメールサーバ経由での送信",
    where: "情報システム部門またはメールホスティングの管理画面",
    scope: "送信可能なアカウント",
    test: "この画面からは確認できません（SMTP はブラウザ経由で試せないため）。起動後に pnpm doctor と実送信で確認します",
    testable: false,
    fields: [
      { key: "SMTP_HOST", label: "ホスト", secret: false, placeholder: "smtp.example.co.jp" },
      { key: "SMTP_PORT", label: "ポート", secret: false, placeholder: "587", pattern: /^\d{1,5}$/, patternHint: "587（STARTTLS）や 465（SMTPS）が一般的です" },
      { key: "SMTP_USER", label: "ユーザー", secret: false },
      { key: "SMTP_PASS", label: "パスワード", secret: true },
      { key: "MAIL_FROM", label: "差出人", secret: false, placeholder: "no-reply@example.co.jp", pattern: /@/, patternHint: "メールアドレスの形式です" },
    ],
  },
  {
    id: "maps", name: "Google Maps（地図・住所検索）",
    what: "住所からの緯度経度取得、地図表示",
    where: "Google Cloud Console → API とサービス → 認証情報 → API キー",
    scope: "使う API（Geocoding / Maps JavaScript）を有効化し、キーに制限をかけます",
    test: "この画面からは行いません（呼び出しごとに課金されるため）。キーの制限設定を先に確認してください",
    testable: false,
    fields: [
      { key: "GOOGLE_MAPS_API_KEY", label: "API キー", secret: true, pattern: /^AIza/, patternHint: "AIza で始まります" },
    ],
  },
  {
    id: "slack", name: "Slack（通知）",
    what: "障害通知・承認依頼などの投稿",
    where: "Slack API → Your Apps → Incoming Webhooks",
    scope: "投稿先チャンネルごとに URL が発行されます",
    test: "URL が生きているか（メッセージは送りません）",
    fields: [
      { key: "SLACK_WEBHOOK_URL", label: "Webhook URL", secret: true, pattern: /^https:\/\/hooks\.slack\.com\//, patternHint: "https://hooks.slack.com/services/... の形です" },
    ],
  },
];

type Result = { ok: boolean; message: string; hint?: string };

export default function Page() {
  const [id, setId] = React.useState(SERVICES[0]!.id);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [result, setResult] = React.useState<Result | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [reveal, setReveal] = React.useState(false);
  const [ownSecrets, setOwnSecrets] = React.useState<Record<string, string>>({});

  /** 自前の秘密鍵をブラウザ内で作る（暗号論的に安全な乱数。どこにも送らない）。 */
  const generateOwn = () => {
    const gen = () => {
      const b = new Uint8Array(32);
      crypto.getRandomValues(b);
      return btoa(String.fromCharCode(...b)).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" }[c] ?? ""));
    };
    setOwnSecrets({ SESSION_SECRET: gen(), CSRF_SECRET: gen(), ENCRYPTION_SECRET: gen() });
  };

  const svc = SERVICES.find((s) => s.id === id)!;
  const set = (k: string, v: string) => { setValues((p) => ({ ...p, [k]: v })); setResult(null); };

  const filled = svc.fields.every((f) => (values[f.key] ?? (f.options ? f.options[0]!.value : "")).trim() !== "");
  const formatNg = svc.fields.filter((f) => {
    const v = values[f.key] ?? "";
    return v !== "" && f.pattern && !f.pattern.test(v);
  });

  const test = async () => {
    setBusy(true); setResult(null);
    const payload: Record<string, string> = {};
    for (const f of svc.fields) payload[f.key] = values[f.key] ?? (f.options ? f.options[0]!.value : "");
    try {
      const res = await fetch("/api/connect-test", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: svc.id, values: payload }),
      });
      setResult((await res.json()) as Result);
    } catch {
      setResult({ ok: false, message: "サーバに繋がりませんでした", hint: "デモサイトが起動しているか確認してください。" });
    } finally {
      setBusy(false);
    }
  };

  const envBlock = svc.fields
    .map((f) => `${f.key}=${values[f.key] ?? (f.options ? f.options[0]!.value : "")}`)
    .join("\n");

  return (
    <main style={{ maxWidth: 860, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 6 }}>外部サービス接続チェック</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 16 }}>
        連携に<strong>何が必要で・どこで取れて・いまの値で本当に通るのか</strong>を、その場で確かめられます。外部サービスに加えて、データベース・Redis・エラー収集の接続先も確認できます。
      </p>

      <div style={{ marginBottom: 16 }}>
        <Alert variant="warning" title="入力する前に">
          入力した値は<strong>保存しません</strong>（再読み込みで消えます）。形式の確認はブラウザの中だけで行います。
          「接続テスト」を押したときだけ、<strong>このデモサイト自身のサーバ</strong>へ送られ、相手のサービスへ1回だけ問い合わせます。
          サーバは値を記録もログ出力もせず、結果だけを返します。
          それでも不安な場合は、<strong>本番の鍵ではなくテスト用・サンドボックスの鍵</strong>で試してください。
        </Alert>
      </div>

      <div style={box}>
        <label style={{ ...lb, maxWidth: 320 }}>サービス
          <Select value={id} onChange={(e) => { setId(e.target.value); setValues({}); setResult(null); }}
            options={SERVICES.map((s) => ({ label: s.name, value: s.id }))} />
        </label>

        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 14, fontSize: 12.5 }}>
          <tbody>
            {[
              ["何ができるか", svc.what],
              ["どこで取るか", svc.where],
              ["必要な権限", svc.scope ?? "—"],
              ["テストの内容", svc.test],
            ].map(([k, v]) => (
              <tr key={k} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: "6px 10px 6px 0", color: "var(--color-muted)", whiteSpace: "nowrap", verticalAlign: "top" }}>{k}</td>
                <td style={{ padding: "6px 0", lineHeight: 1.8 }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={box}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>必要な値</span>
          <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, color: "var(--color-muted)" }}>
            <Checkbox  checked={reveal} onCheckedChange={(v) => setReveal(!!v)} />
            伏せ字を解除
          </label>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {svc.fields.map((f) => {
            const v = values[f.key] ?? (f.options ? f.options[0]!.value : "");
            const ng = v !== "" && f.pattern && !f.pattern.test(v);
            return (
              <label key={f.key} style={lb}>
                <span><code>{f.key}</code> — {f.label}</span>
                {f.options ? (
                  <Select value={v} onChange={(e) => set(f.key, e.target.value)} options={f.options} style={{ maxWidth: 240 }} />
                ) : (
                  <Input type={f.secret && !reveal ? "password" : "text"} value={values[f.key] ?? ""} placeholder={f.placeholder}
                    onChange={(e) => set(f.key, e.target.value)} autoComplete="off" spellCheck={false}
                    style={{ fontFamily: "monospace", borderColor: ng ? "var(--color-danger)" : undefined }} />
                )}
                {f.patternHint && (
                  <span style={{ fontSize: 11, color: ng ? "var(--color-danger)" : "var(--color-muted)" }}>
                    {ng ? `形式が違うようです： ${f.patternHint}` : f.patternHint}
                  </span>
                )}
              </label>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14, alignItems: "center" }}>
          {svc.testable === false
            ? <Badge variant="secondary">このサービスは形式の確認のみ</Badge>
            : <Button onClick={() => void test()} disabled={!filled || busy}>{busy ? "確認中…" : "接続テスト"}</Button>}
          <Button variant="secondary" onClick={() => { setValues({}); setResult(null); }}>入力を消す</Button>
          {formatNg.length > 0 && <Badge variant="warning">形式の注意 {formatNg.length} 件</Badge>}
          {!filled && <span style={{ fontSize: 12, color: "var(--color-muted)" }}>すべて入力すると押せます</span>}
        </div>
      </div>

      {result !== null && (
        <div style={{ marginBottom: 16 }}>
          <Alert variant={result.ok ? "success" : "danger"} title={result.ok ? "接続できました" : "接続できませんでした"}>
            {result.message}
            {result.hint && <div style={{ fontSize: 12, marginTop: 6 }}>{result.hint}</div>}
          </Alert>
        </div>
      )}

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>通ったら .env に書く</div>
        <pre style={{ ...mono, margin: 0, padding: 12, borderRadius: 6, background: "var(--color-bg)", border: "1px solid var(--color-border)", whiteSpace: "pre-wrap" }}>
{reveal ? envBlock : envBlock.replace(/=(.+)/g, (_m, v: string) => `=${v.length > 0 ? "•".repeat(Math.min(v.length, 24)) : ""}`)}
        </pre>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 8, lineHeight: 1.8 }}>
          値は <code>@platform/env</code> が起動時に検証します（<a href="/env" style={{ color: "var(--color-primary)" }}>/env</a>）。
          <code>.env</code> は<strong>リポジトリに入れません</strong>。本番の値はサーバの環境変数や鍵管理サービスへ入れ、
          <code>@platform/secrets</code> 経由で読みます。
        </p>
      </div>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>自分で用意する秘密（外部サービスではないもの）</div>
        <p style={{ fontSize: 12.5, color: "var(--color-muted)", lineHeight: 1.9, marginTop: 0 }}>
          セッション署名・CSRF 対策・項目の暗号化に使う鍵は、どこかから取得するものではなく<strong>自分で作ります</strong>。
          推測されない値である必要があるため、手で考えず乱数から作ってください。下のボタンは
          ブラウザの暗号用乱数で生成します（どこにも送信されません）。
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
          <Button size="sm" onClick={generateOwn}>3 つの鍵を生成</Button>
          {Object.keys(ownSecrets).length > 0 && (
            <Button size="sm" variant="secondary" onClick={() => { void navigator.clipboard.writeText(Object.entries(ownSecrets).map(([k, v]) => `${k}=${v}`).join("\n")); }}>コピー</Button>
          )}
        </div>
        {Object.keys(ownSecrets).length > 0 && (
          <pre style={{ ...mono, margin: 0, padding: 12, borderRadius: 6, background: "var(--color-bg)", border: "1px solid var(--color-border)", whiteSpace: "pre-wrap" }}>
{Object.entries(ownSecrets).map(([k, v]) => `${k}=${reveal ? v : "•".repeat(24)}`).join("\n")}
          </pre>
        )}
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 8, lineHeight: 1.8 }}>
          <strong>環境ごとに別の値</strong>にします（開発と本番で同じ鍵を使わない）。
          <code>ENCRYPTION_SECRET</code> を失うと、暗号化して保存した項目は<strong>二度と読めません</strong>。
          バックアップとは別の場所に保管してください（<code>docs/ops/BACKUP_RESTORE.md</code>）。
        </p>
      </div>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>覚えておくこと</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.9 }}>
          <li><strong>ブラウザから直接は叩けません</strong> — 相手が CORS を許可しておらず、シークレットも露出します。必ずサーバ経由にします</li>
          <li><strong>リフレッシュトークンは一度きり</strong> — 認可の直後にしか表示されないものが多く、失うと取り直しになります</li>
          <li><strong>サンドボックスと本番で鍵が違います</strong> — 取り違えると「動くのに反映されない」状態になります</li>
          <li><strong>鍵には期限があります</strong> — 切れたときに気づけるよう、失敗はログと通知に出します（<a href="/observability" style={{ color: "var(--color-primary)" }}>/observability</a>）</li>
          <li><strong>相手の API は変わります</strong> — 週次の契約テストで検知します（<code>docs/ops/CONTRACT_TESTING.md</code>）</li>
        </ul>
      </div>
    </main>
  );
}
