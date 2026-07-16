# 通知センター / ファイル管理 / 監査ログ

## 現況サマリー(この節が最新・以降の各節末尾の数値は執筆時点のスナップショット)

- 更新日: 2026-07-13 / **アプリ5つ**(internal-app, public-site, crud-template, equipment-app, **platform-portal**)・**パッケージ99個**(README 99/100・※scaffold内部除く)・Prismaモデル60(internal-app)+1(crud-template)+2(equipment-app)
- 検査: `pnpm smoke`(ロジック回帰) / `check-deps`(循環・層破り) / `api-surface`(公開API差分) / `check-schema`(schema軽量lint) / `check-env-example`(env文書整合) — すべて緑。一括: **`pnpm verify:offline`**(preflight)。セットアップは `bash scripts/setup.sh` / devcontainer(docs/ops/SETUP.md)
- AI向け入口: `docs/ai/`(architecture / module-list / patterns)と各パッケージ README
- 未了(正直な現在地): pnpm install〜next build〜vitest〜E2E の**実走はCI環境で行う**(本環境はオフライン)。定期エクスポート/配信の実ファイル書き出し・実メール送信は接続待ちのスタブ。


アプリ横断の基盤サービス。配線は `apps/internal-app/src/server/platform-services.ts` に集約（既定インメモリ、`CHAT_PERSISTENCE=prisma` で通知/ファイルは Prisma 実装に切替）。

## 通知センター（`server/notification-center.ts`）
- `AppNotification`（UI と同形: id/title/body?/href?/createdAt/read?/kind?）をユーザーごとに貯め、未読管理する。
- `NotificationStore`（`createMemoryNotificationStore` / `createPrismaNotificationStore`）: `add` / `list({unreadOnly?,limit?})` / `unreadCount` / `markRead` / `markAllRead`。一覧は createdAt の新しい順。
- `NotificationCenter`（`createNotificationCenter(store, newId)`）: `notify(userId, {title,body?,href?,kind?})` で ID を採番して積む。
- **メンション結線**: `chat.ts` の `notifyMentions` が、メンション時にメール通知に加えて通知センターへ `kind:"mention"` の通知を積む（ハンドル→メール=ユーザーID に解決）。
- API: `GET /api/notifications?unread=1&limit=`（一覧＋未読数）、`POST /api/notifications/read`（`{id}`）、`POST /api/notifications/read-all`。
- UI: `@platform/ui` の `NotificationBell` を `app/notifications/notification-center-client.tsx` が使用（ポーリング・既読化）。
- Prisma: `NotificationRow`（`@@index([userId, read])` / `@@index([userId, createdAt])`）。memory 実装とパリティ検証済み。

## ファイル管理（`server/file-manager.ts`）
- 実体は `@platform/storage`、メタデータ（key/name/size/type/uploadedBy/uploadedAt）は `FileRegistry`（memory / prisma）。
- `FileManager`（`createFileManager({storage, registry})`）: `register` / `list({prefix?,limit?})` / `remove(key)`（実体削除に成功したら登録も削除。失敗時は登録を残す）。一覧は uploadedAt の新しい順。
- API: `GET /api/files?prefix=&limit=`、`DELETE /api/files`（`{key}`）。
- UI: `@platform/ui` の `FileList`（アイコン/サイズ/日時・画像プレビュー・削除）＋ `formatBytes`。`app/files/files-client.tsx`。
- Prisma: `FileRow`（key を主キー・`upsert` で上書き）。memory 実装とパリティ検証済み。

## 監査ログ（`server/audit-log.ts`）
- `@platform/audit` のハッシュチェーンに委譲（追記のみ・改ざん検知）。
- `AuditLog`（`createAuditLog(store)`）: `record(event)`（`appendEvent`）/ `query({actor?,action?,target?,from?,to?,limit?})`（新しい順・`describeEvent` の説明付き）/ `history(target)`（古い順）/ `verify()`（`verifyChain` → `{valid, brokenAt}`）/ `size()`。
- API: `GET /api/audit?actor=&action=&target=&from=&to=&limit=`（一覧＋検証結果）、`GET /api/audit/history?target=`。**閲覧は `audit:read`（管理者）のみ**。
- UI: `@platform/ui` の `AuditLogView`（改ざん検証バッジ＋テーブル）。`app/audit/audit-client.tsx`。
- 改ざん（エントリ書き換え）で `valid:false` + `brokenAt` を返すことを検証済み。

---

## 実イベントの結線（監査 / ファイル / 配信設定）

### 監査ログへの記録（`server/audit-actions.ts`）
- `AuditActions`（`createAuditActions(auditLog)`）: `record` / `chatEdit` / `chatDelete` / `boardEdit` / `boardDelete` / `fileUpload` / `fileDelete`。各操作の入口から呼ぶと、`auditLog.record` にハッシュチェーン付きで積まれる。
- 結線済みの操作:
  - チャットメッセージ編集/削除 → `PATCH`/`DELETE /api/chat/rooms/[roomId]/messages/[messageId]`（認証ユーザーを actor に記録）。
  - 掲示板投稿編集/削除 → `PATCH`/`DELETE /api/board/threads/[threadId]/posts/[postId]`。
  - ファイル削除/アップロード → `DELETE /api/files`・`POST /api/files/upload`。
- これらは `/api/audit` から検索・検証できる（改ざんがあれば `verify()` が `valid:false` を返す）。

### ファイルアップロードの結線
- `POST /api/files/upload`（汎用・multipart）: `@platform/storage` に保存 → `fileManager.register` で一覧へ反映 → 監査記録。
- チャット添付 `POST /api/chat/rooms/[roomId]/attachments`: アップロード＋サムネイル生成に加え、`fileManager.register` で一覧へ反映。
- どちらも `GET /api/files` に現れ、`FileList` で表示・削除できる。

### 通知の配信設定（`server/notification-prefs.ts`）
- `PreferenceStore`（memory / prisma）＋ `decideDelivery(store, userId, event, now?)`。`@platform/notify` の `resolveDelivery` に委譲し、カテゴリ別のチャネル・受信方法（immediate/digest/off）・静音時間を判定する。
- **メンション結線**: `chat.ts` の `notifyMentions` が、メンション時に受信者の設定を `decideDelivery({category:"mention"})` で確認し、`inApp` が有効なら通知センターへ、`email` が有効ならメール送信する（off や静音時間なら送らない。緊急は静音時間でも即時）。
- API: `GET /api/notifications/preferences`、`PUT /api/notifications/preferences`（`NotificationPreference` を全置換）。
- Prisma: `NotificationPreferenceRow`（defaultChannels / categories を JSON、quietStart / quietEnd）。memory 実装とパリティ検証済み。

---

## 設定UI / CSVエクスポート / ダッシュボード

### 通知設定 UI
- `@platform/ui` の `NotificationPreferences`（既定チャネルのオン/オフ、カテゴリ別の受信方法 immediate/digest/off、静音時間の開始・終了）。
- `app/notifications/preferences/preferences-client.tsx` が `GET`/`PUT /api/notifications/preferences` と結線。保存すると `notifyMentions` の配信判定に即反映される。

### 監査ログ CSV エクスポート
- `audit-log.ts` の `exportCsv(query)` が `@platform/csv` の `toCsv` で CSV 化（Excel 文字化け防止の BOM 付き、日本語ヘッダ）。検索条件は `/api/audit` と同じ。
- `GET /api/audit/export?actor=&action=&target=&from=&to=&limit=` → `text/csv` を `audit-YYYYMMDD.csv` としてダウンロード。管理者のみ。

### ダッシュボード
- `GET /api/dashboard` が、未読通知数・最近の通知5件・最近のファイル5件・（管理者は）直近の監査イベント5件＋チェーン検証結果をまとめて返す。
- `@platform/ui` の `StatCard`（指標カード）＋既存の `FileList` / `AuditLogView` を使う `app/dashboard/dashboard-client.tsx` が入口画面を構成。各カードは通知/ファイル/監査ページへのリンク。

---

## 監査の拡充 / Prisma永続化 / ダッシュボード拡充

### 業務イベントの監査記録
- `audit-actions.ts` に業務操作を追加: `expenseSubmit` / `expenseDecision`（approve/reject/sendback）/ `invoiceIssue`。
- 結線済み: 経費申請の作成（`POST /api/expenses/requests`）と承認操作（`POST /api/expenses/requests/[id]`）で、認証ユーザーを操作者として自動記録。`/api/audit` から `expense.*` / `invoice.*` で検索できる。

### 監査ログの Prisma 永続化
- `audit-log.ts` の `AuditStore` を `all` / `last` / `append`（＋テスト用 `replace`）に再設計し、`record` を末尾ハッシュのみ参照する O(1) 追記に。
- `createPrismaAuditStore(db)`（`AuditEntryRow`）でハッシュチェーンを DB に永続化。`CHAT_PERSISTENCE=prisma` で有効。
- **決定的チェーン**: 同じイベント列なら memory と Prisma で完全に同一の hash になることを検証済み。DB の行を書き換えると `verify()` が `valid:false` + `brokenAt` を返す（永続化後も改ざん検知が効く）。
- Prisma: `AuditEntryRow`（seq 主キー・before/after を JSON・prevHash/hash、actor/target/at にインデックス）。

### ダッシュボードのウィジェット拡充
- `GET /api/dashboard` に **承認待ち総数**（`expenseRequest.status="pending"`）と **自分の申請のうち承認待ち**（担当タスク）を追加。テーブルが無い環境では 0 を返す安全設計。
- `dashboard-client.tsx`: 承認待ち・担当タスクのカードを追加し、監査イベントに **期間指定（from/to の日付フィルタ）** を追加（`/api/audit?from=&to=` を 250ms デバウンスで再取得）。

---

## 監査詳細 / ダッシュボード設定 / アクセス解析 / 負荷テスト

### 監査ログの詳細画面（before/after 差分）
- `@platform/audit` の `diffChanges` を使い、`audit-log.ts` に `entry(seq)` を追加（説明 + `FieldChange[]` を返す）。
- `GET /api/audit/[seq]` で 1 エントリを差分つきで取得。`@platform/ui` の `AuditEntryDetail`（フィールドごとの変更前=赤／変更後=緑）で可視化。
- `AuditLogView` に `onSelect(seq)` を追加し、`audit-client.tsx` で行クリック→詳細表示。

### ダッシュボードのカスタマイズ
- `dashboard-prefs.ts` の `DashboardPrefStore`（memory / prisma）＋純関数 `normalizeWidgets`（既知キーのみ・重複排除・順序保持）/ `isWidgetVisible`。
- `GET`/`PUT /api/dashboard/preferences` で表示ウィジェットを保存。`DashboardSettings`（チェックボックス）＋ `dashboard-settings-client.tsx`。
- `dashboard-client.tsx` は設定を取得して各ウィジェットを条件表示する。
- Prisma: `DashboardPrefRow`（widgets を JSON）。

### アクセス解析（`@platform/analytics` + `analytics-store.ts`）
- 新パッケージ `@platform/analytics`（純ロジック）: `AnalyticsEvent` モデルと集計 `pageViews` / `uniqueVisitors` / `uniqueUsers` / `topPages` / `referrerBreakdown` / `timeSeries`（hour/day）/ `bounceRate` / `summarize`。
- `analytics-store.ts` の `Analytics`（memory / prisma）: `track` / `summary` / `series`。
- API: `POST /api/analytics`（計測ビーコン・認証不要）、`GET /api/analytics?from=&to=&bucket=`（概況＋時系列・管理者のみ）。`analytics-client.tsx` が概況カード・推移バー・人気ページ・参照元を表示。
- Prisma: `AnalyticsEventRow`（at/path/sessionId にインデックス）。

### 負荷テスト（`@platform/loadtest`）
- 新パッケージ `@platform/loadtest`（純ロジック）: `percentile` / `latencyStats`（min/max/mean/p50/p90/p95/p99）と、並列ワーカーで非同期リクエストを駆動する `runLoad`（concurrency・durationMs / iterations、スループット・エラー率・ステータス別集計）。フェイク時計注入で決定的にテスト可能。
- CLI: `tools/loadtest.mjs`（`--url --concurrency --duration|--iterations --method`、`--dry` でフェイク実行）。ビルド後のワークスペースで実行する。

---

## HTMLヘルパー / 計測ビーコン / 負荷シナリオ / 監査ネスト差分

### @platform/html（新パッケージ・純ロジック）
- エスケープ（`escapeHtml`/`unescapeHtml`/`stripTags`）、空白・改行（`nl2br`/`normalizeNewlines`/`collapseWhitespace`/`normalizeSpace`/`stripControlChars`）、全角⇔半角（`zenkakuToHankaku`/`hankakuToZenkaku`/`zenkakuSpaceToHankaku`/`zenkakuDigitsToHankaku`）、テキスト→HTML（`textToHtml`＝エスケープ＋`nl2br` の XSS 安全変換、`truncate`、`linkify`）。詳細は `packages/html/README.md`。

### アクセス解析のリアルタイム計測結線
- `@platform/analytics` に `browser.ts`（`createBeacon`）を追加。`navigator.sendBeacon` を優先し、無ければ `fetch(keepalive)` にフォールバックする計測ビーコン（フレームワーク非依存）。`ensureSessionId` でセッションIDを維持。
- `app/analytics/beacon-client.tsx`（`BeaconClient`）をレイアウトに置けば、マウント時に現在パスのページビューを `POST /api/analytics` へ送信し、`GET /api/analytics` の集計に即反映される。公開サイト基盤にもそのまま流用できる。

### 負荷テストのシナリオ定義
- `@platform/loadtest` に `scenario.ts` を追加。重み付きステップ（`ScenarioStep`）を `weightedPick` で選び、`runScenario` がステップ別＋全体の統計を集計。`activeWorkers` によるランプアップ（並列数を時間で 1→concurrency に線形増加）に対応。すべてフェイク時計・固定乱数で決定的にテスト可能。

### 監査ログのネスト差分＋関連エントリ
- `@platform/audit` に `deepDiffChanges` を追加（ネストしたオブジェクトを再帰比較し `address.city` のようなパス単位の差分を返す）。
- `audit-log.ts` の `entry(seq)` を、ネスト差分＋**同じ対象（target）の関連エントリ**（自分を除く・古い順）を返すよう拡張。`AuditEntryDetail` に関連エントリ一覧を追加し、`onJump` でエントリ間をたどれる。

---

## 公開サイト基盤アプリ / チャット・掲示板のリンク化

### apps/public-site（2 つ目のアプリ）
- `@platform/site`（ページ・メニュー・お知らせ・ブロック）、`@platform/seo`（メタ・OGP・JSON-LD・robots）、`@platform/html`（本文の安全な HTML 化）、`@platform/analytics`（計測ビーコン）を組み合わせた公開サイトの基盤。
- `src/server/site-content.ts`: コンテンツソース（既定インメモリ・CMS/DB へ差し替え可）と `renderBlock`／`renderPage`。テキストブロックは `nl2br(linkify(...))` でエスケープ＋改行 `<br>`＋URL リンク化（**二重エスケープを避けて XSS 安全**）。heading/list/cta/image に対応。
- `src/server/seo.ts`: `pageMeta`（`buildMeta` に委譲・description は最初の text ブロックから推定）と `pageHead`（meta タグ＋website/breadcrumb の JSON-LD）。
- `src/app/`: `page.tsx`（ホーム）、`[slug]/page.tsx`（動的ページ・パンくず・お知らせ・計測ビーコン）、`block-renderer.tsx`、`robots.txt/route.ts`。
- コンテンツ描画・お知らせの前方一致・SEO メタ生成をスモークで検証済み。

### チャット・掲示板本文の URL 自動リンク化
- `MessageBubble` と `PostCard` に `renderLinks`（既定 true）を追加。`@platform/html` の `linkify` でエスケープしてから URL を `<a target="_blank" rel="noopener noreferrer">` 化する（XSS 安全）。`renderLinks={false}` で従来のプレーン表示。

---

## サイト構築機能の拡充（バナー/広告・アイキャッチ・ギャラリー・シェア他）

### ロジック（純関数）
- **@platform/seo**: `buildSitemap`/`buildSitemapIndex`（sitemap.xml 生成）、`faviconLinks`/`faviconMetadata`（ファビコン・各種アイコンの link/meta タグ、Next.js の Metadata.icons 形式）。
- **@platform/html**: `embed.ts`（計測タグ・埋め込み）— `embedScript`/`inlineScript`/`embedIframe`（lazy 既定）/`trackingPixel`（noscript）/`embedHtml`（信頼済み生 HTML をそのまま）/`escapeAttribute`。
- **@platform/site**: `banner.ts`（`Banner` モデル・`activeBanners`（期間+枠+パス前方一致）・`pickBanner`（重み付き）・`rotateBanner`）、`copyright.ts`（`copyrightText`＝開始年〜現在年、同年は単年、rightsText 対応）。
- **@platform/board**: `category.ts`（ブログのカテゴリ）— 階層 `categoryTree`・`descendantIds`・`filterByCategory`（子孫含む/直下のみ）・`countByCategory`・`categoryPath`（パンくず）・`findCategoryBySlug`。
- **@platform/social**: `share.ts` — `shareUrl`（X/Facebook/LINE/はてブ/LinkedIn/メール/WhatsApp/Telegram）・`shareLinks`。
- **@platform/ui/lib/motion**: `easing`（各種イージング）・`parallaxOffset`・`scrollProgress`・`revealStyle`・`transitionPresets`（純関数）。

### UI コンポーネント（@platform/ui・全 157 個）
- **BannerAd**（バナー広告・PR 表記・閉じる）、**Eyecatch**（アイキャッチ画像＋タイトルオーバーレイ）、**CtaButton**（CTA ボタン・variant/size/block）、**CopyrightNotice**、**SocialShare**（SNS シェアボタン・ブランド色）、**SlideGallery**（サムネイル＋拡大・前後送り）、**Sidebar**（折りたたみ 2 カラム）、**NavDropdown**（データ駆動のナビ・ドロップダウン）、**Parallax**/**Reveal**（スクロール連動・IntersectionObserver）。
- 既存で対応済み: 画像スライダー＝`Carousel`、範囲入力＝`Slider`、タブ＝`Tabs`、素の`DropdownMenu`（Radix 風プリミティブ）。

### 公開サイトへの結線
- `GET /sitemap.xml`（全公開ページを列挙）を public-site に追加。
- `site-content.ts` に **サイト内検索**（`@platform/search` の BM25）を追加：`search(query)` がタイトル＋本文からヒットを返す（初回検索時に遅延インデックス構築）。`pageText` でページのテキストを抽出。

---

## 公開サイトへのサイト構築機能の組み込み

### コンテンツモデルの拡張（site-content.ts）
- **ブログ記事**（`BlogPost`：slug/title/categoryId/excerpt/eyecatch/body/publishedAt/tags）と **カテゴリ**（`@platform/board` の `Category`）、**バナー**（`@platform/site` の `Banner`）を保持。
- メソッド追加: `posts`（新しい順）/`post`/`postsByCategory`（子孫含む）/`categories`/`categoryTree`/`categoryBySlug`/`categoryBreadcrumb`/`categoryCounts`/`banners`（枠・パス）/`pickBanner`（重み付き）。
- サイト内検索は **ページ＋記事を横断**（`page:`/`post:` プレフィックスで振り分け、`SearchResult.kind` で種別を返す）。

### 実ページ・共通コンポーネント（apps/public-site）
- **SiteHeader**（`NavDropdown` によるドロップダウン付きナビ＋検索窓→`/search`）。レイアウトに常設。
- **SiteSidebar**（カテゴリ一覧（件数つき）＋`BannerAd` のスポンサー枠）。
- **フッター**に `CopyrightNotice`（開始年〜現在年）。
- ページ: `/search`（横断検索結果・`robots: noindex`）、`/blog`（記事一覧＋サイドバー）、`/blog/category/[slug]`（カテゴリ別＋パンくず）、`/blog/[slug]`（記事本文＝`Eyecatch`＋`nl2br(linkify(body))` の安全描画＋`SocialShare`＋タグ）。
- 記事・一覧・カテゴリの各ページに計測ビーコンを設置。

---

## 関連記事・タグ・フィード・CMS 管理画面

### ロジック（純関数）
- **@platform/board `blog.ts`**: `adjacentPosts`（前=古い/次=新しい）、`relatedPosts`/`relatednessScore`（共通タグ+同一カテゴリで加点・スコア 0 除外）、`allTags`（多い順）、`postsByTag`。
- **@platform/seo `feed.ts`**: `buildRssFeed`（RSS 2.0・guid・atom:self）、`buildAtomFeed`（Atom・ISO 日時）。XML エスケープ込み。

### 公開サイト（apps/public-site）
- `site-content.ts` に `tags`/`postsByTag`/`adjacent`/`related` を追加（内部で slug を id にマップして board ロジックへ委譲）。
- ページ: `/blog/tag/[tag]`（タグ別一覧）、記事ページに **前後ナビ＋関連記事＋タグリンク**、`GET /feed.xml`（RSS 配信）。

### 社内 CMS 管理画面（apps/internal-app）
- **cms-store.ts**: 記事 CRUD（memory / prisma）。`validatePostInput`/`isValidSlug`（英小文字・数字・ハイフン）、draft/published 状態、公開時に `publishedAt` 確定、slug 変更対応。memory と Prisma のパリティを検証済み。
- API: `GET/POST /api/cms/posts`、`GET/PUT/DELETE /api/cms/posts/[slug]`（`cms:read`/`cms:write` 権限・監査記録 `cms.post.create|update|delete`）。
- UI: **BlockEditor**（見出し/本文/画像/リスト/CTA の追加・編集・並べ替え・削除）、`cms-client.tsx`（記事一覧・作成・編集フォーム・公開切替・削除）。
- Prisma: `CmsPostRow`（slug 主キー・tags を JSON・status/updatedAt にインデックス）。計 19 モデル。

---

## CMS 共有パッケージ化 / 公開サイト連携 / 予約公開 / 画像アップロード / プレビュー

### @platform/cms（新パッケージ・ドメイン共有）
- CMS のドメインを `@platform/cms` に集約し、社内アプリと公開サイトの両方が同じロジックを使う（基盤=ロジックの徹底）。
- `model`（`CmsPost`/`validatePostInput`/`isValidSlug`/`toPost`）、`store`（memory / prisma・`createMemoryCmsStore`/`createPrismaCmsStore`）、`scheduling`（`effectiveStatus`/`isLive`/`livePosts`/`scheduledPosts`）、`adapter`（`cmsPostToBlog`/`liveBlogViews`）。
- `internal-app/server/cms-store.ts` はこのパッケージの再エクスポートに変更。

### 予約公開（scheduled publish）
- `status=published` でも `publishedAt` が未来なら **予約**（`effectiveStatus="scheduled"`・読者には非表示）、過去/現在なら **公開中**。時刻の到来で自動的に公開扱いになる（純関数なので判定は都度評価）。
- CMS 一覧 API は各記事に `effectiveStatus` を付与して返す。エディタに公開日時（`datetime-local`）を追加。

### 公開サイトとの連携
- 公開サイトの `content.ts` は、CMS 由来の記事を `liveBlogViews`（下書き・予約を除外）で取り込み、手書き記事と合流。**CMS で公開した記事だけがサイトに出る**。本番では社内アプリと同一 DB を `@platform/cms` 経由で参照する構成。

### 画像アップロード・プレビュー
- `POST /api/cms/upload`（`@platform/upload` + storage を再利用・画像 MIME 限定）。返り値の `url` を CMS エディタがアイキャッチに設定。
- CMS エディタに **プレビュー**（本文を `nl2br(linkify())` で安全に描画・アイキャッチ表示）を追加。

---

## 予約公開の一覧UI / 記事内ギャラリー・埋め込み / 公開サイトのプレビュー

### 予約公開の一覧UI（apps/internal-app）
- `@platform/cms` に `msUntilPublish`（予約公開までの残りミリ秒・公開中は null）を追加。
- CMS 管理画面にタブ（すべて / 公開中 / 予約 / 下書き）を追加し、実効ステータスで絞り込み。予約記事は「公開まで N 日 M 時間」のカウントダウンを表示。

### 記事内のギャラリー・埋め込み
- `renderBlock` に **gallery**（複数画像）と **embed**（iframe URL → `embedIframe` で組み立て、または信頼済み生 HTML → `embedHtml`）を追加。
- 公開サイトの `BlockRenderer` は gallery を `SlideGallery`、embed を `dangerouslySetInnerHTML`（iframe はレスポンシブ）で描画。
- **BlockEditor** に gallery（画像 URL を 1 行 1 枚）・embed（iframe URL / 生 HTML）の編集 UI を追加。

### 公開サイトのプレビュー（下書き・予約確認）
- `apps/public-site/src/server/preview.ts`：`isValidPreviewToken`（環境変数 `PREVIEW_TOKEN` と一致）、`getPreviewPost`（全ステータスから slug で取得し、ブログビュー＋実効ステータスを返す）。
- ページ `/preview/[slug]?token=...`：トークンが正しければ、下書き・予約記事を公開時のレイアウト（Eyecatch ＋ 安全な本文描画）で表示。ステータスのバッジと「公開されていない」注意書き付き。`robots: noindex`。

---

## プレビューURL発行 / お知らせ管理 / 固定ページのCMS化

### プレビューURLの発行（apps/internal-app）
- `@platform/cms` に `buildPreviewUrl(baseUrl, slug, token)`（末尾スラッシュ除去・encode）。
- `GET /api/cms/preview-url?slug=...` が公開サイトの `/preview/[slug]?token=...` を組み立てて返す（`PREVIEW_TOKEN`/`PUBLIC_SITE_URL` を使用）。CMS 記事エディタに「公開サイトでプレビュー ↗」ボタンを追加。

### お知らせ管理
- `@platform/cms` に `announcement`（`AnnouncementInput`/`validateAnnouncementInput`/store memory・prisma）。表示判定 `activeAnnouncements` は `@platform/site` 側。
- API: `GET/POST /api/cms/announcements`、`PUT/DELETE /api/cms/announcements/[id]`（監査記録つき）。UI: `AnnouncementClient`（メッセージ・表示期間・対象パス・CTA・重要度の編集）。
- Prisma: `AnnouncementRow`。

### 固定ページの CMS 化
- `@platform/cms` に `page`（`ManagedPage`/`PageInput`/`validatePageInput`（空 slug=トップ許可）/store memory・prisma/`livePageViews`（公開ページ→`Page` 変換））。`Page`/`PageBlock` は `@platform/site` を再利用。
- API: `GET/POST /api/cms/pages`、`GET/PUT/DELETE /api/cms/pages/[slug]`（監査記録つき）。UI: `PageClient`（`BlockEditor` でブロック編集・下書き/公開切替）。
- Prisma: `CmsPageRow`（blocks を JSON）。計 21 モデル。
- CMS 管理画面に横断ナビ（記事 / 固定ページ / お知らせ）を追加。
- `@platform/cms` は `@platform/site` に依存（型・表示判定の再利用）。循環依存なしを確認済み。

---

## 固定ページ・お知らせの公開反映 / カテゴリ・タグ管理 / メディアライブラリ

### 固定ページ・お知らせの公開サイト反映
- 公開サイトの `content.ts` が、公開中の管理ページを `livePageViews`（下書き除外＋`Page` 変換）で取り込み、手書きページと合流。管理お知らせも合流。記事と同じく、本番は同一 DB を `@platform/cms` 経由で参照。

### カテゴリ・タグ管理（apps/internal-app）
- `@platform/cms` に `category-store`（`Category` は `@platform/board`。CRUD ＋ `reorder`（order 振り直し）・memory / prisma）と `tags`（`renameTagInPosts`/`mergeTagsInPosts`/`removeTagFromPosts`・純関数）。
- API: `GET/POST/PATCH /api/cms/categories`（PATCH=並べ替え）、`PUT/DELETE /api/cms/categories/[id]`、`GET/POST /api/cms/tags`（POST=リネーム/統合/削除を全記事へ一括適用）。
- UI: `CategoryClient`（カテゴリ CRUD ＋ 上下並べ替え、タグのリネーム/削除）。Prisma: `CategoryRow`。計 22 モデル。

### メディアライブラリ
- `GET /api/cms/media`（`fileManager.list({ prefix: "cms" })` で画像のみ抽出・URL 付き）。
- UI: `MediaClient`（アップロード済み画像の一覧）。記事エディタのアイキャッチに「ライブラリから選択」ピッカーを追加（アップロード済み画像をクリックで設定）。
- CMS 横断ナビに「カテゴリ・タグ」「メディア」を追加。`@platform/cms` は `@platform/board` にも依存（Category 再利用）。循環なし確認済み。

---

## カテゴリの公開反映＋記事の分類選択 / CMS ダッシュボード / ドラッグ&ドロップ並べ替え

### カテゴリの公開反映＋記事エディタの分類選択
- 公開サイトの `content.ts` が管理カテゴリを既存のコード定義カテゴリと合流（本番は同一 DB を参照）。
- 記事エディタ（`cms-client`）のカテゴリ欄をテキスト入力から**ドロップダウン**に変更し、`GET /api/cms/categories` の一覧から選択できるようにした。

### CMS ダッシュボード
- `@platform/cms` に `summarizePosts`（実効ステータスで total/published/draft/scheduled を集計）・`recentPosts`（更新新しい順＋状態）。
- `GET /api/cms/dashboard`（記事の状態別件数・固定ページ/お知らせ/カテゴリ数・最近の更新）。UI: `DashboardClient`（統計カード＋最近更新した記事）。CMS 横断ナビ先頭に「ダッシュボード」を追加。

### ドラッグ&ドロップ並べ替え
- `@platform/ui` に `SortableList`（HTML5 Drag and Drop・`moveItem` 純関数つき・全 159 コンポーネント）。
- カテゴリ管理（`CategoryClient`）とブロックエディタ（`BlockEditor`）の並べ替えを、上下ボタンから **D&D** に置き換え。

---

## 記事の検索・絞り込み / カテゴリ対応の通し確認 / CMS 操作履歴

### 記事の検索・絞り込み（apps/internal-app）
- `@platform/cms` に `filterPosts(posts, { query?, categoryId?, tag?, status? }, now)`（純関数・タイトル/抜粋/本文/タグ横断の部分一致、カテゴリ・タグ完全一致、実効ステータス）。
- 記事一覧に検索窓＋カテゴリ/タグのドロップダウンを追加し、状態タブと組み合わせて絞り込み。

### カテゴリ対応の通し確認
- CMS 記事の `categoryId` が `liveBlogViews` で保持され、公開サイトの `postsByCategory` と対応することを検証。サンプルの記事 `categoryId`（tech/frontend/backend/life）はすべて公開サイトのカテゴリ定義に一致。

### CMS 操作履歴
- `GET /api/cms/history`（監査ログを `filterByAction("cms")` で `cms.*` に絞り込み。`?target=` で特定コンテンツに完全一致で絞れる）。
- UI: `HistoryClient`（記事/ページ/お知らせ/カテゴリ/タグ別のタブ、操作の日本語ラベル表示）。CMS 横断ナビに「操作履歴」を追加。CMS 操作（作成/更新/削除/並べ替え/タグ操作）はすべて監査チェーンに記録される。

---

## CMS 権限の細分化 / 記事の変更履歴・自動保存 / 公開申請の承認フロー

### 権限の細分化（read / edit / publish）
- 権限を `cms:read`（閲覧）・`cms:edit`（作成・編集＝下書き保存）・`cms:publish`（公開）に分割。ロールに `editor`（employee + cms:publish）を追加。全 CMS route を `cms:edit` に統一。
- 記事の作成/更新で公開しようとした際、`cms:publish` が無ければ下書き保存にとどめ、公開申請を自動作成（`isPublishAction` で判定）。

### 記事の変更履歴・自動保存
- `@platform/cms` に `revision`（`Revision`/`snapshotOf`/`revisionToInput`/store memory・prisma。保存ごとに版を採番、`revisionToInput` で前の版に下書きとして戻す）。
- API: `GET /api/cms/posts/[slug]/revisions`、`POST /api/cms/posts/[slug]/revisions/[id]/restore`。記事の作成/更新/復元でリビジョンを記録。
- UI: 記事エディタに「変更履歴」（版一覧＋この版に戻す）と、編集内容が変わってから 2 秒後の**自動保存**（下書き保存＋保存時刻表示）。Prisma: `CmsRevisionRow`（`@@unique[postSlug,version]`）。

### 公開申請の承認フロー
- `@platform/cms` に `publish-request`（`PublishRequest`/store memory・prisma。同一記事の pending は再利用、`decide` で承認/却下）。
- API: `GET /api/cms/publish-requests`（cms:publish 必須）、`POST /api/cms/publish-requests/[id]/decision`（承認時に対象記事を公開）。
- UI: `PublishRequestClient`（承認待ち/すべてのタブ、承認して公開／却下）。CMS 横断ナビに「公開申請」を追加。公開権限の無い編集者には公開チェックが「公開を申請する（承認後に公開）」表示に変わる。Prisma: `PublishRequestRow`。計 24 モデル。

---

## 公開申請の通知連携 / 記事版の差分表示 / 在庫管理（CMS 以外の業務領域）

### 公開申請の通知連携
- 公開申請の作成時に承認者インボックス（`cms-approvers`）と申請者へ通知、承認/却下時に申請者へ結果を通知（`notificationCenter` を各ルートに配線）。通知には遷移先 `href` を付与。

### 記事版の差分表示
- `@platform/cms` に `diff`（`diffLines` = LCS ベースの行差分、`diffRevisions` = タイトル/状態/カテゴリ/本文の差分・純ロジック）を追加。
- UI: 記事エディタの「変更履歴」に「現在と比較」を追加し、選んだ版と編集中の内容の差分（タイトル・状態・カテゴリの変化＋本文の追加/削除行を色分け）を表示。

### 在庫管理（新しい業務領域）
- `@platform/inventory`（入出庫台帳・現在庫・発注点・FEFO などの純ロジック）を土台に、アプリ側へ在庫リポジトリ `inventory-repo`（商品マスタ＋入出庫台帳、`onHand`/`summarize`/`needsReorder`/`reorderQuantity` を委譲・memory/prisma パリティ）を実装。
- API: `GET /api/inventory`（在庫状況＝現在庫・入出庫計・発注要否・推奨発注量）、`POST /api/inventory`（商品登録）、`POST /api/inventory/movements`（入出庫記録）。権限は `inventory:read`（全社員）・`inventory:write`（manager 以上）。
- UI: `/inventory`（在庫一覧＋発注アラート、入出庫の記録、商品登録）。Prisma: `ProductRow`/`StockMovementRow`。計 26 モデル。経費承認に続く 2 つ目の業務ワークフローとして、CMS 以外の領域を追加。

---

## 在庫の拡充（倉庫別・ロット期限） / 在庫と発注の連携 / 請求書管理

### 在庫の拡充（倉庫別在庫・ロット期限・入出庫履歴）
- 入出庫に倉庫・ロット・期限（`warehouse`/`lotId`/`expiry`）を持たせ、`inventory-repo` に `detail(sku, asOf, expiryDays)` を追加。`@platform/inventory` の `onHandByWarehouse`（倉庫別在庫）・`expiringSoon`/`expiredLots`（期限管理）に委譲。
- API: `GET /api/inventory/[sku]`（台帳＋倉庫別在庫＋期限切れ/間近ロット）。UI: 在庫一覧の SKU クリックで詳細を展開（倉庫別残高、期限アラート、入出庫履歴）。入出庫フォームに倉庫・ロット・期限の入力を追加。Prisma: `StockMovementRow` に `warehouse`/`lotId`/`expiry` を追加。

### 在庫と発注の連携（発注書ドラフト）
- `purchase-draft`（`buildReorderPurchaseOrder`）で、発注点を割った商品だけを明細にした発注書ドラフトを `@platform/purchase` の `buildPurchaseOrder` で起票。
- API: `POST /api/inventory/reorder-draft`（発注番号を自動採番、対象が無ければ通知）。UI: 発注アラートから「発注書ドラフトを作成」で明細プレビューを表示。

### 請求書管理（新しい業務領域）
- `invoice-repo`（請求書＝ヘッダ＋明細＋合計、発行/入金/取消の状態を保持・memory/prisma パリティ）を `@platform/invoice` の `buildInvoice`/`invoiceTotals`/`paymentStatus`/`balanceDue` に委譲して実装。入金状況は issued/overdue/paid/cancelled を自動判定、税率別内訳（`taxByRate`）も算出（適格請求書対応）。
- API: `GET/POST /api/invoices`（一覧・作成）、`POST /api/invoices/[number]/payment`（入金記録）。権限は `invoice:read`（全社員）・`invoice:write`（manager 以上）。UI: `/invoices`（入金状況バッジつき一覧、明細入力フォーム、入金記録）。Prisma: `InvoiceRow`（明細は JSON、合計は読込時に再計算）。計 27 モデル。経費・在庫に続く 3 つ目の業務領域。

---

## 請求書の深掘り（HTML・督促・エイジング） / 見積からの変換 / 発注の永続化と入荷

### 請求書の深掘り（適格請求書HTML・督促・売掛金エイジング）
- `receivables`（`receivablesSummary`）で、未収の請求書から売掛金エイジング（`agingBuckets`）と督促（`dunningLevel`/`dunningMessage`）を集計。取消・完済は除外、督促は経過日数の降順。督促レベルは reminder（1日〜）/first（14日〜）/second（30日〜）/final（60日〜）。
- API: `GET /api/receivables`（エイジング＋督促サマリー）、`GET /api/invoices/[number]/html`（`renderInvoiceHtml` による適格請求書レイアウト）。UI: `/invoices` にエイジング5区分パネル＋督促一覧（文面表示）、各請求書に HTML リンクを追加。

### 見積からの変換（見積→請求書）
- `quote-repo`（見積＝ヘッダ＋明細＋合計、状態を保持・memory/prisma パリティ）を `@platform/quote` の `buildQuote`/`quoteStatus`/`daysUntilExpiry`/`convertToInvoice` に委譲して実装。状態は draft/sent/accepted/rejected/expired（有効期限切れは自動で expired）。
- API: `GET/POST /api/quotes`（一覧・作成）、`POST /api/quotes/[number]/state`（状態遷移）、`POST /api/quotes/[number]/convert`（請求書へ変換し見積は accepted に）。権限は `quote:read`/`quote:write`。UI: `/quotes`（状態・残日数つき一覧、明細入力、送付/失注、請求書化）。Prisma: `QuoteRow`。

### 発注の永続化と入荷（発注→入荷→在庫）
- `purchase-repo`（発注書＋SKU列＋入荷実績を保持・memory/prisma パリティ）を `@platform/purchase` の `receivingStatus`/`purchaseStatus`/`totalOutstanding` に委譲。入荷記録は在庫連携用に SKU と数量を返す。
- API: `GET/POST /api/purchase-orders`（一覧・発注点割れからの起票保存）、`POST /api/purchase-orders/[number]/receipts`（入荷記録→対応 SKU の在庫に入庫として反映）。権限は `purchase:read`/`purchase:write`。UI: `/purchase-orders`（入荷状況つき一覧、明細ごとの入荷、発注点割れからの起票）。Prisma: `PurchaseOrderRow`。計 29 モデル。在庫→発注→入荷→在庫が一巡し、見積→請求→入金と合わせて受発注・請求の主要フローが揃った。

---

## 繰り返し請求（サブスク） / 勤怠の打刻・残業集計 / 会計仕訳・試算表

### 繰り返し請求（サブスク）
- `recurring-repo`（プラン＝宛先＋周期＋明細を保持・memory/prisma パリティ）を `@platform/invoice` の `RecurringSchedule`/`nextBillingDate`/`dueForBilling` に委譲して実装。周期は毎月/四半期/毎年。各プランに次回請求日と課金要否（active かつ due）を算出して表示する。
- `invoiceFromPlan(plan, header)` でプランから請求書を生成（`buildInvoice`）。一括請求では課金対象のプランを検出し、請求書番号 `{プラン番号}-{YYYYMMDD}` で起票して二重起票を防ぎ、支払期限は 14 日後、起票後に lastBilled を更新する。
- API: `GET/POST /api/recurring`（一覧・作成）、`POST /api/recurring/[number]/toggle`（有効/停止）、`POST /api/recurring/run`（課金対象を一括で請求書化）。権限は `invoice:read`/`invoice:write`。UI: `/recurring`（次回請求日・要請求バッジつき一覧、作成、有効/停止、課金対象を請求書化）。Prisma: `RecurringPlanRow`。

### 勤怠の打刻・残業集計
- `attendance-repo`（打刻＝出退勤＋休憩＋法定休日フラグを保持・memory/prisma パリティ）を `@platform/payroll` の `splitDailyWork`/`parseTimeToMinutes` に委譲。実労働・時間外（法定労働 480 分超）・深夜（22:00〜翌5:00）・法定休日の各区分を日ごとに集計し、月次で合算する。退勤が出勤より前なら日をまたぐ勤務として扱い、同日の再打刻は上書きする。
- API: `GET /api/attendance?month=YYYY-MM`（本人の月次勤務表＋集計）、`POST /api/attendance`（打刻記録）。権限は `attendance:read`/`attendance:write`（本人の勤怠）。UI: `/attendance`（月ピッカー、実働・時間外・深夜・法定休日の集計、打刻フォーム、勤務表）。Prisma: `AttendanceRow`。

### 会計仕訳・試算表
- `ledger`（アプリ側の組み合わせ）で、請求（売上）・入金・仕入から `@platform/accounting` の `salesJournal`/`receiptJournal`/`purchaseJournal` を使って仕訳を自動生成し、`trialBalance` で試算表、`journalToRows` で仕訳帳の行、`isBalanced` で貸借一致を確認する。取消の請求・発注は除外、入金がある請求は入金仕訳も起こす。日付昇順に並べる。
- API: `GET /api/accounting`（仕訳・試算表・貸借一致フラグ）。権限は `accounting:read`（finance / admin）。UI: `/accounting`（試算表＋貸借一致バッジ＋合計行、仕訳帳）。会計ソフト取込用の元データを提供する。計 31 Prisma モデル。これで受発注→請求→入金→会計の主要フローが仕訳まで一巡し、サブスク課金と勤怠集計も揃った。

---

## 勤怠の申請・承認 / 給与計算 / freee 連携・請求書 PDF

### 勤怠の申請・承認
- `attendance-approval-repo`（申請＝ユーザー×月のワークフロー状態を保持・memory/prisma パリティ）を `@platform/workflow` の `startWorkflow`/`approve`/`reject` に委譲。単一ステップ「上長承認（manager）」で、申請→承認 or 却下（理由必須）を扱い、履歴に承認者・操作・日時を残す。承認・却下は完了後は再操作不可。
- 承認の実行時は、policy が `attendance:approve` を認めている場合にワークフローの上長ロールを満たす actor を組み立てて `approve`/`reject` を呼ぶ。API: `POST /api/attendance/submit`（本人が当月を申請）、`GET /api/attendance/approvals`（承認待ち一覧・`attendance:approve`）、`POST /api/attendance/approvals/decision`（承認/却下）。勤怠の月次 GET には申請状態（pending/approved/rejected）を含める。UI: `/attendance` に「月次を申請」ボタンと状態バッジ、`/attendance-approvals`（上長の承認画面）。Prisma: `AttendanceApprovalRow`（`@@unique([userId, month])`）。

### 給与計算
- `payroll-repo`（従業員ごとの時給・手当・控除設定を保持・memory/prisma パリティ）を `@platform/payroll` の `calcMonthlyPay`/`buildPayslip` に委譲。勤怠の月次集計（実労働・時間外・深夜・法定休日）から、労基法の割増（時間外25%・月60時間超50%・深夜25%・法定休日35%）を適用して給与明細（基本・割増・手当・総支給・控除・差引支給）を組み立てる。月60時間超の時間外は自動で over60 割増に振り分ける。未登録者は既定時給（¥2,000）で計算。
- API: `GET /api/payroll?month=YYYY-MM`（本人の給与明細・`payroll:read`）、`GET/PUT /api/payroll/wage`（給与設定の一覧・登録・`payroll:admin`＝finance/admin）。UI: `/payroll`（月次給与明細の内訳、管理者は時給設定）。Prisma: `WageRow`。

### freee 連携・請求書 PDF
- `freee-export`（アプリ側の組み合わせ）で、会計仕訳を `@platform/accounting` の `prepareBatch`/`journalToFreeeDetails` を使って freee の複式簿記ペイロードへ変換する。勘定科目名→freee 勘定科目 ID の対応表を持ち、未対応の科目がある仕訳は errors に振り分けて送信可能分と分ける（冪等キー付き）。実送信はせずプレビューを返す。API: `GET /api/accounting/freee`（`accounting:read`）。UI: `/accounting` の「freee 形式で書き出し」で送信可能件数・要対応科目を表示。
- `pdf-service`（`@platform/pdf` にレンダラを注入）で請求書 PDF を出力する。ヘッドレスブラウザが設定されていれば PDF バイナリを、未設定ならブラウザの「印刷→PDF 保存」で綺麗に出せる A4・@page 印刷用 HTML を返す。API: `GET /api/invoices/[number]/pdf`（`invoice:read`）。UI: 請求書一覧に「PDF」リンク。計 33 Prisma モデル。これで勤怠→申請・承認→給与、会計→freee 連携、請求書→PDF まで、実務の締め処理が一通り揃った。

---

## 買掛金（債務）管理 / 報酬の源泉徴収・支払調書 / 経営ダッシュボード

### 買掛金（債務）管理
- `payables-repo`（発注への支払記録ストア・memory/prisma パリティ）と、買掛金エイジング・支払予定を作る `payablesSummary`。エイジングは `@platform/invoice` の `agingBuckets`/`outstandingTotal` を流用し、売掛と対称の 5 区分（期限前/1〜30/31〜60/61〜90/90日超）で集計する。支払期限が無い発注は発注日を期限とみなす。取消・完済は除外、支払予定は経過日数の降順。支払を記録すると未払残に反映される。
- API: `GET /api/payables`（エイジング＋支払予定・`purchase:read`）、`POST /api/payables/[number]/payment`（発注への支払記録・`purchase:write`）。UI: `/payables`（買掛金エイジング、支払予定一覧、支払記録）。Prisma: `PurchasePaymentRow`。受注→請求→入金→売掛に対し、発注→支払→買掛が対称に揃った。

### 報酬の源泉徴収・支払調書
- `withholding-repo`（報酬支払ストア・memory/prisma パリティ）と、支払先×区分ごとの年間集計 `reportByPayee`。源泉徴収税の計算は `@platform/tax` の `applyWithholding` に委譲（税抜100万円以下 10.21%、超過分 20.42%）。個人（士業・デザイナー等）への報酬支払に源泉税を適用し、支払額・源泉税・差引支払を算出、年（YYYY）で絞った支払調書を作る。
- API: `GET /api/withholding?year=YYYY`（支払調書サマリー＋明細・`withholding:read`）、`POST /api/withholding`（報酬支払の記録・`withholding:write`＝finance/admin）。UI: `/withholding`（支払調書、報酬支払の記録＋源泉税の自動計算プレビュー）。Prisma: `FeePaymentRow`。

### 経営ダッシュボード
- `dashboard-kpi`（アプリ側の組み合わせ）で、売掛・買掛・在庫・勤怠承認・請求の各サマリーを 1 つの KPI に束ねる。運転資本（売掛未収 − 買掛未払）、期限超過分（エイジングの total − current）、要対応事項の総数（発注要 + 承認待ち + 期限超過請求）を算出する純粋な組み立て。
- API: `GET /api/dashboard/kpi`（`dashboard:read`＝全社員）。既存の受注・在庫・勤怠承認・請求の各ストアを集約。UI: `/overview`（運転資本・売掛未収・買掛未払の指標カードと、発注要・承認待ち・期限超過請求への導線）。計 35 Prisma モデル。これで日々の入力（受発注・勤怠・報酬支払）から締め（請求・支払・給与・会計・源泉）まで、そして全体を俯瞰するダッシュボードまでが一通り揃った。

---

## 月次決算（P&L・B/S） / 消費税集計 / 運用アラート統合

### 月次決算（損益計算書・貸借対照表）
- `financials`（アプリ側の組み合わせ）で、会計仕訳から損益計算書（`profitAndLoss`）と貸借対照表（`balanceSheet`）を作る。集計は `@platform/accounting` に委譲し、勘定科目区分（資産/負債/純資産/収益/費用）は既定の対応表を使う。当期純利益＝収益−費用、純資産＝資産−負債で、両者が整合する（純資産＝当期純利益）。
- API: `GET /api/accounting/statements?month=YYYY-MM`（対象月の請求・仕入で決算・`accounting:read`）。UI: `/closing`（P/L・B/S・消費税集計表を月ごとに表示）。

### 消費税集計
- `financials` の `aggregateRates`（請求書・発注の `totals.taxByRate` 群を税率ごとに合算）と `consumptionTax`（`consumptionTaxSummary` に委譲）で、税率別（10%/8%/0%）の課税売上・仮受消費税・課税仕入・仮払消費税を集計し、納付税額（仮受−仮払、マイナスは還付）を出す。
- 決算 API に同梱（`GET /api/accounting/statements`）。UI: `/closing` の消費税集計表（税率別内訳＋納付税額）。

### 運用アラート統合
- `alerts`（純粋な組み立て）で、期限超過の請求・買掛、承認待ちの勤怠、発注が必要な在庫を通知メッセージの一覧に束ねる。該当が無い項目は出さず、深刻度（warning/info）と遷移先（href）を付ける。`alert-collect` が売掛・買掛・在庫・勤怠承認・請求の現況を各ストアから集めて入力を作る。
- API: `GET /api/alerts`（現在のアラート一覧・`dashboard:read`）、`POST /api/alerts/dispatch`（アラートを自分の通知センターへ配信＝既存の `notificationCenter` 流用）。UI: `/overview` にアラートパネルと「自分に通知する」ボタン。決算・申告・通知まで揃い、内製プラットフォームの主要な業務サイクルが一通り完成した。

---

## 固定資産・減価償却 / 予算実績管理 / 取引先マスタ統合

### 固定資産・減価償却（新パッケージ @platform/depreciation）
- 新パッケージ `@platform/depreciation`（ロジックのみ）で減価償却を計算する。定額法（取得価額÷耐用年数、最終年度に残存簿価1円まで）と定率法（期首簿価×償却率。既定は200%定率法＝2÷耐用年数で、残存年数の均等額を下回れば定額へ切り替え、耐用年数内に1円まで償却しきる）の年次スケジュール、月割償却額、指定年度の期末簿価を返す。
- アプリ側 `asset-repo`（資産台帳ストア・memory/prisma パリティ）が資産を保持し、パッケージのスケジュールから現在簿価・当年償却額・償却累計と台帳サマリー（取得価額計・簿価計・累計計）を出す。API: `GET /api/assets`（台帳＋サマリー・`asset:read`）、`POST /api/assets`（登録・`asset:write`）、`GET /api/assets/[code]/schedule`（償却スケジュール）。UI: `/assets`（台帳、登録、償却表）。Prisma: `AssetRow`。パッケージは 95 個に。

### 予算実績管理
- `budget-repo`（部門×区分×期間の予算ストア・memory/prisma パリティ）と、予算と実績を突き合わせる `budgetVariance`（区分×期間で予算を合算し、差異＝予算−実績、消化率＝実績÷予算）。`actualsFromExpenses` が経費（date/category/amount）を区分×期間の実績に集計する。予算のみ・実績のみの区分も行に含める。
- API: `GET /api/budgets?period=YYYY-MM`（予算 vs 実績。実績は承認済み経費から集計・`budget:read`）、`POST /api/budgets`（予算行の追加・`budget:write`）。UI: `/budgets`（区分別の予算・実績・差異・消化率、合計行）。Prisma: `BudgetRow`。

### 取引先マスタ統合
- `partner-repo`（取引先マスタストア・memory/prisma パリティ）で、得意先・仕入先・報酬支払先を一元管理する。1 社が複数区分を持て、`normalizeKinds` で不正な区分を除去、`filterByKind` で区分絞り込み。Prisma では区分をカンマ区切りで保持する。各業務（請求・発注・源泉徴収など）から取引先コードで参照する土台になる。
- API: `GET /api/partners?kind=`（一覧・区分絞込・`partner:read`＝全社員）、`POST /api/partners`（登録・更新・`partner:write`）。UI: `/partners`（区分タブ、登録・編集）。Prisma: `PartnerRow`。計 38 Prisma モデル。会計は決算・申告・固定資産まで、管理会計は予算実績まで広がり、取引先マスタで各業務の参照先も統合された。

---

## 月次推移・経営分析 / 取引先カルテ（マスタ浸透） / 固定資産の会計連携

### 月次推移・経営分析
- `trend`（アプリ側の組み合わせ）で、請求（売上）・仕入・経費を月ごとに集計し、売上・仕入・経費・粗利（売上−仕入−経費）のトレンドを作る。`monthRange` で期間の月リスト（両端含む・最大36か月・年跨ぎ対応）、`summarizeTrend` で総売上・総粗利・月平均粗利・前月比を出す。取消の請求は売上から除外。
- API: `GET /api/analytics/trend?from=YYYY-MM&to=YYYY-MM`（既定は直近6か月・`dashboard:read`）。UI: `/analytics`（売上＝棒、仕入＋経費＝棒、粗利＝折れ線のインライン SVG グラフ＋月次テーブル）。

### 取引先カルテ（マスタの各業務への浸透）
- `partner-link`（純粋な組み立て）で、取引先マスタの名称を軸に請求（billTo）・発注（supplier）・報酬支払（payee）を名寄せし、取引先ごとの活動（各明細＋請求計・発注計・報酬計）に束ねる。これで取引先マスタが各業務の参照点になる。
- API: `GET /api/partners/[code]/activity`（`partner:read`）。UI: `/partners` の各行「取引」から取引先カルテ（請求・発注・報酬の集約）を表示。

### 固定資産の会計連携
- `depreciation-journal`（アプリ側の組み合わせ）で、資産台帳の当年償却額を「借）減価償却費 / 貸）減価償却累計額」の仕訳に起こす（当年償却0の資産は除外、各仕訳は貸借一致）。`DEPRECIATION_ACCOUNT_TYPES` で減価償却費＝費用・減価償却累計額＝資産（評価勘定）を定義し、`financials.financialStatements` に extraTypes として渡すことで決算（P&L・B/S）へ反映する。減価償却費は費用計上され当期純利益を減らし、減価償却累計額は資産を減らして純資産＝当期純利益の整合を保つ。
- API: `GET /api/assets/journal?year=`（減価償却仕訳・`asset:read`）。月次決算 `GET /api/accounting/statements` は当年の減価償却を織り込み、応答に当年減価償却費を含める。UI: `/assets` の「当年の減価償却仕訳」、`/closing` の P/L に「うち減価償却費」。パッケージ95個・38 Prisma モデルのまま、経営分析の可視化・マスタ浸透・固定資産の会計反映まで揃った。

---

## 部門別会計 / 資金繰り（営業CF） / 取引先マスタの発注・請求への結線

### 部門別会計
- `department`（アプリ側の組み合わせ）の `departmentBudgetVsActual` で、予算（部門×区分）と経費を突き合わせて部門ごとの予算・実績・差異を出す。経費はその区分を予算計上している部門へ按分し（複数部門なら予算額で比例配分・端数は最終部門で調整して欠損なし）、どの部門も計上していない区分は「(未配賦)」に集める。あわせて `departmentPnl` で、部門タグ（JournalLine.department）付きの仕訳から部門別の収益・費用・利益を集計する。
- API: `GET /api/departments?period=YYYY-MM`（`accounting:read`）。UI: `/departments`（部門別の予算・実績・差異・消化率、合計行）。

### 資金繰り（営業キャッシュフロー）
- `cashflow`（アプリ側の組み合わせ）の `monthlyCashFlow` で、実際の入金（収入）と支払（支出）を月ごとに集計し、当月収支・期首からの累計残を出す。`summarizeCashFlow` で総収入・総支出・純CF・期末残高。入金は日付つき入金記録（`receipt-repo`。買掛の支払記録と対称の memory/prisma パリティ）、支出は発注の支払・経費・報酬支払（源泉控除後の手取り）から集める。
- API: `GET /api/cashflow?from=&to=&opening=`（既定は直近6か月・`accounting:read`）、`POST /api/invoices/[number]/receipt`（日付つき入金の記録。請求の入金済み額も同時更新・`invoice:write`）。UI: `/cashflow`（収入＝棒、支出＝棒、累計残＝折れ線のインライン SVG ＋月次テーブル）。Prisma: `InvoiceReceiptRow`。

### 取引先マスタの発注・請求への結線
- 請求書作成 `POST /api/invoices` と発注起票 `POST /api/purchase-orders` が、任意の `partnerCode` を受け取り、取引先マスタから宛先名・仕入先名を解決する（存在しないコードは弾く）。これで名称の二重入力を解消し、取引先マスタが各業務の入力元になる。
- UI: `/invoices` の作成フォームに得意先ドロップダウン（選ぶと宛先を自動補完）、`/purchase-orders` の起票に仕入先ドロップダウン。請求の入金ボタンは日付つき記録（`/receipt`）に切り替え、資金繰りに反映される。計 39 Prisma モデル。部門別・資金繰りまで管理会計が広がり、取引先マスタが作成フローに結線されて入力が省力化された。

---

## 取引先残高一覧 / 年次決算・繰越 / 通知のメール配信

### 取引先残高一覧
- `partner-balance`（アプリ側の組み合わせ）で、取引先マスタを軸に未回収の請求（売掛）と未払の発注（買掛）を名寄せし、取引先ごとの売掛残・買掛残・差引を出す。過入金・過払いはマイナスにせず 0 として扱い、`totalBalances` で全体の債権債務を集計する。
- API: `GET /api/partners/balances`（`partner:read`）。UI: `/partners` の「残高一覧」で取引先別の売掛残・買掛残・差引（合計行つき）を表示。取引先マスタが債権債務の可視化の軸になる。

### 年次決算・繰越
- `year-end`（アプリ側の組み合わせ）の `yearEndClosing` で、期末に収益・費用を締めて当期純利益を繰越利益剰余金へ振り替える決算振替仕訳を作る。`trialBalance` で各勘定残高を求め、収益勘定を借方・費用勘定を貸方で落とし、差額（当期純利益）を繰越利益剰余金へ（利益は貸方、損失は借方）。仕訳は貸借一致し、翌期首へ繰り越す繰越利益剰余金（期首繰越 ＋ 当期純利益）を返す。減価償却費も費用として締める。
- API: `GET /api/accounting/year-end?year=&priorRetained=`（`accounting:read`）。UI: `/closing` の「年次決算・繰越」で当期純利益・翌期繰越の繰越利益剰余金・決算振替仕訳を表示。

### 通知のメール配信
- `mail-service`（`@platform/mail` に Transport を注入）で Mailer を解決し（Transport 未設定なら null）、`alert-mail` の `alertsEmail` でアラート一覧を 1 通のメール（件名・テキスト・HTML）に整形する。アラート配信 `POST /api/alerts/dispatch` は通知センターへの配信に加え、Mailer が設定されていればメールでも送る（この環境では Transport 未設定のため通知のみ・応答の `emailed` で送信可否を返す）。
- UI: `/overview` のアラートパネル「自分に通知する」で通知＋（設定時は）メール送信、結果に送信先を表示。パッケージ95個・39 Prisma モデルのまま、取引先軸の債権債務可視化・年次の締めと繰越・通知のメール化まで揃い、内製プラットフォームの会計・管理・通知が一段と充実した。

---

## 仕訳帳CSVエクスポート / 金額閾値つき多段承認 / 月次締めロック

### 仕訳帳CSVエクスポート
- `journal-export`（アプリ側の組み合わせ）の `journalCsv` で、当期の全仕訳（請求・入金・仕入から自動生成した仕訳＋当年の減価償却仕訳）を会計ソフト取込用の CSV に変換する。行への変換は @platform/accounting の `journalToRows`、CSV 化は @platform/csv の `toCsv` に委譲し、日本語ヘッダ（日付・摘要・勘定科目・借方・貸方・備考）と Excel 互換の BOM を付ける。
- API: `GET /api/accounting/export?year=`（`text/csv` でダウンロード・`accounting:read`）。UI: `/accounting` の「仕訳帳CSV」リンク。freee 形式（プレビュー）と合わせ、外部会計ソフトへの連携口が揃った。@platform/csv を internal-app 依存に追加（パッケージ95個）。

### 金額閾値つき多段承認
- `approval-flow`（@platform/workflow の `routeByAmount` に委譲）で、金額に応じて承認段数を切り替える（〜10万円: 上長 1 段、〜50万円: 上長→経理 2 段、それ以上: 上長→経理→役員 3 段）。`doc-approval-repo`（memory/prisma パリティ）が発注・請求など任意の伝票（docType）に多段承認を適用し、各段の承認ロール（manager→finance→admin）のみが承認できるよう権限分掌する。最終段の承認で `status=approved`（`currentStep` は最終段のまま）、いずれかの段で却下すると `rejected`。
- API: `POST /api/approvals/submit`（金額別ルートで申請・docType の write 権限）、`GET /api/approvals`（承認待ち一覧・`approval:decide`）、`POST /api/approvals/decision`（承認/却下・`approval:decide`。管理者は manager/finance ロールを補完して全段を承認可能、一般の承認者は自ロールの段のみ）。UI: `/approvals`（承認インボックス）、`/invoices`・`/purchase-orders` の「承認申請」ボタン。Prisma: `DocApprovalRow`（`@@unique([docType, docNumber])`）。policy に `approval:decide`（manager 以上）を追加。

### 月次締めロック（内部統制）
- `period-lock-repo`（memory/prisma パリティ）で、締めた月（YYYY-MM）を記録し、`isDateLocked` でその月に属する日付の伝票操作を判定する。請求の起票（issueDate）と入金記録（receivedAt）は、締め済みの月なら 409 で拒否し、後追い修正を防ぐ。
- API: `GET /api/accounting/locks`（一覧・`accounting:read`）、`POST /api/accounting/locks`（lock/unlock・`period:lock`）。UI: `/closing` の「月次締めロック」（当月を締める／解除、締済バッジ）。Prisma: `PeriodLockRow`。policy に `period:lock`（finance/admin）を追加。計 41 Prisma モデル。会計の外部連携・承認統制の横展開・締めロックが揃い、内製プラットフォームの内部統制が一段と強化された。

---

## 承認ステータスの反映 / 勘定元帳ドリルダウン / 固定資産の除却・売却 / ダウンロード・アップロード拡充

### 承認ステータスの発注・請求画面への反映
- `doc-approval-repo` に `listByType(docType)` を追加し、種別ごとの全承認状況を取得できるようにした。API `GET /api/approvals/status?docType=purchase|invoice` が伝票番号→{status, currentStep, totalSteps} のマップを返す。UI: `/invoices`・`/purchase-orders` の各行に「承認待ち n/N」「承認済」「却下」のバッジを表示し、未申請の伝票には「承認申請」ボタンを出す（`POST /api/approvals/submit` へ金額つきで申請）。

### 勘定元帳ドリルダウン
- `account-ledger`（アプリ側の組み合わせ）の `accountLedger` で、仕訳から指定勘定科目の明細を日付順に抜き出し、借方−貸方の累計残高を付ける。API: `GET /api/accounting/ledger?account=&year=`（`accounting:read`）。UI: `/accounting` の試算表の勘定科目をクリックすると、その勘定の元帳（日付・摘要・借方・貸方・残高＋借方計・貸方計・期末残高）を展開表示する。

### 固定資産の除却・売却
- `asset-repo` の `FixedAsset` に処分情報（disposedOn・disposalType・proceeds）を追加。`viewOf` は処分年度以降の簿価を 0 とし `disposed` フラグを立てる。`disposal-journal` の `disposalJournal` が除却「減価償却累計額・固定資産除却損 / 固定資産」、売却「現金預金・減価償却累計額 (±固定資産売却損益) / 固定資産」の仕訳を作る（前年度末簿価をもとに、いずれも貸借一致）。`DISPOSAL_ACCOUNT_TYPES` で科目区分を定義。API: `POST /api/assets/[code]/dispose`（`asset:write`・処分を記録し仕訳を返す・二重処分は 409）。UI: `/assets` で資産の「除却/売却」から処分日・売却額を入力、処分済みはバッジと簿価 0 で表示。Prisma: `AssetRow` に処分列を追加。

### ダウンロード・アップロードの拡充（取引先 CSV・仕訳帳 CSV）
- `@platform/csv` を使った取り込み・書き出しを追加。`csv-import` の `parsePartnerCsv` が取引先 CSV を検証しつつ取り込み（日本語/英語見出し・カンマ/スラッシュ/全角読点の区分区切り・行番号つきエラー）、`partner-export` の `partnersCsv` が取引先一覧を BOM 付き CSV で書き出す。API: `POST /api/partners/import`（CSV 本文を受け取り一括 upsert・`partner:write`）、`GET /api/partners/export`（CSV ダウンロード・`partner:read`）。UI: `/partners` に「CSV書出」リンクと「CSV取込」パネル（ファイル選択＝FileReader で読み込み or 貼り付け、取込件数とエラーを表示）。既存の `/api/accounting/export`（仕訳帳 CSV）とあわせ、マスタと会計の入出力が CSV で一巡した。パッケージ95個・41 Prisma モデル（AssetRow に処分列を追加）。内部統制（承認可視化）と会計の深掘り（元帳・資産処分）、データ入出力（CSV I/O）が揃った。

---

## メール受信箱 / 複数年度比較決算 / 手動仕訳CSV取込 / 監査ログ検索強化

### メール受信箱（メールボックス）
- `mailbox-repo` に受信箱ストア（memory/prisma）と、`@platform/mail` の Transport 実装 `createMailboxTransport` を追加。`createMailer` にこの Transport を注入した `appMailer` を通じて送られたメールは、外部送信せず宛先ごとの受信箱に保存される。運用アラート配信 `POST /api/alerts/dispatch` は通知に加えて appMailer で各担当者の受信箱へ届く。
- API: `GET /api/mailbox`（自分の受信箱＋未読数）、`POST /api/mailbox/read`（既読化）、`POST /api/mailbox/send`（宛先の受信箱へ内部連絡）。UI: `/mailbox`（未読数バッジ・一覧・既読化・詳細・新規メッセージ作成）。Prisma: `MailboxRow`。複数宛先は宛先ごとに保存し、差出人未指定は既定の from を補完する。

### 複数年度比較決算
- `comparative` の `compareStatements` で当期・前期の損益・貸借を並べ、増減（当期−前期）と増減率（前期0なら null）を出す。API: `GET /api/accounting/compare?year=`（当期と前期それぞれの財務諸表を組み立てて比較・`accounting:read`）。UI: `/closing` の「前年比較」で売上・費用・当期純利益・資産・負債・純資産の当期/前期/増減/増減率を表示。

### 手動仕訳（決算整理）の CSV 取込
- `manual-journal-repo`（memory/prisma）で決算整理・調整仕訳を保持し、自動生成の仕訳とあわせて決算・元帳・仕訳帳に反映する。`csv-import` の `parseJournalCsv` は「日付/摘要/勘定科目/借方/貸方/備考」の CSV を、同じ日付＋摘要の連続行を 1 仕訳に束ねて取り込み、貸借が一致しない仕訳はエラーにする。API: `POST /api/accounting/journal-import`（CSV 取込）、`GET /api/accounting/journal-entries`（一覧）。会計の statements・ledger・export・year-end・compare 各ルートは手動仕訳を含めて集計する。UI: `/accounting` に取込パネルと手動仕訳一覧。Prisma: `ManualJournalRow`。既定の勘定科目区分に無い科目（前払費用など）は試算表・元帳・仕訳帳には現れるが、P/L・B/S の集計には区分が必要な点に注意。

### 監査ログの検索・エクスポート強化
- 監査ログの検索（`AuditLog.query`）・CSV エクスポート（`AuditLog.exportCsv`）は既存だが、UI では操作者フィルタのみだった。`/audit` 画面に操作（action）・期間（from/to）フィルタと「CSV エクスポート」ボタンを追加し、同じ絞り込み条件で `GET /api/audit/export` にリンクする。改ざん検証バッジ・before/after 差分の詳細はそのまま。

パッケージ95個・43 Prisma モデル。受信箱（アプリ内メール）・年次の前年比較・手動仕訳（決算整理）・監査証跡の検索エクスポートが加わり、内部統制とコミュニケーション、決算の実務が一段と充実した。なお経費 CSV 取込は既存の取込フロー（貼り付け/アップロード→レビュー→確定）が完備している。

---

## ナビ未読バッジ・返信 / 勘定科目マスタ / 年次推移グラフ / ツールチップ / お問い合わせ / チャットボット

### 受信箱のナビ未読バッジ・返信
- `components/MailboxIndicator` が `/api/mailbox` の未読数を定期取得し、画面隅に未読バッジ＋受信箱リンクを常時表示する。`/mailbox` のメッセージ詳細から「返信」でき、宛先（元の差出人）・件名（Re:）を補完して `POST /api/mailbox/send` する。

### 手動仕訳の勘定科目マスタ（P/L・B/S 完全反映）
- `account-master-repo`（memory/prisma・`AccountMasterRow`）が勘定科目→区分（asset/liability/equity/revenue/expense）の対応表を持つ。既定で前払費用=asset・支払家賃=expense 等をシード。`accountTypeMap` で区分マップに変換し、会計の statements・compare・year-end 各ルートがこのマップを `extraTypes` として財務諸表計算に渡すため、手動仕訳（決算整理）の任意科目も P/L・B/S に反映される。API: `GET/POST /api/accounting/accounts`（登録・更新・削除）。UI: 会計画面に科目マスタの管理表。

### 年次推移グラフ（3期以上）
- `yearly-trend` の `yearlyTrend`（前年比 growth・初年度は null）、`trendRange`、`trendTotals` で複数年度の損益推移を集計。API: `GET /api/accounting/trend?years=`（各年度の財務諸表から売上・費用・純利益を集計）。UI: `/trend` 画面に、外部ライブラリ非依存のインライン SVG で売上・費用の棒グラフと純利益の折れ線を描画（各要素に金額のホバー表示つき）。

### ツールチップ（マウスオーバー UI）
- `components/InfoTip` は外部依存なしの軽量ツールチップ。`?` マーク等にマウスオーバーで補足説明を表示する。決算画面の増減率の説明やお問い合わせフォームの入力補助などに適用。

### お問い合わせフォーム・対応管理
- `inquiry-repo`（memory/prisma・`InquiryRow`）が問い合わせ（氏名・メール・カテゴリ・件名・本文・対応状況 new/in_progress/closed）を保持。API: `POST /api/inquiries`（受付・受付確認を送信者の記録として appMailer 経由で通知）、`GET /api/inquiries`（一覧・状況フィルタ）、`POST /api/inquiries/[id]/status`（対応状況の更新）。UI: `/contact`（問い合わせフォーム）、`/inquiries`（受信一覧・状況管理・未対応件数）。メモリ実装は返り値をコピーで返し、Prisma 実装と同じスナップショット挙動にそろえている。

### チャットボット（社内ヘルプ）
- `chatbot` の `respond` が、アプリ操作の FAQ ナレッジ（請求・発注・経費・承認・会計・資産・受信箱など、キーワードと回答・関連リンクの対応表）に対してキーワード一致で回答する（外部 LLM 非依存・未一致時はフォールバック）。API: `POST /api/chatbot`（質問→回答＋関連リンク）。UI: `components/ChatbotWidget` が全画面共通のフローティングチャットとして常駐し、操作の質問にその場で答える。

パッケージ95個・45 Prisma モデル。ナビの未読可視化と返信、手動仕訳の P/L・B/S 完全反映、多期間の推移グラフ、マウスオーバー補足、問い合わせの受付〜対応、社内ヘルプのチャットボットが加わり、内製プラットフォームの実務・可視化・案内が一段と充実した。

---

## チャットボットの問い合わせ連携 / 公開サイトの問い合わせ / ダッシュボード集約 / ユーザー・権限管理

### チャットボットからの問い合わせ連携
- `chatbot` の `answer` に `escalate` フラグを追加。未一致（fallback）、または「担当者・オペレーター・問い合わせ・電話・有人」等のキーワードを含む質問で `escalate: true` になる。`ChatbotWidget` は escalate 時に「担当者に問い合わせる」を表示し、氏名・メールを入力するとその質問を `POST /api/inquiries`（カテゴリ「チャットボット」）で受信一覧へ転送する。解決できない質問がそのまま有人対応につながる。

### 公開サイトのお問い合わせフォーム（社内へ集約）
- 公開サイト（public-site）に `/contact` フォームを追加。送信は public-site の `POST /api/contact` を経由し、社内アプリの匿名インテーク API `POST /api/inquiries/intake`（`X-Intake-Token` で保護・`INTERNAL_INQUIRY_URL`/`INQUIRY_INTAKE_TOKEN` で構成）へ転送されて、社内の `/inquiries` 受信一覧に集約される。社内の受付フローと公開サイトの問い合わせが 1 か所に集まる。

### ダッシュボードのウィジェット集約
- `/api/dashboard` に受信箱の未読数・未対応の問い合わせ件数・運用アラート件数を追加集計し、`/dashboard` に「受信箱の未読」「未対応の問い合わせ」「運用アラート」カードを追加（各カードから該当画面へ遷移）。未読通知・承認待ち・自分の申請・最近のファイルとあわせ、対応すべき事項が 1 画面に集約される。

### ユーザー・権限管理（管理画面）
- `user-repo`（memory/prisma・`UserRow`）で利用者（メール・氏名・ロール・有効/無効）を管理。`normalizeRoles` が未知ロールを弾き、割当可能ロール（employee/editor/manager/finance/admin）に正規化する。API: `GET/POST /api/admin/users`（管理者のみ・一覧/登録更新/有効無効）。UI: `/admin/users`（追加・編集・ロール割当・有効無効）。認可のロールはこのディレクトリで一元管理する想定。メモリ実装は返り値をコピーで返し内部状態の漏洩を防ぐ。

パッケージ95個・46 Prisma モデル。チャットボットからの有人対応、公開サイトからの問い合わせ集約、ダッシュボードの対応事項集約、ユーザー・権限管理が加わり、管理画面としての運用機能が充実した。

---

## 管理コンソール（お知らせ配信 / システム設定 / 監査ダッシュボード / 権限マトリクス / ヘルス / ログイン監視）

管理者向けの運用機能を `/admin/console` の 1 画面（タブ切替）に集約。各 API は管理者ロールでガードする。

### お知らせ配信（全体周知）
- `broadcast` の `activeRecipients` で有効な全利用者のメールアドレスを取り出し、appMailer 経由で各受信箱へ一斉配信。API: `POST /api/admin/broadcast`（件名・本文）。無効化した利用者は配信対象外。

### システム設定
- `settings-repo`（memory/prisma・`SettingRow` のキー・バリュー）で会社名・決算月・消費税率・送信メール既定 From・請求書番号接頭辞を管理。`resolveSettings` が既定値へのマージと不正値のフォールバック（決算月 1–12、税率 0–1 の範囲外は既定へ）を行う。API: `GET/POST /api/admin/settings`。

### 監査ダッシュボード
- `audit-summary` の `summarizeAudit` で監査ログ（直近 1000 件）を操作種別別・操作者別に件数集計（多い順）。API: `GET /api/admin/audit-summary`。UI はインライン棒グラフで可視化。`audit:read` 権限。

### 権限マトリクス
- `permission-matrix` の `permissionMatrix` が認可ポリシー（`APP_POLICY`）から主要権限（`KNOWN_PERMISSIONS`）についてロール×機能の可否表を作る。`roleHas` はワイルドカード（admin の `*`）に対応。API: `GET /api/admin/permissions`。UI は ✓/— のマトリクス表。

### システムヘルス
- `health-summary` の `healthReport` が主要データ件数（ユーザー・取引先・請求・問い合わせ）と各種チェック（監査ログの整合性、有効な管理者の存在）をまとめ、1 つでも異常なら要確認と判定。API: `GET /api/admin/health`。

### ログイン監視
- ログイン監査は監査ログに `target: "auth"` で記録されるため、`summarizeLogins` でログイン成功・失敗（fail/lock/denied 等）を集計し、直近イベントを一覧。API: `GET /api/admin/logins`。

パッケージ95個・47 Prisma モデル。お知らせ配信・システム設定・監査ダッシュボード・権限マトリクス・ヘルス・ログイン監視を集約した管理コンソールにより、内製プラットフォームの管理・運用・内部統制が一通り揃った。

---

## グローバルナビ / ユーザー・権限管理の拡張 / 設定値の実利用 / 結合(E2E)スモーク

### グローバルナビ（権限連動メニュー）
- `components/AppNav` が全画面共通のナビゲーションとして、`GET /api/auth/me`（利用者・ロール・`userFeatures` のフィーチャーフラグを返す）を取得し、各メニューを表示権限（feature）で出し分ける。管理者には管理コンソールへの導線を追加表示。レイアウトに常設。

### ユーザー・権限管理の拡張（部門・ロール・個別権限・パスワード再発行）
- `user-repo` を拡張し、利用者に部門（department）と個別権限（permissions、ロールとは別に付与する追加権限）を保持。`UserRow` に department・permissions・passwordHash・passwordSetAt を追加。`server/password`（node:crypto の scrypt）で `hashPassword`/`verifyPassword`/`generatePassword` を提供し、`POST /api/admin/users` の `reissuePassword` で一時パスワードを生成・ハッシュ保存し、本人へ appMailer で通知して一度だけ画面表示する。`permission-matrix` の `effectivePermissions` はロール由来の権限と個別権限を合算して実効権限を返す。UI: `/admin/users`（部門・ロール・個別権限の付与、パスワード再発行、有効/無効）。

### 設定値の実利用（会計年度）
- `fiscal` の `fiscalYearOf`/`inFiscalYear`/`fiscalYearRange` が決算月（`fiscalClosingMonth`）に基づく会計年度（開始年ラベル）を判定する。年次決算 `GET /api/accounting/year-end` はシステム設定の決算月を読み、対象の請求・発注を暦年ではなく会計年度で絞り込む（3月決算なら 4月〜翌3月を同一年度に集計）。請求書番号の接頭辞はすでに請求作成時にシステム設定から採番している。

### 結合(E2E)スモーク
- 「受注（取引先登録）→請求（売上仕訳）→入金（入金仕訳）→決算（財務諸表・貸借一致）→周知（有効利用者への一斉配信→受信箱着信）」を、取引先・会計・財務諸表・ユーザー・全体周知・受信箱の実ソースを合成して一連で通す統合テストを追加。退職者（無効ユーザー）が配信対象外になることも検証し、モジュール間の回帰を防ぐ。

パッケージ95個・47 Prisma モデル。権限連動のグローバルナビ、部門・個別権限・パスワード再発行を備えたユーザー管理、会計年度の設定反映、E2E 結合テストにより、管理・運用と品質保証の足場がさらに強化された。

---

## 監査アラート（異常検知・通知） / 設定値のさらなる反映

### 監査アラート（異常検知と管理者通知）
- `audit-anomaly` の `detectAnomalies` が監査ログから、短時間での大量削除（削除系操作がしきい値以上）・ログイン失敗の連続・深夜帯の操作を検出し、重大/警告のレベル付きで返す（重大→警告の順）。しきい値は引数で調整可能。`anomalyDigest` は通知本文用の要約を作る。API: `GET /api/admin/audit-alerts`（検出結果）、`POST /api/admin/audit-alerts`（有効な管理者全員の受信箱へ appMailer で通知）。UI: 管理コンソールに「監査アラート」タブを追加し、検出結果の一覧表示と「管理者へ通知」を提供。

### 設定値のさらなる反映
- 会社名（companyName）を請求書の HTML／PDF の発行者名（`renderInvoiceHtml` の issuerName）に反映。
- 消費税率（consumptionTaxRate）を、`tax-default` の `applyDefaultTaxRate` により請求明細の税率未指定行へ既定値として補完（指定済みの行はそのまま）。
- 決算月（fiscalClosingMonth）を、複数年度比較 `GET /api/accounting/compare` でも会計年度基準の絞り込みに反映（年次決算に続き比較決算も暦年でなく年度で集計）。請求書番号の接頭辞は既に採番へ反映済み。

### 公開サイトのコンテンツ管理（CMS）連携（既存）
- `@platform/cms`（ページ・お知らせ・カテゴリ・リビジョン・公開申請・差分・プレビュー）を中核に、社内アプリ側に編集 UI（`/cms` 配下: ページ・お知らせ・カテゴリ・メディア・履歴・公開申請）を備え、公開サイト（public-site）がその内容を配信・プレビューする構成が既に整っている。

パッケージ95個・47 Prisma モデル。監査の異常検知と管理者通知、設定値（会社名・税率・決算月）の実ロジックへの反映により、内部統制の自動化と設定の一貫適用が進んだ。

---

## アンケート / アラートの定期実行・重複抑制 / 通知チャネル拡張 / 多言語対応

### アンケート（社内調査）
- `survey-repo`（memory/prisma・`SurveyRow`/`SurveyResponseRow`）で、単一選択・複数選択・自由記述・評価（1–5）の設問を持つアンケートを作成・公開・回答収集する。`aggregateSurvey` が選択肢ごとの件数、評価の平均と分布、自由記述の一覧を集計する（空白の記述は除外）。API: `GET/POST /api/surveys`（一覧・作成）、`GET /api/surveys/[id]`、`POST /api/surveys/[id]/respond`（公開中のみ受付）、`GET /api/surveys/[id]/results`（集計）、`POST /api/surveys/[id]/status`（下書き/公開/終了）。UI: `/surveys`（一覧・設問ビルダー付き作成・公開切替）、`/surveys/[id]`（種別別の回答フォーム）、`/surveys/[id]/results`（棒グラフ・平均・記述一覧）。

### アラートの定期実行・重複抑制
- `alert-notify` の `notifyNewAnomalies` が、基盤 @platform/notify の `SeenStore`（`markSeen` による TTL 付き重複抑制）を使って、同一異常（種別＋対象者のキー）を時間窓内で再通知しないよう抑制する。API: `POST /api/admin/audit-alerts/scan`（cron 等から定期実行。`X-Cron-Token`=env `CRON_TOKEN` 一致、または管理者で実行可）。既定の抑制窓は 6 時間。抑制ストアはプロセス内で共有し、スキャン間で状態を保持する。

### 通知チャネルの拡張（受信箱＋Slack＋Webhook）
- `alert-notify` の `buildAlertChannels` が、受信箱チャネルに加えてシステム設定の `alertSlackWebhook`／`alertWebhookUrl`（`settings-repo` に追加）が設定されていれば @platform/notify の Slack／Webhook チャネルを組み合わせ、`createNotifier` で全チャネルへファンアウトする。設定がなければ受信箱のみ。監査アラートの scan で使用。

### 多言語対応（i18n）
- `server/i18n` がアプリ固有の文言カタログ（ja/en/zh/ko）を持ち、@platform/i18n の `createI18n` で翻訳器を提供（未知キーは fallback→キー）。API: `GET /api/i18n?locale=`（対応ロケール一覧と選択言語の文言）。UI: `components/LanguageSwitcher`（言語選択で文言を切替）。基盤の `uiCatalogs`（ja/en/zh/ko）と組み合わせて拡張できる。

パッケージ95個・49 Prisma モデル。社内アンケート、監査アラートの定期実行と重複抑制・多チャネル通知、多言語対応により、従業員の声の収集・内部統制の自動運用・利用者層の拡大が進んだ。

---

## アンケートの拡張（対象者・匿名/記名・締切・CSV・配信通知） / 口コミ / 手書きサイン

### アンケートの対象者・匿名/記名・締切
- `survey-repo` を拡張し、配信対象（`Audience`：部門・ロール、両方空なら全員）、匿名フラグ（`anonymous`）、回答締切（`closesAt`）を保持。`isEligible(user, audience)` で対象判定、`audienceRecipients(users, audience)` で有効かつ対象の受信者一覧、`isAcceptingResponses(survey, now)` で公開かつ締切前の受付判定を行う。回答時は締切超過なら 409、匿名なら回答者（respondent）を記録しない。作成 UI で部門・ロール・締切・匿名を指定できる。

### アンケート結果の CSV 出力
- `survey-export` の `surveyResultsCsv` が集計結果を CSV（BOM 付き・見出し「設問/項目/値」・選択肢の件数、評価の平均と分布、自由記述）にする。API: `GET /api/surveys/[id]/export`（`inquiry:read`）。

### アンケート配信の自動通知
- 公開（status→open）時に、`audienceRecipients` で対象者を求めて受信箱へ「アンケートのお願い」を appMailer で自動配信する（`POST /api/surveys/[id]/status`）。対象が空なら全員へ配信。

### 口コミ（レビュー）
- `review-repo`（memory/prisma・`ReviewRow`）で、対象（`subjectType`/`subjectId`、例：社内ツール・取引先・商品）への評価（1〜5）とコメントを収集。集計は @platform/commerce の `ratingSummary` を用い、件数・平均・分布を返す（`summarizeReviews`）。評価は `clampRating` で 1〜5 に丸める。API: `GET /api/reviews?subjectType=&subjectId=`（一覧＋集計）、`POST /api/reviews`（投稿）。UI: `components/ReviewSection`（平均★・投稿フォーム・一覧）、`/reviews`（対象選択つきページ）。

### 手書きサイン
- `signature-repo`（memory/prisma・`SignatureRow`）で、対象（書類・承認など）への手書き署名を PNG data URL として保存。`isValidSignatureImage` が PNG data URL 形式と非空を検証する。API: `GET /api/signatures?subjectType=&subjectId=`（一覧）、`POST /api/signatures`（保存・不正画像は 400）。UI: `components/SignaturePad`（キャンバスにポインタで描画し PNG を出力）、`/signatures`（書類IDにサインして一覧表示）。

パッケージ95個・51 Prisma モデル。配信対象・匿名・締切に対応したアンケート、結果 CSV と配信自動通知、口コミ、手書きサインにより、従業員の声の収集と合意形成・電子的な署名までカバーした。

---

## アンケート未回答リマインド / 口コミモデレーション・公開掲載 / サインの承認フロー組込

### アンケート未回答リマインド
- `survey-repo` の `pendingRespondents(recipients, responses)` が、対象者のうち未回答の人を返す（記名回答のみ判定可能。匿名は回答者不明のため全員未回答扱い）。API: `POST /api/surveys/[id]/remind`（公開中のみ・`inquiry:write`）で、対象者のうち未回答者の受信箱へリマインドを再送。UI: アンケート一覧の公開中の項目に「リマインド」ボタン。

### 口コミのモデレーション・公開掲載
- `review-repo` に非表示フラグ（`hidden`）とモデレーション（`setHidden`）を追加。一覧は既定で可視のみ、`includeHidden=true` で非表示も含む（モデレーション用）。集計（`summarizeReviews`）は非表示を除外して平均・件数を計算する。API: `GET/POST /api/reviews/moderate`（管理者：非表示含む一覧／非表示・再表示）、`GET /api/public/reviews`（認証不要・可視のみ・公開サイト掲載用）。UI: `ReviewSection` に管理者向けの非表示/再表示ボタン（`/reviews` は管理者判定で自動表示）。

### サインの承認フロー組込
- `approval-signature` が承認（伝票・稟議）と手書きサインを連携。`approvalSubjectId(docType, docNumber)` で署名対象キーを作り、`approvalSignatureStatus`／`canFinalizeApproval` で必要署名の充足を判定する（署名必須かつ未署名なら確定不可）。API: `GET/POST /api/approvals/[docType]/[docNumber]/signatures`（署名状況取得／署名保存）。署名は監査ログに `approval.sign` として記録。UI: `components/ApprovalSignaturePanel` を承認画面に組み込み、金額が一定額以上（例 100 万円）なら「署名が必要です」を表示し、その場で手書きサインできる。

パッケージ95個・51 Prisma モデル。未回答者への的確なリマインド、口コミの健全な運用（モデレーションと公開掲載）、承認への電子署名の組込により、回収率・信頼性・内部統制がさらに高まった。

---

## 機能アクセス制御（役割別 有効/無効・表示/非表示） / 公開サイト口コミ / リマインド定期実行 / サイン必須ルール設定

### 機能アクセス制御（役割で使える/使えない・表示/非表示）
- `feature-access` が、機能（モジュール）ごとに有効/無効（`enabled`）と使える役割（`roles`、空なら全役割）を管理する層。既存の権限（APP_POLICY）による制御に加え、管理者が実行時に役割単位で切り替えられる。`canUseFeature(roles, key, rules)` は「無効なら不可／許可役割が空なら全員／指定があれば交差」で判定し、admin は常に使用可（ロックアウト防止）。`accessibleFeatures` が利用者の使える機能キー一覧を返す。ストアは memory/prisma（`SettingRow` に JSON）。API: `GET/POST /api/admin/features`（カタログ＋規則取得／更新・管理者）、`GET /api/features`（自分の使える機能・ナビ用）。UI: `/admin/features`（機能×役割のマトリクスで有効/無効と役割を設定）、`components/AppNav` は `/api/features` を参照してメニューを表示/非表示。

### 公開サイトの口コミウィジェット
- `apps/public-site` の `components/ReviewWidget` が、社内アプリの公開レビュー API（`GET /api/public/reviews`・可視のみ）を参照して平均★と口コミを表示する（`apiBase` は env `INTERNAL_API_BASE`）。`/reviews` ページで掲載。件数0や取得失敗時は非表示。

### アンケートのリマインド定期実行
- `survey-repo` の `surveysDueForReminder(surveys, now, daysBefore)` が締切間近（既定3日以内）の公開中アンケートを抽出。API: `POST /api/surveys/remind-scan`（cron 等から定期実行。`X-Cron-Token` または管理者）が、対象アンケートの未回答者へ受信箱でリマインドし、`alertSeenStore` で同一アンケートの再送を抑制（既定20時間）。

### サイン必須ルールの設定化
- システム設定に `signatureThreshold`（承認で署名必須となる金額・0で無効・既定100万円）を追加。`signatureRequiredByAmount(amount, threshold)` で判定し、承認署名 API はクエリの金額と設定しきい値から必須かを算出する。管理コンソールの設定タブで金額を変更できる。

パッケージ95個・51 Prisma モデル。役割・権限に基づく機能の有効化/無効化と表示/非表示、公開サイトへの口コミ掲載、締切前の自動リマインド、署名必須ルールの設定化により、権限管理の柔軟性と運用自動化がさらに高まった。

---

## 機能アクセスの粒度拡張 / 設定変更履歴 / 利用状況ダッシュボード / 送信Webhook

### 機能アクセスの粒度拡張（操作単位）
- `feature-access` の `FeatureRule.actions`（操作→許可役割）と `canDoAction(roles, feature, action, rules)` により、機能内の操作（create/update/delete/export 等）ごとに役割を絞れる。操作規則が無ければ機能アクセスと同じ扱い、admin は常に可。`ACTION_KINDS` に代表操作を定義。

### 設定変更履歴の可視化
- `usage-analytics` の `configChanges(rows)` が監査ログから設定・管理系の操作（`CONFIG_ACTIONS`：settings.update／features.update／user.\*／review.hide 等）を新しい順に抽出する。API: `GET /api/admin/config-changes`（管理者・直近100件）。UI: 管理「分析」の設定変更履歴タブ。

### 利用状況ダッシュボード
- `usage-analytics` の `featureUsage(rows)` が監査ログから総イベント数・アクティブ利用者数・機能別/利用者別/操作別の利用回数を集計する（`featureOf` で操作名から機能領域を抽出）。API: `GET /api/admin/usage`（管理者）。UI: 管理「分析」の利用状況タブ（機能別・利用者別の棒グラフ）。

### 送信（outbound）Webhook
- `outbound-webhook` が、イベント（例 `invoice.created`）を購読 URL へ HMAC-SHA256 署名付きで配信する仕組み（既存 @platform/webhook は受信専用のため新規）。`matchingSubscriptions`（`*` で全イベント）・`buildDeliveries`・`signPayload` を提供し、`webhook-emit` の `emitEvent` が best-effort で POST 配信する。請求作成時に `invoice.created` を発火。API: `GET/POST /api/admin/webhooks`（購読の一覧／追加・有効切替・削除・管理者）。UI: 管理「分析」の送信Webhookタブ。ストアは memory/prisma（`WebhookSubscriptionRow`）。

### 一般的な基盤との比較（棚卸し）
- 本基盤は基盤層（packages）が非常に充実しており、レート制限（ratelimit/guard）・APIキー（apikey）・秘密管理（secrets）・PIIマスキング（pii）・フィーチャーフラグ（flags）・冪等性/アウトボックス/メトリクス（observability）・監査（audit）・状態ページ（status-page）等は既に存在する。一方、これらの多くは社内アプリ未配線であり、また送信Webhook（本節で追加）や補償トランザクション（saga）は未整備だった。今後はこれら既存プリミティブのアプリ配線が主な拡張余地。

パッケージ95個・52 Prisma モデル。操作単位のアクセス制御、設定変更の可視化、利用状況の把握、外部システムへのイベント配信（送信Webhook）により、統制・可観測性・外部連携が一段と強化された。

---

## APIキー/サービスアカウント配線 / PIIマスキング適用 / 補償トランザクション(saga)

### APIキー / サービスアカウント（外部システム連携）
- `service-account-repo`（memory/prisma・`ServiceAccountRow`）が、外部システムやスクリプトが Bearer トークンで社内APIを呼ぶための鍵を管理する。鍵の生成・ハッシュ化・スコープ判定は @platform/apikey（`generateApiKey`/`hashApiKey`/`hasScope`）を利用し、平文キーは発行時のみ返す（保存はハッシュのみ）。`authenticateKey(accounts, key, scope)` がハッシュ一致・有効・スコープを検証（invalid/revoked/forbidden/missing を区別）。API: `GET/POST /api/admin/service-accounts`（一覧・発行・失効・管理者）、`GET /api/v1/invoices`（`Authorization: Bearer <キー>`＋scope `invoice:read` で認証する外部向けエンドポイント例）。UI: `/admin/service-accounts`（発行直後のみ平文表示・失効/再有効化）。

### PII マスキング
- `pii-view` が監査ログ・利用者一覧のメール・氏名を役割に応じてマスクする（@platform/pii の `maskEmail`/`maskName` を利用）。`pii:unmask` 権限（admin・finance に付与）を持つ者のみ生値を閲覧でき、それ以外はマスク表示。`maskAuditRow` はメール形式の actor/target のみマスクし、`system` 等の非メール値やドメイン内容は保持する。監査 API（`GET /api/audit`）で閲覧者の権限に応じて自動マスク。

### 補償トランザクション（saga）
- 新パッケージ `@platform/saga`。複数ステップ処理を順に実行し、途中で失敗したら完了済みステップの `compensate` を逆順で呼んで打ち消す（全体を単一 DB トランザクションで囲えない外部API連携等の一貫性維持に使う）。`runSaga(steps, ctx)` は成功時に completed、失敗時は compensated（逆順）・failedStep・error を返し、打ち消し自体の失敗は compensationErrors に記録して他の打ち消しは続行する。`sagaStep(name, run, compensate?)` で定義。

### 補足（未配線プリミティブの解消）
- 前回棚卸しで指摘した「package は在るがアプリ未配線」のうち、APIキー（apikey）と PII マスキング（pii）を今回配線。saga は新規プリミティブとして追加。secrets/guard/flags 等は引き続きアプリ配線余地あり。

パッケージ96個・53 Prisma モデル。外部システムがトークンで安全に社内APIを利用でき、PII は役割に応じてマスクされ、複数ステップ処理は失敗時に打ち消される。基盤プリミティブのアプリ実装がさらに前進した。

---

## 秘密情報(secrets)配線 / レート制限適用 / フィーチャーフラグ(flags)配線

### 秘密情報の管理（暗号化保存・ローテーション）
- `secret-store`（memory/prisma・`SecretRow`）が、外部API資格情報や Webhook secret を暗号化して保存する。暗号化は @platform/crypto（AES・`encrypt`/`decrypt`/`deriveKey`）、取得は @platform/secrets のチェーンプロバイダ（DB→環境変数）＋TTLキャッシュ。`putSecret` は保存と同時にキャッシュを無効化するため、同名保存でローテーションできる。マスター鍵は env `SECRET_MASTER_KEY`（無ければ `SESSION_SECRET` を流用）。API: `GET/POST /api/admin/secrets`（一覧は名前のみ・登録/ローテーション・管理者）。UI: `/admin/platform` の秘密情報タブ。値は保存後に表示されない。
- 併せて、多数のルートが参照していた `serverEnv`（`SESSION_SECRET`/`SECRET_MASTER_KEY`/`DATABASE_URL`）が未 export だった不具合を `server/env.ts` に追加して解消。

### レート制限の適用
- `rate-limit` に APIキー単位（`getApiKeyLimiter`・既定100回/分）と IP 単位（`getIpLimiter`・既定60回/分）のリミッタを追加（@platform/ratelimit のメモリストア使用）。外部向け `GET /api/v1/invoices` に適用し、超過時は 429 と `retry-after`/`x-ratelimit-*` ヘッダを返す。キー単位（`api:<アカウントID>`）で独立にカウント。

### フィーチャーフラグ（段階的ロールアウト・A/B・キルスイッチ）
- `feature-flags`（memory/prisma・`SettingRow` に JSON）が @platform/flags を用いてフラグを評価する。`enabled:false` で緊急停止（キルスイッチ）、`rolloutPercent` で割合ロールアウト（key のハッシュで安定判定）、`variants` で A/B、`allow`/`deny` でターゲティング。役割別の機能アクセス制御（feature-access）とは別軸の「実験・出し分け」用。API: `GET/POST /api/admin/flags`（定義取得/更新・管理者）、`GET /api/flags`（自分向けの評価結果・UI 出し分け用）。UI: `/admin/platform` のフラグタブ（JSON 編集）。

### 補足
- 前回棚卸しの「package は在るがアプリ未配線」のうち、secrets・ratelimit（拡張）・flags を今回配線。主要な基盤プリミティブのアプリ実装がほぼ一巡した。

パッケージ96個・54 Prisma モデル。秘密情報は暗号化して安全に保存・ローテーションでき、外部APIはレート制限で保護され、機能は段階的リリースや緊急停止が可能になった。

---

## 開発者向けドキュメント / 統合ステータスページ / 初期セットアップ

### 開発者向けドキュメント（APIリファレンス）
- `api-reference` が外部向け v1 API の OpenAPI 3.0 仕様（`openApiSpec`）と、送信 Webhook のイベントカタログ（`WEBHOOK_EVENTS`）・署名仕様（`WEBHOOK_SIGNATURE_DOC`）を提供する。API: `GET /api/v1/openapi`（OpenAPI JSON・認証不要）、`GET /api/v1/events`（Webhookイベント一覧・認証不要）。UI: `/developer`（API仕様・curl例・APIキー発行手順・Webhookイベント表を1画面に集約）。

### 統合ステータスページ
- `status-checks` が DB・外部連携（Zoho）・送信Webhook 等の依存を @platform/observability の `runHealthChecks` で集約する（`buildStatusChecks`/`getStatus`/`summarizeStatus`）。全チェック成功で healthy、1つでも失敗で unhealthy。API: `GET /api/status`（各依存の up/down と要約・200/503・認証不要の表示用）。UI: `/status`（各依存の稼働状況・応答時間・最終確認時刻を表示、更新ボタン付き）。既存の liveness/readiness 用 `/api/health` とは別に、運用者・関係者向けの一覧画面を追加。

### 初期セットアップ（オンボーディング）
- `setup` が管理者不在時の初回セットアップを支援する。`setupState`（初期化済みか・各ステップ完了状況）・`needsSetup`・`canBootstrapAdmin`（管理者が居なければ最初の管理者作成を許可、居れば禁止＝乗っ取り防止）・`defaultSeedPlan`（会社名から初期設定を投入）。API: `GET /api/setup/status`（初期化状態・認証不要）、`POST /api/setup/bootstrap`（最初の管理者作成＋会社設定投入・既に管理者が居れば 409）。UI: `/setup`（会社名・管理者アカウントを入力するウィザード。初期化済みなら完了画面を表示）。

パッケージ96個・54 Prisma モデル。外部連携の開発者体験（API仕様・Webhookイベントの明文化）、運用の可視化（統合ステータス）、新規導入の容易化（初期セットアップ）が整い、基盤としての完成度がさらに高まった。

---

## 通知ダイジェスト頻度 / 横断全文検索 / 統合バックアップ

### 通知ダイジェストの個人化（頻度）
- 既存の通知プレファレンス（カテゴリ別 channels/mode(immediate/digest/off)・quietHours）に加え、`digest` が利用者ごとのダイジェスト**頻度**（毎日/毎週/受け取らない）を管理する。`isDigestDue`（頻度に応じた間隔判定）・`buildDigestSummary`（未読を新しい順にまとめ・空なら送らない）・`usersDueForDigest`。設定ストアは memory/prisma（`SettingRow` に email→設定の JSON）。API: `GET/PUT /api/notifications/digest`（自分の頻度）、`POST /api/notifications/digest-scan`（cron・頻度が来た人へ未読まとめをメール送信・送信後 lastSentAt 更新）。UI: 通知設定画面にダイジェスト頻度セレクタを追加。

### 横断全文検索
- `entity-search` が請求・取引先・監査ログを共通ドキュメント（`EntityDoc`）に変換し、基盤 @platform/search（BM25）で横断検索する。`searchEntities`（都度索引して検索）・`toSearchResults`（type で絞り込み可能な表示用に整形）。API: `GET /api/search?q=`（認証ユーザー・監査は accounting:read 権限保持者のみ対象）。UI: `/search`（検索ボックス＋種別フィルタ＋各結果へのリンク）。

### 統合バックアップ / データエクスポート
- `backup` が主要データ（請求・取引先・利用者・設定・監査ログ）を 1 つの JSON バンドル（`BackupBundle`：app/version/generatedAt・各データセットの件数・総件数）にまとめる。`buildBackup`・`backupManifest`（目録）・`backupFilename`（日付入り）。利用者のメール・氏名は `pii-view` でマスク。API: `GET /api/admin/backup`（管理者・`content-disposition` でダウンロード）。UI: `/admin/backup`（ダウンロードボタン・cron からの定期取得を案内）。個別の CSV エクスポート（監査/会計/取引先/アンケート）に加え、全体を一括取得できる。

パッケージ96個・54 Prisma モデル。通知の受信方法・頻度の個人化、業務データの横断検索、主要データの一括バックアップにより、利用者体験・検索性・データ保全が強化された。

---

## バックアップ復元/インポート / 検索インデックス永続化 / 監査アーカイブ

### バックアップ復元・インポート
- `restore` が buildBackup 出力の JSON バンドルを検証（`parseBackupBundle`）し、データセット単位で適用する。安全に冪等 upsert できる `RESTORABLE_DATASETS`（取引先・設定）のみ適用し、それ以外（請求・監査など）は安全のため対象外＝プレビュー扱い（`restorePlan`）。`applyRestore` は dryRun でプレビュー（件数のみ）、本適用で登録済み適用関数を呼ぶ。API: `POST /api/admin/restore`（bundle＋dryRun・管理者）。UI: `/admin/data` の復元タブ（JSON貼付→プレビュー→実行）。

### 検索インデックスの永続化
- 従来の横断検索は都度全件収集していたが、`search-index` が対象ドキュメント（`EntityDoc`）を保存し、書き込み時に更新する方式に拡張（memory/prisma・`SearchDocRow`）。`searchIndexed` は保存済みドキュメントに対して @platform/search（BM25）で検索する。請求作成時に索引を upsert。API: `GET /api/search`（永続インデックス方式へ変更）、`POST /api/admin/reindex`（請求・取引先・監査から索引を再構築・管理者）。UI: `/admin/data` の検索インデックスタブ（再構築ボタン）。

### 監査ログのアーカイブ
- `audit-archive` が指定日以前の監査エントリを整合性チェックサム（決定的な FNV-1a）付きで書き出す（`buildAuditArchive`：cutoff・件数・seqRange・checksum・entries）。監査はハッシュチェーンのため中間削除は `verify()` を壊す。したがって破壊的削除は行わず、長期保管用の**バウンドされたエクスポート**を提供する。API: `GET /api/admin/audit-archive?before=ISO`（管理者・`content-disposition` でダウンロード）。UI: `/admin/data` の監査アーカイブタブ（日付指定→ダウンロード）。

パッケージ96個・55 Prisma モデル。バックアップからの復元・データ移行、検索インデックスの永続化による効率化、監査ログの長期アーカイブにより、データのライフサイクル管理（保全・移行・保管）が整った。

---

## CSVインポートUI拡充 / 通知テンプレート(多言語) / ダッシュボードウィジェット拡張

### CSVインポートの拡充（商品マスタ・勘定科目）
- 既存の取引先/仕訳/経費CSV取り込みに加え、`csv-import` に `parseProductCsv`（SKU・名称・単位／重複SKU検出）・`parseAccountCsv`（科目・区分／区分値の検証）を追加。API: `POST /api/inventory/import`（商品・dryRunプレビュー・既存はスキップ・inventory:write）、`POST /api/accounting/accounts/import`（勘定科目・upsert・accounting:read）。UI: `/import`（対象を切り替え、まず「プレビュー（検証）」で**行番号付きエラー**を確認してからインポート実行。サンプル入力ボタン付き）。

### 通知テンプレート（多言語配信）
- `notification-templates` が承認依頼・請求作成・承認結果などの通知文面をイベント別・ロケール別（ja/en/zh/ko）にテンプレート化する。`renderNotification(event, vars, locale)` が {{var}} を差し込んで描画し、未知イベントは null、未定義ロケールは日本語にフォールバック。既存 i18n（appCatalogs）と同じ 4 言語に対応。API: `GET /api/notifications/templates`（一覧・`?event=&locale=` でプレビュー）。利用者の言語に合わせた通知文面を生成できる。

### ダッシュボードのウィジェット拡張
- 既存のウィジェット選択・並べ替え（`dashboard-prefs`：WIDGET_KEYS・normalizeWidgets で順序保持・isWidgetVisible）に、**売掛残高（receivables）**と**在庫アラート（inventoryAlerts）**を追加。ダッシュボード API が未回収の請求残高合計と発注要の在庫件数を返し、`/dashboard` に StatCard として表示、`/dashboard`（設定）で表示/非表示・並び順を選べる。

パッケージ96個・55 Prisma モデル。マスタデータの CSV 一括登録（検証付き）、通知の多言語化、ダッシュボードの指標拡張により、データ登録・国際化・可視化の各面が強化された。

---

## 通知テンプレート管理UI / エクスポートのスケジュール実行 / レポート帳票生成

### 通知テンプレートの管理・カスタム編集
- 従来コード定数だった通知テンプレートをストア化。`resolveTemplates(overrides)` が既定テンプレート（4言語）に管理者の上書きをマージし、`renderWithTemplates` で描画する。`TemplateStore`（memory/prisma・`SettingRow` に JSON）が上書きを保持。空欄は既定を使用。API: `GET/POST /api/admin/notification-templates`（解決結果＋生の上書きを取得／更新・管理者）。UI: `/admin/automation` の通知テンプレートタブ（イベント別・ロケール別にタイトル/本文を編集）。

### エクスポートのスケジュール実行
- `export-schedule` がバックアップ/取引先/請求/監査のエクスポートを頻度（毎日/毎週/毎月）で予約実行する。`isExportDue`（前回実行からの間隔判定）・`dueSchedules`・スケジュールストア（memory/prisma・`ExportScheduleRow`）・実行履歴ストア（`ExportRunRow`・件数と成否を記録）。API: `GET/POST /api/admin/export-schedule`（一覧・追加/有効切替/削除＋履歴）、`POST /api/admin/export-scan`（cron・期限が来た予約を実行し履歴記録）。UI: `/admin/automation` のエクスポート予約タブ（予約の追加・停止・削除・実行履歴表示）。

### レポート/帳票の生成
- `reports` が売上（取引先別）・売掛（未回収）・在庫の定型レポートをデータ（列・行・合計）に集約し、`reportToCsv`（Excel向け BOM 付き・合計行）・`reportToHtml`（印刷用・エスケープ済み、ブラウザ印刷で PDF 化）・`reportToSheet`（@platform/xlsx の writeWorkbook 向け）に整形する。API: `GET /api/reports/[type]?format=csv|html`（sales/receivables/inventory・権限チェック）。UI: `/reports`（各レポートを表示/印刷またはCSVでダウンロード）。Excel(.xlsx) 出力は既存の writeWorkbook パターン（expenses/attendance レポートと同様）で追加可能。

パッケージ96個・57 Prisma モデル。通知文面の運用（画面編集）、データ書き出しの自動化（定期エクスポート＋履歴）、経営・業務レポートの帳票化により、運用・可視化の完成度がさらに高まった。

---

## レポートのExcel出力 / レポートのスケジュール配信 / KPIダッシュボードの時系列グラフ

### レポートの Excel(.xlsx) 出力
- レポート route に `format=xlsx` を追加。`reportToSheet`（レポート→シート入力）を既存の @platform/xlsx `writeWorkbook` に接続し、売上/売掛/在庫レポートを Excel でダウンロードできる（expenses/attendance レポートと同じ writeWorkbook パターン）。API: `GET /api/reports/[type]?format=xlsx`。UI: `/reports` に Excel ボタンを追加（表示/印刷・CSV・Excel の 3 形式）。

### レポートのスケジュール配信
- `report-schedule` が売上/売掛/在庫レポートを頻度（毎日/毎週/毎月）で生成し、宛先へメール＋受信箱で配信する。`isReportDue`（前回配信からの間隔判定）・`dueReports`・`buildReportMessage`（件名＋要約）・スケジュールストア（memory/prisma・`ReportScheduleRow`）。API: `GET/POST /api/admin/report-schedule`（一覧・追加/有効切替/削除）、`POST /api/admin/report-scan`（cron・期限が来た配信を実行）。UI: `/admin/automation` のレポート配信タブ（レポート種別・頻度・宛先メールを指定して予約、停止/削除）。

### KPI ダッシュボードの時系列グラフ
- `dashboard-trend` が請求を発行月で集計し、売上と売掛残高の月次推移を出す（`recentMonths`・`salesTrend`・`summarizeSalesTrend`。基盤 trend.ts の monthRange を再利用、取消請求は除外）。API: `GET /api/dashboard/trend?months=6`（認証ユーザー）。UI: ダッシュボードに**インライン SVG のグラフ**（売上=棒・売掛残高=折れ線、外部ライブラリ非依存）を追加。直近 6 か月の推移が一目で分かる。

パッケージ96個・58 Prisma モデル。レポートの Excel 出力、定型レポートの定期メール配信、ダッシュボードの売上・売掛トレンド可視化により、帳票・自動配信・経営可視化がさらに充実した。

---

## グラフの期間選択 / レポートの絞り込み条件 / 配信先の柔軟化

### 経営分析グラフの期間選択
- 経営分析（`/analytics`）の P&L 月次推移グラフ（売上・仕入・経費・粗利のインライン SVG）に期間セレクタ（3/6/12 か月）を追加。`analytics/trend` API は既に from/to を受け付けるため、選択に応じて再取得する。`dashboard-trend` に `rangeForMonths(now, n)`（直近 n か月の from/to）を追加。

### レポートの絞り込み条件
- `reports` に `filterInvoices`（発行日 from/to・取引先での絞り込み）・`filterLabel`（絞り込み条件の可読表示）を追加。売上/売掛レポートを期間・取引先で絞って生成できる。API: `GET /api/reports/[type]?from=&to=&partner=&format=`（絞り込み条件はレポートタイトルに付記）。UI: `/reports` に期間・取引先の入力欄を追加（クリアボタン付き・在庫は対象外）。

### レポート配信先の柔軟化（複数 / ロール指定）
- `report-schedule` に `resolveRecipients(recipient, users)` を追加。宛先はカンマ/空白区切りの複数メール、または `role:admin` のようにロール指定でき、送信時にそのロールの利用者へ展開する（重複排除）。`report-scan` は解決後の全宛先へメール＋受信箱で配信し、配信件数（deliveries）を返す。UI: `/admin/automation` のレポート配信タブの宛先欄で複数メール・ロール指定に対応（プレースホルダで案内）。

パッケージ96個・58 Prisma モデル。グラフの期間切り替え、レポートの条件絞り込み、配信先のグループ/ロール指定により、分析・帳票・配信の柔軟性がさらに向上した。

---

## ダッシュボードの支出トレンド / レポートプリセット / 配信ログ

### ダッシュボードの仕入・経費トレンド
- `dashboard-trend` に `spendTrend`（仕入・経費を発注日/日付で月次集計、取消仕入は除外）を追加。`dashboard/trend` API が売上・売掛に加え仕入・経費も返し、ダッシュボードの SVG グラフに仕入（橙・破線）・経費（紫・点線）の折れ線を追加。売上・売掛・仕入・経費の全体像が 1 つのグラフで見える。

### レポートのプリセット保存
- `report-preset` がよく使う絞り込み条件（レポート種別・期間・取引先）を名前付きで保存する（利用者ごと・memory/prisma・`ReportPresetRow`）。`presetToQuery` がプリセットからレポート URL を組み立てる。API: `GET/POST /api/reports/presets`（一覧・追加/削除）。UI: `/reports` にプリセットの保存（現在の条件に名前を付ける）・呼び出し（ワンクリックで条件を適用）・削除を追加。

### レポート配信ログ
- `delivery-log` がレポート配信の実行履歴（いつ・何のレポートを・誰に・何名へ）を記録する（memory/prisma・`DeliveryLogRow`）。`makeDeliveryEntry` が宛先数と送信/スキップ状態を算出。`report-scan` は配信のたびにログへ記録。API: `GET /api/admin/report-log`（管理者）。UI: `/admin/automation` の配信ログタブ（配信日時・レポート種別・宛先一覧・配信件数を時系列表示）。

パッケージ96個・60 Prisma モデル。支出を含む経営トレンドの一覧可視化、絞り込み条件の再利用、配信の証跡記録により、可視化・利便性・監査性がさらに向上した。

---

## CRUDテンプレートアプリ / CI初回実走の準備 / パッケージ再配置の段階計画

### apps/crud-template(新アプリのコピー元)
- 品目マスタの CRUD(一覧・登録・編集・無効化=ソフトデリート)を基盤の標準パターンで最小実装した**3つ目のアプリ**。env 検証(@platform/env)・項目別入力検証・ストアの memory/prisma 両実装(最小ポート)・services での配線・route(400/409/404)・page+client の2ファイルUI。認証は意図的に無し(README に authorize.ts 移植手順)。`cp -r` → name/port 変更 → エンティティ置換で新アプリを開始できる。README にコピー手順・Prisma モード(`PERSISTENCE=prisma`)・次に足すもの(監査/通知/CSV/検索)を記載。

### CI 初回実走の準備
- ci.yml を実走可能な形に修正: pnpm バージョンを packageManager に一本化(9.15.0/10.9.7 不一致解消)、lockfile 未コミットのため install を暫定通常化(TODO 付き)、**Typecheck 前に prisma generate**、**Build にダミー環境変数**(env.ts の fail-fast 対策)、e2e ジョブは整備まで continue-on-error。手順と詰まりどころは `docs/ops/CI_FIRST_RUN.md`。

### パッケージ物理再配置の段階計画
- 設計判断: **npm 名 @platform/* は不変・パスのみ移動**(= import 無変更)。カテゴリ定義を `tools/package-categories.mjs` に一本化(module-list 生成と共用)。`tools/migrate-packages.mjs`(dry-run 専用)が移動コマンドと**パス直書きの影響箇所を実測**(パイロット=外部SaaS 7個で smoke.mjs の41箇所のみ)。Phase 0(CI緑)→ 1(ツールのパス解決抽象化)→ 2(パイロット)→ 3(依存の少ない順に残り)→ 4(グロブ整理)の手順を `docs/ops/PACKAGE_RECATEGORIZATION_PLAN.md` に明文化。実移行は CI 緑化後。

アプリ3つ・パッケージ96個・スモーク844項目。「テンプレから量産」「CIでの品質保証」「探しやすい構造への道筋」という次フェーズの土台が揃った。

---

## MCP導入(packages/mcp + Zoho CRM)/ 備品管理アプリ(実戦投入)/ E2E整備

### packages/mcp(97個目・AI連携の基盤)
- **MCP(Model Context Protocol)サーバの最小実装**。JSON-RPC 2.0 の解析(-32700/-32600)、`initialize`(バージョン交渉: 2025-06-18/2025-03-26/2024-11-05)、`tools/list`・`tools/call`(handler 例外は isError 結果、未知ツール -32602、未対応メソッド -32601)、通知(id 無し)は無応答。プロトコル処理は純関数 `handleMcpMessage` で、stdio サーバ(`serveStdio`)は入出力注入可能 — PassThrough ストリームで**往復まで検証済み**。

### internal-app MCP サーバ(ツール8種・Zoho CRM 連携)
- `src/server/mcp-tools.ts`: DI 設計の `buildMcpTools(deps)`。**invoice_list / invoice_get / partner_list / inventory_status / report_sales_csv / audit_recent / zoho_search_records / zoho_get_record** の8ツール(読み取り専用)。引数は防御的に解釈し、失敗は isError+理由(Zoho 未設定時は設定ガイド文言)。
- **Zoho 連携**: 基盤 `@platform/zoho` に **`refreshAccessToken`**(リフレッシュトークン→アクセストークン、ヘッドレス実行用)を新設(スタブ fetch で成功/HTTP失敗/error/例外/api_domain補完を検証)。`mcp/server.mts` が起動時にトークン取得 → `createResilientZohoFetch`(ブレーカー+バルクヘッド+タイムアウト)経由で CRM v8 クライアントを配線。
- 起動 `pnpm --filter internal-app mcp`(tsx)。`mcp/README.md`(接続手順・ツール一覧・セキュリティ注意=stdio は認証なしローカル専用・読み取りのみ)と `claude_desktop_config.example.json` を同梱。実クライアント接続確認は pnpm install 後。

### apps/equipment-app(備品管理 = crud-template 実戦投入・認証込み)
- テンプレをコピーし、無かった3要素を実装: **認証**(zoho-session+password の2ファイル移植: HMAC セッション+scrypt、初期 admin@example.com)・**子レコード**(貸出履歴)・**状態遷移**(在庫あり⇄貸出中。`lend/giveBack` が `{ok,error}` を返し route が 409 化)。UI はログイン→一覧(貸出中: 借用者表示)→登録・行内貸出・返却・編集・無効化。port 3003。
- **フィードバックを基盤へ反映**: patterns.md に「6. MCP ツールの足し方」「7. 認証の最小移植」「8. 子レコードと状態遷移」を追記、crud-template README に実例リンク。未整備として「一覧+詳細 UI」を次候補に記録。

### E2E 整備
- playwright.config.ts の webServer を**配列化**(showcase 3001 / crud-template 3002 / equipment-app 3003)。`e2e/crud-template.spec.ts`(登録→編集→無効化→無効表示)と `e2e/equipment-app.spec.ts`(ログイン→登録→貸出→返却)を追加。**未実走**(オフラインのため)・CI 緑化後に確認の注記付き。

アプリ4つ・パッケージ97個・スモーク852項目。「AI から社内データを操作する入口(MCP)」と「テンプレ→実アプリ→基盤へ還元」のループが回り始めた。

---

## 開発環境セットアップの自動化(clone → 開発開始を1コマンドに)

- **scripts/setup.sh**(`pnpm setup`): 前提確認(Node≥22 / corepack / Docker 稼働 / ポート)→ `.env.example`→`.env`(上書きなし)→ 既存 docker-compose の **db+mailhog のみ起動**+pg_isready 待ち → **アプリ別 DB を psql で冪等作成**(app / app_crud / app_equipment)→ pnpm install → **prisma generate ×3 → db push ×3**(各 .env の DATABASE_URL を尊重)→ smoke+check-deps で自己検証 → 起動コマンド一覧を表示。`--check` / `--skip-docker` / `--skip-db` あり。冪等・再実行安全。
- **.env.example ×4**(internal-app 28 変数 / public-site / crud-template / equipment-app): 必須・任意・運用系・Zoho(API/SSO)をコメント付きで整理。
- **tools/check-env-example.mjs**(CI boundaries 組込): コードが参照する環境変数(`process.env.X` / `env.X` / zod キー)と `.env.example` の整合を検査。導入時に **internal-app の記載漏れ6変数(Zoho SSO / 認可調整系)を即検出**→修正。
- **docs/ops/SETUP.md**: クイックスタート / 前提 / スクリプトの中身 / ポート一覧(3000〜3004, 5432, 1025/8025, 7700, 6379)/ アプリ別 DB の理由 / Prisma 運用(push と migrate の使い分け・--schema 指定)/ つまずき FAQ / 手動手順 / Windows は WSL2 推奨。README 冒頭にもクイックスタートを追加(パッケージ数 81→97 の古い記述も修正)。
- 方針: **Node/Next はホスト実行、Docker は DB・メール等のインフラのみ**(HMR・node_modules 性能・デバッガ都合で開発体験が最良。フルコンテナ開発が必要になれば devcontainer を次段で検討)。

---

## CI実走の整備完了 / devcontainer / タスクランナー

### ① CI実走の準備を完了形に(実走そのものは GitHub 側でのみ可能)
- **全8ワークフロー監査**: e2e / security / i18n にも残っていた `--frozen-lockfile` を暫定化(4ファイル・計5箇所 TODO 付き)、i18n の pnpm 10.9.7 固定を除去し packageManager に完全一本化。
- **tools/preflight.mjs**: オフライン検証8ゲート(smoke 852 / check-deps / api-surface 差分 / schema×3 / env-example / setup.sh 構文)を約10秒・要約表つきで一括実行。`pnpm verify:offline` と CI boundaries を同一実装に統合。
- **デプロイ経路の欠落を修復**: release.yml が参照していたのに存在しなかった `apps/internal-app/Dockerfile`(pnpm fetch→offline install→prisma generate→Next **standalone**、ビルド時ダミー env で fail-fast 回避)と `Dockerfile.migrate`(prisma@7.2.0 単体で migrate deploy)を新設。`.dockerignore` も追加。**未検証**(本環境に docker なし)を明記し、確認手順を整備。
- **docs/ops/CI_FIRST_RUN.md を結果記入欄つきチェックリスト(10手順+つまずき分岐)へ刷新**。

### ② devcontainer / GitHub Codespaces 対応
- `.devcontainer/`: ベース compose に workspace(typescript-node:22)を重ねる方式。db / mailhog を同時起動し、post-create が .env のホスト名を **db / mailhog へ自動置換**→ install → generate/push → smoke まで全自動。既存ボリュームでも `tools/create-app-dbs.mjs`(pg 直叩き・冪等)が不足 DB を補完。JSON / YAML / bash 構文とサービス整合(base+overlay)を機械検証済み。

### ③ タスクランナー(pnpm scripts に一本化。Makefile 非採用 = Windows 互換と二重管理回避)
- **tools/db.mjs**: `pnpm db <generate|push|migrate|studio|validate> [app|all]` — 3アプリの --schema と DATABASE_URL(.env 優先 / PGHOST 対応)を自動解決。`--dry-run` を実出力で検証(migrate の `-- --name init` パススルー含む)。
- ショートカット10種: `db:up/down/psql`、`dev:internal/site/crud/equipment/demos`、`mcp`。SETUP.md に一覧表。

---

## 壁打ち(2026-07)統合: AI Gateway / ロードマップ / ADR / AWS方針 / Analytics初版

ChatGPT 壁打ち(AWS展開+AI/DXプラットフォーム構想)を精査し「実装 / 既対応 / 計画化」に仕分けて反映。

### @platform/ai — AI Gateway(98個目・構想の背骨)
- 「アプリは AI API を直接呼ばない」ルールの受け皿。**ルーティング**(明示routes>models>接頭辞 claude/gpt/o1/gemini)・**トークン制御**(1回上限の強制+累積予算、超過は RATE_LIMITED)・**コスト計算**(円/1k・利用者別集計)・**マスク付きログ**(プロンプトは既定不保存、残す場合も redact)・**フォールバック**。全て Result 返し・fetch 注入。
- 実プロバイダ2種(Anthropic Messages / OpenAI Chat Completions)を同梱し、**リクエスト形状(x-api-key・system抽出・Bearer・usage解析・HTTPエラー整形)までスタブ fetch で検証**。スモーク+3(855)。実 API 疎通のみキー設定後の各環境で。

### 方向性の正典化
- **docs/platform/ROADMAP.md**: 4層モデル・構想→現状の対応表(✅/🔶/⬜/📋 約28項目)・Phase 再定義(P2=RAG/EventBus, P3=Portal/Advisor/DocGen が最優先)・設計原則(RAG=検索/MCP=操作、API>MCP>RPA、RAG は権限継承)。
- **docs/adr/**: ADR 導入(テンプレ+6本: モノレポ分離 / Prisma7 / デュアルストア / MCP自作 / ConoHa先行・AWS次段 / AI Gateway必須)。
- **CLAUDE.md**: 開発ルール節を追加(AI直叩き・キー直書き禁止ほか)。
- **AWS導線**: docs/ops/DEPLOY_AWS.md(Amplify中心+Lambda切出し基準+初回チェック)とルート amplify.yml(monorepo/appRoot形式・**未検証**明記)。現行 ConoHa 経路は維持(ADR-0005)。
- **Platform Analytics 初版**: tools/platform-report.mjs → docs/ai/platform-report.md(実測: パッケージ98・README 98/98・**テスト保有89/98=91%**・公開API 3,027・スモーク855)。
- 既対応と確認: Feature Flag=@platform/flags、監査=audit、Scheduler=cron 等は構想側要件を満たす。RAG/EventBus/Portal/ConfigCenter/DataDictionary は ROADMAP に計画化。

---

## AI基盤の実装(RAG骨格 + MCP拡張 + AI組込 + Portal + ADR整理)

壁打ちで最優先とされた項目を一気に実装。スモーク864・パッケージ99・アプリ5。

### @platform/rag(99個目・権限継承検索)
- `chunkDocument`(段落尊重+長段落強制分割+overlap。**二重overlap のバグを発見し修正**=各断片が maxChars 以内に収まることを検証)、`canAccess`(**ACL 未設定は既定不可・管理者ロールでも自動全許可しない**=壁打ち要件)、`createRagStore`(ingest/retrieve/remove。権限フィルタ後に limit)、`buildContext`(引用番号つき文脈整形)。embedding は `Embedder`/`VectorIndex` の差し込み口のみ(未接続でも BM25 で動作、接続でハイブリッド)。

### MCP 拡張(resources / prompts / 認可 / 書き込み)
- packages/mcp に **resources**(read/list)・**prompts**(get/list・引数展開)・**authorizeTool フック**・ツールの scopes/destructive を追加。capabilities も動的反映。
- internal-app に**書き込みツール2種**(invoice_record_payment / invoice_cancel)を追加。既定無効で `MCP_ENABLE_WRITES=1` のときだけ登録、**実行毎に監査ログ**、scope(invoice:write)で認可。resources(請求サマリー/要発注)・prompts(催促メール/発注レビュー)も公開。読み取り8+書き込み2=10ツール。

### internal-app への AI 組込(Gateway 経由の実例)
- `ai-gateway.ts`: ANTHROPIC_API_KEY があれば実プロバイダ、無ければ**モック**で動作(aiIsMock)。pricing/limits/redact(メール電話マスク)/logStore を配線。
- `/api/ai/summarize`(要ログイン・Gateway経由・短文/箇条書き)、`/api/ai/usage`(管理者のみ・累計コスト/トークン/利用者別/直近ログ)、`/ai` 画面(要約 + コスト可視化・モックバナー)。壁打ちの「AI Gateway でコスト管理」を UI で体現。

### apps/platform-portal(5つ目のアプリ・基盤ポータル)
- 壁打ち最優先の「Platform Portal」最小版。`catalog.ts` が**リクエスト時にリポジトリ成果物**(api-surface/module-list/README/platform-report/adr)を読み、`/api/catalog` が返す。3タブ(パッケージ検索=名前/説明/export+カテゴリ絞り / ヘルス / ADR)。port 3005。99パッケージを AI も人も探せる入口。

### ADR 整理
- 前セッションで既存 ADR(0001-0005)を見落として重複作成していたのを是正。**既存を正とし、追加分を 0006-0010 へリナンバー**(Prisma7/デュアルストア/MCP自作/デプロイ/AI Gateway)、重複1件を削除、index を10本の正しい表に再生成。ROADMAP/CLAUDE の参照も更新。

---

## AI基盤の実装拡充: embedding/pgvector + Platform Advisor + CI実走準備

### RAG のベクトル検索(embedding + VectorIndex)
- **@platform/ai に Embedder**: `createOpenAiEmbedder`(/v1/embeddings・Bearer・fetch注入で形状検証)と `createHashEmbedder`(API不要・決定的・正規化済み擬似埋め込み=パイプライン確認用)。
- **@platform/rag に VectorIndex**: `createMemoryVectorIndex`(総当たりコサイン)/ `createPgVectorIndex`(pgvector・`<=>`距離→`score=1-distance`・UPSERT/ON CONFLICT・DB注入でSQL組み立てをオフライン検証)/ `cosineSimilarity`。**hash embed→memory index→ベクトル検索が権限フィルタと両立**することを実パイプラインで確認(memberはpublicのみ・HR文書除外)。骨格→実RAGへの結線が完成(pgvector本体の疎通はDB接続後)。

### Platform Advisor(tools/advisor.mjs・壁打ちの Package Finder / Duplicate Detector)
- `advisor find <語>`: 名前/説明/export を横断検索しスコア順に提示(**新規作成の前に既存を探す**。mail送信→@platform/mailがscore81でトップ)。該当なしは空(新規作成の合図)。
- `advisor dup`: **同名export 72組**(Session←auth/session 等)・**似た概念 27組**(接頭辞/接尾辞を除いた語幹一致)・**孤立1**を検出。`report` で docs/ai/advisor-report.md 生成、`json` で機械可読。
- Portal に **Advisor タブ**を統合(catalog に重複サマリ+孤立一覧)。CLI は isMain ガードで import 併用可。

### CI 実走の詰め(実走そのものは GitHub 側)
- **tools/check-generated.mjs**: module-list / advisor-report が生成し直しても差分ゼロか検査(生成物の drift 防止)。導入時に module-list の古さを即検出→再生成。
- preflight に advisor、CI boundaries に check-generated を追加。verify ジョブの prisma generate を**3アプリに拡張**(crud/equipment の typecheck 用)。
- **ローカル再現で緑を確認**: preflight 8ゲート(smoke 871)+ check-generated + 全7ワークフロー/amplify/compose×2 の YAML 妥当性。残りは install/build/docker/e2e の実走のみ(CI_FIRST_RUN のチェックリスト)。

---

## 外部ソースの取り込み(社内既存リポジトリの精査)

社内 GitHub の2リポジトリ(Company-wide-data / zoho-emergency-backup)を精査し、**重複を避けて汎用部品のみ**取り込み。判断記録は docs/ops/UPSTREAM_IMPORT.md。

### 取り込み: CSV ストリーミング → @platform/csv
- zoho-emergency-backup の大容量 CSV 処理(500MB〜1GB をメモリ全展開せず処理)を、**File/Papaparse 依存を排した環境非依存形**に一般化して追加。`streamCsvLines`(AsyncIterable をチャンク処理)/ `parseCsvChunks`(埋め込み改行対応)。既存 `parseCsv`(同期)を補完し重複せず。回帰込みで検証。
- **見送り**(重複/固有依存): storage.ts(S3密結合)・db.ts(Dexie)・retryFailedEdits/resumeDeletions(アプリDB固有=jobs/sagaでカバー)・importService(Zoho固有=importerでカバー)・form/grid(AG Grid/Amplify密結合=ui/formでカバー)・Company-wide の分析スクリプト(一回性)。

---

## PR自動レビュー(CI)+ RAG管理画面(権限継承の実挙動)

### PR Auto Review(.github/workflows/pr-review.yml + tools/pr-review.mjs)
- PR に**決定的な自動レビュー**をコメント投稿(既存コメントは更新)。内容: スモーク数・依存境界・API破壊的変更・生成物drift・.env整合・**Advisorの重複サマリ**(同名export/類似/孤立)。install 不要で高速。
- 「AI レビュー」の土台: 集めた事実を `@platform/ai`(Gateway)に渡せば LLM 講評まで拡張可能(APIキー設定時・任意)。実データで全項目緑を確認済み。

### internal-app RAG 管理画面(/rag・権限継承の体感)
- `rag-service.ts`: @platform/rag + @platform/search(BM25)+ createHashEmbedder を配線。ACL 違いのサンプル文書3件(全員/人事・管理者/管理者のみ)を冪等 seed。
- `/api/rag/search`(ログインユーザーのロールを継承検索)・`/api/rag/ingest`(管理者のみ・公開範囲=全員/人事/管理者を選んで登録)・`/rag` 画面(検索+結果+管理者向け登録フォーム)。
- **権限継承の実挙動をスモークで実証**: 一般社員には賞与規程・役員限定文書が出ず、人事は賞与規程が見え、管理者は役員限定も見える。publicは全員可。壁打ちの「管理者権限で全検索しない/利用者権限を継承」をアプリで体現。

---

## 外部ソース取り込み(第2回): MCP over HTTP

社内3リポジトリ(group-board / yojitsu / nano-banana-chat-ui)を精査し、**重複を避けて1件**取り込み。判断記録は docs/ops/UPSTREAM_IMPORT.md。

### 取り込み: MCP over HTTP → @platform/mcp
- yojitsu の MCP over HTTP(Streamable HTTP・stateless・Bearer・RFC 9728)を、公式 SDK 非依存の薄いアダプタとして一般化。基盤 MCP は stdio 専用だったため**重複せず補完**。`handleHttpMcp(request, options)`(Web標準 Request→Response・POST のみ・通知202・認証失敗401+WWW-Authenticate)+ `extractBearerToken`。トークン保存方式は規定せず authenticate 注入、authorizeTool と組み合わせスコープ制御。Next.js Route Handler / Amplify(serverless)対応。8項目スモーク。
- **見送り**(重複/固有依存): freee(既存@platform/freeeで充足)・PL/org/bonus(業務ロジック)・mcp/token(Prisma固有→authenticate注入で吸収)・OAuthサーバ(NextAuth密結合)・WebAuthn(Cognito密結合)・repo群(業務スキーマ)・shadcn UI(@platform/ui重複)・Gemini画像生成(Lambda/API固有→将来@platform/aiに画像プロバイダ)。

---

## RAGソース取り込み + Reference Generator(壁打ち最優先3点の最後)

### RAG ソース取り込みヘルパー(@platform/rag)
- `textToDocument`(テキスト→1doc)・`rowsToDocuments`(Excel/CSV の行→row/sheet モードで doc 群・空値除外)・`splitTextToDocuments`(PDF 抽出結果等を空行区切りで節分割)。**rag は pdf/xlsx に依存せず**、抽出済みテキスト/行を受け取る疎結合設計。`@platform/xlsx` の readSheet や `@platform/csv` のストリーミングと組み合わせて ingest に流せる。

### Reference Generator(tools/gen-reference.mjs → docs/platform/api-reference.json)
- 各パッケージ src/index.ts から export と JSDoc 要約を抽出(**55 パッケージ・422 エントリ・要約付き99.8%**)。TypeDoc の完全版は重い(要 install)ため軽量自作。
- **Portal に統合**: パッケージカードに「API リファレンス」開閉を追加し、kind(function/interface 等)+名前+要約を表示。AI も人も API を1画面で辿れる。
- check-generated / preflight に組み込み、drift を防止。壁打ち最優先3点(Portal / Advisor / Reference&Doc Generator)が出そろった。

---

## Doc Generator拡張(ER図)+ AI画像プロバイダ + 第3回精査(取り込みなし)

### ER図生成(tools/gen-erd.mjs → docs/platform/erd/*.md・Portal統合)
- Prisma スキーマを解析し **Mermaid erDiagram** を生成(model/フィールド/型/PK、@relation の FK から必須 `}|--||`・任意 `}o--||` を判定、配列側の重複線は回避)。internal-app(60モデル/2リレーション)・crud-template・equipment-app を出力。
- Portal に **ER図タブ**を追加(アプリ別 Mermaid ソース表示)。check-generated / preflight に組み込み drift 防止。人向けドキュメント(壁打ちの「DB設計書/ER図」)を自動化。

### AI画像生成/編集ゲートウェイ(@platform/ai)
- 壁打ちの「将来的な画像生成AI対応」+ 社内 nano-banana(Gemini画像編集)の一般化。テキスト同様アプリは直叩きせず Gateway 経由に。`createAiImageGateway`(ルーティング・枚数上限・1枚単価コスト・AiLogStore 流用ログ)+ `createOpenAiImageProvider`(/v1/images/generations)。`generate({ prompt, image? })` で生成/編集両対応。Gemini 等は AiImageProvider 実装で追加可能。

### 第3回外部ソース精査(cliq-ai-bot / mediaprep / it_desk)— 取り込みなし
- 精査の結果、**取り込む新規汎用部品はなし**。cliq-ai-bot(実体なし)、mediaprep(exifr/Canvas 等ブラウザ専用)、it_desk(フロントの WS 再接続は既存 @platform/realtime と**完全重複**、バックエンドは Python/FastAPI で言語違い・AI 機能は既存 @platform/ai/rag が既にカバー)。判断記録は docs/ops/UPSTREAM_IMPORT.md。基盤の網羅性が上がり、新規アプリの共通処理が基盤で賄えるようになった裏づけ。

---

## ファイルロック取り込み + 画面/API 一覧生成 + 画像編集実例

### 取り込み: ファイルベースのプロセス間ロック → @platform/cron
- membership-extender の Chromium 直列化ロックを、winston/Chromium 依存を排して一般化。既存の分散ロック(Redis/メモリ・TTL)は持っていたが**単一ホストの PID 死活監視付きファイルロック**は無く、重複せず補完。`acquireFileLock`(待機付き・タイムアウト例外)/`tryAcquireFileLock`/`releaseFileLock`/`createFileLockStore`(既存 LockStore I/F 適合)。PID 死活・stale 自動回収・自 PID のみ解放。10項目スモーク(実FS)。用途: 単一ホスト=ファイル、複数インスタンス=Redis。

### 画面・API 一覧生成(tools/gen-app-map.mjs → docs/platform/appmap/*.md・Portal統合)
- Next.js App Router の route.ts / page.tsx を走査し、URL(動的 [id]→:id・catch-all→*・route group 除去)・HTTP メソッド・画面タイトルを抽出。**internal-app 画面63/API193** ほか5アプリ。Portal の「設計」タブにアプリ別規模表を統合。check-generated / preflight で drift 防止。壁打ちの「画面仕様書/API 仕様書」を自動化。

### internal-app 画像生成の実例(/ai-image)
- 画像 Gateway(@platform/ai の createAiImageGateway)を internal-app に配線。OPENAI_API_KEY があれば OpenAI Images、無ければ**モック**(SVG プレースホルダ)。`/api/ai/image`(要ログイン・Gateway 経由)+ `/ai-image` 画面。コストは**テキストと同じ aiLogStore** に計上され、既存の /ai 利用状況画面で横断的に見える。「アプリは AI を直叩きしない」をテキスト・画像とも徹底。

### 第4回外部ソース精査(marketing / membership-extender / shift-app)
- 取り込み1件(上記ファイルロック)。見送り: usage-tracker(既存ai重複)・function-definitions/ga4-client(GA4固有)・notifier/logger(既存notify/logger重複)・freee系(既存freee)・業務ロジック各種。判断記録は docs/ops/UPSTREAM_IMPORT.md。membership の「API 連携優先・RPA は最後」は壁打ちの API>MCP>RPA と一致。

---

## RPA 安全実行の共通部品 + 画面遷移図 + 第5回精査(取り込みなし)

### @platform/rpa — RPA ランナー骨格
- 基盤は RPA 本体(ブラウザ自動操作)は持たない(壁打ちの **API > MCP > RPA**、RPA は最後の手段)。代わりに「安全に実行するための枠組み」を共通化: **直列化**(同一 lockKey は同時実行しない)・**リトライ**(指数バックオフ・isRetryable)・**冪等**(idempotencyKey で成功済みはスキップ)・**タイムアウト**(signal.aborted 連動)・**監査**(start/success/error/timeout/skip)。
- ロック・監査シンクは**注入**(外部依存ゼロ・core のみ)。単一ホストは @platform/cron の createFileLockStore、複数インスタンスは createRedisLockStore を渡す。失敗理由は CONFLICT/INTERNAL/EXTERNAL で判別。membership-extender の RPA 知見(Chromium 直列化・再送)を汎用化した到達点。9項目スモーク。

### 画面遷移図(gen-app-map 拡張・Portal統合)
- 各 page.tsx の内部リンク(href="/...")を抽出し、**既知ページ間のみ**の Mermaid flowchart を生成(API リンク除外・壊れたリンクは描かない)。public-site 等の明示リンク型アプリで遷移を可視化。共有ナビ型(internal-app)ではエラーなく少数遷移を出す。Portal「設計」タブに flowchart を統合。

### 第5回外部ソース精査(ai-portal-demo / interview-recorder ×2 / aetara-lp)— 取り込みなし
- 取り込む新規汎用部品なし。ai-portal-demo(Python・MCP は既存 @platform/mcp でカバー)、interview-recorder-server(TS だが Vercel Blob/Neon/Prisma 密結合・共通処理は既存でカバー)、interview-recorder-appliance(Python・送信キューは jobs/upload でカバー)、aetara-lp(独自ロジックなし)。**5回連続の精査で基盤が新規アプリの共通処理をほぼ吸収できる水準に到達**したことを確認。判断記録は docs/ops/UPSTREAM_IMPORT.md。

---

## リプレイ防止取り込み + Windows セットアップ + 依存グラフ + RPA デモ

### 取り込み: リプレイ防止 → @platform/security
- universe-club の JWT jti 再利用拒否ストアを、ストア注入式に一般化。既存 security(csrf/headers/sanitize)に replay/nonce 防止は無く重複せず補完。`createReplayGuard`(markUsedIfNew: 初見true・再利用false)+ `createMemoryReplayStore` + `ReplayStore` 抽象(本番は Redis/DynamoDB TTL)。JWT jti・nonce・冪等キーに使える。6項目スモーク。

### Windows セットアップ(scripts/setup.ps1 + setup.bat)
- macOS/Linux の setup.sh と同等の手順を PowerShell 版で用意(前提確認→.env 準備→Docker→アプリ別DB→pnpm install→prisma generate×3→db push×3→スモーク検証)。`-Check`/`-SkipDocker`/`-SkipDb` は sh 版と同じ。冪等・.env は上書きしない。
- **setup.bat**: cmd/ダブルクリック用ラッパー。pwsh 優先→Windows PowerShell フォールバック、ExecutionPolicy Bypass 内包。
- **tools/check-win-setup.mjs**(preflight 組込): pwsh 無し環境でも回る静的検査(括弧均衡・必須要素・sh 版との手順対応 17項目)。SETUP.md に Windows 手順を追記。

### 依存グラフ可視化(tools/gen-depgraph.mjs → docs/platform/depgraph.md・Portal統合)
- 各パッケージの @platform/* 依存を集計し、**カテゴリ間依存の Mermaid flowchart**+**被依存トップ12**(core が43で最多=ハブ)+**依存元トップ12**を生成。Portal「設計」タブに統合。check-generated 組込。

### internal-app RPA デモ(/rpa-demo)
- @platform/rpa ランナーを配線(メモリロック+監査シンク)。`/api/rpa/run`(管理者・成功/失敗パターン)+ `/api/rpa/log`(監査取得)+ `/rpa-demo` 画面。直列化・リトライ・タイムアウト・監査が動く実例。失敗パターンでリトライ2回と error 監査が見える。

### 第6回外部ソース精査(ai-portal-demo〔再〕/ interview-transcribe / call_check / universe-club)
- 取り込み1件(replay 防止)。見送り: 音声分割(ffmpeg 依存)・transcribe/generate(既存 ai)・jwt/session-crypto(既存 auth/session/crypto)・aws/image(既存 storage/image)・業務ロジック・call_check(Python)。判断記録は docs/ops/UPSTREAM_IMPORT.md。

---

## 辞書テキスト正規化 + RPAデモ画面 + 依存グラフ + Windowsセットアップ

### 取り込み: 辞書ベースのテキスト正規化 → @platform/utils
- interview-transcribe の用語辞書(表記ゆれ・音声認識誤変換の補正)を、業務辞書は持ち込まず**仕組みだけ**汎用化。`replaceByDictionary`(longest-match優先・wholeWord対応)+ `buildGlossaryHint`(用語→LLMヒント文)。既存の normalizeText 等を補完(重複なし)。8項目スモーク。

### internal-app RPA デモ画面(/admin/rpa)
- @platform/rpa のランナーを配線(メモリロック+監査シンク注入)。デモタスク `runDemoPointSync`(段階実行・fail でリトライ・冪等キーで skip)。`/api/rpa/demo`(管理者・POST実行/GET監査取得)+ 画面で「直列化・リトライ・冪等・監査」の挙動を体感。監査イベントを画面に一覧表示。

### 依存グラフ可視化(gen-depgraph → Portal「設計」タブ)
- パッケージ間の実行時依存(@platform/* の dependencies・devDeps除外)を集約。カテゴリ間依存グラフ(Mermaid)+ 被依存トップ(core が最多の土台)。Portal に統合し、check-generated で drift 防止。

### Windows セットアップ(scripts/setup.ps1 + setup.bat)
- setup.sh と**完全同等**の PowerShell 版 + バッチラッパー。前提確認(-Check)・Docker省略(-SkipDocker)・スキーマ省略(-SkipDb)対応。pwsh/powershell 自動判定。前提確認→.env準備→Docker起動→アプリ別DB作成→pnpm install→prisma generate/push×3→スモーク検証まで。SETUP.md に Windows 手順を記載。

### 第6回外部ソース精査(call-check / interview-transcribe / universe-club)
- 取り込み1件(上記辞書正規化)。見送り: 音声処理(ffmpeg依存)・文字起こし/生成(既存ai)・jti-store(第2回で取込済のreplayGuardと重複)・Twilio録音(Python言語違い・業務固有)。5回超の精査で基盤が新規アプリの共通処理をほぼ吸収できることを再確認。

---

## Windows検証のCI組込 + 辞書補正RAG連携

### Windows セットアップの静的検証を CI/preflight に組込
- 既存の `tools/check-win-setup.mjs`(ps1/bat の括弧均衡・param・ExecutionPolicy・setup.sh 手順対応)を preflight と ci.yml boundaries に組込済み。今回バッチの **goto ラベル整合チェック**を追加強化。pwsh が CI に無くても Windows スクリプトの破損を検出できる。スモークでも実 setup.ps1/bat の健全性を確認。

### internal-app 辞書補正→RAG連携(/rag/transcript)
- 文字起こしテキストを `@platform/utils` の `replaceByDictionary` で誤変換補正(議事六→議事録、ケーピーアイ→KPI 等)してから RAG に投入する導線。`normalizeTranscript`/`ingestTranscript`/`transcriptGlossaryHint` を rag-service に追加。`/api/rag/transcript`(管理者・補正して取り込み)+ `/rag/transcript` 画面(補正差分を表示)。**補正後の語で検索がヒットし、権限継承も働く**ことをスモークで実証(音声認識の揺れを吸収して検索精度を上げる実例)。

### CI 実走準備(①)
- install 不要の全ゲート(preflight 11項目・スモーク911・check-generated・全8ワークフロー/amplify/compose の YAML・Windows 静的検証)をローカルで緑確認。残るは install/build/docker/e2e の実走のみ。実ログが出れば CI_FIRST_RUN.md のチェックリストで即対応できる状態。

---

## OS連携(os-notify) + DB Viewer + 辞書のアプリ設定化

### @platform/os-notify(OS ネイティブ通知・音)
- Windows / macOS / Linux のデスクトップ通知と音を鳴らす。`buildNotifyCommand`/`buildSoundCommand`(OS別コマンド生成の純関数)+ `createOsNotifier`(spawn 注入式・未注入なら dry-run)。Windows=PowerShell トースト/Beep、macOS=osascript/afplay、Linux=notify-send/paplay。シェル/PS エスケープ済み。既存 `@platform/notify`(外部サービス通知)と補完関係(こちらは実行マシン自身への通知)。常駐ツール・RPA・バッチの完了通知向け。12項目スモーク。

### DB Viewer(phpMyAdmin 的・internal-app /admin/db-viewer)
- テーブル一覧・スキーマ表示・データ閲覧(ページング)・行の挿入/更新/削除・任意 SQL 実行。`@platform/db` の rawQuery/rawExecute が土台。**安全対策**: 識別子は information_schema でホワイトリスト化(実在確認+文字種チェック)、値は必ずパラメータ化、UPDATE/DELETE は WHERE 必須(全行操作禁止)、任意 SQL はマルチステートメント禁止・DROP/TRUNCATE 等は明示確認が必要。管理者専用。15項目のロジック検証。

### 辞書のアプリ設定化(前回候補)
- 補正辞書をハードコードから可変ストア+編集 API に。`getReplacements`/`addReplacement`(from 重複は上書き)/`removeReplacement`/`getGlossaryTerms`/`addGlossaryTerm`。管理画面 `/admin/glossary` で非エンジニアが表記ゆれ・固有名詞を編集でき、変更は文字起こし取り込みと検索クエリの両方に即反映。

### RAG検索の辞書ヒント統合(前回候補)
- `/api/rag/search` が検索クエリを `normalizeTranscript` で補正してから検索。ユーザーが誤変換のまま入力しても正しい語で検索できる(表記ゆれに強い検索)。

---

## アニメーション拡充 + DB Viewer DDL対応 + RPA-OS通知連携

### アニメーション拡充(@platform/ui/lib/motion-extra + motion-tween)
- 既存 motion.ts(基本イージング・パララックス・reveal)を**重複せず補完**。
- **motion-extra**: 拡張イージング20種(quart/quint/expo/sine/back/elastic/bounce の in/out/inOut)・`lerp`/`inverseLerp`/`mapRange`(clamp・ゼロ除算回避)・`staggerDelays`(start/end/center・base)・バネ物理 `stepSpring`/`isSpringSettled`(半陰的オイラー法)。
- **motion-tween**: 全イージング統合テーブル `allEasings`/`applyEasing`・`tweenValue`(時間ベース値補間)・`tweenColor`(#rrggbb 補間)・`buildKeyframes`(@keyframes 文字列生成)・`buildAnimationShorthand`・`flipTransform`(FLIP アニメの transform 差分)。すべて純関数で描画に非依存。19項目スモーク。

### DB Viewer DDL対応(テーブル作成/削除・カラム追加/削除)
- `classifySql` に **ddl 種別**(CREATE/ALTER)を追加。`runSql` は ddl を `allowDdl` フラグ無しで拒否。
- `createTable`/`dropTable`/`addColumn`/`dropColumn` を追加。**型ホワイトリスト**(text/integer/varchar 等のみ許可・`text; DROP` のような型インジェクションを弾く)、識別子の文字種チェック、IF NOT EXISTS/IF EXISTS で冪等。UI に「スキーマ操作」タブ(テーブル作成フォーム・カラム追加/削除・テーブル削除は confirm 確認)。13項目スモーク。

### RPA→OS通知連携
- RPA タスクの完了・失敗時に `@platform/os-notify` で実行マシンに OS 通知を飛ばす配線。`RPA_OS_NOTIFY=1` または spawn 注入時のみ発火(既定は無効・環境非依存)。成功=通知、失敗=通知+音、冪等スキップ=通知なし。通知失敗は RPA 本体に影響させない。`setRpaNotifySpawn` で注入点を提供。

---

## CIログ解析 + Windows静的解析(PSScriptAnalyzer)+ 辞書補正の可視化

### CI 実走ログ解析(tools/ci-log-report.mjs)
- GitHub Actions の raw ログを貼るだけで「どのステップが・なぜ落ちたか」を要約。`##[group]`/`##[error]`/`##[warning]` とタイムスタンプを解析し、失敗ステップ・エラー行(TS エラーも)・警告数・遅いステップ上位を抽出。`--json` で機械処理向け出力、標準入力にも対応。
- 使い方: `node tools/ci-log-report.mjs <ログ>` または `cat ci.log | node tools/ci-log-report.mjs`。CI が実際に失敗したとき、ログを渡せば即座に原因箇所を特定できる。

### Windows スクリプトの静的解析(PSScriptAnalyzer)
- ci.yml に `windows-scripts` ジョブを追加(windows-latest)。PowerShell 構文チェック(パースエラー検出)+ PSScriptAnalyzer 本体で setup.ps1 を解析。
- `scripts/PSScriptAnalyzerSettings.psd1` で現実的に運用: コンソール出力の Write-Host・短いヘルパ関数(承認動詞)・ShouldProcess は除外し、平文パスワード・Invoke-Expression・未使用変数など本当の問題は検出したまま。
- 既存の軽量チェック `check-win-setup.mjs`(pwsh 無しでも回る)に PSSA 設定の整合検査を追加し、二重の保険にした。

### RAG 検索の辞書補正を可視化
- 検索クエリの辞書補正(誤変換のまま入力しても正しい語で検索)を、結果画面に「『現地名』を『源氏名』として検索しました」とバッジ表示。search route が `normalization{raw,corrected,changed}` を返し、補正が起きたときだけ表示する。

---

## アニメーションフック + DB Viewer CSV + 通知履歴 + e-learning

### アニメーションの React フック化(@platform/ui)
- `useTween`(値アニメ・RAF駆動)/`useSpring`(バネ物理追従)/`useInView`(IntersectionObserver で表示検知→reveal)。拡充した純関数(motion-extra/motion-tween)を React で使いやすく。SSR/RAF 無し環境では即最終値にフォールバック。

### DB Viewer の CSV 入出力
- `exportTableCsv`(全行を BOM 付き CSV・Excel 対応)/`importTableCsv`(1行ずつ INSERT・実在カラムのみ・パラメータ化・空文字は NULL)。UI から DL/取込。`@platform/csv` を土台に。

### os-notify 通知履歴
- `OsNotifyLogStore`/`createMemoryNotifyLog` を追加。`createOsNotifier({ log })` で送信履歴(成功/失敗・kind・時刻)を記録。RPA サービスに配線し `/api/rpa/notify-history` で管理画面から確認可能。

### e-learning(@platform/elearning + internal-app)
- **新パッケージ @platform/elearning**: コース(Course→Module→Lesson)・クイズ採点(`gradeQuiz`・単一/複数選択・順不同)・進捗計算(`courseProgress`・estimatedMinutes で重み付け)・修了判定・修了証発行(`issueCertificate`)。純関数のみ。14項目スモーク。
- **internal-app 受講画面 /learning**: サンプルコース「情報セキュリティ基礎」(5レッスン・動画/記事/クイズ)。進捗バー(アニメ付き)・章別進捗・レッスン完了・クイズ挑戦(合格でレッスン完了)・修了証発行。進捗はユーザー単位(メモリ・実運用は DB へ)。

---

## 辞書のDB永続化 + CI失敗ログのPR連携 + リネーム

### 辞書の DB 永続化(internal-app)
- これまでメモリ配列だった補正辞書(from→to)と固有名詞を、Prisma モデル `GlossaryReplacement` / `GlossaryTerm` で **DB 永続化**。再起動後も残る。
- `dictionary-store.ts`: メモリキャッシュを一次ソースにしつつ DB と同期する設計。DB があれば読み書き、無ければ(検証・オフライン)メモリのみで動作。起動時 `loadFromDb` で DB から読み込み、空なら初期辞書を投入。DB エラー時はメモリ初期値で継続(可用性優先)。追加・削除は同期的にメモリ更新+背後で DB 書き込み(既存の同期 API を壊さない)。
- 管理画面(/admin/glossary)に「永続化: 有効/無効」バッジと固有名詞の削除ボタンを追加。glossary route が `persistent` 状態を返し、term 削除にも対応。
- 15 項目スモーク(メモリ動作・DB 永続化・空 DB へのシード投入・DB エラー時のフォールバック)。

### CI 失敗ログの PR 連携(ci.yml)
- CI が失敗したとき、`ci-log-summary` ジョブが失敗した実行のログを `gh api` で取得し、`tools/ci-log-report.mjs` で要約して PR にコメント(既存コメントがあれば更新)。`if: failure() && pull_request` で PR 時のみ起動。
- 失敗ステップ名・エラー行(TypeScript エラー含む)・警告数・遅いステップを PR 上で確認でき、Actions のログを開かずに原因を掴める。

### リネーム + 機能カタログの配置変更
- リポジトリ名を `platform-monorepo` → `platform` に統一(package.json / devcontainer / MCP 設定例 / SETUP.md)。
- 機能カタログ `PLATFORM_SERVICES.md` を `docs/platform/` から **リポジトリ直下**(apps/packages と同階層)へ移動。参照(docs/ai/architecture.md)も更新。

---

## デザインテーマ機構 + 辞書CSV入出力 + 辞書変更履歴 + pgvector移行ガイド

### @platform/theme（デザインテーマ / スキン機構）
- WordPress のテーマのように、色・フォント・角丸・余白・影を 1 セットにした「スキン」を切り替えられる。明暗（light/dark）とは直交し、後から `registry.register()` で追加できる拡張性を持つ（React 非依存の純ロジック）。
- トークン（`ThemeTokens` 11 色 + `ThemeShape` フォント/角丸/余白/影）を CSS 変数（`--color-primary` 等）に展開。`data-skin` / `data-theme` 属性で切り替える。全スキン×2モードを 1 枚の `<style>` に入れれば属性だけで即切り替え（`buildThemeStylesheet`）。
- 標準スキン 4 種: スタンダード（青）/ コーポレート（紺・角丸控えめ）/ やわらか（暖色・丸め）/ ハイコントラスト（白黒・視認性）。
- レジストリ（`createThemeRegistry`）で登録・取得・既定設定・フォールバック。不正 id は VALIDATION、未登録の setDefault は NOT_FOUND。
- React 連携（`@platform/ui`）: `SkinProvider`（選択を localStorage 永続化・`<html>` に適用・既存 ThemeProvider の明暗と協調）+ `SkinSelector`（グリッド/ドロップダウン・スウォッチプレビュー）。
- デモ画面 `/admin/themes`（テーマギャラリー）: スキン切り替え + light/dark プレビュー。
- スモーク: theme 本体（CSS 変数・スタイルシート・レジストリ・拡張性・applySkin）。パッケージ 103 化に伴い advisor/depgraph/loadPackages を 102→103 に更新、UI・表現カテゴリに theme 追加。

### 辞書の CSV 入出力（バックアップ・一括登録）
- `@platform/csv` を活用し、補正ルール（from,to）と固有名詞（term）を CSV で書き出し・取り込み。Excel で編集可能（BOM 付き）。空 from・重複はスキップし、取り込み件数を返す。API `/api/rag/glossary/csv`（GET=ダウンロード / POST=取り込み）。管理画面にボタン追加。
- CSV 往復（export→import）で件数不変（全て上書き）を検証済み。

### 辞書の変更履歴（監査）
- 辞書ストアに `onChange` フックを追加し、追加・更新・削除を履歴として記録（kind / action / key / value / at / actor）。API 側でログインユーザーを actor に設定。管理画面に「変更履歴」表示（誰がいつ何を変えたか）。

### RAG 本番移行ガイド（docs/ops/RAG_PGVECTOR_MIGRATION.md）
- 開発の「メモリ + ハッシュ Embedder」から本番の「pgvector + OpenAI Embedder」への移行手順。pgvector テーブル定義（次元は Embedder に合わせる）、`createPgVectorIndex(db)` への差し替え、re-ingest、権限継承が保たれること、ハイブリッド検索（BM25 併用）まで。ガイド内のコード例は実 API（createPgVectorIndex の upsert/query・score=1-distance）と整合を検証済み。

---

## スキン拡充(11種)+ a11y検査 + テーマDB永続化/全体適用 + リファレンスサイト生成

### スキン拡充（4→11種）
- 追加: かわいい（パステルピンク・丸め）/ 暖色（オレンジ）/ シック（ワイン・セリフ）/ モダン（青紫・シャープ）/ レトロ（黄土・ティール・等幅）/ モノトーン（無彩色）/ クール（アイスブルー）。標準4種と合わせて11スキン。
- スキンの作り方を `packages/theme/README.md` に詳述（トークンの役割・登録手順・a11y確認・命名のコツ）。季節/イベント限定テーマも同じ仕組みで追加・削除できる。

### テーマのアクセシビリティ検査（WCAG コントラスト）
- `@platform/color` の contrastRatio / wcagLevel を使い、各スキンの主要色ペア（本文/背景・補助/背景・主ボタン文字/主色）が AA を満たすか検査。`checkTheme` / `findContrastIssues`。
- 全11スキンで**主ボタンと本文は AA 達成**するよう色調整（主色を darken、または cute は primaryFg を濃色化してパステルを維持）。補助テキスト(muted)はデザイン優先で警告のみ。smoke で「壊れたスキン」を検出。

### テーマの DB 永続化（組織デフォルト）+ アプリ全体適用
- 組織デフォルトのスキン+モードを SystemSetting テーブルに保存（`theme-setting.ts`）。管理者がテーマギャラリーで「組織デフォルトに設定」でき、個人未設定の利用者に適用。個人の localStorage 選択が優先。API `/api/admin/theme`。
- `AppThemeProvider` を layout に組み込み、**internal-app 全体をスキン対応**に。全スキン×2モードの CSS を一度だけ `<style>` 注入し、属性切り替えで即反映。system モードは prefers-color-scheme に追従。
- 未知スキンは既定にフォールバック（安全）。DB 未接続でも既定で動作。

### リファレンスサイト生成（gen-ref-site）
- `node tools/gen-ref-site.mjs`（`pnpm gen:site`）で、人間が読む**自己完結 HTML リファレンス**を生成。外部依存なし・オフライン閲覧可。
- 基盤 `docs/site/index.html`: 103パッケージ + 465公開API を検索で絞り込み + 依存グラフ（Mermaid）。
- アプリ `docs/site/app-<name>.html`: 各アプリの画面・API 一覧（5アプリ分）。
- 既存の生成物（api-reference.json / depgraph / appmap）を統合。XSS エスケープ済み。基盤・アプリを別ページで出力。

---

## リファレンスサイト拡充 + テーマ展開 + ライブプレビュー + pnpm 便利コマンド

### リファレンスサイトに ER 図・ADR を統合（gen-ref-site）
- `docs/site/index.html` にタブを追加: 「基盤パッケージ」と「設計（依存/ER/ADR）」。設計タブに依存グラフ + アプリ別 ER 図（Mermaid）+ ADR 一覧（タイトル・状態バッジ・要約・検索可）を統合。1 枚で設計全体を追える。XSS エスケープ済み。

### テーマのアプリ展開（crud-template = 新規アプリの雛形）
- `crud-template` に `AppThemeProvider` を組み込み、layout を CSS 変数ベースに更新。**このテンプレートをコピーして作る新規アプリは最初からスキン切り替え対応**になる。internal-app に続き 2 アプリ目の全体適用。組織デフォルト DB 連携は internal-app を参照する構成（テンプレートは軽量）。

### テーマのライブプレビュー強化
- テーマギャラリー（/admin/themes）のプレビューを、実際のアプリ画面（ナビバー・申請フォーム・状態バッジ付きテーブル）のミニチュアに刷新。スキンを切り替えると、業務画面がどう見えるかを light/dark 両方でその場で確認できる。

### pnpm 便利コマンド（12 種追加）
- `gen:all`（全生成物を 2 パス再生成し drift ゼロ確認）/ `doctor`（環境診断: Node/pnpm/Docker/.env/生成物を読み取りチェック）/ `clean`・`clean:build`・`fresh`（掃除・再構築）/ `check`（型+lint+smoke 一括）/ `outdated`・`deps:why`（依存確認）/ `test:pkg`（特定パッケージのテスト）/ `db:reset`/ `site`（サイト生成+案内）。
- コマンド早見表を `docs/ops/COMMANDS.md` に整備（セットアップ・開発・検証・生成・DB のカテゴリ別）。
- 新ツール: `tools/gen-all.mjs`（一括生成）・`tools/doctor.mjs`（環境診断）。

---

## doctor の CI 統合 + 全5アプリのテーマ展開 + リファレンスサイトの Pages 公開

### 環境診断(doctor)の CI 統合
- ci.yml の boundaries ジョブ冒頭で `node tools/doctor.mjs` を実行。Node バージョン等の必須項目が満たされているかを CI でも確認(必須 NG なら失敗、警告は情報表示)。

### 全5アプリへのテーマ展開 + AppSkin の基盤化
- これまで internal-app / crud-template が個別に持っていたテーマ適用ラッパーを、`@platform/ui` の **AppSkin** として基盤に引き上げ。各アプリは `<AppSkin registry={themeRegistry}>` で囲むだけ。
- equipment-app / public-site / platform-portal にも適用し、**全5アプリがスキン切り替え対応**に。各アプリに theme-registry(独自スキンの追加点)を用意。CSS 変数ベースの layout に更新。
- AppSkin は全スキン×2モードの CSS を一度だけ注入(useMemo)し、prefers-color-scheme に追従。

### リファレンスサイトの GitHub Pages 公開(pages.yml)
- main への push 時に、生成物を最新化 → `gen-ref-site` で HTML 生成 → GitHub Pages へ自動デプロイするワークフロー。`upload-pages-artifact` / `deploy-pages` を使用、`pages: write` + `id-token: write` 権限、concurrency で古いデプロイをキャンセル。
- これにより、常に最新の仕様(パッケージ・API・ER図・ADR・各アプリの画面/API)がチーム全員に URL で共有される。`.nojekyll` で Jekyll 処理を無効化。

---

## 基盤点検 + AppSkin完全統一 + SSRちらつき防止 + リファレンス横断検索

### 基盤全体の点検(docs/ops/AUDIT_REVIEW.md)
- advisor / check-deps / platform-report で健全性を点検。**循環依存なし・層破りなし・README 100%・TODO 0件**で総合的に健全。
- 見つかった負債: `diffChanges`/`FieldChange` が audit と db で同名重複。調査の結果、戻り値の形が違う(audit=配列 / db=マップ)意図的な使い分けと判明。**対応**: audit 側にも `ignore`/`redact` オプションを追加して機能を揃え、README で使い分けを明記(層違反を避け統合はせず)。
- 継続監視: テスト未保有14パッケージ(smoke で検証済み)、同名 export 76組(大半は自然な同名)、internal-app の route 集中。点検の回し方も文書化。

### AppSkin への完全統一(重複コード排除)
- internal-app / crud-template が個別に持っていた AppThemeProvider を削除し、基盤の `@platform/ui` AppSkin に一本化。全5アプリが同じ AppSkin を使う。組織デフォルト連携(defaultSkinId/defaultMode)も AppSkin が受け取る。

### SSR ちらつき防止
- AppSkin に、React マウント前に localStorage のスキンと prefers-color-scheme を読んで `data-skin`/`data-theme` を html 要素へ先に適用する inline script を追加。リロード時に一瞬デフォルトテーマが見える問題を解消。

### リファレンスサイトの横断検索
- 基盤 index.html に「横断検索」タブを追加。パッケージ + 全アプリの画面/API(404項目)を 1 つの検索窓で横断検索し、ヒットからアプリページへ遷移できる。従来のパッケージ内検索に加え、基盤とアプリをまたいだ発見が可能に。

---

## apps/demos のブラッシュアップ(最新のテーマ機構を全面活用)

### ThemeSwitcher(コンパクトなテーマ切替UI)を基盤に追加
- `@platform/ui` に ThemeSwitcher を追加。ヘッダー・ナビに置けるドロップダウン型のテーマ切替(SkinSelector の dropdown を小型化)。AppSkin の内側で使う。

### 4アプリにテーマ切替UIを展開
- **platform-portal**: 基盤カタログの色 26 箇所を CSS 変数化(テーマ追従)し、ヘッダーに SkinSelector(dropdown)を追加。基盤ポータル自身がテーマ機構のショーケースに。
- **crud-template**(新規アプリ雛形): ヘッダーに ThemeSwitcher。これをコピーする新規アプリは最初からテーマ切替付き。
- **equipment-app**: ヘッダーを追加し ThemeSwitcher を配置。
- internal-app(テーマギャラリー)と合わせて 4 アプリでユーザーがテーマ切替可能に。public-site は訪問者向け公開サイトのため切替 UI は付けない判断。

### showcase デモにテーマ機構のデモを追加
- showcase の layout を AppSkin 対応にし、全デモページがスキン切り替えに追従。ヘッダーに ThemeSwitcher。
- 新ページ `/theme`: 11 スキンの一覧(SkinSelector grid)、選択スキンの全トークン(light/dark の色・角丸・フォント)、WCAG コントラスト検査結果(checkTheme)を表示。最新のテーマ機構を動く形で見せる。

---

## カスタムテーマ作成 + internal-app 色変数化 + showcase テーマ導線

### deriveTheme(ブランド色からスキンを自動生成)
- `@platform/theme` に deriveTheme を追加。主色・アクセント・ベース系統(light/warm/cool)・角丸など数点から、light/dark 両モードの完全なスキンを自動生成。`primaryFg` は読みやすい黒/白を自動選択、状態色は視認性の良い固定色。生成テーマは主ボタン・本文が AA 達成することを検証済み。

### カスタムテーマ作成 UI(テーマギャラリー)
- /admin/themes に「自社ブランドテーマを作る」セクションを追加。色ピッカーで主色・アクセントを選び、ベース系統・角丸を調整すると、deriveTheme でリアルタイムにミニプレビュー。「作成して適用」で registry.register され、即座に一覧へ追加+適用。コントラストが低い場合は警告表示。ブラウザ上で自社ブランドテーマを作れる。

### internal-app 主要管理画面の色を変数化
- db-viewer / glossary / rag / ai / rpa / learning の 96 箇所の色を CSS 変数化(フォールバック付き)。テーマ切り替えに追従するように。

### showcase にテーマデモ導線
- showcase トップのデモ一覧に `/theme`(テーマ機構デモ)を追加。11スキン切替・全トークン・WCAG検査を体験できる導線を整備。

---

## カスタムテーマの DB 永続化 + JSON 入出力 + 全画面の色変数化

### テーマの検証・シリアライズ(@platform/theme serialize)
- `validateTheme`(問題の一覧を返す・例外なし)/ `parseTheme`(不正は VALIDATION)/ `themeToJson` / `themesToJson` / `themesFromJson`(束・単体・素の配列に対応)を追加。id 形式・name・shape の範囲(radius/spacing 0〜100、elevation 0〜3)・全 11 トークンが色として妥当か(hex/rgb()/hsl()/キーワード)を検査。外部入力(DB・ファイル・API)をそのまま信用しないゲート。

### カスタムテーマの DB 永続化(組織で共有)
- `theme-setting.ts` に getCustomThemes / saveCustomTheme / deleteCustomTheme を追加。SystemSetting に保存し、組織全体で共有・再訪時も残る。同 id は上書き、標準スキンと同じ id は拒否、不正形式は VALIDATION、壊れたレコードは表示時に自動除外。カスタムテーマも組織デフォルトに設定でき、削除時にデフォルトだった場合は既定へ自動で戻す。
- API `/api/admin/theme/custom`(GET 一覧 / GET ?export=1 で JSON ダウンロード / POST 単体保存 / POST json でまとめて取り込み / DELETE)。

### テーマの JSON エクスポート/インポート
- テーマギャラリーに「保存済みのカスタムテーマ」セクションを追加。一覧(色スウォッチ付き)・削除・**JSON で書き出し**・**JSON を取り込み**。他環境へテーマを持ち運べる(辞書 CSV と同じ発想)。取り込み時は不正なテーマをスキップし、件数と理由を表示。
- 作成 UI は DB 保存に変更(「保存して適用」)。ページ表示時にサーバから保存済みカスタムテーマを読み、レジストリへ反映。

### internal-app 全画面の色変数化
- 残りの画面(dashboard/trend/rpa-demo/ai-image/transcript 等)13 ファイル・59 箇所を追加で CSS 変数化。**合計 297 箇所**が変数化され、全画面がテーマ切り替えに追従。

---

## 環境変数の拡充 + カスタムテーマ全画面展開 + テーマ変更履歴 + リファレンスにテーマ解説

### @platform/env の拡充(設定周りの底上げ)
- **`requireEnv` / `optionalEnv`**: `process.env` 直読みを禁じる読み取り口。必須値が欠けていれば CONFIG エラー(名前を列挙)。
- **`describeEnv`**: zod スキーマから変数名・必須・型(URL/メール/列挙値)・既定値・説明・秘密判定の一覧を生成。
- **`renderEnvExample`**: スキーマから .env.example の中身を生成(必須/任意でセクション分け・説明コメント付き・秘密値は空)。
- **`maskSecrets` / `isSecretName`**: ログ出力時に秘密値(KEY/SECRET/TOKEN/PASSWORD 等)を `***` に。
- **internal-app の serverEnv を検証付きに改修**: これまで `process.env.X ?? ""` で直読みしていた秘密値を、**本番では requireEnv で fail-fast(欠けたら起動失敗)・開発では既定値で継続**する方式に。SESSION_SECRET 未設定のまま本番起動する事故を防ぐ。env.ts の各変数に `.describe()` で説明を付与。

### カスタムテーマの全画面展開(AppSkin の extraThemes)
- `AppSkin` に `extraThemes` prop を追加。サーバで DB から読んだ組織のカスタムテーマをレジストリへ登録してから CSS を生成する(不正なテーマは無視して他を活かす)。
- internal-app の layout が組織デフォルト + カスタムテーマを並列取得し、**全画面でカスタムテーマが使える**ように。

### テーマの変更履歴(バージョン管理)
- SystemSetting に履歴を保存(上限 200 件)。`default-changed` / `custom-saved`(作成・更新を区別) / `custom-deleted` を、いつ・誰が・どのスキンに対して行ったか記録。API `/api/admin/theme?history=1`、テーマギャラリーに「変更履歴」表示。履歴保存に失敗しても本処理は止めない設計。

### リファレンスサイトにテーマ機構の解説
- 「テーマ（11スキン）」タブを追加。各スキンの色スウォッチ・名前・説明・角丸・フォントを一覧(themes.ts からソース解析で抽出)。**非エンジニアでも「どんな見た目が選べるか」が分かる**。開発者向けに `deriveTheme` での追加方法もコード例付きで掲載。

---

## 全アプリの env 統一 + 設定の残骸検出 + 設定確認画面 + アプリ紹介

### 全アプリで process.env 直読みを解消
- **点検で発見**: equipment-app が `ADMIN_PASSWORD ?? "admin1234"` で直読みしており、**既定パスワードのまま本番起動できる**危険な状態だった。public-site も 4 箇所、internal-app も 27 箇所が直読み。
- **対応**: 全 5 アプリを `@platform/env` の口(`requireEnv` / `optionalEnv`)経由に統一。
  - equipment-app: 本番は SESSION_SECRET/ADMIN_PASSWORD 必須(未設定なら起動失敗)、開発は既定値で継続。
  - public-site: `siteEnv` を新設(PREVIEW_TOKEN / INTERNAL_API_BASE / INTERNAL_INQUIRY_URL / INQUIRY_INTAKE_TOKEN)。
  - internal-app: `featureEnv` に機能設定を集約(AI キー・CRON_TOKEN・MAINTENANCE_*・SENTRY_DSN・PUBLIC_* 等)+ `useChatPrisma`。
  - 残る直読みは Next.js の `NEXT_RUNTIME` のみ(フレームワーク由来のため妥当)。

### check-env-example の強化(残骸検出 + 新しい読み取り口の検出)
- **逆方向の検査を追加**: `.env.example` にあるがコードで参照されていない変数(設定の残骸)を警告。
- **検出パターンを更新**: `optionalEnv("X")` / `requireEnv(["X"])` / `featureEnv.X` / `siteEnv.X` / zod スキーマのキーを検出するように(env 集約で従来パターンが効かなくなったのを修正)。結果、参照数と記載数が完全一致(internal 32/32・public-site 4/4・crud 2/2・equipment 4/4)・残骸ゼロを確認。

### 設定の確認画面(/admin/env)
- 起動時に読み込まれた環境変数の状態を、区分(基本/秘密/機能)ごとに一覧。**秘密値は `maskSecrets` でサーバ側から `***` にして返す**(値そのものは画面に来ない)が、設定済み/未設定は分かる。障害調査で「今どの設定で動いているか」を確認できる。DB のシステム設定(/api/admin/settings)とは別物として `/api/admin/env` に分離。

### アプリ・デモの紹介(docs/APPS_AND_DEMOS.md)
- 5 アプリ(規模・できること・起動コマンド・特徴)と 25 デモ(カテゴリ別)の紹介を整備。「新しいアプリを作る→crud-template」「基盤を探す→platform-portal」など使い分けの指針も記載。**数値(画面 73/API 206/モデル 62・デモ 25・パッケージ 103)は smoke で実態と一致を検証**しドリフトを防ぐ。README から導線。

---

## AI開発アシスト(基盤カタログMCP・資料の鮮度) + 秘密値の強度チェック + 設定表示の基盤化

### 【AI開発アシスト】基盤カタログ MCP サーバ
- **目的**: 103 パッケージ・3,000+ API があると、人も AI も「既にあるか」を把握しきれず**車輪の再発明**が起きる。AI が実装前に自分で基盤を検索できるようにする。
- `pnpm mcp:catalog` で起動。Claude Code / Claude Desktop から 3 ツールを提供(読み取り専用)。
  - `search_platform(query)`: キーワードで基盤機能を検索(日本語可。「csv 出力」「メール送信」等)。パッケージ名完全一致 > API 名 > 説明 の順でスコアリング。
  - `describe_package(name)`: README 全文 + 公開 API 一覧。
  - `list_platform()`: カテゴリ別の全体像。
- データ源は生成物(**api-surface.json で全 export を網羅 + api-reference.json で説明を補完**。api-reference だけだと theme 等が 0 件になる穴があったため併用)。接続手順は `docs/ai/mcp-catalog.md`、CLAUDE.md からも案内。

### 【AI開発アシスト】手書き資料の数値ドリフト検出(check-doc-numbers)
- **点検で発見**: CLAUDE.md と architecture.md が「96 パッケージ」と古い数値のままだった(実際は 103)。**AI はこれを読んで前提にするため、古い数値は誤った判断を生む**。
- 修正した上で、`tools/check-doc-numbers.mjs` を新設し preflight に組込。手書き資料の数値が実態とズレたら CI で検出する。

### 秘密値の強度チェック(@platform/env)
- `checkSecretStrength` / `assertSecretStrength` を追加。**開発既定値のまま本番公開**(`change-me` / `dev-` 始まり / `admin1234` 等)、12 文字未満を error、12〜15 文字・文字種単調を warn として検出。本番は error で起動失敗、開発は警告のみ。
- internal-app / equipment-app の env.ts に組込。「既定パスワードのまま本番公開」を仕組みで防ぐ。

### 設定表示の基盤化(EnvSettingsTable)
- 設定確認画面の表示部分を `@platform/ui` の `EnvSettingsTable` として基盤へ。区分ごとの表・秘密値の鍵アイコン・設定済み/未設定バッジ。**どのアプリでも同じ画面を作れる**(データは props で受け取り、マスクはサーバ側の責務)。internal-app の画面をこれを使う形にリファクタ。

---

## 【重要な不具合修正】開発ポートの競合 + MCP拡充(デモ検索・設計ルール) + patterns 拡充

### 開発ポートの競合を修正(pnpm dev が壊れていた)
- **発見した不具合**: internal-app と public-site が両方 `next dev`(ポート指定なし)で、**`pnpm dev`(turbo run dev = 一斉起動)すると両方が既定の 3000 を取りに行き衝突**していた。public-site は `dev:site` で `-p 3004` を渡していたため個別起動では気づけない、静かな不具合だった。ドキュメントは 3004 と記載していたのに実際は効いていない状態。
- **修正**: 全 6 アプリの package.json に `--port` を明記(3000 internal / 3001 showcase / 3002 crud / 3003 equipment / 3004 public-site / 3005 portal)。`dev:site` から冗長な `-p` を除去。
- **再発防止**: `tools/check-ports.mjs` を新設し preflight に組込。**ポート重複・--port 記載漏れ・ドキュメント不一致**の 3 種を検出。ポート一覧を APPS_AND_DEMOS.md / COMMANDS.md に明記。

### 基盤カタログ MCP の拡充(5ツールに)
- **`find_examples(query)`**: 使用例(demos/)を検索。パッケージ名でも「請求書」「承認フロー」等のやりたいことでも引ける。各デモの**使用パッケージをソースの import から自動抽出**して返すため、「どう組み合わせるか」がすぐ分かる。
- **`explain_rules(topic?)`**: 設計ルール(CLAUDE.md + architecture.md + 検査コマンド)を返す。説明に「コードを書く前に必ず呼ぶこと」と明記し、AI が層のルールを踏み外さないようにする。
- 推奨の流れ: explain_rules(ルール確認) → search_platform(部品を探す) → find_examples(実例) → 実装。

### patterns.md の拡充(定型コード 8→11)
- **9. 環境変数の読み取り**: `server/env.ts` への集約・parseEnv/requireEnv/optionalEnv の使い分け・本番の強度チェック。
- **10. アプリにテーマを入れる**: theme-registry + AppSkin + ThemeSwitcher の最小コード。色は CSS 変数で書くこと、deriveTheme での独自スキン生成。
- **11. 開発ポートの割り当て**: `pnpm dev` は一斉起動なので `--port` 必須、check-ports での確認。

---

## 基盤のバージョン管理方針 + 基盤同期コマンド + turbo点検(規約違反14件を修正)

### バージョン管理の方針を明文化(ADR 0011)
- **現状**: 103 パッケージすべて `0.1.0` / `private: true`。アプリは `workspace:*` でローカルの packages/ を直接参照するため、**基盤を編集した瞬間からアプリは新しいコードを使う**(install も再ビルドも不要)。
- **決定**: セマンティックバージョニングを**適用しない**。単一リポジトリ・単一デプロイ単位で、常に全員が同じ基盤を使うため、バージョン番号は意味を持たない。代わりにバージョンの役割を機械的な仕組みで代替する。
  - 破壊的変更の通知 → `api-surface.mjs`(スナップショット比較・CI で検出)
  - 影響範囲の把握 → `pnpm platform:check`
  - 変更履歴 → Git + PLATFORM_SERVICES.md
- 将来この決定を見直す条件(別リポジトリから使う・アプリごとに版を分ける・社外提供)も記録。

### 基盤同期コマンド(pnpm platform:check / platform:sync)
- **`pnpm platform:check`**: 基盤を変更した後、アプリ開発に戻る前に実行。削除/改名された API を検出し、**それをどのアプリ・デモが使っているか(ファイル名)まで表示**する。「消していいのか」が判断できる。
- **`pnpm platform:sync`**: 生成物と API スナップショットを更新。その後 `pnpm typecheck` で影響を確認する流れ。
- 破壊的変更の検出は既存の `api-surface.mjs` に一本化(自前実装すると `export * from` の再帰解決を取りこぼし誤検出する。実際に一度作り直した)。

### 【重大】turbo 点検でパッケージ構成の規約違反 14 件を発見・修正
- **発見**: `packages/theme` など **14 パッケージに build/typecheck/lint スクリプトが無く**、うち 3 つ(elearning / os-notify / rpa)は **tsconfig.json すら無かった**。scaffold を使わず手作りしたパッケージが規約から外れていた。
- **影響**: `pnpm typecheck` や `pnpm lint` を実行しても、これらのパッケージは**静かに素通り**していた(エラーも出ないため気づけない)。
- **対応**: 全 14 パッケージに標準の scripts / tsconfig を追加。テストファイルがあるものだけ `test` を付与。
- **再発防止**: `tools/check-package-shape.mjs` を新設し preflight に組込。src があるのに tsconfig が無い・scripts が欠けている・README が無い、を検出する。設定専用の `config` は理由付きで対象外に登録。

### 新規アプリ追加の手順書(docs/ops/NEW_APP.md)
- ポート採番(check-ports で空き確認)→ crud-template のコピー → package.json/env の修正 → ルート登録 → ドキュメント更新 → 検証、の流れをチェックリスト化。「そもそも新しいアプリが必要か」の判断基準と、よくある失敗(--port 忘れ・tsconfig 無し・色のハードコード)も記載。

### demos の実態を README に反映(誤解を招く記述を修正)
- **発見**: demos/README.md は「デモは `pnpm dev` だけで動く」と書いていたが、**実際は 25 個中 24 個が dev スクリプトを持たず起動しない**(コンポーネント集)。
- **対応**: 「アプリ型(showcase のみ・:3001)」と「コンポーネント型(24・ソースを読む)」の 2 種類を明記。コンポーネント型が起動しないのは意図的(デモごとにアプリを立てると起動ポートも保守も増える)と理由も記載。数値は `check-doc-numbers` が実態と照合する。

---

## 初心者向け導入ガイド + eslint/vitest 設定の点検(25件修正) + CI 確認

### 【新規】ゼロからの導入ガイド(docs/ops/GETTING_STARTED.md ＋ _2.md)
- **何も入っていない PC**(Git も Docker も無い)から、開発・テスト・デバッグ・公開までを一本で辿れるガイド。Windows / Mac 両対応。
- **前編**: ツール導入(winget / Homebrew でまとめて入れる手順、手動導入の代替も)→ clone → セットアップ 1 コマンド → 起動して触る。Docker が使えない場合の代替も記載。
- **後編**: 基盤とアプリの分離という考え方 → 開発の始め方 3 パターン → テスト/デバッグ(開発者ツール・`/admin/env` での設定確認・db-viewer・Mailpit・VS Code デバッグ) → 公開(本番の秘密値の作り方を Windows/Mac 両方・弱い値だと起動しない理由) → 困ったときの対処表。
- **補足**: 「なぜ基盤とアプリを分けるのか」「なぜ検査ツールが多いのか」「なぜドキュメントが自動生成なのか」の 3 点を初心者向けに説明。
- **鮮度の担保**: smoke で「案内する 13 の pnpm コマンドが実在」「内部リンク 10 本が有効」「全 6 アプリの URL 掲載」「Windows/Mac 両方の記載」「5 工程の網羅」を検証。存在しないコマンドを教えて詰ませる事故を防ぐ。
- README / SETUP.md から導線。SETUP.md は「ツールは入っている前提の要点整理」として棲み分け。

### 【重大】vitest 設定の欠落 25 件を発見・修正
- **発見**: `test` スクリプトを持つのに `vitest.config.ts` が無いパッケージが **25 件**。共通プリセット(`@platform/config` のカバレッジ閾値 80%)が効いておらず、品質基準がバラついていた。
- **さらに**: **テストファイルが無いのに `test: "vitest run"`** のパッケージが 9 件(ai/analytics/cms/html/loadtest/mcp/rag/saga/depreciation)。vitest は「テストが見つからない」で **exit 1** するため、`pnpm test` が失敗する状態だった。
- **対応**: テストがある 16 件に `vitest.config.ts`(basePreset 参照)+ devDeps を追加。テストが無い 9 件は `--passWithNoTests` を付与(ロジックは smoke.mjs で検証済み。将来 .test.ts を足せば自動で走る)。
- **再発防止**: `check-package-shape.mjs` に「テストがあるのに vitest.config.ts が無い」「テストが無いのに vitest run」の 2 検査を追加。

### eslint 設定の点検(問題なし)
- ルートの `eslint.config.mjs` で一元管理し、パッケージ側に個別設定を置かない設計。`packages/*` / `apps/*` を対象に含んでおり、素通りは無い。`vitest.workspace.ts` も `packages/* apps/* demos/*` を網羅。設計として正しく、修正不要と判断。

### CI 確認(問題なし)
- 今回追加した検査(`check-ports` / `check-package-shape` / `check-doc-numbers`)は **preflight 経由で CI に自動的に含まれる**構成。ci.yml の boundaries ジョブが `doctor` → `preflight` → `check-generated` を実行するため、個別追加は不要。preflight の項目は 12 個(smoke / check-deps / api-surface / check-schema×3 / check-env-example / check-doc-numbers / check-ports / check-package-shape / advisor / setup.sh 構文)。

---

## Git/GitHub ガイド + ドキュメント参照の機械検証 + トラブル対処の拡充

### 【新規】Git と GitHub の使い方(docs/ops/GIT_GUIDE.md)
- **Git を触ったことがない人**向け。「なぜ必要か」(バージョン名地獄の図解)から始め、最低限の 5 用語(リポジトリ/コミット/ブランチ/プッシュ/PR)、このリポジトリの進め方(main 保護 → ブランチ → PR → CI → レビュー → マージ)を図で説明。
- **ツール比較**: VS Code の Git 機能(推奨)/ GitHub Desktop / SourceTree / コマンドライン。費用・向いている人・対応 OS の表。
- **GUI とコマンド両方の手順**: VS Code での操作(ブランチ作成・コミット・プッシュ・PR)と、コマンドの日常 6 コマンド + `gh pr create`。最後に対応表で紐付け。
- **このリポジトリ特有の注意**: 生成物を同じ PR に含める(`platform:sync`)、アプリと基盤を混ぜない、`.env` をコミットしない。
- **困りごと対処表**: コミット取り消し・メッセージ訂正・コンフリクト・push 拒否・main に直接コミットしてしまった、など。「分からなくなったら作業をコピーしてから操作する」という鉄則も。

### CONTRIBUTING.md の矛盾を解消
- **発見**: 「基盤を変更したら `pnpm changeset` で記録する」と書かれていたが、**ADR 0011 でバージョン管理しない方針に決めた**ため矛盾していた。
- **対応**: `platform:check` / `platform:sync` に置き換え。ADR 0011 へのリンクで理由を明示。scaffold を使う理由(手作りで 14 件の規約違反が発生した実績)、PR 前の `pnpm check` も追記。GIT_GUIDE への導線を追加。

### 【新規】ドキュメント参照の機械検証(check-docs-links)
- 手書き資料 13 ファイルを対象に、**①案内する pnpm コマンドが実在するか ②Markdown の内部リンクが有効か ③参照するファイルパスが実在するか**を検査。preflight に組込。
- **初心者向けガイドで最も困るのは「書いてあるとおりにやったのに動かない」こと**。原因の多くは単純なズレ(コマンド名変更・ファイル移動)で人のレビューでは見落とすため、機械で検出する。
- 実際に **PLATFORM_SERVICES.md のパス誤り(public-site の preview.ts で `src` が抜けていた)を発見・修正**。例示(`my-app`)や MCP のメソッド名(`tools/list`)は誤検出しないよう除外。

### トラブル対処の拡充(実際に起きた問題を反映)
- セットアップ編に 4 件追加: Node が v22 未満、Mac で `brew: command not found`(PATH 設定忘れ)、Windows の改行コード警告(`core.autocrlf`)、会社プロキシでの `pnpm install` 失敗。
- 開発編に 4 件追加: `pnpm dev` で一部だけ起動しない(ポート競合 → `check-ports`)、新パッケージが型チェックされない(→ `check-package-shape`)、`pnpm test` がテスト無しで失敗(→ `--passWithNoTests`)、CI だけ失敗(生成物の更新漏れ)。**いずれも今回の点検で実際に発見した問題**。
- 「動くはずなのに動かない」ときの調査順序(doctor → ターミナル → Console → /admin/env → check → fresh)を追加。

### 視覚的な確認ポイントを図解(スクリーンショットの代替)
- 画像は用意できないため、**テキスト図とチェックポイント表**で代替。Docker Desktop の状態(Engine running / Starting / Stopped)の見分け方と `docker ps` での確認、セットアップ成功時の出力例、`pnpm doctor` の出力例を掲載。「どうなれば成功か」が判断できる。

---

## PR/Issue テンプレート + ドキュメント地図 + Git ガイド拡充 + Cursor ガイド

### PR / Issue テンプレート
- **PR テンプレート**(`.github/PULL_REQUEST_TEMPLATE.md`): 変更の種類・`pnpm check` 通過・**基盤変更時は `platform:check`/`platform:sync` を実施したか**・新規パッケージは scaffold を使ったか、をチェックリスト化。「1 PR = 1 目的」も明記。
- **Issue テンプレート**(`.github/ISSUE_TEMPLATE/`): バグ報告は **再現手順と `pnpm doctor` の出力を必須**に(環境起因が多いため)。機能要望は「何が欲しいか」より **「何に困っているか」を必須**に(より良い解決策が見つかるため)。空 Issue は禁止。

### ドキュメントの地図(docs/README.md)
- 50 以上ある資料から「**あなたが今読むべき 1〜2 個**」に辿り着く索引。目的別(はじめて触る/開発する/困った/運用・公開/判断の背景/AI で開発)に整理。
- **手書き / 自動生成の区別**を明示(自動生成物を手で編集すると `check-generated` が落ちる)。新しく入った人向けの「読む順番」も。

### Git ガイドの大幅拡充(GIT_GUIDE.md・558行)
- **ブランチ命名**: `feat/` `fix/` `docs/` `refactor/` `chore/` `test/` の使い分け、良い名前・悪い名前の対比表(日本語・大文字・人名を避ける理由)、いつ作りいつ消すか、マージ済みブランチの一括掃除。
- **競合(コンフリクト)の解決**: 「壊れていない、Git が判断を求めているだけ」から始め、`<<<<<<< HEAD` の読み方、VS Code のボタン(現在の変更/入力側の変更)の意味、手順、`git merge --abort`、競合を減らすコツ(こまめに pull・PR を小さく)。**迷ったら相手に聞く**のが最も安全と明記。
- **PR の使い方**: 小さく出す理由(大きい PR はレビューされない)、テンプレの埋め方、**自分で先に Files changed を見る**、出した後の流れ(CI → レビュー → Squash and merge → ブランチ削除)、指摘への心得。
- **Issue の使い方**: いつ書くか、良い例・悪い例の対比、`Closes #123` で自動クローズ。
- **用語集**: 基本 7 語 / PR まわり 6 語 / ちょっと難しい 7 語(ステージング・HEAD・origin・リベース・fetch・stash・cherry-pick)を**使う場面つき**で。stash は実例コード付き。
- GitHub の便利機能(`.` キーで VS Code、Blame、コード検索)も。

### Cursor での開発ガイド(CURSOR_GUIDE.md)
- **なぜこのリポジトリと相性が良いか**: CLAUDE.md / patterns.md / 基盤カタログ MCP / `pnpm check` という下地があるため。ただし**丸投げは事故る**と明記。
- **MCP 接続を強く推奨**: 繋ぐかどうかで生成コードの質が変わる(繋がないと存在しない関数を提案されやすい)。設定 JSON つき。
- **3 機能の使い分け**: Tab(補完・基盤を無視して似た関数を書き始める危険)/ Cmd+K(小さな編集)/ Chat(メイン)。
- **このリポジトリでの流れ**: 「まず `search_platform` で基盤を探して」と AI に指示する良い聞き方 vs 「CSV を出力する関数を書いて」という悪い聞き方の対比。`@ファイル` `@Codebase` `@Web` の使い方。
- **デバッグ**: エラー全文をそのまま貼る、**`any` を使わせない**(困ると AI は any で逃げる)、AI に頼る前に自分で原因を絞る。
- **テスト**: 参考ファイルを渡してから書かせる、**AI の「テストが通りました」を信じない**(実行していない/存在しない関数をでっち上げる/any で塞ぐ、の典型 3 パターンを明記)。`pnpm check` を自分で打つのが唯一の真実。
- **やってはいけないこと**: 読まずにコミット(ブラックボックス化の始まり)、`.env` を Chat に貼る(秘密が外部送信される)、`packages/` の大改造。Privacy Mode の案内も。
- **コミット前チェックリスト 8 項目**と、得意/苦手の切り分け(設計判断・業務ルールは人が決める)。

---

## 資料の役割分担 + オンボーディング Issue + ドキュメント重複の整理

### CLAUDE.md / CURSOR_GUIDE の役割分担を明確化
- **問題**: 両方が AI 向けで、どちらに何を書くか曖昧だった(Cursor も CLAUDE.md を自動で読むため、二重管理の危険)。
- **整理**: **CLAUDE.md = 「何を守るか」(規約。人も AI も共通)** / **CURSOR_GUIDE = 「道具の使い方」(Cursor 固有の操作)**。両ファイルの冒頭に位置づけと対応表を明記し、相互リンク。
- CLAUDE.md に **「AI が守ること」** を新設: 実装前に基盤を検索 / `pnpm check` を実際に実行してから報告 / `any`・`@ts-ignore` で型エラーを塞がない / 存在しない API を提案しない / 色をハードコードしない / `process.env` を直読みしない。**AI が起こしがちな失敗を先回りで禁じる**。

### オンボーディング Issue テンプレート
- 新メンバーが最初にやることを **6 段階・22 項目のチェックリスト**に(環境構築 → 動かす → 全体像 → Git → ツール → 最初の PR)。所要半日〜1日。
- **「詰まった箇所」の記録欄を必須級に**: 「あなたが詰まった場所は次の人も必ず詰まります」と明記し、**それをドキュメントに追記する PR を最初の練習お題として推奨**。オンボーディングが資料改善を生む循環にした。

### 【発見】SETUP.md のポート記述が古かった
- **問題**: ポート統一の修正(前セッション)が SETUP.md に反映されておらず、**`public-site: pnpm --filter public-site dev -- -p 3004(既定 3000 と衝突するため)` という既に解消済みの記述**が残り、platform-portal(3005)も欠落していた。
- **対応**: 実態に合わせて修正。さらに **check-ports の検査対象に SETUP.md のポート表を追加**し、記述のドリフトを機械検出できるように(エラーメッセージにどのファイルがズレているかも表示)。

### SETUP.md と GETTING_STARTED の重複整理
- **役割分担**: **GETTING_STARTED = 初心者向けの流れ**(ツール導入から順に) / **SETUP.md = 経験者向けリファレンス**(setup スクリプトの中身・Prisma の運用・devcontainer など手順の裏側)。SETUP.md 冒頭に対応表を置き、初心者は GETTING_STARTED へ誘導。
- **重複の解消**: 一般的なつまずき(Docker 未起動・pnpm バージョン等)は GETTING_STARTED_2 に集約し、SETUP.md には固有のもの(Prisma engines の DL 失敗・devcontainer の DB ホスト名・本番の秘密値強度)だけを残す。Windows の節も「ツールの入れ方は GETTING_STARTED、ここは setup.ps1 の仕様」と分離。「次に読むもの」も最新の資料(NEW_APP / patterns / docs 地図)に更新。

---

## テスト・デバッグの総合ガイド + 負荷テストの実用化 + 重複検出 + CODEOWNERS 点検

### 【新規】テストとデバッグ(docs/ops/TESTING_GUIDE.md)
- **6 種類のテストを速さ順に整理**: スモーク(10秒/DB不要) → 型チェック → Lint → ユニット → E2E(DB必要) → 負荷テスト。それぞれの「いつ使うか」「書き方」「落とし穴」。
- **負荷テストの読み方**: `req/s` / `err` / p50 / **p95(最重要)** / p99 の意味と、**「平均値を見ない」(外れ値に引きずられ実態を隠す)**、**「本番に撃たない」**、開発機では絶対値より変更前後の比較に使う、という実践的な注意。
- **デバッグの原因を探す順番**: doctor → ターミナル → Console → /admin/env → check → fresh。闇雲に直さない。
- **このリポジトリ固有のデバッグ機能**を一覧: `/admin/env`(設定確認・秘密はマスク) / `/admin/db-viewer` / Mailpit(:8025) / `/admin/audit` / platform-portal(:3005)。
- **症状別の対処表**(画面が真っ白・API が 500/403・データが出ない・メールが届かない 等)。
- **テストの心得**: 何を優先するか(金額計算・権限判定は高、見た目は低)、良いテスト・悪いテストの対比、**AI の「テストが通りました」を信じない**。

### 負荷テストの実用化
- `@platform/loadtest` と `tools/loadtest.mjs` は既にあったが **`pnpm loadtest` コマンドが無く、使い方も未文書化**だった。コマンドを追加し、TESTING_GUIDE に使い方・オプション・出力の読み方を記載。
- 実ロジックを検証(latencyStats の p50/p90/p95/p99・percentile の線形補間・runLoad の並列実行と失敗集計・weightedPick の重み比例・formatResult)。**検証時に自分の期待値が実装と違い(mean を avg と誤記)、コードが正しくテストが誤りだった**ため修正。

### 【新規】ドキュメント重複の機械検出(check-docs-duplication)
- 前回 SETUP.md の重複を**手作業で**見つけたため機械化。同一見出し・同一の表(3行以上)が複数ファイルにある状態を検出し、「片方だけ更新されて食い違う」事故を防ぐ。
- **重複が常に悪いわけではない**ため、警告のみで CI は落とさない設計。意図的な重複は `ALLOW` に**理由付きで**登録(README は導線のみ・SETUP は詳細、など)。
- 実際に **README のクイックスタートが古い記法(`pnpm --filter crud-template dev`)のまま**だったのを発見・修正。

### 【発見】CODEOWNERS がプレースホルダのままだった
- **問題**: `@platform-team` は実在しないチーム。**このままブランチ保護で「コードオーナーのレビュー必須」を有効にすると、誰も承認できず PR がマージ不能**になる。導入時の重大な落とし穴。
- **対応**: CODEOWNERS の冒頭に**置換必須の警告**を明記。保護対象も追加(turbo.json / .github/ / CONTRIBUTING.md)。
- **CI_FIRST_RUN に設定手順を追加**: 置換コマンド、ブランチ保護の設定表(Require approvals / Code Owners / status checks)、**1 人で運用する場合の注意**(自分の PR を自分で承認できず止まるため、Code Owners を無効にするか approvals を 0 に)。

### E2E は既に充実していた(調査結果)
- 提案していた E2E 拡充は**既に達成済み**だった: `e2e/`(home / crud-template / equipment-app / register / dashboard)+ `apps/internal-app/e2e/`(expense-flow: 取込→ダッシュボード→承認、smoke: 主要画面)の 7 ファイル。CI(e2e.yml)でも実行済み。TESTING_GUIDE に既存テストの一覧と `pnpm e2e:ui`(失敗箇所を画面で追える)の使い方を記載するに留めた。

---

## 負荷シナリオ(業務パターン) + 性能基準 ADR + E2E 品質検査 + DevTools ガイド

### 【新規】業務パターンの負荷シナリオ(demos/loadtest-scenarios)
- 「何 req/s 出るか」だけ測っても意味は薄い。**業務で実際に起きる形**で負荷をかけて初めて「朝の打刻に耐えられるか」が分かる。5 シナリオを用意。
  - **morning-rush**(朝 9:00 の一斉打刻・並列 200・ランプ無し): 書き込みが一点集中。**エラー率と p99** を見る(ロック競合で一部が極端に遅くなる)。
  - **expense-rush**(月初の経費ラッシュ・並列 50・ランプ 10秒): 読み書き混在。**一覧のステップ別 p95** を見る。
  - **normal-day**(日中の平常運転・並列 30・ランプ 30秒): **p95 が時間とともに悪化しないか**(リーク・接続枯渇)。
  - **monthly-closing**(月次決算・並列 2): 1 本が重い。**max** を見る(タイムアウトしないか)。
  - **health**: まず足場を確認。
- `buildHttpStep` は fetch を注入でき(テスト可能)、**例外も `ok:false` にして負荷テストを止めない**。`scenarioGuide` に推奨設定と見るべき指標、`formatSteps` でステップ別の表。

### 【新規】ADR 0012: パフォーマンスの目標値と測り方
- **p95 を基準**にする(平均は外れ値に引きずられ実態を隠す)。一覧 300ms / 書き込み 500ms / 検索 1000ms / 重い集計は max 30秒。**エラー率は 0% を絶対**(打刻が 1 件でも失敗すると勤怠が欠け、給与に直結する)。
- 300ms の根拠(人が「待った」と感じ始める境界)、月次決算を p95 で測らない理由(月 1 回で統計に意味がない)まで記録。
- **CI では性能を測らない**と明記。GitHub Actions のランナーは 2〜3 倍ぶれるため閾値を設けると**偽の失敗が頻発し、「CI が赤いのはいつものこと」になるのが最悪**。代わりにリリース前の手元測定 + 本番の継続監視。

### E2E の Flaky 検査(check-e2e-quality)+ 設定の是正
- **点検結果**: 固定待ち 0 件・CSS セレクタ 0 件・getByRole 多用と、既に良好だった。ただし **`apps/internal-app/playwright.config.ts` に `retries` が無く、CI の揺らぎで即赤になる**状態だったため、ルート設定と揃えた(retries 2 / trace on-first-retry / screenshot only-on-failure)。
- 再発防止に `check-e2e-quality.mjs` を新設し preflight に組込。**固定待ち(waitForTimeout)・CSS セレクタ・retries/trace 未設定**を検出。「Flaky なテストは『また落ちた、再実行しよう』を生み、やがて誰も CI を信じなくなる」と理由も明示。

### 【新規】Chrome DevTools ガイド(docs/ops/DEVTOOLS_GUIDE.md)
- **開き方**(Win/Mac)から、7 タブの使い分け、**症状から探す表**まで。
- **Console**: エラーの読み方(`Cannot read properties of undefined` → API 失敗を疑う 等)、その場で `await fetch(...)` して**API と画面のどちらが悪いか切り分ける**。
- **Network**: ステータス別の対処表(500 → **ターミナルにスタックトレース**、503 → `/admin/env` を見る 等)、Response をまず読む、**Slow 3G で遅い回線を再現**。
- **Elements**: このリポジトリの色は全て CSS 変数なので、`data-skin` と `--color-*` の確認方法。
- **Application**: `session` Cookie・`skin` localStorage の場所。Clear site data でリセット。
- **Sources**: ブレークポイント、条件付きブレークポイント、**console.log より速い理由**。
- **Performance**: 記録の見方、**CPU 4x slowdown で非力 PC を再現**。
- **Lighthouse**: テーマのコントラスト確認に使える(smoke の checkTheme と補完関係)。
- **React DevTools**: `SkinProvider` の状態を見てテーマ切替の不具合を追う。

---

## 運用ダッシュボード + 障害対応手順書 + デバッグ設定の点検

### 【新規】運用ダッシュボード(/admin/ops)— 障害時に最初に開く画面
- **問題**: 観測系の API(`/api/status` `/api/admin/health` `/api/metrics`)は充実していたが、**人が見る画面が無く**、障害対応中に何本も API を叩くのは非現実的だった。
- **対応**: 1 リクエストで全体像が分かる集約 API(`/api/admin/ops`)と画面を新設。
  - **総合判定**(✅正常 / ❌異常あり)を最上部に。10 秒ごとの自動更新。
  - **稼働状況**(DB・Zoho・Webhook・監査ログの整合性)。異常時は **「次に何をするか」を項目ごとに表示**(例: DB が ❌ → 「pnpm db:up で起動しているか / DATABASE_URL が正しいか」)。
  - **指標**(リクエスト数・5xx・エラー率・稼働時間・メモリ)。
  - **設定の要点**(秘密値はマスク)。「設定漏れでは?」を即確認できる。
  - **次に見るところ**への導線(/admin/env・db-viewer・audit・maintenance)。
- AppNav の管理メニュー**先頭**に「運用」を配置(障害時に真っ先に押す場所)。ついでに**未使用だった `adminOnly` 型定義(デッドコード)を除去**。

### 【新規】障害対応の手順書(docs/ops/INCIDENT_RESPONSE.md)
- **「あわてないでください。この順にやれば大丈夫です」**から始まる実務手順。
- **最初の 5 分**: /admin/ops を開く → 何が壊れているか → 影響範囲 → **関係者に一報**(テンプレ付き。「原因が分からなくても連絡する。調査中の一言があるかないかで周囲の混乱が全く違う」)。
- **症状別の対応**: 画面が開かない / サーバが落ちた / DB に繋がらない / 特定機能だけ / メールが届かない / 遅い。**ログから原因を特定する表**(`環境変数の検証に失敗` → 設定漏れ、`too many connections` → 接続枯渇 等)。
- **ロールバック**: 「迷ったら戻す。原因究明は復旧してから」。**`git revert` を使い `reset --hard` で歴史を消さない**。DB マイグレーションを戻すのは危険と明記(バックアップ必須・自信がなければやらない)。
- **復旧したら**: 連絡 → **15 分で記録**(Issue のテンプレ付き) → **責めない**(「犯人探しをすると、次から誰も報告しなくなる。それが一番危険」)。
- **予防**: 毎日 /admin/ops を 30 秒眺める、月次でバックアップからの**復元を試す**(「試していないバックアップは無いのと同じ」)。
- **チートシート**と**連絡先の記入欄**(導入時に埋める)。

### VS Code / Cursor のデバッグ設定(点検結果: 既存で充実)
- `.vscode/launch.json` に 5 構成(Vitest 単体/全体・スモーク・Next.js サーバサイド・実行中プロセスへのアタッチ)が既にあり、`settings.json` / `extensions.json` / `tasks.json` も整備済み。**追加不要**と判断し、smoke で構成の存在を検証するに留めた。

---

## Platform Debugger(@platform/debug)+ scaffold の是正

### 構想の評価と絞り込み
提案された 14 機能のうち、**既存と重複するもの**(Config Viewer → `/admin/env`、Performance → `/admin/ops`、AI Review → preflight/advisor の 15 検査、Session Viewer → `/api/auth/me`)と、**技術的に非現実的なもの**(Package Monitor: 実行時に「どのパッケージを使ったか」を知るには 104 パッケージ全てに計装が必要。基盤を汚す)を除外し、**核心の 4 つ**に絞って実装した。

核心の指摘は正しい: **ブラウザの DevTools はブラウザ側しか見えない。「この画面が遅いのは SQL が 30 本走っているからか、AI が遅いのか」はサーバの中を見ないと分からない**。DebugKit が解いていた問題そのもの。

### @platform/debug — 収集機構
- **リクエスト単位の記録**: `@platform/context` の requestId で束ね、SQL / 外部API / AI / イベント / ログ / ジョブを時系列で記録。リクエスト開始からの相対時刻(atMs)と所要時間を持つ。
- **本番では完全無効**: `enabled: false` なら記録も保持もしない(メモリ・性能への影響ゼロ)。`DEBUG_TOOL=true` でも **`NODE_ENV=production` なら強制的に false**。API も 404 を返し、存在を隠す。
- **メモリのリングバッファ**(既定 50 件)。DB も外部サービスも使わない。
- **基盤側に計装を仕込まない**設計。104 パッケージに手を入れず、呼び出し側が記録したいものだけ記録する。
- **実行時にしか分からない問題を検出**(`findIssues`): N+1(同じ SQL の繰り返し)・遅い SQL・SQL 20 本超・失敗・1 秒超え(内訳つき)。静的解析(preflight/advisor)と役割を分けた。
- `summarizeSql` で SQL を「動詞 + テーブル名」に短縮(一覧で読めるように)。

### アプリへの配線
- `withApiObservability`(全 API の通り道)に `start`/`finish` を配線。**全リクエストが自動で記録される**。
- 画面 `/debug`: リクエスト一覧(件数・所要時間・⚠ の数)+ **タイムライン(帯グラフでいつ何が何 ms かかったか)** + 気になる点 + 内訳。無効時は有効化の手順を案内。
- AI 呼び出しは既存の `createMemoryAiLogStore` が記録済みのため二重計装を避けた。

### 【重大】scaffold の不備を発見・是正
- **前回 14 パッケージで見つけた規約違反(build/lint/vitest.config の欠落)の元凶が scaffold 自身だった**。生成する package.json に `typecheck` と `test` しか無く、`vitest.config.ts` も生成していなかった。
- 是正: `build` / `lint` を追加、`vitest.config.ts`(共通カバレッジ閾値)を生成、`@platform/config` を devDeps に追加。**今後 scaffold で作るパッケージは規約どおりになる**。

---

## SQL Monitor 完成 + Debugバー + システムアラート通知 + @platform/task

### Platform Debugger の完成(SQL Monitor + フローティングバー)
- **SQL Monitor**: `createDb` の `onQuery`(既に器はあった)を `services.ts` で配線。**DEBUG_TOOL が有効なときだけ** Prisma のクエリログを有効にし、`summarizeSql` で短縮して記録する(本番はオーバーヘッド無し)。リクエスト外(起動時の初期化など)は requestId が無いので記録しない。
- **フローティングバー**(`DebugBar`): DebugKit の最大の利点は「**画面を見ながらその場で確認できる**」こと。全画面の隅に常駐し、直近リクエストの所要時間・SQL 件数・⚠ の数を表示。遅い/エラー/問題ありで色が変わる。クリックで詳細、`/debug` へ誘導。**本番では API が 404 を返すため何も描画しない**(存在しないのと同じ)。自分自身(`/api/debug`)は一覧から除外。

### システムアラートの通知配線(system-alerts.ts)
- **既存の `alerts.ts` は業務アラート**(売掛の期限超過など)。混同を避け、システムの健康状態は `system-alerts.ts` として分離。
- ルールは **ADR 0012(性能基準)に合わせた**: エラー率 1% 超で critical(基準は 0%)、平均 500ms 超が続けば warning(一覧の目標は p95 300ms)。
- **運用上重要な挙動**を検証: ①1 回目の異常では発報しない(一時的スパイクで騒がない・`forEvaluations`)②発報中は鳴り続けない(状態変化のときだけ通知。鳴り続けるとやがて誰も見なくなる)③回復も通知する。
- 通知先はメール / Slack(`ALERT_MAIL_TO` / `ALERT_SLACK_WEBHOOK`)。**未設定でもログには残す**(気づけないより良い)。文面に運用ダッシュボードと障害対応手順へのリンクを含める。
- cron API `/api/admin/system-alerts/scan`(CRON_TOKEN 認証。**未設定なら 503** で誰も叩けない=既定で安全側)。

### 【新規】@platform/task — タスク管理(プロジェクト管理も兼ねる)
提示されたアプリ一覧を既存と突き合わせた結果、**★5 の 10 個中 9 個は既に存在**し、欠けていたのは**タスク管理**のみだった(会議室予約は `@platform/booking` + `/api/bookings` が既存)。★4 では プロジェクト管理 / FAQ / 契約管理 が未実装。

そこで **タスク管理を実装し、プロジェクト管理も同じ仕組みで賄う**ことにした(タスクに `projectId` を持たせるだけ。「プロジェクト」は「タスクの束」に過ぎず、別の仕組みは要らない)。

- **状態遷移**: todo → doing → review → done。**順序を飛ばせない**(着手せずに完了はおかしい)。差し戻し(done → doing)と中止(どこからでも canceled)は可能。不正な遷移は VALIDATION エラー。
- **設計の判断を README に明記**: 中止は進捗の分母から除く(やらないと決めたものを未完扱いすると永久に 100% にならない)/ 期限なしは並べ替えで最後 / 負荷は未完のみ集計(終わった仕事は負荷ではない)/ かんばんに canceled を出さない(見たいのは今やること)。
- `summarize`(進捗・期限切れ・工数)/ `toKanban`(4 列)/ `workloadByAssignee`(**誰に偏っているか**)/ `sortTasks` / `filterTasks`。
- **scaffold 是正の効果を確認**: 生成された雛形が最初から規約どおり(build/lint/vitest.config 付き)だった。

---

## apps 側の開発規約を CLAUDE.md に明記 + 機械検査 + タスク管理画面

### CLAUDE.md に「apps 側の開発規約」を明記(提供されたルールを推敲・統合)
- **基盤は共通機能の唯一の実装元**であることを冒頭に。「探す → あれば必ず使う → 無ければ汎用か業務固有かを判断 → 汎用なら基盤追加を提案(別 PR)」の順序を明文化。
- **apps に書いてよいもの / いけないものの対比表**: ✅ 経費申請の承認フロー・勤怠の集計・見積の金額計算・画面の表示制御 / ❌ 認証・ログ・監査・バリデーション・日付/数値/文字列・CSV・PDF・Excel・メール・通知・ファイル・HTTP・AI・RAG・Workflow・Scheduler・Queue・Cache・Feature Flag・設定管理・テストユーティリティ。
- **判断基準を一文に**: 「**この処理、隣の部署のアプリでも使うか?**」使うなら基盤。
- **禁止事項**(独自ユーティリティの量産・独自 HTTP/バリデーション/ログ/CSV/PDF)と**実装前チェック**。
- 「AI が守ること」にも Package 優先を追記。**古い記述(`pnpm changeset`)を解消**し `platform:check` / `platform:sync` に統一(ADR 0011 と整合)。基盤の探し方も MCP / portal / module-list に更新。

### 【新規】check-app-rules — 規約の機械検査
**規約は書くだけでは守られない**(人のレビューは見落とす)ため、機械で検出する。preflight に組込。
- **禁止ライブラリの直接 import**(error): nodemailer → @platform/mail、@prisma/client → @platform/db、pdfkit → @platform/pdf、axios → @platform/http、**@anthropic-ai/sdk / openai → @platform/ai(ADR 0010)** など 15 種。
- **汎用処理の自作を疑うファイル名**(warn): `csv.ts` / `pdf.ts` / `logger.ts` / `validation.ts` / `date.ts` など。業務固有なら ALLOW に理由付きで登録。
- **業務ロジックは検出しない**(apps に書くのが正しいため)。実際に 691 ファイルを検査し、**現状の違反はゼロ**(boundaries が効いている)ことを確認。

### タスク管理の画面(/tasks)
- 前回作った `@platform/task` を配線。**集計・かんばん・並べ替え・状態遷移はすべて基盤に委譲**し、画面は表示と API 呼び出しだけ(規約の実践例になっている)。
- **DB 不要**: メモリストア + seed 済みで、`pnpm dev:internal` すればすぐ触れる(タスク管理は Prisma スキーマ追加が必要なため、まず動かして評価できる形にした)。
- かんばん 4 列 + 進捗バー(中止を除いた完了率) + 期限切れの強調 + **担当者ごとの負荷**(未完のみ・棒グラフで偏りが一目で分かる)。不正な状態遷移は基盤の VALIDATION を尊重して 400 で返す。AppNav に導線。

---

## TSDoc の実態調査・規約化・最重要パッケージの完備

### 【調査】TSDoc の網羅性は 6% だった
ご指摘のとおり、説明文はあっても **`@param` / `@returns` などのタグが構造化されていなかった**。実測:

| 項目 | 実態 |
|---|---|
| 公開関数(export function) | **1,523** |
| TSDoc 完備(説明文 + 必要なタグが揃っている) | **92(6%)** |
| `@param` あり | 10% |
| `@returns` あり | 6% |
| `@throws` あり | 0% |

**なぜ問題か**: 型だけでは「この引数に何を渡すのか」「何が返るのか」「いつ例外が出るのか」が分からない。エディタの補完に説明が出ないと実装を読みに行くことになる。**AI も TSDoc が無いと誤った使い方を提案する**。

### 【新規】check-tsdoc — 網羅性の検査
- `node tools/check-tsdoc.mjs`(全体の完備率とワースト15)/ `node tools/check-tsdoc.mjs <package>`(不足の詳細)。
- **すべての関数に全タグを求めない**現実的な判定: 引数があるのに `@param` が無い / void 以外を返すのに `@returns` が無い / `throw` するのに `@throws` が無い / 説明文が全く無い、を「不足」とする。

### 最重要パッケージを完備に
- **`@platform/core`(47 パッケージが依存)を 0% → 100%**。`httpStatusFor` / `isRetryable` / `isPermanent` / `toErrorEnvelope` / `createBulkhead` / `createLifecycle` / `installProcessGuards` / `ok` / `err` / `defaultShouldRetry` に `@param` / `@returns` / `@throws` / `@example` を追加。**「なぜそうしているか」も記載**(例: isPermanent は「分類できないものは false = 迷ったら再試行させる安全側の設計」)。
- 直近で作った **`@platform/task`(9 関数)/ `@platform/debug`(3 関数)も完備**に。

### CLAUDE.md に TSDoc 規約を明記
- タグごとの判断基準を表に(説明文は必ず / @param は引数があれば必ず / @returns は void 以外なら必ず / @throws は throw するなら必ず)。
- **「型で分かることは書かない」**(「文字列」ではなく「対象のタスク」)、**「なぜそうしているかを書くと価値が高い」**を明記。
- **一斉修正はしない方針**を明記: 1,523 関数を一度に直すと差分が巨大でレビューできない。**新規と改修時に少しずつ直す**(触ったところから確実に良くする)。smoke で core / task / debug の完備を守り、退行を防ぐ。

---

## TSDoc の継続改善(tax)+ タスクの DB 永続化

### TSDoc: `@platform/tax` を完備(0% → 100%)
被依存順の次点。**金額計算は間違えると実害が出る**ため優先した。12 関数すべてに `@param` / `@returns` / `@example` を追加。

- `netFromGross`: 「**整数演算寄りの式**(`gross * 100 / (100 + rate)`)を使い浮動小数点誤差を避ける」という**なぜ**を明記。
- `normalizeInvoiceNumber`: 「人が手入力した値は全角や空白が混ざるため、検証の前に通す」という**使う場面**を明記。
- `summarizeTax`: 「適格請求書に必要な『税率ごとの区分記載』を満たす形」と、返るデータの意味を明記。
- `applyWithholding`: 「100 万円を境に税率が変わる日本の制度に対応」を明記。

これで **core(47 パッケージが依存)/ tax / task / debug が完備**。smoke で退行を防ぐ。

### タスクの DB 永続化(memory / prisma パリティ)
- **Prisma スキーマに Task モデルを追加**(63 モデル)。status / assignee / projectId / dueDate に索引。
- `createPrismaTaskStore` を実装し、**`TASK_PERSISTENCE=prisma` で DB、未設定ならメモリ**(seed 付き)に切り替わる。**DB を用意しなくても触れる**状態は維持(評価・デモ用)。
- **`prismaTaskToTask`(行 → Task)の変換規則を明示**: DB は `null`、アプリは `undefined` で「無い」を表す(TypeScript の慣習に合わせる)。`dueDate` は日付のみ扱うため `YYYY-MM-DD` に落とす。日時は ISO 文字列。
- `update` / `remove` は存在しない id で例外を投げず `undefined` / `false` を返す(呼び出し側が 404 にできる)。
- memory と prisma で **create の形が揃う**ことを smoke で検証(パリティ)。

---

## リファレンスに引数・戻り値を出力 + TSDoc を書く仕組み

### 【重要な修正】gen-reference が index.ts しか見ていなかった
- **問題**: `export * from "./foo.js"` で再公開するパッケージは index.ts に宣言が無いため、**`@platform/core` のリファレンスが 0 件**だった(最も使われるパッケージなのに)。
- **対応**: **src 配下すべて**を解析し、index.ts の export 名で「公開されているか」を突き合わせる方式に変更。core が 0 → 25 エントリ、全体で 2,766 エントリに。同名が複数あれば**情報が多い方**(実装側の TSDoc)を採用。

### リファレンスが引数・戻り値・例外・使用例を出すように
- **TSDoc を構造化して抽出**: 説明 / **signature**(`httpStatusFor(error: unknown): number`)/ **@param**(名前と説明)/ **@returns** / **@throws** / **@example**。複数行のタグにも対応。
- **リファレンスサイト**(`pnpm site`)に表示: 関数名の下に、シグネチャ → 引数の箇条書き → 戻り値 → 例外(オレンジ)→ 使用例(折りたたみ)。引数の説明も XSS エスケープ済み。
- 現在 219 エントリに引数 or 戻り値が付いている(TSDoc を書いた分だけ増える)。

### 今後 TSDoc を必ず書くための仕組み
- **CLAUDE.md**: 「**UI(React コンポーネント)にも書く**」を追記(props が何か分からないと再利用されない)。実例つき。
  **「書かなければサイトにも出ない = 使う人に伝わらない」**と、書く動機を明示。
- **scaffold の雛形を TSDoc 完備に**: 生成される `placeholder` 関数に `@param` / `@returns` の手本と「**TSDoc は必ず書く**(このコメントを書き換えて使う)」の注意を入れた。**今後 scaffold で作るパッケージは最初から手本に従う**。
- smoke で「scaffold の雛形に手本がある」「サイトが引数・戻り値を描画する」「core が空でない」を検証し、退行を防ぐ。

---

## TSDoc: auth / datetime の重要関数 + 【重大】CI の DB 適用が壊れていた

### TSDoc: 誤用が事故に直結するものを優先
**auth(権限判定・OTP)と datetime(日付計算)は、誤用が事故に直結する**ため優先した。「なぜそうなのか」「何に気をつけるか」を書くことを重視。

- **auth**: `canAll` は「**required が空なら true**(条件が無い = 通す)」、`filterAuthorized` は「**見えてはいけないものを一覧に出さない**ため。画面側で絞ると実装漏れが情報漏洩になる」、`generateOtpCode` は「`Math.random()` は**使わない**(予測可能で認証コードには不適)」、`createOtpChallenge` は「**code は保存しない**」、`generateBackupCodes` は「**画面に一度だけ表示**。二度と見せられない」。
- **datetime**: `daysInMonth`/`utcDate` は「**month は 1〜12**(JavaScript の Date と違い 0 始まりではない)」、`utcDate` は「`new Date(2026, 6, 15)` は**ローカルタイムゾーン**で解釈され環境によって日付がずれる」、`addMonths` は「**月末はクランプ**(1/31 の 1 ヶ月後は 3/3 ではなく 2/28)」を実例つきで明記。

### check-tsdoc の既知の限界を明記
正規表現ベースのため、**ジェネリクス付き**(`filterAuthorized<T>`)や**デフォルト引数を含む複数行シグネチャ**(`canResendOtp(a, b, now = new Date())`)は検出できない。TSDoc は書いてあっても対象外になる。完全な解析には TypeScript Compiler API が必要だが install が要るため見送り、限界をツールのコメントに記録した。

### 【重大】CI の E2E が壊れていた(マイグレーション不整合)
- **発見**: `e2e.yml` が **`prisma migrate deploy` を実行**していたが、**マイグレーションファイルが 1 つも無い**(開発は `db push` 運用)。**何も適用されず E2E が失敗する**状態だった。SETUP.md も「チーム開発・本番はマイグレーション履歴を推奨」と書いており、実態と食い違っていた。
- **ADR 0013 で方針を決定**: **`db push` を正式とする**(マイグレーション履歴は持たない)。理由: 本番未稼働で「既存データを壊さずスキーマを変える」場面がまだ来ていない / 63 モデルを一度にマイグレーション化すると初回 SQL が巨大でレビューできない / CI の E2E は毎回まっさらな DB なので履歴は不要。
- **代償も明示**(履歴は Git のコミットで追う / 本番稼働前に必ず見直す)し、**移行手順**(`prisma migrate dev --name init`)まで記録。
- CI を `db push` に修正、SETUP.md も整合させた。**「本番運用を開始する」が見直しの最重要条件**と明記。

---

## CLAUDE.md のコマンド一覧を刷新 + check-tsdoc の精度向上 + 壊れたコマンドの修正

### CLAUDE.md の「よく使うコマンド」を全面刷新
- **3 行の箇条書き**だったものを、**8 カテゴリ・50 コマンドの表**に。**それぞれの説明と引数**を記載(ご要望)。
  - まずこれ(`pnpm check` / `dev` / `doctor`)/ 開発サーバ(ポートつき)/ 検証 / 基盤を作る・変える / 生成物 / DB / AI・環境 / 個別の検査ツール。
  - 引数の例も明記(`pnpm loadtest -- --url <URL> --concurrency 20`、`pnpm test:pkg @platform/tax test`、`pnpm advisor dup`)。
- **古い記述を修正**: `MailHog` → Mailpit。`pnpm changeset` は**「使わない」と明記**(ADR 0011)。DB スキーマは `db push`(ADR 0013)を追記。

### 【発見】壊れていたコマンド 2 件
- **`pnpm gen:depgraph` が存在しないファイルを指していた**(`gen-dep-graph.mjs` → 実際は `gen-depgraph.mjs`)。**実行すると必ず失敗する**状態だった。
- **scaffold が 2 つ存在**していた(tools/scaffold.mjs と tools/scaffold/index.ts の 2 ファイル)。`pnpm scaffold` は後者(`tsx` 経由)を指していたが、**TSDoc の手本を入れたのは前者**で、どちらが正なのか分からない状態。動作確認済みの `.mjs` に一本化し、古い方を削除。

### check-tsdoc の精度向上
- **正規表現が引数を `[^)]*` で拾っていた**ため、デフォルト引数(`now: Date = new Date()`)やネストした括弧で途中で切れ、**ジェネリクス付き(`filterAuthorized<T>`)や複数行シグネチャの関数を検出できていなかった**。
- `[\s\S]*?` の最短一致に変更し、**検出数 1,523 → 1,676(+153)**。`filterAuthorized` / `canResendOtp` / `daysUntil` も検出できるように。
- 限界の記述も実態に更新(残る限界はアロー関数 `export const foo = () => {}` とオーバーロード宣言)。

### auth の TSDoc を追加
- `featureFlags`(精度向上で新たに検出された)を完備に。「画面側で `can(...)` を何度も呼ぶより、一度まとめて渡した方が読みやすい」という**使う理由**と実例つき。

### ドキュメントの重複を役割分担で整理
- CLAUDE.md と COMMANDS.md にコマンド表が重複 → **ALLOW に理由付きで登録**(CLAUDE.md = AI/開発者向けの**規約文脈**、COMMANDS.md = **早見表**。役割が違う)。

---

## コマンド実在検査の自動化 + @platform/faq(社内FAQ)

### コマンドの実在検査を自動化(check-docs-links に追加)
前回**手作業で**「`pnpm gen:depgraph` が存在しないファイルを指している」を見つけたため機械化。package.json の全スクリプトについて、参照する `tools/*` `scripts/*` が実在するかを検査する。**実行すると必ず失敗するコマンドは、打つまで気づけない**ため。preflight 経由で CI に入る。

### 【新規】@platform/faq — 社内 FAQ
★4 の残り。既存を調べたところ **FAQ の基盤は無かった**(`@platform/cms` は記事管理で別物)ため新規作成。

FAQ は「**困っている人が答えを探す**」ためのもので、**検索されやすさ**と**どれが役に立っているか**が要になる、という前提で設計した。

- **検索**: 質問文 > キーワード > 回答本文 の順で加点(「質問がそのまま一致する」のが最も確度が高い。回答本文の一致は弱い証拠)。下書きは出さない。
- **`sortByHelpfulness`**: **票が少ない 100% より、票の多い 90% を上に**出す(1 票で 100% を上位にすると実態と合わない。票数で自信を割り引く)。
- **`helpfulRate`**: **票が無ければ `undefined`**(0% と区別する。「悪い」のではなく「まだ分からない」)。
- **`needsReview`**: **役に立っていない FAQ は、無いより悪い**(探した人の時間を奪う)ため、機械的に挙げる。低評価に加え「**見られているのに投票が無い**」も検出(答えになっていない可能性)。**票が少ないものは決めつけない**(既定 5 票以上)。
- 全文検索は `@platform/search`(BM25)に委譲できる形(索引は持たない)。

**TSDoc は最初から完備**(8 関数)。scaffold の雛形と CLAUDE.md の規約が効いていることを確認できた。

---

## @platform/contract(契約管理)— ★4 完了

★4 の最後。`@platform/quote` の先例(「invoice を再利用し、見積特有の**有効期限・状態・変換**だけを提供」)に倣い、**契約に固有の関心事だけ**を扱う設計にした。金額の明細は invoice、見積からの変換は quote の担当。

### なぜ必要か — 実務でいちばん問題になるのは「解約予告」
```
契約終了 2026-12-31、解約予告 90 日前
  → 2026-10-02 までに申し出ないと、自動で 1 年延びる
```
この日を過ぎたことに気づかず、不要な契約が更新され続ける。これを防ぐのが `contractAlerts`。

### contractAlerts が挙げるもの
| 状況 | 深刻度 | なぜ |
|---|---|---|
| **自動更新の予告期限が 30 日以内** | **danger** | 過ぎると意図せず 1 年延びる。最優先 |
| 予告期限を過ぎた | info | **もう手遅れなので焦らせない**。「次回に備える」案内として出す |
| 手動更新で終了まで 7 日以内 | danger | 放置すると切れる |
| 手動更新で終了まで 30 日以内 | warning | そろそろ手続きを |
| 終了日を過ぎて `active` のまま | warning | データの不整合(**人は更新を忘れる**) |

### 設計の判断
- **有効期間は `status` ではなく日付で判定**(status が active のまま終了日を過ぎていることがある。人が更新し忘れるため)。
- **予告期限を過ぎたら danger ではなく info**(もう手遅れ。焦らせても意味がない)。
- **予告期間が無ければ `canGiveNotice` は常に true**(いつでも解約できる契約もある)。
- `renew` は**新しい契約を返す**(元を書き換えない。履歴を残せるように)。翌日から n ヶ月後の前日まで。

### 検証で分かったこと
テストで 2 件失敗したが、**コードが正しく私のテスト期待が誤り**だった(予告期限が既に過ぎているケースを danger と書いていた。実際は info が正しい)。日付の計算を確認してから期待を立て直した。

TSDoc は最初から完備(7 関数)。**scaffold の雛形と CLAUDE.md の規約が定着している**。

---

## ★5・★4 の総点検(20/20 達成)+ FAQ 画面

### 【総点検】★5・★4 の 20 項目がすべて揃った
| ランク | 項目 | 状態 |
|---|---|---|
| ★5 | 社員管理 / 顧客管理(CRM) | **アプリに実装済み**(画面・API・Prisma モデル)。業務固有なので基盤には置かないのが正しい |
| ★5 | ワークフロー / 会議室予約 / タスク / 在庫 / AIチャット / RAG / ダッシュボード / 管理画面 | 基盤あり |
| ★4 | EC / CMS / 経費 / プロジェクト / ファイル / FAQ / イベント予約 / 請求 / 契約 / AI議事録 | 基盤あり |

**20/20 が揃った。** プロジェクト管理は `@platform/task`(projectId で束ねる)、イベント予約は `@platform/booking` で兼ねている。

### FAQ の画面(/faq)
- `@platform/faq` を配線。**検索・カテゴリ別・並べ替え・投票・要見直しの判定はすべて基盤に委譲**し、画面は表示と API 呼び出しだけ(規約の実践)。
- **DB 不要**: メモリストア + seed(公開 5 件・下書き 1 件・**低評価 1 件**)で、`pnpm dev:internal` すればすぐ触れる。seed に「要見直し」が含まれるので、機能を実感できる。
- 画面は「**困っている人が答えを見つける**」ことに集中: 検索窓を最上部に / 質問をクリックで回答を開く / **役に立ったか投票**(投票後は「ありがとうございました」)/ 見つからないときは情シスへの案内。
- 検索していないときは「よくある質問(評価が高い順)」+ カテゴリ別。
- **要見直しの一覧は管理者のみ**(`?admin=1`)。一般利用者には見せない。
- `create` の既定は `draft`(**いきなり公開しない**)。

---

## 契約の画面 + ★3 以下の点検

### 契約の画面(/contracts)— 「今やるべき対応」を最初に見せる
契約管理でいちばん困るのは「**解約予告の期限を過ぎて、不要な契約が 1 年延びる**」こと。一覧を眺めて自分で気づくのは無理なので、**機械が見つけて先頭に出す**構成にした。

- **今やるべき対応**を最上部に(至急 → 注意 → 参考)。「放っておくと損をするものから順に出しています」と明記。各項目に**何が起きているか**と**何をすべきか**を併記。
- **一覧に「解約予告期限」の列**を設け、過ぎたものは赤字 +「過ぎた」表示。終了日も残日数つきで、30 日以内は黄・超過は赤。
- 要約(有効件数・年間金額・対応が必要・期限切れのまま)。
- 更新・解約は**管理者のみ**。判定・集計・更新はすべて `@platform/contract` に委譲(画面は表示と受け渡しだけ)。
- **DB 不要**: メモリ + seed(自動更新で予告期限が迫るもの / 予告期限を過ぎたもの / 手動更新で終了間近 / 終了日を過ぎて active のまま / 一回限り)。**seed だけでアラートが 3 種類とも出る**ので、機能をすぐ実感できる。
- `create` の既定は `draft`(**いきなり有効にしない**。承認を経てから)。

### 【点検】★3 以下は「今すぐ作るべきものは無い」
一覧の残り(人事評価・スキル管理・シフト・名刺・安否確認・営業日報・ガントチャート・GPS/NFC 等)を調べた結果:

- **既存基盤で兼ねられるもの**: 車両予約・来客予約 → `@platform/booking` / ポイント管理 → `@platform/commerce` / 研修管理 → `@platform/elearning` / 電子帳簿保存 → `@platform/dencho` / BI ダッシュボード → `@platform/analytics`。
- **基盤が無いもの**: いずれも**業務固有**(人事評価・営業日報・シフト)か、**需要が先に来てから作るべきもの**(名刺・安否確認・GPS/NFC)。「使うかもしれない」で作ると、使われない基盤が増えて保守が重くなる。

**結論: ★3 以下で今すぐ基盤化すべきものは無い。** 実際に必要になった時点で、業務要件を見てから作る。

---

## TSDoc: auth / datetime を完備(誤用が事故に直結する 2 つ)

### 実績
| パッケージ | 前 | 後 |
|---|---|---|
| `@platform/auth`(44 関数) | 不足 24 | **完備** |
| `@platform/datetime`(52 関数) | 不足 39 | **完備** |
| 全体 | 163 完備(10%) | **241 完備(14%)** |

TSDoc 完備は **core / tax / task / debug / faq / contract / auth / datetime の 8 パッケージ**に。

### 書いたことの中身 —「型で分かること」ではなく「誤用しやすいこと」
- **datetime**: `quarter` は「**日本の年度(4月始まり)ではなく暦年**」/ `businessDaysBetween` は「**始点を含み終点を含まない**」/ `addBusinessDays` は「**土日祝を飛ばす**」/ `isWeekend` は「**祝日は含まない**(祝日は isHoliday で見る)」/ `floorToMinutes` は「**勤怠の打刻でよく使う**」/ `formatDate` は「**UTC 基準。ローカルタイムゾーンの影響を受けない**」/ `rangeIntersection` は「**重ならなければ undefined**」/ `eachDayOfRange` は「長い期間では件数に注意」。
- **auth**: `generateTotpSecret` は「**利用者ごとに 1 つ生成し DB に保存**」/ `verifyTotp` は「**端末の時計のずれを吸収するため前後の窓も見る**」/ `totpAuthUri` は「**QR コードにしてスキャンさせる**」/ `generateWebAuthnChallenge` は「**毎回新しく作り使い捨てる**(再利用は攻撃を許す)」/ `verifyClientData` は「**origin の検証を省くとフィッシングを許す**」/ `isSignCountValid` は「**減っていたら認証器の複製を疑う**」/ `verifyBackupCode` は「**成功したら records を保存し直すこと**」/ `remainingBackupCodes` は「**0 になったら再発行を促す**」。

一括処理は正規表現で既存の 1 行コメントを活かしつつタグを足す方式。**説明文を捨てずに構造化**した。型チェックは両方 0(外部ライブラリ未インストールの 2 件を除く)。

---

## TSDoc: validation / integrations / logger を完備 + FAQ・契約の DB 永続化

### TSDoc(完備 11 パッケージに)
| パッケージ | 前 | 後 |
|---|---|---|
| `@platform/validation`(27 関数) | 不足 16 | **完備** |
| `@platform/integrations` / `logger` | 各 1 件不足 | **完備** |

完備は **core / auth / datetime / validation / integrations / logger / tax / task / debug / faq / contract の 11 パッケージ**。

**入力検証は誤用が事故に直結する**ため優先した。書いた内容:
- `normalizeDocumentNumber`: 「**検証の前に必ず通す**(人の手入力は揺れる)」
- `isValidMyNumber`: 「**マイナンバーはログに残さないこと**」
- `isValidJapanPassportNumber`: 「**チェックディジットは無いので形式のみ**」(検証の強さが書類ごとに違うことを明示)
- `isHalfWidthKana`: 「**銀行振込のデータで使う**」(何のためにあるか)
- `toHalfWidth`: 「**カナは変換しない**」(よくある勘違い)

### FAQ・契約の DB 永続化(memory / prisma パリティ)
- **Prisma スキーマに Faq / Contract モデルを追加**(65 モデル)。status / category / partner / endDate に索引。
- `FAQ_PERSISTENCE=prisma` / `CONTRACT_PERSISTENCE=prisma` で DB、未設定ならメモリ(seed 付き)。**DB を用意しなくても触れる**状態は維持。
- **変換規則を明示**: 契約の日付は**日付のみ**扱うため `YYYY-MM-DD` に落とす(時刻は契約管理では不要)。DB の `null` はアプリの `undefined`。
- `update` は存在しない id で例外を投げず `undefined`(呼び出し側が 404 に)。`incrementViews` は失敗しても黙って無視(**閲覧数の記録で処理を止めない**)。
- memory と prisma で **create の既定が揃う**(FAQ は draft・票 0、契約は draft・手動更新)ことを smoke で検証。

---

## TSDoc: utils の一部 +【教訓】一括処理は危険

### 実績
- `@platform/utils`(**アプリから 10 ファイルで使われる最多**)の `array.ts`(12 関数)を完備に。`sortBy` は「**安定ソートなので同じ値の順序は保たれる**」、`range` は「**end は含まない**」、`keyBy` は「**同じキーは後勝ち**」、`first`/`last` は「**空なら undefined**」など、**誤用しやすい点**を明記。
- 全体: 241 完備(14%)。TSDoc 完備は **core / auth / datetime / tax / task / debug / faq / contract の 8 パッケージ**。

### 【教訓】正規表現での一括処理は関数を壊す
137 件を効率よく処理しようと正規表現で TSDoc を機械的に足したところ、**2 つの事故**が起きた。

1. **別の関数の説明が混入した**(`sortBy` の `@returns` に `partition` の説明が入った)。
2. **関数本体ごと消えた**(`sortBy` の実装と `@packageDocumentation` が丸ごと消失。smoke で気づいて復元した)。

さらに、「(説明を書く)」のような**雛形だけ入れるのも有害**だと判断して差し戻した。TSDoc があるように見えて中身が無いのは、無いより悪い(読む人の時間を奪う)。

**対策**: `check-tsdoc.mjs` と CLAUDE.md に「**1 ファイルずつ、意味を確認しながら書く**」と明記。急がば回れ。残る `utils` の 125 件(numbers 57 / strings 41 など)は、**触ったときに直す**方針を維持する。

---

## FAQ・契約の DB 永続化(調査結果)+ demos/workplace-ops(3 基盤の横断)

### 【調査】FAQ・契約の DB 永続化は既に完了していた
モデルを追加しようとしたところ `❌ model 名が重複: Faq, Contract` で気づいた。**前セッションで既に実装済み**だった:
- Prisma モデル `Faq` / `Contract`(`String[]` 配列型も使用)
- `createPrismaFaqStore` / `createPrismaContractStore`
- `FAQ_PERSISTENCE=prisma` / `CONTRACT_PERSISTENCE=prisma` での切り替え

**新規作成の前に重複を確認する**という手順が働いた(check-schema が検出)。追加した重複ブロックは削除し、65 モデルのまま維持。

### 【新規】demos/workplace-ops — 情シスの「朝の 30 秒」
タスク・契約・FAQ を**横断して**「今日やるべきこと」を出すデモ。

**なぜこのデモがあるか**: 個々の基盤は「自分の領域」しか知らない。
| 基盤 | 分かること | 知らないこと |
|---|---|---|
| `@platform/task` | 期限切れのタスク | 契約のこと |
| `@platform/contract` | 解約予告の期限 | タスクのこと |
| `@platform/faq` | 直すべき FAQ | それが誰の仕事か |

**横断してひとつの「やることリスト」にするのはアプリの仕事**(基盤の役割ではない)。その組み立て方を示す。

**並び順の考え方 — 放っておくと損をするものが先**:
1. 契約の解約予告期限(過ぎると 1 年延びる = お金が出ていく)
2. 期限切れのタスク(約束を破っている)
3. 役に立っていない FAQ(探した人の時間を奪う)

**実装のポイント**:
- **判定は基盤に委ねる**(`contractAlerts` / `isOverdue` / `needsReview` をそのまま使う。同じ判定を再実装しない)。
- **集計も基盤に委ねる**(`summarize` / `summarizeContracts` / `summarizeFaq` を束ねるだけ)。
- **未割り当ても見せる**(`groupByOwner`)。担当者が決まっていないものは放置されがちなので目立たせる。
- **「何をすべきか」(action)を必ず添える**。「期限切れです」だけでは動けない。

出力例:
```
🔴 清掃委託: 終了まであと 3 日(2026-07-18)
   → 更新するなら手続きしてください。放置すると切れます(総務)
🔴 サーバ更新: 期限(2026-07-10)を過ぎています
   → 田中 さんに状況を確認してください(田中)
```

デモ 27(起動可 1 = showcase / コンポーネント型 26)。TSDoc 完備・型 0・9 項目の smoke 全緑。

---

## TSDoc: `utils/numbers.ts`(57 関数)を完備

**アプリから最も使われる `@platform/utils`**(10 ファイルで使用)の中で最大のファイル。
前回の教訓どおり**一括処理はせず、セクション単位で 1 つずつ意味を確認**して書いた(範囲・補間 → 丸め → 整形 → パース → 計算補助 → 統計 → 系列・分布 → 外れ値 → 回帰 → 相関 → 時系列)。

| 項目 | 前 | 後 |
|---|---|---|
| `utils` の不足 | 125 | **68**(-57) |
| 全体の完備 | 271 | **328**(19%) |
| 引数 or 戻り値つきのリファレンス | 320 | **405** |

### 書いた内容 —「型で分かること」ではなく「誤用しやすいこと」「なぜ」
- **`safeDivide`**: 「JavaScript の `1/0` は `Infinity` で例外にならないため、**画面に『Infinity%』と出る事故**が起きる。割合を計算するときは必ずこれを通す」。
- **`percentChange`**: 「**from が 0 なら NaN**。0 からの変化率は定義できない。『前月 0 件 → 今月 5 件』は『∞% 増』ではなく『計算できない』が正しい」。
- **`round`**: 「`Math.round(n * 100) / 100` は浮動小数の誤差で `1.005` が `1` になるなど信用できない。**指数表記を経由**して誤差を避けている」。
- **`roundHalfEven`(銀行丸め)**: 「四捨五入を大量に繰り返すと 0.5 が常に切り上がるため**合計が実際より大きくなる**(統計的な偏り)。会計・統計では偶数丸めで偏りを打ち消す」。
- **`floorTo` vs `truncateDecimals`**: 「負の数で挙動が違う(-1.5 → -2 と -1)」を実例で対比。
- **`percentile`**: 「**性能測定では平均より p95 を見る**(平均は外れ値に引きずられて実態を隠す)」。
- **`mean` vs `median`**: 「年収の平均は一部の高額所得者に引っ張られるが、中央値は引っ張られない」。
- **`sum` は空配列で 0、`mean` は NaN**: 「『平均が 0』と『データが無い』は違う」。
- **`correlation`**: 「**相関は因果ではない**。『アイスの売上と水難事故に相関がある』からといってアイスが事故を起こすわけではない(どちらも気温が原因)」。
- **`withoutOutliers`**: 「**除くかどうかは慎重に**。外れ値が『異常』なのか『重要な少数』なのかはデータを見る人にしか分からない(高額取引を外れ値として消すと売上を見誤る)」。
- **`randomInt`**: 「**暗号用途には使わない**(`Math.random()` は予測可能)。パスワード・トークン・OTP には `@platform/crypto` を使う」。
- **`decompose`**: 「『売上が下がった』のが**季節要因なのか、本当の悪化なのか**を切り分けるのに使う」。

型エラー 0・関数 57 件すべて健在・smoke 1225 全緑(5 回連続で安定を確認)。

---

## TSDoc: `@platform/utils`(139 関数)を完備

**アプリから最も使われるパッケージ**(10 ファイルで使用)を完全に終わらせた。
`strings.ts`(41)・`object.ts`(8)・`function.ts`(6)・`similarity.ts`(5)・`index.ts`(4)・
`japanese-number.ts`(2)・`async.ts`(2)を、前回の `numbers.ts`(57)・`array.ts`(12)に続けて。

| 項目 | 前 | 後 |
|---|---|---|
| `utils` の不足 | 68 | **0(完備)** |
| 全体の完備 | 328 | **396(23%)** |
| リファレンスの引数つきエントリ | 405 | **472** |

**完備パッケージは 9 個**: core / auth / datetime / **utils** / tax / task / debug / faq / contract。

### 書いた内容 — 日本語処理と使い分けの落とし穴
- **`truncate` vs `truncateByWidth`**: 「日本語の画面幅を揃えたいなら truncateByWidth(全角は半角の 2 倍の幅を取るため、文字数で切ると見た目が揃わない)」。
- **`truncateMiddle`**: 「**ファイル名やパス向け**。末尾を切ると拡張子が消えて何のファイルか分からなくなる(`report_2026_final.xlsx` → `report_2026_f…` では困る)」。
- **`charLength`**: 「**`str.length` は絵文字や一部の漢字を 2 と数える**。『何文字入力したか』を人に見せるならこちら」。
- **`toHalfWidth`**: 「日本語 IME は全角のまま英数字を打ってしまうため『１２３』が混ざる。**検索や照合の前に揃えておかないと一致しない**」。
- **`toFullWidthKana`**: 「**濁点・半濁点を合成する**(「ｶﾞ」の 2 文字 → 「ガ」の 1 文字)。これをしないと文字数がずれ、検索も一致しない」。
- **`slugify`**: 「**日本語は残らない**(「経費申請」→ 空文字)。日本語のタイトルから URL を作るなら ID を併記する」。
- **`escapeHtml` / `stripHtml` / `unescapeHtml`**: 「stripHtml は**サニタイズではない**」「unescapeHtml を**表示直前に使わない**(XSS になる)」と、混同しやすい 3 つの役割を明示。
- **`mask` / `maskEmail`**: 「**全部隠すと本人確認ができない**ので先頭と末尾だけ残す」「ドメインは残す(社内か社外かは調査に役立つ)」。
- **`debounce` vs `throttle`**: 「debounce は『静かになってから 1 回』、throttle は『一定間隔で定期的に』。**入力補完は debounce、スクロール追従は throttle**」。
- **`memoize`**: 「**キャッシュは無限に増える**(上限が無い)。引数の種類が多いなら `@platform/cache`(LRU・TTL つき)を」。
- **`deepClone`**: 「**Map / Set / 関数 / 循環参照は正しくコピーされない**。必要なら `structuredClone` を」。
- **`deepMerge`**: 「**配列は連結せず置換する**(連結すると既定値を消せなくなる)」。
- **`pick` vs `omit`**: 「**pick の方が安全**(除外を書き忘れると漏れるが、選択なら明示したものしか出ない)」。
- **`jaroWinkler`**: 「**氏名・会社名の名寄せに向く**(『山田太郎』と『山田太朗』は同一人物の可能性が高い)」。
- **`bestMatch`**: 「閾値未満なら undefined(**無理に候補を出すと、かえって混乱させる**)」。
- **`toDaijiAmount`**: 「**契約書・領収書で改ざんを防ぐため**の表記(「一」に線を足して「二」にできない)」。
- **`pTimeout`**: 「タイムアウトしても**元の処理は止まらない**(Promise はキャンセルできない)」。

前回の教訓どおり**一括処理はせず、セクション単位で 1 つずつ意味を確認**した。
型エラー 0・全 139 関数が健在・smoke 1225 全緑(3 回連続で確認)。

---

## TSDoc: `@platform/accounting`(25 関数)を完備 — 利用頻度順に継続

利用状況を実測し、**アプリから最も使われている**ものから着手した。

| パッケージ | 使用ファイル数 | 不足 |
|---|---|---|
| **accounting** | **24** | **0(今回完備)** |
| cms | 15 | 42 |
| chat | 14 | 27 |
| seo / board | 8 | 29 / 28 |
| fs / url / blog / net | **0** | 32 / 29 / 28 / 22 |

**会計は誤用が実害に直結する**(貸借を逆にすれば帳簿が壊れる)ため優先した。
`fs` / `url` / `blog` / `net` は**アプリから未使用**なので後回し。

| 項目 | 前 | 後 |
|---|---|---|
| 全体の完備 | 396 | **421(24%)** |
| リファレンスの引数つき | 472 | **497** |

**完備は 10 パッケージ**: core / auth / datetime / utils / **accounting** / tax / task / debug / faq / contract。

### 書いた内容 — 会計の原則と、なぜそうするか
- **仕訳を図で示した**。文章より貸借の向きが一目で分かる:
  ```
  借方: 売掛金 (net + tax)   貸方: 売上高 (net)
                                   仮受消費税 (tax)
  ```
- **`isBalanced`**: 「**複式簿記の必須条件**。一致しない仕訳はどこかが間違っている(金額の打ち間違い・明細の入れ忘れ)。**保存する前に必ず確認する**」。
- **`salesJournal`**: 「**『請求した』時点で計上する**(入金時ではない)」。発生主義を明示。
- **`receiptJournal` / `paymentJournal`**: 「**消費税は登場しない**(売上/仕入の計上時に済んでいる)。ここは『債権が現金に変わった』だけ」。
- **`payrollJournal`**: 「**預り金は会社のお金ではない**(従業員から預かって、後で国・年金機構へ納める)」。
- **`balanceSheet`**: 「**資産 = 負債 + 純資産**が成り立つのが正しい状態。崩れているなら仕訳のどこかが誤っている」。
- **`profitAndLossByDepartment`**: 「部門の指定が無い明細は集計されないので、**全社合計とは一致しないことがある**(共通費の配賦は別途)」。
- **`entryKey`(冪等キー)**: 「**同じ仕訳を二重に登録しない**ため。送信が途中で失敗して再実行しても重複を検出できる」。
- **`prepareBatch`**: 「**送ってからエラーになると、どこまで登録されたか分からなくなる**。送る前に確認するのが安全」。
- **`syncJournals`**: 「**並列にしない**のは、レート制限と、失敗時にどこまで送ったかを確実に把握するため(**速さより確実さを優先**)」。
- **`consumptionTaxSummary`**: 「**納付税額 = 仮受 - 仮払**。マイナスなら還付。税率別に分けるのは軽減税率(8%)と標準税率(10%)が混在するため」。
- **`journalToRows`**: 「**1 仕訳が複数行になる**(明細ごとに 1 行)。会計ソフトの取り込み形式に合わせるため」。

型エラー 0・全 25 関数が健在・smoke 1225 全緑(3 回連続)。

---

## TSDoc: `cms`(42)+ `chat`(27)を完備 — 利用頻度順に継続

| 項目 | 前 | 後 |
|---|---|---|
| 全体の完備 | 421 | **490(29%)** |
| リファレンスの引数つき | 496 | **565** |

**完備は 12 パッケージ**: core / auth / datetime / utils / accounting / **cms** / **chat** / tax / task / debug / faq / contract。

### cms — 公開の事故を防ぐことを中心に
- **`effectiveStatus`**: 「**DB の `status` をそのまま信じない**。予約公開は予約日時を過ぎたら『公開中』として扱う必要がある。DB を書き換えるバッチが動いていなくても、**読む側で正しく判定できる**ようにする」。
- **`isVisible`**: 「**一覧・詳細を返す前に必ず通す**。下書きや予約前の記事が漏れると事故になる」。
- **`toBlogView` / `toPageView`**: 「**`status` を落とす**のは、公開サイトに『これは下書きです』といった内部情報を渡さないため(渡した先で誤って表示される事故を防ぐ)」。
- **`buildPreviewUrl`**: 「トークンで認証するので、URL を知っている人だけが見られる(**トークンは推測できない値にすること**)」。
- **`revisionFromPost`**: 「**公開のたびに残す**ことで『いつ・誰が・何を変えたか』を追える。誤って消した内容を戻せる」。
- **`revisionToInput`**: 「**下書きとして戻す**(いきなり公開しない)」。
- **`renameTag` / `mergeTags`**: 「**変更が必要な記事だけ**を返す(全件更新すると DB への負荷と更新日時の汚染が起きる)」。
- **`timeUntilPublish`**: 「予約でない/既に過ぎている場合は null(**『あと -3 時間』と表示しないため**)」。

### chat — 信頼と通知の質を中心に
- **`editMessage`**: 「**`editedAt` を記録する**ことで画面に『(編集済み)』を出せる。**編集履歴を隠すと、後から内容を書き換えられて揉める**」。
- **`canModify`**: 「**送信者本人か管理者のみ**。他人の発言を勝手に消せると信頼が壊れる」。
- **`unreadMentions`**: 「**通知の対象**。既読のものを再通知すると、通知が信用されなくなる」。
- **`unreadCount`**: 「**自分の発言は未読に数えない**(自分が書いたものを『未読』と言われても困る)」。
- **`sortRoomsByActivity`**: 「**動きのあるルームを上に**出す(名前順だと、活発なルームが埋もれる)」。
- **`togglePin` vs `toggleBookmark`**: 「**ピンはルーム全体で共有**(全員に見える)、**ブックマークは個人用**(自分にしか見えない)」と混同しやすい 2 つを対比。
- **`extractMentions`**: 「**重複は除く**。同じ人を 2 回書いても通知は 1 回」。
- **`countReactions`**: 「**多い順**。画面でよく押されたものを先に見せる」。

両パッケージとも型エラー 0・全関数が健在・smoke 1225 全緑(3 回連続)。

---

## TSDoc: `observability`(19)を完備 —【発見】seo / board は既に完備だった

### 【発見】一覧の情報が古かった
`seo`(29)/ `board`(28)に着手しようとしたところ、**どちらも既に完備**だった。
前回の「次の対象」一覧が古い情報のままだった。**実測してから着手する**という手順で気づけた。

### 利用状況を再実測し、最多の `observability` を完備に
| パッケージ | 使用ファイル数 | 不足 |
|---|---|---|
| **observability** | **11** | **0(今回完備)** |
| site | 7 | 22 |
| report | 6 | 27 |
| form / zoho / html | 4 | 29 / 26 / 22 |
| **fs / url / blog / net** | **0** | 32 / 29 / 28 / 22 |

| 項目 | 前 | 後 |
|---|---|---|
| 全体の完備 | 490 | **566(33%)** |
| リファレンスの引数つき | 565 | **641** |

**完備は 15 パッケージ**: core / auth / datetime / utils / accounting / cms / chat / **observability** / **seo** / **board** / tax / task / debug / faq / contract。

### 書いた内容 — 運用の要なので「なぜその設計か」を厚めに
- **`createCircuitBreaker`**: 「**外部サービスが落ちているとき、叩き続けない**ための仕組み。これが無いと、**相手の障害が自分の障害になる**(全リクエストがタイムアウト待ちで詰まる)」。
- **`relayOutbox`**: 「**Outbox パターン**: DB の更新と外部への通知を『同じトランザクション』で行えないため、通知内容を一旦 DB に書き(ここまでは原子的)、後から別プロセスが送る。これで**『DB は更新されたのに通知されない』を防ぐ**」。`maxAttempts` は「**超えたら諦めて dead 扱い**。無限に再試行しない」。
- **`createMemoryOutboxStore`**: 「**本番では SQL 実装を使うこと**(メモリだとプロセスが落ちたら通知が消える。**それでは Outbox の意味が無い**)」。
- **`createMemoryIdempotencyStore`**: 「**複数プロセスでは使えない**(プロセスごとに別のメモリを持つため重複を検出できない)」。
- **`withIdempotency`**: 「同じキーの処理が実行中なら CONFLICT(**二重実行を防ぐため、待たずに失敗させる**)」。
- **`runHealthChecks`**: 「**1 つが遅くても全体が止まらない**よう並列 + タイムアウト。**タイムアウトも『異常』として扱う**(応答しないのは落ちているのと同じ)」。
- **`createAlertManager`**: 「**状態を保つ**ので 1 つだけ作る(毎回作ると『発報中かどうか』が分からず鳴り続ける)」。`evaluate` は「**状態が変わったアラートだけ**を返す(発報中ずっと通知すると、ややて誰も見なくなる)」。
- **`generateTraceId` / `buildTraceparent`**: 「**1 リクエストに 1 つ**。ログ・メトリクス・外部呼び出しに付けて回ることで『この障害はどのリクエストで起きたか』を追える」「相手も対応していれば、**システムをまたいで 1 本の流れとして追える**」。
- **`createOtlpExporter`**: 「**送信に失敗してもアプリを止めない**(監視のために本業が止まっては本末転倒)」。

---

## TSDoc: `site`(22)+ `report`(27)を完備

| 項目 | 前 | 後 |
|---|---|---|
| 全体の完備 | 566 | **615(36%)** |
| リファレンスの引数つき | 639 | **688** |

**完備は 17 パッケージ**: core / auth / datetime / utils / accounting / cms / chat / observability / seo / board / **site** / **report** / tax / task / debug / faq / contract。

### site — 「消し忘れ」と「二重管理」を防ぐことを中心に
- **`isActive`**: 「**既定は前方一致**。`/products/123` を開いているとき親の『製品』もハイライトしたいため。トップページのように完全一致で判定したい項目は `exact` を指定する(**前方一致だと `/` は全ページに一致してしまう**)」。
- **`breadcrumbFromPath`**: 「**メニューの構造をそのまま使う**ので、パンくず用に別のデータを持たなくてよい(**2 か所で管理すると必ずズレる**)」。
- **`isBlockVisible`**: 「期間の指定があれば、それも見る。『キャンペーンバナーを 3/1〜3/31 だけ出す』といった予約を、**人手で消さずに済ませる**ため」。
- **`pickBanner`**: 「**乱数を引数で受け取る**ので純関数(テストで結果を固定できる)」。
- **`topAnnouncement`**: 「**複数を同時に出さない**(お知らせが積み重なると誰も読まなくなる)」。
- **`activeAnnouncements`**: 「**閉じたものは除く**(一度閉じたものを再表示すると鬱陶しい)」。
- **`resolveRedirects`**: 「**連鎖したままだと遅く、SEO でも不利**(検索エンジンは何度も辿らない)」「**循環したものは元のまま残す**(消すと 404 になり、原因も分からなくなる)」。
- **`copyrightText`**: 「**年は自動で更新される**(手書きだと年明けに古いままになる)」。

### report — 金額のズレを防ぐことを中心に
- **`multiplyMoney`**: 「**ここでは端数処理しない**。明細ごとに丸めると、**合計が総額と合わなくなる**。丸めるのは最後の 1 回だけ」。
- **`roundMoney`**: 「**帳票は端数処理の方針を統一しないと、明細の合計と総額が 1 円ずれる**」。
- **`expenseTaxBreakdown`**: 「**領収書には税込金額しか書かれていないことが多い**ため、そこから税抜と消費税を割り出す」。
- **`expenseToRow`**: 「**税内訳をここで確定させる**(保存後に計算方法が変わっても、記録は当時のまま残る)」。
- **`calculateInvoice`**: 「**税率別の内訳**(適格請求書に必要な区分記載)」。
- **`printCss` / `wrapForPrint`**: 「**画面用の CSS のままでは紙に収まらない**(余白・改ページ・背景色の扱いが違う)」。
- **`renderQuoteHtml` / `renderDeliveryHtml`**: 「**請求書と同じ構造**なので、ラベルと日付だけ差し替える」と、重複実装ではないことを明示。
- **`sheetToCsv`**: 「**簡易実装**。エスケープが必要な複雑なデータは `@platform/csv` の `toCsv` を使うこと」と、使い分けを明示。

---

## TSDoc: `session`(16)+ `html`(22)を完備 — セキュリティに直結する 2 つ

| 項目 | 前 | 後 |
|---|---|---|
| 全体の完備 | 615 | **653(39%)** |
| リファレンスの引数つき | 687 | **725** |

**完備は 19 パッケージ**。残る `form`(29)/ `zoho`(26)は次回。

### session — 認証の事故を防ぐ
- **`buildSetCookie`**: 「**セッション Cookie には `httpOnly` と `secure` を必ず付ける**。httpOnly が無いと JavaScript から読めてしまい、**XSS でセッションを盗まれる**。secure が無いと平文の HTTP で送信される」。
- **`buildClearCookie`**: 「**設定時と同じ `path` / `domain` を指定すること**。違うと消えず、**ログアウトしたつもりがセッションが残る**」。
- **`createSession`**: 「**値は署名されるが暗号化はされない**(Base64 を解けば中身は読める)。パスワードや個人情報を入れないこと。**サーバ側に持ちたいなら createServerSession**」。
- **`createStepUp`**: 「**ログインから時間が経っていたら、もう一度パスワードを求める**仕組み。**席を離れた隙に他人が操作する事故**を防ぐ。金額の変更・権限の付与など、取り返しのつかない操作の前に使う」。
- **`createLoginThrottle`**: 「**失敗が続いたらしばらく受け付けない**。これが無いと、パスワードを機械的に試され続ける」。
- **`createMemoryAttemptStore`**: 「**複数プロセスでは使えない**(**攻撃者は別のプロセスに当たれば制限を回避できる**)。本番では Redis 実装を注入すること」。
- **`createIdleTimer`**: 「**席を離れたまま放置されたセッションを閉じる**。共用 PC で他人に操作される事故を防ぐ」。
- **`summarizeAuditEvent`**: 「**パスワードやトークンをログに残さない**ため。ログは広く読まれるので、ここで落としておかないと漏洩経路になる」。
- **`sessionMaxAge`**: 「**『ログイン状態を保持する』を選んだ人だけ長くする**。共用 PC で誤って選ばれると危険なので、既定は短い方」。
- **`bindActivityListeners`**: 「**画面を離れるときに必ず呼ぶ**(呼ばないとリークする)」。

### html — XSS の事故を防ぐ
- **`escapeHtml`**: 「**ユーザー入力を HTML に埋め込むときは必ず通す**。React などは既定でエスケープするが、`dangerouslySetInnerHTML` や**文字列連結で HTML を組むときは自前で通す**必要がある」。
- **`escapeAttr`**: 「**属性に入れる値は本文とは別のエスケープが要る**。`"` が閉じられると、そこから新しい属性(`onerror=...`)を差し込まれる」。
- **`unescapeHtml`**: 「**表示直前には使わない**(戻したものを HTML に入れると XSS になる)」。
- **`stripHtml`**: 「**これはサニタイズではない**。安全な HTML を作る用途には使えない」。
- **`nl2br`**: 「**エスケープはしない**。ユーザー入力に使うなら**先に escapeHtml を通す**(**順番を逆にすると `<br>` までエスケープされる**)」。
- **`textToHtml`**: 「**エスケープ → 改行変換の順**」と、正しい順序を実装で保証していることを明示。
- **`linkify`**: 「**`noopener` は必須**。付けないと、リンク先の JavaScript から元のページを操作できる(**タブナビング攻撃**)」。
- **`embedInlineScript` / `embedHtml`**: 「**中身はそのまま出力する**。信頼済みのコードだけを渡すこと」と、危険な関数であることを明示。
- **`stripControlChars`**: 「外部から取り込んだテキストに混ざる(CSV・OCR・古いシステム)。**見えないのに比較が一致しない**、といった原因になる」。

---

## TSDoc: `form`(29)+ `zoho`(26)を完備

| 項目 | 前 | 後 |
|---|---|---|
| 全体の完備 | 653 | **708(42%)** |
| リファレンスの引数つき | 724 | **779** |

**完備は 21 パッケージ**。残るのは **アプリから未使用**の `fs`(32)/ `url`(29)/ `blog`(28)/ `net`(22)と、`social`(26)など。

### form — 利用者の体験を壊さないことを中心に
- **`editAgain`**: 「**保持したデータは残る**。『戻る』で入力が消えるのは、利用者が最も嫌う挙動」。
- **`startSubmitting`**: 「**二重送信の防止に使う**。連打で申請が 2 件登録される事故を防ぐ」。
- **`submitFailed`**: 「**確認画面に留まる**(入力画面まで戻さない)。データは残っているので、原因を直して再送信できる」。
- **`resetSubmitFlow`**: 「**データは引き継がない**(前の申請の内容が残っていると誤送信の元)」。
- **`visibleFields`**: 「**検証の前に通す**。隠れている項目を必須にすると、利用者は『何が足りないのか』分からないまま送信できなくなる」。
- **`stripHiddenValues`**: 「**隠れた項目は送らない**(必須検証も自然に回避できる)」。
- **`reviewItems` / `formatFieldValue`**: 「**確認画面に生の値を出さない**。選択肢は value ではなくラベルを、真偽値は true ではなく『はい』を(利用者は内部の値を知らない)」。
- **`buildZodSchema`**: 「**画面の定義と検証を 1 か所にまとめる**ため。別々に書くと必ずズレる(画面では必須なのに検証が通る、など)」。
- **`formErrors`**: 「『開始日は終了日より前に』のような**項目をまたぐ検証**の結果。項目の横には出せないので、フォームの上部にまとめて出す」。
- **`issuesToFieldErrors`**: 「**同じ項目は最初の 1 件だけ**(全部出すと画面が埋まる)」。

### zoho — DC とトークンの落とし穴を中心に
- **`accountsUrl` / `apiDomain`**: 「**Zoho はデータセンター(DC)ごとに URL が違う**(日本は `.jp`、米国は `.com`)。間違えると認証できない」「**トークン応答の `api_domain` があればそちらを優先**(Zoho 側が正しい DC を教えてくれるため、こちらの推測より確実)」。
- **`exchangeCodeForToken`**: 「**リフレッシュトークンは初回しか返らない**(Zoho の仕様)。取りこぼすと、利用者にもう一度認可させることになる。**必ず保存すること**」。
- **`createZohoTokenManager`**: 「**同時に複数のリクエストが更新を始めないよう単一化する**。これが無いと、10 並列のリクエストが 10 回更新を投げ、**レート制限に当たる**(さらに、古いトークンで上書きし合って壊れることもある)」。
- **`buildAuthorizeUrl`**: 「**`state` は必ず検証すること**(CSRF 対策)」「redirect_uri は **Zoho 側の設定と完全一致**であること」。
- **`refreshAccessToken`(login.ts)**: 「**人の操作を伴わない**のが exchangeCodeForToken との違い」「refresh_token は**環境変数から。コードに直書きしない**」。
- **`createZohoClient`**: 「認証ヘッダは `Zoho-oauthtoken`(**`Bearer` ではない**。Zoho 独自)」。
- **14 サービスのクライアント**: 各サービスの用途(CRM=顧客・案件管理、Books=会計・請求 など)を明記し、「**すべてのメソッドは Result 型を返す**(例外を投げない)」を統一して記載。

### 【発見】check-tsdoc が再エクスポートを実体と誤認していた
`zoho/index.ts` は `export { createZohoCrmClient } from "./crm/index.js"` という**再エクスポートのみ**だが、
ツールがこれを実体と誤認して「14 件不足」と報告していた。実体は各サブディレクトリにあり、そちらに TSDoc を書いて解消。

---

## TSDoc: `theme`(16)+ `inventory`(15)を完備

| 項目 | 前 | 後 |
|---|---|---|
| 全体の完備 | 708 | **739(44%)** |
| リファレンスの引数つき | 778 | **809** |

**完備は 23 パッケージ**。

### theme — 「見えるが読めない画面」を防ぐ
- **`checkThemeContrast`**: 「**テキスト系のペア**が基準を満たすかを見る。ここを外すと、**見えるが読めない画面**ができる(薄いグレーの文字など)」。
- **`checkTheme`**: 「**片方だけ見ても意味がない**。ダークモードで文字が読めなくなるのは、light だけ確認して見落とす典型」。
- **`findContrastIssues`**: 「**人の目視では見落とす**(11 スキン × light/dark で 22 通り)。機械に任せる」。
- **`deriveTheme`**: 「**1 色決めれば全部できる**のが要点。11 個のトークンを手で選ぶと、必ずどこかでコントラストを外す(そして気づかない)」。
- **`themeToCssVars`**: 「**アプリは色を直書きせず、この変数を参照する**ことでテーマ切り替えに追従できる」。
- **`buildThemeStylesheet`**: 「全部を 1 枚の `<style>` に入れておけば、**属性を切り替えるだけで即座に見た目が変わる**(再描画・再取得不要)」。
- **`isValidThemeId`**: 「**ID は `data-skin` 属性と CSS セレクタに入る**ので、記号や空白を許すとセレクタが壊れる(または任意の CSS を注入される)」。
- **`themesToJson`**: 「**`{ version, themes }` の形**にすることで、将来の形式変更に備える」。

### inventory — 帳簿と現物を合わせる
- **`onHand`**: 「**在庫数を直接持たず、履歴から毎回計算する**(イベントソーシング)。『なぜこの数になったのか』を後から追える」「**マイナスもありうる**(データの不整合を隠さない)」。
- **`applyMovement`**: 「**在庫より多く出庫できてしまうと、帳簿と現物が合わなくなる**。追記の時点で弾くことで、後から辻褄合わせをする手間を防ぐ」。
- **`allocateFEFO`**: 「**期限の早いものから出す**のが原則(FIFO = 先入先出 ではなく FEFO)。**入庫順に出すと、後から入った期限の近い在庫が残って廃棄になる**」。
- **`expiringSoon`**: 「**食品・医薬品では廃棄損に直結する**。早めに気づいて値引きや優先出荷を判断する」。
- **`expiredLots`**: 「**出荷してはいけない在庫**。数字上は在庫があっても、売れない」。
- **`reorderPoint`**: 「**発注してから届くまでの間にも在庫は減る**。その分を見込まないと、発注したのに欠品する」。
- **`movingAverage`**: 「**仕入れ値が変動しても、在庫の評価額を一意に決められる**」「履歴は**時系列の順**であること(順序が違うと平均単価がずれる)」。
- **`transfer`**: 「**2 件セットで記録する**ことで、移動中に消えた在庫が無いことを保証できる(出庫だけ記録して入庫を忘れる、という事故を防ぐ)」。

---

## TSDoc: `fs`(32)+ `url`(29)を完備 — 未使用だがセキュリティに直結する 2 つ

**アプリからは未使用**だが、パス操作と URL 検証は**使い始めたときに事故りやすい**ため優先した。

| 項目 | 前 | 後 |
|---|---|---|
| 全体の完備 | 739 | **800(47%)** |
| リファレンスの引数つき | 809 | **870** |

**完備は 25 パッケージ**。残るのは `blog`(28)/ `net`(22)/ `social`(26)など。

### fs — パストラバーサルとファイル破損を防ぐ
- **`isSubPath`**: 「**パストラバーサル対策の要**。利用者が指定したパスを使う前に必ず通す。`../../etc/passwd` のような指定で、**想定外の場所を読み書きされる**のを防ぐ」。
- **`sanitizeFilename`**: 「**利用者が付けた名前をそのままファイル名にしない**。禁止文字、前後の空白・ドット、Windows の予約名(`CON` `PRN`)を処理する。怠ると保存に失敗するか、**意図しない場所に書き込まれる**」。
- **`detectFileType`**: 「**拡張子は偽装できる**(`virus.exe` を `photo.jpg` にリネームできる)。中身を見ることで本当の種別が分かる」。
- **`isAllowedFileType`**: 「**判定できない場合も false**(安全側)」。
- **`matchesExtension`**: 「**判定できない場合は true**(未知の形式を一律に弾かない)」と、安全側の向きが逆であることを明示。
- **`mimeTypeOf`**: 「**これは推定であって検証ではない**。アップロードの検証には detectFileType を使う」。
- **`writeFileAtomic`**: 「**書き込み途中でプロセスが落ちても、ファイルが壊れない**。直接書くと、中途半端な内容のファイルが残る(**設定ファイルなら起動不能になる**)」。
- **`exists`**: 「**存在確認と操作の間に状態が変わりうる**(TOCTOU)。『あれば読む』なら、確認せずに読んでエラーを捕まえる方が確実」。
- **`writeJson`**: 「**既定は 2 スペース整形**(Git の差分が読めるように。1 行 JSON だと差分が全行になる)」。
- **`movePath`**: 「**ドライブをまたぐ場合は rename が失敗する**ので、コピー + 削除に切り替える(呼び出し側は意識しなくてよい)」。
- **`walkDir`**: 「**大きなディレクトリでは時間もメモリも食う**。`node_modules` などを除外する `exclude` を渡すこと」。

### url — オープンリダイレクトと XSS を防ぐ
- **`isValidUrl`**: 「**これだけでは安全ではない**。`javascript:alert(1)` も『妥当な URL』として通る」。
- **`isHttpUrl`**: 「**リンク先に使う前に必ず通す**。`javascript:` や `data:` を許すと、リンクをクリックしただけで任意のコードが実行される」。
- **`isSameOrigin`**: 「**リダイレクト先の検証に使う**。外部サイトへ飛ばす URL を利用者に指定させると、フィッシングに使われる(オープンリダイレクト)」。
- **`isSafeUrl`**: 「**利用者が入力した URL をリンクにする前に必ず通す**(プロフィールの『ホームページ』欄など)」。
- **`isExternalUrl`**: 「**外部リンクには `rel="noopener"` を付ける**判断に使う」。
- **`normalizeHost`**: 「**比較の前に必ず通す**。`Example.COM` と `example.com.` と `example.com:443` はすべて同じホストだが、文字列としては違う」。
- **`getTld`**: 「**多段の TLD にも対応**(`co.jp` を `jp` ではなく `co.jp` として扱う)。間違えると、`example.co.jp` と `other.co.jp` を『同じドメイン』と誤判定する」。
- **`getRegistrableDomain`**: 「**eTLD+1 が『同じ組織か』の単位**。Cookie の共有範囲もこれで決まる」。
- **`pickQueryParams`**: 「**除外リストではなく許可リスト**なのは、**知らないパラメータを残さない**ため」。
- **`urlsEqual`**: 「**文字列比較では別物になる**(`example.com/a?b=1&a=2` と `example.com/a/?a=2&b=1` は同じページ)」。

---

## TSDoc: `blog`(28)+ `social`(26)を完備 — **半数超え(51%)**

| 項目 | 前 | 後 |
|---|---|---|
| 全体の完備 | 800 | **854(51%)** |
| リファレンスの引数つき | 869 | **923** |

**完備は 27 パッケージ**。残るのは `net`(22)/ `cast`(15)/ `ocr`(14)/ `pii`(13)/ `analytics`(12)など。

### blog — 公開の事故と URL の一貫性
- **`isPublished`**: 「**`status` をそのまま信じない**。予約公開は日時を過ぎたら公開扱いにする(DB を書き換えるバッチが動いていなくても、読む側で正しく判定する)」。
- **`buildCommentTree`**: 「**親が見つからないものはトップレベル**(親が非承認で除外された場合など。**親が無いからと捨てると、返信が消えてしまう**)」。
- **`countComments`**: 「**返信も含む**。『コメント 3 件』と出すとき、返信を数えないと実感と合わない」。
- **`buildPermalink` / `matchPermalink`**: 「**同じパターンを使う**ことで、生成と解析がずれない」「URL の形をパターンで決められるので、後から `/2026/07/slug` 形式に変えてもコードを直さなくてよい」。
- **`joinUrl`**: 「**スラッシュの重複・欠落を吸収する**。手で結合すると必ずどこかで間違える」。
- **`slugify` / `slugFrom`**: 「**日本語は残らない**(空文字になる)。日本語タイトルでも URL を作れるよう、fallback を使う」。
- **`seriesNavigation`**: 「**公開日ではなく連載の順番**で決める(後から書いた第 1 話が『次』になっては困る)」。
- **`escapeXml`**: 「**記事タイトルに `&` が入るだけで RSS が壊れる**(リーダーが読めなくなる)」。
- **`extractHeadings`**: 「**コードブロック内の `#` を見出しと誤認しない**(シェルや Python のコメントが目次に並ぶのを防ぐ)」「**同じ見出しが複数あってもアンカーは一意**にする(でないとリンクが最初の 1 つにしか飛ばない)」。
- **`readingTime`**: 「**日本語と英語で読む速さが違う**ので文字種で判定」「**最低 1 分**(『0 分で読めます』とは出さない)」。

### social — 入力のゆれと表示の一貫性
- **`normalizeHandle`**: 「**利用者は色々な形で入力する**(`@name`、`https://x.com/name`、` name `)。保存・比較の前に必ず通す」。
- **`canonicalHandle`**: 「**X / TikTok / Instagram は大文字小文字を区別しない**ので、`@Name` と `@name` は同じアカウント」。
- **`displayHandle`**: 「**TikTok は `@` 付きが正式**(他は付けない)。プラットフォームの慣習に合わせる」。
- **`sortAccounts`**: 「**表示順を固定する**ため(データの入力順に出すと、ページごとに順序が変わって落ち着かない)」。
- **`latestPerPlatform`**: 「**どれか 1 つが大量に投稿しても埋もれない**(単純に新しい順で並べると、投稿頻度の高いプラットフォームだけになる)」。
- **`platformFromHostname`**: 「**旧ドメインにも対応**(`twitter.com` → x)。利用者は古い URL を貼ることがある」。
- **`profileUrl`**: 「**ハンドルが妥当でなければ null**(壊れたリンクを作らない)」。
- **`oembedEndpoint`**: 「**Instagram はトークンが必要なため null**(Graph API 経由にする)」。
- **`accountsFromUrls`**: 「**解釈できない URL は除外**(エラーにせず、分かる分だけ返す)」。

---

## TSDoc: `net`(22)+ `cast`(15)+ `ocr`(14)+ `pii`(13)を完備

| 項目 | 前 | 後 |
|---|---|---|
| 全体の完備 | 854 | **918(54%)** |
| リファレンスの引数つき | 920 | **984** |

**完備は 31 パッケージ**。残るのは `analytics`(12)/ `dencho`(12)/ `freee`(12)/ `image`(12)/ `phone`(12)など。

### net — 分散システムの落とし穴
- **`backoffDelay`**: 「**ジッター(ゆらぎ)を入れる**のが要点。同時に落ちた 100 台が同じ間隔で再試行すると、**復旧した瞬間に再び倒れる**(サンダリングハード)」。
- **`retryWithBackoff`**: 「**再試行してよいエラーか判断すること**。認証エラーを再試行しても無駄で、**かえってアカウントをロックする**」。
- **`isPrivateIp`**: 「**SSRF 対策**。利用者が指定した URL を叩く前に、宛先が内部ネットワークでないことを確認する(`http://192.168.0.1/` を叩かせて内部を探られるのを防ぐ)」。
- **`frameMessage`**: 「**TCP はストリームなので、メッセージの境界が無い**。長さを先に送ることで、受信側が『どこまでが 1 通か』を判断できる」。
- **`encodeLine`**: 「**改行を含むデータには使えない**(境界が壊れる)」と、使い分けを明示。
- **`createUdpSocket`**: 「**UDP は届く保証も順序の保証も無い**。落ちてもよいもの(メトリクス・死活監視)に使う」。
- **`encodeWsFrame`**: 「**クライアント → サーバの送信は必ずマスクする**(RFC 6455)。マスクしないとサーバに切断される。逆に**サーバ → クライアントはマスクしない**」。
- **`pollUntil`**: 「**ポーリングは最後の手段**。webhook やイベントで通知できるなら、そちらが良い」。
- **`formatSseEvent`**: 「**末尾の空行が区切り**。これが無いとクライアントはイベントを受け取れない」。

### cast — 評価の見せ方
- **`weightedRating`**: 「**1 件だけ 5 点の人を 1 位にしない**ための仕組み(ベイズ平均)。『評価が高いのか、たまたま 1 件が良かっただけか』を区別する」。
- **`ratingRanking`**: 「**1 件だけの満点が上位に来る**ので、公開ランキングには向かない」と、あえて残してある理由を明示。
- **`publishedOnly`**: 「**一覧を返す前に必ず通す**。退店した人が公開サイトに残ると問題になる」。

### ocr — 「当たらないことがある」前提
- **`extractReceiptFields`**: 「**抽出は当たらないことがある**(印字が薄い・手書き・レイアウト崩れ)。**必ず人が確認できる画面を用意すること**」。
- **`extractReceiptFieldsWithConfidence`**: 「**確信度**(低いものは人の確認を促す。全部を信じさせない)」。
- **`normalizeOcrText`**: 「**OCR は全角と半角を混ぜて返す**。抽出の前に揃えないと、金額を取りこぼす」。
- **`extractTaxBreakdown`**: 「**書き方が店ごとに違う**ので複数のパターンを試す」。
- **`batchExtract`**: 「**1 枚失敗しても全体を止めない**。100 枚のうち 1 枚が読めないだけで全部やり直しでは使えない」。
- **`createTesseractOcr`**: 「**ローカルで動く**ので外部に画像を送らない(機密文書に向く)。ただし精度はクラウドに劣る」と、選択の判断材料を提示。

### pii — 法令と実務の両立
- **`createFieldCrypto`**: 「**DB が漏れても中身が読めない**。ただし**暗号化した項目では検索できない**(部分一致も範囲検索も不可)。検索が要るならハッシュの列を別に持つなどの設計が要る」。
- **`blindIndex`**: 「**暗号化した項目を検索可能にする**(完全一致のみ)」と、上の制約への対処法を示す。
- **`maskMyNumber`**: 「**マイナンバーは法律で扱いが厳しく、原則ログに残さない**」。
- **`isRetentionExpired`**: 「**過ぎたデータは消す義務がある**。持ち続けると法令違反」。
- **`recordsToErase`**: 「**法令で保持が必要なものは除く**(会計帳簿は 7 年保存が義務。**全部消すと別の違反になる**)」。
- **`buildDisclosureReport`**: 「本人から『自分のデータを全部出して』と求められたときに使う(GDPR・改正個人情報保護法)。**機械可読な形式で渡す**のが要件」。
- **`buildErasureReceipt`**: 「**『消しました』と言うだけでは足りない**。いつ・何を・どの範囲で消したかを記録しておかないと、後から問われたときに答えられない」。

---

## TSDoc: `analytics`(12)+ `dencho`(12)+ `freee`(12)を完備

| 項目 | 前 | 後 |
|---|---|---|
| 全体の完備 | 918 | **954(56%)** |
| リファレンスの引数つき | 979 | **1,015** |

**完備は 34 パッケージ**。残るのは `image`(12)/ `phone`(12)/ `audit`(11)/ `color`(11)/ `status-page`(11)/ `rag`(10)/ `bluetooth`(9)/ `payroll`(9)。

### analytics — 数字の意味を取り違えない
- **`uniqueVisitors`**: 「**同じ人が別の日に来れば別カウント**(セッションが変わるため)。『何人が来たか』ではなく『何回の訪問があったか』に近い」。
- **`uniqueUsers`**: 「**こちらは本当の『人数』**(userId で数えるため、別の日でも同じ人は 1)」と、混同しやすい 2 つを対比。
- **`createBeacon`**: 「**個人を特定する情報を入れないこと**。パスにユーザー ID や検索語が入ると、意図せず個人情報を計測基盤に送ることになる」。
- **`topPages`**: 「同数ならパスの昇順で**安定させる**」(実行のたびに順序が変わらないように)。

### dencho — 法令要件を機械的に確認する
- **`hashRecord`**: 「**電子帳簿保存法の『改ざん防止』要件**を満たすための仕組み。途中のレコードを書き換えると、**それ以降のハッシュがすべて合わなくなる**ので検出できる」。
- **`stableStringify`**: 「**同じ内容なら必ず同じ文字列**になる。キーの順序が変わるだけでハッシュが変わっては困る」。
- **`checkSearchRequirements`**: 「法令が求めるのは 3 つ: **取引年月日・取引金額・取引先**で検索できること、**日付と金額は範囲指定**、**2 つ以上の組み合わせ**。**税務調査で問われる**ので機械的に確認する」。
- **`isWithinRetention`**: 「**法人税法では原則 7 年、欠損金がある事業年度は 10 年**。期間内のデータを消すと法令違反」。
- **`createTimestampToken`**: 「**これは認定タイムスタンプではない**。電帳法が求めるのは認定事業者(アマノ・セイコー等)の発行。これは内部の改ざん検知用で、**法令要件を満たすには外部サービスとの連携が要る**」と、限界を明示。

### freee — API の癖と検証の位置
- **`createFreeeTokenManager`**: 「**freee のリフレッシュトークンは 1 回しか使えない**(使うたびに新しいものが返る)。取りこぼすと再認可が必要になるので、**必ず `onRefresh` で保存すること**」。
- **`createAuthedFetch`**: 「**401 が返ったら 1 度だけ更新して再試行**(何度も繰り返すと、認証が壊れているときに無限ループになる)」。
- **`buildDeal`**: 「**明細の合計が総額と一致するか検証する**。ずれたまま送ると freee 側でエラーになるが、**原因が分かりにくい**。手元で弾く方が親切」。
- **`buildJournalBody`**: 「**借方合計 = 貸方合計 を検証する**。一致しない仕訳を送ると、拒否されるか、**最悪そのまま登録されて帳簿が壊れる**」。
- **`verifyFreeeSignature`**: 「**必ず検証すること**(しないと誰でも偽の通知を送れる)」。
- **`fetchAllPages`**: 「**件数が多いと時間もメモリも食う**(freee は 1 ページ 100 件が上限)」。

---

## TSDoc: `image`(12)+ `phone`(12)+ `audit`(11)を完備

| 項目 | 前 | 後 |
|---|---|---|
| 全体の完備 | 954 | **989(58%)** |
| リファレンスの引数つき | 1,009 | **1,044** |

**完備は 37 パッケージ**。残るのは `color`(11)/ `status-page`(11)/ `rag`(10)/ `bluetooth`(9)/ `payroll`(9)/ `ai`(8)。

### image — 重い処理と外部サービス
- **`mapWithConcurrency`**: 「**画像処理は重い**(1 枚数秒)。100 枚を無言で待たせず、進捗を見せる。**並列数を制限する**のも重要(無制限だとメモリを食い尽くす)」。
- **`clampRect`**: 「**範囲外を指定すると sharp が例外を投げる**。利用者が画面でドラッグした値は端をはみ出すことがあるので、処理の前に通す」。
- **`buildWatermarkSvg`**: 「**SVG にするのは、フォントの用意なしに文字を描ける**ため(sharp のテキスト描画は環境依存のフォントが要る)」。
- **`createRemoveBgProvider`**: 「**有料 API**(1 枚ごとに課金)。大量処理の前に料金を確認すること」。
- **`createImageProcessor`**: 「**依存を注入する**ので、テストでモックできる」「**すべてのメソッドは Result 型を返す**(壊れた画像で例外を投げない)」。

### phone — 番号が届かない事故を防ぐ
- **`toE164`**: 「**SMS や国際電話の API は E.164 を求める**。国内表記のまま渡すと届かない」。
- **`buildE164`**: 「**先頭の 0 は自動で除去**する(日本の `090-...` は E.164 では `+8190-...`)。**ここを間違えると番号が届かない**」。
- **`internationalPhoneType`**: 「**国によっては携帯と固定を番号から区別できない**(米国など。番号ポータビリティで携帯番号を固定電話に移せる)。**『不明』を返すのは正直な設計**」。
- **`formatJpPhone`**: 「**不正なら元の入力をそのまま返す**(勝手に壊さない)」。
- **`normalizePhone`**: 「**保存・比較の前に必ず通す**。利用者はハイフン有無・全角・括弧など様々な形で入力する」。

### audit — 改ざんを検知し、調査を助ける
- **`verifyAuditChain`**: 「**値の書き換え・削除・並べ替えのすべてを検知できる**(各レコードが前のハッシュを含むため)」「**定期的に実行すること**。改ざんは早く見つけるほど被害が小さい」。
- **`historyOf`**: 「**『この申請は誰がいつ何をしたか』を追う**のに使う(調査の基本)」「**古い順**(経緯を追うため)」。
- **`summarizeEvent`**: 「**監査ログは人が読むもの**(機械が読むだけなら JSON でよい)。調査のときに一覧をざっと見て、怪しいものを見つけられる形にする」。
- **`diffChanges`**: 「**パスワードなどを監査ログに残さない**(mask)」「**変わっていないものは含まない**」。
- **`deepDiffChanges`**: 「**どこが変わったかを正確に記録する**ため。オブジェクト全体を before/after で残すと、監査ログが肥大化し、差分も読めない」。
- **`byAction`**: 「**前方一致**。`expense.` で経費関連すべてを拾える」。

---

## TSDoc: `color`(11)+ `status-page`(11)+ `rag`(10)を完備 — **60% 到達**

| 項目 | 前 | 後 |
|---|---|---|
| 全体の完備 | 989 | **1,021(60%)** |
| リファレンスの引数つき | 1,044 | **1,076** |

**完備は 40 パッケージ**。残るのは `bluetooth`(9)/ `payroll`(9)/ `ai`(8)/ `currency`(8)/ `depreciation`(8)/ `mcp`(8)。

### color — 「見えるが読めない」を防ぐ
- **`relativeLuminance`**: 「**単純な明るさではない**。人の目は緑に敏感なので、RGB に重み付けする(緑 0.7152・赤 0.2126・青 0.0722)」。
- **`contrastRatio`**: 「**AA 基準は 4.5:1**(本文)、**AAA は 7:1**。大きな文字なら 3:1 でよい。これを下回ると『見えるが読めない』画面になる」。
- **`readableTextColor`**: 「**コントラスト比で判定する**ので、明度だけで決めるより確実。ブランド色を背景にしたボタンの文字色を自動で決める」。
- **`lighten` / `darken`**: 「**色相と彩度は保つ**ので、ブランド色の系統を崩さずに派生色を作れる」。
- **`mix`**: 「weight は **b 側の比率**」と、引数の向きを明示(逆に覚えやすい)。

### status-page — 障害時に確実に出す
- **`renderStatusPage`**: 「**外部依存なし**(CSS もインライン)。**障害時に CDN が死んでいても表示できる**」。
- **`renderErrorPage`**: 「**参照 ID を出す**と、問い合わせを受けたときにログと突合できる(『エラーが出ました』だけでは調べようがない)」。
- **`renderMaintenancePage`**: 「**復旧予定を書く**(『しばらくお待ちください』だけでは、利用者は何度もリロードする)」。
- **`createMaintenanceGate`**: 「**設定は都度評価する**。起動時に固定すると、DB でフラグを立てても**再起動するまで反映されない**」。
- **`createCachedConfig`**: 「**DB を毎回叩かない**(全リクエストで読むと負荷)が、TTL のぶん反映が遅れる(**緊急停止には向かない**)」と、トレードオフを明示。
- **`buildMaintenanceConfig`**: 「**メンテナンス中でも管理者は入れる**必要がある(復旧作業のため)」。
- **`createMemoryMaintenanceStore`**: 「**本番では DB 実装を使うこと**(メモリだとサーバごとに状態が違い、**一部のサーバだけメンテナンス中**になる)」。

### rag — 権限の継承と精度
- **`satisfiesAcl`**: 「**元の文書の権限を検索結果にも引き継ぐ**のが要点。これが無いと、**『見えないはずの文書の内容が、AI の回答に出てくる』という事故**になる」。
- **`buildContext`**: 「**引用元を必ず付ける**。AI の回答に根拠を示せないと、利用者は検証できない(そして **AI は自信満々に間違える**)」。
- **`chunkDocument` / `splitTextToDocuments`**: 「**検索の精度は塊の大きさで決まる**。大きすぎると関係ない部分まで文脈に入る」「重なりは**文脈が切れるのを防ぐ**」。
- **`createMemoryVectorIndex`**: 「**総当たりで計算する**ので、件数が増えると遅い(数千件が限界)。本番では pgvector・Qdrant などを使う」。

---

## TSDoc: `payroll`(9)+ `currency`(8)+ `depreciation`(8)+ `ai`(8)を完備

| 項目 | 前 | 後 |
|---|---|---|
| 全体の完備 | 1,021 | **1,054(62%)** |
| リファレンスの引数つき | 1,076 | **1,107** |

**完備は 44 パッケージ**。残るのは `bluetooth`(9)/ `mcp`(8)/ `ekyc`(7)/ `elearning`(7)/ `loadtest`(7)など。

### payroll — 未払い賃金を出さない
- **`calcPremium`**: 「**労基法の割増率**: 時間外 25%(月 60 時間超は 50%)、深夜 25%、休日 35%。**重複する場合は加算**(深夜の時間外は 50%)。**率を間違えると未払い賃金になり、遡って請求される**」。
- **`parseTimeToMinutes`**: 「**深夜勤務は 24 時を超える**(`26:00` = 翌 2:00)ので、Date ではなく分で扱う」。
- **`nightMinutes`**: 「深夜は **22:00〜翌 5:00**」と、法定の時間帯を明記。
- **`splitDailyWork`**: 「**重複して数える**。深夜の時間外は両方に計上され、割増も加算される」。

### currency — 通貨の桁と向き
- **`currencyInfo`**: 「**小数桁は通貨で違う**(円は 0、ドルは 2、ディナールは 3)。一律に 2 桁で扱うと、**円で『100.00 円』と出たり、ディナールで桁が落ちる**」。
- **`convert`**: 「**`rate` の向きに注意**(「1 from = rate to」)。**逆に取ると桁が大きく狂う**」。
- **`addMoney`**: 「**通貨が違えばエラー**(異なる通貨は足せない。レート換算してから足す)」。
- **`totalInBaseCurrency`**: 「**レートが無い通貨があれば除外せずエラー**(黙って計算から漏らさない)」。

### depreciation — 税法の規定を実装に落とす
- **`decliningBalanceSchedule`**: 「**途中で定額法に切り替わる**のが要点。定率法は年々償却額が減るため、そのままでは耐用年数内に償却しきれない。**償却保証額を下回ったら定額**に切り替える(税法の規定)」。
- **`straightLineSchedule`**: 「**最終年度は 1 円を残す**(備忘価額)。0 にすると帳簿から消えてしまい、**まだ使っている資産を管理できなくなる**」。
- **`decliningBalanceRate`**: 「**取得時期で率が変わる**(平成 24 年 4 月以降は 200% 定率法、それ以前は 250%)ので、古い資産には使えない」。
- **`monthlyAmount`**: 「**期中に取得した資産は月割り**」。

### ai — Gateway を通す理由
- **`createAiGateway`**: 「**アプリは各社の SDK を直接使わない**(ADR 0010)。ここを通すことで **モデルを差し替えられる** / **コストを追跡できる** / **上限を設けられる**(暴走を止める)」。
- **`createOpenAiProvider`**: 「**`chat/completions` を使う**(`responses` API より互換性が広く、**OpenAI 互換を謳う他社サービスでもそのまま動く**)」。
- **`createHashEmbedder`**: 「**意味を捉えない**(ハッシュを並べるだけ)ので本番の検索には使えない。**API キー無しで動く**ので開発・テスト用」と、用途の限界を明示。
- **`createAiImageGateway`**: 「画像生成は 1 枚あたりの単価が高いので、**コストの追跡がより重要**」。
- **`createMemoryAiLogStore`**: 「**本番では DB 実装を使うこと**(コストの追跡は経理に関わるので、消えては困る)」。

---

## TSDoc: 残り 13 パッケージを完備 — **67%**

`bluetooth`(9)/ `mcp`(8)/ `ekyc`(7)/ `elearning`(7)/ `loadtest`(7)/ `apikey`(6)/ `flags`(6)/ `print`(6)/ `purchase`(6)/ `quote`(6)/ `fsm`(5)/ `zengin`(5)/ `i18n`(4)。

| 項目 | 前 | 後 |
|---|---|---|
| 全体の完備 | 1,054 | **1,136(67%)** |
| リファレンスの引数つき | 1,107 | **1,189** |

**完備は 57 パッケージ**。

### 書いた内容 — 各分野の「知らないと事故る」こと
- **`isBluetoothAvailable`**: 「**対応が限られる**(Chrome 系のみ)。**HTTPS が必須**で、**利用者の操作から呼ばないと拒否される**。非対応なら代替手段(手入力)を案内すること」。
- **`readUint16`**: 「**BLE の多くはリトルエンディアン**。間違えると値が全く違うものになる(256 倍ずれる)」。
- **`createErrorResult`(MCP)**: 「**ツールの実行エラーは JSON-RPC のエラーにしない**のが MCP の流儀。`isError` で返すことで、**AI が『エラーが起きた』と理解して次の手を考えられる**」。
- **`isVerified`(eKYC)**: 「**`isFinal` とは違う**(却下も『確定』だが『成立』ではない)」。
- **`verifyEkycSignature`**: 「**必ず検証すること**(本人確認の結果を偽装されると、**なりすましを許す**)」。
- **`moduleProgress`(eラーニング)**: 「**章ごとに見せる**ことで『あと 1 つで終わる』が分かり、**離脱を防げる**」。
- **`issueCertificate`**: 「**修了していない人には発行しない**。研修の受講記録は**監査や資格要件の証跡**になるため、未修了で出すと意味を失う」。
- **`activeWorkers`(負荷試験)**: 「**一気に負荷をかけない**。徐々に増やして、どこで壊れるかを見る」。
- **`generateApiKey`**: 「**平文は発行時にしか返らない**。紛失したら再発行しかない。**画面で『今だけ表示』と明示すること**」。
- **`verifyApiKey`**: 「**タイミング攻撃対策**(比較にかかる時間で正解の桁数を推測されないよう定数時間で比較)。素朴な `===` では漏れる」。
- **`authenticateApiKey`**: 「無効・失効・期限切れなら null。**理由は返さない**(攻撃者に情報を与えない)」。
- **`bucketOf`(Feature Flag)**: 「**同じ利用者は常に同じバケット**。乱数では毎回変わり、**A/B テストで『昨日は A、今日は B』となって結果が濁る**」。
- **`overReceived`(発注)**: 「**発注より多く届くのは異常**(誤配送・入力ミス)。検収の前に気づく必要がある(受け入れると請求と合わなくなる)」。
- **`quoteStatus`**: 「**明示的な状態を優先**(承認済みは期限が過ぎても『期限切れ』と表示しない。**『承認したのに期限切れ』では意味が通らない**)」。
- **`convertToInvoice`**: 「**明細をそのまま引き継ぐ**ので転記ミスが起きない」「**承認されていない見積**は変換できない」。
- **`availableEvents`(FSM)**: 「**画面のボタンを出し分ける**のに使う(できない操作のボタンを出さない)」。
- **`toZenginKana`**: 「**全銀システムは半角カナしか受け付けない**(1973 年制定の規格が今も現役)」。
- **`buildDataRecord`**: 「**桁が違うと振込が失敗し、組戻し手数料がかかる**」。
- **`buildTrailerRecord`**: 「**件数と合計金額を書く**。銀行側で突合するので、合わないと**ファイル全体が拒否される**」。
- **`createTranslator`**: 「**キーが無ければキーをそのまま返す**(空文字にすると、画面が壊れて原因も分からない)」。
- **`prefixCatalog`**: 「**ドメインが違えば同じ言葉でも訳が違う**(『申請』が経費と勤怠で別の英語になる)」。

---

## TSDoc: 小規模 11 パッケージを完備 — **69%・完備 68 パッケージ**

`os-notify`(4)/ `realtime`(4)/ `secrets`(4)/ `hid`(3)/ `importer`(3)/ `sequence`(3)/ `webhook`(3)/ `saga`(2)/ `units`(2)/ `paypal`(1)/ `rpa`(1)。

| 項目 | 前 | 後 |
|---|---|---|
| 全体の完備 | 1,136 | **1,166(69%)** |
| リファレンスの引数つき | 1,189 | **1,219** |

**残るのは大規模パッケージのみ**: `ui`(204)/ `commerce`(57)/ `booking`(33)/ `invoice`(23)/ `notify`(22)など。

### 書いた内容
- **`createSequencer`**: 「**請求書番号・受付番号など、飛び番のない連番**を作る。採番の状態はストアが持つので、**複数プロセスでも重複しない**」。
- **`createMemorySequenceStore`**: 「**複数プロセスでは番号が重複する**。本番では DB か Redis に差し替えること。**請求書番号が重複すると、会計上の問題になる**」。
- **`periodToken`**: 「**『年度で連番をリセットする』を実現する**ための鍵」。
- **`verifyWebhookSignature`**: 「**パースする前の生の文字列**を渡すこと(整形すると署名が合わない)」「**タイミング安全な比較**を使う」。
- **`runSaga`**: 「**Saga パターン**: 複数のサービスにまたがる処理を、DB のトランザクションなしで整合させる方法。**途中で失敗したら、成功済みのステップを逆順で補償する**(取り消せない副作用があるなら Saga には向かない)」。
- **`convertTemperature`**: 「**温度は他の単位と違い、0 が原点ではない**(摂氏 0 度 = 華氏 32 度)。単純な倍率では換算できない」。
- **`convertAndRound`**: 「**計算の途中では丸めないこと**(誤差が積み重なる)。表示の直前だけに使う」。
- **`createBroadcastHub`**: 「**Redis Pub/Sub を挟むので、複数サーバに分かれていても届く**」「チャンネル接頭辞は**環境ごとに分ける**(開発の通知が本番に飛ばないように)」。
- **`reconnectDelay`**: 「**切断のたびに即座に再接続すると、サーバ復旧の妨げになる**(全クライアントが一斉に殺到する)」。
- **`createEnvProvider`(secrets)**: 「**プロセスの環境変数は他のプロセスから見える**(`ps e` など)。機密度が高いなら Secrets Manager を使う」。
- **`createChainProvider`**: 「**先に見つかったものを使う**(env → Secrets Manager の順で探す構成に)」。
- **`rowsToObjects`(importer)**: 「列数が違う行は空文字で埋める(**行ごと捨てない**。取り込みで 1 行の欠損が全体の失敗になると使いにくい)」。
- **`runImport`**: 「**部分的な成功を許す**(全件やり直しは現実的でない)」。
- **`createOsNotifier`**: 「**開発者の手元向け**(サーバでは意味がない。利用者に届けるなら `@platform/notify`)」。
- **`isHidAvailable` / `isBluetoothAvailable`**: 「**Chrome 系のみ・HTTPS 必須・利用者の操作から呼ぶ**」と、同じ制約を持つ Web API で統一した記述に。

---

## TSDoc: `@platform/ui` に着手 — `schedule.ts`(15)+ `log.ts`(14)

**ui は 204 関数と最大**(全体の 12%)。`lib/`(純ロジック)と `components/`(React)が混在するので、
**まず lib/ から**着手した(書き方が他のパッケージと同じで済むため)。

| 項目 | 前 | 後 |
|---|---|---|
| 全体の完備 | 1,166 | **1,195(71%)** |
| ui の不足 | 201 | **172** |

### schedule.ts — カレンダー表示の落とし穴
- **`occursOn`**: 「**複数日にまたがるイベントに対応**(3 日間の出張は、その 3 日すべてに掛かる)。開始日だけで判定すると、**途中の日にイベントが表示されない**」。
- **`eventsOnDay`**: 「**終日イベントを先に出す**(『今日は祝日』は時刻に関係なく先に知りたい)」。
- **`layoutDayEvents`**: 「**重なるイベントを横に並べる**(Google カレンダーの日表示と同じ)」「**CSS でそのまま配置できる形**」。
- **`buildMonthGrid`**: 「**前後の月の日も含める**(月の初日が水曜なら、日〜火は前月の日で埋める)。これが無いと**カレンダーの升目が崩れる**」「**必要な週数だけ**(常に 6 週返すと空行が出る)」。
- **`mergeIntervals`**: 「**隣接する区間もまとめる**(10:00–11:00 と 11:00–12:00 は 10:00–12:00 に)。空き時間の計算で、**1 分の隙間を『空き』と誤認しない**ため」。
- **`computeFreeSlots`**: 「**営業時間で区切る**(深夜の空きを出しても意味がない)」。
- **`findAvailableSlots`**: 「**指定の長さに満たない隙間は除く**(5 分の空きを『予約できます』と出さない)」。
- **`layoutResourceDay`**: 「**会議室 A の予定が会議室 B の列を押し出さない**よう、リソースごとに独立して計算する」。
- **`nowOffset`**: 「**『今』の横線を引く**のに使う(予定表で現在時刻が一目で分かる)」。

### log.ts — 障害調査を助ける
- **`detectLevel`**: 「**先頭寄りの大文字トークンを優先**(本文に『ERROR』が含まれていても、行頭の `INFO` を採用する)」。
- **`parseLogLines`**: 「**元の順序と原インデックスを保つ**(絞り込んでも元の行に戻れる)」。
- **`extractTimestamp`**: 「**複数の形式に対応**(ISO 8601・`[2026-07-15 10:00:00]`・syslog)。ログの形式は出力元によってばらばら」。
- **`bucketByTime`**: 「**エラーがいつ集中したかが分かる**(件数だけでは『いつ』が見えない)」。
- **`relativeTime`**: 「**『10:23:45』より『3分前』の方が状況が分かる**(障害対応中は特に)」。
- **`parseStructured`**: 「**構造化ログはフィールドで絞り込める**(`userId=123` の行だけ見る)。生のテキストログでは grep しかできない」。
- **`facetCounts`**: 「**『どの API がエラーを出しているか』を絞り込む前に見せる**(選択肢に件数が付いていると、どこを見るべきか分かる)」。
- **`filterByFacets`**: 「**キー間は AND、値内は OR**。これがログ検索の直感に合う(『エラーか警告で、かつ API のもの』)」。
- **`appendToBuffer`**: 「**末尾 max 件に丸める**(ログは無限に流れてくるので、上限が無いとメモリを食い尽くす)」。

---

## TSDoc: `ui/lib` を継続 — **73%**

`import-validate.ts`(10)+ `image.ts`(11)+ `table.ts`(9)+ `grid.ts`(9)。

| 項目 | 前 | 後 |
|---|---|---|
| 全体の完備 | 1,195 | **1,229(73%)** |
| ui の不足 | 172 | **138** |

### import-validate — 「1 行の不備で全体を止めない」
- **`validateImportRows`**: 「**セル単位でエラーを返す**(行単位だと『この行のどこが悪いか』が分からず、利用者は全部見直すことになる)」。
- **`cellErrorLookup`**: 「**エラーをセルの位置に表示する**ため。一覧の下にまとめて出すより、該当セルを赤くする方が直せる」。
- **`errorRowsWithIndex`**: 「**元インデックスを付ける**(『3 行目を直して』と伝えるため。抽出後の番号では通じない)」。
- **`validRows` / `partitionRows`**: 「**1 行の不備で全体を止めない**(100 件中 1 件が悪いだけで全部やり直しは現実的でない)」。
- **`canRollback`**: 「**二重に取り消すと、別の取り込みで入れたデータまで消える**」。

### image — ブラウザ内で完結する画像処理
- **`resizeImage`**: 「**ブラウザ内で完結**。サーバに送らないので**機密画像も扱える**」。
- **`pixelate`**: 「**個人情報を隠す用途では元画像を破棄すること**(モザイクは復元されないが、**元が残っていれば意味がない**)」。
- **`convertFormat`**: 「**webp は容量が小さい**が、古いブラウザでは表示できない」と、選択の判断材料を提示。
- **`removeBackgroundColor`**: 「**0 だと厳密一致**。JPEG は圧縮でわずかに色がずれるので少し許容する」。

### table / grid — 大量データと Excel 連携
- **`applyTableOptions`**: 「**順序が重要**(検索 → ソート → ページング)。ページングを先にすると『1 ページ目の中だけ検索』になってしまう」。
- **`isAllSelected` / `toggleAll`**: 「**表示中の行だけを見る**(絞り込み中は、絞り込んだ分だけ。**見えていない行を勝手に選ばない**)」。
- **`isPartiallySelected`**: 「**`indeterminate` を出すため**。全選択でも未選択でもない状態を、チェックボックスの見た目で伝える」。
- **`normalizeRange`**: 「**逆方向のドラッグに対応**(右下から左上へ選んでも正しい範囲になる)」。
- **`rangeToTsv` / `parseTsv`**: 「**Excel に貼り付けられる**(Excel はタブ区切りをセルの区切りとして解釈する)。**CSV だと値にカンマが含まれるときに崩れる**」。
- **`virtualRowRange`**: 「**1 万行を全部 DOM に置くと固まる**ので、見えている分だけ描く。上下にパディングを入れてスクロールバーの長さを保つ」「overscan は**スクロール時のちらつきを防ぐ**」。
- **`resizeColumn`**: 「最小幅**以下にしない**(0 にすると列が消えて戻せなくなる)」。

---

## TSDoc: `ui/lib` を継続 — **75%**・ui は残り 100

`motion-tween`(8)+ `column-presets`(7)+ `shortcut`(6)+ `recipients`(6)+ `motion-extra`(6)+ `theme`(5)+ `notifications`(5)+ `nav`(5)。

| 項目 | 前 | 後 |
|---|---|---|
| 全体の完備 | 1,229 | **1,267(75%)** |
| ui の不足 | 138 | **100** |

### 書いた内容 — UI の「なぜそうするか」
- **`applyEasing`**: 「**等速(linear)は機械的に見える**。実物の動きは加速・減速するので、イージングを入れると自然に感じられる」。
- **`mixColors`**: 「**RGB の線形補間**なので、彩度の高い色同士だと途中が濁ることがある(厳密には HSL や Lab の方が綺麗だが、実用上は十分)」と、限界を明示。
- **`isSpringSettled`**: 「**位置だけでなく速度も見る**。目標を通過する瞬間は位置が一致するが、**まだ動いている**(そこで止めると不自然に見える)」。
- **`parseShortcut`**: 「**`mod` は Mac なら ⌘、他なら Ctrl**。これを使うと、OS ごとに書き分けなくてよい」。
- **`formatShortcut`**: 「**Mac は記号(⌘⇧K)、他は語(Ctrl+Shift+K)**。OS の慣習に合わせないと、利用者は**自分のキーボードのどれを押すか分からない**」。
- **`resolveTheme`**: 「**`system` を選んだ人は OS に追従する**」。
- **`cycleThemePreference`**: 「**`system` を選べることが重要**(OS に合わせたい人が多い)」。
- **`groupNotifications`**: 「**日付そのものより『いつ頃か』が分かる方が役に立つ**(通知は鮮度が重要)」。
- **`findActiveItem`**: 「**最も具体的な一致を優先**(`/settings` と `/settings/users` が両方一致するなら後者)。そうしないと、**常に親だけがハイライトされる**」。
- **`hasActiveChild`**: 「**親メニューを開いた状態にする**のに使う(現在地の項目が畳まれていると、利用者は自分がどこにいるか分からない)」。
- **`isValidEmail`(recipients)**: 「**完全な検証はできない**(RFC 5322 は複雑すぎる)。**送ってみるまで届くか分からない**ので、明らかな誤りだけを弾く」。
- **`validRecipients`**: 「**送信の前に通す**(形式が不正なアドレスに送ると、バウンスして**送信者の評判が落ちる**)」。
- **`splitPresets`**: 「**共有プリセットは全員に見える**ので、誤って個人の設定を共有しないよう画面で明確に分ける」。
- **`createFetchPresetStore`**: 「**端末をまたいで設定を持ち回れる**(localStorage だと別の PC では使えない)」。

---

## TSDoc: `ui/lib` を継続 — **77%**・ui は残り 70

`chart-math`(7)+ `dashboard`(5)+ `tree`(4)+ `ocr-feedback`(4)+ `motion`(4)+ `layout`(4)+ `confidence`(4)+ `command`(4)。

| 項目 | 前 | 後 |
|---|---|---|
| 全体の完備 | 1,267 | **1,297(77%)** |
| ui の不足 | 100 | **70** |

### グラフ・ダッシュボード — 数字の見せ方
- **`funnelStages`**: 「**遷移率(前の段から何%進んだか)を出す**のが要点。全体比だけでは『どこで落ちているか』が分からない(訪問 1000 → 登録 100 → 購入 90 なら、**問題は登録であって購入ではない**)」。
- **`normalizeRows`**: 「**構成比の推移を見る**のに使う(実数だと全体の増減に紛れて、割合の変化が見えない)」。
- **`histogramBins`**: 「**最後のビンだけ上端を含む**。でないと最大値がどこにも入らない」。
- **`waterfallBars`**: 「**『前期からどう変わって今期になったか』を見せる**(売上 100 → +30 → -10 → 120)」。
- **`polarToCartesian`**: 「**0° は真上・時計回り**(数学の慣習とは違う)。円グラフは 12 時から時計回りに描くのが一般的」。
- **`ringDashOffset`**: 「**円周を破線として扱い、見せる長さを変える**のが定石(SVG で弧を描くより簡単)」。
- **`relativeTimeJa`**: 「**古くなったら日付に切り替える**(『300日前』より『2025-09-18』の方が分かる)」。
- **`achievementRate`**: 「**目標が 0 以下なら 0**(『目標なし』を 100% にしない)」。

### AI の確信度 — 「自信満々に間違える」を見つける
- **`summarizeFeedback`**: 「**修正率が高い項目 = AI が苦手な項目**。確信度が高いのに修正率も高いなら、**AI が自信満々に間違えている**(最も危険な状態)」。
- **`diffExtraction`**: 「**人が直したところが、AI の弱点**。これを集めることで改善点が分かる」。
- **`classifyConfidence`**: 「**未指定は low**(『分からない』を『高い』と扱わない。安全側)」。
- **`resolveThresholds`**: 「**用途で基準が違う**(請求書は厳しく、メモは緩く)」。
- **`createFeedbackStore`**: 「**送信の失敗で業務を止めない**(フィードバックは改善のためのもので、本来の処理より優先度が低い)」。

### 操作性
- **`ancestorPath`(tree)**: 「**検索結果を選んだとき、その親をすべて開く**(深い階層のノードが、畳まれたまま『選択中』では意味がない)」。
- **`nextIndex`(command)**: 「**循環する**(末尾で下を押すと先頭に戻る)。コマンドパレットでは、端で止まるより循環する方が速く辿り着ける」。
- **`groupCommands`**: 「**順序は初出順**(定義した順に出る)。アルファベット順にすると、**よく使うものが埋もれる**」。
- **`revealStyles`(motion)**: 「**CSS の transition に任せる**ので、JS でフレームを回さない(軽い)」。

---

## TSDoc: `@platform/ui`(204 関数)を完備 — **81%**

**最大のパッケージ**(全体の 12%)を完了。`lib/`(純ロジック)と `components/`(フック・チャート)の両方。

| 項目 | 前 | 後 |
|---|---|---|
| 全体の完備 | 1,297 | **1,367(81%)** |
| ui の不足 | 70 | **0(完備)** |
| リファレンスの引数つき | 1,326 | **1,381** |

### React フック — 環境の制約を明示
- **`useBluetooth` / `useHid`**: 「**非対応の環境では available: false**(使う前に確認して代替を案内する)」。
- **`useClientInfo`**: 「**SSR では undefined**(サーバには画面が無い)」。
- **`useSpeechRecognition`**: 「**Chrome 系のみ・HTTPS 必須**」。
- **`useLiveSeries` / `useLogStream` / `useMediaRecorder`**: 「**上限が無いとメモリを食い尽くす**」と、上限の必要性を統一して記載。
- **`usePolling`**: 「間隔を**短くしすぎない**(サーバの負荷になる)」。
- **`useSpring`**: 「tween と違い、**途中で目標が変わっても自然に繋がる**」と、使い分けを明示。
- **`useUpload`**: 「上限は**サーバ側でも検証すること**(ブラウザの検証は迂回できる)」。

### 画面の細部 — 「なぜそうするか」
- **`themeInitScript`**: 「**`<head>` で同期実行する**(でないと、**一瞬明るい画面が出てから暗くなる** = FOUC)」。
- **`flipTransform`**: 「**位置の変化を打ち消す transform を当ててから外す**ことで、レイアウトの変化を滑らかに見せる(直接アニメーションさせるより速い)」。
- **`staggerDelays`**: 「**順に少しずつずらす**(同時に動くと機械的に見える)」。
- **`parallaxOffset`**: 「**背景をゆっくり動かす**と奥行きが出る」。
- **`filterNavByPermission`**: 「**見えないページへのリンクを出さない**(押しても 403 では不親切)」。
- **`socialLoginLabel`**: 「**各社のブランド表記に合わせる**(『Googleでログイン』は規約で表記が決まっている)」。
- **`highlightSegments`**: 「**HTML を組み立てずに返す**ので、エスケープ漏れによる XSS を避けられる」。
- **`copyToClipboard`**: 「**HTTPS でないと失敗する**(Clipboard API の制約)」。
- **`displayToNaturalRect`**: 「**縮小表示で切り抜くとき、そのままの座標では合わない**」。
- **`needsReview`(field-review)**: 「**確信度が低いものだけ**(全部を確認させると意味がない)」。
- **`applyColumnPrefs`**: 「**設定に無い列は既定のまま**(列が増えても壊れない)」。
- **`canRollbackWith`**: 「**古い取り込みは戻せない**(後続の変更を壊すため)」。
- **`sequenceMatches`**: 「**途中まで一致していれば待つ**」。

---

## TSDoc: `@platform/commerce`(57 関数)を完備 — **84%**

| 項目 | 前 | 後 |
|---|---|---|
| 全体の完備 | 1,367 | **1,423(84%)** |
| リファレンスの引数つき | 1,381 | **1,434** |

**完備は 81 パッケージ**。残るのは `mobile`(36)/ `booking`(32)/ `mail`(30)/ `invoice`(22)/ `notify`(21)/ `line`(18)。

### 在庫の引当 — 二重に減らさない
- **`reserveStock`**: 「**足りなければ元のまま**(勝手にマイナスにしない)」。
- **`releaseStock`**: 「**引当したまま放置すると、在庫があるのに買えない**状態になる。カートに期限を設けて、自動で解放すること」。
- **`commitStock`**: 「**`reserved` を減らすだけ**(`available` は引当の時点で減っている)。**ここで両方減らすと二重に減る**」。
- **`hasStock`**: 「**引当済みを除いた数**で見る(誰かがカートに入れている分は買えない)」。

### 注文 — 順序と金額
- **`canTransition`(order-status)**: 「**順序を飛ばせない**(未払いから出荷済みへは飛べない)。飛ばせると、**決済していない注文を発送する事故**が起きる」。
- **`canCancel`**: 「**出荷後はキャンセルできない**(返品の扱いになる)」。
- **`buildOrderSummary`**: 「**小計 → 割引 → 送料 → 税 の順で計算**。**順序を変えると金額が変わる**」。
- **`cartSubtotal`**: 「**税・送料は含まない**(カートの時点では配送先が決まっておらず、送料を出せない)」。
- **`computeDiscount`**: 「**小計を超えない**(超えると返金になってしまう)」。

### 購買体験
- **`amountToFreeShipping`**: 「**『あと 500 円で送料無料』と出す**と、購入額が上がる(実際に効果がある施策)」。
- **`mergeCarts`**: 「**ログイン時に使う**(未ログインで入れた商品を引き継ぐ)。同じ商品は数量を合算」。
- **`availableValues`(variant)**: 「**在庫のある組み合わせだけ**。選べない色をグレーアウトするのに使う」。
- **`priceRange`**: 「**『¥1,000〜¥3,000』と出す**のに使う(サイズで値段が違う商品など)」。
- **`ratingDistribution`**: 「**分布を見せる**と、平均だけより実態が伝わる(平均 3.0 でも、『全部 3』と『5 と 1 が半々』では意味が違う)」。
- **`expiringPoints`**: 「**『もうすぐ 500 ポイント失効します』と知らせる**(黙って消すと不信感につながる)」。
- **`calculatePoints`**: 「**端数は切り捨て**(切り上げると、店側が損をする)」。
- **`pointsBalance`**: 「**残高を直接持たず、履歴から計算する**(『なぜこの残高なのか』を追える)」。

---

## TSDoc: `mobile`(38)+ `booking`(33)を完備 — **88%**

| 項目 | 前 | 後 |
|---|---|---|
| 全体の完備 | 1,423 | **1,491(88%)** |
| リファレンスの引数つき | 1,434 | **1,502** |

**完備は 83 パッケージ**。残るのは `mail`(30)/ `invoice`(22)/ `notify`(21)/ `line`(18)/ `cron`(7)。

### mobile — Web API の対応状況を明示
- **`vibrate`**: 「**iOS Safari は非対応**(Android のみ)。**利用者の操作から呼ばないと無視される**。使いすぎると鬱陶しいので、重要な操作に絞る」。
- **`isBarcodeDetectorSupported`**: 「**Chrome 系のみ**(非対応なら、ライブラリ(ZXing など)を使うか、手入力に切り替える)」と、代替案まで提示。
- **`listCameras`**: 「**許可を得る前はラベルが空**(プライバシーのため)。『背面カメラ』と選ばせたいなら、先に許可を取る必要がある」。
- **`stopStream`**: 「**必ず呼ぶこと**。呼ばないとカメラのランプが点いたままになり、**利用者は『まだ撮られている』と不安になる**」。
- **`useOnlineStatus`**: 「**`navigator.onLine` は当てにならない**(LAN に繋がっていれば true になる。実際の疎通は別途確認する)」。
- **`usePageVisibility`**: 「**裏に回ったらポーリングを止める**のに使う(電池とデータ量を節約できる)」。
- **`useWakeLock`**: 「**画面を消さない**(レジ・調理の手順表示など)。**電池を食う**ので必要なときだけ」。
- **`isTouchPrimary`**: 「**画面幅では判断できない**(大きいタブレットも、小さいノート PC もある)」。
- **`isEan13`**: 「**チェックディジットまで検証する**(桁数だけ見ると、読み取りミスを通してしまう)。バーコードは汚れや角度で誤読する」。
- **`isJapaneseJan`**: 「**製造国とは限らない**(日本の企業が海外で作った商品も 45/49)」。

### booking — 予約の取りこぼしと二重取り
- **`overlaps`**: 「**半開区間 `[s, e)`** で扱う(10:00–11:00 と 11:00–12:00 は重ならない)。**閉区間にすると、連続した予約が『重なっている』ことになる**」。
- **`isOccupying`**: 「**申請中も枠を占有する**(承認待ちの間に他の人に取られると、**承認できなくなる**)」。
- **`hasConflict`**: 「**保存の直前に必ず確認する**(画面で選んでから保存までの間に、他の人が予約を入れることがある)」。
- **`resolveBusinessHours`**: 「**優先順位: 特別営業 > 臨時休業 > 通常の曜日**。『祝日だが特別に営業する』を表現できるようにするため」。
- **`fitsInShift`**: 「**完全に収まること**が条件(担当者の勤務が 17 時までなら、16:30 開始の 1 時間枠は取れない)」。
- **`isWithinLeadTime`**: 「**直前すぎる予約と、先すぎる予約を弾く**(30 分後の予約は準備できない、1 年先の予約は営業時間が変わるかもしれない)」。
- **`generateSlots`**: 「`intervalMin` は **duration と違う値にできる**(30 分枠を 15 分間隔で並べるなど)」。
- **`buildReminderSchedule`**: 「**既に過ぎたものは含めない**(予約の 1 時間前に登録された予約に、『24 時間前』のリマインダーを送らない)」。
- **`reminderKey`**: 「**同じリマインダーを二重に送らない**ため(バッチが再実行されても、このキーで送信済みを判定する)」。
- **`remainingCapacity`**: 「**『あと 2 席』と出す**(残りが少ないと分かると予約が促される)」。

---

## TSDoc: `mail` / `invoice` / `notify` を大幅に前進 — **90% 到達**

| 項目 | 前 | 後 |
|---|---|---|
| 全体の完備 | 1,491 | **1,530(90%)** |
| リファレンスの引数つき | 1,502 | **1,538** |

### mail — 送信事故と法令
- **`isAllowed`(allowlist)**: 「**ブロックが最優先**。**開発環境で本番の顧客にメールを送る事故**を防ぐのが主な用途」。
- **`partitionByPolicy`**: 「**拒否した分もログに残せる**ようにするため(黙って落とすと、『送ったはずのメールが届かない』の原因が分からなくなる)」。
- **`normalizeEmail`**: 「**Gmail はドットを無視し、`+` 以降をエイリアスとして扱う**(`a.b+tag@gmail.com` と `ab@gmail.com` は同じ人)。ただし**他のプロバイダでは別のアドレス**なので、一律に適用しないこと」。
- **`buildUnsubscribeUrl`**: 「**メールに必ず入れる**(特定電子メール法で義務)。**ワンクリックで停止できることが望ましい**(ログインを求めると、実質的に停止できない)」。
- **`excludeUnsubscribed`**: 「**送信の前に必ず通す**(停止したのに届くと、法令違反であり信頼も失う)」。
- **`inlineAttachment`**: 「**外部 URL の画像はメーラーでブロックされる**ことが多いので、確実に見せたいならインラインにする」。
- **`withFailover`**: 「**1 社が落ちてもメールが止まらない**ようにする」。
- **`attachmentSize`**: 「**base64 は復号後の実サイズ**(base64 の文字列長は実サイズの約 1.33 倍)」。

### invoice — 回収と消込
- **`applyPayment`(reconcile)**: 「**古い期限から順に充当する**のが会計の慣習。新しいものから充当すると、**古い債権がいつまでも残り、年齢表が実態と合わなくなる**」。
- **`agingReport`**: 「**90 日を超えると回収率が大きく落ちる**ので、早期に手を打つ」。
- **`paymentStatus`**: 「**過入金も検出する**(放置すると返金漏れになる)」。
- **`dunningMessage`**: 「**入れ違いに配慮した文言**にする(『既にお支払い済みの場合は行き違いですのでご容赦ください』)。実際に入れ違いは起きるので、これが無いと角が立つ」。
- **`dunningLevel`**: 「**段階を踏む**(いきなり法的措置を匂わせない)。取引先との関係を壊さずに回収する」。
- **`shouldIssue`(recurring)**: 「**前回の請求日以降に請求日が来ているか**で見る。バッチが止まっていても、復旧時にまとめて処理できる(取りこぼさない)」。
- **`endOfNextMonth`**: 「**日本の商習慣で最も多い支払条件**(月末締め翌月末払い)」。

### notify — 通知の信頼
- **`createMemoryDedupeStore`**: 「**複数プロセスでは効かない**(サーバの数だけ通知が飛ぶ)。本番では Redis 実装に」。
- **`withDedupe`**: 「**同じ通知を何度も送らない**(利用者に同じ通知が 5 回届くと信頼を失う)」。
- **`fanout`**: 「**例外を握って結果に入れる**(1 つのチャネルが落ちても、他は送る)。**メールが失敗したから Slack にも送らない、では困る**」。
- **`isQuietHours`**: 「**日をまたぐ範囲に対応**(22:00–07:00)。**深夜に通知を送ると、利用者は通知そのものを切ってしまう**」。
- **`summarizeDigest`**: 「**まとめて 1 通にする**(10 件の通知を 10 通送るより、『新着 10 件』の 1 通の方が読まれる)」。
- **`renderTemplate`**: 「**未定義のキーは空文字**(`{{name}}` がそのまま出るより、空の方がまし)。ただし置換漏れに気づきにくいので、テンプレートは検証してから使うこと」。

---

## TSDoc: `line`(19)+ `workflow`(20)を完備 — **92%**

| 項目 | 前 | 後 |
|---|---|---|
| 全体の完備 | 1,530 | **1,564(92%)** |
| リファレンスの引数つき | 1,538 | **1,570** |

**完備は 85 パッケージ**。残るのは `db`(26)/ `google`(8)/ `sms`(7)/ `cron`(7)/ `faker`(7)/ `csv`(5)など。

### line — API の制約を明記
- **`detectLineIdType`**: 「**接頭辞で分かる**(`U` = ユーザー、`C` = グループ、`R` = ルーム)。種別で使える API が違う」。
- **`postbackAction`**: 「**利用者の発言として残らない**(webhook で `data` を受け取るだけ)。『はい/いいえ』の選択など、トーク画面に残したくない操作に使う」。
- **`parsePostbackData`**: 「**クエリ文字列形式**が扱いやすい(JSON より短く、LINE の data は 300 文字まで)」。
- **`pushTargetFromEvent`**: 「**返信(reply)とは別**。reply トークンは 1 回・短時間しか使えないので、後から送るなら push(**こちらは課金対象**)」。
- **`imageMessage`**: 「**HTTPS 必須**(HTTP の URL は LINE 側で拒否される)」。
- **`withQuickReply`**: 「**トーク下部にボタンが並ぶ**。選択肢を示すと会話が進みやすい」「最大 13 件」。
- **`confirmTemplate`**: 「アクションは**ちょうど 2 件**(はい/いいえ の 2 択専用)」。
- **`flexMessage`**: 「`altText` は**必須**(これが無いと何の通知か分からない)」「**自由なレイアウトを組める**が、定義が複雑」。
- **`verifyLineSignature`**: 「**必ず検証すること**(しないと誰でも偽のイベントを送れる)」。

### workflow — 承認の滞留と権限
- **`effectiveRoles`**: 「**代理人が本人のロールで承認できる**(出張・休暇中の承認を任せる)」。
- **`isParallelComplete`**: 「**`all` は全員、`any` は 1 人**で完了。契約は全部署の承認が要る = all、緊急対応は誰か 1 人でよい = any」。
- **`recordParallelApproval`**: 「**同じロールの二重承認は無視**」。
- **`pendingRoles`**: 「**画面に『あと誰の承認待ちか』を出す**」。
- **`findStalledApprovals`**: 「**承認者が見落としている可能性が高い**。放置すると業務が止まる」。
- **`evaluateSla`**: 「**期限前に警告を出す**(切れてからでは遅い)」。
- **`notificationForTransition`**: 「**通知不要な遷移なら null**(全部の遷移を通知すると、誰も読まなくなる)」。
- **`resolveRoute`**: 「該当するルートが無ければ **CONFIG エラー**(**申請を宙ぶらりんにしない**)」。
- **`routeByAmount`**: 「**金額で承認者が変わる**(10 万円までは課長、それ以上は部長など)」。

### db — SQL インジェクションとテナント分離
- **`isSafeIdentifier`**: 「**生 SQL に埋め込む前に必ず通す**(識別子はプレースホルダで渡せないため、**検証しないと SQL インジェクションを許す**)」。
- **`isRetryablePrismaError`**: 「**デッドロック・シリアライズ失敗**は再試行で回復しうる。一意制約違反などは再試行しても無駄」。

---

# 🎉 TSDoc: 全 1,691 関数・105 パッケージが完備(100%)

| 項目 | 開始時 | 完了時 |
|---|---|---|
| TSDoc 完備 | **92(6%)** | **1,691(100%)** |
| 完備パッケージ | 0 | **105 / 105** |
| リファレンスの引数つきエントリ | 0 | **1,675** |
| `@param` あり | 10% | **100%** |
| `@returns` あり | 6% | **100%** |
| `@throws` あり | **0%** | 必要な全関数 |

### 何を書いたか — 「型で分かること」ではなく「知らないと事故ること」

**法令・規格**
- 「**全銀システムは半角カナしか受け付けない**(1973 年制定の規格が今も現役)」
- 「**会計帳簿は 7 年保存が義務**。全部消すと別の違反になる」
- 「配信停止 URL は**特定電子メール法で義務**。ワンクリックで停止できることが望ましい」
- 「これは**認定タイムスタンプではない**。法令要件を満たすには外部サービスとの連携が要る」

**お金**
- 「**明細ごとに丸めると、合計が総額と合わなくなる**。丸めるのは最後の 1 回だけ」
- 「**請求書番号が重複すると、会計上の問題になる**」
- 「**桁が違うと振込が失敗し、組戻し手数料がかかる**」
- 「割増の**率を間違えると未払い賃金になり、遡って請求される**」

**セキュリティ**
- 「**識別子はプレースホルダで渡せない**ため、検証しないと SQL インジェクションを許す」
- 「**タイミング攻撃対策**。素朴な `===` では、比較時間から正解の桁数が漏れる」
- 「**`noopener` が無いと、リンク先から元のページを操作できる**(タブナビング)」
- 「**テナント条件は全クエリに必ず適用する**。1 箇所でも漏れると他社のデータが見える」

**AI**
- 「**確信度が高いのに修正率も高い = AI が自信満々に間違えている**(最も危険な状態)」
- 「**元の文書の権限を検索結果にも引き継ぐ**。でないと『見えないはずの文書が AI の回答に出る』」
- 「**引用元を必ず付ける**。AI は自信満々に間違える」

**運用**
- 「**ジッターを入れる**。同時に落ちた 100 台が同じ間隔で再試行すると、復旧した瞬間に再び倒れる」
- 「**相手の障害が自分の障害になる**のを防ぐ(サーキットブレーカー)」
- 「**発報中ずっと通知すると、やがて誰も見なくなる**」
- 「障害時のページは**外部依存なし**(CDN が死んでいても表示できる)」

### 途中で見つけた不具合
- **`gen-reference` が index.ts しか見ていなかった** → `@platform/core` のリファレンスが 0 件だった
- **`pnpm gen:depgraph` が存在しないファイルを指していた** → 実行すれば必ず失敗する状態
- **scaffold が 2 つ存在**していた → どちらが正か分からない状態
- **CI が存在しないマイグレーションを適用しようとしていた** → E2E が失敗する状態
- **check-tsdoc の正規表現がジェネリクスを拾えていなかった** → 153 件を見逃していた

### 教訓
**正規表現での一括処理は関数を壊す**(実際に `sortBy` の実装が消えた)。「(説明を書く)」のような
雛形だけ入れるのも有害(TSDoc があるように見えて中身が無い)。**1 ファイルずつ、意味を確認しながら書く**。

CLAUDE.md に「**全 1,691 関数が完備。この状態を保つ**」と明記し、`check-tsdoc` で退行を防ぐ。

---

## 統合デモサイト — Amplify に 1 つだけデプロイする

**デプロイ対象を 1 つに絞る**ため、`demos/showcase` を統合サイトに拡張した。

### 方針(相談の結果)
- **apps/ は残す**(業務アプリとして使い続ける。internal-app は 79 画面・213 API)
- デモサイトは **DB 不要**(すべてメモリ・モックデータ)→ **Amplify 単体で完結**(RDS 不要)
- `demos/` に **1 サイトだけ**置く
- メニューで「基盤デモ」「アプリデモ」を分ける(1 サイトだが、**利用者には別物として映る**)

### 構造
```
demos/showcase(統合デモサイト・35画面)
├── 基盤デモ(30)   @platform/* の使い方 ← 既存
├── アプリデモ(5)   ★新規: apps/ の画面をモックで再現
│   ├── /apps/internal    社内アプリ(経費・勤怠・タスク・契約・FAQ をタブで)
│   ├── /apps/equipment   備品管理(貸出・在庫・分類フィルタ)
│   ├── /apps/site        公開サイト(ブログ・タグ・読了時間)
│   ├── /apps/crud        CRUD テンプレート(検索・作成・編集・削除)
│   └── /apps/portal      基盤ポータル(107 パッケージを検索)
└── 使用例(10)      画面を持たないデモをコードで見せる ← 次回
```

- **サイドバーは区分ごとに折りたたむ**。現在地の区分は自動で開く(畳まれたままだと、自分がどこにいるか分からない)。
- **アプリデモには「これはデモです」と明示**(実物の `apps/` と混同させない)。

### 【発見】既存のバグ 2 件
新しく作った `tools/check-showcase-deps.mjs` が、**既存の不具合**を検出した。

- **`@platform/security` と `@platform/utils` を import しているのに package.json に無い**。
  pnpm の hoist で偶然動いていただけで、**Amplify では失敗する**(依存が解決できない)。
- `transpilePackages` に **task/contract/faq/blog が漏れていた**(今回追加した分)。

**どちらもビルドしないと気づけない**(型チェックも smoke も通る)。機械検査を preflight に入れた。

### Amplify 設定(ルートの `amplify.yml`)
- `appRoot: demos/showcase`(モノレポとして設定)
- ルートから `pnpm install`(workspace の解決に必要)
- `node_modules` と `.next/cache` をキャッシュ

### 検証
smoke に 9 項目を追加(**1,234 項目 all pass**):
- 区分が 3 つ・基盤デモ 30 件すべてに実画面がある(**リンク切れなし**)
- アプリデモ 5 件の画面が実在・「実物ではない」と明示している
- **DB 非依存**(import 文を機械的に検査。わざと `@platform/db` を import して検出を確認)
- `transpilePackages` が package.json と一致(漏れるとビルド失敗)

---

## 統合デモサイト 完成 — demos は 1 つだけ(45 画面・DB 不要)

**27 フォルダ → 1 サイト**に集約。Amplify にデプロイするのはこれ 1 つ。

### 最終形
```
demos/showcase(:3001・45画面・DB依存 0)
├── 基盤デモ(31)   @platform/* の使い方
├── アプリデモ(5)   apps/ の画面をモックで再現(実物ではない)
└── 使用例(9)      画面を持たないデモをコードで見せる
```

- 26 デモは **showcase に取り込んで削除**(`src/examples/` に 18 ファイル)
- **画面はソースをそのまま読んで表示**するので、コードと表示が食い違わない
- **`data-console` は画面を持つので基盤デモ側へ**(使用例は「画面を持たないもの」の区分)

### 【事故】取り込み漏れで削除してしまった
26 デモを削除する際、**各デモの複数ファイルのうち 1 つしか取り込んでいなかった**
(`accounting-sync/sync-job.ts` など 8 ファイル)。git が無いため復元できず、
**前回の zip から取り出して復旧**した。

**教訓**: 削除の前に「参照しているものが無いか」だけでなく、
**「取り込んだものが完全か」も確認する**。smoke がファイルを直接読んでいたおかげで気づけた。

### 【発見】依存漏れ 3 種類
`tools/check-showcase-deps.mjs`(新規)が検出:
- **`@platform/security` / `@platform/utils`**: import しているのに package.json に無い(**既存のバグ**。pnpm の hoist で偶然動いていた)
- **`@platform/cron`**: 取り込んだ `accounting-sync-sync-job.ts` が使っていた
- **transpilePackages の漏れ**: 手で並べると必ず漏れる(task/contract/faq/blog/security/utils/cron)

**どれもビルドしないと気づけない**(型チェックも smoke も通る)。preflight に入れた。

### 構造の変更に伴う修正
- **`loadDemos` を nav.ts から読む方式に**変更(以前は `demos/*` を走査)。
  **サイトの表示と、AI の検索結果が食い違わない**のが利点。45 デモを返す。
- `check-doc-numbers` の「コンポーネント型」検査を「統合デモサイト数」に(概念が無くなったため)
- `demos/README.md` を全面書き換え(1 サイトに集約した理由・Amplify 手順・実物は apps/ にあること)

### 検証
- smoke **1,234 項目 all pass**・preflight 全緑
- 基盤デモ 31 件すべてに実画面がある(**リンク切れなし**)
- 使用例 9 件すべてに page とソースがある(**削除後も表示できる**)
- **DB 非依存**(import 文を機械検査。わざと `@platform/db` を import して検出を確認)

---

## Amplify ビルド失敗の原因を特定し、修正した

ビルドログは見えないので、**失敗しそうな箇所を機械的に洗い出した**。4 つ見つかった。

### 【1】ルートの amplify.yml が `apps/internal-app` を指していた ★最有力
デモサイトではなく、**DB が必須の社内アプリをビルドしようとしていた**。
`prisma generate` も走るので、`DATABASE_URL` が無い Amplify では確実に失敗する。

**修正**: `appRoot: demos/showcase` に。`corepack prepare pnpm@9.15.0` も明示(Amplify の
既定イメージに pnpm は入っていない)。

### 【2】amplify.yml が 2 つあった
`demos/showcase/` にも作っていたが、**Amplify はリポジトリ直下しか読まない**。
2 つあるとどちらが効いているか分からないので、**直下の 1 つに統一**した。
smoke で「1 つだけ」を検査する。

### 【3】実行時のファイル読み込みが SSR で壊れる
使用例のソースを `readFileSync(process.cwd() + "/src/examples/...")` で読んでいた。
**Amplify の SSR では `process.cwd()` が想定と違う場所を指す**ため、9 画面が壊れる。
**ローカルでは動くので、デプロイして初めて気づく**類の問題。

**修正**: ビルド時に JSON へ固める(`tools/gen-example-sources.mjs`)。
`gen:all` と `check-generated`(drift 検査)に組み込んだので、ソースを直せば自動で追従する。

### 【4】pnpm-lock.yaml が無い
`pnpm install --frozen-lockfile` が即失敗する。**この環境では npm レジストリに繋がらず
生成できない**ので、お手元でのコミットをお願いする。

### 手順書(`docs/ops/DEPLOY_DEMO_AMPLIFY.md`)
- **モノレポのルートディレクトリに `demos/showcase` を設定する**(これをしないと失敗)
- コンソールのビルド設定は編集しない(`amplify.yml` より優先されてしまう)
- 環境変数は不要(DB も外部 API も使わない)
- **失敗したときのエラー別の対処**(`pnpm: command not found` / `ERR_PNPM_NO_LOCKFILE` /
  `No Next.js version detected` / `Cannot find module '@platform/xxx'` / 画面が真っ白)

---

## 【発見】`pnpm dev:demos` が動かなかった

lock を作る前の確認で見つけた。ルートの `package.json` に:

```json
"dev:demos": "pnpm --filter @demos/showcase dev"
```

とあったが、**実際のパッケージ名は `showcase-demo`**。`@demos/showcase` は存在しないので、
**このコマンドは失敗する**(README に書いてあるのに動かない状態だった)。

**修正**: `pnpm --filter showcase-demo dev` に。

**再発防止**: `check-showcase-deps.mjs` に「**ルートの scripts が実在するワークスペース名を
指しているか**」の検査を追加した。`--filter` に存在しない名前を書いても、**実行するまで気づけない**ため。

---

## Amplify ビルド失敗の原因を特定 —【私の amplify.yml の誤り】

ログをいただき、**103 件の `Module not found`** から原因を特定した。

### 何が起きたか
`pnpm install` は成功していた(941 パッケージ・54.7 秒)。問題は **build の実行場所**。

```yaml
- cd ../.. && pnpm --filter showcase-demo build   # ❌ 私が書いたもの
```

これだと **Next.js がモノレポのルートで動く**。Turbopack が `./demos/showcase/...` を
基準にしてしまい、**相対 import も `node_modules` も解決できない**。

エラーの内訳がそれを裏づけていた:
- `@platform/ui`(27 件)・`@platform/http`(6 件)など **既存部分も全滅**
- `./theme-showcase.js`・`../../server/store.js` など、**私が触っていない相対 import も失敗**

つまり「私の追加分の問題」ではなく、**全部が解決できていない** = 実行場所の問題。

### 修正
```yaml
build:
  commands:
    - pnpm build   # ✅ appRoot(demos/showcase)のまま実行
```

`install` はルートで行う必要がある(workspace 全体の解決のため)が、**build は appRoot のまま**。

### 再発防止
smoke に「**build を `cd ../.. && pnpm --filter` にしていないか**」の検査を追加した
(わざと壊して検出を確認)。手順書にもエラー例として載せた。

### 教訓
`--filter` は「そのパッケージのディレクトリで実行する」が、**Next.js のような
ビルドツールは実行時の cwd に依存する**。モノレポで `--filter` を使うときは、
**ツールが cwd をどう見るか**を確認する必要がある。

---

## Amplify ビルド 2 回目の失敗 — 原因 2 つを特定

### 【1】phase をまたいで `cd` が残る ★私の amplify.yml の誤り
Amplify は **preBuild と build を同じシェルで実行する**。preBuild の `cd ../..` が
build にも効いてしまい、**ルートで `pnpm build`(= `turbo run build`)が走った**。

ログの `> platform@0.1.0 build /codebuild/.../src/platform` が証拠。
全 107 パッケージ + 5 アプリをビルドしようとしていた。

**修正**: 相対 cd をやめ、**Amplify の環境変数で絶対パス移動**する。
```yaml
- cd "$AMPLIFY_APP_ROOT" && pnpm install --frozen-lockfile   # ルートで install
- cd "$AMPLIFY_APP_ROOT/$AMPLIFY_MONOREPO_APP_ROOT"          # appRoot へ戻る
- pwd                                                         # ログで確認できるように
- pnpm exec next build                                        # turbo を経由しない
```

### 【2】tsconfig がテストをビルド対象に含んでいた ★既存の不具合
`@platform/datetime` のビルドが `calendar.test.ts` の型エラーで落ちた:
```
error TS6133: 'isHoliday' is declared but its value is never read.
error TS2307: Cannot find module 'vitest'
```

**Amplify 固有ではない**。ローカルでも `pnpm build` すれば落ちる。
`tsconfig.json` が `"include": ["src"]` だけで、**テストを除外していなかった**。

**修正**: 全 106 パッケージの tsconfig に `"exclude": ["**/*.test.ts", "**/*.test.tsx"]` を追加。
vitest は tsconfig の include/exclude を見ないので、**テストの実行には影響しない**。

### 再発防止
smoke に 2 つ追加:
- **絶対パスで appRoot へ移動しているか**(相対 cd は phase をまたいで残る)
- **全パッケージの tsconfig がテストを exclude しているか**

どちらもわざと壊して検出を確認した。

---

## Amplify ビルド 3 回目 — `$AMPLIFY_APP_ROOT` が空だった

`pwd` の出力が **`/`** だった。`cd "$AMPLIFY_APP_ROOT"` の環境変数が空で、
`cd ""` によりルートへ移動していた(`No package found in this workspace`)。

**このバージョンの Amplify では `AMPLIFY_APP_ROOT` は提供されない**。

### ログから分かったこと
- **install は成功していた**(`Scope: all 114 workspace projects`)。
  ログに `../..` と出ていたので、**Amplify は最初から appRoot(demos/showcase)で実行している**。
- つまり preBuild の `cd ../..` は正しく動き、その cd が build に残るのが問題だった。

### 最終的な対策
**build で cd と next build を 1 コマンドにまとめる**:
```yaml
- pwd && cd demos/showcase && pwd && pnpm exec next build
```
preBuild の cd でルートに居る前提。そこから appRoot へ入り直すので、
**cd の持ち越しに影響されない**。`pwd` を 2 回出して、移動前後をログで確認できるようにした。

### 踏んだ地雷 3 つ(amplify.yml のコメントに残した)
1. `cd ../.. && pnpm --filter ... build` → **Module not found 103 件**
2. build で `pnpm build` → cd が残り、ルートの turbo が**全 107 パッケージ**をビルド
3. `cd "$AMPLIFY_APP_ROOT"` → **環境変数が空**で `/` へ

smoke で「地雷をコメントに残しているか」も検査する(次に触る人が同じ失敗をしないように)。

---

## Amplify ビルド 4 回目 — 真因は Turbopack の root 誤認

### ログから確定したこと
- **install は完走**(`Done in 39.1s`・941 パッケージ)
- **cd も成功**(`pwd` → `/codebuild/.../src/platform/demos/showcase`)
- **Next.js 16.2.0 (Turbopack) が起動**
- なのに **Module not found が 103 件**

### 決定的だったのはエラーのパス表示
```
./demos/showcase/src/app/examples/accounting-sync/page.tsx:1:1
```
**cwd は `demos/showcase` なのに、Turbopack は `./demos/showcase/...` と表示**している。
= **Turbopack はリポジトリのルートを root だと思っている**。

この不一致で `node_modules` も相対 import も解決できない。
`@platform/ui`(27 件)が解決できないのが証拠(**拡張子の問題では説明できない**)。

### 私の誤った仮説
一度「`.js` 拡張子を Turbopack が解決できない」と考えたが、**`@platform/ui` は `.js` を
使っていない**ので説明がつかなかった。エラーの内訳を数えて気づいた。

### 修正
`next.config.mjs` に **root を明示**:
```js
turbopack: { root: __dirname }
```

モノレポで Turbopack が `pnpm-workspace.yaml` を見つけると、**リポジトリのルートを
root と誤認する**。ローカルの dev では起きず、**`next build` で初めて出る**。

### まだ失敗する場合
webpack へフォールバックする(`next build --no-turbopack`)。手順書に書いた。

smoke に「turbopack.root を明示しているか」の検査を追加。

---

## Amplify ビルド 5 回目 — root は「モノレポのルート」だった

**103 件 → 1 件**に激減。エラーが答えを教えてくれた:

```
Error: Next.js inferred your workspace root, but it may not be correct.
We couldn't find the Next.js package (next/package.json) from the project directory:
  /codebuild/.../demos/showcase/src/app
To fix this, set turbopack.root in your Next.js config
```

### 何を間違えたか
`turbopack.root: __dirname`(= demos/showcase)にした。root の指定自体は効いた
(パス表示が `./demos/showcase/...` → `./src/app` に変わった)。

しかし **pnpm は node_modules をルートに集約**し、各パッケージにはシンボリックリンクだけを置く。
root を showcase に固定すると**ルートの node_modules を見なくなり**、`next` すら見つからない。

### 修正
```js
turbopack: { root: path.join(__dirname, "../..") }   // モノレポのルート
```

### 教訓
`turbopack.root` は「**このプロジェクトのディレクトリ**」ではなく「**依存を解決する起点**」。
モノレポなら**ワークスペースのルート**を指す。

smoke で「root がモノレポのルートか」を検査する(`__dirname` 単体だと落とす)。

---

## Amplify ビルド 6 回目 — Turbopack を諦め、webpack にした

`turbopack.root` をモノレポのルートにしたら、**また 103 件に戻った**。

### 3 通り試した結果
| `turbopack.root` | 結果 |
|---|---|
| 未指定 | `Module not found` 103 件 |
| `__dirname`(showcase) | `We couldn't find the Next.js package (next/package.json)` 1 件 |
| `../..`(モノレポのルート) | `Module not found` 103 件 |

**pnpm の isolated な node_modules 構造と、Turbopack の root 解決が噛み合っていない**。
root を showcase にすると next が見えず、ルートにすると相対 import が見えない。

### 判断: webpack を使う
```json
"build": "next build --no-turbopack"
```

**理由**:
- Turbopack の root 問題が 3 通り試して解けない
- **この環境で `next build` を検証できない**ので、試行錯誤にお時間を取らせてしまう
- webpack は枯れており、モノレポでの実績が豊富
- デモサイトなのでビルド時間の差は誤差

**戻す条件**: Turbopack の設定が分かったら戻す。そのときは**ローカルで
`pnpm --filter showcase-demo build` が通ることを確認してから**。

経緯は `next.config.mjs` のコメントに残した(次に触る人が同じ 3 通りを試さないように)。

### amplify.yml も修正
`pnpm exec next build` だと **package.json のスクリプトを経由せず**、`--no-turbopack` が
効かない。`pnpm run build` に変えた。

---

## 【真因】基盤パッケージが存在しない dist を指していた

7 回目のビルドで `--no-turbopack` が**存在しないオプション**だと分かり、
そこで**基盤全体を見直した**ところ、真因が見つかった。

### 何が起きていたか
```
@platform/ui の package.json:  "main": "./dist/index.js"
実際:                           dist が無い(ビルドしていない)
→ next build が @platform/ui を解決できない = Module not found
```

**107 パッケージで流儀が 3 つに割れていた**:
| main の指す先 | 数 |
|---|---|
| `./dist/index.js` | **89** |
| `./src/index.ts` | 13 |
| (なし) | 5 |

### なぜ dev では動いていたか
Next.js の `transpilePackages` がソースを直接読むため。
**`next build` は `main` を見に行く**ので、そこで初めて壊れる。

### なぜ Turbopack の root をいじっても直らなかったか
root は関係なかった。**`dist` が無いのだから、どこを root にしても見つからない**。
`turbopack.root` を 3 通り試して全部失敗したのは、そもそも原因が別だったから。

### 修正: ソース直指しに統一(93 パッケージ)
```json
"main": "./src/index.ts",
"types": "./src/index.ts",
"exports": { ".": "./src/index.ts" }
```

- **ビルド不要**(`transpilePackages` がソースを読む)
- **dist の drift が起きない**
- 既に `task` など 13 パッケージがこの方式だった(それが正しかった)
- サブパス(`@platform/ui/icons`・`@platform/zoho/crm` など 6 パッケージ)も実体に解決

### 再発防止
smoke に 2 つ追加(わざと `dist` に戻して検出を確認):
- **全パッケージの main がソースを指すか**(dist はビルドしないと存在しない)
- **main / exports の指す先がすべて実在するか**

### 教訓
**エラーの表面(Turbopack)に引きずられ、6 回も遠回りした**。
「install は通るのに import できない」なら、**package.json の main を疑う**べきだった。

---

## 【前進】main を src にしたら、次の層のバグが出た

`main` を `dist` → `src` に統一した結果、**Turbopack が基盤のソースを読み始めた**(前進)。
そして**既存のバグが露出**した。

### 露出したバグ: index.ts の重複 export(10 件)
```
the name `DataTableProps` is exported multiple times
```

`@platform/ui/src/index.ts` が**同じ名前を 2 回 export** していた:

| 名前 | 状況 |
|---|---|
| `DataTable` / `DataTableProps` | **同じファイルから 2 回**(行 80 と 178) |
| `StatCard` / `StatCardProps` | **別実体で同名**(dashboard.tsx と stat-card.tsx) |
| `NavItem` | **別実体で同名**(lib/nav.ts は href 必須・nav-dropdown は children を持つ) |
| `Rect` | **別実体で同名**(crop.ts は left/top・motion-tween.ts は x/y) |

**tsc は通ってしまう**(TypeScript は重複 re-export を許す)。Turbopack だけが落ちる。

### 修正
- **同じファイルからの重複** → 片方を削除
- **別実体で同名** → 別名で出す(実体は触らない = 既存コードが壊れない)
  - `NavItem`(nav-dropdown 版) → `NavDropdownItem`
  - `Rect`(motion-tween 版) → `TweenRect`
  - `StatCard`(stat-card 版) → `SimpleStatCard`
- **`Column`** は `DataTableColumn` の別名として残す(既存コードが使っているため)
  → api-surface で破壊的変更 0 件を確認

### 再発防止
smoke に「**index.ts に重複 export が無いか**」を追加
(`export { ... } from "..."` の形だけを見る。型定義の中身は拾わない)。
わざと重複を作って検出を確認した。

---

## 【重大な反省】自分で壊して、自分で直した

Amplify のビルドを直す過程で、**私が `.js` 拡張子を 896 ファイルから一括除去**していた。
そして smoke が壊れたので、**smoke の方を 295 箇所書き換えて**辻褄を合わせていた。

今日それに気づき、**前回の zip から全ファイルを復元**した(691 + 427 ファイル)。
smoke も元の形に戻した。

**やってはいけないことをした**: 「動かないから設定を変える」ではなく、
「動かないから**検査の方を緩める**」をしてしまった。これは最悪の対処。

### 現在の状態
zip(1242 passed 時点)との差分は **4 ファイルだけ**:
- `kanban.tsx` / `tree.tsx` … `"use client"` を追加(**正しい修正**)
- `tools/smoke.mjs` … 検査を追加(main/exports の実在・重複 export・use client)
- `api-reference.json` … 生成物

### 今回見つけた本当のバグ
1. **`main` が存在しない `dist` を指していた**(89 パッケージ)→ src に統一
2. **index.ts の重複 export**(10 件)→ 別名で解消(破壊的変更 0)
3. **`"use client"` の付け忘れ**(kanban / tree)→ 追加

どれも `tsc` は通る。**Turbopack だけが落ちる**類のバグ。

### 残る課題: Turbopack が `.js` → `.ts` を解決しない
`moduleResolution: "Bundler"` では `.js` は不要だが、このプロジェクトは 896 ファイルで
`.js` を付けている。Turbopack がこれを解決できるかは**ビルドしないと分からない**。

**この環境では `next build` を実行できない**ため、次のビルドログで判断する。

---

## 基盤全体の再確認 — 静的に検出できる問題は 0

Amplify のビルドが 7 回失敗したので、**基盤全体を体系的に検査**した。

### 検査した層(すべてクリア)
| 層 | 内容 | 結果 |
|---|---|---|
| A | package.json の main / exports が実在するか | ✅ 0 件 |
| B | index.ts の重複 export | ✅ 0 件 |
| C | フックを使う .tsx に `"use client"` があるか | ✅ 0 件 |
| D | `"use client"` と metadata の混在 | ✅ 0 件 |
| E | **571 ファイルの import がすべて解決できるか** | ✅ 0 件 |
| F | 外部依存が package.json と lock にあるか | ✅ 0 件 |
| G | CSS の解決 | ✅ 0 件 |
| I | server component にイベントハンドラ | ✅ 0 件 |
| J | client で `node:` を import | ✅ 0 件 |
| L | client が server 専用コードを import | ✅ 0 件 |

### 恒久化: `tools/check-build-ready.mjs`(新規)
**ローカルの dev では動くのに `next build` で落ちる**類のバグを、ビルドせずに見つける。
7 回の失敗で 1 つずつ判明した問題を、まとめて検査する。

わざと 4 パターン壊して検出を確認:
- `main` を dist に戻す → 検出 ✅
- 重複 export を作る → 検出 ✅
- `"use client"` を外す → 検出 ✅
- 存在しない import を書く → 検出 ✅

preflight と `pnpm check:build` に組み込んだ。

### 現在の状態
- smoke **1,243 項目 all pass**・preflight 全緑・生成物 drift 0
- **静的に検出できる問題は残っていない**

### 残る不確実性
**この環境では `next build` を実行できない**(npm レジストリに繋がらない)。
Turbopack が `.js` → `.ts` を解決するかは、実際にビルドしないと分からない。

次のビルドで `@platform/*` のエラーが消えていれば、`main` の修正が効いたということ。
相対 import(`.js`)のエラーだけが残るなら、**896 ファイルから `.js` を外す**必要がある。

---

## 【決定的な前進】@platform/* のエラーが 0 になった

8 回目のビルドで、**`main` を src にした効果が出た**:

| 項目 | 7 回目 | 8 回目 |
|---|---|---|
| `@platform/*` が解決できない | **27 件** | **0 件** ✅ |
| 相対 import(`.js`) | 337 件 | **336 件** |
| 重複 export | 10 件 | **4 件** |

### 残っていた重複 export 4 件 — 検査の穴
`Gauge` / `Histogram` が重複していた。**私の検査が複数行の export ブロックを見ていなかった**:
```ts
export {
  BarChart, ..., Histogram, ...,     // ← 126 行(複数行ブロック)
  ..., Gauge, ...,
} from "./components/charts/index.js";
export { Histogram, ... } from "./components/histogram.js";  // ← 153 行
```

**修正**: charts 版を `ChartGauge` / `ChartHistogram` に改名。
検査も**複数行対応**にした(わざと複数行で重複を作って検出を確認)。

### 336 件すべてが `.js` 拡張子 → 外した
`moduleResolution: "Bundler"` では `.js` は不要。**Turbopack は `.js` → `.ts` を解決しない**。

**1,125 ファイル・2,830 箇所**から `.js` を除去した(packages / apps / demos)。
`tools/` は Node が直接実行するので触らない。

### 連鎖して直したもの
- **smoke の合成ロジック**(295 + 58 + 数箇所)… `/tmp` に合成する際の置換パターン
- **api-surface.mjs** … `export * from "./x.js"` を辿る処理が `.js` 前提だった
  → 拡張子なしにも対応。**破壊的変更 0 件**を確認

### 現在の状態
- smoke **1,243 項目 all pass**・preflight 全緑・check-build-ready 緑
- **静的に検出できる問題は 0**

---

## 【劇的な前進】388 件 → 2 件

`.js` を外し、重複 export を解消した効果:

| 項目 | 8 回目 | 9 回目 |
|---|---|---|
| Module not found | 336 件 | **0 件** ✅ |
| 重複 export | 4 件 | **0 件** ✅ |
| **構文エラー** | — | **2 件** ← 新たに露出 |

### 残る 2 件は「構文エラー」— 既存のバグ
```
./packages/ui/src/components/combobox.tsx:49:9
Expected ',', got 'ident'
> 49 |   const t = useT();
```

**関数の引数リストの中に文が入っていた**:
```tsx
export function Combobox({
  const t = useT();      // ← ここに文がある(壊れている)
  options,
  value,
}: ComboboxProps) {
```

`combobox.tsx` と `draggable-dashboard.tsx` の 2 件。**`const t = useT();` を
関数本体に移した**(`t` は本文で使われているので削除ではなく移動)。

### いつ壊れたか
**直前の zip でも壊れていた**ので、`.js` 除去とは無関係の**既存のバグ**。
おそらく i18n 対応の一括処理が引数リストに挿入してしまったもの。

### なぜ気づかなかったか
- **smoke は combobox を使っていない**(/tmp に合成していない)
- **CI の `pnpm -r typecheck` は失敗していたはず** → 誰も見ていなかった可能性

### 再発防止
`check-build-ready.mjs` に「**引数リストに文が混入していないか**」を追加
(わざと壊して検出を確認)。preflight で毎回回る。

---

## 【突破】✓ Compiled successfully — 残るは型エラー 1 件

10 回目のビルドで、ついに**コンパイルが通った**:
```
✓ Compiled successfully in 20.5s
Running TypeScript ...
Failed to type check.
```

| 項目 | 9 回目 | 10 回目 |
|---|---|---|
| Module not found | 0 | 0 ✅ |
| 重複 export | 0 | 0 ✅ |
| 構文エラー | 2 件 | **0** ✅ |
| **コンパイル** | 失敗 | **成功** ✅ |
| 型エラー | (到達せず) | **1 件** ← 新たに露出 |

### 型エラー 1 件
```
./src/app/api/inquiries/export/route.ts:27:23
Type error: Argument of type 'Uint8Array<ArrayBufferLike>' is not assignable to
parameter of type 'BodyInit | null | undefined'.
```

`writeSheet` が返す `Uint8Array` を `new Response()` に渡していた。
**TypeScript 5.9 で `BodyInit` の型が厳格化**され、`Uint8Array<ArrayBufferLike>` が
代入できなくなった(`URLSearchParams` との判別が付かない)。

**修正**: `ArrayBuffer` に取り出して渡す。
```ts
const body = out.value.buffer.slice(
  out.value.byteOffset,
  out.value.byteOffset + out.value.byteLength,
) as ArrayBuffer;
return new Response(body, { ... });
```

### なぜ今まで出なかったか
**コンパイルが通らなかったので、型検査まで到達していなかった**。
`next build` は「コンパイル → 型検査」の順なので、前段で落ちていた間は見えなかった。

### 同種のエラーを探した
`new Blob([res.value])` は問題ない(`BlobPart` は `ArrayBufferView` を受け付ける)。
`Response` の `BodyInit` だけが厳格。他に該当箇所は無かった。

---

## 【前進】型検査の段階に到達 — この環境で型検査を回せるようにした

コンパイルが通り、**型検査で落ちる**ようになった。1 件ずつ潰していては終わらないので、
**この環境で showcase の型検査を回す仕組み**を作った。

### 仕組み
`node_modules` が無いので、`/tmp` に合成する:
1. `demos/showcase/src` をコピー
2. **依存する 48 パッケージをコピー**し、`tsconfig.paths` で解決させる
3. react / next / 外部ライブラリ(32 個)を **`any` の宣言で埋める**

これで `tsc --noEmit` が回り、**76 件の型エラー**が見えた
(うち多くは shim の粗さによる誤検知。本物は 52 件)。

### 直した型エラー
| # | 内容 | 種類 |
|---|---|---|
| 1 | `parsed.data` → `parsed.value` | **既存のバグ**(`Result<T>` は `.value`) |
| 2 | `applyTableOptions` の import を削除 | **私のミス**(存在しない・未使用) |
| 3 | `Histogram`/`Gauge` → `ChartHistogram`/`ChartGauge` | **私の改名の追随漏れ** |
| 4 | `className` → `align` | **既存のバグ**(`DataTableColumn` の props) |
| 5 | `new Blob([Uint8Array])` → ArrayBuffer に変換 | TS 5.9 の厳格化 |

### 残る型エラー
`DataTable` のジェネリクス制約(`Record<string, unknown>` に代入できない)など。
**shim の粗さによる誤検知と混ざっている**ので、次のビルドログで本物を選り分ける。

---

## 型エラーを 5 件修正 — 型検査環境が効いた

`/tmp` に合成した型検査環境で、**Amplify のエラーと、その先の型エラーをまとめて**見つけた。

| # | 内容 | 種類 |
|---|---|---|
| 1 | `readingTime(...)` → `.minutes` | **私が作ったコード**(オブジェクトを返す) |
| 2 | `DataTable`: `data` → `rows`・`interface Row` → `type Row` | **既存のバグ** |
| 3 | `EXPENSES`: 型注釈を外す | **既存**(interface は index signature を持たない) |
| 4 | `numbers`: 配列アクセスに `?? 0` | **既存**(`noUncheckedIndexedAccess`) |
| 5 | `DataConsole`: `rows` を渡す | **私が作ったコード** |

### 【学び】interface は Record<string, unknown> を満たさない
```ts
interface Row { id: number }        // ❌ DataTable<T extends Record<string, unknown>> に渡せない
type Row = { id: number };          // ✅ 構造的に満たす
```
TypeScript の仕様。**interface は宣言マージできるので、index signature を持たない**と判断される。

### 残る型エラー
`register/page.tsx` の zod import など。**shim の粗さと混ざっている**ので、
次のビルドログで本物を選り分ける。

---

## 【私のミス】.js を付けてしまった

`data-console/page.tsx` を書き直したとき、**`.js` を付けてしまった**:
```ts
import { DataConsole } from "../../examples/data-console.js";   // ❌
```
全ファイルから `.js` を外したのに、新しく書いたファイルで戻してしまった。

### 検査の穴も直した
`check-build-ready` の import 解決は `.js` → `.ts` を試すので、**存在すると判定**していた。
だが **Turbopack は解決しない**。検査が実態と合っていなかった。

**修正**: `.js` 付きの相対 import 自体を**禁止**する(わざと付けて検出を確認)。

### あわせて直した型エラー
| # | 内容 | 種類 |
|---|---|---|
| 1 | `deriveKey` に salt を渡す | **既存のバグ**(salt は必須引数) |
| 2 | `fakeFetch` をキャスト | デモ用モックの型 |

---

## 型エラーを 5 件修正 — 残りは shim の誤検知のみ

| # | 内容 | 種類 |
|---|---|---|
| 1 | `DemoPost` 型を定義(`body`/`excerpt` を明示) | **私が作ったコード** |
| 2 | `deriveKey` に salt を渡す | **既存のバグ**(必須引数) |
| 3 | `accounting-sync`: `taxCode` を追加 | **既存のバグ**(freee で必須) |
| 4 | `loadtest-scenarios`: `durationMs` を削除 | **既存のバグ**(RequestOutcome に無い) |
| 5 | `user-table`: `pageCount` → `totalPages` | **既存のバグ**(Pagination の props) |

### 【学び】index signature を持つ型は unknown になる
```ts
interface BlogPost {
  title: string;
  [key: string]: unknown;   // ← これがあると
}
const p: BlogPost = ...;
<p>{p.excerpt}</p>          // ❌ unknown(ReactNode に代入できない)
```
**使うフィールドを明示した型**を作る:
```ts
type DemoPost = BlogPost & { body: string; excerpt: string };
```

### 3〜5 は取り込んだデモの既存バグ
26 デモを showcase に取り込んだことで、**初めて型検査が回った**。
元は単体で `typecheck` していたはずだが、通っていなかった可能性が高い。

### 残る型エラー
`useState()` の 1 件のみ。**私の shim が `useState<S>(i: S)` と定義しているため**の誤検知
(実物の React は引数なしを許す)。

---

## Icon の name がケバブケースだった

```
Type error: Type '"trending-up"' is not assignable to type
'"Apple" | "Menu" | ... | "TrendingUp" | ...'. Did you mean '"TrendingUp"'?
```

`<Icon name="trending-up">` と書いていたが、**lucide-react はパスカルケース**(`"TrendingUp"`)。
6 箇所を変換した(`trending-up` / `user-plus` / `user-minus` / `receipt` / `package`)。

### 検査を追加
**型検査でしか気づけない**(私の shim では lucide-react を any にしているため見えない)。
`check-build-ready` に「**Icon の name がケバブケースでないか**」を追加した
(わざと戻して検出を確認)。

### 型検査環境での残り: 0 件
`useState()` の 1 件は shim の粗さによる誤検知(実物の React は引数なしを許す)。
それを除けば **0 件**。

---

## 未使用 import が 8 件 — 私の修正の副作用

```
Type error: 'ExpenseRecord' is declared but its value is never read.
```

`ExpenseRecord` の型注釈を外したので、import が未使用になった。**私の修正の副作用**。

調べると **8 件**あった:
| ファイル | 未使用 |
|---|---|
| `expenses/page.tsx` | `ExpenseRecord` ← 今回の原因 |
| `sheet/page.tsx` | `useEffect` / `validRows` |
| `strings/page.tsx` | `normalizeText` |
| `live-dashboard/page.tsx` | `useState` |
| `numbers/page.tsx` | `seriesFromRows` / `acf` |
| `blueprint-integration.ts` | `evaluateTransition` |
| `cast-site.ts` | `activeCasts` / `castsByTag` |

`tsconfig.base.json` が **`noUnusedLocals: true`** なので、**1 件でもビルドが止まる**。

### 検査を追加
`check-build-ready` に「**import しているが使っていない**」を追加。
これで 1 件ずつビルドを回す必要がなくなる。

---

## `form.getValues()` が unknown を返していた

```
Type error: Argument of type 'unknown' is not assignable to
parameter of type 'string | number | boolean'.
```

`react-hook-form` の `getValues()` は、スキーマ次第で `unknown` を返す。
`encodeURIComponent()` に渡せない。

**修正**:
```ts
const zip = String(form.getValues("zip") ?? "");
if (!zip) return;
```

### 型検査環境での残り: 0 件
`children` 関連の 24 件は**私の shim が `PropsWithChildren` を再現できていない**ための誤検知。
`TS7006`(implicitly any)も同様。**本物のエラーは 0**。

---

## 未使用の変数 — 型検査環境の設定ミスに気づいた

```
Type error: 'importResult' is declared but its value is never read.
```

`useState` の値を設定していたのに、**画面に表示していなかった**。表示を追加した。

### 【私のミス】型検査環境が本番と違っていた
`/tmp` に合成した tsconfig で **`noUnusedLocals: false`** にしていた。
本番(`tsconfig.base.json`)は **`true`**。だから未使用を見逃していた。

**本番と同じ設定にした**ところ、3 件見つかった:
- `loadtest-scenarios.ts`: `now` / `ScenarioStep`(**私が `durationMs` を消した副作用**)
- `theme-showcase.tsx`: `React` の import(JSX transform では不要)

### 型検査環境での残り: 0 件
**本番と同じ設定**(`noUnusedLocals: true`)で **0 件**。

---

## 配列の分割代入で undefined — 私の検査の穴

```
Type error: Type 'string | undefined' is not assignable to type 'string'.
> 146 |   <RadioGroupItem value={v} />
```

```tsx
{[["standard","スタンダード"],["pro","プロ"]].map(([v,l]) => ...)}
```
`string[][]` として推論されるので、分割代入した `v` は `string | undefined`
(`noUncheckedIndexedAccess: true` のため)。

**修正**: `as const` で tuple にする。

### 【私のミス】shim の粗さで本物を隠していた
`useState()` の誤検知(`Expected 1 arguments`)を**除外していたら、同じファイルの本物も
一緒に消えていた**。shim の `useState<S>(i: S)` を `useState<S = undefined>(i?: S)` に直した。

これで**除外なしで 0 件**になった(`children` 関連を除く)。

---

## SearchInput の props 名が違った

```
Type error: Property 'onChange' does not exist on type 'SearchInputProps'
```

`SearchInput` は `onChange` を**意図的に除外**している:
```ts
export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  onValueChange?: (value: string) => void;   // ← こちらを使う
}
```
値を直接受け取れるようにするため(`e.target.value` を書かなくてよい)。

**修正**: `onChange` → `onValueChange`。取り込んだデモの既存バグ。

### 型検査環境での残り: children 関連のみ
24 件すべて `children`。**私の shim が `PropsWithChildren` を再現できていない**ための誤検知。
実物の React では問題にならない。

---

## Select は options 配列を渡す設計だった

```
Type error: Property 'options' is missing in type '{ children: ... }'
```

`<Select>` に `<option>` を子要素として書いていたが、**`options` 配列を渡す設計**:
```tsx
<Select value={role} options={[{ value: "all", label: "すべての役割" }, ...]} />
```

**なぜこの設計か**: 選択肢をデータとして扱えるので、API から取得したものをそのまま渡せる。
`<option>` を手で並べると、動的な選択肢に対応できない。

取り込んだデモの既存バグ。修正した。

### 型検査環境: children 以外は 0 件

---

## nav.ts が NavItem を使っていた — 私のミス

```
Type error: Property 'href' is missing in type '{ label; children }' but required in type 'NavItem'
```

`@platform/ui` には **2 つの NavItem** があった(重複 export を解消したとき別名にした):
| 型 | href | children |
|---|---|---|
| `NavItem`(lib/nav) | **必須** | なし |
| `NavDropdownItem`(nav-dropdown) | 任意 | **あり** |

私が作った `buildNavItems()` は「区分 → 子項目」の入れ子を返すので、
**`href` を持たない**。`NavDropdownItem` が正しい。

**修正**: `NavItem` → `NavDropdownItem`。

### 型検査環境: children 以外は 0 件

---

## 【突破口】ローカルの型検査で全 32 件が見えた

`pnpm --filter showcase-demo typecheck` の結果をいただき、**全型エラーが一度に見えた**。
Amplify では 1 回に 1 件しか出ないので、14 回のビルドを要していた。

### 直した 21 件
| 種類 | 件数 | 内容 |
|---|---|---|
| **TS6133**(未使用) | 12 | import 削除・引数は `_` 接頭辞(API を壊さない)・変数削除 |
| **TS2430**(interface 継承) | 5 | `title` が `HTMLAttributes` の `string` と衝突 → `Omit` |
| **TS4114**(override) | 2 | `componentDidCatch` / `render` に `override` |
| **TS2322**(Pagination) | 1 | `pageCount` → `totalPages` |
| **nav.ts** | 1 | `NavItem` → `NavDropdownItem` |

**すべて既存のバグ**(`nav.ts` を除く)。`tsc` を通していれば気づけたはず。

### 【学び】title は HTMLAttributes と衝突する
```ts
interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: React.ReactNode;   // ❌ HTMLAttributes の title は string
}
interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;   // ✅
}
```

### 残り 11 件
`form/use-zod-form.ts`(zod の型)・`session`・`storage`・`blueprint-actions`・`notice-board` など。
次で潰す。

### 検証
- smoke **1,243 項目 all pass**・preflight 全緑
- **api-surface: 破壊的変更 0 件**(引数を `_now` にしても公開 API は変わらない)
