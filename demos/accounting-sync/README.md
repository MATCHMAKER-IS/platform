# @demos/accounting-sync — 外部会計SaaSへの仕訳送信バッチ

`@platform/accounting` の `syncJournals` に「freee へ 1 件送る関数」を注入する結線例。
- `createFreeeSender(companyId, post)` — 送信ペイロード → `@platform/freee` の `buildManualJournal` → 送信。
- `runSyncBatch(entries, options)` — バッチ送信。**冪等キー（日付+摘要+金額）で二重送信を防ぎ**、未登録科目は送信せず failed として収集。

実運用では `@platform/jobs` の `createGuardedJob` で日次実行し、`alreadySent` を DB に永続化します。送信関数を差し替えればマネーフォワード等にも適用可能。

## ジョブ化（sync-job.ts）
`createSyncJob` が `@platform/cron` の `createGuardedJob` で送信バッチをラップします。`preventOverlap` で多重起動を防ぎ、送信済みキーを `SentStore`（DB/Redis 注入）に永続化して冪等に保ちます。`createScheduler` に登録すれば日次実行できます。
