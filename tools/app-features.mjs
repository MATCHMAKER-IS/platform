/**
 * **`pnpm new-app` で選べる機能**の定義。
 *
 * 【なぜ差分方式にするか】
 * 機能ごとに**アプリを丸ごと用意する**と、雛形が 10 個に増えて
 * **全部を最新に保てなくなります**（片方だけ直って食い違う）。
 *
 * ここでは **`crud-template` に足す差分**だけを持ちます:
 *
 * - `deps` … `package.json` に足す依存
 * - `env` … `.env.example` に足す行
 * - `files` … 配置するファイル（中身は関数で作る）
 * - `readme` … アプリの README に足す説明
 *
 * **機能を増やすときは、この配列に 1 つ足すだけ**です。
 *
 * 【選ばなかった機能はどうなるか】
 * **何も入りません。** 後から足したくなったら、
 * `docs/ai/module-list.md` で部品を探して自分で繋いでください
 * ——ここにある差分は「**繋ぎ方の見本**」でもあります。
 *
 * 【なぜ 1 ファイルなのか】
 * **`check-maintainability` の「大きいファイル」に入っています**が、
 * **分割しません**。機能の定義が**同じ形で並んでいるだけ**なので、
 * 機能ごとにファイルを分けても**探しやすくなりません**
 * （`utils/numbers.ts` と同じ理由——関数の集まりは 1 つの方が見通せます）。
 *
 * **機能を増やすときは配列に 1 つ足すだけ**、という設計を保つ方が大事です。
 *
 * @packageDocumentation
 */

/**
 * 機能の一覧。
 *
 * **順番は「選ぶ確率が高い順」**にしています。対話で上から出るので、
 * よく使うものが上にある方が選びやすいためです。
 */
