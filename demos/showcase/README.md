# showcase(基盤ショーケース デモ)

`@platform/*` の使い方を動く形で示すデモアプリです。DB や Redis 不要で `pnpm dev` だけで動きます。

## 起動
```bash
pnpm --filter showcase-demo dev   # http://localhost:3001
```

## デモ内容
- `/inquiries` … 問い合わせフォーム。**validation → http → datetime → mail(メモリ)→ xlsx** の縦一本。
  - 入力検証、受付、確認メール(メモリ記録)、一覧の JST 表示、Excel 出力を通しで体験できる。
- `/security` … **crypto**(暗号化/復号)と **auth**(RBAC 権限判定)のデモ。

## 設計上のポイント
- データ保持(ロジック)はデモ側(`src/server/store.ts`)のインメモリ。共通機能は基盤を呼ぶ。
- 基盤(`packages/`)のソースは編集していない(公開 API のみ利用)。
