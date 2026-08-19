# 実装パターン集(AI向け)

> **この資料は手書きです。** `pnpm gen:all` では更新されません（同じ `docs/ai/` に生成物が混ざっています）。

新規実装時は**既存の同型コードを1つ開いて真似る**のが最短。ここでは代表パターンの雛形と参照先を示す。

> ⚠️ **ただし UI だけは既存を真似ないこと。**
> 既存コードの多くが生の `<button>` / `<input>` を Tailwind 直書きで使っている(移行中)。
> **真似ると同じ負債が増える。** UI 部品は必ず `@platform/ui` を使う(下記 0 節)。

## 0. UI 部品は `@platform/ui` を使う ★最初に読む

参照: `apps/showcase/src/app/ui/page.tsx`(全部品の一覧) /
`apps/showcase/src/app/inquiries/register-demo.tsx`(フォームの実例)

```tsx
// ❌ 生タグ + inline style / Tailwind 直書き
<button className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white">保存</button>
<input className="rounded border px-2 py-1 text-sm" />
<select className="..."><option>A</option></select>

// ✅ 基盤の部品
import { Button, Input, Select, Textarea, NumberInput } from "@platform/ui";
<Button>保存</Button>
<Button variant="secondary" size="sm">戻る</Button>
<Input placeholder="氏名" />
<Select placeholder="部署" options={[{ label: "営業", value: "s" }]} />
```

| 用途 | 部品 |
|---|---|
| ボタン | `Button`(`variant`: primary/secondary/ghost/danger、`size`: sm/md/lg) |
| 文字入力 | `Input` / `Textarea` / `PasswordInput` |
| 数値 | `NumberInput` |
| 選択 | `Select` / `Combobox` / `Checkbox` / `Radio` / `Switch` |
| 日付・色・範囲 | `DatePicker` / `ColorPicker` / `Slider` |
| タグ | `TagInput` |

**なぜか**: 生タグだとサイズが基盤に追従せず、固定色はスキン切替で変わらず、
フォーカスリングやアクセシビリティの修正が全アプリへの一括修正になる。

**無い部品が必要なら、アプリで自作せず基盤に足す。**
UI 部品は定義上どのアプリでも使うので、「このアプリだけか」を悩む必要はない。

> 検査: `node tools/check-app-rules.mjs` が生タグを警告する。

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

### ファイルの分け方

`page.tsx`(サーバ・metadata) + `xxx-client.tsx`(`"use client"`)の 2 ファイル構成にする。
fetch は `fetchImpl ?? globalThis.fetch` で注入可能にしておく(テストで差し替えられる)。
ナビ導線は `components/AppNav.tsx`。

### サーバとブラウザの境界(最初に必ず詰まるところ)

App Router のファイルは**既定でサーバ側**で動く。ブラウザでしかできないことを書くと動かない。

| やりたいこと | 置く場所 |
|---|---|
| `useState` / `useEffect` / `onClick` | `"use client"` を先頭に書いたファイル |
| DB アクセス・秘密情報・`process.env` | サーバ側(`page.tsx` や `src/server/`) |
| `window` / `localStorage` / `navigator` | クライアント側。かつ**初回描画では触らない**(サーバに存在しない) |

**`"use client"` はファイルの 1 行目**に書く(コメントより前でもよいが、import より後ろだと効かない)。
境界を越えて渡せるのは**素の値だけ**。関数やクラスのインスタンスは渡せない。

`params` と `searchParams` は **Promise**(Next.js 15 以降)。`await` を忘れると型は通るのに実行時に壊れる。

```tsx
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;      // ← await が要る
}
```

### グラフは `@platform/ui` を使う(自前で描かない)

```tsx
import { BarChart, LineChart, ComboChart } from "@platform/ui";

<ComboChart title="売上と利益率" data={monthly} xKey="month"
  series={[{ key: "売上", type: "bar" }, { key: "利益率", type: "line" }]} unit="万円" toggleable />
```

棒 / 折れ線 / 複合 / 円 / レーダー / 散布 / ガント / ヒートマップなど **20 種類**ある。
一覧と動く実例は `/charts` デモ。

**インライン SVG で描かないこと。** 目盛・凡例・ツールチップ・レスポンシブを毎回作り直すことになり、
そのたびにどれかが抜ける。色も直書きになりやすく、テーマ切り替えに追従しない。

> この節は以前「グラフは外部ライブラリを使わずインライン SVG」と**逆のことを書いていた**。
> その結果 internal-app は基盤のグラフを 1 つも使わず、4 画面を手書きしている(移行中)。
> 増やさないよう `node tools/check-handmade-chart.mjs` が見張っている。

### 部品が無いときは

生の `<button>` / `<input>` を書く前に `@platform/ui` を探す(`search_platform` / ポータル)。
無ければ**アプリで自作せず基盤に足す**(CLAUDE.md「UI 部品は `@platform/ui` を使う」)。

## 6. MCP ツールの足し方

参照: `apps/internal-app/src/server/mcp-tools.ts`(定義)+ `apps/internal-app/mcp/server.mts`(配線)

1. `McpToolDeps` に必要なストアの**最小形**を足す(実ストアが構造的に代入できる形)
2. `buildMcpTools()` にツールを追加: `{ name, description, inputSchema(JSON Schema), handler }`。引数は `str()/num()` で防御的に取り出し、失敗は `errorResult(理由)` で返す(throw しない)
3. `mcp/server.mts` で実ストアを渡す(新しい依存があれば import 追加)
4. スモークに「tools/list に載る・正常系・エラー系」を追加(mcp-tools はスタブ deps で合成テスト)

