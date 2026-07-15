# 開発環境セットアップ（リファレンス）

> **はじめての方は [ゼロから開発・公開まで](GETTING_STARTED.md) へ。**
> ツールの入れ方から順に説明しています（Windows/Mac 対応）。
>
> **このページは経験者向けのリファレンス**です。「Node も Docker も入っている。要点だけ知りたい」人向けに、
> setup スクリプトの中身・Prisma の運用・devcontainer など**手順の裏側**をまとめています。

| 知りたいこと | 見るページ |
|---|---|
| ツールの入れ方から知りたい | [GETTING_STARTED.md](GETTING_STARTED.md) |
| 詰まったときの対処 | [GETTING_STARTED_2.md](GETTING_STARTED_2.md#困ったときは) |
| コマンドの一覧 | [COMMANDS.md](COMMANDS.md) |
| **setup が何をしているか**（このページ） | ↓ |
| **Prisma の運用**（このページ） | ↓ |
| **devcontainer / Codespaces**（このページ） | ↓ |

GitHub から clone した直後に、ローカルで apps 開発を始められる状態にするための手順。**基本は 1 コマンド**です。

## クイックスタート

```bash
git clone <このリポジトリ> && cd platform
bash scripts/setup.sh        # または pnpm setup(pnpm 有効化後)
pnpm --filter crud-template dev   # → http://localhost:3002
```

うまくいかないときは `bash scripts/setup.sh --check` で前提条件だけ確認できます。

## 前提条件

| 必要なもの | 版 | 備考 |
|---|---|---|
| Node.js | **22 以上** | https://nodejs.org |
| pnpm | 9(自動) | Node 同梱の **corepack** が `package.json` の `packageManager` 指定版を自動使用 |
| Docker Desktop | 最新 | PostgreSQL / Mailpit 用。`docker compose` v2 |
| git | - | - |

Windows は **WSL2 または PowerShell/バッチ**で実行できます(下記「Windows でのセットアップ」参照。`scripts\setup.ps1` / `scripts\setup.bat` が `setup.sh` と同等)。WSL2 なら bash 版がそのまま使えます。

## setup.sh がやること(冪等・再実行安全)

| # | ステップ | 内容 |
|---|---|---|
| 1 | 前提確認 | Node≥22 / corepack / Docker 稼働 / ポート使用状況(5432, 1025, 8025) |
| 2 | .env 準備 | 各アプリの `.env.example` → `.env` コピー(**既存は上書きしない**) |
| 3 | インフラ起動 | `docker compose up -d db mailhog`(既存 docker-compose.yml を利用)+ 起動待ち |
| 4 | DB 作成 | アプリ別 DB(`app` / `app_crud` / `app_equipment`)を psql で冪等作成 |
| 5 | 依存導入 | `pnpm install` |
| 6 | Prisma generate | 3 アプリのスキーマ分。**install 直後に必須**(無いと typecheck / dev が失敗) |
| 7 | スキーマ適用 | `prisma db push` ×3(履歴管理したい場合は migrate。下記) |
| 8 | 検証 | `pnpm smoke`(850+ 項目)+ `check-deps` |

オプション: `--check`(確認のみ)/ `--skip-docker`(DB を自前用意)/ `--skip-db`(スキーマ適用を省略)。

## 起動するもの・ポート一覧

| ポート | 何 | 起動 |
|---|---|---|
| 3000 | internal-app | `pnpm dev:internal` |
| 3001 | @demos/showcase | `pnpm dev:demos`(E2E の対象) |
| 3002 | crud-template | `pnpm dev:crud`(新アプリのコピー元) |
| 3003 | equipment-app | `pnpm dev:equipment`(初期: admin@example.com / admin1234) |
| 3004 | public-site | `pnpm dev:site` |
| 3005 | platform-portal | `pnpm dev:portal`(基盤カタログ) |
| 5432 | PostgreSQL 17 | user/pass/db: app / app / app(compose) |
| 1025 / 8025 | Mailpit | SMTP / **Web UI**。アプリが送るメールは http://localhost:8025 で確認 |
| 7700 / 6379 | Meilisearch / Redis | 任意(`docker compose up -d` で全部起動)。既定の検索はメモリBM25なので無くても動く |

`pnpm dev` で **全アプリを一斉起動**できます(ポートは各 package.json で固定済み)。重複は `node tools/check-ports.mjs` が検出します。

**DB をアプリ別に分ける理由**: スキーマ(60 / 1 / 2 モデル)を独立して push/migrate でき、`prisma db push` の差分計算が他アプリの表に影響しないため。接続先は各 `.env` の `DATABASE_URL`。

## .env の考え方

- 実体の `.env` は **git 管理外**(.gitignore 済)。ひな形は各 `apps/<app>/.env.example`。
- コードが参照する変数と `.env.example` の整合は `node tools/check-env-example.mjs` が検査(CI 組込済)。**環境変数を増やしたら .env.example にも追記**してください。
- crud-template / equipment-app は既定 **インメモリ**(DB なしで即動作)。`PERSISTENCE=prisma` + `DATABASE_URL` で PostgreSQL に切替。internal-app は `DATABASE_URL` 必須(ストア自体の切替は `CHAT_PERSISTENCE=prisma`)。

## Prisma の運用

```bash
# クライアント生成(install 後・schema 変更後)
pnpm --filter @platform/db exec prisma generate --schema=../../apps/internal-app/prisma/schema.prisma

# 開発中の即時反映(履歴なし)— setup.sh はこちら
DATABASE_URL=postgresql://app:app@localhost:5432/app \
  pnpm --filter @platform/db exec prisma db push --schema=../../apps/internal-app/prisma/schema.prisma

# 本番稼働を始める前にマイグレーションへ移行する(理由と手順: docs/adr/0013)
DATABASE_URL=... pnpm --filter @platform/db exec prisma migrate dev --name init --schema=../../apps/internal-app/prisma/schema.prisma
```

prisma CLI は `@platform/db`(^7.2.0)に集約しています。初回 generate はエンジンのダウンロードが走るためネットワークが必要です。

## つまずき（このページ固有のもの）

一般的な対処は **[GETTING_STARTED_2.md の「困ったときは」](GETTING_STARTED_2.md#困ったときは)** にまとめています。ここでは setup / Prisma / devcontainer 固有のものだけ。

| 症状 | 対処 |
|---|---|
| ポート 5432 が使用中 | ローカル PostgreSQL を停止するか、compose 側のポートを変更 |
| `prisma generate` が engines DL で失敗 | プロキシ/オフライン環境。ネットワーク到達性を確認（`binaries.prisma.sh` への到達が必要） |
| `.env` を変えたのに反映されない | `pnpm dev:*` を再起動（Next は起動時読込。`server/env.ts` も起動時に一度だけ評価） |
| internal-app が起動時に env エラー | `.env` の必須3つ(DATABASE_URL / MAIL_FROM / SESSION_SECRET)を確認 |
| devcontainer で DB に繋がらない | ホスト名は `db`(localhost 不可)。post-create が .env を置換済みか確認 |
| 本番で「秘密値の強度が不十分」で起動しない | 仕様です。開発用の既定値のままでは本番起動できません → [公開する](GETTING_STARTED_2.md#7-公開するデプロイ) |

## 手動セットアップ(スクリプトを使わない場合)

```bash
corepack enable
cp apps/internal-app/.env.example apps/internal-app/.env   # 他3アプリも同様
docker compose up -d db mailhog
docker compose exec -T db psql -U app -d postgres -c "CREATE DATABASE app_crud"
docker compose exec -T db psql -U app -d postgres -c "CREATE DATABASE app_equipment"
pnpm install
# generate / db push は上記「Prisma の運用」の3スキーマ分
pnpm smoke
```

## devcontainer / GitHub Codespaces で開く

ホストに Node / pnpm を入れずに、**Docker だけで同一環境**を立ち上げる選択肢(VS Code「Reopen in Container」/ Codespaces)。

- 構成: `.devcontainer/` — ベースの docker-compose.yml に workspace(Node 22)を重ね、db / mailhog を同時起動
- 初期化は全自動: post-create が `.env` を作成(ホスト名を **db / mailhog** に自動置換)→ pnpm install → prisma generate / db push → smoke
- ポート 3000〜3004 / 8025 は自動フォワード。既存 DB ボリュームでも `tools/create-app-dbs.mjs` が不足 DB を冪等作成
- 注意: コンテナ内の接続先は `@db:5432` / `SMTP_HOST=mailhog`(localhost ではない)

## よく使うショートカット

| コマンド | 内容 |
|---|---|
| `pnpm verify:offline` | オフライン検証 8 ゲート一括(preflight・約10秒。CI boundaries と同一) |
| `pnpm db:up` / `pnpm db:down` / `pnpm db:psql` | DB+Mailpit の起動 / 停止 / psql 接続 |
| `pnpm db generate\|push\|validate [app\|all]` | Prisma 操作(--schema と DATABASE_URL を自動解決) |
| `pnpm db migrate <app> -- --name xxx` | 履歴つきマイグレーション |
| `pnpm db push all --dry-run` | 実行せずコマンド確認(db 系は全対応) |
| `pnpm dev:crud` / `dev:equipment` / `dev:internal` / `dev:site` / `dev:demos` | 各アプリ起動(ポートは上表) |
| `pnpm mcp` | MCP サーバ起動(Claude Desktop / Code 連携) |

## 次に読むもの

- **[ドキュメントの地図](../README.md)** — 目的から探せます
- 新アプリの作り方: [NEW_APP.md](NEW_APP.md)（手順とチェックリスト）
- 開発の流れ: [GETTING_STARTED_2.md](GETTING_STARTED_2.md)
- 実装の書き方: [../ai/patterns.md](../ai/patterns.md)
- CI を回す: [CI_FIRST_RUN.md](CI_FIRST_RUN.md)

## Windows でのセットアップ（スクリプトの仕様）

> ツールの入れ方（winget での一括インストール等）は [GETTING_STARTED.md](GETTING_STARTED.md#windows-の場合) にあります。
> ここは `setup.ps1` の仕様です。

macOS / Linux の `bash scripts/setup.sh` と同等の処理を PowerShell / バッチで用意しています。

### 前提
- Node.js 22 以上
- Docker Desktop（`-SkipDocker` で省略も可）
- PowerShell 5.1（Windows 標準）または PowerShell 7（pwsh）— 自動判定します

### 実行

PowerShell から:

```powershell
# 前提確認のみ（何も変更しない）
pwsh scripts/setup.ps1 -Check
# フルセットアップ
pwsh scripts/setup.ps1
# Docker を使わない場合
pwsh scripts/setup.ps1 -SkipDocker
```

コマンドプロンプト（cmd）やエクスプローラーからのダブルクリックなら、バッチ版が簡単です（実行ポリシーの回避も内包）:

```bat
scripts\setup.bat --check
scripts\setup.bat
scripts\setup.bat --skip-docker
```

`setup.bat` は PowerShell 7（pwsh）があればそれを、無ければ Windows PowerShell を自動選択します。

### 実行ポリシーで止まる場合
Windows PowerShell で「スクリプトの実行が無効」と出たら、一度だけ以下を実行してください（バッチ版は `-ExecutionPolicy Bypass` を内包しているので不要です）:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### 補足
- `-Check` / `-SkipDocker` / `-SkipDb` は sh 版の `--check` / `--skip-docker` / `--skip-db` と同じです。
- スクリプトは冪等（再実行安全）で、既存の `.env` は上書きしません。
- 内容の静的検査は `node tools/check-win-setup.mjs`（preflight に組み込み済み）。

## CI が失敗したときのログ解析

GitHub Actions のジョブログをコピーしてファイルに貼り、次のコマンドで要約できます:

```bash
node tools/ci-log-report.mjs ci.log          # 失敗ステップ・エラー行・遅いステップを要約
cat ci.log | node tools/ci-log-report.mjs --json   # JSON 出力(機械処理向け)
```

失敗ステップ名・エラー行(TypeScript エラーを含む)・警告数・所要時間の長いステップを抽出します。

## Windows スクリプトの静的解析(CI)

`scripts/setup.ps1` は CI の `windows-scripts` ジョブ(windows-latest)で PowerShell 構文チェックと PSScriptAnalyzer による解析を通します。ルールは `scripts/PSScriptAnalyzerSettings.psd1` で管理しており、ローカルでも次で確認できます:

```powershell
Install-Module PSScriptAnalyzer -Scope CurrentUser
Invoke-ScriptAnalyzer -Path scripts/setup.ps1 -Settings scripts/PSScriptAnalyzerSettings.psd1
```

## 辞書テーブル(RAG 検索・文字起こしの表記統一)

`internal-app` の補正辞書は DB(`glossary_replacements` / `glossary_terms`)に永続化されます。`prisma db push`(setup 時に自動実行)でテーブルが作成され、初回起動時にアプリの初期辞書が投入されます。DB に接続できない環境ではメモリのみで動作し、管理画面に「永続化: 無効」と表示されます。

## RAG を本番構成へ（pgvector）

社内文書検索を本番運用する際は、メモリ実装から pgvector + OpenAI Embedder へ移行します。手順は [RAG_PGVECTOR_MIGRATION.md](./RAG_PGVECTOR_MIGRATION.md) を参照してください。

## 画面テーマ（スキン）

アプリの画面デザインは `@platform/theme` のスキンで切り替えられます（標準 4 種 + 独自追加可）。`internal-app` の `/admin/themes` でギャラリーを確認できます。詳細は `packages/theme/README.md`。

## リファレンスサイト（仕様の閲覧）

基盤と各アプリの仕様を、検索できる HTML で閲覧できます。

```bash
pnpm gen:site   # docs/site/index.html（基盤）＋ app-<name>.html（各アプリ）を生成
```

`docs/site/index.html` をブラウザで開くと、パッケージ・公開 API・依存グラフ・各アプリの画面/API を確認できます（外部依存なし）。
