# internal-app 画面・API 一覧(自動生成）

> 再生成: `node tools/gen-app-map.mjs internal-app`。画面 79 / API 212。手で編集しない。

## 画面(79)

| パス | タイトル |
|---|---|
| `/` | — |
| `/accounting` | 会計 |
| `/admin/automation` | 自動化（エクスポート/通知テンプレート） |
| `/admin/backup` | バックアップ |
| `/admin/console` | 管理コンソール |
| `/admin/data` | データ管理 |
| `/admin/db-viewer` | DB Viewer |
| `/admin/env` | 設定の確認 |
| `/admin/features` | 機能アクセス設定 |
| `/admin/glossary` | 補正辞書の管理 |
| `/admin/insights` | 利用状況・設定履歴・Webhook |
| `/admin/maintenance` | — |
| `/admin/ops` | 運用ダッシュボード |
| `/admin/platform` | 秘密情報・フラグ |
| `/admin/rpa` | RPA ランナー(デモ) |
| `/admin/service-accounts` | APIキー（サービスアカウント） |
| `/admin/themes` | テーマギャラリー |
| `/admin/users` | ユーザー・権限管理 |
| `/ai` | AI アシスタント |
| `/ai-image` | AI 画像生成 |
| `/analytics` | 経営分析 |
| `/approvals` | 承認インボックス |
| `/assets` | 固定資産 |
| `/attendance` | 勤怠 |
| `/attendance-approvals` | 勤怠承認 |
| `/board/:threadId` | — |
| `/bookings` | 予約(会議室・設備・イベント) |
| `/budgets` | 予算実績 |
| `/cashflow` | 資金繰り |
| `/chat/:roomId` | — |
| `/closing` | 月次決算 |
| `/cms` | 記事管理 |
| `/cms/announcements` | お知らせ管理 |
| `/cms/categories` | カテゴリ・タグ管理 |
| `/cms/dashboard` | ダッシュボード |
| `/cms/history` | 操作履歴 |
| `/cms/media` | メディアライブラリ |
| `/cms/pages` | 固定ページ管理 |
| `/cms/publish-requests` | 公開申請の承認 |
| `/contact` | お問い合わせ |
| `/contracts` | 契約 |
| `/debug` | Platform Debugger |
| `/departments` | 部門別会計 |
| `/developer` | 開発者向けドキュメント |
| `/expenses` | — |
| `/expenses/approval` | — |
| `/expenses/history` | — |
| `/expenses/import` | — |
| `/expenses/report` | — |
| `/faq` | FAQ |
| `/import` | CSVインポート |
| `/inquiries` | お問い合わせ管理 |
| `/inventory` | 在庫管理 |
| `/invoices` | 請求書 |
| `/learning` | e-learning |
| `/mailbox` | 受信箱 |
| `/overview` | ダッシュボード |
| `/partners` | 取引先マスタ |
| `/payables` | 買掛金 |
| `/payroll` | 給与 |
| `/purchase-orders` | 発注 |
| `/quotes` | 見積 |
| `/rag` | 社内文書検索(RAG) |
| `/rag/transcript` | 文字起こし取り込み(辞書補正) |
| `/recurring` | 繰り返し請求 |
| `/reports` | レポート/帳票 |
| `/reviews` | 口コミ |
| `/rpa` | RPA 実行(デモ) |
| `/rpa-demo` | RPA デモ(安全実行) |
| `/search` | 横断検索 |
| `/setup` | 初期セットアップ |
| `/signatures` | サイン |
| `/status` | システムステータス |
| `/surveys` | アンケート |
| `/surveys/:id` | アンケート回答 |
| `/surveys/:id/results` | アンケート集計 |
| `/tasks` | タスク |
| `/trend` | 年次推移 |
| `/withholding` | 源泉徴収・支払調書 |

## API(212)

