# crud-template — マスタ管理の最小テンプレート

新しい社内アプリを始めるときの**コピー元**。品目マスタの CRUD(一覧・登録・編集・無効化)を、この基盤の標準パターンで最小構成に実装しています。

## このテンプレが示すパターン

| パターン | ファイル |
|---|---|
| 環境変数の検証(@platform/env・fail-fast) | `src/server/env.ts` |
| 入力検証(項目別エラー) | `src/server/item-repo.ts` の `validateItemInput` |
| ストアの memory / prisma 両実装(最小ポート) | `src/server/item-repo.ts` |
| **認可**(ロールと権限。@platform/auth) | `src/server/authorize.ts` |
| **観測 + 監査 + エラー整形**(1 つのラッパにまとめる) | `src/server/instrument.ts` |
| **API の標準形**(認可 → 実処理 → 監査) | `src/app/api/items/route.ts` |
| 配線(作り方を知るのはここだけ) | `src/server/services.ts` |
| API route(検証400 / 重複409 / ソフトデリート) | `src/app/api/items/**` |
| page + client の2ファイルUI(fetch注入可) | `src/app/page.tsx` / `items-client.tsx` |

## 新アプリの始め方

**`cp -r` ではなく `pnpm new-app` を使ってください。**
ポートの採番・依存の書き換え・ルートへの登録を**まとめてやります**
（手でやると `package.json` の `name` を直し忘れて、**別のアプリと衝突**します）。

```bash
pnpm new-app my-app "経費の申請と承認"
```

**使う機能を聞かれます**（ログイン / SSO / Zoho / メール / アップロード / PDF / 通知）。
選ぶと、依存・環境変数・雛形のコード・README の説明がまとめて入ります。
後から足せるので、**迷ったら選ばずに進めて**ください。

```bash
cd apps/my-app
git init            # ここで別の git を切る
```

**アプリは基盤の git では管理しません。** 詳しくは `../README.md` を見てください
——**基盤はアプリを保証できない**ためです。

### そのあとやること

1. `prisma/schema.prisma` の `ItemRow` を自分のモデルに差し替える
2. `src/server/item-repo.ts` を差し替える（`item` → 自分の名前）
3. `src/app/items-client.tsx` の画面を作り替える
4. `pnpm check` で**基盤のルールに合っているか**確かめる

**`pnpm check` は 72 種類のうち 50 がアプリを見ます。**
金額の表示・並び順・削除の確認・API の認可などが揃っているかを見てくれます。

## 永続化モード

**既定は PostgreSQL** です。`.env` に `DATABASE_URL` を設定してください
(`.env.example` をコピーすれば済みます。DB `app_crud` は setup が作成します)。

```bash
cp .env.example .env
# `pnpm install` の postinstall で Prisma クライアントは生成済みです
pnpm db push crud-template
pnpm --filter crud-template seed   # ダミーデータ(任意)
```

実験用にメモリで動かしたいときだけ `PERSISTENCE=memory` を指定します。
**再起動で消える**ので、開発の使い捨て以外には向きません。

> 以前は「既定インメモリ・DB は任意」でしたが、**`services.ts` が生成物を
> 先頭で import しており、結局 `prisma generate` が必要**でした。
> 「何も設定せず動く」と謳いながら実際は動かない状態だったため、前提を揃えました。

## 認可の足し方

**認可・観測・監査はこのテンプレに入っています。** 後から足すと必ず漏れるためです
(画面と API が増えてから「どこに入れ忘れたか」を探すのは現実的ではありません)。

API はこの形で書きます。

```ts
export const GET = withApi("/api/items", async (req) => {
  requirePermission(currentUser(req), "item:read");   // 1. 認可
  return Response.json({ items: await itemStore.list() });
});
```

`withApi` が、所要時間と成否の記録・例外の HTTP ステータスへの変換・ログ出力をまとめて行います。
変更系では `recordAudit` で「誰が・いつ・何を・どう変えたか」を残します
(参照は記録しません。量が増えるだけで、後から説明する役に立たないため)。

### 実際に使うときに書き換えるところ

