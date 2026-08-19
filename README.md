# 社内基盤プラットフォーム (monorepo)

> **はじめての方へ**: まず **[docs/onboarding/02-first-hour.md](docs/onboarding/02-first-hour.md)**(1 枚・1 時間)。
> 動くところまで行けます。**規約は初日に読まなくて大丈夫です。**
>
> 何も入っていない PC からのセットアップ〜開発〜公開までは
> **[docs/onboarding/01-setup.md](docs/onboarding/01-setup.md)** に全部書いてあります（Windows/Mac 対応）。
> Git/GitHub が初めてなら **[docs/ops/GIT_GUIDE.md](docs/ops/GIT_GUIDE.md)**、
> Cursor で開発するなら **[docs/ops/CURSOR_GUIDE.md](docs/ops/CURSOR_GUIDE.md)** も。
> どの資料を読めばいいかは **[docs/README.md](docs/README.md)**（地図）から。

> 検証・起動手順は [docs/onboarding/05-verify.md](docs/onboarding/05-verify.md) を参照(依存不要スモーク: `pnpm smoke`)。

Node.js + Next.js + PostgreSQL による社内アプリ基盤(内製プラットフォーム)。

社内で作る業務アプリが共通して必要とする機能——DB アクセス、認証、外部 SaaS 連携、
帳票、通知、耐障害性など——を **120 の再利用可能なパッケージ**として提供します。
アプリ開発者は業務ロジックの実装に集中でき、共通処理の再発明・属人化・ブラックボックス化を防ぎます。

**設計の背骨は「基盤(`packages/`)とアプリ(`apps/`)の分離」**です。
基盤はロジックを持たず機能単位の共通部品のみを提供し、業務ロジックはアプリ側に置きます。
この境界は ESLint(boundaries)・CODEOWNERS・CI で機械的に担保しています。

## なぜ基盤にするのか

### 出発点にある問題

社内アプリを 1 つずつ作ると、**同じものを何度も書きます**。
ログイン、日付の扱い、CSV の出力、権限の判定、通知——
どのアプリにも要るのに、**アプリごとに別の実装**になります。

そこから次のことが起きます。

| 起きること | 具体的にどうなるか |
|---|---|
| **直す場所が増える** | 消費税の計算に誤りが見つかると、**5 つのアプリを別々に直す**ことになります |
| **強度がばらつく** | 「このアプリだけパスワードが平文で飛ぶ」が起きます。**弱い方が全体の強度**です |
| **属人化する** | 作った人しか分からない状態になり、**その人が辞めると触れなくなります** |
| **ブラックボックス化する** | 何が入っているか分からないので、**怖くて直せません**。結果、放置されます |

### 基盤にすると何が変わるか

**共通する部分を 1 か所に集め、そこだけを厚くします。**

- 消費税の計算を直せば、**使っているアプリすべてが直ります**
- ログインの仕組みは 1 つなので、**そこを固めれば全体が固まります**
- アプリ側には**業務の判断だけ**が残るので、読む量が減ります

このリポジトリでは **120 のパッケージ**がその役割を持ちます。
アプリは `apps/` に置き、**基盤（`packages/`）はロジックを持ちません**。
この境界は ESLint・CODEOWNERS・CI で機械的に守っています。

### 何を基盤に置き、何を置かないか

**「どのアプリでも同じ答えになるもの」だけ**を基盤に置きます。

| | 基盤に置く | アプリに置く |
|---|---|---|
| 例 | 日付の計算、CSV の出力、権限の判定、暗号 | 「経費は 3 万円以上で部長承認」 |
| 判断基準 | **会社が変わっても同じ** | **うちの会社の決めごと** |

「経費は 3 万円以上で部長承認」を基盤に入れると、
**別のアプリが使えなくなります**——金額も承認者も会社ごとに違うからです。

## メリットとデメリット

**デメリットも書きます。** 基盤化は万能ではなく、
**向いていない場面があります**。それを知らずに始めると、後から苦しみます。

### メリット

