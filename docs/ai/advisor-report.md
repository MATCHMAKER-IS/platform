# Advisor レポート(自動生成)

> 再生成: `node tools/advisor.mjs report`。生成日: 2026-08-19

重複や似た API は「わざと(層が違う)」の場合もあります。這は**再利用の当たりを付ける入口**であり、機械的な指摘です。

## 同名 export(106 組)

| export | 提供パッケージ |
|---|---|
| `AccountType` | @platform/accounting, @platform/zengin |
| `filterByPeriod` | @platform/accounting, @platform/audit |
| `summarize` | @platform/analytics, @platform/attendance, @platform/board, @platform/inventory, @platform/task |
| `AuditEntry` | @platform/audit, @platform/db |
| `ChainVerification` | @platform/audit, @platform/dencho |
| `DiffOptions` | @platform/audit, @platform/db |
| `FieldChange` | @platform/audit, @platform/db |
| `diffChanges` | @platform/audit, @platform/db |
| `Session` | @platform/auth, @platform/session |
| `can` | @platform/auth, @platform/fsm |
| `FeedItem` | @platform/blog, @platform/seo |
| `PostStatus` | @platform/blog, @platform/cms |
| `adjacentPosts` | @platform/blog, @platform/board |
| `buildRssFeed` | @platform/blog, @platform/feed, @platform/seo |
| `buildSitemap` | @platform/blog, @platform/feed, @platform/seo |
| `escapeXml` | @platform/blog, @platform/feed, @platform/seo, @platform/xml |
| `joinUrl` | @platform/blog, @platform/url |
| `postsByTag` | @platform/blog, @platform/board |
| `relatedPosts` | @platform/blog, @platform/board |
| `slugify` | @platform/blog, @platform/utils |
| `tagCounts` | @platform/blog, @platform/cast |
| `Attachment` | @platform/board, @platform/chat |
| `AttachmentLimits` | @platform/board, @platform/chat, @platform/mail |
| `AttachmentResult` | @platform/board, @platform/chat |
| `countReactions` | @platform/board, @platform/chat |
| `extractMentions` | @platform/board, @platform/chat |
| `imageAttachments` | @platform/board, @platform/chat |
| `toggleReaction` | @platform/board, @platform/chat |
| `userReactions` | @platform/board, @platform/chat |
| `validateAttachments` | @platform/board, @platform/chat, @platform/mail |
| `canTransition` | @platform/booking, @platform/commerce, @platform/task |
| `isBusinessDay` | @platform/booking, @platform/datetime |
| `isFinalStatus` | @platform/booking, @platform/commerce |
| `nextStatuses` | @platform/booking, @platform/commerce |
| `groupByDate` | @platform/chat, @platform/ui |
| `markRead` | @platform/chat, @platform/ui |
| `unreadCount` | @platform/chat, @platform/ui |
| `RevisionDiff` | @platform/cms, @platform/quote |
| `diffRevisions` | @platform/cms, @platform/quote |
| `recentPosts` | @platform/cms, @platform/social |
| `applyDiscount` | @platform/commerce, @platform/quote |
| `canAccess` | @platform/contract, @platform/rag |
| `CircuitBreaker` | @platform/core, @platform/observability |
| `CircuitBreakerOptions` | @platform/core, @platform/observability |
| `CircuitState` | @platform/core, @platform/observability |
| `createCircuitBreaker` | @platform/core, @platform/observability |
| `ImportResult` | @platform/csv, @platform/importer |
| `CursorPage` | @platform/db, @platform/http |
| `RetryOptions` | @platform/db, @platform/net, @platform/notify, @platform/utils |
| `canonicalJson` | @platform/dencho, @platform/json |
| `Progress` | @platform/elearning, @platform/ui |
| `z` | @platform/env, @platform/validation |
| `email` | @platform/faker, @platform/validation |
| `needsReview` | @platform/faq, @platform/ui |
| `FeedChannel` | @platform/feed, @platform/seo |
| `FeedEntry` | @platform/feed, @platform/seo |
| `SitemapEntry` | @platform/feed, @platform/seo |
| `buildAtomFeed` | @platform/feed, @platform/seo |
| `buildSitemapIndex` | @platform/feed, @platform/seo |
| `FieldType` | @platform/form, @platform/ui |
| `InvoiceLine` | @platform/freee, @platform/invoice, @platform/report |
| `buildInvoice` | @platform/freee, @platform/invoice |
| `copyFile` | @platform/fs, @platform/storage |
| `transition` | @platform/fsm, @platform/task |
| `POST` | @platform/guard, @platform/mcp, @platform/upload |
| `escapeHtml` | @platform/html, @platform/mail, @platform/utils |
| `normalizeNewlines` | @platform/html, @platform/utils |
| `normalizeSpace` | @platform/html, @platform/utils, @platform/validation |
| `truncate` | @platform/html, @platform/utils |
| `unescapeHtml` | @platform/html, @platform/utils |
| `IdempotencyStore` | @platform/http, @platform/observability |
| `createMemoryIdempotencyStore` | @platform/http, @platform/observability |
| `withIdempotency` | @platform/http, @platform/observability |
| `NormalizeOptions` | @platform/image, @platform/url |
| `movingAverage` | @platform/inventory, @platform/utils |
| `Rounding` | @platform/invoice, @platform/tax |
| `TaxRate` | @platform/invoice, @platform/tax |
| `TaxSummary` | @platform/invoice, @platform/tax |
| `daysUntilDue` | @platform/invoice, @platform/task |
| `isValidInvoiceNumber` | @platform/invoice, @platform/tax |
| `normalizeInvoiceNumber` | @platform/invoice, @platform/tax |
| `renderInvoiceHtml` | @platform/invoice, @platform/report |
| `deepMerge` | @platform/json, @platform/utils |
| `percentile` | @platform/loadtest, @platform/utils |
| `LogLevel` | @platform/logger, @platform/ui |
| `createMemoryTransport` | @platform/mail, @platform/sms |
| `isSameDomain` | @platform/mail, @platform/url |
| `isValidEmail` | @platform/mail, @platform/ui |
| `AudioRecorder` | @platform/mobile, @platform/ui |
| `copyToClipboard` | @platform/mobile, @platform/ui |
| `backoffDelay` | @platform/net, @platform/realtime |
| `retry` | @platform/net, @platform/utils |
| `Alert` | @platform/observability, @platform/ui |
| `maskPhone` | @platform/phone, @platform/pii |
| `maskEmail` | @platform/pii, @platform/utils |
| `PrintOptions` | @platform/print, @platform/report |
| `isExpired` | @platform/push, @platform/quote |
| `stripHtml` | @platform/security, @platform/utils |
| `isValidCorporateNumber` | @platform/tax, @platform/validation |
| `HighlightSegment` | @platform/ui, @platform/utils |
| `formatBytes` | @platform/ui, @platform/utils |
| `inRange` | @platform/ui, @platform/utils |
| `lerp` | @platform/ui, @platform/utils |
| `mapRange` | @platform/ui, @platform/utils |
| `round` | @platform/units, @platform/utils |
| `toHalfWidth` | @platform/utils, @platform/validation |

