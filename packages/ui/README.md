# @platform/ui

Tailwind CSS + shadcn/ui の慣習に沿った共通 UI 部品。内部は Radix(統合 `radix-ui`)/
cmdk / Embla をラップし、`tokens.css` の CSS 変数で配色・角丸・フォントを統一します。

```tsx
import { Button, Input, Combobox, Slider, Carousel } from "@platform/ui";
import "@platform/ui/tokens.css";
```

## アイコン
汎用アイコンは lucide-react(1000+、MIT)を基盤経由で提供します。

```tsx
// 名前指定(Font Awesome ライク・お手軽)
import { Icon } from "@platform/ui";
<Icon name="Home" size={20} />

// 直接 import(tree-shaking が効く・推奨)
import { Search, Settings } from "@platform/ui/icons";
<Search className="h-5 w-5" />
```

色は既定で `currentColor`(親のテキスト色を継承)。

## 収録コンポーネント
- 基本・フォーム: `Button` / `Input` / `PasswordInput`(表示切替) / `VoiceInput`(音声入力) / `PasswordStrengthMeter` / `Select` / `Checkbox` / `Switch` / `Slider`
- 選択・トグル: `RadioGroup` / `ToggleGroup` / `Combobox`(検索付き) / `DropdownMenu`
- 数値・日時・色: `NumberInput` / `DatePicker` / `TimePicker` / `DateTimePicker` / `ColorPicker`
- ファイル: `FileUpload`(ドラッグ&ドロップ)
- フィードバック: `Spinner` / `LoadingOverlay` / `Progress` / `Seekbar` / `Steps` / `Toaster`+`toast`
- ダイアログ: `Dialog` / `Modal` / `ConfirmDialog` / `ErrorDialog` / `Tooltip`
- データ表示: `DataTable`(ソート・ページング) / `Pagination` / `Carousel`
- ナビ・レイアウト: `Tabs` / `Accordion` / `Breadcrumb` / `Avatar` / `Badge` / `Skeleton`
- 評価・サジェスト・タグ・OTP・署名: `Rating`(⭐) / `Autocomplete` / `TagInput` / `OTPInput` / `SignaturePad`
- 高度な入力: `NumericKeypad`(テンキー) / `SoftwareKeyboard`(オンスクリーン) / `RichTextEditor`(太字・取消線・色・サイズ)
- メディア再生: `VideoPlayer` / `AudioPlayer` / `StreamPlayer`(HLS/DASH) / `Waveform`(波形)
- 録音・録画・可視化: `AudioRecorder` / `VideoRecorder` / `AudioVisualizer`(Web Audio)

いずれもコンポーネントのソースがこのパッケージ内にあり、中身を追えます
(ブラックボックス化しない)。新規追加は shadcn/Radix の慣習に合わせてください。

## 表示・一覧
- `Card` / `CardGrid`(カード表示)、`List` / `ListItem`(リスト表示)、`Block` / `BlockGrid`(ブロック表示)
- `DataView` + `ViewToggle`: 同じデータをカード/リスト/ブロックで切り替え表示
- `Pagination`(省略記号対応)/ `SimplePagination`(前後+現在/総数)
- `BackToTop`: スクロールで出現し先頭へ戻る

## グラフ(チャート)
recharts ラップ。`BarChart`(積み上げ `stacked` / 横棒 `horizontal`)、`LineChart`(`smooth`/`area`)、`ComboChart`(棒+折れ線)、`PieChart`(`donut`/`showLabels`)、`RadarChart`、`ScatterChart`、`GanttChart`。
共通オプション: `title` / `showLegend`(凡例)/ `showGrid`(グリッド)/ `xLabel`・`yLabel`(軸)/ `unit`・`valueFormatter`(単位・整形)/ `toggleable`(表示切替チェックボックス)/ `referenceValue`(目標線)/ `colors`(パレット)/ `height`。

