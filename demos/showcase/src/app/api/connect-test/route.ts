// public-api: デモ用。資格情報は保存せず、その場で 1 回試すだけ
/**
 * 外部サービスの資格情報を、その場で1回だけ試すための入口。
 *
 * ここは**デモサイト自身のサーバ**で動く。ブラウザから外部 SaaS を直接叩けない理由は2つある。
 *  1. CORS  … 相手のサーバがブラウザからの呼び出しを許可していない
 *  2. 秘密の露出 … クライアントシークレットを画面側に置くと、誰でも見られる
 * そのため「サーバがユーザーの代わりに1回だけ叩く」形にしている。
 *
 * 守っていること:
 *  - 受け取った資格情報を**保存しない**（DB もファイルも書かない）
 *  - **ログに出さない**（値はもちろん、伏せた形でも書かない）
 *  - 返すのは「通ったか / 通らなかった理由」だけ。相手の応答本文は返さない
 *  - 読み取り系の最小の呼び出しだけを行う（作成・更新はしない）
 */
import { NextResponse } from "next/server";
import net from "node:net";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { service?: string; values?: Record<string, string> };
type Check = { ok: boolean; message: string; hint?: string };

const TIMEOUT_MS = 10_000;

/** 相手が応答しないときに待ち続けないための fetch。 */
async function call(url: string, init: RequestInit): Promise<Response> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ac.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

/** HTTP ステータスから、利用者が次にやることが分かる日本語を作る。 */
function explain(status: number): { message: string; hint: string } {
  if (status === 401) return { message: "認証に失敗しました（401）", hint: "鍵の値が違うか、期限切れです。発行し直してください。" };
  if (status === 403) return { message: "権限がありません（403）", hint: "スコープ（許可する操作の範囲）が足りていない可能性があります。" };
  if (status === 404) return { message: "宛先が見つかりません（404）", hint: "サンドボックスと本番でホスト名が異なることがあります。" };
  if (status === 429) return { message: "呼びすぎです（429）", hint: "しばらく待ってから試してください。" };
  if (status >= 500) return { message: `相手側でエラーが出ています（${status}）`, hint: "こちらの設定ではなく、相手のサービス障害の可能性があります。" };
  return { message: `想定外の応答です（${status}）`, hint: "値の綴りに誤りがないか確認してください。" };
}

/** ホスト:ポートに TCP で到達できるかだけを見る（認証は行わない）。 */
function tcpProbe(host: string, port: number, timeoutMs = TIMEOUT_MS): Promise<{ ok: boolean; reason?: string }> {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host, port });
    const done = (r: { ok: boolean; reason?: string }) => { sock.destroy(); resolve(r); };
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => done({ ok: true }));
    sock.once("timeout", () => done({ ok: false, reason: "応答がありません（ファイアウォールで塞がれている可能性）" }));
    sock.once("error", (e: NodeJS.ErrnoException) => {
      const reason = e.code === "ECONNREFUSED" ? "接続を拒否されました（サービスが起動していない可能性）"
        : e.code === "ENOTFOUND" ? "ホスト名を解決できません"
        : "接続できません";
      done({ ok: false, reason });
    });
  });
}

/** Redis に PING を送って PONG が返るかを見る（必要なら AUTH も行う）。 */
function redisPing(host: string, port: number, user: string, pass: string): Promise<Check> {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host, port });
    let buf = "";
    const done = (c: Check) => { sock.destroy(); resolve(c); };
    sock.setTimeout(TIMEOUT_MS);
    sock.once("timeout", () => done({ ok: false, message: "応答がありません", hint: "ホストとポート、ファイアウォールを確認してください。" }));
    sock.once("error", (e: NodeJS.ErrnoException) => done({
      ok: false,
      message: e.code === "ECONNREFUSED" ? "接続を拒否されました" : e.code === "ENOTFOUND" ? "ホスト名を解決できません" : "接続できません",
      hint: "Redis が起動しているか、URL が正しいかを確認してください。",
    }));
    sock.once("connect", () => {
      // RESP: 認証が要る構成なら AUTH を先に送る
      if (pass !== "") sock.write(user !== "" ? `AUTH ${user} ${pass}\r\n` : `AUTH ${pass}\r\n`);
      sock.write("PING\r\n");
    });
    sock.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      if (buf.includes("+PONG")) done({ ok: true, message: "接続でき、応答がありました（PONG）" });
      else if (buf.includes("NOAUTH")) done({ ok: false, message: "認証が必要です", hint: "URL にパスワードを含めてください（redis://:パスワード@ホスト:6379）。" });
      else if (buf.includes("WRONGPASS") || buf.includes("ERR invalid password")) done({ ok: false, message: "パスワードが違います", hint: "Redis の requirepass 設定を確認してください。" });
      else if (buf.includes("-ERR")) done({ ok: false, message: "サーバがエラーを返しました", hint: buf.split("\r\n")[0]?.slice(0, 80) ?? "" });
    });
  });
}

