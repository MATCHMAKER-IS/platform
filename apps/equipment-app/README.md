# equipment-app — 備品管理(crud-template の実戦投入・認証込み)

crud-template をコピーして作った**実アプリ第1号**。備品マスタに加えて、テンプレートに無かった3要素を実装しています: **認証**(セッション+パスワード)・**子レコード**(貸出履歴)・**状態遷移**(在庫あり⇄貸出中)。

## 使い方

```bash
pnpm --filter equipment-app dev   # http://localhost:3003
# 初期ログイン: admin@example.com / admin1234(env ADMIN_PASSWORD で変更)
```

環境変数: `SESSION_SECRET`(本番必須)/ `ADMIN_PASSWORD` / `PERSISTENCE=prisma` + `DATABASE_URL`(備品・貸出履歴が PostgreSQL 化。ユーザー台帳はメモリのまま — 本番は internal-app の user-repo を移植)。

## 業務ルール(equipment-repo.ts)

貸出は「存在する・有効・貸出中でない・借用者名あり」のときだけ成功し、それ以外は理由付きで失敗します(`{ ok:false, error }` → API 409)。返却は貸出中のみ。履歴は `GET /api/equipment/[code]/history`。

## テンプレートへのフィードバック(このアプリで判明したこと)

1. **認証の移植は2ファイルで済んだ** — internal-app の `zoho-session.ts` + `password.ts` を `auth.ts` に統合コピーし、`guard.ts`(播種+requireUser)を足すだけ。→ 手順を `docs/ai/patterns.md` の「7. 認証の最小移植」に反映済み。
2. **子レコード+状態遷移のパターンがテンプレに無かった** — `lend/giveBack` が `{ ok, error }` を返し route が 409 に変換する形を確立。→ `docs/ai/patterns.md` の「8. 子レコードと状態遷移」に反映済み。
3. **一覧+詳細(履歴表示)の UI パターンが未整備** — 履歴 API はあるが UI は今回見送り。dashboard/詳細ページ系テンプレートの必要性を確認(次の拡充候補)。