| 場所 | 何をする |
|---|---|
| `src/server/authorize.ts` の `APP_POLICY` | このアプリのロールと権限を定義する |
| `src/server/authorize.ts` の `currentUser` | 固定値をやめ、セッションから利用者を取り出す(`/login` デモ参照) |
| `src/server/instrument.ts` の監査の保存先 | メモリ配列をやめ、**DB に差し替える**(消えては意味がないため) |
| `prisma/schema.prisma` と `item-repo.ts` | 扱う対象を品目から自分の業務のものへ |

コード例は `docs/ai/patterns.md` の「2. API route」も参照。

認証込みの実装例: **apps/equipment-app**(このテンプレをコピーして認証・貸出管理を足した実アプリ。移植手順は patterns.md の「7. 認証の最小移植」)。

## 次に足すもの（必要になったら）

**`pnpm new-app` で選べたもの**は、後から手で足せます——
**繋ぎ方は `tools/app-features.mjs` を見てください**（見本になっています）。

| 足したいもの | 使う部品 | 気をつけること |
|---|---|---|
| ログイン | `@platform/session` | **判定は `@platform/auth`**。別物です |
| SSO | `@platform/session` + `google` / `microsoft` | **`state` の検証を飛ばすと CSRF** |
| メール | `@platform/mail` + `notify` | **Outbox 経由**にしないと「送ったか分からない」 |
| ファイル | `@platform/upload` + `storage` | **写真の EXIF に撮影場所が残ります** |
| PDF | `@platform/pdf` + `report` | **Dockerfile に日本語フォント**を入れないと豆腐（□□□） |
| 通知 | `@platform/slack` + `notify` | **何でも通知すると見なくなります** |

**選ばなかったものは何も入っていません。** 部品を探すときは
`pnpm advisor find "<やりたいこと>"` が速いです。

**監査ログ**（`@platform/audit`）は最初から入っています——
**誰が何をしたか**を残す仕組みで、後から足すと**過去が追えません**。

## 何が入っているか(2026-08 に拡充)

**「動く最小」ではなく、そのまま業務で使える形**にしてある。
コピーして作るものなので、後から足す手間を先に払っておく。

| 入れたもの | なぜ |
|---|---|
| `PageShell` | 画面の幅と余白を揃える。画面ごとにバラバラだと移動のたび位置が動く |
| `AsyncBoundary` | 失敗したとき「読み込み中」で止めない。**動いているのか壊れているのか分からない**表示が一番困る |
| `Button` の `loading` | 押した後に反応が無いと二重に押され、2 件登録される |
| `ConfirmDialog` | 無効化は確認を取る。**何が対象かを名指し**する(有効化は戻せるので取らない) |
| 絞り込み | 件数が増えると一覧から探せない |
| CSV 出力 | 「Excel で見たい」は必ず言われる。**`bom: true`** を渡さないと文字化けする |
| 項目ごとのエラー表示 | 上にまとめると、どの欄が悪いのか探させる |
| `formatDateJst()` | ファイル名の日付。UTC だと朝 9 時前が前日になる |

### 守り(どのアプリでも必ず要るもの)

`withApi` に入れてあるので、**ルートを増やしても付け忘れない**。

| | なぜ |
|---|---|
| **回数制限**(書き込み・1 分 30 回) | 認証があっても、正規の利用者がスクリプトで叩けば同じ。誤ったループやリトライの暴走を止める。**ストアが落ちたら通す**(制限のせいで業務が止まる方が困る) |
| **CSRF 対策**(`Origin` を確認) | 他所のページから勝手に書き込ませる攻撃を防ぐ。`Origin` はブラウザが管理するので偽装できない |
| **本文の大きさ**(1MB) | 巨大な JSON でメモリを食い潰される。**検証は解析の後**なので、その前に止める |
| **CSP + nonce** | `proxy.ts`。スクリプトの差し込みを防ぐ |
| `global-error.tsx` | レイアウトごと壊れたときの受け皿。**基盤を呼ばない**(読み込みで失敗している可能性があり、二重に落ちる) |

読み取りは制限していない。副作用が無く、遅くなるだけで済むため。

### 消さずに残す(ソフトデリート)

無効化は `active` を倒すだけで、行は残る。

**業務データは消さない。** 参照している伝票が壊れ、
「なぜ消えたのか」を後から追えなくなる。
一覧から見えなくなれば実用上は足り、間違えても戻せる。
