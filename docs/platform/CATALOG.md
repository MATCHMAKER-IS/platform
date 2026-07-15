# 基盤 機能カタログ

> **アプリを作る前に、まずここを見る。** 欲しい処理が `@platform/*` にあれば使い、
> 無ければアプリ側(`apps/`)に実装する — その判断のための索引です。
>
> 各パッケージの詳しい使い方は各 `packages/<名前>/README.md`、
> 公開 API の一覧は [`api-surface.json`](./api-surface.json)、機械可読の要約は [`capabilities.json`](./capabilities.json) を参照。

**全 90 パッケージ**。すべて README・テスト・スモーク検証つき。基盤はロジックを持たず、機能単位の共通部品のみを提供します。

## 基礎・共通規約

アプリの土台。エラー・ログ・設定・検証・汎用ヘルパー。

| パッケージ | 役割 |
|---|---|
| `@platform/core` | エラー規約とResult型（土台） |
| `@platform/logger` | 構造化ログ（機微情報マスク） |
| `@platform/env` | 環境変数の起動時検証（fail-fast） |
| `@platform/config` | 共通ビルド設定(tsconfig ベース・vitest プリセット。ランタイムコードなし) |
| `@platform/validation` | 共通バリデーション（日本固有・フォームパターン・正規化） |
| `@platform/utils` | 規律ある汎用ヘルパー |
| `@platform/datetime` | JST前提の日時整形・境界計算 |
| `@platform/context` | リクエスト相関ID(AsyncLocalStorage) |
| `@platform/testing` | テスト工具・契約テスト |
| `@platform/faker` | 日本語ダミーデータ生成 |

## データ・永続化

DB・キャッシュ・ファイル・表計算・検索。

| パッケージ | 役割 |
|---|---|
| `@platform/db` | DBアクセス・生SQL・トランザクション・監査ログ |
| `@platform/cache` | キャッシュ(メモリ/Redis) |
| `@platform/storage` | ファイル操作（ローカル/S3互換） |
| `@platform/fs` | ファイル/フォルダ操作・パスユーティリティ |
| `@platform/csv` | CSV 生成・解析・ダウンロード |
| `@platform/xlsx` | Excel(.xlsx)の読み書き |
| `@platform/search` | 全文検索（Meilisearch/メモリ） |

## 通信・Web連携

HTTP・メール・SMS・チャット通知・リアルタイム・汎用 Webhook 受信。

| パッケージ | 役割 |
|---|---|
| `@platform/http` | AppError→HTTP変換・Route処理の共通化 |
| `@platform/net` | ネットワーク(URL/リトライ/IP-CIDR)とソケット(TCPフレーミング) |
| `@platform/url` | URL・ドメイン処理。解析/組み立て・クエリ操作・ドメイン抽出(eTLD+1)・正規化・検証(安全性) |
| `@platform/social` | SNS連携(X/TikTok/Instagram)。ハンドル正規化/検証・プロフィール/投稿URL解析・oEmbed・キャストのアカウント集合・統合フィード(重複排除/新着差分/定期取得) |
| `@platform/booking` | 予約サイト基盤。営業時間・スロット生成・空き枠計算(キャパシティ)・予約ルール(受付/キャンセル)・予約ステータス・リマインダー(前日/当日/直前・発火計算)・スタッフ/キャストのシフト空き枠(指名/動的キャパシティ) |
| `@platform/cast` | キャスト(スタッフ/タレント)。一覧絞込(タグ)・並び替え(注目/評価/新人)・注目/新人抽出・プロフィール組立/充実度・口コミ連動ランキング(件数補正ベイズ平均) |
| `@platform/mail` | メール送信（Transport差し替え可）・**テンプレートメール**・**宛先ホワイトリスト**・**添付ファイル**・**配信停止(署名トークン/List-Unsubscribe)** |
| `@platform/sms` | SMS/電話送信（Transport差し替え可）・**認証コードSMS(OTP文面)** |
| `@platform/notify` | チャット通知(Slack/Teams/LINE)・**通知プレファレンス(チャネル選択/静音時間/ダイジェスト)** |
| `@platform/realtime` | 自動更新（ポーリング・再接続WebSocket） |
| `@platform/integrations` | 外部API連携の型付きHTTPクライアント |
| `@platform/webhook` | Webhook 受信枠組み(HMAC署名検証・冪等・イベントディスパッチ) |

## 外部SaaS連携

会計・CRM・チャット・決済。いずれも OAuth/トークン管理と耐障害ラッパーに対応。

