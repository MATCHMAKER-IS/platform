# パッケージ一覧(カテゴリ別)

> 自動生成: `node tools/gen-module-list.mjs`(手で編集しない)。
> 目的: AI・新規参加者が「既にある部品」を再実装せず使うためのインデックス。詳細は各 `packages/<name>/README.md` を参照。
>
> 印は**どこまで動作が確かめられているか**を示す(自動判定)。
>
> - 印なし … `apps/` の実アプリで使われている
> - **⚠ デモのみ** … `demos/` でしか使われていない。**正常系しか通っていない**ので、
>   実データ・異常系で最初に使う人がバグを踏む可能性がある
> - **⚠ 未実戦** … どこからも import されていない。動作が一度も確かめられていない
>
> 意図して使っていないものには「未実戦の理由」を添えてある。

## 基礎(型・共通)

- **@platform/core** — **失敗の形を全体で揃える**ための土台です。112 パッケージのうち 54 がこれに依存しています。
  - 主なexport: AppError, Bulkhead, BulkheadOptions, CircuitBreaker, CircuitBreakerOptions, CircuitState, …(全30)
- **@platform/logger** — pino をラップした構造化ロガー。`console.log` の代わりにこれを使います。
  - 主なexport: ContextStore, DEFAULT_REDACT_PATHS, LogContext, LogLevel, Logger, LoggerOptions, …(全8)
- **@platform/env** — 起動時に環境変数を zod で検証し、必須値が無ければ即失敗(fail-fast)させます。
  - 主なexport: EnvVarInfo, SecretIssue, assertSecretStrength, checkSecretStrength, describeEnv, env, …(全16)
- **@platform/config** — **共有ビルド設定パッケージ**(ランタイムコードは持ちません)。
  - 主なexport: (api-surface未計上)
- **@platform/validation** **⚠ デモのみ** — zod をベースにした共通バリデーション。日本の業務アプリで頻出するパターンを集約しています。
  - 主なexport: FileConstraintOptions, IdentityDocumentType, PREFECTURES, PasswordOptions, accountNumber, agreement, …(全58)
- **@platform/utils** — 規律ある汎用ヘルパー。`sleep` / `chunk` / `groupBy` / `uniqueBy` / `assertNever` /
  - 主なexport: Decomposition, FormatNumberOptions, FormatRangeOptions, HighlightSegment, HistogramBin, HistogramOptions, …(全155)
- **@platform/datetime** — 日本時間(JST)前提の日時ユーティリティ。UTC で保存し、表示・境界計算は JST で行います。
  - 主なexport: BusinessHours, DateRange, FormatDurationOptions, Holiday, JST, Wareki, …(全62)
- **@platform/context** — リクエストスコープのコンテキスト(相関ID)。`AsyncLocalStorage` で 1 リクエストの間
  - 主なexport: Childable, RequestContext, bindLogger, getContext, getRequestId, runWithContext, …(全7)
- **@platform/testing** **⚠ 未実戦** — テスト支援ツール。
  - 主なexport: fakeAuthUser, fakeSession, fixedDate, runCacheContract, runStorageContract, testId
  - 未実戦の理由: テストを書くための支援ツール。**テストの中から使う**ものなので、アプリやデモから import されないのが正常。
- **@platform/faker** **⚠ デモのみ** — 日本語のダミーデータ生成(@faker-js/faker の ja ロケール)。開発シード・デモ・負荷試験用。
  - 主なexport: address, companyName, email, faker, japaneseName, phoneNumber, …(全9)
- **@platform/debug** — **Platform Debugger** — 開発時に「1 リクエストの中で何が起きたか」を可視化します。
  - 主なexport: DebugCollector, DebugCollectorOptions, DebugEvent, DebugEventKind, DebugRequest, DebugSummary, …(全10)

## セキュリティ

- **@platform/crypto** — 機密データの暗号化(AES-256-GCM)とパスワードハッシュ(scrypt)。`node:crypto` ベース。
  - 主なexport: PasswordGenerateOptions, PasswordStrength, decrypt, deriveKey, encrypt, generatePassword, …(全10)
- **@platform/security** — Web セキュリティの共通部品。
  - 主なexport: CSRF_COOKIE, CSRF_HEADER, Csrf, MemoryReplayStoreOptions, ReplayGuard, ReplayGuardOptions, …(全16)
- **@platform/guard** **⚠ デモのみ** — ルート/ページ保護のガード。セッション・RBAC・レート制限を Route の入口で強制します。
  - 主なexport: enforceRateLimit, requirePermission, requireRole, requireSession