| | |
|---|---|
| **直す場所が 1 つ** | 不具合も改善も、1 回で全アプリに届きます |
| **強度が揃う** | 一番弱いアプリに全体が引きずられることがなくなります |
| **新しいアプリが速い** | `pnpm new-app` で、認証・監査ログ・エラー処理が入った状態から始まります |
| **判断が残る** | 「なぜこうしたか」がコードのコメントと ADR に残り、**次の人が読めます** |
| **AI が正しく書ける** | 後述します。**これが今いちばん大きい**と考えています |

### デメリット

| | どう向き合うか |
|---|---|
| **最初が遅い** | 1 つ目のアプリは、基盤を作る分だけ**確実に遅くなります**。2 つ目から回収が始まります |
| **影響範囲が広い** | 基盤を直すと全アプリに影響します。だから**検査を 100 種類**用意し、`pnpm check` で確かめてから出します |
| **抽象化しすぎる危険** | 「いつか使うかも」で作った機能は**誰も使いません**。実際、120 のうち使われていないものを定期的に棚卸ししています（`check-incubating-review`） |
| **学習が要る** | 「どこに何があるか」を知る必要があります。`pnpm suggest` と `docs/ai/module-list.md` がその入口です |
| **合わない場面がある** | **使い捨てのツール**、**1 回限りの集計**、**外部に売る製品**——これらは基盤に乗せない方が速いことがあります |

### 向いていないと思ったら

**無理に乗せないでください。** 基盤は「同じものを何度も作る」を減らすための道具で、
**1 回しか作らないものには効きません**。

## これからの AI 開発時代にどう役立つか

**ここが、この基盤を作っている最大の理由です。**

AI にコードを書かせると、**速さは手に入りますが、正しさは手に入りません**。
AI は「それらしいコード」を書きますが、**うちの会社の事情は知りません**。

### AI が間違えるところ

実際にこのリポジトリで起きたことです。

- **日付を UTC で切る** → JST の 0〜9 時に**前日**になり、締めの集計が 1 日ずれる
- **`===` でトークンを比べる** → 応答時間の差から**1 文字ずつ当てられる**
- **金額を `Float` で持つ** → 端数が出て、**帳簿が 1 円合わない**
- **`take` を付けずに全件取得** → 件数が増えた日に**画面が固まる**

どれも「動いているように見える」のが厄介なところです。
**レビューでも見落とします**。

### 基盤があると、どう変わるか

**1. 正しい書き方が「呼ぶだけ」になる**

`@platform/datetime` の `todayJst()` を呼べば、日付はずれません。
AI に「日付の扱いに気をつけて」と伝える必要がなく、
**基盤を使う限り正しい**という状態を作れます。

**2. 間違いを機械が捕まえる**

**100 種類の検査**が `pnpm check` で走ります。
上の 4 つは、すべて専用の検査があります
（`check-server-localtime` / `check-safety-parts` / `check-schema-types` / `check-unbounded-query`）。

**AI が書いたコードも、人が書いたコードも、同じ検査を通ります。**
「気をつける」ではなく「**通らないと出せない**」にするのが要点です。

**3. AI が読める形で判断が残っている**

このリポジトリのコメントは、**「何をしているか」ではなく「なぜそうしたか」**を書いています。

```ts
// **JST で切る。** `toISOString()` は UTC なので、
// **JST の 0 時〜9 時は前日**になります——朝に開くと期限が 1 日ずれる
```

AI はこれを読んで**同じ判断を再現**します。
書いていなければ、**次に触ったときに元に戻されます**。

**4. 資料そのものを検査する**

古い資料は、AI にとって**間違った前提**になります。
「465 セクション」と書いてあれば、AI はそう信じて作業します。

そのため、**資料の数値が実態と合っているか**も検査しています
（`check-doc-numbers` / `check-stale-counts`）。

### まとめると

> **AI は速く書けますが、正しさの基準は持っていません。**
> 基盤は、その基準を**コードと検査の形で外に置く**ためのものです。

人が増やせない中で開発量を増やすには、AI に書かせるしかありません。
そのとき**間違いも同じ速さで増えます**。
基盤と検査は、**その速さに耐えるための仕組み**です。

## クイックスタート

```bash
bash scripts/setup.sh          # Windows: .\scripts\setup.ps1

# まずは「動く実例集」を見るのがおすすめ（DB もログインも要りません）
pnpm dev:showcase                 # → http://localhost:3001
```

**次に何を見るか**は目的で選べます。

