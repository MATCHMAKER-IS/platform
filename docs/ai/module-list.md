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

- **@platform/core** — すべての土台（`Result` 型・エラー分類・再試行の判定）。**依存ゼロ**です。
  - 主なexport: AppError, Bulkhead, BulkheadOptions, CircuitBreaker, CircuitBreakerOptions, CircuitState, …(全30)
- **@platform/logger** — ログの出力（構造化・伏せ字・レベル）。**後から探せる形で残す**ためのものです。
  - 主なexport: ContextStore, DEFAULT_REDACT_PATHS, LogContext, LogLevel, Logger, LoggerOptions, …(全8)
- **@platform/env** — 環境変数。**起動時に検査して、無いまま動かない**ようにします。
  - 主なexport: AppEnv, EnvVarInfo, SecretIssue, appEnv, appEnvLabel, assertSecretStrength, …(全22)
- **@platform/config** — 設定の管理（既定値・上書き・型付き取得）。
  - 主なexport: (api-surface未計上)
- **@platform/validation** — 日本の業務で使う識別子の検証（法人番号・マイナンバー・適格請求書番号）。
  - 主なexport: FileConstraintOptions, IdentityDocumentType, PREFECTURES, PasswordOptions, accountNumber, agreement, …(全58)
- **@platform/utils** — 小さな道具（文字・数値・配列・非同期）。**依存ゼロ**です。
  - 主なexport: Decomposition, FormatNumberOptions, FormatRangeOptions, HighlightSegment, HistogramBin, HistogramOptions, …(全157)
- **@platform/datetime** — 日付と時刻。**JST を前提**にした計算と表示を提供します。
  - 主なexport: BusinessHours, DateRange, FormatDurationOptions, Holiday, JST, Wareki, …(全66)
- **@platform/context** — リクエストごとの文脈（追跡 ID・利用者・テナント）。
  - 主なexport: Childable, RequestContext, bindLogger, getContext, getRequestId, runWithContext, …(全7)
- **@platform/testing** **⚠ 未実戦** — テストの補助（固定した時刻・連番・ダミーの応答）。
  - 主なexport: fakeAuthUser, fakeSession, fixedDate, runCacheContract, runStorageContract, testId
  - 未実戦の理由: テストを書くための支援ツール。**テストの中から使う**ものなので、アプリやデモから import されないのが正常。
- **@platform/faker** — 試験用のダミーデータ（氏名・住所・金額・日付）。
  - 主なexport: address, companyName, email, faker, japaneseName, phoneNumber, …(全9)
- **@platform/debug** — 開発用の調査ツール（クエリの記録・リクエストの追跡）。
  - 主なexport: DebugCollector, DebugCollectorOptions, DebugEvent, DebugEventKind, DebugRequest, DebugSummary, …(全10)

## セキュリティ

- **@platform/crypto** — 暗号（パスワードのハッシュ・鍵の導出・署名）。
  - 主なexport: PasswordGenerateOptions, PasswordStrength, decrypt, deriveKey, encrypt, generatePassword, …(全11)
  - サブパス: `@platform/crypto/strength`
- **@platform/security** — セキュリティの守り（CSP・埋め込み制御・再送防止・入力の無害化）。
  - 主なexport: CSRF_COOKIE, CSRF_HEADER, Csrf, MemoryReplayStoreOptions, ReplayGuard, ReplayGuardOptions, …(全17)
  - サブパス: `@platform/security/headers`
- **@platform/guard** — API と画面の入口の守り（ログイン確認・権限確認）。
  - 主なexport: POST, clientIp, currentSession, enforceRateLimit, guardWrite, matchesSharedToken, …(全9)
- **@platform/secrets** — 秘密情報の取得（環境変数・外部サービス）。**取得元を差し替えられます**。
  - 主なexport: SecretProvider, SecretStore, SecretStoreOptions, createChainProvider, createEnvProvider, createFetchProvider, …(全7)
- **@platform/pii** — 個人情報の伏せ字と暗号化。**外に出す前に隠します**。
  - 主なexport: DisclosureHolding, DisclosureReport, ErasureDecision, ErasureMethod, ErasureReceipt, FieldCipher, …(全29)
  - サブパス: `@platform/pii/mask`