- **@platform/secrets** — シークレット取得の抽象。環境変数の平文直読みを避け、取得元(env / AWS Secrets Manager / Vault)を
  - 主なexport: SecretProvider, SecretStore, SecretStoreOptions, createChainProvider, createEnvProvider, createFetchProvider, …(全7)
- **@platform/pii** — 個人情報(PII)の保護ヘルパー。マスキング・検索可能暗号(blind index)・フィールド暗号・匿名化。
  - 主なexport: DisclosureHolding, DisclosureReport, ErasureDecision, ErasureMethod, ErasureReceipt, FieldCipher, …(全29)
- **@platform/apikey** — API キー / マシン間(M2M)認証。サービス間連携・外部システム向けのキー発行・検証・スコープ制御。
  - 主なexport: ApiKeyRecord, ApiKeyStore, AuthResult, GenerateApiKeyOptions, GeneratedApiKey, authenticateApiKey, …(全11)
- **@platform/ratelimit** — レート制限(固定ウィンドウ)。ログイン試行や API 濫用の抑止に使います。
  - 主なexport: RateLimitResult, RateLimitStore, RateLimiter, RateLimiterConfig, createMemoryStore, createRateLimiter, …(全7)
  - サブパス: `@platform/ratelimit/browser`
- **@platform/access-review** **⚠ デモのみ** — 権限の棚卸し（アクセスレビュー）と、退職・異動時の停止手順。
  - 主なexport: AccessGrant, EmploymentStatus, OffboardingStep, Person, ReviewFinding, ReviewOptions, …(全12)

## 認証・認可

- **@platform/auth** — 認証・認可の共通部品。
  - 主なexport: AuthUser, AuthenticationOptionsInput, AuthenticatorData, AuthenticatorFlags, BackupCodeRecord, BackupCodeVerifyResult, …(全89)
- **@platform/session** — セッション・クッキー処理の共通部品。
  - 主なexport: AccessDecision, ActivityTarget, AttemptRecord, BlockRecord, CookieOptions, IDLE_ACTIVITY_EVENTS, …(全44)
  - サブパス: `@platform/session/idle-timer`

## データ

- **@platform/db** — Prisma をラップした DB アクセス部品。**通常の CRUD は Prisma Client**、
  - 主なexport: AuditCapableClient, AuditChangeEntry, AuditEntry, BulkInsertOptions, CursorPage, CursorPaginateOptions, …(全75)
  - サブパス: `@platform/db/tunnel`
- **@platform/cache** **⚠ 未実戦** — キャッシュの共通部品(Adapter パターン)。
  - 主なexport: Cache, CacheAdapter, RedisCacheClient, RedisCacheConfig, TaggedCache, createCache, …(全10)
  - サブパス: `@platform/cache/tagged`
- **@platform/storage** — ファイル操作の共通部品(Adapter パターン)。保存先を意識せず使えます。
  - 主なexport: BatchResult, FallbackStorageOptions, PresignOptions, PutOptions, S3StorageConfig, Storage, …(全20)
  - サブパス: `@platform/storage/operations`
- **@platform/web-storage** **⚠ 未実戦** — 端末に残す設定・下書き(localStorage / sessionStorage)。**ブラウザ専用・依存は core のみ。**
  - 主なexport: StorageKind, WebStorageLike, WebStorageOptions, WebStore, clearNamespace, createMemoryWebStorage, …(全7)
- **@platform/fs** **⚠ デモのみ** — ファイル/フォルダ操作とパスユーティリティ。ファイル種別判定(マジックバイト)や
  - 主なexport: FileTypeInfo, WalkOptions, basename, changeExt, copyDir, copyFile, …(全34)
  - サブパス: `@platform/fs/magic`
- **@platform/csv** — CSV の生成・解析・ダウンロード。生成/解析は純関数、`downloadCsv` はブラウザ専用。
  - 主なexport: ColumnSpec, ColumnType, CsvChunkHandler, CsvChunkProgress, CsvColumn, CsvLineSource, …(全23)
  - サブパス: `@platform/csv/import`
- **@platform/xlsx** — Excel(.xlsx)の読み書き。行=オブジェクトの配列として扱えます(内部は ExcelJS)。
  - 主なexport: Row, SheetInput, WriteOptions, readSheet, writeSheet, writeWorkbook
- **@platform/search** — 全文検索の共通部品(Adapter パターン)。
  - 主なexport: Bm25Index, Bm25Options, FieldBoosts, MeilisearchConfig, Search, SearchAdapter, …(全13)

## 通信