## ダッシュボード / エクスポート
- `ChartCard`: グラフを枠で囲み **CSV / PNG エクスポート**ツールバーを付与(`elementToPng` が SVG を PNG 化)。
- `DashboardGrid` + `DashboardWidget`(`colSpan`/`rowSpan`、狭幅で自動1カラム)、`StatCard`(KPI表示)。

## 業務アプリ定番の追加部品
- **`Alert`** — ページ内に留まる通知(info/success/warning/danger・閉じる可)。トースト(一時表示)と使い分け。
- **`EmptyState`** — 空状態(データなし・検索0件)。アイコン+見出し+説明+アクション。
- **`DescriptionList`** — 項目名:値 の詳細表示(申請詳細・従業員情報)。1/2カラム・行区切り対応。
- **`ActivityTimeline`** — 縦型の履歴(承認フロー・監査ログ・変更履歴)。状態で色分け。
- **`Drawer`** — 画面端から出るパネル(フィルタ・詳細・モバイルナビ)。left/right/top/bottom。
- **`Separator`** — 水平/垂直の区切り線。

## レイアウト・ナビゲーション・ダッシュボード部品
- **`AppShell` / `SidebarNav`** — ヘッダ + サイドバー + 本文の基本レイアウトとナビ一覧(折りたたみ対応)。
- **`Popover`** — トリガーに紐づく浮遊パネル(Radix)。
- **`SearchInput`** — 検索アイコン + クリア + Enter 検索。
- **`ButtonGroup`** — 連結ボタン(表示切替・ページャ)。
- **`Tree`** — 階層表示(部門・カテゴリ)。展開/選択、純ロジック(`moveCard` 等)は `lib/tree` に分離。
- **`NoticeBoard`** — ダッシュボードのお知らせ一覧(未読ドット・カテゴリ・重要度)。
- **`Kanban`** — 列ごとのカード表示。ネイティブドラッグで移動(`onMove`)、移動ロジック `moveCard` は `lib/kanban`(不変更新・テスト済み)。

## スケジュール/カレンダー(閲覧用)
- **`ScheduleCalendar`** — Google カレンダー風の閲覧用ビュー。**月 / 週 / 日 / 予定リスト**の4表示を切替。
  祝日・土日の色分け、終日イベント、複数日跨ぎ、時間グリッドでの**重なりイベントの自動列分割**に対応。
  読み取り専用で `onEventClick` / `onDateClick` / `onViewChange` / `onDateChange` を受ける。
```tsx
<ScheduleCalendar
  events={[{ id: "1", start: new Date(...), end: new Date(...), title: "定例MTG", color: "#2563eb" }]}
  view="week" onEventClick={openDetail}
/>
```
配置・グリッド計算(`buildMonthGrid` / `layoutDayEvents` / `groupEventsByDay` 等)は `lib/schedule` に純関数として分離・テスト済み。時刻はローカル基準、祝日照会は UTC 正規化して `@platform/datetime` に委譲。

### スケジュールの拡充(凡例・空き枠・現在時刻)
- **`CalendarLegend`** — カテゴリの色凡例。`onToggle` を渡すとクリックで表示/非表示フィルタになり、`ScheduleCalendar` に `categories` を渡せばヘッダ下に自動表示・イベントを絞り込み。
- **現在時刻ライン** — 週/日ビューで「今」を赤ラインで表示(`nowOffset`)。
- **空き枠計算(会議室の空き・予約可能枠)** — `computeFreeSlots`(空き時間帯)/ `findAvailableSlots`(指定分数以上の枠・刻み分割)/ `computeBusyIntervals`(使用中の結合)/ `totalBusyMinutes`(稼働率算出)。すべて純関数・テスト済み。
```ts
// 9-18時で60分の予約可能枠を30分刻みで
const slots = findAvailableSlots(events, new Date("2025-07-25T09:00"), new Date("2025-07-25T18:00"), 60, { stepMin: 30 });
```