- **@platform/apikey** — API キーの発行と検証。**外部システムから呼ばせる**ときに使います。
  - 主なexport: ApiKeyRecord, ApiKeyStore, AuthResult, GenerateApiKeyOptions, GeneratedApiKey, authenticateApiKey, …(全11)
- **@platform/ratelimit** — 回数の上限（ログイン試行・API 呼び出し）。**短時間の繰り返しを止めます**。
  - 主なexport: RateLimitResult, RateLimitStore, RateLimiter, RateLimiterConfig, createMemoryStore, createRateLimiter, …(全7)
  - サブパス: `@platform/ratelimit/browser`
- **@platform/access-review** — 権限の棚卸し（誰が何をできるか、いつ付いたか）。
  - 主なexport: AccessGrant, EmploymentStatus, OffboardingStep, Person, ReviewFinding, ReviewOptions, …(全12)

## 認証・認可

- **@platform/auth** — 権限の判定（この人はこの操作をしてよいか）。**ログインの仕組みとは分けてあります**。
  - 主なexport: AuthUser, AuthenticationOptionsInput, AuthenticatorData, AuthenticatorFlags, BackupCodeRecord, BackupCodeVerifyResult, …(全90)
  - サブパス: `@platform/auth/browser`
- **@platform/session** — ログインの状態（セッション・SSO・OAuth）。
  - 主なexport: AccessDecision, ActivityTarget, AttemptRecord, AuthProvider, AuthSessionOptions, AuthSessionPayload, …(全52)
  - サブパス: `@platform/session/browser` / `@platform/session/idle-timer`

## データ

- **@platform/db** — データベース（Prisma のラッパー・トランザクション・キャッシュ・全文検索）。
  - 主なexport: AuditCapableClient, AuditChangeEntry, AuditEntry, BulkInsertOptions, CreateDbOptions, CursorPage, …(全83)
  - サブパス: `@platform/db/tunnel`
- **@platform/cache** **⚠ 未実戦** — キャッシュ（メモリ・タグ無効化・TTL）。
  - 主なexport: Cache, CacheAdapter, RedisCacheClient, RedisCacheConfig, TaggedCache, createCache, …(全10)
  - サブパス: `@platform/cache/tagged`
  - 未実戦の理由: **Redis を使う場面がまだ無い**。DB が十分速く、キャッシュを挟むと**古い値を見せる危険**の方が大きい。アクセスが増えて DB が苦しくなったら使う。
- **@platform/storage** — ファイルの保管（ローカル・S3 互換）。
  - 主なexport: BatchResult, FallbackStorageOptions, PresignOptions, PutOptions, S3StorageConfig, Storage, …(全20)
  - サブパス: `@platform/storage/operations`
- **@platform/web-storage** — ブラウザの保存領域（localStorage の安全な包み）。
  - 主なexport: StorageKind, WebStorageLike, WebStorageOptions, WebStore, clearNamespace, createMemoryWebStorage, …(全7)
- **@platform/fs** — ファイルの操作（種別の判定・安全なパス）。
  - 主なexport: FileTypeInfo, WalkOptions, basename, changeExt, copyDir, copyFile, …(全34)
  - サブパス: `@platform/fs/magic`
- **@platform/csv** — CSV の生成と解析。**Excel で開いても日本語が化けない**ようにするためのものです。
  - 主なexport: ColumnSpec, ColumnType, CsvChunkHandler, CsvChunkProgress, CsvColumn, CsvLineSource, …(全23)
  - サブパス: `@platform/csv/import`
- **@platform/xlsx** — Excel ファイルの読み書き。**取引先に渡す形**を作ります。
  - 主なexport: Row, SheetInput, WriteOptions, readSheet, writeSheet, writeWorkbook
- **@platform/search** — 全文検索。**形態素解析器なしで日本語を実用的な精度**にします（BM25 + bigram）。
  - 主なexport: Bm25Index, Bm25Options, FieldBoosts, MeilisearchConfig, Search, SearchAdapter, …(全13)