| やりたいこと | コマンド | URL |
|---|---|---|
| 基盤に何があるか知る | `pnpm dev:showcase` | http://localhost:3001 |
| 社内アプリを触る（DB が要ります）| `pnpm dev:internal` | http://localhost:3000 |
| 新しいアプリの雛形を見る | `pnpm dev:crud` | http://localhost:3002 |
| 全部まとめて起動する | `pnpm dev` | 3000〜3004 |

前提: Node.js 22+ / Docker Desktop(pnpm は corepack が自動)。VS Code / Codespaces なら **「Reopen in Container」** でも開始できます(`.devcontainer` 同梱)。

- **はじめての方**(ツールが何も入っていない): [docs/onboarding/01-setup.md](docs/onboarding/01-setup.md)
- **詰まったとき**: [docs/onboarding/03-development.md](docs/onboarding/03-development.md#困ったときは)
- **setup の中身・Prisma 運用**: [docs/onboarding/01-setup.md](docs/onboarding/01-setup.md)

## 技術スタック

- Next.js 16 / React 19 / TypeScript 5(strict）
- PostgreSQL + Prisma 7(生SQL も安全に実行可能）
- Tailwind CSS 4 + shadcn/ui(共通 UI）
- pnpm workspaces + Turborepo(モノレポ）
- Vitest（テスト）/ TypeDoc（基盤ドキュメント）/ Changesets（バージョン管理）
- Docker（ローカル＝本番と同構成。AWS / ConoHa どちらにも展開可）

## ディレクトリ

### 全体```
apps/         アプリ（**基盤の git で管理しません**。置き方は apps/README.md）
packages/     基盤 120 パッケージ（ロジックを持たない部品）
tools/        検査・生成ツール（71 種類の検査＋生成物）
docs/         資料（ops/ は運用、ai/ は自動生成）
tests/        契約テスト（外部 SaaS の応答の形）
e2e/          Playwright の E2E
ops/          残債の記録（debt-history.json）
scripts/      デプロイ・バックアップの補助
```


**`packages/` にロジックを置かない。** 「請求書の合計を出す」は基盤、
「この会社では締日が 20 日」はアプリです。基盤に業務の都合が入ると、
**別のアプリで使えなくなります**。

**`tools/` は依存をインストールせずに動きます。** `pnpm check` が
71 種類を一度に走らせ、CI の前に手元で確認できます。

### アプリと基盤

### 基盤パッケージ（120 件）

**探すときは `pnpm advisor find "二重送信"` が速い**——
やりたいことを日本語で書くと、関数や型の説明まで見て探します。
全件の索引は `docs/ai/module-list.md`（自動生成）にもあります。

```
apps/internal-app     # 社内アプリ本体（経費・請求・勤怠・チャット・CMS…）
apps/showcase         # 基盤の使い方を示すデモ（業務データは扱わない）
apps/public-site      # 公開サイト（ブログ・問い合わせ）
apps/line-console     # LINE 連携の管理画面
apps/crud-template    # 新しいアプリの雛形（`pnpm new-app` でコピーされる）
packages/             # 基盤 118 パッケージ（下記）

# 基礎・共通規約
  core          エラー規約・Result 型（土台）
  logger        構造化ログ・機微情報マスク
  env           環境変数の起動時検証（fail-fast）
  config        共通 tsconfig / vitest プリセット
  validation    共通バリデーション（日本固有・チェックディジット）
  utils         規律ある汎用ヘルパー（関数/配列/非同期/日本語/統計）
  datetime      JST 前提の日時整形・営業日・和暦
  context       リクエスト相関 ID（AsyncLocalStorage）
  testing       テスト工具・契約テスト
  faker         日本語ダミーデータ生成
  json          JSON の安全な操作（循環参照・BigInt・正規化・差分・伏せ字）
  xml           XML の生成・解析（電子申告・EDI。日本語のタグ名に対応）
  html          HTML エスケープ・埋め込み（用途別に使い分ける）
  i18n          多言語（ja/en/ko/zh）。帳票の言語切り替えに使う
  debug         開発時の計測（N+1 検出・遅いクエリ）
  loadtest      負荷試験のシナリオ
  blueprint     設計の雛形生成

# データ・永続化
  db            DB アクセス・型付き生SQL・Tx・監査ログ（Prisma 7）
  cache         キャッシュ（メモリ / Redis・single-flight）
  storage       ファイル操作（ローカル / S3 互換）
  fs            ファイル種別判定（マジックバイト）・安全パス
  csv           CSV 生成・解析
  xlsx          Excel 入出力（ExcelJS）
  search        全文検索（BM25 / Meilisearch）
  web-storage   ブラウザ保存の薄い包み（容量超過・無効化に耐える）
  saga          分散トランザクション（補償付き）

# 通信・Web連携
  http          AppError→HTTP 変換・Route 処理
  net           URL/リトライ/IP-CIDR・低レベルプロトコル
  url           URL・ドメイン処理（解析・クエリ操作・ドメイン抽出・正規化・検証）
  mail          メール送信（Transport 差し替え）
  sms           SMS・電話送信（Adapter）
  notify        チャット通知 Slack/Teams/LINE
  realtime      自動更新（ポーリング・再接続 WS）
  integrations  外部 API 連携（型付き HTTP クライアント）
  social        SNS連携（X/TikTok/Instagram・ハンドル/URL解析・oEmbed・アカウント管理）
  booking       予約サイト（営業時間・スロット・空き枠・予約ルール・ステータス）
  cast          キャスト（一覧絞込・並び替え・注目/新人・プロフィール）
  webhook       汎用 Webhook 受信（署名検証・冪等・分配）
  feed          RSS 2.0 / Atom 1.0 / sitemap の生成
  mcp           MCP サーバ（AI から社内データを引く）
  push          Web Push 通知

# 外部SaaS連携
  zoho          Zoho 連携（14サービス + トークン管理）
  google        Google 連携（ログイン/Gmail/Drive/Calendar/Sheets/Maps）
  line          LINE（送信 + Webhook 受信 + ビルダー）
  freee         freee（会計 + 人事労務 + 承認 + Webhook）
  stripe        Stripe 決済（公式SDKラッパー）
  paypal        PayPal 決済（Orders v2）
  ekyc          eKYC 本人確認ベンダー連携（TRUSTDOCK 等）
  slack         Slack 通知・イベント受信
  notion        Notion のページ・データベース操作
  microsoft     Microsoft Graph（メール・予定表）

# 認証・セキュリティ
  auth          認証状態・RBAC・OIDC 設定標準化
  session       セッション・クッキー処理
  guard         ルート/ページ保護（認証・権限・レート制限）
  crypto        機密データ暗号化・パスワードハッシュ
  security      セキュリティヘッダ・HTML サニタイズ
  ratelimit     レート制限（メモリ / Redis）
  secrets       シークレット抽象（env / Vault・TTL）
  pii           個人情報保護（マスク・検索可能暗号・匿名化）
  apikey        API キー / M2M 認証（発行・スコープ・失効）
  access-review アクセス権の棚卸し・入退社の手順
  audit         監査ログ（ハッシュチェーンで改ざんを検出）

# 非同期・ジョブ
  jobs          非同期ジョブ（キュー）
  cron          定期実行（スケジューラ・分散ロック）
  workflow      多段承認ワークフロー（純ロジック）
  fsm           汎用ステートマシン
  rpa           定型作業の自動化（画面操作の記録・再生）
  task          タスク管理

# UI・フォーム・帳票
  ui            共通 UI 部品（106コンポーネント / shadcn/ui）
  form          フォーム統合（react-hook-form + zod + ui）
  report        帳票（請求書・消費税・インボイス）
  pdf           帳票 PDF 生成（HTML→PDF）
  print         印刷（ブラウザ・ESC/POS レシート）
  i18n          多言語（日英中韓・Intl 整形）
  color         色変換・WCAG コントラスト
  theme         テーマ（色・角丸・余白の切り替え）
  barcode       バーコード・QR の生成と読み取り

# メディア・デバイス
  media         動画・音声処理（ffmpeg）
  image         画像処理（sharp / 寸法計算）
  ocr           画像 OCR（tesseract / クラウド）
  upload        アップロード/DL の HTTP 境界処理
  device        端末・ブラウザ・OS・NW 情報
  mobile        タブレット・スマホ向け処理（レスポンシブ/ネットワーク/端末操作）
  bluetooth     Web Bluetooth（BLE）
  hid           WebHID（PC 周辺機器）
  os-notify     OS のデスクトップ通知

# 日本の業務ドメイン
  address       郵便番号→住所 逆引き
  phone         電話番号（正規化/種別/E.164）
  currency      通貨・為替・複数通貨合算
  units         単位変換（尺貫法含む）
  tax           消費税・インボイス（軽減税率・登録番号）
  commerce      EC基盤（カート・お気に入り・割引・注文計算・在庫引当）
  blog          ブログ/コンテンツ基盤（スラッグ・抜粋・読了時間・目次・RSS）
  seo           SEO（メタタグ・OGP・JSON-LD構造化データ・robots.txt）
  site          公式サイト・LP（ページ構成・ナビ・リダイレクト・お知らせバー）
  payroll       勤怠・給与計算（労基法／時間外・深夜・法定休日の割増）
  dencho        電子帳簿保存法対応（改ざん検知・タイムスタンプ・検索要件）
  importer      一括インポート枠組み
  sequence      帳票番号の連番採番
  zengin        全銀協 総合振込データ生成
  accounting    仕訳・勘定科目・試算表
  invoice       請求書（インボイス制度・適格請求書）
  quote         見積書（請求書への変換）
  purchase      発注・買掛
  inventory     在庫（入出庫の履歴から残高を計算）
  attendance    勤怠（打刻・残業・休暇）
  depreciation  減価償却（定額法・定率法）
  contract      契約書（更新期限・電子署名）
  analytics     分析（売上・傾向）

# 運用・観測性
  observability トレース/メトリクス/冪等性/ブレーカー/Outbox
  flags         フィーチャーフラグ（kill switch・段階リリース）
  status-page   メンテナンス/エラー画面・切り替えゲート

tools/                # smoke / check-deps / api-surface / scaffold
docs/platform         # 基盤ドキュメント（読者: 基盤利用者）
docs/apps             # アプリドキュメント（読者: アプリ開発者）
```

**説明は各パッケージの `README.md` の冒頭 1 行に書いてください。**
そこが `module-list.md` に出ます。`package.json` の `description` は使いません
——120 件すべて空ですが、**内製で npm へ公開しないため**です（ADR 0011）。

### パッケージの成熟度（tier）

**120 件は横並びではありません。** `package.json` の `platform.tier` で
「本番で使ってよいか」を宣言しています。一覧は `node tools/check-package-tier.mjs --list`。

| tier | 意味 | 件数 |
|---|---|---|
| `stable` | 実アプリが使っている（または stable が依存している）。**公開 API を壊すには Changesets の major が要る** | 93 |
| `incubating` | **実アプリでの使用実績がまだ無い。** showcase では動くが、**予告なく変わる** | 26 |
| `deprecated` | 廃止予定。新規利用禁止（移行先は README の冒頭に書く） | 0 |

**`stable` は `incubating` に依存できません**（`check-package-tier` が止めます）。
「安定」と言いながら足元が動くものの上に立たないためです。

tier を上げるのは**実アプリで使ってから**。「そのうち使う」で上げると、
この区別は意味を失い、**未検証の 26 件を本番品質で保守し続ける**ことになります。

## 設計原則

基盤の全パッケージが従う共通の約束です。

1. **基盤はロジックを持たない。** 機能単位の共通部品のみを提供し、業務判断はアプリ側に置く。
2. **有名ライブラリはラッパー経由で使う。** 実装(pino / Prisma / nodemailer 等)は隠し、公開 API だけをアプリに見せる。差し替え可能にして特定ライブラリへの依存を局所化する。
3. **失敗は値で扱う。** すべての失敗は `@platform/core` の `AppError` / `Result<T>` に統一。エラーコードから HTTP ステータス・再試行可否が一意に決まる(`ERROR_POLICY`)。
4. **副作用は注入する。** `fetch`・時刻・ストア・トランスポートはすべて注入可能にし、テスト可能かつ耐障害ラッパーと合成できる形にする。
5. **依存は一方向。** アプリ→基盤の依存のみ許可。基盤どうしの循環は禁止し、CI で機械的に検出する。
6. **日本の業務を一級市民として扱う。** 和暦・営業日・消費税/インボイス・全銀・郵便番号・電話番号などを標準搭載する。

## 基盤が保証すること

- **単一の情報源。** 各機能の実装は基盤に1つだけ。アプリ横断の重複実装を防ぐ。
- **後方互換と段階的廃止。** 公開 API の変更は Changesets でバージョン管理し、破壊的変更は段階的に廃止する。公開 API のスナップショット(`docs/platform/api-surface.json`)で意図しない変更を検出する。
- **耐障害性の既定装備。** リトライ・サーキットブレーカー・冪等性・Outbox・バルクヘッド・graceful shutdown を基盤側で提供し、アプリは設定するだけで使える。
- **観測可能性の既定装備。** 構造化ログ・分散トレース(W3C)・メトリクス(Prometheus)・相関 ID がゼロ設定で連動する。
- **検証済みの品質。** 全パッケージに README・テストを完備し、依存不要のスモーク検証(`pnpm smoke`)で主要ロジックを継続的に確認する。

## コマンド

**よく使うもの**（全一覧は `docs/ops/COMMANDS.md`）:

| コマンド | 内容 |
|---|---|
| `pnpm dev` / `pnpm build` | 開発 / 本番ビルド |
| `pnpm check` | **依存なしで 71 種類の検査**（コミット前にこれ） |
| `pnpm test` | 全パッケージのテスト |
| `pnpm typecheck` | 型検査（**依存が要る**） |
| `pnpm advisor find "<やりたいこと>"` | **作る前に探す**（日本語で検索） |
| `pnpm gen:all` | 生成物を作り直す |
| `pnpm new-app <名前> "<説明>"` | 新しいアプリの雛形 |
| `pnpm doctor` | 環境診断（動かないときに) |


## 資料の地図

資料は **4 箇所**に分かれています。**どれを見るかで迷わないよう**、役割を決めてあります。

**全部で 92 件**あります。**2026-08 に入門資料を 6 → 4 件に束ねました**（内容は減らしていません）。

| 場所 | 件数 | 何が書いてあるか |
|---|---|---|
| **ルート** | 3 | **`README` / `CLAUDE.md`（AI 向け規約）/ `CONTRIBUTING.md` の 3 つだけ** |
| **`docs/onboarding/`** | 5 | **はじめての人へ**。番号順に読む（環境構築 → 最初の 1 時間 → 開発 → 課題） |
| **`docs/ops/`** | 20 | **運用の手順**。検査・障害対応・バックアップ・引き継ぎ |
| **`docs/adr/`** | 24 | **設計判断の記録**（なぜその形にしたか。覆すときはここに追記） |
| **`docs/platform/`** | 5 | 基盤の説明（カタログ・一覧・チャット・連携） |
| **`docs/ai/`** | 7 | AI 向けの入口。**3 件は自動生成**、4 件は手書き（各ファイルの先頭に印） |
| **`docs/`** 直下 | 6 | DB・検証の手引き |
| **`docs/apps/` / `docs/site/`** | 2 | アプリ一覧・参照サイト |

### 目的から引く

| 知りたいこと | 見る場所 |
|---|---|
| **基盤に何があるか** | `docs/ai/module-list.md`（自動生成・120 件） |
| **どの画面・API があるか** | `apps/<アプリ名>/docs/appmap.md`（**自動生成**・アプリ別。internal-app は 321 件） |
| **DB に何のテーブルがあるか** | `apps/<アプリ名>/docs/erd.md`（自動生成・アプリ別） |
| **どのアプリがあるか** | `docs/APPS_AND_DEMOS.md`（自動生成） |
| **検査は何を守るか** | `docs/ops/CHECKS.md`（71 種類） |
| **なぜこうなっているか** | `docs/ops/HANDOVER.md`（**判断の記録**） |
| **コマンド** | `docs/ops/COMMANDS.md` |
| **本番が落ちた** | `docs/ops/INCIDENT_RESPONSE.md`（アラート別・症状別の手順） |
| **利用者から問い合わせ** | `docs/ops/SUPPORT_GUIDE.md`（「ログインできない」など） |
| **オンコールの当番** | `docs/RUNBOOK.md`（RPO / RTO・連絡先・定期作業） |
| **画面が動かない** | `docs/ops/DEVTOOLS_GUIDE.md`（ブラウザで原因を追う） |
| **バックアップと復元** | `docs/ops/BACKUP_RESTORE.md` |
| **AI に手伝わせるとき** | `CLAUDE.md`（規約と落とし穴） |

### ADR と HANDOVER の使い分け

**どちらも「なぜそうしたか」を書く**ので紛らわしいですが、役割が違います。

| | `docs/adr/`（24 件） | `docs/ops/HANDOVER.md` |
|---|---|---|
| **何を書くか** | **後戻りしにくい選択**（DB は PostgreSQL・モノレポにする） | **見つけた欠陥と、その場の判断** |
| **いつ書くか** | 選ぶとき | 直したとき |
| **形** | 1 決定 = 1 ファイル。**覆すときは新しい ADR を足す**（消さない） | 1 ファイルに追記していく |
| **読む人** | 「なぜこの技術なのか」を知りたい人 | 「なぜこのコードがこうなのか」を知りたい人 |

**迷ったら HANDOVER。** ADR は「1 年後も効いている選択」だけにしてください
——増えすぎると読まれなくなります。

### 参照関係を見る

**どの資料がどこから参照されているか**は `docs/DOCS_GRAPH.md`（自動生成）にあります。

- **参照される数が多い** = 終点（`ops/COMMANDS` が最多で 11）
- **参照する数が多い** = 入口
- **相互参照 22 組** — お互いを指し合うのは「概要 ↔ 詳細」なら自然ですが、
  **役割が曖昧**な可能性もあります

作り直す: `pnpm gen:all`

### 重複について

`check-docs-duplication` が **30 件の重複**を検出しています。
**同じ話題が複数の資料に出ること自体は問題ありません**——
手順書と設計の記録で、同じ機能を別の角度から書くことはあります。

**問題は「片方だけ更新されて食い違う」ことです。** 次の 2 つを守ってください:

- **数値は書かない。** どうしても書くなら `check-doc-numbers` の対象にする
  （実態とずれたら検査が落ちます）
- **手順は 1 箇所に書き、他からはリンクする。** コピーすると必ず片方が古くなります

**`docs/HISTORY.md`（4,021 行）は古くなっています。**
冒頭に警告を入れてありますが、**存在しないアプリ名**などが残っています。
設計の意図を長文で読みたいとき以外は、上の表から辿ってください。


## 開発ルール

**アプリ修正時に基盤(`packages/**`）のソースを編集しないこと。**
詳細は [`CLAUDE.md`](./CLAUDE.md) を参照。境界は ESLint(boundaries）・CODEOWNERS・
CI で機械的に担保しています。

## GitHub 運用フロー

```
基盤リポジトリを clone
   └─ Claude に読み込ませる(CLAUDE.md → docs/platform/CATALOG.md を参照)
        └─ apps/ に社内アプリを実装
             ├─ 欲しい処理が @platform/* にある → それを使う
             └─ 無ければ apps/ 側に実装(packages/ は触らない)
```

### CI(pull request / push)
`.github/workflows/ci.yml` が `lint → typecheck → test → build` を実行。
アプリと基盤を混在させた PR には警告を出す(境界ガード)。

### CD(main / タグ)
1. `release.yml` … 本番 Docker イメージをビルドして GHCR に push。
2. デプロイ(いずれか一方を使う):
   - **ConoHa**: `deploy-conoha.yml` … SSH で `docker compose -f docker-compose.prod.yml pull && up -d`。
     Secrets: `CONOHA_HOST` / `CONOHA_USER` / `CONOHA_SSH_KEY`。
   - **AWS**: `deploy-aws.yml.template` … ECS へデプロイ(使用時に `.template` を外す)。

### 必要な準備
- `docker-compose.prod.yml` の `ghcr.io/OWNER/REPO` を自リポジトリ名に置換。
- GitHub の Settings → Secrets にデプロイ先の認証情報を登録。
- `main` ブランチに保護ルール(PR 必須・CI 必須・CODEOWNERS レビュー必須)を設定。
- 依存更新は `renovate.json` で自動 PR 化(Renovate App を有効化)。

## どんなアプリ・デモがあるか

5 つのアプリと 1 のデモの紹介は [docs/APPS_AND_DEMOS.md](docs/APPS_AND_DEMOS.md) を参照してください。
