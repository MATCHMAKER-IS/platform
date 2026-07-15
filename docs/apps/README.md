# アプリ ドキュメント

**読者: アプリ開発者。**「何を作ったか / 基盤をどう使ったか」を扱います。
基盤の内部仕様は `docs/platform/` を参照してください。

## internal-app

社内アプリ本体。ロジックはアプリ側、共通機能は `@platform/*` を呼び出します。

- 画面仕様: TODO
- 業務ロジック: TODO
- 基盤の利用例:
  - 環境変数 … `src/server/env.ts`(`@platform/env` で検証)
  - DB・メール・ログの初期化 … `src/server/services.ts`
  - 共通 UI … `src/app/page.tsx`(`@platform/ui`)

## 基盤を使うときの約束

- `packages/**` のソースは編集しない。不足機能は基盤側タスクとして依頼する。
- ライブラリ(nodemailer / Prisma 等)を直接 import せず `@platform/*` を使う。