- **@platform/http** **⚠ デモのみ** — HTTP 層の共通規約。`AppError` を HTTP ステータスへ変換し、
  - 主なexport: CursorPage, CursorPaging, DEFAULT_LIMIT, HttpErrorBody, MAX_LIMIT, OffsetPage, …(全18)
- **@platform/net** **⚠ デモのみ** — ネットワークユーティリティ。指数バックオフ・タイムアウト・IP/CIDR 判定に加え、
  - 主なexport: BackoffOptions, FramedConnection, FramedServer, LengthPrefixedDecoder, LineDecoder, PollOptions, …(全31)
  - サブパス: `@platform/net/browser`
- **@platform/mail** — メール送信の共通部品(Adapter パターン)。`createMailer()` で作った Mailer の `sendMail` を呼ぶだけで、送信基盤(SMTP / Resend)を意識せずに済みます。
  - 主なexport: ApplyPolicyOptions, AttachmentLimits, EmailAddress, EmailTemplate, HtmlEmailLayoutOptions, MailAttachment, …(全53)
- **@platform/sms** **⚠ デモのみ** — SMS 送信の共通部品(Adapter パターン)。`mail` と同じ構造です。
  - 主なexport: MemorySmsTransport, OtpSmsOptions, Sms, SmsEncoding, SmsFallbackOptions, SmsInfo, …(全21)
  - サブパス: `@platform/sms/browser`
- **@platform/notify** — チャット通知の共通部品(Adapter パターン)。業務イベントの通知に使います。
  - 主なexport: AsyncSeenStore, CategoryPreference, ChannelResult, DedupOptions, DeliveryChannel, DeliveryDecision, …(全42)
- **@platform/os-notify** — OS ネイティブのデスクトップ通知・音を鳴らします(Windows / macOS / Linux)。
  - 主なexport: OsCommand, OsNotification, OsNotifier, OsNotifierOptions, OsNotifyLogEntry, OsNotifyLogStore, …(全12)
- **@platform/realtime** — 自動更新の基盤(ポーリング・再接続 WebSocket)。フレームワーク非依存。
  - 主なexport: BroadcastHub, BroadcastHubOptions, Poller, ReconnectingWebSocket, ReconnectingWsOptions, RedisPubSubClient, …(全12)
- **@platform/integrations** **⚠ 未実戦** — 外部サービス連携の共通土台。型付き HTTP クライアントを提供します
  - 主なexport: ApiClient, ApiClientConfig, MultipartBody, MultipartFile, RequestOptions, createApiClient
- **@platform/webhook** **⚠ デモのみ** — Webhook 受信の共通枠組み。外部サービス(Stripe/Zoho/LINE/GitHub 等)からの Webhook を
  - 主なexport: WebhookHandler, WebhookIdempotencyStore, WebhookOutcome, WebhookReceiver, WebhookReceiverOptions, createMemoryWebhookStore, …(全8)

## AI基盤

- **@platform/ai** — **AI Gateway**。アプリから AI プロバイダ(Anthropic / OpenAI 等)を直接呼ばず、必ずここを経由します(開発ルール)。Gateway が一括で担うもの:
  - 主なexport: AiCallLog, AiChatRequest, AiChatSuccess, AiEmbedder, AiGateway, AiGatewayOptions, …(全24)
- **@platform/rag** — **RAG(検索拡張生成)の骨格**。役割は「検索」(操作は @platform/mcp)。以下を提供します:
  - 主なexport: AccessControl, ChunkOptions, Embedder, PgVectorDb, Principal, RagChunk, …(全23)
- **@platform/mcp** — **MCP(Model Context Protocol)サーバの最小実装**。JSON-RPC 2.0 上で `initialize` / `tools/list` / `tools/call` を提供し、Claude Desktop / Claude Code などの MCP クライアントから社内基盤の機能を「ツール」として呼び出せるようにします。
  - 主なexport: HttpMcpOptions, JsonRpcRequest, JsonRpcResponse, McpCallContext, McpPromptDef, McpResourceDef, …(全20)

## 外部SaaS連携

- **@platform/zoho** — Zoho CRM API(v8)クライアント。Leads / Contacts / Deals などのレコード CRUD。
  - 主なexport: AnalyticsRecord, AppointmentInput, AuthorizationUrlInput, BookingsRecord, BooksListResult, BooksPageContext, …(全84)
  - サブパス: `@platform/zoho/analytics` / `@platform/zoho/bookings` / `@platform/zoho/books` / `@platform/zoho/campaigns` / `@platform/zoho/cliq` / `@platform/zoho/core` / `@platform/zoho/creator` / `@platform/zoho/crm` / `@platform/zoho/desk` / `@platform/zoho/inventory` / `@platform/zoho/people` / `@platform/zoho/projects` / `@platform/zoho/recruit` / `@platform/zoho/sign` / `@platform/zoho/workdrive`