書き込み系ツールを足す場合は `auditActions.record` とセットにし、README のツール一覧も更新する。

## 7. 認証の最小移植(実例: apps/line-console)

新アプリに認証を足すときは internal-app から**2ファイル分を統合コピー**するだけでよい:

1. `zoho-session.ts`(HMAC 署名セッション)+ `password.ts`(scrypt)→ 新アプリの `src/server/auth.ts` に統合(line-console が実例)
2. `src/server/guard.ts` を作成: import 時に `seedUsers(env.ADMIN_PASSWORD)` を播種し、`requireUser(req)` を export
3. login route: `login()` → `signSession()` → `set-cookie: session=...; HttpOnly; SameSite=Lax; Max-Age=28800`。logout は Max-Age=0
4. 各 route の冒頭で `if (!requireUser(req)) return 401`

ユーザー台帳はメモリ播種で開始し、本番運用では internal-app の user-repo(Prisma)を移植する。

## 8. 子レコードと状態遷移(実例: 貸出/返却)

参照: `apps/internal-app/src/server/equipment/repo.ts`

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

```tsx
// apps/<app>/src/app/layout.tsx
import { AppSkin, ThemeSwitcher } from "@platform/ui";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body style={{ background: "var(--color-bg)", color: "var(--color-fg)", fontFamily: "var(--font-family)" }}>
        <AppSkin>
          <header><ThemeSwitcher /></header>
          {children}
        </AppSkin>
      </body>
    </html>
  );
}
```

> **レジストリをアプリ側で作って渡さないこと。** `createThemeRegistry()` の戻り値は
> 関数の塊で、Server Component(layout.tsx)から Client Component へ props で渡すと
> RSC のシリアライズを通れず、**`next build` で全ページが落ちる**
> (`Functions cannot be passed directly to Client Components`)。dev では動くので気づけない。
> `AppSkin` が client 側で組み立てるので、`lib/theme-registry.ts` は不要。

組織のカスタムテーマ(DB から読むなど)を足す場合。`Theme` はプレーンデータなので
**サーバから直接渡してよい**:

```tsx
const customThemes = await getCustomThemes();   // Theme[]

<AppSkin themes={[...builtInThemes, ...customThemes]} defaultSkinId={setting.skinId} defaultMode={setting.mode}>
```

画面の色は **CSS 変数**で書く(`var(--color-primary, #2563eb)` のようにフォールバック付き)。ハードコードするとテーマ切り替えに追従しない。

独自スキンは `deriveTheme({ id, name, primary })` で主色から自動生成できる(light/dark 両方・コントラスト自動調整)。

## 11. 開発ポートの割り当て

`pnpm dev` は全アプリを**一斉起動**する。package.json の dev スクリプトに `--port` を必ず書く(無いと既定 3000 の取り合いになる)。

```json
{ "scripts": { "dev": "next dev --port 3006" } }
```

空きポートは `node tools/check-ports.mjs` で確認できる(重複・記載漏れ・ドキュメント不一致を検出)。新しいアプリを足したら `docs/APPS_AND_DEMOS.md` のポート表も更新すること。

## 12. ポップアップ(モーダル)

画面が開閉の状態を持つなら `Dialog` / `Modal`。**一覧の行・メニュー・通知など、状態を持たせたくない場所から開く**なら `ModalHost` + `openModal()` を使う(`Toaster` + `toast` と同じ作法)。自分で覆いや小窓を作らない。

まずアプリのルートに 1 つ置く。**置き忘れると `openModal()` を呼んでも何も出ない。**

```tsx
// app/layout.tsx
<body>
  {children}
  <Toaster />
  <ModalHost />
</body>
```

呼ぶ側は値を渡し、結果を待つ。

```tsx
const ok = await openModal<{ code: string }, boolean>({
  title: "品目の削除",
  params: { code: item.code },
  dismissible: false,                 // 入力途中に消えると困る画面は閉じさせない
  content: ({ params }) => <p>{params.code} を削除します。戻せません。</p>,
  footer: ({ close }) => (
    <>
      <Button variant="secondary" onClick={() => close(false)}>やめる</Button>
      <Button onClick={() => close(true)}>削除する</Button>
    </>
  ),
});
if (ok) await remove(item.code);
```

- `params` が中身に渡る値、`close(値)` の値が `openModal` の戻り値になる
- **×・Esc・外側クリックで閉じた場合は `undefined`**。「保存したか」を知りたいなら必ず値を渡す
- `dismissible: false` にしたら、フッタから閉じる導線を必ず用意する(閉じられない画面になる)
- 中からさらに `openModal()` を呼べる(一覧 → 明細 → 確認)

同じ小窓を複数箇所から開くなら `defineModal` で 1 度定義して配る。呼ぶ側ごとに `content` を書くと、同じ用途の小窓が少しずつ違う形で増える。

```tsx
// 定義(1 箇所)
export const openItemDetail = defineModal<{ code: string }, "saved" | "deleted">({
  title: "品目の詳細",
  size: "lg",
  content: ({ params, close }) => <ItemDetail code={params.code} onSaved={() => close("saved")} />,
});

// 呼ぶ(どこからでも・型が効く)
if (await openItemDetail({ code: "A-001" }) === "saved") await reload();
```

動く実例は `/modal` デモ(`apps/showcase/src/app/modal/page.tsx`)。
