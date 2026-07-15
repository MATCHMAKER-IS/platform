# @demos/validated-form — バリデーション & トーストの実結線

`@platform/validation` の検証と `@platform/ui` のトーストを結線した登録フォーム `SignupForm`。

| 役割 | 部品 |
| --- | --- |
| スキーマ | zod + `@platform/validation`(email 等の部品） |
| 検証 | `@platform/validation` の `validate(schema, values)` → Result |
| 項目別エラー | `@platform/form` の `issuesToFieldErrors`(issue 配列 → { field: message }) |
| 成否通知 | `@platform/ui` の `toast.success` / `toast.error` |
| 入力 | `Input` / `Button` |

## 流れ
1. 送信で `validate(schema, values)`。失敗なら `issuesToFieldErrors` で各入力の下にエラー表示 + `toast.error`。
2. 成功なら `onSubmit` を実行。完了で `toast.success`、例外で `toast.error`。

アプリのルートに `<Toaster />` を 1 つ置いておけば `toast.*` がそのまま表示されます。