## 通信

- **@platform/http** — HTTP の土台（クライアント・ステータス・条件付き要求）。
  - 主なexport: CursorPage, CursorPaging, DEFAULT_LIMIT, HttpErrorBody, IdempotencyOptions, IdempotencyStore, …(全30)
- **@platform/net** — 通信の下支え（再試行の待ち時間・タイムアウト・回線の状態）。
  - 主なexport: BackoffOptions, FramedConnection, FramedServer, LengthPrefixedDecoder, LineDecoder, PollOptions, …(全35)
  - サブパス: `@platform/net/browser`
- **@platform/mail** — メール送信（SMTP・テンプレート・添付）。
  - 主なexport: ApplyPolicyOptions, AttachmentLimits, EmailAddress, EmailTemplate, HtmlEmailLayoutOptions, MailAttachment, …(全54)
- **@platform/sms** — SMS の送信（Twilio）。**電話番号だけで届きます**。
  - 主なexport: MemorySmsTransport, OtpSmsOptions, Sms, SmsEncoding, SmsFallbackOptions, SmsInfo, …(全21)
  - サブパス: `@platform/sms/browser`
- **@platform/notify** — 通知（メール・Slack・LINE・アプリ内）。
  - 主なexport: AsyncSeenStore, CategoryPreference, ChannelResult, DedupOptions, DeliveryChannel, DeliveryDecision, …(全42)
- **@platform/os-notify** — デスクトップ通知（OS の通知領域に出す）。
  - 主なexport: OsCommand, OsNotification, OsNotifier, OsNotifierOptions, OsNotifyLogEntry, OsNotifyLogStore, …(全12)
- **@platform/realtime** — リアルタイム通信（SSE・購読）。**画面を更新せずに届けます**。
  - 主なexport: BroadcastHub, BroadcastHubOptions, Poller, ReconnectingWebSocket, ReconnectingWsOptions, RedisPubSubClient, …(全12)
- **@platform/integrations** **⚠ 未実戦** — 外部サービス連携の土台（HTTP クライアント・再試行・時間制限）。
  - 主なexport: ApiClient, ApiClientConfig, MultipartBody, MultipartFile, RequestOptions, createApiClient
  - 未実戦の理由: 各連携パッケージ(`freee` / `zoho` / `google` など 17 件)の内部で使う共通クライアント。**アプリは連携パッケージ経由で使う**ので、直接呼ぶ場面が無い。
- **@platform/webhook** — Webhook の受信（署名検証・再送対応）。
  - 主なexport: WebhookHandler, WebhookIdempotencyStore, WebhookOutcome, WebhookReceiver, WebhookReceiverOptions, createMemoryWebhookStore, …(全9)

## AI基盤

- **@platform/ai** — AI の呼び出し（Anthropic / OpenAI / Gemini）。**費用の上限・伏せ字・記録**を通します。
  - 主なexport: AgentStep, AiCallLog, AiChatRequest, AiChatSuccess, AiDecisionRecord, AiEmbedder, …(全65)
- **@platform/rag** — 社内文書の検索（RAG）。**AI に「うちの規程では」と答えさせる**ためのものです。
  - 主なexport: AccessControl, ChunkOptions, Embedder, PgVectorDb, Principal, RagChunk, …(全27)
- **@platform/mcp** — MCP サーバ（AI に道具を渡す仕組み）。
  - 主なexport: HttpMcpOptions, JsonRpcRequest, JsonRpcResponse, McpCallContext, McpCancellation, McpPromptDef, …(全23)

## 外部SaaS連携

- **@platform/zoho** — Zoho の 19 サービス（CRM / Books / Desk / People / Expense / Vault ほか）。
  - 主なexport: AnalyticsRecord, AppointmentInput, AuthorizationUrlInput, BookingsRecord, BooksListResult, BooksPageContext, …(全103)
  - サブパス: `@platform/zoho/analytics` / `@platform/zoho/bookings` / `@platform/zoho/books` / `@platform/zoho/campaigns` / `@platform/zoho/cliq` / `@platform/zoho/core` / `@platform/zoho/creator` / `@platform/zoho/crm` / `@platform/zoho/desk` / `@platform/zoho/inventory` / `@platform/zoho/people` / `@platform/zoho/projects` / `@platform/zoho/recruit` / `@platform/zoho/sign` / `@platform/zoho/workdrive`
