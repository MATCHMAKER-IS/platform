# 社内基盤プラットフォーム (monorepo)

> **はじめての方へ**: 何も入っていない PC からのセットアップ〜開発〜公開までは
> **[docs/ops/GETTING_STARTED.md](docs/ops/GETTING_STARTED.md)** に全部書いてあります（Windows/Mac 対応）。
> Git/GitHub が初めてなら **[docs/ops/GIT_GUIDE.md](docs/ops/GIT_GUIDE.md)**、
> Cursor で開発するなら **[docs/ops/CURSOR_GUIDE.md](docs/ops/CURSOR_GUIDE.md)** も。
> どの資料を読めばいいかは **[docs/README.md](docs/README.md)**（地図）から。

> 検証・起動手順は [docs/VERIFY.md](docs/VERIFY.md) を参照(依存不要スモーク: `pnpm smoke`)。

Node.js + Next.js + PostgreSQL による社内アプリ基盤(内製プラットフォーム)。

社内で作る業務アプリが共通して必要とする機能——DB アクセス、認証、外部 SaaS 連携、
帳票、通知、耐障害性など——を **99 の再利用可能なパッケージ**として提供します。
アプリ開発者は業務ロジックの実装に集中でき、共通処理の再発明・属人化・ブラックボックス化を防ぎます。

**設計の背骨は「基盤(`packages/`)とアプリ(`apps/`)の分離」**です。
基盤はロジックを持たず機能単位の共通部品のみを提供し、業務ロジックはアプリ側に置きます。
この境界は ESLint(boundaries)・CODEOWNERS・CI で機械的に担保しています。

## クイックスタート

```bash
bash scripts/setup.sh    # Windows: .\scripts\setup.ps1
pnpm dev                 # 全アプリ起動(3000〜3005)
```

前提: Node.js 22+ / Docker Desktop(pnpm は corepack が自動)。VS Code / Codespaces なら **「Reopen in Container」** でも開始できます(`.devcontainer` 同梱)。

- **はじめての方**(ツールが何も入っていない): [docs/ops/GETTING_STARTED.md](docs/ops/GETTING_STARTED.md)
- **詰まったとき**: [docs/ops/GETTING_STARTED_2.md](docs/ops/GETTING_STARTED_2.md#困ったときは)
- **setup の中身・Prisma 運用**: [docs/ops/SETUP.md](docs/ops/SETUP.md)

## 技術スタック

- Next.js 16 / React 19 / TypeScript 5(strict）
- PostgreSQL + Prisma 7(生SQL も安全に実行可能）
- Tailwind CSS 4 + shadcn/ui(共通 UI）
- pnpm workspaces + Turborepo(モノレポ）
- Vitest（テスト）/ TypeDoc（基盤ドキュメント）/ Changesets（バージョン管理）
- Docker（ローカル＝本番と同構成。AWS / ConoHa どちらにも展開可）

## ディレクトリ

```
apps/internal-app     # 社内アプリ本体（業務ロジックはここ）
demos/showcase        # 基盤の使い方を示すデモ
packages/             # 基盤 90 パッケージ（下記）

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

# データ・永続化
  db            DB アクセス・型付き生SQL・Tx・監査ログ（Prisma 7）
  cache         キャッシュ（メモリ / Redis・single-flight）
  storage       ファイル操作（ローカル / S3 互換）
  fs            ファイル種別判定（マジックバイト）・安全パス
  csv           CSV 生成・解析
  xlsx          Excel 入出力（ExcelJS）
  search        全文検索（BM25 / Meilisearch）

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

# 外部SaaS連携
  zoho          Zoho 連携（14サービス + トークン管理）
  google        Google 連携（ログイン/Gmail/Drive/Calendar/Sheets/Maps）
  line          LINE（送信 + Webhook 受信 + ビルダー）
  freee         freee（会計 + 人事労務 + 承認 + Webhook）
  stripe        Stripe 決済（公式SDKラッパー）
  paypal        PayPal 決済（Orders v2）
  ekyc          eKYC 本人確認ベンダー連携（TRUSTDOCK 等）

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

# 非同期・ジョブ
  jobs          非同期ジョブ（キュー）
  cron          定期実行（スケジューラ・分散ロック）
  workflow      多段承認ワークフロー（純ロジック）
  fsm           汎用ステートマシン

# UI・フォーム・帳票
  ui            共通 UI 部品（106コンポーネント / shadcn/ui）
  form          フォーム統合（react-hook-form + zod + ui）
  report        帳票（請求書・消費税・インボイス）
  pdf           帳票 PDF 生成（HTML→PDF）
  print         印刷（ブラウザ・ESC/POS レシート）
  i18n          多言語（日英中韓・Intl 整形）
  color         色変換・WCAG コントラスト

# メディア・デバイス
  media         動画・音声処理（ffmpeg）
  image         画像処理（sharp / 寸法計算）
  ocr           画像 OCR（tesseract / クラウド）
  upload        アップロード/DL の HTTP 境界処理
  device        端末・ブラウザ・OS・NW 情報
  mobile        タブレット・スマホ向け処理（レスポンシブ/ネットワーク/端末操作）
  bluetooth     Web Bluetooth（BLE）
  hid           WebHID（PC 周辺機器）

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

# 運用・観測性
  observability トレース/メトリクス/冪等性/ブレーカー/Outbox
  flags         フィーチャーフラグ（kill switch・段階リリース）
  status-page   メンテナンス/エラー画面・切り替えゲート

tools/                # smoke / check-deps / api-surface / scaffold
docs/platform         # 基盤ドキュメント（読者: 基盤利用者）
docs/apps             # アプリドキュメント（読者: アプリ開発者）
```

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

## セットアップ

```bash
corepack enable
pnpm install
cp .env.example .env
docker compose up -d          # PostgreSQL + Mailpit を起動
pnpm --filter @platform/db db:migrate
pnpm dev                      # アプリを起動（http://localhost:3000）
```

## 主要コマンド

| コマンド | 内容 |
|---|---|
| `pnpm dev` / `pnpm build` | 開発 / 本番ビルド |
| `pnpm test` | 全パッケージのテスト |
| `pnpm lint` / `pnpm typecheck` | 静的検査 / 型チェック |
| `pnpm docs:platform` | 基盤 API ドキュメント生成 |
| `pnpm scaffold <name>` | 新パッケージ雛形を生成 |
| `pnpm changeset` | 基盤バージョン・変更履歴を記録 |

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

## よく使うコマンド

`pnpm doctor`（環境診断）、`pnpm check`（型+lint+smoke）、`pnpm gen:all`（生成物更新）など。一覧は [docs/ops/COMMANDS.md](docs/ops/COMMANDS.md) を参照。

## どんなアプリ・デモがあるか

5 つのアプリと 26 のデモの紹介は [docs/APPS_AND_DEMOS.md](docs/APPS_AND_DEMOS.md) を参照してください。