const TESTERS: Record<string, { needs: string[]; run: (v: Record<string, string>) => Promise<Check> }> = {
  // freee: リフレッシュトークンからアクセストークンを取り直せるかを見る
  freee: {
    needs: ["FREEE_CLIENT_ID", "FREEE_CLIENT_SECRET", "FREEE_REFRESH_TOKEN"],
    async run(v) {
      const res = await call("https://accounts.secure.freee.co.jp/public_api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: v.FREEE_CLIENT_ID!, client_secret: v.FREEE_CLIENT_SECRET!, refresh_token: v.FREEE_REFRESH_TOKEN!,
        }),
      });
      if (res.ok) return { ok: true, message: "アクセストークンを取得できました" };
      const e = explain(res.status);
      return { ok: false, message: e.message, hint: e.hint };
    },
  },

  // Google: リフレッシュトークンの交換
  google: {
    needs: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"],
    async run(v) {
      const res = await call("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: v.GOOGLE_CLIENT_ID!, client_secret: v.GOOGLE_CLIENT_SECRET!, refresh_token: v.GOOGLE_REFRESH_TOKEN!,
        }),
      });
      if (res.ok) return { ok: true, message: "アクセストークンを取得できました" };
      const e = explain(res.status);
      return { ok: false, message: e.message, hint: e.hint };
    },
  },

  // PayPal: client_credentials でトークンが取れるか
  paypal: {
    needs: ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_ENV"],
    async run(v) {
      const host = v.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
      const basic = Buffer.from(`${v.PAYPAL_CLIENT_ID}:${v.PAYPAL_CLIENT_SECRET}`).toString("base64");
      const res = await call(`${host}/v1/oauth2/token`, {
        method: "POST",
        headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: "grant_type=client_credentials",
      });
      if (res.ok) return { ok: true, message: `トークンを取得できました（${v.PAYPAL_ENV === "live" ? "本番" : "サンドボックス"}）` };
      const e = explain(res.status);
      return { ok: false, message: e.message, hint: e.hint };
    },
  },

  // Stripe: 残高の参照(読み取りのみ)で鍵の有効性を見る
  stripe: {
    needs: ["STRIPE_SECRET_KEY"],
    async run(v) {
      const key = v.STRIPE_SECRET_KEY!;
      const res = await call("https://api.stripe.com/v1/balance", { headers: { Authorization: `Bearer ${key}` } });
      if (res.ok) return { ok: true, message: `鍵は有効です（${key.startsWith("sk_live") ? "本番" : "テスト"}）` };
      const e = explain(res.status);
      return { ok: false, message: e.message, hint: e.hint };
    },
  },

  // Microsoft: リフレッシュトークンからアクセストークンを取り直せるか
  microsoft: {
    needs: ["MICROSOFT_TENANT_ID", "MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "MICROSOFT_REFRESH_TOKEN"],
    async run(v) {
      const res = await call(`https://login.microsoftonline.com/${encodeURIComponent(v.MICROSOFT_TENANT_ID!)}/oauth2/v2.0/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: v.MICROSOFT_CLIENT_ID!,
          client_secret: v.MICROSOFT_CLIENT_SECRET!,
          refresh_token: v.MICROSOFT_REFRESH_TOKEN!,
        }),
      });
      if (res.ok) return { ok: true, message: "アクセストークンを取得できました" };
      const e = explain(res.status);
      return {
        ok: false,
        message: e.message,
        hint: res.status === 400 ? "テナント ID・クライアント ID・リフレッシュトークンの組み合わせを確認してください（リフレッシュトークンは回転するため、古い値は使えません）。" : e.hint,
      };
    },
  },

  // Slack Web API: 認証情報の確認(投稿はしない)
  "slack-api": {
    needs: ["SLACK_BOT_TOKEN"],
    async run(v) {
      const res = await call("https://slack.com/api/auth.test", {
        method: "POST",
        headers: { Authorization: `Bearer ${v.SLACK_BOT_TOKEN}`, "Content-Type": "application/json; charset=utf-8" },
        body: "{}",
      });
      // Slack は失敗でも HTTP 200 を返す。本文の ok を見る
      const json = (await res.json()) as { ok?: boolean; error?: string; team?: string };
      if (json.ok) return { ok: true, message: `接続できました（ワークスペース: ${json.team ?? "不明"}）` };
      return {
        ok: false,
        message: `トークンが無効です（${json.error ?? "unknown"}）`,
        hint: json.error === "invalid_auth" ? "トークンを再発行してください。xoxb- で始まるボットトークンが必要です。" : "権限（スコープ）が足りない可能性があります。",
      };
    },
  },

  // Notion: 自分（インテグレーション）の情報を引く
  notion: {
    needs: ["NOTION_TOKEN"],
    async run(v) {
      const res = await call("https://api.notion.com/v1/users/me", {
        headers: { Authorization: `Bearer ${v.NOTION_TOKEN}`, "Notion-Version": "2022-06-28" },
      });
      if (res.ok) return { ok: true, message: "トークンは有効です（連携先の共有設定は別途確認してください）" };
      const e = explain(res.status);
      return {
        ok: false,
        message: e.message,
        hint: res.status === 401 ? "トークンを確認してください。ntn_ または secret_ で始まります。" : e.hint,
      };
    },
  },

  // Zoho: 現在のユーザー情報を引く(読み取りのみ)
  zoho: {
    needs: ["ZOHO_API_DOMAIN", "ZOHO_ACCESS_TOKEN"],
    async run(v) {
      const domain = v.ZOHO_API_DOMAIN!.replace(/\/+$/, "");
      const res = await call(`${domain}/crm/v6/users?type=CurrentUser`, {
        headers: { Authorization: `Zoho-oauthtoken ${v.ZOHO_ACCESS_TOKEN}` },
      });
      if (res.ok) return { ok: true, message: "Zoho CRM に接続できました" };
      const e = explain(res.status);
      return { ok: false, message: e.message, hint: res.status === 401 ? "アクセストークンは1時間で切れます。リフレッシュトークンから取り直してください。" : e.hint };
    },
  },

  // Resend: 送信元ドメインの一覧を引く(送信はしない)
  resend: {
    needs: ["RESEND_API_KEY"],
    async run(v) {
      const res = await call("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${v.RESEND_API_KEY}` } });
      if (res.ok) return { ok: true, message: "API キーは有効です（メールは送っていません）" };
      const e = explain(res.status);
      return { ok: false, message: e.message, hint: e.hint };
    },
  },

  // Meilisearch: 自前で立てる検索エンジン。health は鍵不要なので keys で権限まで見る
  meilisearch: {
    needs: ["MEILISEARCH_HOST", "MEILISEARCH_API_KEY"],
    async run(v) {
      const host = v.MEILISEARCH_HOST!.replace(/\/+$/, "");
      const health = await call(`${host}/health`, {});
      if (!health.ok) return { ok: false, message: "サーバに繋がりません", hint: "URL と、Meilisearch が起動しているかを確認してください。" };
      const res = await call(`${host}/keys`, { headers: { Authorization: `Bearer ${v.MEILISEARCH_API_KEY}` } });
      if (res.ok) return { ok: true, message: "接続でき、鍵も有効です" };
      const e = explain(res.status);
      return { ok: false, message: `サーバには繋がりましたが、${e.message}`, hint: "マスターキーを確認してください。" };
    },
  },

  // LINE: チャネルアクセストークンで自分のボット情報を引く
  line: {
    needs: ["LINE_CHANNEL_ACCESS_TOKEN"],
    async run(v) {
      const res = await call("https://api.line.me/v2/bot/info", { headers: { Authorization: `Bearer ${v.LINE_CHANNEL_ACCESS_TOKEN}` } });
      if (res.ok) return { ok: true, message: "チャネルに接続できました" };
      const e = explain(res.status);
      return { ok: false, message: e.message, hint: e.hint };
    },
  },

  // Anthropic: モデル一覧の取得(読み取りのみ。生成しないので費用は発生しない)
  anthropic: {
    needs: ["ANTHROPIC_API_KEY"],
    async run(v) {
      const res = await call("https://api.anthropic.com/v1/models", {
        headers: { "x-api-key": v.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
      });
      if (res.ok) return { ok: true, message: "API キーは有効です（生成は行っていません）" };
      const e = explain(res.status);
      return { ok: false, message: e.message, hint: res.status === 401 ? "鍵が無効か、失効しています。" : e.hint };
    },
  },

  // Redis: PING を送って PONG が返るか（実際のプロトコルで確認）
  redis: {
    needs: ["REDIS_URL"],
    async run(v) {
      let u: URL;
      try { u = new URL(v.REDIS_URL!); } catch { return { ok: false, message: "URL の形式が違います", hint: "redis://ホスト:6379 の形です。" }; }
      if (!/^rediss?:$/.test(u.protocol)) return { ok: false, message: "redis:// で始まる必要があります" };
      if (u.protocol === "rediss:") return { ok: false, message: "TLS 接続（rediss://）はこの画面では確認できません", hint: "サーバ側の起動時に確認してください。" };
      return await redisPing(u.hostname, Number(u.port || 6379), decodeURIComponent(u.username), decodeURIComponent(u.password));
    },
  },

  // PostgreSQL: 到達性のみ（認証はドライバが必要なため、ここでは行わない）
  postgres: {
    needs: ["DATABASE_URL"],
    async run(v) {
      let u: URL;
      try { u = new URL(v.DATABASE_URL!); } catch { return { ok: false, message: "URL の形式が違います", hint: "postgresql://ユーザー:パスワード@ホスト:5432/データベース名 の形です。" }; }
      if (!/^postgres(ql)?:$/.test(u.protocol)) return { ok: false, message: "postgresql:// で始まる必要があります" };
      if (u.username === "" || u.pathname.replace("/", "") === "") {
        return { ok: false, message: "ユーザー名またはデータベース名がありません", hint: "postgresql://ユーザー:パスワード@ホスト:5432/データベース名" };
      }
      const probe = await tcpProbe(u.hostname, Number(u.port || 5432));
      if (!probe.ok) return { ok: false, message: probe.reason ?? "接続できません", hint: "ホスト・ポート・ネットワーク経路を確認してください。" };
      return {
        ok: true,
        message: `${u.hostname}:${u.port || 5432} に到達できました（形式も正しいです）`,
        hint: "ここで確認できるのは経路までです。ユーザー名やパスワードの正しさは、起動時（pnpm db）に検証されます。",
      };
    },
  },

  // Sentry: DSN の形式のみ（テスト用の記録を相手のプロジェクトへ送らないため）
  sentry: {
    needs: ["SENTRY_DSN"],
    async run(v) {
      const m = /^https:\/\/([0-9a-f]+)@([^/]+)\/(\d+)$/.exec(v.SENTRY_DSN!.trim());
      if (!m) return { ok: false, message: "DSN の形式が違います", hint: "https://<キー>@<ホスト>/<プロジェクトID> の形です。" };
      const probe = await tcpProbe(m[2]!.split(":")[0]!, 443);
      if (!probe.ok) return { ok: false, message: `送信先に到達できません（${m[2]}）`, hint: probe.reason };
      return {
        ok: true,
        message: `形式は正しく、送信先（${m[2]}）に到達できます`,
        hint: "テスト用の記録は送っていません。実際の疎通はアプリ起動後、わざとエラーを出して確認してください。",
      };
    },
  },

  // Slack: Incoming Webhook の URL が生きているか(投稿はせず、空要求で判定)
  slack: {
    needs: ["SLACK_WEBHOOK_URL"],
    async run(v) {
      const url = v.SLACK_WEBHOOK_URL!;
      if (!/^https:\/\/hooks\.slack\.com\//.test(url)) {
        return { ok: false, message: "URL の形式が違います", hint: "https://hooks.slack.com/services/... の形である必要があります。" };
      }
      const res = await call(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const text = await res.text();
      // 空要求は "invalid_payload" が返る = URL 自体は生きている
      if (text.includes("invalid_payload")) return { ok: true, message: "URL は有効です（メッセージは送っていません）" };
      if (text.includes("no_service") || res.status === 404) return { ok: false, message: "この URL は無効です（404）", hint: "Webhook を作り直してください。" };
      const e = explain(res.status);
      return { ok: false, message: e.message, hint: e.hint };
    },
  },
};

export async function POST(req: Request): Promise<Response> {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, message: "要求の形式が不正です" }, { status: 400 });
  }

  const tester = TESTERS[body.service ?? ""];
  if (!tester) {
    return NextResponse.json({ ok: false, message: "対応していないサービスです" }, { status: 400 });
  }

  const values = body.values ?? {};
  const missing = tester.needs.filter((k) => !values[k]?.trim());
  if (missing.length > 0) {
    return NextResponse.json({ ok: false, message: `未入力の項目があります: ${missing.join(", ")}` }, { status: 400 });
  }

  try {
    const result = await tester.run(values);
    return NextResponse.json(result);
  } catch (e) {
    // 例外の内容に資格情報が混ざらないよう、種類だけを返す
    const aborted = e instanceof Error && e.name === "AbortError";
    return NextResponse.json({
      ok: false,
      message: aborted ? "相手が時間内に応答しませんでした" : "接続できませんでした",
      hint: aborted ? "ネットワークまたは相手の障害の可能性があります。" : "このサーバから外部への通信が許可されているか確認してください。",
    });
  }
}
