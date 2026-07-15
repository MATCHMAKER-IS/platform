# @demos/blueprint-flow — ブループリントで経費プロセスを実行

`@platform/blueprint` で経費申請の手順（提出→承認→支払、差戻し/却下）を宣言的に定義し、
遷移成功時のアクションを副作用として実行する例。**承認時に `@platform/accounting` の `expenseJournal` で仕訳を自動起票**します。

- `nextActions(expense)` — 現在の状態で選べるアクション（条件を満たすもののみ）。
- `runTransition(expense, name, roles)` — 遷移を実行。必須項目・条件・ロールを満たさなければ `ok:false` とエラー。
  成功時は状態を更新し、`notifyApprover`（通知）・`postJournal`（仕訳起票）などのアクションを処理。

ブループリントが「正しい手順」を保証し、アプリはアクションの中身だけを実装すればよい構成です。

## UI 画面（screen.tsx）
`ExpenseBlueprintScreen` は `@platform/ui` の `BlueprintActions` で現在の状態と実行可能アクションを出し分け、必須項目が未入力の遷移はボタンを無効化して理由を表示します。