| パッケージ | 役割 |
|---|---|
| `@platform/zoho` | Zoho 連携(CRM/Books/Desk/Inventory 等14サービス + OAuth トークン管理) |
| `@platform/google` | Google Workspace 連携(ログイン/Sheets/Calendar/Gmail/Drive/Maps) |
| `@platform/line` | LINE Messaging API クライアント |
| `@platform/freee` | freee 会計 API クライアント + OAuth トークン管理 + 証憑/振替伝票ビルダー |
| `@platform/accounting` | 会計(複式簿記の仕訳/試算表/freee連携) |
| `@platform/stripe` | Stripe 決済(公式SDKラッパー) |
| `@platform/paypal` | PayPal 決済(Orders v2) |
| `@platform/ekyc` | eKYC(オンライン本人確認)ベンダー連携(TRUSTDOCK 等・申込/判定Webhook/画像URL・ステータス正規化) |

## 認証・セキュリティ

ログイン・RBAC・暗号・機密・個人情報保護・M2M 認証。

| パッケージ | 役割 |
|---|---|
| `@platform/auth` | 認証状態・RBAC・OIDC設定標準化・**OTP/SMS認証**・**TOTP(認証アプリ)**・**バックアップコード**・**2FA統合**・**パスキー(WebAuthn)** |
| `@platform/session` | セッション・無操作タイムアウト・ログイン試行抑制に加え、**セッション固定対策(ID再生成)**・**全端末ログアウト**・**再認証(step-up)/Remember-me**・**ログイン監査の標準化** |
| `@platform/guard` | ルート/ページ保護（認証必須・権限・レート制限） |
| `@platform/crypto` | 機密データ暗号化・パスワードハッシュ |
| `@platform/security` | セキュリティヘッダ・HTMLサニタイズ |
| `@platform/ratelimit` | レート制限(メモリ/Redis) |
| `@platform/secrets` | シークレット取得の抽象(env/Secrets Manager/Vault・キャッシュ/TTL/ローテーション追随・必須チェック) |
| `@platform/pii` | 個人情報保護(マスキング・検索可能暗号 blind index・フィールド暗号・匿名化/保持ポリシー)・**本人の権利対応(開示/削除/保持期限・個人情報保護法)** |
| `@platform/apikey` | API キー/M2M 認証(発行・ハッシュ照合・スコープ・失効/期限) |

## 非同期・ジョブ・ワークフロー

キュー・定期実行・多段承認・状態機械。

| パッケージ | 役割 |
|---|---|
| `@platform/jobs` | 非同期ジョブ(キュー) |
| `@platform/cron` | 定期実行（スケジューラ） |
| `@platform/workflow` | 多段承認ワークフロー(承認/却下/差戻し)に加え、**金額別・条件別ルート**・**代理承認(委任)**・**並列承認(合議・all/any)**・**催促/エスカレーション(SLA)** |
| `@platform/fsm` | 汎用ステートマシン(宣言的な状態遷移) |
| `@platform/blueprint` | 業務プロセスのブループリント(状態遷移+条件/必須項目/アクション/ロール・Zoho CRM相当) |

## UI・フォーム・帳票

共通 UI・フォーム統合・帳票 PDF・印刷・多言語・色。

| パッケージ | 役割 |
|---|---|
| `@platform/ui` | 共通UI部品・一覧の選択状態(複数選択/一括操作)・ダッシュボード部品(ドーナツ/内訳バー/ランキング/目標達成/ファネル/鮮度)・ソーシャルログインUI(LoginCard/Google/Zoho)・メールログインフォーム(EmailLoginForm)・レイアウト部品(ヘッダー/サイドメニュー/フッター/ハンバーガー)・テーマ切替(ThemeToggle)・ThemeProvider(OS監視/永続化)・通知センター(NotificationBell)・コマンドパレット(⌘K)/リアルタイム通知・RBAC出し分け(filterNavByPermission) |
| `@platform/form` | フォーム統合（react-hook-form + zod + ui）・**動的フォーム(条件付き表示/ステップ/zodスキーマ生成)**・**入力→確認→完了フロー**・確認/詳細項目生成・バリデーションエラー整形(issuesToFieldErrors) |
| `@platform/report` | 帳票（請求書・消費税計算・インボイス）・**見積書/納品書/源泉徴収**・**印刷/PDF最適化(@page・一括結合)** |
| `@platform/pdf` | 帳票PDF生成（HTML→PDF） |
| `@platform/print` | 印刷（ブラウザ印刷・ESC/POSレシート） |
| `@platform/i18n` | 多言語対応(日英中韓)・翻訳/補間/フォールバック/Intl整形 |
| `@platform/color` | 色変換・WCAGコントラスト・明暗調整・混色 |

## メディア・デバイス

動画音声・画像・OCR・アップロード・端末/BLE/HID 連携。