## 似た概念の export(35 組・上位20)

| 概念 | 該当 |
|---|---|
| address | @platform/address:AddressAdapter / @platform/address:AddressResult / @platform/faker:address / @platform/mail:formatAddress / @platform/mail:parseAddress |
| auth | @platform/apikey:AuthResult / @platform/session:AuthProvider |
| statemachine | @platform/blueprint:toStateMachine / @platform/fsm:StateMachine / @platform/fsm:createStateMachine |
| text | @platform/bluetooth:parseText / @platform/mcp:textResult |
| category | @platform/board:Category / @platform/cms:CategoryInput / @platform/cms:CategoryStore |
| timetominutes | @platform/booking:timeToMinutes / @platform/payroll:parseTimeToMinutes |
| announcement | @platform/cms:AnnouncementInput / @platform/cms:AnnouncementStore / @platform/site:Announcement |
| page | @platform/cms:PageInput / @platform/cms:PageStore / @platform/print:PageOptions / @platform/site:Page |
| pageview | @platform/cms:toPageView / @platform/ui:PageviewOptions / @platform/ui:usePageview |
| context | @platform/context:getContext / @platform/logger:ContextStore / @platform/logger:createContextStore / @platform/rag:buildContext |
| daterange | @platform/datetime:DateRange / @platform/validation:dateRange |
| query | @platform/db:QueryInfo / @platform/url:parseQuery |
| json | @platform/db:toJson / @platform/mcp:jsonResult |
| client | @platform/device:ClientInfo / @platform/device:getClientInfo / @platform/ui:useClientInfo |
| submit | @platform/form:SubmitOptions / @platform/form:SubmitResult / @platform/ui:useSubmit |
| i18n | @platform/i18n:I18nOptions / @platform/i18n:createI18n / @platform/ui:useI18n |
| locale | @platform/i18n:Locale / @platform/ui:LocaleProvider / @platform/ui:LocaleStore / @platform/ui:isLocale |
| share | @platform/mobile:share / @platform/ui:Share |
| safeurl | @platform/net:SafeUrlOptions / @platform/url:isSafeUrl |
| receipt | @platform/print:createReceipt / @platform/purchase:Receipt |

## 孤立パッケージ(0)

なし。