- **@platform/google** **⚠ デモのみ** — Google Workspace 連携の総合クライアント。**ログイン(OAuth)/ ユーザー情報 / Sheets /
  - 主なexport: GmailClient, GmailMessageInput, GoogleAuthUrlParams, GoogleCalendarClient, GoogleDriveClient, GoogleMapsClient, …(全22)
- **@platform/microsoft** **⚠ デモのみ** — Microsoft 365 / Entra ID(旧 Azure AD)との連携。OAuth と Microsoft Graph を型付きで扱います。
  - 主なexport: GraphEvent, GraphEventInput, GraphFile, GraphMailInput, GraphUser, MicrosoftAuthUrlParams, …(全15)
- **@platform/slack** **⚠ デモのみ** — Slack の Web API と、Slack **からの受信**（イベント・スラッシュコマンド）の署名検証。
  - 主なexport: ApprovalRequest, SlackClient, SlackInteraction, SlackMessage, SlackPostResult, SlackSignatureInput, …(全13)
- **@platform/notion** **⚠ デモのみ** — Notion のデータベース照会・ページ作成/更新・本文取得。
  - 主なexport: NOTION_VERSION, NotionClient, NotionPage, NotionPropertyInput, createNotionClient
- **@platform/line** **⚠ デモのみ** — LINE Messaging API の総合クライアント + メッセージビルダー + Webhook 受信。
  - 主なexport: CarouselColumn, LineAction, LineClient, LineEventBase, LineEventSource, LineMessage, …(全31)
- **@platform/freee** — freee 会計 API クライアント + OAuth トークン管理 + 証憑・振替伝票。
  - 主なexport: BalancePoint, BalanceSnapshot, BalanceSummary, DealDetail, DealType, FreeeClient, …(全38)
- **@platform/stripe** **⚠ 未実戦** — Stripe 決済クライアント(公式 `stripe` SDK ラッパー)。
  - 主なexport: Stripe, StripeClient, createStripeClient
  - 未実戦の理由: 公式 SDK(`stripe`)のラッパーで、**fetch を差し替える口が無い**。注入口を足すと SDK の使い方を歪めるため、デモ化は見送っている。**契約テストも効かない**(ラッパーが応答のフィールドを直接参照せず SDK に委ねているため、`check-contract` の C003 が「実装が参照していない」と判定する)。確認は sandbox キーでの実接続に頼るしかない。
- **@platform/paypal** **⚠ デモのみ** — PayPal 決済クライアント(Orders v2)。client_id / client_secret から
  - 主なexport: PayPalClient, PayPalConfig, createPayPalClient
- **@platform/ekyc** **⚠ デモのみ** — eKYC(オンライン本人確認)ベンダー連携コネクタ。TRUSTDOCK 等の API を型付きで扱い、
  - 主なexport: EkycClient, EkycClientConfig, EkycEndpoints, EkycStatus, EkycWebhookEvent, createEkycClient, …(全12)

## 非同期・フロー制御

- **@platform/jobs** **⚠ デモのみ** — 非同期ジョブ(キュー)の共通部品。重い処理・遅延処理をリクエストから切り離します
  - 主なexport: FailedJob, JobDefinition, JobsConnection, MemoryQueue, MemoryQueueOptions, QueueLike, …(全12)
  - サブパス: `@platform/jobs/browser`
- **@platform/rpa** — RPA を**安全に実行するための共通部品**(ランナー骨格)。基盤は RPA 本体(ブラウザ自動操作など)は持ちません。壁打ちの優先順位は **API > MCP > RPA** で、RPA は最後の手段です。
  - 主なexport: RpaAuditEvent, RpaAuditSink, RpaContext, RpaLock, RpaRetryOptions, RpaRunResult, …(全9)
- **@platform/cron** — 定期実行(スケジューラ)の共通部品。内部は croner。既定タイムゾーンは Asia/Tokyo。
  - 主なexport: AcquireFileLockOptions, CronErrorHandler, CronJob, CronResultHandler, FileLockOptions, GuardOptions, …(全19)
  - サブパス: `@platform/cron/browser`
- **@platform/workflow** — 多段承認ワークフローの状態機械(外部依存なしの純ロジック)。状態の永続化はアプリ側。
  - 主なexport: Actor, AmountTier, ApproverDirectory, Delegation, ParallelState, ParallelStep, …(全37)
