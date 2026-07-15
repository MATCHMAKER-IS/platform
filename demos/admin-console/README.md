# @demos/admin-console — 管理画面レイアウトの完成テンプレート

基盤 UI を束ねた、そのまま使える管理画面の骨格 `AdminLayout`。ページ側は `title` と `children` を
渡すだけで、ヘッダー・サイドメニュー・パンくず・テーマ切替・ユーザーメニュー・フッター・モバイル対応が揃います。

## 構成部品
| 役割 | 部品 |
| --- | --- |
| テーマ状態(OS監視/永続化) | `ThemeProvider` + `useTheme` + `ThemeToggle` |
| 骨格 | `AppShell`(header + sidebar + 本文) |
| ヘッダー | `AppHeader` + `HeaderNav`(横並びナビ) + `HamburgerButton`(モバイル) |
| サイド/モバイルナビ | `NavMenu`(縦型・入れ子・アクティブ) + `Drawer` |
| ページ見出し | `PageHeader` + `Breadcrumb` + `breadcrumbFromPath`(自動パンくず) |
| ユーザー | `UserMenu`(アバター + ドロップダウン) |
| フッター | `SiteFooter` |

## 使い方
```tsx
<AdminLayout
  currentPath={pathname}
  nav={[{ label: "ダッシュボード", href: "/" }, { label: "予約", href: "/bookings", badge: 3 }, { label: "キャスト", href: "/casts", children: [{ label: "一覧", href: "/casts/list" }] }]}
  logo={<Logo />}
  user={{ name: "山田太郎", detail: "admin@example.com" }}
  onLogout={logout}
  companyName="Example Inc."
  title="予約一覧"
  description="本日の予約"
  actions={<Button>新規予約</Button>}
  breadcrumbLabels={{ bookings: "予約", casts: "キャスト" }}
>
  {/* ページ本文 */}
</AdminLayout>
```

## ちらつき防止(FOUC)
`<head>` に初期化スクリプトを入れると、描画前にテーマが適用されます。
```tsx
import { themeInitScript } from "@platform/ui";
<head><script dangerouslySetInnerHTML={{ __html: themeInitScript() }} /></head>
```

社内管理画面なので、ページ自体は検索避け(`@platform/seo` の `visibility: "internal"` / `internalRobotsTxt`)を併用します。
