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

```bash
cp -r apps/crud-template apps/my-app
cd apps/my-app
# 1) package.json の name と dev/start の --port を変更
# 2) 「品目(Item)」を自分のエンティティに置換(item-repo.ts → xxx-repo.ts)
# 3) prisma/schema.prisma の ItemRow を差し替え
pnpm install
pnpm --filter my-app dev
```

## 永続化モード

- 既定: **インメモリ**(DB不要・再起動で消える。開発用)
- PostgreSQL: `PERSISTENCE=prisma DATABASE_URL=postgresql://...` を設定し、
  `pnpm --filter @platform/db exec prisma generate --schema=../../apps/my-app/prisma/schema.prisma`(migrate も同様に `--schema` 指定)

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

## 次に足すもの(必要になったら)

監査ログ(`@platform/audit` + auditActions)/ 通知(`notification-templates` + settingsStore.mailFrom)/ CSVインポート(`@platform/csv`)/ 検索(`@platform/search`)。いずれも internal-app に実装例があります。