- **@platform/google** — Google Workspace（Drive / Gmail / Sheets / Calendar / Maps / Docs / Forms / Apps Script）。
  - 主なexport: GmailClient, GmailMessageInput, GoogleAppsScriptClient, GoogleAuthUrlParams, GoogleCalendarClient, GoogleDoc, …(全33)
- **@platform/microsoft** — Microsoft 365（Graph API・Outlook・Teams・OneDrive・Entra ID）。
  - 主なexport: GraphEvent, GraphEventInput, GraphFile, GraphMailInput, GraphUser, MicrosoftAuthUrlParams, …(全17)
- **@platform/slack** — Slack 連携（通知・承認ボタン・ファイル送信）。
  - 主なexport: ApprovalRequest, SLACK_TEXT_LIMIT, SlackClient, SlackInteraction, SlackMessage, SlackPostResult, …(全15)
  - サブパス: `@platform/slack/blocks`
- **@platform/notion** — Notion 連携（データベースの読み書き）。
  - 主なexport: NOTION_VERSION, NotionClient, NotionPage, NotionPropertyInput, createNotionClient
- **@platform/line** — LINE 公式アカウント（通知・承認・リッチメニュー・受信）。
  - 主なexport: CarouselColumn, LINE_MULTICAST_LIMIT, LineAction, LineClient, LineEventBase, LineEventSource, …(全42)
  - サブパス: `@platform/line/messages` / `@platform/line/recipient` / `@platform/line/types` / `@platform/line/webhook-parse`
- **@platform/freee** — freee 会計との連携（取引・請求書・残高）。
  - 主なexport: BalancePoint, BalanceSnapshot, BalanceSummary, DealDetail, DealType, FreeeClient, …(全38)
- **@platform/stripe** **⚠ 未実戦** — > **⚠️ incubating(2026-08 に使用状況を確認)。** `internal-app` を含む
  - 主なexport: STRIPE_API_VERSION, Stripe, StripeClient, createStripeClient
  - 未実戦の理由: 公式 SDK(`stripe`)のラッパーで、**fetch を差し替える口が無い**。注入口を足すと SDK の使い方を歪めるため、デモ化は見送っている。**契約テストも効かない**(ラッパーが応答のフィールドを直接参照せず SDK に委ねているため、`check-contract` の C003 が「実装が参照していない」と判定する)。確認は sandbox キーでの実接続に頼るしかない。
- **@platform/paypal** — PayPal 決済（注文・返金）。**海外の取引先やカードを持たない相手からの入金**に使います。
  - 主なexport: PayPalClient, PayPalConfig, createPayPalClient
- **@platform/ekyc** — 本人確認（eKYC）。**外部サービスを差し替えられる**形にしてあります。
  - 主なexport: EkycClient, EkycClientConfig, EkycEndpoints, EkycStatus, EkycWebhookEvent, createEkycClient, …(全12)
  - サブパス: `@platform/ekyc/status` / `@platform/ekyc/webhook-parse`

## 非同期・フロー制御

- **@platform/jobs** — 非同期の仕事（キュー・再試行・進捗）。**重い処理を後回し**にします。
  - 主なexport: FailedJob, JobDefinition, JobsConnection, MemoryQueue, MemoryQueueOptions, QueueLike, …(全12)
  - サブパス: `@platform/jobs/browser`
- **@platform/rpa** — 定型作業の自動化（手順の記録・再実行）。
  - 主なexport: RpaAuditEvent, RpaAuditSink, RpaContext, RpaLock, RpaRetryOptions, RpaRunResult, …(全9)
- **@platform/cron** — 定期実行（スケジュール・排他・ずらし）。
  - 主なexport: AcquireFileLockOptions, CronErrorHandler, CronJob, CronResultHandler, FileLockOptions, GuardOptions, …(全19)
  - サブパス: `@platform/cron/browser`
