# アーキテクチャ(AI向け要約)

このリポジトリで実装・修正する際に**必ず守る構造ルール**をまとめる。詳細な機能一覧は `module-list.md`、コード様式は `patterns.md` を参照。

## 全体像

```
apps/       … アプリ(業務ロジック・画面・API route・Prisma schema)
  internal-app/   社内業務アプリ(Next.js)
  public-site/    公開サイト(Next.js・Prisma無し)
packages/   … 基盤(107 個・純ロジック/部品。業務判断を持たない)
tools/      … 検査・生成スクリプト(smoke / check-deps / api-surface / check-schema / gen-module-list)
docs/       … ドキュメント(機能カタログは リポジトリ直下の PLATFORM_SERVICES.md)
```

## 絶対ルール

1. **層の方向**: apps → packages の一方向のみ。packages から apps を import しない。packages 間の依存は `node tools/check-deps.mjs` が循環・層破りを検査する(CI必須)。
2. **業務ロジックの置き場**: 「会社固有の判断」(承認閾値・勘定科目の使い方・画面文言)は apps。**汎用部品**(CSVパース・暗号化・Result型)は packages。迷ったら apps に置き、汎用化できると分かってから packages へ昇格する。
3. **ストアは memory / prisma の両実装**: `createMemoryXxxStore()`(開発・テスト) と `createPrismaXxxStore(db)`(本番) を同一インターフェースで用意し、`platform-services.ts` で `CHAT_PERSISTENCE=prisma` により切替。Prisma依存は「最小ポート」インターフェース(`XxxStoreDb`)で受け、直接 PrismaClient 型に依存しない。
4. **エラーは @platform/core の Result/AppError**: throw は境界(route)でハンドリング。route は `withApiObservability(パス, handler)` で包む。
5. **認可**: route 冒頭で `currentUser(...)` → `requirePermission(user, "perm")`(throw) か `userCan`(判定)。admin専用は roles.includes("admin")。cron系は `X-Cron-Token` 一致 or admin。
6. **設定値は settingsStore**: 差出人メール(mailFrom)・会社名・消費税率などをハードコードしない。既定値は settings-repo の SETTINGS_DEFAULTS に集約。
7. **型は strict + noUncheckedIndexedAccess**: `xs[0]` は undefined を考慮する。`any` 禁止(外部境界の cast は `as unknown as X`)。

## 検証(この環境の前提)

- `pnpm smoke` … 依存インストール不要のロジック検査(tools/smoke.mjs・840+項目)。**新ロジックには必ずスモークを追加**。
- `node tools/check-deps.mjs` / `node tools/api-surface.mjs` / `node tools/check-schema.mjs` … 依存境界・公開API差分・Prisma schema の検査。
- フルビルド(pnpm install / next build / vitest / e2e)は CI(GitHub Actions)で実行。ローカルがオフラインでも上記4つは動く。

## 変更時のチェックリスト

- [ ] 置き場は正しいか(業務=apps / 汎用=packages)
- [ ] ストアを足したら memory+prisma 両実装+platform-services 配線+Prisma model 追加
- [ ] route は認可・withApiObservability・監査(auditActions)を通したか
- [ ] スモーク追加・`pnpm smoke` 全緑・PLATFORM_SERVICES.md(リポジトリ直下)追記
- [ ] `check-deps` / `api-surface --update` / `check-schema` が緑
