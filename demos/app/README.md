# @demos/app — 統合サンプルアプリ(RBAC × 全機能)

ログイン → ダッシュボード → 一覧 → フォーム → アップロードを 1 つに束ね、権限で出し分ける総合デモ。

## 束ねている機能
| 画面/機能 | 部品 |
| --- | --- |
| ログイン | `LoginCard`（Google/Zoho）+ デモ用ロール切替 |
| シェル | `ThemeProvider` + `AppShell` + `AppHeader` + `NavMenu` + `SiteFooter` |
| ヘッダー | `NotificationBell`（useNotifications）+ `ThemeToggle` + `UserMenu` |
| パンくず | `PageHeader` + `Breadcrumb` + `breadcrumbFromPath` |
| 一覧 | `@demos/data-console` の `DataConsole`（検索/フィルタ/ページャ） |
| フォーム | `@demos/validated-form` の `SignupForm`（検証 + トースト） |
| アップロード | `@demos/upload` の `UploadPanel`（進捗 + 検証 + トースト） |
| 通知 | `Toaster`（トースト表示器） |

## RBAC による出し分け
- ポリシーは `@platform/auth` の `definePolicy`、判定は `can()`（`rbac.tsx` の `useCan` / `<Can>`）。
- **メニュー**: `filterNavByPermission(NAV, isAllowed)` で権限のある項目だけ表示。
- **ボタン/画面**: `<Can permission="booking:write">…</Can>` で出し分け。権限なしの直接遷移は `Denied` 表示。
- ログイン時に staff / manager / admin を切り替えると、メニュー・ボタン・アクセス可否が変わります。

各機能は既存デモ部品を再利用しており、基盤 + デモだけでアプリの骨格が完成することを示します。
