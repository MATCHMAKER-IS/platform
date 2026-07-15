# crud-template — マスタ管理の最小テンプレート

新しい社内アプリを始めるときの**コピー元**。品目マスタの CRUD(一覧・登録・編集・無効化)を、この基盤の標準パターンで最小構成に実装しています。

## このテンプレが示すパターン

| パターン | ファイル |
|---|---|
| 環境変数の検証(@platform/env・fail-fast) | `src/server/env.ts` |
| 入力検証(項目別エラー) | `src/server/item-repo.ts` の `validateItemInput` |
| ストアの memory / prisma 両実装(最小ポート) | `src/server/item-repo.ts` |
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

このテンプレは意図的に**認証なし**です(パターンを最小に保つため)。実運用では internal-app の `src/server/authorize.ts` と `password.ts` を移植し、各 route 冒頭で `currentUser` → `requirePermission` を呼びます。手順とコード例は `docs/ai/patterns.md` の「2. API route」を参照。

認証込みの実装例: **apps/equipment-app**(このテンプレをコピーして認証・貸出管理を足した実アプリ。移植手順は patterns.md の「7. 認証の最小移植」)。

## 次に足すもの(必要になったら)

監査ログ(`@platform/audit` + auditActions)/ 通知(`notification-templates` + settingsStore.mailFrom)/ CSVインポート(`@platform/csv`)/ 検索(`@platform/search`)。いずれも internal-app に実装例があります。