- **@platform/workflow** — 承認フロー（申請 → 承認 → 差し戻し）。
  - 主なexport: Actor, AmountTier, ApproverDirectory, Delegation, ParallelState, ParallelStep, …(全37)
- **@platform/fsm** — 状態遷移（申請 → 承認 → 完了のような流れ）。
  - 主なexport: MachineProblem, RunResult, StateMachine, StateMachineDefinition, Transitions, availableEvents, …(全12)
- **@platform/blueprint** — 業務フローの設計図（状態と遷移の定義・検証）。
  - 主なexport: Blueprint, BlueprintProblem, BlueprintTransition, TransitionResult, applyTransition, availableTransitions, …(全12)
- **@platform/saga** — 複数の処理をまとめて実行し、**失敗したら順に打ち消す**仕組み。
  - 主なexport: SagaResult, SagaStep, runSaga, sagaStep
- **@platform/flags** — 段階的な公開（フィーチャーフラグ）。**一部の人にだけ先に出します**。
  - 主なexport: FlagContext, FlagDefinitions, FlagProvider, FlagRule, Flags, bucketOf, …(全11)

## UI・表現

- **@platform/ui** — Tailwind CSS + shadcn/ui の慣習に沿った共通 UI 部品。内部は Radix(統合 `radix-ui`)/
  - 主なexport: Accordion, AccordionContent, AccordionItem, AccordionTrigger, ActivityTimeline, ActivityTimelineProps, …(全867)
  - サブパス: `@platform/ui/icons`
- **@platform/form** — フォームの検証と整形。**入力の間違いを、送る前に伝えます**。
  - 主なexport: AutocompleteField, CheckboxField, ColorField, ComboboxField, CsrfField, DateField, …(全77)
  - サブパス: `@platform/form/honeypot`
- **@platform/report** — 帳票（請求書・見積書等）。日本の消費税計算と印刷用 HTML を提供します。
  - 主なexport: ExpenseRecord, ExpenseRow, ExtractedFields, InvoiceCalcOptions, InvoiceCalculation, InvoiceDocument, …(全42)
- **@platform/pdf** — PDF の生成。**請求書・報告書を印刷できる形**にします。
  - 主なexport: DEFAULT_INVOICE_PDF_OPTIONS, PdfOptions, PdfRenderer, PdfService, createPdf, createPlaywrightRenderer
  - サブパス: `@platform/pdf/playwright`
- **@platform/print** — 印刷用のスタイル（帳票・ラベル）。**画面で見えるものが、そのまま紙に出るとは限りません**。
  - 主なexport: Align, PageOptions, PrintElementOptions, PrintOptions, RECEIPT_PROFILES, ReceiptBuilder, …(全14)
- **@platform/barcode** — バーコードの生成（JAN / EAN / Code128）。**読み取りは `@platform/mobile`** です。
  - 主なexport: AssetUrlOptions, BarcodeFormat, BarcodeOptions, QrLevel, QrOptions, barcodeSvg, …(全9)
- **@platform/i18n** — 多言語（ja / en / ko / zh）。**外国籍の従業員がいる会社**向けです。
  - 主なexport: Catalog, Catalogs, I18nOptions, LOCALES, LOCALE_LABELS, Locale, …(全13)
  - サブパス: `@platform/i18n/catalogs`
- **@platform/color** — 色の変換と読みやすさの判定。**数字でコントラストを確かめます**。
  - 主なexport: Hsl, Rgb, contrastRatio, darken, hexToRgb, hslToRgb, …(全13)
- **@platform/html** — HTML の無害化と組み立て。**利用者の入力をそのまま出さない**ためのものです。
  - 主なexport: collapseWhitespace, embedAsText, embedHtml, embedIframe, embedScript, escapeAttribute, …(全22)
- **@platform/theme** — 配色と見た目のトークン。**読めない色の組み合わせを防ぎます**。
  - 主なexport: ContrastCheck, CreateThemeRegistryOptions, Theme, ThemeContrastReport, ThemeMode, ThemeRegistry, …(全41)

