# 実装パターン集(AI向け)

新規実装時は**既存の同型コードを1つ開いて真似る**のが最短。ここでは代表パターンの雛形と参照先を示す。

## 1. ストア(memory + prisma 両実装)

参照: `apps/internal-app/src/server/report-preset.ts`(小さく典型的)

```ts
export interface XxxStore { list(): Promise<Xxx[]>; add(i: XxxInput): Promise<Xxx>; }
export function createMemoryXxxStore(): XxxStore { const items: Xxx[] = []; let seq = 0; /* 閉包でID採番 */ ... }
export interface XxxRow { id: string; ... }                 // Prisma行の最小形
export interface XxxStoreDb { xxxRow: { findMany(...): Promise<XxxRow[]>; create(...): ... } }  // 最小ポート
export function createPrismaXxxStore(db: XxxStoreDb): XxxStore { ... }
```

配線(platform-services.ts): `export const xxxStore: XxxStore = usePrisma ? createPrismaXxxStore(db as unknown as XxxStoreDb) : createMemoryXxxStore();`
Prisma: `apps/internal-app/prisma/schema.prisma` に model 追加 → `node tools/check-schema.mjs`。

## 2. API route(認可+観測+監査)

参照: `apps/internal-app/src/app/api/admin/report-schedule/route.ts`

```ts
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  // requirePermission(user, "xxx:read");  // 権限が要る場合
  return Response.json({ ... });
}
export const GET = withApiObservability("/api/xxx", handleGET);
```

動的セグメントは `ctx: { params: Promise<{ id: string }> }` で受け `await ctx.params`。cron入口は `X-Cron-Token` 検証(例: `api/admin/export-scan`)。書き込み系は `auditActions.record(user.email, "xxx.action", target, { after })`。

## 3. スモーク追加(tools/smoke.mjs)

結果行マーカーの直前にブロックを挿入。跨パッケージは実ソースを tmp へコピーし import を書換えて動的 import(既存ブロック多数が実例)。**相対importを既存モジュールへ足したら、そのファイルを合成している既存ブロックの書換えも必要**(過去に csv-import で発生)。

## 4. 通知・メール

- 文面: `notification-templates.ts`(4言語・管理者上書きは `resolveTemplates(await templateStore.get())` → `renderWithTemplates`)
- 差出人: `(await settingsStore.get()).mailFrom`(ハードコード禁止)
- 受信箱: `notificationStore.add(email, { title, body, createdAt })` / メール: `appMailer.sendMail({ to, from, subject, text })`

## 5. UI(Next.js App Router)

`page.tsx`(サーバ・metadata) + `xxx-client.tsx`("use client")の2ファイル構成。fetch は `fetchImpl ?? globalThis.fetch` で注入可能に。グラフは外部ライブラリを使わず**インラインSVG**(参照: dashboard-client.tsx の TrendChart)。ナビ導線は `components/AppNav.tsx`。

## 6. MCP ツールの足し方

参照: `apps/internal-app/src/server/mcp-tools.ts`(定義)+ `apps/internal-app/mcp/server.mts`(配線)

1. `McpToolDeps` に必要なストアの**最小形**を足す(実ストアが構造的に代入できる形)
2. `buildMcpTools()` にツールを追加: `{ name, description, inputSchema(JSON Schema), handler }`。引数は `str()/num()` で防御的に取り出し、失敗は `errorResult(理由)` で返す(throw しない)
3. `mcp/server.mts` で実ストアを渡す(新しい依存があれば import 追加)
4. スモークに「tools/list に載る・正常系・エラー系」を追加(mcp-tools はスタブ deps で合成テスト)

書き込み系ツールを足す場合は `auditActions.record` とセットにし、README のツール一覧も更新する。

## 7. 認証の最小移植(実例: apps/equipment-app)

新アプリに認証を足すときは internal-app から**2ファイル分を統合コピー**するだけでよい:

1. `zoho-session.ts`(HMAC 署名セッション)+ `password.ts`(scrypt)→ 新アプリの `src/server/auth.ts` に統合(equipment-app が実例)
2. `src/server/guard.ts` を作成: import 時に `seedUsers(env.ADMIN_PASSWORD)` を播種し、`requireUser(req)` を export
3. login route: `login()` → `signSession()` → `set-cookie: session=...; HttpOnly; SameSite=Lax; Max-Age=28800`。logout は Max-Age=0
4. 各 route の冒頭で `if (!requireUser(req)) return 401`

