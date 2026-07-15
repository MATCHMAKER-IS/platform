# @demos/blueprint-workflow — ブループリント × 承認ワークフローの統合

全体の手順は `@platform/blueprint`、「承認」段階は `@platform/workflow` の**金額ルーティング + 多段承認**に委譲。
- `submit(expense)` — 提出（必須項目チェック）→ 金額に応じた承認チェーンを開始（少額=課長のみ / 高額=課長→部長→役員）。
- `approveStep(expense, actor)` — 現在段を承認。**全段承認で自動的にブループリントが「承認完了」へ進み、仕訳起票アクションが発火**。
- `pendingApprovalRole(expense)` — 次に承認すべきロール。

ブループリントが「プロセス全体の骨格」、ワークフローが「承認の中身（誰が何段）」を担い、疎結合に統合できます。

## 通知の実配線（notify.ts）
`notificationFor(expense)` が進行に応じた通知を組み立てます（pending→次の承認者へ承認依頼、approved/rejected→申請者へ結果）。文面は `@platform/notify` の `renderTemplate`、送信は `createNotifier`（Slack/メール等のチャネル）に渡します。