### 予定詳細ポップオーバー・リソース横並び
- **`EventDetailCard`** — 予定の詳細(時刻・場所・カテゴリ・説明)を整形するカード。既存 `Popover` / `Dialog` の中身として使う。
```tsx
<Popover>
  <PopoverTrigger>…</PopoverTrigger>
  <PopoverContent><EventDetailCard event={ev} location="会議室A" onClose={close} /></PopoverContent>
</Popover>
```
- **`ResourceSchedule`** — 会議室・担当者・設備を**列で横並び**にした 1 日ビュー。イベントは `resourceId` で各列に割り当て、列ごとに重なりを自動分割。現在時刻ライン・終日行つき。予約状況の一覧に。配置ロジック `layoutResourceDay` / `eventsForResource` は `lib/schedule`(テスト済み)。

## ソーシャルログイン UI(Google / Zoho）
```tsx
import { LoginCard } from "@platform/ui";

// 完成版ログイン画面(既定で Google と Zoho)
<LoginCard
  title="ログイン"
  subtitle="アカウントでサインイン"
  providers={["google", "zoho"]}
  loadingProvider={loading}
  onSelectProvider={(p) => startOAuth(p)}      // 認証開始はアプリ側
  // または href で遷移: hrefs={{ google: "/auth/google", zoho: "/auth/zoho" }}
  error={error}
  footer={<a href="/signup">新規登録はこちら</a>}
/>
```
- ボタン単体は `SocialLoginButton`、複数並べるだけなら `SocialLoginGroup` + `LoginDivider`。
- 対応プロバイダ: google / zoho / microsoft / github / apple / line(ブランドアイコン付き)。
- 認証フロー自体は基盤側で実装します。対応は `PROVIDER_AUTH_BACKEND`(Google→`@platform/google` の
  `buildGoogleAuthUrl`、Zoho→`@platform/zoho`、その他→`@platform/auth` の OIDC)。
- メール認証を併用する場合は `LoginCard` の `children` にフォームを渡すと「または」区切り線が入ります。

## レイアウト部品(ヘッダー・サイドメニュー・フッター・ハンバーガー他）
アプリの骨格となる共通レイアウト部品。`AppShell` のスロットに差し込んで使えます。
```tsx
import { AppShell, AppHeader, HeaderNav, HamburgerButton, NavMenu, SiteFooter, UserMenu, PageHeader, Drawer, DrawerContent } from "@platform/ui";

const nav = [{ label: "ダッシュボード", href: "/" }, { label: "予約", href: "/bookings", badge: 3 }, { label: "キャスト", href: "/casts", children: [{ label: "一覧", href: "/casts/list" }] }];

<AppShell
  header={
    <AppHeader
      sticky
      leading={<HamburgerButton open={open} onClick={() => setOpen(!open)} className="md:hidden" />}
      logo={<Logo />}
      nav={<HeaderNav items={nav} currentPath={path} />}
      actions={<UserMenu name="山田太郎" detail="admin" items={[{ label: "設定", href: "/settings" }, { label: "ログアウト", onSelect: logout, danger: true, separated: true }]} />}
    />
  }
  sidebar={<NavMenu items={nav} currentPath={path} onNavigate={() => setOpen(false)} />}
>
  <PageHeader title="予約一覧" description="本日の予約" breadcrumb={<Breadcrumb .../>} actions={<Button>新規予約</Button>} />
  {/* 本文 */}
</AppShell>

<SiteFooter
  copyrightName="Example Inc."
  groups={[{ title: "サービス", links: [{ label: "料金", href: "/pricing" }] }]}
  legalLinks={[{ label: "利用規約", href: "/terms" }, { label: "プライバシー", href: "/privacy" }]}
/>
```
- **AppHeader** トップバー(logo/nav/actions/leading スロット・sticky)。**HeaderNav** 横並びナビ(アクティブ表示)。
- **HamburgerButton** 開閉アニメ付きトグル(モバイルで Drawer/サイドメニューを開く)。
- **NavMenu** 縦型ナビ(入れ子・アクティブ・バッジ・アイコン)。サイドメニューやモバイル Drawer の中身に。
- **SiteFooter** リンク列 + 著作権 + 法的リンク。**UserMenu** アバター+ドロップダウン。**PageHeader** ページ見出し(パンくず+タイトル+アクション)。
- モバイルは `Drawer` に `NavMenu` を入れ、`HamburgerButton` で開閉するのが定番です。
- アクティブ判定は `isNavActive` / `findActiveNav`(純ロジック)。公開サイトのグローバルナビは `@platform/site` の navigation と併用も可。