| パッケージ | 役割 |
|---|---|
| `@platform/media` | 動画・音声処理（ffmpeg） |
| `@platform/image` | 画像処理（サーバ=sharp / 寸法計算は共通） |
| `@platform/ocr` | 画像OCR（tesseract.js / クラウドHTTP） |
| `@platform/upload` | アップロード/ダウンロードのHTTP境界処理 |
| `@platform/device` | 端末・ブラウザ・OS・ネットワーク情報取得 |
| `@platform/mobile` | タブレット・スマホ向け処理。レスポンシブ/ネットワーク状態/画面向きの純ロジック + React フック + 共有/触覚/クリップボード等のブラウザ操作・**カメラ撮影/バーコード読取(JAN/EAN)** |
| `@platform/bluetooth` | Web Bluetooth（BLE機器連携） |
| `@platform/hid` | WebHID（PC周辺機器連携） |

## 日本の業務ドメイン

住所・電話・通貨・単位、消費税/インボイス・採番・一括取込・全銀振込。

| パッケージ | 役割 |
|---|---|
| `@platform/address` | 郵便番号→住所 逆引き（zipcloud） |
| `@platform/phone` | 日本の電話番号(正規化/種別/E.164/整形) |
| `@platform/currency` | 通貨・為替(端数処理/換算/複数通貨合算) |
| `@platform/units` | 単位変換(長さ/重さ/面積/体積/温度/尺貫法) |
| `@platform/tax` | 日本の消費税・インボイス(税込税抜変換・軽減税率混在・端数処理・税率別集計・登録番号検証)・**源泉徴収税** |
| `@platform/invoice` | 請求書(適格請求書対応・明細/税率別集計/採番/支払期限/入金状態) |
| `@platform/quote` | 見積書(明細/有効期限/状態/請求書変換・@platform/invoice再利用) |
| `@platform/purchase` | 発注(明細/金額/入荷・発注残/状態・@platform/invoice再利用) |
| `@platform/inventory` | 在庫管理(入出庫台帳/発注点/移動平均評価) |
| `@platform/commerce` | EC基盤。カート・お気に入り・クーポン割引・注文サマリ(消費税/送料)・在庫引当・バリエーション・レビュー評価・注文ステータス・ポイント・送料計算(地域/重量) |
| `@platform/blog` | ブログ/コンテンツ基盤。スラッグ・抜粋・読了時間・目次・記事公開/絞込/関連記事・RSS/サイトマップ・コメント(ネスト/モデレーション)・記事ナビ(前後/連載)・パーマリンク(URL構造/逆引き) |
| `@platform/seo` | SEO。メタタグ・Open Graph/Twitter Card・JSON-LD構造化データ(記事/パンくず/商品/FAQ)・robots.txt・可視性ポリシー(社内noindex/公開のみSEO・X-Robots-Tag) |
| `@platform/site` | 公式サイト・LP基盤。ページ構成(セクションブロック)・ナビメニュー・URLリダイレクト・お知らせバー・パンくず自動生成(breadcrumbFromPath) |
| `@platform/payroll` | 勤怠・給与計算(労基法)。労働時間集計・時間外/深夜/法定休日の割増賃金(複合率)・月次集計・給与明細 |
| `@platform/dencho` | 電子帳簿保存法対応。改ざん検知(ハッシュチェーン)・タイムスタンプ・検索要件(取引年月日/金額/取引先)・保存期間管理 |
| `@platform/importer` | 一括インポート枠組み(行ごと検証・エラー行集約・ドライラン・トランザクション適用) |
| `@platform/sequence` | 帳票番号の連番採番(プレフィックス・ゼロ埋め・年度/月次リセット・原子的発番) |
| `@platform/zengin` | 全銀協フォーマット総合振込データ生成(固定長・半角カナ・件数/合計集計) |

## 運用・観測性

トレース/メトリクス/冪等性/サーキットブレーカー・フィーチャーフラグ。

| パッケージ | 役割 |
|---|---|
| `@platform/observability` | 依存ゼロの観測性・信頼性(トレース/メトリクス/冪等性/サーキットブレーカー/Outbox/ヘルスチェック) |
| `@platform/audit` | 監査ログ(操作履歴・追記専用+ハッシュチェーン改ざん検知・差分/検索) |
| `@platform/chat` | チャット(メッセージ・ルーム・未読・メンション)。realtimeと配信結線 |
| `@platform/board` | 掲示板(スレッド・投稿・返信・リアクション・検索) |
| `@platform/flags` | フィーチャーフラグ(kill switch・段階ロールアウト・ターゲティング・A/Bバリアント・決定的評価) |
| `@platform/status-page` | メンテナンス/エラー画面テンプレート + 切り替えゲート(env / 予定期間 / **管理画面から再起動なしトグル**・TTLキャッシュ・許可ロール/IP/バイパス) |

## サンプル業務アプリ(apps/internal-app)

基盤の使い方を示す実装例(経費精算 + 勤怠)。Zoho ログイン認証・RBAC・承認→通知の確実配信・
全ルート計装・graceful shutdown まで、基盤を組み合わせた本番相当の構成です。
業務ロジックはすべてアプリ側にあり、基盤(`packages/`)には一切含みません。