export const FEATURES = [
  {
    id: "login",
    category: "ログイン・権限",
    label: "ログイン（自前・メール + パスワード）",
    hint: "社内で完結する場合。SSO を使うなら不要です",
    // **`crypto` はパスワードの照合に要る。** 自前で比べると
    // `===` になり、**応答時間から 1 文字ずつ当てられます**
    // **`ui` は画面に要る**(雛形の依存に既に入っているが、明示しておく)
    deps: ["@platform/session", "@platform/crypto", "@platform/ui"],
    // **`env.ts` の schema にも足す。** `.env.example` だけ足しても、
    // **読み込み側が無ければ `undefined` になる**——2026-08 に実際そうなった。
    envSchema: [
      '    SESSION_SECRET: z.string().min(32).describe("セッションの署名鍵（32 文字以上）"),',
      '    SESSION_TTL_MINUTES: z.coerce.number().int().positive().default(480),',
    ],
    env: [
      "# セッションの署名鍵。**32 文字以上**を入れてください（起動時に検査します）",
      "SESSION_SECRET=dev-session-secret-change-me-32chars",
      "# セッションの有効期間（分）。既定 480 = 8 時間",
      "SESSION_TTL_MINUTES=480",
    ],
    files: {
      "src/server/session.ts": () => `/**
 * ログインの状態を保つ。
 *
 * **判定（この人はこれをしてよいか）は \`@platform/auth\` です。**
 * ここは「誰でログインしているか」だけを扱います。
 */
import { createAuthSession } from "@platform/session";

import { serverEnv } from "./env";

/**
 * セッションの入れ物。
 *
 * **クッキーは \`httpOnly\` + \`sameSite: lax\`** にしてあります
 * ——JavaScript から読めず、他サイトからの遷移では送られません。
 */
export const authSession = createAuthSession({
  secret: serverEnv.SESSION_SECRET,
  // **環境変数を直読みしない。** env.ts を通すと、
  // **起動時に型と必須を検査**できます（無いまま動いて後で落ちません）
  ttlMinutes: serverEnv.SESSION_TTL_MINUTES,
});
`,
      "src/app/login/page.tsx": () => `/**
 * ログイン画面。
 *
 * 【差し替えたいとき】
 * **このファイルを書き換えてください。** 基盤の部品
 * (\`LoginCard\` / \`EmailLoginForm\` / \`SocialLoginGroup\`)は
 * **使わなくても構いません**——独自の画面にしてよい場所です。
 *
 * ただし **\`/api/auth/login\` の入出力は変えない**でください。
 * 変えるなら \`src/app/api/auth/login/route.ts\` も一緒に直すこと
 * ——**片方だけ直すと、押しても何も起きない画面**になります。
 *
 * 【なぜ雛形に入れてあるか】
 * 社内アプリは**ほぼ必ずログインが要ります**。
 * 毎回ゼロから作ると、**アプリごとに見た目も安全性もばらつきます**
 * ——「このアプリだけパスワードが平文で飛ぶ」が起きるのは、こういうところです。
 */
import { LoginForm } from "./login-form";

export const metadata = { title: "ログイン" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <LoginForm />
    </main>
  );
}
`,
      "src/app/login/login-form.tsx": () => `"use client";
/**
 * ログインの入力部分。
 *
 * **画面を独自に作るなら、このファイルごと差し替えてください。**
 * 基盤の部品を使うかどうかは自由です。
 */
import * as React from "react";
import { LoginCard, EmailLoginForm } from "@platform/ui";

export function LoginForm() {
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const submit = async (values: { email: string; password: string }) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (res.ok) {
        // **画面遷移は \`location\` で行う。** クッキーが付いた状態で
        // サーバから引き直したいので、クライアント側のルーティングでは足りない
        window.location.href = "/";
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      // **理由を細かく分けない。** 「メールが違う」「パスワードが違う」を
      // 区別して見せると、**どのメールが登録済みか**を試せてしまう
      setError(body.error ?? "メールアドレスかパスワードが違います。");
    } catch {
      setError("通信できませんでした。少し待ってからもう一度お試しください。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <LoginCard
      title="ログイン"
      subtitle="社内のアカウントでログインしてください"
      // **SSO を使うなら \`providers\` を渡す**(sso 機能を選ぶと API が入ります)
      providers={[]}
      error={error}
    >
      <EmailLoginForm onSubmit={submit} loading={busy} showRemember />
    </LoginCard>
  );
}
`,
      "src/app/api/auth/login/route.ts": () => `/**
 * ログインを受け付ける。
 *
 * **画面を差し替えても、ここは残してください**——
 * 独自の画面から呼ぶときも、同じ入出力にしておけば繋ぎ替えが要りません。
 */
import { verifyPassword } from "@platform/crypto";
import { withApi } from "../../../../server/instrument";
import { authSession } from "../../../../server/session";

/**
 * 利用者を引く。
 *
 * **雛形では固定値です。** DB から引くように差し替えてください——
 * \`prisma/schema.prisma\` に利用者のモデルを足すところから始めます。
 */
async function findUser(email: string): Promise<{ id: string; passwordHash: string } | null> {
  // TODO: DB から引く。**このままでは誰もログインできません**(意図的)
  void email;
  return null;
}

/**
 * ログインを受け付ける。
 *
 * **\`withApi\` を通す。** 本文サイズの上限・CSRF・レート制限・記録が
 * まとめて入ります——**個別に書くと、必ずどれかを忘れます**。
 */
export const POST = withApi("auth.login", async (req: Request): Promise<Response> => {
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  if (typeof body.email !== "string" || typeof body.password !== "string") {
    return Response.json({ error: "メールアドレスとパスワードを入力してください。" }, { status: 400 });
  }

  const user = await findUser(body.email);
  // **理由を分けない。** 「そのメールは登録されていません」と返すと、
  // **どのアドレスが登録済みかを試せます**(利用者の一覧が漏れる)
  if (user === null || !verifyPassword(body.password, user.passwordHash)) {
    return Response.json({ error: "メールアドレスかパスワードが違います。" }, { status: 401 });
  }

  const cookie = authSession.write({ userId: user.id, roles: [] });
  return new Response(null, { status: 204, headers: { "Set-Cookie": cookie } });
});
`,
    },
    readme: `## ログイン

\`src/server/session.ts\` に入れ物があります。

**判定（この人はこれをしてよいか）は \`@platform/auth\`** です——
ログインの仕組みとは別に持ってください。

### 画面を独自に作りたいとき

**\`src/app/login/login-form.tsx\` を書き換えてください。**
基盤の部品（\`LoginCard\` / \`EmailLoginForm\`）は**使わなくて構いません**。

**\`/api/auth/login\` の入出力は変えない**でください
（\`{ email, password }\` を受け、成功なら 204 とクッキー）。
変えるなら API も一緒に直すこと——**片方だけ直すと、
押しても何も起きない画面**になります。

### まず最初にすること

**\`src/app/api/auth/login/route.ts\` の \`findUser\` は固定値**（常に null）です。
**このままでは誰もログインできません**——意図的にそうしてあります
（動くように見えて、実は誰でも入れる状態を作らないため）。
DB から引くように差し替えてください。

**セッションを失効させる仕組み**（\`createRevocationGate\`）もありますが、
**繋ぐと全リクエストに 1 往復増えます**。退職者を即座に止める必要が出てから
検討してください（基盤の \`docs/ops/HANDOVER.md\` に判断材料があります）。
`,
  },
  {
    id: "sso",
    category: "ログイン・権限",
    label: "SSO ログイン（Google / Microsoft）",
    hint: "会社が Google Workspace か Microsoft 365 を使っているなら",
    deps: ["@platform/session", "@platform/google", "@platform/microsoft"],
    envSchema: [
      "    GOOGLE_CLIENT_ID: z.string().optional(),",
      "    GOOGLE_CLIENT_SECRET: z.string().optional(),",
      "    MICROSOFT_CLIENT_ID: z.string().optional(),",
      "    MICROSOFT_CLIENT_SECRET: z.string().optional(),",
      "    OAUTH_REDIRECT_URL: z.string().url().optional(),",
    ],
    env: [
      "# SSO。**リダイレクト URL は提供元の管理画面にも登録**してください",
      "GOOGLE_CLIENT_ID=",
      "GOOGLE_CLIENT_SECRET=",
      "MICROSOFT_CLIENT_ID=",
      "MICROSOFT_CLIENT_SECRET=",
      "OAUTH_REDIRECT_URL=http://localhost:3000/api/auth/callback",
    ],
    files: {
      "src/app/api/auth/callback/route.ts": () => `// public-api: SSO の戻り先。**ログイン前に呼ばれる**ので認可は通せません。
// 代わりに **\`state\` の検証**で守ります——検証を飛ばすと、
// 攻撃者が用意した認可コードを踏まされます（CSRF）。
/**
 * SSO の戻り先。
 *
 * **\`state\` を必ず検証します**——検証しないと、
 * 攻撃者が用意した認可コードを踏まされます（CSRF）。
 */
import { verifyOAuthState } from "@platform/session";

import { withApiObservability } from "../../../../server/instrument";

async function handleGET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // **state の検証を飛ばさないこと。** 飛ばすと CSRF が通ります
  if (code === null || state === null || !verifyOAuthState(state)) {
    return Response.json({ error: "認証に失敗しました" }, { status: 400 });
  }

  // TODO: ここで提供元にトークンを問い合わせ、利用者を特定してセッションを張ります
  //   詳しくは基盤の \`packages/session/README.md\` を見てください
  return Response.redirect(new URL("/", req.url));
}

export const GET = withApiObservability("/api/auth/callback", handleGET);
`,
    },
    readme: `## SSO ログイン

\`src/app/api/auth/callback/route.ts\` が戻り先です。

**\`state\` の検証を飛ばさないでください。** 飛ばすと、
攻撃者が用意した認可コードを踏まされます（CSRF）。

**2 要素認証は提供元（IdP）に任せます**——アプリ側では持ちません
（基盤の ADR 0016）。

**外部への問い合わせは 10 秒で切れます。** 相手が応答しないとき、
**永久に待たない**ためです。
`,
  },
  {
    id: "zoho",
    category: "外部サービス連携",
    label: "Zoho ログイン・連携",
    hint: "Zoho CRM / Books を使っているなら",
    deps: ["@platform/session", "@platform/zoho"],
    envSchema: [
      "    ZOHO_CLIENT_ID: z.string().optional(),",
      "    ZOHO_CLIENT_SECRET: z.string().optional(),",
      "    ZOHO_REFRESH_TOKEN: z.string().optional(),",
      "    ZOHO_REGION: z.string().default(\"jp\"),",
    ],
    env: [
      "# Zoho。**リフレッシュトークンは 1 度しか表示されません**（控えてください）",
      "ZOHO_CLIENT_ID=",
      "ZOHO_CLIENT_SECRET=",
      "ZOHO_REFRESH_TOKEN=",
      "# データセンター。日本なら jp",
      "ZOHO_REGION=jp",
    ],
    files: {},
    readme: `## Zoho 連携

**リフレッシュトークンは 1 度しか表示されません。** 控えてください。

**\`ZOHO_REGION\` を間違えると 401 になります**（日本なら \`jp\`）。
「認証情報が違う」と見えますが、実際は**別のデータセンターを叩いています**。

一覧の全件取得（\`listAll\`）は**上限で打ち切ると黙って欠ける**ので、
基盤側で件数を数えて知らせるようにしてあります。
`,
  },
  {
    id: "mail",
    category: "通知",
    label: "メール送信",
    hint: "通知や帳票の送付に",
    deps: ["@platform/mail", "@platform/notify"],
    envSchema: [
      "    SMTP_HOST: z.string().default(\"localhost\"),",
      "    SMTP_PORT: z.coerce.number().int().positive().default(1025),",
      "    MAIL_FROM: z.string().email().optional(),",
    ],
    env: [
      "# メール。開発中は MailHog（docker compose で起動します）",
      "SMTP_HOST=localhost",
      "SMTP_PORT=1025",
      "MAIL_FROM=noreply@example.com",
    ],
    files: {},
    readme: `## メール送信

開発中は **MailHog**（\`docker compose up\` で起動）に届きます——
\`http://localhost:8025\` で見られます。**本物には飛びません**。

**送信は Outbox 経由**にしてください。直接送ると、
**失敗したときに「送ったか分からない」**状態になります。
Outbox なら再試行され、**諦めたときも記録が残ります**。
`,
  },
  {
    id: "upload",
    category: "ファイル・帳票",
    label: "ファイルのアップロード",
    hint: "添付・画像・帳票の保管",
    deps: ["@platform/upload", "@platform/storage", "@platform/bytes"],
    envSchema: [
      "    STORAGE_DIR: z.string().default(\"./.storage\"),",
      "    MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(26_214_400),",
    ],
    env: [
      "# 保管先。開発中はローカルのフォルダ",
      "STORAGE_DIR=./.storage",
      "MAX_UPLOAD_BYTES=26214400",
    ],
    files: {},
    readme: `## ファイルのアップロード

**保存した key はランダム**です——元のファイル名から推測できません。

**ダウンロードは \`Content-Disposition: attachment\`** で返します
（ブラウザで開かせない）。\`X-Content-Type-Options: nosniff\` も付きます。

**中身の種別が名乗りと違う場合は記録します**が、**保存は通します**
——拒むと**正しいファイルまで通らなくなる**ためです。

**写真の EXIF（撮影日時・位置情報）は残ります。** 消すなら
\`@platform/image\` で変換してください——**領収書を撮ってアップロードすると、
どこで撮ったかが残ります**。
`,
  },
  {
    id: "pdf",
    category: "ファイル・帳票",
    label: "PDF 帳票",
    hint: "請求書・報告書の出力",
    deps: ["@platform/pdf", "@platform/report"],
    env: [],
    files: {},
    readme: `## PDF 帳票

**Dockerfile に日本語フォントを入れてください。** 無いと**豆腐（□□□）**になります。

\`\`\`dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends fonts-noto-cjk
\`\`\`

**開発機には日本語フォントがある**ので、**本番のコンテナで初めて分かります**
——請求書が全部□で出てから気づくのは遅すぎます。

金額は \`formatYen\`、日付は \`formatDateJst\` を使ってください
（手で組むと **\`¥-500\` と \`-¥500\` が混ざります**）。
`,
  },
  {
    id: "notify",
    category: "通知",
    label: "Slack / LINE 通知",
    hint: "承認依頼や障害の連絡に",
    deps: ["@platform/slack", "@platform/notify"],
    envSchema: [
      "    SLACK_WEBHOOK_URL: z.string().url().optional(),",
    ],
    env: [
      "# Slack。Incoming Webhook の URL",
      "SLACK_WEBHOOK_URL=",
    ],
    files: {},
    readme: `## 通知

**何でも通知すると、通知を見なくなります。**

**「これが 1 件出たら誰かが動くか」**で分けてください。
動かないなら**メトリクスに留める**方が有効です
（基盤の \`docs/ops/INCIDENT_RESPONSE.md\` に基準があります）。
`,
  },
  {
    id: "apikey",
    category: "ログイン・権限",
    label: "API キー（外部から叩かせる）",
    hint: "他システムから API を呼ばせるなら",
    deps: ["@platform/apikey"],
    envSchema: [],
    env: [],
    files: {},
    readme: `## API キー

**キーは保存前にハッシュ化されます**——**DB が漏れても復元できません**。
利用者に見せられるのは**発行の瞬間だけ**なので、画面でそう伝えてください。

**比較は時間を一定にして行います**（\`timingSafeEqual\`）。
普通の比較だと、**応答時間の差から「何文字目まで合っていたか」が漏れます**。
`,
  },
  {
    id: "workflow",
    category: "仕組み",
    label: "承認フロー（申請 → 承認 → 差し戻し）",
    hint: "経費・稟議・休暇申請など",
    deps: ["@platform/workflow", "@platform/fsm"],
    envSchema: [],
    env: [],
    files: {},
    readme: `## 承認フロー

**状態の遷移は \`fsm\` で定義**します。許した遷移しか起きません
——「差し戻し済みなのに承認された」といった状態を**型で防ぎます**。

**承認が滞留すると業務が止まります。** 申請者は「まだ承認されない」、
承認者は「急ぎではない」と思ったまま——**誰も異常だと言いません**。
**件数と「一番古い日数」を測って**ください（基盤の \`business-metrics\` が見本です）。
`,
  },
  {
    id: "jobs",
    category: "仕組み",
    label: "定期実行（バッチ・夜間処理）",
    hint: "日次の集計・通知・取り込みなど",
    deps: ["@platform/jobs", "@platform/cron"],
    envSchema: [],
    env: [],
    files: {},
    readme: `## 定期実行

**排他ロックを必ず使ってください。** 2 台構成だと、
**両方のインスタンスが同じジョブを走らせます**（通知が 2 回届きます）。

**メモリ実装のロックは再起動で消えます。** 台数を増やす前に
Redis 実装（\`createRedisLockStore\`）へ移してください。

**失敗を数えてください。** 定期実行は「動いていて当たり前」なので、
**止まっても誰も報告してきません**。
`,
  },
  {
    id: "search",
    category: "検索・AI",
    label: "全文検索",
    hint: "社内文書・マスタの横断検索",
    deps: ["@platform/search"],
    envSchema: [],
    env: [],
    files: {},
    readme: `## 全文検索

**少量ならメモリ実装（BM25）で足ります**——索引を作らずその場で検索できます。

ただし**検索のたびに全件を読み込む**ので、増えたら
**DB の全文検索**（\`@platform/db\` の \`fullTextSearch\`）へ移してください。

**空文字・記号・長すぎる入力でも例外を出さず 0 件を返します**
——検索窓には何が入ってくるか分かりません。
`,
  },
  {
    id: "ai",
    category: "検索・AI",
    label: "AI（要約・分類・下書き）",
    hint: "提供者を差し替えられる形で使えます",
    deps: ["@platform/ai"],
    envSchema: [
      "    AI_PROVIDER: z.string().default(\"anthropic\"),",
      "    AI_API_KEY: z.string().optional(),",
      "    AI_MONTHLY_LIMIT_YEN: z.coerce.number().int().positive().default(10_000),",
    ],
    env: [
      "# AI。**上限を必ず入れてください**（青天井だと請求が跳ねます）",
      "AI_PROVIDER=anthropic",
      "AI_API_KEY=",
      "AI_MONTHLY_LIMIT_YEN=10000",
    ],
    files: {},
    readme: `## AI

**必ず AI Gateway 経由で呼んでください**（基盤の ADR 0010）。
直接叩くと、**伏せ字・上限・記録が効きません**。

**個人情報は送る前に伏せます。** 氏名・メール・電話は
\`@platform/pii\` が置き換えます——**送ってしまったら取り消せません**。

**上限を入れてください。** 青天井だと、**間違ったループで請求が跳ねます**。
`,
  },
  {
    id: "rag",
    category: "検索・AI",
    label: "社内文書の検索（RAG）",
    hint: "規程・マニュアルを AI に引かせる",
    deps: ["@platform/rag", "@platform/ai"],
    envSchema: [],
    env: [],
    files: {},
    readme: `## 社内文書の検索（RAG）

**開発中はメモリ実装 + ハッシュ Embedder** で動きます（外部に出ません）。
本番で使うなら pgvector へ移してください——手順は基盤の
\`docs/ops/RAG_PGVECTOR_MIGRATION.md\` にあります。

**引用元を必ず示してください。** 「どの規程の何条か」が分からないと、
**利用者は答えを信じられません**。
`,
  },
  {
    id: "chat",
    category: "コミュニケーション",
    label: "チャット（部屋・メンション・既読）",
    hint: "社内の連絡・相談に",
    deps: ["@platform/chat", "@platform/realtime"],
    envSchema: [],
    env: [],
    files: {},
    readme: `## チャット

**メッセージは増え続けます。** 一覧には必ず \`take\` を付けてください
——付けないと、**部屋を開くたびに全件を読み込みます**。

**宛先は都度 DB から引いてください。** 起動時に読み込む形だと、
**入社・退職が反映されません**。
`,
  },
  {
    id: "board",
    category: "コミュニケーション",
    label: "掲示板・FAQ",
    hint: "お知らせ・よくある質問",
    deps: ["@platform/board", "@platform/faq"],
    envSchema: [],
    env: [],
    files: {},
    readme: `## 掲示板・FAQ

**FAQ は「役に立った率」で見直し対象を選びます。**
率が低いものは、**答えが分かりにくいか、質問が的外れ**です。

**投票の同時更新は競合しえます**が、実害が小さいので基盤では見ていません
（1 票ずれる程度）。厳密に数えたいなら \`increment\` を使ってください。
`,
  },
  {
    id: "invoice",
    category: "業務ドメイン",
    label: "請求書・見積書",
    hint: "インボイス制度に対応しています",
    deps: ["@platform/invoice", "@platform/quote", "@platform/tax"],
    envSchema: [],
    env: [],
    files: {},
    readme: `## 請求書・見積書

**税率は型で縛られています**（\`10 | 8 | 0\`）——**0.1 を渡すと型エラー**です。
「率」には**比率（0〜1）とパーセント（0〜100）の 2 つの流儀**があり、
**取り違えると 100 倍ずれます**。

**承認されていない見積からは請求書を作れません**（例外になります）。

**金額は \`formatYen\` で表示**してください。手で組むと
**マイナスが \`¥-500\`** になります（帳簿の慣行は \`-¥500\`）。
`,
  },
  {
    id: "accounting",
    category: "業務ドメイン",
    label: "会計（仕訳・試算表）",
    hint: "freee 連携もできます",
    deps: ["@platform/accounting", "@platform/tax", "@platform/dencho"],
    envSchema: [],
    env: [],
    files: {},
    readme: `## 会計

**電子帳簿保存法の要件**（\`@platform/dencho\`）が入っています——
**保存期間は原則 7 年**で、**本人から消してと言われても消せません**
（基盤の ADR 0018）。

**内訳と合計は必ず一致させてください。** 丸めてから足すか、
足してから丸めるかで **1 円ずれます**。
`,
  },
  {
    id: "attendance",
    category: "業務ドメイン",
    label: "勤怠・給与",
    hint: "打刻・残業・有給の計算",
    deps: ["@platform/attendance", "@platform/payroll"],
    envSchema: [],
    env: [],
    files: {},
    readme: `## 勤怠・給与

**日付は JST で比べてください**（\`formatDateJst\`）。
UTC で切ると、**JST の 00:00〜08:59 に前日の扱いになります**——
**深夜の打刻が前日になります**。

**労働者名簿・賃金台帳は 5 年保存**です（労働基準法）。
`,
  },
  {
    id: "inventory",
    category: "業務ドメイン",
    label: "在庫・発注",
    hint: "入出庫の履歴から残高を出します",
    deps: ["@platform/inventory", "@platform/purchase"],
    envSchema: [],
    env: [],
    files: {},
    readme: `## 在庫・発注

**\`applyMovement\` は \`{ ok, movements }\` を返します。**
**\`ok\` を見ずに \`movements\` だけ使うと、出庫できていないのに成功したことになります**。

**一覧には並び順を指定してください**（SKU 順が業務の慣れに合います）。
指定しないと、**行を更新するたびに並びが変わります**。
`,
  },
  {
    id: "contract",
    category: "業務ドメイン",
    label: "契約管理",
    hint: "更新期限・解約通知の管理",
    deps: ["@platform/contract"],
    envSchema: [],
    env: [],
    files: {},
    readme: `## 契約管理

**解約通知の期限を過ぎると、望まない 1 年が自動更新されます。**
\`contractAlerts\` が**更新期限と解約通知期限の両方**を見るので、
**数を測って気づけるように**してください。
`,
  },
  {
    id: "cms",
    category: "コミュニケーション",
    label: "CMS（記事・お知らせ）",
    hint: "公開予約・下書きに対応",
    deps: ["@platform/cms", "@platform/blog"],
    envSchema: [],
    env: [],
    files: {},
    readme: `## CMS

**下書きはサーバに保存されます**——タブを閉じても消えません。

**画像は \`loading="lazy"\`** を付けてください。付けないと、
**一覧に 50 件並べば 50 枚を一度に取りに行きます**。
`,
  },
  {
    id: "line",
    category: "外部サービス連携",
    label: "LINE 連携",
    hint: "公式アカウントからの通知・応答",
    deps: ["@platform/line"],
    envSchema: [
      "    LINE_CHANNEL_SECRET: z.string().optional(),",
      "    LINE_CHANNEL_ACCESS_TOKEN: z.string().optional(),",
    ],
    env: [
      "# LINE。**署名検証に channel secret が要ります**",
      "LINE_CHANNEL_SECRET=",
      "LINE_CHANNEL_ACCESS_TOKEN=",
    ],
    files: {},
    readme: `## LINE 連携

**Webhook の署名を必ず検証してください。** 検証しないと、
**誰でも「LINE から来た」と偽って送れます**。

**応答は 1 分以内**に返してください——遅いと LINE 側が再送します。
`,
  },
  {
    id: "freee",
    category: "外部サービス連携",
    label: "freee 連携（会計）",
    hint: "仕訳の連携に",
    deps: ["@platform/freee"],
    envSchema: [
      "    FREEE_CLIENT_ID: z.string().optional(),",
      "    FREEE_CLIENT_SECRET: z.string().optional(),",
      "    FREEE_REFRESH_TOKEN: z.string().optional(),",
    ],
    env: [
      "# freee。**リフレッシュトークンは使うたびに変わります**（保存し直してください）",
      "FREEE_CLIENT_ID=",
      "FREEE_CLIENT_SECRET=",
      "FREEE_REFRESH_TOKEN=",
    ],
    files: {},
    readme: `## freee 連携

**リフレッシュトークンは使うたびに変わります。** 保存し直さないと、
**次回から認証に失敗します**。

**全件取得は上限で打ち切ります**（5,000 件）。**黙って切ると気づけない**ので、
超えたら例外で知らせます。
`,
  },
  {
    id: "importer",
    category: "ファイル・帳票",
    label: "CSV / Excel の取り込み",
    hint: "既存システムからの移行・一括登録",
    deps: ["@platform/importer", "@platform/xlsx"],
    envSchema: [],
    env: [],
    files: {},
    readme: `## 取り込み

**Excel で開くなら \`bom: true\`** を付けてください。付けないと
**日本語が化けます**（既定は \`false\`——他システムに渡すときはこちらが正解）。

**どの行が失敗したかを必ず示してください。** 「取り込みに失敗しました」
だけだと、**何を直せばよいか分かりません**。
`,
  },
  {
    id: "flags",
    category: "仕組み",
    label: "段階公開（フィーチャーフラグ）",
    hint: "一部の人にだけ先に出す",
    deps: ["@platform/flags"],
    envSchema: [],
    env: [],
    files: {},
    readme: `## 段階公開

**\`flagName\` を必ず渡してください。** 省略すると
**すべてのフラグで同じ集団が選ばれます**——「いつも同じ人が実験台」になり、
**その人たちだけが未検証の機能を次々に踏みます**。

**省略しても動く**ので、気づきにくい種類です。
`,
  },
  {
    id: "i18n",
    category: "仕組み",
    label: "多言語（ja / en / ko / zh）",
    hint: "外国籍の従業員がいるなら",
    deps: ["@platform/i18n"],
    envSchema: [],
    env: [],
    files: {},
    readme: `## 多言語

**訳の抜けは検査で見つかります**（\`pnpm i18n:check\`）。

**日付と金額は言語で形が変わります。** \`formatDateJst\` /
\`formatYen\` はロケールを受け取れるので、**手で組まないでください**。
`,
  },
];

/**
 * 既定で入れる機能。
 *
 * **何も選ばなくても動く**ようにしてあります——
 * `--yes` で作ると、DB と認可だけの最小構成になります
 * （これは `crud-template` にもとから入っています）。
 */
export const DEFAULT_FEATURES = [];
