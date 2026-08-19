# 新しいアプリを追加する

`apps/` に新しい社内アプリを足すときの手順です。**crud-template をコピーする**のが最短で、規約に沿った状態から始められます。

## 0. その前に — 本当に新しいアプリが必要か

- **既存アプリに画面を足すだけで済まないか**（internal-app は 73 画面ある。関連機能はまとめた方が使う人に優しい）
- **基盤に足りない部品はないか** → `pnpm mcp:catalog` の `search_platform`、または [platform-portal](http://localhost :3001) で探す

分ける理由が「デプロイ単位を分けたい」「担当者が違う」「使う人が違う」のいずれかなら、新規アプリが妥当です。

## いちばん早い方法

```bash
pnpm new-app shipping "配送管理"
```

```bash
pnpm new-app shipping "配送管理" --dry   # 何をするか見るだけ
```

**アプリ名の置き換え・ポートの割り当て・ルートへの起動コマンド登録**を自動で行います。
手でコピーすると 5 ファイル・2 か所を直すことになり、
漏らすと `pnpm dev`(一斉起動)でポートが衝突したり、
監査ログに前のアプリ名が残ったりします。

### 消すとき

`apps/<名前>` を消し、ルートの `package.json` から `dev:<名前>` を消します。
**2 か所**なので、試すだけなら `--dry` で先に確かめる方が早いです。

以下は**中で何をしているか**の説明です。手でやりたいときや、
うまくいかないときに読んでください。

---

## 1. ポートを決める

`node tools/check-ports.mjs` で空きを確認します。現在 3000〜3005 が使用中なので、次は **3006** です。

## 2. 雛形をコピー

```bash
cp -r apps/crud-template apps/my-app
cd apps/my-app
rm -rf node_modules .next
```

## 3. package.json を直す

```jsonc
{
  "name": "my-app",                        // ← 変更
  "scripts": {
    "dev": "next dev --port 3006"          // ← 1 で決めたポート。--port は必須
  }
}
```

> `--port` を書かないと Next.js の既定 3000 を取りに行き、`pnpm dev`（一斉起動）で internal-app と衝突します。

## 4. 中身を差し替える

crud-template には次が入っています。不要なら消し、必要なら残してください。

| ファイル | 役割 |
|---|---|
| `src/app/layout.tsx` | ルートレイアウト。**AppSkin（テーマ）と ThemeSwitcher が入っている** |
| `src/lib/theme-registry.ts` | テーマレジストリ。独自スキンはここに `register` |
| `src/server/env.ts` | 環境変数。**process.env を直接読まない**（[patterns.md #9](../ai/patterns.md)） |
| `src/app/items-client.tsx` | CRUD 画面の実例。検証・エラー表示・ソフトデリート付き |
| `src/app/api/items/route.ts` | API の実例。認可・観測・監査の型 |
| `prisma/schema.prisma` | DB スキーマ。モデルを差し替える |
| `.env.example` | 環境変数の見本。**参照する変数はすべて書く** |

## 5. ルートに登録

> `pnpm new-app` を使えば**自動で足されます**。忘れると
> 起動コマンドが無いまま「動かない」となります。

`package.json`（リポジトリ直下）の scripts に起動コマンドを足します。

```jsonc
{
  "scripts": {
    "dev:myapp": "pnpm --filter my-app dev"
  }
}
```

## 5.5 雛形が持っているもの（消さないこと）

`apps/crud-template` をコピーすると、次が最初から入っています。
**どれも後から足すのが難しい**ので、消さずに中身を差し替えてください。

| ファイル | 役割 | 消すとどうなるか |
|---|---|---|
| `server/authorize.ts` | 認可（ロールと権限） | 画面と API が増えてから足すと、**必ずどこかで漏れる** |

> ⚠️ **`authorize.ts` の `currentUser` は雛形では固定値を返します**（`{ id: "demo-user", roles: ["editor"] }`）。
> 認可は通るので画面は動きますが、**誰でも全操作できる状態**です。
> 公開する前に、実際のセッション検証へ差し替えてください（実例: `apps/internal-app/src/server/authorize.ts`）。
> 差し替え忘れは `node tools/check-auth-stub.mjs` が検出し、本番では起動後の最初のリクエストで例外になります。
| `server/instrument.ts` | 観測・監査・エラー整形を `withApi` にまとめる | 認可の失敗が 500 になる。誰が何を変えたか追えない |
| `app/error.tsx` | 例外時の画面 | **既定の白い画面**が出て「壊れた」としか伝わらない |
| `app/not-found.tsx` | 404 の画面 | URL 違いか障害か、利用者が判断できない |
| `app/api/health/route.ts` | 死活監視 | **落ちても誰も気づけない** |
| `app/api/ready/route.ts` | 受け入れ可否 | 起動中に振り分けられ、利用者がエラーを見る |

`node tools/check-build-ready.mjs` が、これらの有無を確認します。

### API はこの形で書く

```ts
export const GET = withApi("/api/items", async (req) => {
  requirePermission(currentUser(req), "item:read");   // 1. 認可
  return Response.json({ items: await itemStore.list() });
});
```

変更系では `recordAudit` で「誰が・いつ・何を・どう変えたか」を残します
（参照は記録しません。量が増えるだけで、後から説明する役に立たないため）。

### 最初に書き換えるところ

| 場所 | 何をする |
|---|---|
| `server/authorize.ts` の `APP_POLICY` | このアプリのロールと権限を定義する |
| `server/authorize.ts` の `currentUser` | 固定値をやめ、セッションから取り出す |
| `server/instrument.ts` の監査の保存先 | メモリ配列をやめ、**DB に差し替える**（消えては意味がない） |
| `app/api/health/route.ts` | このアプリで「落ちている」と判断すべき条件に変える |

## 6. ドキュメントを更新

- `docs/APPS_AND_DEMOS.md` — ポート一覧の表と、アプリの紹介（規模・できること）
- `docs/ops/COMMANDS.md` — 開発サーバの表

> どちらも `node tools/check-ports.mjs` がポートの記載漏れ・不一致を検出します。

## 7. 検証

```bash
pnpm doctor          # 環境の確認
node tools/check-ports.mjs      # ポート重複がないか
node tools/preflight.mjs        # 全ゲート（依存境界・生成物・ポート等）
pnpm gen:all                    # 生成物（ER 図・アプリマップ）を更新
```

`gen:all` を実行すると、新しいアプリの ER 図（`apps/my-app/docs/erd.md`）と画面/API 一覧（`apps/my-app/docs/appmap.md`）が自動生成され、リファレンスサイトにも載ります。

## チェックリスト

- [ ] ポートを `check-ports` で確認し、`--port` を package.json に明記した
- [ ] `name` を変えた（crud-template のままだと workspace が衝突する）
- [ ] `src/server/env.ts` を自分のアプリの変数に直した（`process.env` 直読みをしない）
- [ ] `.env.example` に参照する変数をすべて書いた
- [ ] ルートの `dev:*` スクリプトを足した
- [ ] `docs/APPS_AND_DEMOS.md` と `docs/ops/COMMANDS.md` を更新した
- [ ] `node tools/preflight.mjs` が全緑
- [ ] `pnpm gen:all` で生成物を更新した

## よくある失敗

| 症状 | 原因 |
|---|---|
| `pnpm dev` で片方が起動しない | `--port` の書き忘れ（3000 の取り合い） |
| 型チェックが素通りする | `tsconfig.json` が無い（`check-package-shape` が検出） |
| 本番で起動しない | 秘密値が未設定/脆弱（`requireEnv` + `assertSecretStrength` が正しく落としている） |
| テーマが効かない | 色をハードコードしている → `var(--color-primary)` を使う |

---

# showcase に画面を足す

**`docs/ops/NEW_APP.md` を統合したものです（2026-08）。**

統合デモサイト（`apps/showcase`）に画面を追加する手順です。

**6 か所を更新する必要があり、1 つでも忘れると検査が落ちます。**
逆に言えば、忘れても機械が教えてくれます。

## 手順

### 1. 画面を作る

```
apps/showcase/src/app/<名前>/page.tsx
```

- `@platform/ui` の部品を使う（生タグを書くと `check-app-rules` が落ちる）
- タブに分けたいときは `<名前>/xxx-demo.tsx` を作って `page.tsx` から読む

### 2. 一覧に登録する

`apps/showcase/src/lib/nav.ts` の `PLATFORM_DEMOS` に追加します。
**同じ `group` の並びの中に入れる**こと（散らばると一覧が読みにくくなります）。

```ts
{ href: "/<名前>", title: "画面の名前", desc: "何ができるかを一行で",
  packages: ["使っている基盤"], group: "業務ドメイン" },
```

### 3. 概要を書く

`apps/showcase/src/lib/overviews.ts` に、**初めて見る人向け**の説明を足します。
何のための機能で、どこが要点かを 2〜3 文で。

### 4. 資料の本数を直す

**`tools/smoke.mjs` は触りません。** 件数の決め打ちは 2026-08 に廃止済みで、
nav.ts の実データから数えるようになっています（数字を直す作業だけが残るのを避けるため）。

手で直すのは `docs/APPS_AND_DEMOS.md` の本数ですが、**これも自分で打ちません**。

```bash
node tools/check-doc-numbers.mjs --fix
```

### 5. 生成物を作り直す

デモを 1 本足すと、**3 つの生成物が古くなります**。
`check-generated` が落ちるので忘れても止まりますが、先に流しておく方が早い。

```bash
pnpm gen:all        # 個別にやるなら次の 3 つ
# node tools/gen-app-map.mjs showcase
# node tools/gen-portal-extras.mjs
# node --experimental-strip-types tools/gen-docs-index.mts
```

### 6. 確認する

```bash
node tools/preflight.mjs
```

## 忘れやすいところ

| 忘れると | 何が落ちるか |
|---|---|
| nav.ts への登録 | `check-build-ready`（ページがあるのにメニューから辿れない） |
| overviews.ts への概要 | 画面は出るが、初見の人に何の画面か伝わらない |
| 資料の本数 | `check-doc-numbers`（`--fix` で直る） |
| 生成物の作り直し | `check-generated`（appmap / portal-extras / docs-index の 3 つ） |
| 新しい基盤パッケージを使った | `check-showcase-deps`（`transpilePackages` の漏れ） |

**どれも preflight が具体的に教えてくれます。** 手順を覚えていなくても、
落ちたメッセージに従えば直せます。

## 既存のデモにタブを足す場合

1〜3 は不要です。`<名前>/新しいタブ-demo.tsx` を作り、`page.tsx` の `TABS` に足すだけ。
件数も変わりません。

## 迷ったら

似たデモのコードを読むのが一番速いです。

| やりたいこと | 参考になるデモ |
|---|---|
| 一覧・登録・編集・削除 | `/master` |
| タブで複数の内容をまとめる | `/device`・`/login` |
| 基盤の関数をその場で動かす | `/net`・`/calendar` |
| サーバ側の処理を呼ぶ | `/connect`・`/assistant` |