- **@platform/fsm** **⚠ デモのみ** — 汎用ステートマシン(純関数)。在庫・チケット・配送などの状態遷移を宣言的に定義します。
  - 主なexport: RunResult, StateMachine, StateMachineDefinition, Transitions, availableEvents, can, …(全10)
- **@platform/blueprint** — Zoho CRM のブループリントに相当。業務プロセスを状態と遷移で宣言的に定義し、遷移ごとの
  - 主なexport: Blueprint, BlueprintTransition, TransitionResult, applyTransition, availableTransitions, evaluateTransition, …(全10)
- **@platform/saga** **⚠ デモのみ** — saga(補償トランザクション)。複数ステップの処理を順に実行し、途中で失敗したら**完了済みステップを逆順で打ち消し**ます。外部API連携など「全体をDBトランザクションで囲えない」処理の一貫性を保つための基盤です。
  - 主なexport: SagaResult, SagaStep, runSaga, sagaStep
- **@platform/flags** — フィーチャーフラグ(依存ゼロ)。kill switch・段階リリース・ターゲティング・A/B バリアント。
  - 主なexport: FlagContext, FlagDefinitions, FlagProvider, FlagRule, Flags, bucketOf, …(全11)

## UI・表現

- **@platform/ui** — Tailwind CSS + shadcn/ui の慣習に沿った共通 UI 部品。内部は Radix(統合 `radix-ui`)/
  - 主なexport: Accordion, AccordionContent, AccordionItem, AccordionTrigger, ActivityTimeline, ActivityTimelineProps, …(全833)
  - サブパス: `@platform/ui/icons`
- **@platform/form** **⚠ デモのみ** — フォーム統合(react-hook-form + zod + `@platform/ui`)。
  - 主なexport: AutocompleteField, CheckboxField, ColorField, ComboboxField, CsrfField, DateField, …(全74)
- **@platform/report** — 帳票(請求書・見積書等)。日本の消費税計算と印刷用 HTML を提供します。
  - 主なexport: ExpenseRecord, ExpenseRow, ExtractedFields, InvoiceCalcOptions, InvoiceCalculation, InvoiceDocument, …(全42)
- **@platform/pdf** — 帳票 PDF 生成(HTML → PDF)。請求書・報告書を HTML/CSS でレイアウトして PDF 化します。
  - 主なexport: DEFAULT_INVOICE_PDF_OPTIONS, PdfOptions, PdfRenderer, PdfService, createPdf, createPlaywrightRenderer
- **@platform/print** **⚠ デモのみ** — 印刷処理。ブラウザ印刷とサーマルプリンタ(ESC/POS)。
  - 主なexport: Align, PageOptions, PrintElementOptions, PrintOptions, RECEIPT_PROFILES, ReceiptBuilder, …(全14)
- **@platform/barcode** **⚠ デモのみ** — QR コード・バーコードの**発行**(生成)。
  - 主なexport: AssetUrlOptions, BarcodeFormat, BarcodeOptions, QrLevel, QrOptions, barcodeSvg, …(全9)
- **@platform/i18n** — 軽量 i18n。翻訳カタログ + 補間 + フォールバック + Intl 整形(数値/通貨/日付/相対時間/複数形)。
  - 主なexport: Catalog, Catalogs, I18nOptions, LOCALES, LOCALE_LABELS, Locale, …(全13)
  - サブパス: `@platform/i18n/catalogs`
- **@platform/color** **⚠ 未実戦** — 色ユーティリティ(純関数)。hex⇔rgb⇔hsl 変換・WCAG コントラスト比・明暗調整・混色。
  - 主なexport: Hsl, Rgb, contrastRatio, darken, hexToRgb, hslToRgb, …(全13)
- **@platform/html** — HTML/テキストのヘルパー（すべて純関数）。
  - 主なexport: collapseWhitespace, embedAsText, embedHtml, embedIframe, embedScript, escapeAttribute, …(全22)
- **@platform/theme** — デザインテーマ（スキン）機構。WordPress のテーマのように、色・フォント・角丸・余白・影を 1 セットにした「スキン」を切り替えられます。明暗（light/dark）とは直交し、後からテーマを追加できる拡張性を持ちます。React 非依存の純ロジックです（UI 連携は `@platform/ui` の `SkinProvider` / `SkinSelector`）。
  - 主なexport: ContrastCheck, CreateThemeRegistryOptions, Theme, ThemeContrastReport, ThemeMode, ThemeRegistry, …(全41)

## メディア・デバイス