## テーマ切替(ダーク/ライト）
```tsx
import { ThemeToggle, resolveTheme, applyTheme } from "@platform/ui";

// 選好はアプリ側で保持(controlled)。ヘッダーの actions に置く
<ThemeToggle theme={pref} onThemeChange={setPref} />          // light→dark→system 循環
<ThemeToggle theme={pref} onThemeChange={setPref} mode="toggle" resolved={resolved} />  // 明暗2状態

// 適用: OS設定と選好から解決し、<html> にクラス/属性を付与
const resolved = resolveTheme(pref, window.matchMedia("(prefers-color-scheme: dark)").matches);
applyTheme(resolved, document.documentElement);   // dark クラス + data-theme="dark"
```
`resolveTheme`/`nextThemePreference`/`toggleTheme`/`applyTheme` は純ロジック。Tailwind の `dark:` と `data-theme` に対応します。

## ThemeProvider（テーマ状態の管理）
選好の保持・OS 変更監視・localStorage 永続化・`<html>` への適用をまとめる React コンテキスト。
```tsx
import { ThemeProvider, useTheme, ThemeToggle, themeInitScript } from "@platform/ui";

// アプリのルートで包む
<ThemeProvider defaultTheme="system">{children}</ThemeProvider>

// 子孫でテーマを取得・切替
function Header() {
  const { theme, resolved, setTheme, toggle } = useTheme();
  return <ThemeToggle theme={theme} resolved={resolved} onThemeChange={setTheme} />;
}

// <head> にちらつき防止スクリプト(描画前にテーマ適用)
<script dangerouslySetInnerHTML={{ __html: themeInitScript() }} />
```
`ThemeProvider` は OS の `prefers-color-scheme` 変更を監視し、`system` 選択時に自動追従します。
完成テンプレートは `demos/admin-console`(AdminLayout)を参照。

## 通知センター（ヘッダーのベル）
未読バッジ付きベル + ドロップダウン(今日/昨日/それ以前でグループ表示)。
```tsx
import { NotificationBell, groupByDate, unreadCount } from "@platform/ui";

<NotificationBell
  notifications={notifications}          // { id, title, body?, href?, createdAt, read?, kind? }[]
  onMarkAllRead={markAllRead}
  onNotificationClick={(n) => markRead(n.id)}
  viewAllHref="/notifications"
/>
```
`unreadCount` / `groupByDate` / `markRead` / `markAllRead` は純ロジック。ヘッダーの `actions` に `ThemeToggle` / `UserMenu` と並べます。

## パンくずの区切り文字カスタム
`Breadcrumb` は `separator` で区切りを差し替えられます(既定はシェブロン)。
```tsx
<Breadcrumb items={items} separator="/" />
<Breadcrumb items={items} separator="›" />
```
自動生成は `@platform/site` の `breadcrumbFromPath` / `breadcrumbFromMenu` と組み合わせます。

## コマンドパレット（⌘K 検索）
検索窓 + 絞り込み + キーボード操作(↑↓/Enter/Esc)の素早いアクセス。
```tsx
import { CommandPalette, filterCommands } from "@platform/ui";

const [open, setOpen] = useState(false);
// ⌘K で開く: useEffect で keydown を監視し setOpen(true)
<CommandPalette
  open={open}
  onOpenChange={setOpen}
  commands={[
    { id: "home", label: "ダッシュボード", group: "ページ", href: "/", shortcut: "G H" },
    { id: "new", label: "新規予約を作成", group: "操作", keywords: ["add"] },
  ]}
  onSelect={(c) => c.href ? router.push(c.href) : run(c.id)}
/>
```
`filterCommands`(スコア順)/`groupCommands`/`nextIndex` は純ロジック。前方一致 > 部分一致 > キーワードの順で並びます。