| エンドポイント | メソッド |
|---|---|
| `/api/accounting` | GET |
| `/api/accounting/accounts` | GET, POST |
| `/api/accounting/accounts/import` | POST |
| `/api/accounting/compare` | GET |
| `/api/accounting/export` | GET |
| `/api/accounting/freee` | GET |
| `/api/accounting/journal-entries` | GET |
| `/api/accounting/journal-import` | POST |
| `/api/accounting/ledger` | GET |
| `/api/accounting/locks` | GET, POST |
| `/api/accounting/statements` | GET |
| `/api/accounting/trend` | GET |
| `/api/accounting/year-end` | GET |
| `/api/admin/audit-alerts` | GET, POST |
| `/api/admin/audit-alerts/scan` | POST |
| `/api/admin/audit-archive` | GET |
| `/api/admin/audit-summary` | GET |
| `/api/admin/backup` | GET |
| `/api/admin/broadcast` | POST |
| `/api/admin/config-changes` | GET |
| `/api/admin/db-viewer` | GET, POST |
| `/api/admin/env` | GET |
| `/api/admin/export-scan` | POST |
| `/api/admin/export-schedule` | GET, POST |
| `/api/admin/features` | GET, POST |
| `/api/admin/flags` | GET, POST |
| `/api/admin/health` | GET |
| `/api/admin/logins` | GET |
| `/api/admin/maintenance` | GET, POST |
| `/api/admin/notification-templates` | GET, POST |
| `/api/admin/ops` | GET |
| `/api/admin/permissions` | GET |
| `/api/admin/reindex` | POST |
| `/api/admin/report-log` | GET |
| `/api/admin/report-scan` | POST |
| `/api/admin/report-schedule` | GET, POST |
| `/api/admin/restore` | POST |
| `/api/admin/secrets` | GET, POST |
| `/api/admin/service-accounts` | GET, POST |
| `/api/admin/settings` | GET, POST |
| `/api/admin/system-alerts/scan` | POST |
| `/api/admin/theme` | GET, POST |
| `/api/admin/theme/custom` | GET, POST, DELETE |
| `/api/admin/usage` | GET |
| `/api/admin/users` | GET, POST |
| `/api/admin/webhooks` | GET, POST |
| `/api/ai/image` | POST |
| `/api/ai/summarize` | POST |
| `/api/ai/usage` | GET |
| `/api/alerts` | GET |
| `/api/alerts/dispatch` | POST |
| `/api/analytics` | GET, POST |
| `/api/analytics/trend` | GET |
| `/api/approvals` | GET |
| `/api/approvals/:docType/:docNumber/signatures` | GET, POST |
| `/api/approvals/decision` | POST |
| `/api/approvals/status` | GET |
| `/api/approvals/submit` | POST |
| `/api/assets` | GET, POST |
| `/api/assets/:code/dispose` | POST |
| `/api/assets/:code/schedule` | GET |
| `/api/assets/journal` | GET |
| `/api/attendance` | GET, POST |
| `/api/attendance/approvals` | GET |
| `/api/attendance/approvals/decision` | POST |
| `/api/attendance/report` | GET |
| `/api/attendance/submit` | POST |
| `/api/audit` | GET |
| `/api/audit/:seq` | GET |
| `/api/audit/export` | GET |
| `/api/audit/history` | GET |
| `/api/auth/logout` | POST |
| `/api/auth/me` | GET |
| `/api/auth/zoho/callback` | GET |
| `/api/auth/zoho/login` | GET |
| `/api/board/search` | GET |
| `/api/board/threads/:threadId/posts` | POST |
| `/api/board/threads/:threadId/posts/:postId` | PATCH, DELETE |
| `/api/bookings` | GET, POST, DELETE |
| `/api/budgets` | GET, POST |
| `/api/cashflow` | GET |
| `/api/chat/bookmarks` | GET |
| `/api/chat/mentions` | GET |
| `/api/chat/rooms` | GET, POST |
| `/api/chat/rooms/:roomId/attachments` | POST |
| `/api/chat/rooms/:roomId/members` | POST |
| `/api/chat/rooms/:roomId/messages` | POST |
| `/api/chat/rooms/:roomId/messages/:messageId` | PATCH, DELETE |
| `/api/chat/rooms/:roomId/messages/:messageId/bookmark` | POST |
| `/api/chat/rooms/:roomId/messages/:messageId/pin` | POST, DELETE |
| `/api/chat/rooms/:roomId/messages/:messageId/reactions` | POST |
| `/api/chat/rooms/:roomId/pins` | GET |
| `/api/chat/rooms/:roomId/presence` | GET |
| `/api/chat/rooms/:roomId/read` | POST |
| `/api/chat/rooms/:roomId/stream` | GET |
| `/api/chat/rooms/:roomId/typing` | POST |
| `/api/chat/search` | GET |
| `/api/chatbot` | POST |
| `/api/cms/announcements` | GET, POST |
| `/api/cms/announcements/:id` | PUT, DELETE |
| `/api/cms/categories` | GET, POST, PATCH |
| `/api/cms/categories/:id` | PUT, DELETE |
| `/api/cms/dashboard` | GET |
| `/api/cms/history` | GET |
| `/api/cms/media` | GET |
| `/api/cms/pages` | GET, POST |
| `/api/cms/pages/:slug` | GET, PUT, DELETE |
| `/api/cms/posts` | GET, POST |
| `/api/cms/posts/:slug` | GET, PUT, DELETE |
| `/api/cms/posts/:slug/revisions` | GET |
| `/api/cms/posts/:slug/revisions/:id/restore` | POST |
| `/api/cms/preview-url` | GET |
| `/api/cms/publish-requests` | GET |
| `/api/cms/publish-requests/:id/decision` | POST |
| `/api/cms/tags` | GET, POST |
| `/api/cms/upload` | POST |
| `/api/contracts` | GET, POST |
| `/api/dashboard` | GET |
| `/api/dashboard/kpi` | GET |
| `/api/dashboard/preferences` | GET, PUT |
| `/api/dashboard/trend` | GET |
| `/api/debug` | GET, DELETE |
| `/api/departments` | GET |
| `/api/expenses` | GET |
| `/api/expenses/batches/:id` | DELETE |
| `/api/expenses/import` | POST |
| `/api/expenses/report` | GET |
| `/api/expenses/requests` | POST |
| `/api/expenses/requests/:id` | POST |
| `/api/expenses/transition` | POST |
| `/api/faq` | GET, POST |
| `/api/features` | GET |
| `/api/files` | GET, DELETE |
| `/api/files/upload` | POST |
| `/api/flags` | GET |
| `/api/health` | GET |
| `/api/i18n` | GET |
| `/api/inquiries` | GET, POST |
| `/api/inquiries/:id/status` | POST |
| `/api/inquiries/intake` | POST |
| `/api/inventory` | GET, POST |
| `/api/inventory/:sku` | GET |
| `/api/inventory/import` | POST |
| `/api/inventory/movements` | POST |
| `/api/inventory/reorder-draft` | POST |
| `/api/invoices` | GET, POST |
| `/api/invoices/:number/html` | GET |
| `/api/invoices/:number/payment` | POST |
| `/api/invoices/:number/pdf` | GET |
| `/api/invoices/:number/receipt` | POST |
| `/api/learning` | GET, POST |
| `/api/mailbox` | GET |
| `/api/mailbox/read` | POST |
| `/api/mailbox/send` | POST |
| `/api/notifications` | GET |
| `/api/notifications/digest` | GET, PUT |
| `/api/notifications/digest-scan` | POST |
| `/api/notifications/preferences` | GET, PUT |
| `/api/notifications/read` | POST |
| `/api/notifications/read-all` | POST |
| `/api/notifications/templates` | GET |
| `/api/partners` | GET, POST |
| `/api/partners/:code/activity` | GET |
| `/api/partners/balances` | GET |
| `/api/partners/export` | GET |
| `/api/partners/import` | POST |
| `/api/payables` | GET |
| `/api/payables/:number/payment` | POST |
| `/api/payroll` | GET |
| `/api/payroll/wage` | GET, PUT |
| `/api/public/reviews` | GET |
| `/api/purchase-orders` | GET, POST |
| `/api/purchase-orders/:number/receipts` | POST |
| `/api/quotes` | GET, POST |
| `/api/quotes/:number/convert` | POST |
| `/api/quotes/:number/state` | POST |
| `/api/rag/glossary` | GET, POST, DELETE |
| `/api/rag/glossary/csv` | GET, POST |
| `/api/rag/ingest` | POST |
| `/api/rag/search` | POST |
| `/api/rag/transcript` | POST |
| `/api/ready` | GET |
| `/api/receivables` | GET |
| `/api/recurring` | GET, POST |
| `/api/recurring/:number/toggle` | POST |
| `/api/recurring/run` | POST |
| `/api/reports/:type` | GET |
| `/api/reports/presets` | GET, POST |
| `/api/reviews` | GET, POST |
| `/api/reviews/moderate` | GET, POST |
| `/api/rpa/demo` | GET, POST |
| `/api/rpa/log` | GET |
| `/api/rpa/notify-history` | GET |
| `/api/search` | GET |
| `/api/settings` | GET |
| `/api/setup/bootstrap` | POST |
| `/api/setup/status` | GET |
| `/api/signatures` | GET, POST |
| `/api/status` | GET |
| `/api/surveys` | GET, POST |
| `/api/surveys/:id` | GET |
| `/api/surveys/:id/export` | GET |
| `/api/surveys/:id/remind` | POST |
| `/api/surveys/:id/respond` | POST |
| `/api/surveys/:id/results` | GET |
| `/api/surveys/:id/status` | POST |
| `/api/surveys/remind-scan` | POST |
| `/api/tasks` | GET, POST, PATCH |
| `/api/v1/events` | GET |
| `/api/v1/invoices` | GET |
| `/api/v1/openapi` | GET |
| `/api/withholding` | GET, POST |