- **@platform/media** **⚠ デモのみ** — 動画・音声の処理(ffmpeg ラッパー)。メタ情報取得・変換・音声抽出・サムネイル・トリミング。
  - 主なexport: MediaInfo, MediaProcessor, createMediaProcessor
- **@platform/image** — サーバ側の画像処理(sharp ラッパー)。順序付きの操作リストを適用します。
  - 主なexport: BackgroundRemover, FitMode, FitOptions, GenericRemoverOptions, Gravity, ImageFormat, …(全27)
  - サブパス: `@platform/image/geometry`
- **@platform/ocr** **⚠ デモのみ** — 画像の文字認識(OCR)。エンジンを抽象化し、ローカル(tesseract.js)/クラウド(HTTP API)を差し替え可能。
  - 主なexport: FieldWithConfidence, HttpOcrOptions, InvoiceFields, LineItem, OcrEngine, OcrResult, …(全26)
- **@platform/upload** — アップロード/ダウンロードの HTTP 境界処理。multipart 受け取り→検証→保存、ダウンロード応答。
  - 主なexport: DownloadOptions, POST, UploadOptions, UploadedFile, downloadFromStorage, handleUpload, …(全7)
- **@platform/device** **⚠ デモのみ** — 端末・ブラウザ・OS・ネットワーク等のクライアント情報取得。
  - 主なexport: ClientInfo, DeviceType, GeoPosition, UserAgentInfo, getClientInfo, parseUserAgent, …(全7)
- **@platform/mobile** — タブレット・スマホなどモバイル端末向けの処理。レスポンシブ判定・ネットワーク状態・画面向きの
  - 主なexport: BarcodeKind, Breakpoints, CacheRule, CacheStrategy, CameraConstraintsInput, CameraDevice, …(全67)