## リアルタイム通知（useNotifications）
`@platform/realtime` の購読を `NotificationBell` につなぎ、未読をリアルタイム更新します。
```tsx
import { useNotifications, NotificationBell } from "@platform/ui";

const { notifications, markRead, markAllRead } = useNotifications({
  initial: serverNotifications,
  // subscribe は realtime(SSE/WS)をラップして新着 1 件を push する
  subscribe: (push) => realtime.subscribe("notifications", (msg) => push(JSON.parse(msg))),
  max: 50,
});
<NotificationBell notifications={notifications} onMarkAllRead={markAllRead} onNotificationClick={(n) => markRead(n.id)} />
```
`notificationReducer`(受信で新着追加・同一ID置換・上限管理)は純ロジックで、状態管理を差し替えても使えます。

## 右クリック・コピペ・ショートカット・エラー境界
これらは既存部品として提供済みです。
```tsx
import {
  ContextMenu, useDisableContextMenu,        // 右クリックメニュー / 右クリック禁止
  CopyButton, useCopyToClipboard, usePaste,  // コピー / 貼り付け
  copyToClipboard, readClipboard,            // 純ロジック(writer/reader 注入でテスト可)
  useKeyboardShortcuts, ErrorBoundary,       // ショートカット / エラー境界
} from "@platform/ui";

// 右クリックでカスタムメニュー
<ContextMenu items={[{ label: "コピー", onSelect: doCopy }, { label: "削除", danger: true, onSelect: doDelete }]}>
  <div>右クリックしてください</div>
</ContextMenu>

// 右クリック禁止(要素 or 全体)。※簡単に回避可能で保護目的には非推奨
useDisableContextMenu(ref);

// コピー & 貼り付け
const [copied, copy] = useCopyToClipboard();
const [pasted, paste] = usePaste();
<CopyButton value={text} />

// グローバルショートカット(⌘K / g h の連続入力)
useKeyboardShortcuts([
  { keys: "mod+k", onTrigger: () => setPaletteOpen(true) },
  { keys: "g h", onTrigger: () => router.push("/") },
]);

// エラー境界
<ErrorBoundary fallback={(err) => <p>エラー: {String(err)}</p>}>{children}</ErrorBoundary>
```
`copyToClipboard`/`readClipboard`(コピペ)、`parseShortcut`/`matchShortcut`/`formatShortcut`/`sequenceMatches`
(ショートカット)は純ロジックで、Mac(⌘)/Win(Ctrl)差や「g h」等の連続入力にも対応します。

## 権限による出し分け（RBAC × ナビ）
`NavItem` に `permission` を付け、`filterNavByPermission` で権限のある項目だけ表示します。
ui は auth に依存せず、判定述語を受け取るだけ（`@platform/auth` の `can()` を渡す）。
```tsx
import { filterNavByPermission, NavMenu } from "@platform/ui";
import { can, policy } from "…";  // @platform/auth

const nav = [{ label: "予約", href: "/bookings", permission: "booking:read" }, { label: "管理", href: "/admin", permission: "admin:access", children: [...] }];
const visible = filterNavByPermission(nav, (p) => can(policy, roles, p));  // 空グループは自動で非表示
<NavMenu items={visible} currentPath={path} />
```
ボタンや画面の出し分けは `<Can permission="…">` パターン（`demos/app` の `rbac.tsx`）を参照。統合例は `demos/app`。

## スクロールエリア / 利用規約同意
長い本文を枠内でスクロール表示し、読了(最下部到達)を検知できます。
```tsx
import { ScrollArea, TermsAcceptance } from "@platform/ui";

<ScrollArea maxHeight="20rem" onReachBottom={() => console.log("読了")}>{longText}</ScrollArea>

// 利用規約: 最後まで読むと同意チェックが有効化される
<TermsAcceptance onAcceptedChange={setAgreed}>{termsText}</TermsAcceptance>
```