## メディア・デバイス

- **@platform/media** — 音声・動画の変換（形式変換・切り出し）。**外部ツールを呼びます**。
  - 主なexport: MediaInfo, MediaProcessor, createMediaProcessor
- **@platform/image** — 画像の変換（縮小・回転・EXIF 除去）。
  - 主なexport: BackgroundRemover, FitMode, FitOptions, GenericRemoverOptions, Gravity, ImageFormat, …(全27)
  - サブパス: `@platform/image/geometry`
- **@platform/ocr** — 画像から文字を読む（領収書・請求書の読み取り）。
  - 主なexport: FieldWithConfidence, HttpOcrOptions, InvoiceFields, LineItem, OcrEngine, OcrResult, …(全26)
- **@platform/upload** — ファイルのアップロード（検査・保管・ダウンロード）。
  - 主なexport: DEFAULT_MAX_UPLOAD_BYTES, DownloadOptions, POST, UploadOptions, UploadedFile, downloadFromStorage, …(全8)
- **@platform/device** — 端末の判定（スマホ / PC・画面の大きさ・位置情報）。
  - 主なexport: ClientInfo, DeviceType, GeoPosition, UserAgentInfo, getClientInfo, parseUserAgent, …(全7)
- **@platform/mobile** — スマホ向けの機能（カメラ・録音・バーコード・画面の向き・オフライン）。
  - 主なexport: AudioRecorder, BarcodeKind, Breakpoints, CacheRule, CacheStrategy, CameraConstraintsInput, …(全70)
- **@platform/bluetooth** — Bluetooth 機器との接続（測定器・プリンタ）。
  - 主なexport: BluetoothConnection, BluetoothUUID, ConnectOptions, DeviceFilter, DeviceInformation, GATT, …(全16)
- **@platform/hid** **⚠ 未実戦** — HID 機器（バーコードリーダー・カードリーダー）との接続。
  - 主なexport: HidConnection, HidFilter, connectHid, isHidSupported, reportBytes
  - 未実戦の理由: バーコードリーダなどの HID 機器を読む部品。**対応する機器がまだ無い**——`@platform/barcode` のカメラ読み取りで足りている。

## 業務ドメイン

- **@platform/address** — 住所と郵便番号（正規化・検索）。**入力の揺れを吸収**します。
  - 主なexport: AddressAdapter, AddressLookup, AddressResult, createAddressLookup, createZipcloudAdapter, isValidZipcode, …(全7)
- **@platform/phone** — 電話番号の正規化と検証（日本と国際）。**同じ番号を別物として保存しない**ためのものです。
  - 主なexport: E164Parts, IntlPhoneType, PhoneType, detectCountry, formatJpPhone, fromE164, …(全15)
- **@platform/currency** — 通貨と丸め。**円だけでなく、外貨も扱います**。
  - 主なexport: CurrencyMeta, Money, addMoney, convert, currencyMeta, formatMoney, …(全10)
- **@platform/units** — 単位の表示（面積・重さ・長さ）。**日本の慣用単位**にも対応します。
  - 主なexport: AreaUnit, LengthUnit, TempUnit, VolumeUnit, WeightUnit, convertArea, …(全11)
- **@platform/tax** — 消費税の計算（10% / 8% / 非課税）。**丸め方が決まっています**。
  - 主なexport: DocumentType, PENALTY_MULTIPLIER, Rounding, StampTaxInput, StampTaxResult, TaxLine, …(全28)
  - サブパス: `@platform/tax/stamp`
- **@platform/importer** — CSV / Excel の取り込み（検証・エラー報告）。
  - 主なexport: ErrorRow, ImportOptions, ImportResult, RowResult, RowValidator, ValidRow, …(全10)
- **@platform/sequence** — 採番（請求書番号・伝票番号）。**連番と年度リセット**に対応します。
  - 主なexport: ResetPeriod, SequenceOptions, SequenceStore, Sequencer, createMemorySequenceStore, createSequencer, …(全7)