- **@platform/bluetooth** **⚠ デモのみ** — Web Bluetooth(BLE 機器連携)の共通部品。ブラウザ専用(Chrome/Edge、HTTPS または localhost、
  - 主なexport: BluetoothConnection, BluetoothUUID, ConnectOptions, DeviceFilter, DeviceInformation, GATT, …(全16)
- **@platform/hid** **⚠ 未実戦** — WebHID(PC 周辺機器連携)。キーボード・バーコードリーダー・カードリーダー・独自 HID 機器と
  - 主なexport: HidConnection, HidFilter, connectHid, isHidSupported, reportBytes

## 業務ドメイン

- **@platform/address** **⚠ デモのみ** — 郵便番号から住所を逆引きする共通部品(Adapter パターン)。
  - 主なexport: AddressAdapter, AddressLookup, AddressResult, createAddressLookup, createZipcloudAdapter, normalizeZipcode
- **@platform/phone** **⚠ デモのみ** — 日本の電話番号 + 国際(E.164)ユーティリティ。正規化・種別判定・整形・マスキング。
  - 主なexport: E164Parts, IntlPhoneType, PhoneType, detectCountry, formatJpPhone, fromE164, …(全15)
- **@platform/currency** **⚠ デモのみ** — 通貨・為替ユーティリティ(純関数)。通貨メタ・端数処理・レート換算・複数通貨合算。
  - 主なexport: CurrencyMeta, Money, addMoney, convert, currencyMeta, formatMoney, …(全10)
- **@platform/units** **⚠ デモのみ** — 単位変換(純関数)。長さ・重さ・面積・体積・温度、および日本の尺貫法(坪/畳)に対応。
  - 主なexport: AreaUnit, LengthUnit, TempUnit, VolumeUnit, WeightUnit, convertArea, …(全11)
- **@platform/tax** — 日本の消費税・インボイス(適格請求書)ユーティリティ(純関数)。
  - 主なexport: DocumentType, PENALTY_MULTIPLIER, Rounding, StampTaxInput, StampTaxResult, TaxLine, …(全28)
  - サブパス: `@platform/tax/stamp`
- **@platform/importer** **⚠ デモのみ** — 一括インポートの共通枠組み(依存ゼロ)。CSV/Excel 取込の「行ごと検証 → エラー行集約 →
  - 主なexport: ErrorRow, ImportOptions, ImportResult, RowResult, RowValidator, ValidRow, …(全10)
- **@platform/sequence** **⚠ デモのみ** — 帳票番号などの連番採番(依存ゼロ)。請求書・伝票番号を、プレフィックス・ゼロ埋め・
  - 主なexport: ResetPeriod, SequenceOptions, SequenceStore, Sequencer, createMemorySequenceStore, createSequencer, …(全7)
- **@platform/zengin** **⚠ デモのみ** — 全銀協レコードフォーマット(総合振込)の生成(純関数)。給与・支払データを
  - 主なexport: AccountType, Consignor, TransferRecord, ZenginResult, buildDataRecord, buildHeader, …(全9)
- **@platform/payroll** — 勤怠・給与計算(労働基準法)。出退勤からの労働時間集計、時間外・深夜・法定休日の割増賃金、
  - 主なexport: BONUS_CAPS, BonusInsuranceDeduction, BonusPayment, BonusRateRow, BonusRateTable, DEFAULT_PREMIUM_RATES, …(全49)
- **@platform/dencho** **⚠ デモのみ** — 電子帳簿保存法(電帳法)対応の部品。電子取引データ保存の「真実性の確保」と「可視性の確保」、
  - 主なexport: ChainVerification, DEFAULT_RETENTION_YEARS, EvidenceRecord, GENESIS_HASH, TimestampToken, TransactionQuery, …(全19)
- **@platform/commerce** — EC サイトの基盤処理。カート・お気に入り・クーポン割引・注文サマリ(消費税/送料)・在庫引当の
  - 主なexport: AddToCartInput, Cart, CartItem, Coupon, DiscountType, Favorites, …(全81)
- **@platform/invoice** — 明細計算・税率別集計・番号採番・支払期限/入金状態。消費税計算は `@platform/tax` に委譲します。
  - 主なexport: AgingBuckets, ApplyPaymentResult, BillingInterval, DUNNING_LABELS, DUNNING_THRESHOLDS, DunningInvoice, …(全44)
- **@platform/quote** — 明細計算は `@platform/invoice` を再利用し、見積特有の**有効期限・状態・請求書変換**を提供します。
  - 主なexport: CostLine, Discount, DiscountedLines, MarginResult, Quote, QuoteRevision, …(全19)
- **@platform/purchase** — 発注明細・金額(税計算は `@platform/invoice` 再利用)・入荷/発注残・状態を扱います。
  - 主なexport: DEFAULT_TOLERANCE, DuplicateSuspicion, LineReceivingStatus, MatchLine, MatchTolerance, Mismatch, …(全22)
- **@platform/inventory** — 入出庫台帳・発注点・在庫評価(移動平均）。発注入荷（`@platform/purchase`）や売上出荷を入出庫として記録します。
  - 主なexport: Allocation, LotBalance, LotMovement, MovementSummary, MovementType, ReorderPolicy, …(全25)
- **@platform/accounting** — 業務イベントを勘定科目つきの複式仕訳に変換し、貸借均衡・試算表・freee 連携をサポートします。
  - 主なexport: AccountBalance, AccountNames, AccountType, AccountTypeMap, BalanceSheet, DEFAULT_ACCOUNTS, …(全45)
- **@platform/audit** — 「誰が・いつ・何を・どう変えたか」を追記専用で記録し、**ハッシュチェーンで改ざんを検知**します。
  - 主なexport: AuditEntry, AuditEvent, ChainVerification, DiffOptions, FieldChange, HashFn, …(全18)
- **@platform/depreciation** — 固定資産の減価償却を計算します。**帳簿と申告に使う数字**なので、端数の扱いを法令に合わせてあります。
  - 主なexport: AssetValuation, DepreciableAsset, DepreciationMethod, MEMORANDUM_VALUE, RESIDUAL_RATE, STANDARD_TAX_RATE, …(全23)
- **@platform/booking** — 予約サイトの基盤処理。営業時間・スロット生成・空き枠計算(キャパシティ考慮)・予約ルール・
  - 主なexport: BOOKING_STATUS_LABELS, BOOKING_TRANSITIONS, BookingInterval, BookingStatus, BookingWindow, HoursOverrides, …(全51)
- **@platform/cast** **⚠ デモのみ** — キャスト(スタッフ/タレント)の基盤処理。一覧の絞り込み(タグ)・並び替え(注目/評価/新人)・
  - 主なexport: Cast, CastSort, CastStatus, ProfileField, ProfileItem, RankedCast, …(全22)
- **@platform/elearning** — 社内 e-learning の中核ロジック。コース構造・進捗計算・クイズ採点・修了判定を純関数で提供します。データ永続化と画面はアプリ側に委ねます。
  - 主なexport: Certificate, Course, Lesson, Module, Progress, QuestionResult, …(全15)
- **@platform/task** — タスク管理の純ロジック（担当・期限・状態遷移・進捗）。
  - 主なexport: Task, TaskFilter, TaskPriority, TaskProgress, TaskSort, TaskStatus, …(全15)
- **@platform/contract** — 期間・自動更新・解約通知・更新期限アラートの純ロジック。
  - 主なexport: ApplicabilityResult, Contract, ContractAlert, ContractAlertLevel, ContractStatus, ContractSummary, …(全37)
- **@platform/attendance** — 勤怠の記録・集計と、年次有給休暇の計算。
  - 主なexport: AttendanceDay, AttendanceEntry, AttendanceRecord, AttendanceStore, AttendanceSummary, CheckupIssue, …(全55)

## コンテンツ・サイト

- **@platform/cms** — CMS(お知らせ・記事・ページ)の共通基盤。投稿モデル・下書き/公開/予約のステータス管理・改訂履歴・タグ/カテゴリ・公開申請までを部品化しています。
  - 主なexport: AnnouncementInput, AnnouncementLevel, AnnouncementRow, AnnouncementStore, AnnouncementStoreDb, BlogView, …(全81)
- **@platform/blog** **⚠ デモのみ** — ブログ/コンテンツの基盤処理。スラッグ生成・抜粋・読了時間・目次、記事の公開状態/絞り込み/関連記事、
  - 主なexport: AdjacentPosts, BlogPost, Comment, CommentNode, CommentStatus, ExcerptOptions, …(全46)
- **@platform/seo** — SEO のための機能。メタタグ・Open Graph / Twitter Card・JSON-LD 構造化データ・robots.txt の生成。
  - 主なexport: FaviconConfig, FeedChannel, FeedItem, JsonLd, MetaInput, MetaResult, …(全45)
- **@platform/site** — 公式サイト・LP のための基盤処理。ページ構成(セクションブロック)・ナビゲーションメニュー・
  - 主なexport: Announcement, Banner, BlockType, BreadcrumbFromPathOptions, CopyrightOptions, MenuItem, …(全32)
- **@platform/url** **⚠ デモのみ** — URL・ドメインの汎用処理。URL の解析/組み立て、クエリパラメータ操作、ドメイン抽出(eTLD+1)、
  - 主なexport: NormalizeOptions, TRACKING_PARAMS, UrlParts, appendParam, buildUrl, getHostname, …(全33)
- **@platform/social** — ソーシャル(X / TikTok / Instagram)連携の基盤処理。キャストの SNS アカウントを扱うための、
  - 主なexport: ALL_PLATFORMS, OEmbedOptions, PLATFORMS, ParsedSocialUrl, PlatformSpec, SHARE_LABELS, …(全38)
- **@platform/board** — 掲示板の純ロジック（スレッド・投稿・返信・リアクション）。
  - 主なexport: Attachment, AttachmentLimits, AttachmentResult, BlogLike, Categorized, Category, …(全43)
- **@platform/chat** — チャットの純ロジック（メッセージ・ルーム・未読管理）。リアルタイム配信は `@platform/realtime` と組み合わせる。
  - 主なexport: Attachment, AttachmentLimits, AttachmentResult, Bookmark, ChatMessage, ChatRoom, …(全40)
- **@platform/faq** — 質問と回答・カテゴリ・検索・「役に立った」投票の純ロジック。
  - 主なexport: FaqHit, FaqItem, FaqStats, FaqStatus, byCategory, helpfulRate, …(全12)

## 運用・可観測性

- **@platform/observability** — 依存ゼロの軽量トレーシング・メトリクス・耐障害プリミティブ。外部連携の可視化と保護に。
  - 主なexport: ActiveSpan, Alert, AlertManager, AlertRule, AsyncIdempotencyStore, CheckResult, …(全49)
- **@platform/status-page** — メンテナンス/システムエラー/停止/404 の画面テンプレートと、メンテナンス切り替えゲート。
  - 主なexport: MaintenanceConfig, MaintenanceDecision, MaintenanceRequestInfo, MaintenanceState, MaintenanceStore, StatusPageOptions, …(全20)
- **@platform/analytics** — サイト/アプリのアクセス解析(純ロジック)。イベント(ページビュー等)の記録形式と、集計関数を提供します。保存や送信は呼び出し側(アプリ/adapter)の責務です。
  - 主なexport: AnalyticsEvent, AnalyticsEventType, AnalyticsSummary, Beacon, BeaconDeps, BeaconPayload, …(全22)
- **@platform/loadtest** **⚠ デモのみ** — 簡易負荷試験の基盤(純ロジック)。シナリオ定義・実行・レイテンシ統計を提供します。HTTP実行自体は fetch を注入するため、テストではモックできます。
  - 主なexport: LatencyStats, LoadOptions, LoadResult, RequestFn, RequestOutcome, Scenario, …(全17)