ユーザー台帳はメモリ播種で開始し、本番運用では internal-app の user-repo(Prisma)を移植する。

## 8. 子レコードと状態遷移(実例: 貸出/返却)

参照: `apps/equipment-app/src/server/equipment-repo.ts`

- 親(備品)と子(貸出履歴)は**別レコード**にし、「貸出中」は `returnedAt: null` の子が存在すること、と定義する(状態フラグを親に持たせない)
- 状態を変える操作(lend / giveBack)は `{ ok: true, ... } | { ok: false, error: string }` を返し、**業務ルール違反の理由を文言で持つ**(「貸出中です(借用者: 山田)」)
- route は `!r.ok → 409 { error }` に変換するだけ。UI はそのままエラー表示できる
- 一覧は子を1回だけ引いて Map で結合(N+1 回避)。履歴は新しい順

## 9. 環境変数の読み取り(process.env を直接読まない)

`process.env` を各所で直接読むと、未設定に気づけず「undefined 由来の謎バグ」になる。必ず `server/env.ts` に集約する。

```ts
// apps/<app>/src/server/env.ts
import { parseEnv, requireEnv, optionalEnv, assertSecretStrength, z } from "@platform/env";

// 1) スキーマ検証(起動時 fail-fast)。.describe() で説明を付けると .env.example 生成にも使える
export const env = parseEnv(z.object({
  DATABASE_URL: z.string().url().describe("接続先 PostgreSQL"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
}));

// 2) 秘密値: 本番は必須+強度チェック、開発は既定値で継続
function loadServerEnv() {
  if (process.env.NODE_ENV === "production") {
    const required = requireEnv(["SESSION_SECRET"]);           // 欠けたら CONFIG エラー
    assertSecretStrength(required, { isProduction: true });     // 弱い鍵なら起動失敗
    return required;
  }
  return { SESSION_SECRET: optionalEnv("SESSION_SECRET", "dev-secret-change-me") };
}
export const serverEnv = loadServerEnv();

// 3) 機能設定: 未設定なら無効/モックになるもの
export const featureEnv = {
  ANTHROPIC_API_KEY: optionalEnv("ANTHROPIC_API_KEY"),  // 未設定ならモック応答
  CRON_TOKEN: optionalEnv("CRON_TOKEN"),
};
```

使う側は `import { env, serverEnv, featureEnv } from "../server/env.js"`。`.env.example` への記載漏れ・残骸は `node tools/check-env-example.mjs` が検出する。

## 10. アプリにテーマ(スキン)を入れる

```ts
// apps/<app>/src/lib/theme-registry.ts
import { createThemeRegistry, builtInThemes } from "@platform/theme";
export const themeRegistry = createThemeRegistry({ themes: builtInThemes });
```

```tsx
// apps/<app>/src/app/layout.tsx
import { AppSkin, ThemeSwitcher } from "@platform/ui";
import { themeRegistry } from "../lib/theme-registry.js";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body style={{ background: "var(--color-bg)", color: "var(--color-fg)", fontFamily: "var(--font-family)" }}>
        <AppSkin registry={themeRegistry}>
          <header><ThemeSwitcher /></header>
          {children}
        </AppSkin>
      </body>
    </html>
  );
}
```

画面の色は **CSS 変数**で書く(`var(--color-primary, #2563eb)` のようにフォールバック付き)。ハードコードするとテーマ切り替えに追従しない。

独自スキンは `deriveTheme({ id, name, primary })` で主色から自動生成できる(light/dark 両方・コントラスト自動調整)。

## 11. 開発ポートの割り当て

`pnpm dev` は全アプリを**一斉起動**する。package.json の dev スクリプトに `--port` を必ず書く(無いと既定 3000 の取り合いになる)。

```json
{ "scripts": { "dev": "next dev --port 3006" } }
```

空きポートは `node tools/check-ports.mjs` で確認できる(重複・記載漏れ・ドキュメント不一致を検出)。新しいアプリを足したら `docs/APPS_AND_DEMOS.md` のポート表も更新すること。