- **@platform/zengin** — 全国銀行協会フォーマット（振込データ）。**銀行に渡すファイル**を作ります。
  - 主なexport: AccountType, Consignor, TransferRecord, ZenginResult, buildDataRecord, buildHeader, …(全11)
- **@platform/payroll** — 給与計算（社会保険・源泉徴収・賞与）。**金額が 1 円違うと問い合わせが来ます**。
  - 主なexport: BONUS_CAPS, BonusInsuranceDeduction, BonusPayment, BonusRateRow, BonusRateTable, DEFAULT_PREMIUM_RATES, …(全49)
- **@platform/dencho** — 電子帳簿保存法への対応（改ざん検知・タイムスタンプ）。
  - 主なexport: ChainVerification, DEFAULT_RETENTION_YEARS, EvidenceRecord, GENESIS_HASH, TimestampToken, TransactionQuery, …(全19)
  - サブパス: `@platform/dencho/retention` / `@platform/dencho/search` / `@platform/dencho/types`
- **@platform/commerce** — > **⚠️ incubating(2026-08 に降格)。** `internal-app` が使うのは
  - 主なexport: AddToCartInput, Cart, CartItem, Coupon, DiscountType, Favorites, …(全83)
- **@platform/invoice** — 請求書と見積書。**インボイス制度**（登録番号・税率ごとの内訳）に対応しています。
  - 主なexport: AgingBuckets, ApplyPaymentResult, BillingInterval, DUNNING_LABELS, DUNNING_THRESHOLDS, DunningInvoice, …(全45)
- **@platform/quote** — 見積書（明細・値引きの配分・有効期限）。
  - 主なexport: CostLine, Discount, DiscountedLines, MarginResult, Quote, QuoteRevision, …(全19)
- **@platform/purchase** — 発注と入荷（発注書・入荷確認・差異）。**「頼んだのに来ていない」を見つけます**。
  - 主なexport: DEFAULT_TOLERANCE, DuplicateSuspicion, LineReceivingStatus, MatchLine, MatchTolerance, Mismatch, …(全22)
- **@platform/inventory** — 在庫と発注。**入出庫の履歴から残高を出します**（残高を直接持ちません）。
  - 主なexport: Allocation, LotBalance, LotMovement, MovementSummary, MovementType, ReorderPolicy, …(全25)
- **@platform/accounting** — 会計の仕訳・試算表・電子帳簿保存法への対応。**貸借の一致を作った時点で確かめます**。
  - 主なexport: AccountBalance, AccountNames, AccountType, AccountTypeMap, BalanceSheet, DEFAULT_ACCOUNTS, …(全45)
- **@platform/audit** — 監査ログ（誰が何をしたか）。**後から追えることが目的**です。
  - 主なexport: AuditEntry, AuditEvent, ChainVerification, DiffOptions, FieldChange, HashFn, …(全18)
- **@platform/depreciation** — 減価償却（定額法・定率法）。**税法の決まりに沿って計算**します。
  - 主なexport: AssetValuation, DepreciableAsset, DepreciationMethod, MEMORANDUM_VALUE, RESIDUAL_RATE, STANDARD_TAX_RATE, …(全23)
- **@platform/booking** — 予約（会議室・設備・面談）。**重なりを防ぎます**。
  - 主なexport: BOOKING_STATUS_LABELS, BOOKING_TRANSITIONS, BookingInterval, BookingStatus, BookingWindow, HoursOverrides, …(全51)
- **@platform/cast** — 出演者・スタッフの管理（プロフィール・タグ・評価）。
  - 主なexport: Cast, CastSort, CastStatus, ProfileField, ProfileItem, RankedCast, …(全22)
- **@platform/elearning** — 社内研修（教材・小テスト・受講記録）。**受けたかどうかを記録に残す**ためのものです。
  - 主なexport: Certificate, Course, Lesson, Module, Progress, QuestionResult, …(全15)
- **@platform/task** — タスク管理（担当・期限・優先度）。**誰がいつまでにやるかを決める**ためのものです。
  - 主なexport: Task, TaskFilter, TaskPriority, TaskProgress, TaskSort, TaskStatus, …(全15)
