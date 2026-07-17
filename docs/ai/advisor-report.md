# Advisor レポート(自動生成)

> 再生成: `node tools/advisor.mjs report`。生成日: 2026-07-17

重複や似た API は「わざと(層が違う)」の場合もあります。這は**再利用の当たりを付ける入口**であり、機械的な指摘です。

## 同名 export(83 組)

| export | 提供パッケージ |
|---|---|
| `AccountType` | @platform/accounting, @platform/zengin |
| `filterByPeriod` | @platform/accounting, @platform/audit |
| `summarize` | @platform/analytics, @platform/board, @platform/inventory, @platform/task |
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
| `buildRssFeed` | @platform/blog, @platform/seo |
| `buildSitemap` | @platform/blog, @platform/seo |
| `joinUrl` | @platform/blog, @platform/net |
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
| `recentPosts` | @platform/cms, @platform/social |
| `RetryOptions` | @platform/db, @platform/net, @platform/notify, @platform/utils |
| `Progress` | @platform/elearning, @platform/ui |
| `z` | @platform/env, @platform/validation |
| `email` | @platform/faker, @platform/validation |
| `needsReview` | @platform/faq, @platform/ui |
| `FieldType` | @platform/form, @platform/ui |
| `InvoiceLine` | @platform/freee, @platform/invoice, @platform/report |
| `buildInvoice` | @platform/freee, @platform/invoice |
| `transition` | @platform/fsm, @platform/task |
| `escapeHtml` | @platform/html, @platform/mail, @platform/utils |
| `normalizeNewlines` | @platform/html, @platform/utils |
| `normalizeSpace` | @platform/html, @platform/utils, @platform/validation |
| `truncate` | @platform/html, @platform/utils |
| `unescapeHtml` | @platform/html, @platform/utils |
| `NormalizeOptions` | @platform/image, @platform/url |
| `movingAverage` | @platform/inventory, @platform/utils |
| `Rounding` | @platform/invoice, @platform/tax |
| `TaxRate` | @platform/invoice, @platform/tax |
| `TaxSummary` | @platform/invoice, @platform/tax |
| `daysUntilDue` | @platform/invoice, @platform/task |
| `isValidInvoiceNumber` | @platform/invoice, @platform/tax |
| `normalizeInvoiceNumber` | @platform/invoice, @platform/tax |
| `renderInvoiceHtml` | @platform/invoice, @platform/report |
| `percentile` | @platform/loadtest, @platform/utils |
| `LogLevel` | @platform/logger, @platform/ui |
| `createMemoryTransport` | @platform/mail, @platform/sms |
| `isSameDomain` | @platform/mail, @platform/url |
| `isValidEmail` | @platform/mail, @platform/ui |
| `POST` | @platform/mcp, @platform/upload |
| `copyToClipboard` | @platform/mobile, @platform/ui |
| `backoffDelay` | @platform/net, @platform/realtime |
| `parseQuery` | @platform/net, @platform/url |
| `retry` | @platform/net, @platform/utils |
| `Alert` | @platform/observability, @platform/ui |
| `maskPhone` | @platform/phone, @platform/pii |
| `maskEmail` | @platform/pii, @platform/utils |
| `PrintOptions` | @platform/print, @platform/report |
| `stripHtml` | @platform/security, @platform/utils |
| `isValidCorporateNumber` | @platform/tax, @platform/validation |
| `HighlightSegment` | @platform/ui, @platform/utils |
| `formatBytes` | @platform/ui, @platform/utils |
| `inRange` | @platform/ui, @platform/utils |
| `lerp` | @platform/ui, @platform/utils |
| `mapRange` | @platform/ui, @platform/utils |
| `round` | @platform/units, @platform/utils |
| `toHalfWidth` | @platform/utils, @platform/validation |

## 似た概念の export(27 組・上位20)

| 概念 | 該当 |
|---|---|
| address | @platform/address:AddressAdapter / @platform/address:AddressResult / @platform/faker:address / @platform/mail:formatAddress / @platform/mail:parseAddress |
| statemachine | @platform/blueprint:toStateMachine / @platform/fsm:StateMachine / @platform/fsm:createStateMachine |
| text | @platform/bluetooth:parseText / @platform/mcp:textResult |
| category | @platform/board:Category / @platform/cms:CategoryInput / @platform/cms:CategoryStore |
| timetominutes | @platform/booking:timeToMinutes / @platform/payroll:parseTimeToMinutes |
| announcement | @platform/cms:AnnouncementInput / @platform/cms:AnnouncementStore / @platform/site:Announcement |
| page | @platform/cms:PageInput / @platform/cms:PageStore / @platform/print:PageOptions / @platform/site:Page |
| context | @platform/context:getContext / @platform/logger:ContextStore / @platform/logger:createContextStore / @platform/rag:buildContext |
| daterange | @platform/datetime:DateRange / @platform/validation:dateRange |
| client | @platform/device:ClientInfo / @platform/device:getClientInfo / @platform/ui:useClientInfo |
| i18n | @platform/i18n:I18nOptions / @platform/i18n:createI18n / @platform/ui:useI18n |
| locale | @platform/i18n:Locale / @platform/ui:LocaleProvider / @platform/ui:LocaleStore / @platform/ui:isLocale |
| share | @platform/mobile:share / @platform/ui:Share |
| receipt | @platform/print:createReceipt / @platform/purchase:Receipt |
| chunk | @platform/rag:ChunkOptions / @platform/utils:chunk |
| search | @platform/search:Search / @platform/search:SearchAdapter / @platform/search:createSearch / @platform/ui:SearchInput |
| sequence | @platform/sequence:SequenceOptions / @platform/sequence:SequenceStore / @platform/ui:isSequence / @platform/ui:parseSequence / @platform/utils:sequence |
| throttle | @platform/session:ThrottleStore / @platform/utils:throttle |
| kanban | @platform/task:toKanban / @platform/ui:Kanban |
| theme | @platform/theme:parseTheme / @platform/ui:ThemeProvider / @platform/ui:useTheme |

## 孤立パッケージ(1)

| パッケージ | 指摘 |
|---|---|
| @platform/config | public export なし |
