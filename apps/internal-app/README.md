# internal-app

社内アプリ本体。**ロジックはここに書き**、外部連携・バリデーション・メール・
共通 UI などは `@platform/*` を呼び出して使います。

- `src/server/env.ts` … アプリ固有の環境変数(基盤 env で検証)
- `src/server/services.ts` … 基盤部品の初期化・配線
- `src/app/*` … 画面・ロジック

> 基盤(`packages/**`)のソースはこのアプリから編集しません(CLAUDE.md 参照)。

## 経費ダッシュボード(サンプル業務アプリ)

`/expenses` は基盤パッケージを結線したサンプル画面です。

- 集計ロジック: `src/lib/expense.ts`(純ロジック・`@platform/utils` の統計/外れ値、`@platform/datetime` の四半期を利用)
- 画面: `src/app/expenses/page.tsx`(`@platform/ui` の `KpiCard`/`MetricGrid`/`TimelineChart`/`Histogram`/`StatSummary`/`DataTable`)
- 和暦表示: `@platform/datetime` の `formatWareki`
- データ: `src/lib/sample-expenses.ts`(実運用では Prisma `Expense` から取得)

### 実行(ネットワークのある環境)

```bash
pnpm install
pnpm --filter internal-app dev   # http://localhost:3000/expenses
```

集計ロジックは基盤スモーク(`pnpm smoke`)とは別に、`expense.ts` の純関数として単体テスト可能です。

### CSV 取込フロー(`/expenses/import`)

1. CSV を貼り付け → `parseExpenseCsv`(`@platform/csv` で解析・日本語ヘッダ正規化・日付整形)
2. `ImportReview`(`@platform/ui`)で行ごとのエラー確認・修正(必須/日付/数値を `validateImportRows` で検証)
3. 確定 → `toExpenses`(`@platform/utils` の `parseNumber` で金額を数値化)→ サマリ表示(実運用では Prisma 保存)

取込ロジックは `src/lib/expense-import.ts`(純関数)として単体テスト可能。

### 承認ワークフロー(`/expenses/approval`)

`@platform/workflow` による 申請→課長承認→部長承認。承認/却下に加え **差戻し(`sendBack`)** に対応(pending を維持して前ステップへ戻す)。

- 定義・遷移: `src/lib/expense-approval.ts`(`EXPENSE_WORKFLOW`, `availableActions`, `actOn`)
- 画面: ロールを切り替えて操作、履歴を表示。権限のない操作はエラーを返し状態は不変。

### 月次レポート(`/expenses/report`)

`@platform/report` による月次締めレポート。対象月・言語(ja/en/zh/ko)を選び、集計 KPI と印刷用 HTML プレビューを表示、HTML でダウンロード。

- 生成: `src/lib/expense-report.ts`(`toExpenseRecords` で税込・税率10%に変換 → `monthlyExpenseSummary` → `renderMonthlyReportHtml`/`monthlyReportSheets`)
- 画面: 月/言語セレクタ、KPI(件数/税込/税抜/消費税)、`iframe srcDoc` プレビュー、Blob ダウンロード。

### Excel 出力(`/api/expenses/report?month=YYYY-MM`)

月次レポートを .xlsx でダウンロードする API ルート。`buildMonthlyReport` のシート(`monthlyReportSheets`)を `@platform/xlsx` の `writeWorkbook` に渡してサーバ側で生成。レポート画面の「Excel ダウンロード」ボタンから呼び出す。

### Prisma 永続化 / API

- スキーマ: `prisma/schema.prisma`(`Expense`, `ExpenseRequest`)
- データアクセス: `src/server/expense-repo.ts`(`@platform/db` の `createDb`/`paginate`。Prisma 行 ⇄ `Expense` を相互変換)
- API:
  - `GET /api/expenses?page=&pageSize=` — 一覧(ページネーション)
  - `POST /api/expenses/import` `{ rows }` — 取込を検証・変換して一括作成
- 取込画面の確定時に `POST /api/expenses/import` を呼び出す(ネットワーク不通でもサマリ表示は継続)。

DB 起動は `DATABASE_URL` を設定し `pnpm --filter internal-app prisma migrate dev` の後 `pnpm --filter internal-app dev`。

### 承認状態の永続化 / API

- `src/server/approval-repo.ts`: `WorkflowState` ⇄ `ExpenseRequest` 行を相互変換。`applyAction` は `@platform/db` の `withTransaction` 内で「読込→`actOn`で遷移→保存」を実行し、同時更新に強い。
- API:
  - `POST /api/expenses/requests` `{ applicant, expenseId }` — 申請作成(201)
  - `POST /api/expenses/requests/{id}` `{ actor, action, reason? }` — 承認/却下/差戻し(権限不足・不整合は 409)

### 承認通知(メール)

承認/却下/差戻しがコミットされると、遷移に応じて自動通知する。

- 組み立て(純): `src/lib/expense-notify.ts`(`buildTransitionMails` = `@platform/workflow` の `notificationForTransition`/`approverRecipients` を利用)
  - 次ステップ進行 → 次の承認者へ「承認依頼」
  - 承認/却下で完了 → 申請者へ「結果通知」(却下は理由つき)
- 送信: `src/server/expense-notify-service.ts`(`@platform/mail` の mailer)。`applyAction` のトランザクション成功後に送信し、送信失敗はログのみで API 応答は成功のまま。

### 取込履歴 + 監査ログ / ロールバック

- スキーマ: `ImportBatch`(取込単位), `AuditLog`(監査), `Expense.batchId`。
- `src/server/import-repo.ts`:
  - `recordImportBatch` — バッチ作成 + 経費一括作成 + `recordAudit` をトランザクションで実行(取込は `POST /api/expenses/import` から)。
  - `rollbackImportBatch` — 当該バッチの経費を削除し `status=rolled_back`、監査記録(`DELETE /api/expenses/batches/{id}`)。
  - `listImportBatches` — `ImportHistoryRow[]` を返す。
- 画面 `/expenses/history`: `@platform/ui` の `ImportHistoryTable`(検索/ソート/CSV + ロールボタン、ロール権限は `canRollbackWith`)。
- 監査差分は `@platform/db` の `diffChanges`(ignore/redact 対応)。

## 勤怠ダッシュボード(サンプル業務アプリ)

`/attendance` は打刻から実働・残業・月次を集計する画面。

- ロジック: `src/lib/attendance.ts`(`workedMinutes`/`overtimeMinutes`/`summarizeAttendance`。夜勤の日跨ぎ対応、`@platform/datetime` の `formatDuration`、`@platform/utils` の `sum`)
- 画面: `KpiCard`/`MetricGrid`/`Sparkline`/`DataTable`(`@platform/ui`)、曜日は `weekdayNameJa`、和暦は `formatWareki`

## E2E テスト

`e2e/expense-flow.spec.ts`(取込→ダッシュボード→承認→履歴)。CI は `.github/workflows/e2e.yml`(Postgres サービス + prisma migrate + playwright)。ローカルは `pnpm --filter internal-app e2e`。