- **@platform/contract** — 契約の管理（更新期限・解約通知）。**期限を過ぎると自動更新されます**。
  - 主なexport: ApplicabilityResult, Contract, ContractAlert, ContractAlertLevel, ContractStatus, ContractSummary, …(全37)
- **@platform/attendance** — 勤怠の記録・集計と年次有給休暇。**深夜と日跨ぎの夜勤**に対応しています。
  - 主なexport: AttendanceDay, AttendanceEntry, AttendanceRecord, AttendanceStore, AttendanceSummary, CheckupIssue, …(全55)

## コンテンツ・サイト

- **@platform/cms** — 社内のお知らせ・記事（下書き・公開予約・版管理）。
  - 主なexport: AnnouncementInput, AnnouncementLevel, AnnouncementRow, AnnouncementStore, AnnouncementStoreDb, BlogView, …(全81)
- **@platform/blog** — 社外向けの記事（公開サイト用）。**コメントとタグ**を扱います。
  - 主なexport: AdjacentPosts, BlogPost, Comment, CommentNode, CommentStatus, ExcerptOptions, …(全46)
- **@platform/seo** — 検索エンジン向けの設定（メタ情報・サイトマップ・robots）。
  - 主なexport: FaviconConfig, FeedChannel, FeedEntry, FeedItem, JsonLd, MetaInput, …(全47)
- **@platform/site** — 公開サイトの構成（ナビ・パンくず・現在地の判定）。
  - 主なexport: Announcement, Banner, BlockType, BreadcrumbFromPathOptions, CopyrightOptions, MenuItem, …(全32)
- **@platform/url** — URL の正規化と判定。**同じ URL を別物として扱わない**ためのものです。
  - 主なexport: NormalizeOptions, TRACKING_PARAMS, UrlParts, appendParam, buildUrl, getHostname, …(全33)
- **@platform/social** — SNS のハンドル（正規化・URL 生成）。
  - 主なexport: ALL_PLATFORMS, OEmbedOptions, PLATFORMS, ParsedSocialUrl, PlatformSpec, SHARE_LABELS, …(全38)
- **@platform/board** — 掲示板（スレッド・投票・お知らせ）。**チャットは流れるので、残す場所**として使います。
  - 主なexport: Attachment, AttachmentLimits, AttachmentResult, BlogLike, Categorized, Category, …(全43)
- **@platform/chat** — 社内チャット（部屋・メンション・既読・ピン留め）。
  - 主なexport: Attachment, AttachmentLimits, AttachmentResult, Bookmark, ChatMessage, ChatRoom, …(全40)
- **@platform/faq** — よくある質問（検索・役立ち度の記録）。**同じ質問に何度も答えない**ためのものです。
  - 主なexport: FaqHit, FaqItem, FaqStats, FaqStatus, byCategory, helpfulRate, …(全12)

## 運用・可観測性

- **@platform/observability** — ログ・計測・追跡。**何が起きたかを後から追える**ようにします。
  - 主なexport: ActiveSpan, Alert, AlertManager, AlertRule, AsyncIdempotencyStore, CheckResult, …(全50)
- **@platform/status-page** — 稼働状況の表示（障害・メンテナンスの告知）。
  - 主なexport: MaintenanceConfig, MaintenanceDecision, MaintenanceRequestInfo, MaintenanceState, MaintenanceStore, StatusPageOptions, …(全20)
- **@platform/analytics** — 利用状況の集計（アクセス・画面速度）。**使われているかを数字で知る**ためのものです。
  - 主なexport: AnalyticsEvent, AnalyticsEventType, AnalyticsSummary, Beacon, BeaconDeps, BeaconPayload, …(全28)
- **@platform/loadtest** — 負荷測定（同時実行・応答時間の集計）。**「今は速い」は「100 人でも速い」ではありません**。
  - 主なexport: LatencyStats, LoadOptions, LoadResult, RequestFn, RequestOutcome, Scenario, …(全17)

## 未分類

- @platform/bytes
- @platform/feed
- @platform/json
- @platform/openapi
- @platform/push
- @platform/xml
