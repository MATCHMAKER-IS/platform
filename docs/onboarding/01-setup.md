# はじめての方へ — ゼロから開発・公開まで

**何も入っていない PC**（Git も Docker も無い状態）から、この基盤で開発を始めて、テストして、公開するまでの流れです。Windows / Mac 両方に対応しています。

所要時間の目安: **1〜2 時間**（ダウンロード待ちが大半）

---


> **Windows の人は最初に読んでください。**
> このリポジトリは 120 パッケージあり、pnpm が深い階層を作るため
> **Windows の 260 文字制限を超えます**。超えると `turbo` が
> **ログも出さずクラッシュ**し、原因が分かりません。
>
> **長いパスを有効化してください。**管理者権限の PowerShell で実行し、**Windows を再起動**します。
> これが根本対処です。
>
> ```powershell
> Set-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" `
>   -Name LongPathsEnabled -Value 1
> ```
>
> 有効化できない場合は、リポジトリを浅い場所（`C:\dev\platform` など）に置く方法もあります。
> ただし**移動する前に `node_modules` を消すこと**。深いパスのせいで移動自体が失敗します。
>
> `node tools/check-path-length.mjs` で現状を測れます（有効化済みなら警告は出ません）。


## このリポジトリの形（先に知っておくこと）

**ここは基盤です。** 中身は `packages/`（部品 119）・`tools/`（検査 72）・`docs/`。

**アプリは `apps/` に作りますが、このリポジトリの git では管理しません**（`.gitignore`）
——**基盤はアプリを保証できない**ためです。アプリごとに、その中で別の git を切ります。

```bash
git clone <基盤のリポジトリ> platform
cd platform
pnpm install

pnpm new-app my-app "経費の申請と承認"   # 使う機能を選べます（26 種類）
cd apps/my-app
git init                                  # ここで別の git を切る
```

**例外は 2 つ**——`apps/crud-template`（雛形）と `apps/showcase`（見本）は
基盤の git に入っています。**消さないでください**。

**検査はアプリにも効きます。** `pnpm check` の 72 種類のうち **50 がアプリを見ます**
——git で管理していなくても、手元で走らせれば検査されます。

## 全体の流れ

```
1. ツールを入れる（30分）      … Git / Node.js / pnpm / Docker / VS Code
2. リポジトリを取得（5分）      … git clone
3. セットアップ（20分）         … setup スクリプト 1 本
4. 起動して触る（5分）          … pnpm dev
5. 開発する                     … 画面を足す・API を足す
6. テスト・デバッグ             … 壊れていないか確かめる
7. 公開する                     … デプロイ
```

各ステップで**詰まったら「困ったときは」**（このページ末尾）を見てください。

---

# 1. ツールを入れる

必要なのは 5 つです。**すべて無料**です。

| ツール | 何のため | 必須? |
|---|---|---|
| **Git** | ソースコードを取得・管理する | 必須 |
| **Node.js 22** | JavaScript/TypeScript を動かす土台 | 必須 |
| **pnpm** | ライブラリを入れる道具（npm の速い版） | 必須 |
| **Docker Desktop** | データベースを PC の中で動かす | ほぼ必須※ |
| **VS Code** | コードを書くエディタ | 推奨 |

※ Docker が使えない場合の代替は「[Docker を使わない場合](#docker-を使わない場合)」を参照。

## Windows の場合

### 手順 A: winget でまとめて入れる（おすすめ・速い）

Windows 10/11 なら `winget` が標準で入っています。**PowerShell を管理者として実行**して、次を貼り付けてください。

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Docker.DockerDesktop -e
winget install --id Microsoft.VisualStudioCode -e
```

> **管理者として実行**の方法: スタートメニューで「PowerShell」を右クリック →「管理者として実行」

入れ終わったら **PowerShell を一度閉じて開き直します**（PATH を反映するため）。

### 手順 B: 手動で入れる（winget が無い場合）

| ツール | ダウンロード先 | 注意 |
|---|---|---|
| Git | https://git-scm.com/download/win | 途中の選択肢はすべて既定のままで OK |
| Node.js | https://nodejs.org/ | **LTS 版**（22.x）を選ぶ |
| Docker Desktop | https://www.docker.com/products/docker-desktop/ | インストール後、**再起動が必要** |
| VS Code | https://code.visualstudio.com/ | |

### pnpm を有効にする（Windows 共通）

Node.js を入れたら、PowerShell で:

```powershell
corepack enable
```

> `corepack` は Node.js に同梱されています。これで `pnpm` が使えるようになります。

### 確認

```powershell
git --version      # git version 2.x
node -v            # v22.x
pnpm -v            # 9.x か 10.x
docker --version   # Docker version 2x.x
```

すべてバージョンが出れば OK です。

---

## Mac の場合

### 手順 A: Homebrew でまとめて入れる（おすすめ）

まず Homebrew（Mac のソフト管理ツール）を入れます。**ターミナル**を開いて:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

> **ターミナルの開き方**: `Cmd + Space` →「ターミナル」と入力 → Enter

インストール後、画面に出る `Next steps:` の指示（`echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ...` のような行）を**必ず実行**してください。これをしないと `brew` コマンドが見つかりません。

続けて:

```bash
brew install git node@22
brew install --cask docker visual-studio-code
corepack enable
```

### 手順 B: 手動で入れる

| ツール | ダウンロード先 |
|---|---|
| Git | Mac には最初から入っています（`git --version` で確認） |
| Node.js | https://nodejs.org/ （LTS 版） |
| Docker Desktop | https://www.docker.com/products/docker-desktop/ （**Apple Silicon / Intel を選び間違えない**） |
| VS Code | https://code.visualstudio.com/ |

### 確認

```bash
git --version
node -v            # v22.x
pnpm -v
docker --version
```

---

## Docker Desktop を起動しておく

インストールしただけでは動きません。**アプリを起動**してください。

- Windows: スタートメニュー →「Docker Desktop」
- Mac: アプリケーション →「Docker」

初回は利用規約への同意と、数分の初期化があります。

### 起動できたかの見分け方

```
┌─────────────────────────────────────────┐
│  Docker Desktop                          │
│                                          │
│   🐳  Engine running        ← これが出れば OK │
│                                          │
│  （Starting... のままなら、まだ待つ）        │
└─────────────────────────────────────────┘
```

画面の**左下**（Mac は上部メニューバーのクジラアイコン）に状態が出ます。

| 表示 | 意味 |
|---|---|
| **Engine running**（緑） | 使える状態 ✅ |
| **Starting...**（黄） | 初期化中。1〜3 分待つ |
| **Stopped** / アイコンが灰色 | 起動していない。クリックして起動 |

コマンドでも確認できます。

```bash
docker ps
```

- **表の見出し（CONTAINER ID …）が出る** → OK
- **`Cannot connect to the Docker daemon`** → まだ起動していない

> 会社の PC で Docker Desktop のライセンスが問題になる場合は、情シス担当（あなた）の判断で [Rancher Desktop](https://rancherdesktop.io/) や [Podman](https://podman.io/) も選べます。その場合も `docker` コマンド互換で動きます。

---

# 2. リポジトリを取得する

コードを置きたいフォルダで、ターミナル（Mac）または PowerShell（Windows）を開きます。

```bash
# 例: ホーム直下に dev フォルダを作ってその中へ
mkdir dev
cd dev

git clone <このリポジトリのURL> platform
cd platform
```

> `<このリポジトリのURL>` は GitHub のページの緑色の「Code」ボタンからコピーできます。

> **Git を触ったことがない方**は [Git と GitHub の使い方](../ops/GIT_GUIDE.md) を先に読むと、この後の作業が理解しやすくなります。

### Git の初期設定（初回だけ）

まだ設定していなければ:

```bash
git config --global user.name "山田 太郎"
git config --global user.email "yamada@example.com"
```

---

# 3. セットアップする

**コマンド 1 本**で終わります。

## Windows

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
```

> **`-ExecutionPolicy Bypass` は最初から付けてください。** 既定の Windows では
> 署名の無いスクリプトを実行できず、`.\scripts\setup.ps1` とだけ打つと
> 「デジタル署名されていません」で止まります。この指定は**そのコマンドの間だけ**
> 有効で、システム設定は変わりません。
>
> **`bash scripts/setup.sh` は使わないでください。** Windows では WSL が呼ばれます。
> WSL を入れていない、あるいは壊れている場合、`Failed to mount C:\` のような
> 見当違いのエラーが出て原因が分かりません。`.ps1` を使えば WSL は不要です。

## Mac

```bash
bash scripts/setup.sh
```

## 何が起きるか

1. 前提ツール（Node/pnpm/Docker）の確認
2. `.env` ファイルの作成（`.env.example` からコピー）
3. Docker で **PostgreSQL**（データベース）と **Mailpit**（メール確認ツール）を起動
4. ライブラリのインストール（`pnpm install`）— **ここが一番時間がかかります**（5〜15分）
5. データベースのテーブル作成
6. 動作確認（スモークテスト 1000 項目以上）

### 成功したときの画面

```
▶ 前提条件の確認
  ✅ Node.js v22.x
  ✅ pnpm 10.x
  ✅ Docker
▶ .env を準備
  ✅ apps/internal-app/.env を作成
▶ Docker(PostgreSQL + Mailpit)を起動
  ✅ 起動しました
▶ pnpm install
  ...（数分かかります）
▶ スモーク検証
  結果: 1051 passed, 0 failed

✅ セットアップ完了
```

**`✅ セットアップ完了`** が出れば成功です。途中で `❌` が出たら、その行のメッセージを読んでください（[困ったときは](../onboarding/03-development.md#困ったときは)に対処法があります）。

## うまくいったか確認

```bash
pnpm doctor
```

```
🩺 開発環境の診断

[ランタイム]
  ✅ Node.js v22.x
  ✅ pnpm 10.x
[任意ツール]
  ✅ docker
  ✅ git
[ワークスペース]
  ✅ packages: 119 / apps: 5
  ✅ node_modules あり（install 済み）
[.env]
  ✅ internal-app/.env あり
[生成物]
  ✅ 生成物は最新（drift なし）

─────────────
✅ すべて良好です。
```

`✅ 必須項目は OK` または `✅ すべて良好です` と出れば準備完了です。

---

# 4. 起動して触ってみる

```bash
pnpm dev
```

全アプリが**一斉に起動**します。ブラウザで開いてみてください。

| URL | 何のアプリ |
|---|---|
| http://localhost:3000 | **社内アプリ**（メイン。勤怠・経費・会計など） |
| http://localhost:3001 | 基盤ショーケース（部品の見本市） |
| http://localhost:3002 | CRUD テンプレート（新規アプリの雛形） |
| http://localhost:3003 | 備品管理 |
| http://localhost:3004 | 公開サイト |
| http://localhost :3001 | 基盤ポータル（部品カタログ） |

止めるときは、ターミナルで `Ctrl + C`。

### 1 つだけ起動したい

```bash
pnpm dev:internal    # 社内アプリだけ
pnpm dev:showcase       # ショーケースだけ
```

### 送信されたメールを見る

http://localhost:8025 で Mailpit が開きます。アプリから送ったメールはここに届きます（**実際には送信されません**ので安心して試せます）。

---

## Docker を使わない場合

Docker が使えない環境では、次のいずれかで進められます。

**A. データベース無しで動かす**（一部アプリのみ）

```bash
pnpm dev:crud        # インメモリで動く（データは再起動で消える）
pnpm dev:showcase       # ショーケースは DB 不要
```

**B. PostgreSQL を直接入れる**

- Windows: `winget install PostgreSQL.PostgreSQL.16`
- Mac: `brew install postgresql@16 && brew services start postgresql@16`

その後 `.env` の `DATABASE_URL` を自分の接続情報に書き換え、`bash scripts/setup.sh --skip-docker` を実行します。

---

**次**: [開発・テスト・公開の流れ →](../onboarding/03-development.md)

---

# 詳しい手順・つまずいたとき

**ここから下は `../onboarding/01-setup.md` を統合したものです（2026-08）。**
上の手順で動けば読む必要はありません。

> **はじめての方は [ゼロから開発・公開まで](../onboarding/01-setup.md) へ。**
> ツールの入れ方から順に説明しています（Windows/Mac 対応）。
>
> **このページは経験者向けのリファレンス**です。「Node も Docker も入っている。要点だけ知りたい」人向けに、
> setup スクリプトの中身・Prisma の運用・devcontainer など**手順の裏側**をまとめています。

| 知りたいこと | 見るページ |
|---|---|
| ツールの入れ方から知りたい | [../onboarding/01-setup.md](../onboarding/01-setup.md) |
| 詰まったときの対処 | [../onboarding/03-development.md](../onboarding/03-development.md#困ったときは) |
| コマンドの一覧 | [COMMANDS.md](../ops/COMMANDS.md) |
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
| 3 | インフラ起動 | `pnpm db:up`(既存 docker-compose.yml を利用)+ 起動待ち |
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
| 3001 | @apps/showcase | `pnpm dev:showcase`(E2E の対象) |
| 3002 | crud-template | `pnpm dev:crud`(新アプリのコピー元) |
| 3004 | public-site | `pnpm dev:site` |
| 3005 | platform-portal | `pnpm dev:showcase`(基盤カタログ) |
| 5432 | PostgreSQL 17 | user/pass/db: app / app / app(compose) |
| 1025 / 8025 | Mailpit | SMTP / **Web UI**。アプリが送るメールは http://localhost:8025 で確認 |
| 7700 / 6379 | Meilisearch / Redis | 任意(`docker compose up -d` で全部起動)。既定の検索はメモリBM25なので無くても動く |

`pnpm dev` で **全アプリを一斉起動**できます(ポートは各 package.json で固定済み)。重複は `node tools/check-ports.mjs` が検出します。

**DB をアプリ別に分ける理由**: スキーマ(60 / 1 / 2 モデル)を独立して push/migrate でき、`prisma db push` の差分計算が他アプリの表に影響しないため。接続先は各 `.env` の `DATABASE_URL`。

## .env の考え方

- 実体の `.env` は **git 管理外**(.gitignore 済)。ひな形は各 `apps/<app>/.env.example`。
- コードが参照する変数と `.env.example` の整合は `node tools/check-env-example.mjs` が検査(CI 組込済)。**環境変数を増やしたら .env.example にも追記**してください。
- crud-template は既定 **インメモリ**(DB なしで即動作)。`PERSISTENCE=prisma` + `DATABASE_URL` で PostgreSQL に切替。internal-app は `DATABASE_URL` 必須(ストア自体の切替は `CHAT_PERSISTENCE=prisma`)。

## Prisma の運用

```bash
# クライアント生成(install 後・schema 変更後)
PRISMA_SCHEMA=../../apps/internal-app/prisma/schema.prisma pnpm --filter @platform/db exec prisma generate

# 開発中の即時反映(履歴なし)— setup.sh はこちら
DATABASE_URL=postgresql://app:app@localhost:5432/app \
  PRISMA_SCHEMA=../../apps/internal-app/prisma/schema.prisma pnpm --filter @platform/db exec prisma db push

# 本番稼働を始める前にマイグレーションへ移行する(理由と手順: docs/adr/0013)
PRISMA_SCHEMA=../../apps/internal-app/prisma/schema.prisma DATABASE_URL=... pnpm --filter @platform/db exec prisma migrate dev --name init
```

prisma CLI は `@platform/db`(^7.2.0)に集約しています。初回 generate はエンジンのダウンロードが走るためネットワークが必要です。

## つまずき（このページ固有のもの）

一般的な対処は **[../onboarding/03-development.md の「困ったときは」](../onboarding/03-development.md#困ったときは)** にまとめています。ここでは setup / Prisma / devcontainer 固有のものだけ。

| 症状 | 対処 |
|---|---|
| ポート 5432 が使用中 | ローカル PostgreSQL を停止するか、compose 側のポートを変更 |
| `prisma generate` が engines DL で失敗 | プロキシ/オフライン環境。ネットワーク到達性を確認（`binaries.prisma.sh` への到達が必要） |
| `.env` を変えたのに反映されない | `pnpm dev:*` を再起動（Next は起動時読込。`server/env.ts` も起動時に一度だけ評価） |
| internal-app が起動時に env エラー | `.env` の必須3つ(DATABASE_URL / MAIL_FROM / SESSION_SECRET)を確認 |
| devcontainer で DB に繋がらない | ホスト名は `db`(localhost 不可)。post-create が .env を置換済みか確認 |
| 本番で「秘密値の強度が不十分」で起動しない | 仕様です。開発用の既定値のままでは本番起動できません → [公開する](../onboarding/03-development.md#7-公開するデプロイ) |

## 手動セットアップ(スクリプトを使わない場合)

```bash
corepack enable
cp apps/internal-app/.env.example apps/internal-app/.env   # 他3アプリも同様
pnpm db:up
docker compose exec -T db psql -U app -d postgres -c "CREATE DATABASE app_crud"
docker compose exec -T db psql -U app -d postgres -c "CREATE DATABASE app_equipment"
pnpm install
# generate / db push は上記「Prisma の運用」の3スキーマ分
pnpm smoke
```

## devcontainer / GitHub Codespaces で開く

ホストに Node / pnpm を入れずに、**Docker だけで同一環境**を立ち上げる選択肢(VS Code「Reopen in Container」/ Codespaces)。

- 構成: `.devcontainer/` — ベースの docker-compose.yml に workspace(Node 22)を重ね、db / mailpit を同時起動
- 初期化は全自動: post-create が `.env` を作成(ホスト名を **db / mailpit** に自動置換)→ pnpm install → prisma generate / db push → smoke
- ポート 3000〜3004 / 8025 は自動フォワード。既存 DB ボリュームでも `tools/create-app-dbs.mjs` が不足 DB を冪等作成
- 注意: コンテナ内の接続先は `@db:5432` / `SMTP_HOST=mailpit`(localhost ではない)

## よく使うショートカット

| コマンド | 内容 |
|---|---|
| `pnpm verify:offline` | オフライン検証 8 ゲート一括(preflight・約10秒。CI boundaries と同一) |
| `pnpm db:up` / `pnpm db:down` / `pnpm db:psql` | DB+Mailpit の起動 / 停止 / psql 接続 |
| `pnpm db generate\|push\|validate [app\|all]` | Prisma 操作(--schema と DATABASE_URL を自動解決) |
| `pnpm db migrate <app> -- --name xxx` | 履歴つきマイグレーション |
| `pnpm db push all --dry-run` | 実行せずコマンド確認(db 系は全対応) |
| `pnpm dev:crud` / `dev:equipment` / `dev:internal` / `dev:site` / `dev:showcase` | 各アプリ起動(ポートは上表) |
| `pnpm mcp` | MCP サーバ起動(Claude Desktop / Code 連携) |

## 次に読むもの

- **[ドキュメントの地図](../README.md)** — 目的から探せます
- 新アプリの作り方: [NEW_APP.md](../ops/NEW_APP.md)（手順とチェックリスト）
- 開発の流れ: [../onboarding/03-development.md](../onboarding/03-development.md)
- 実装の書き方: [../ai/patterns.md](../ai/patterns.md)
- CI を回す: [GITHUB_ACTIONS.md](../ops/GITHUB_ACTIONS.md)

## Windows でのセットアップ（スクリプトの仕様）

> ツールの入れ方（winget での一括インストール等）は [../onboarding/01-setup.md](../onboarding/01-setup.md#windows-の場合) にあります。
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
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1 -Check
# フルセットアップ
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
# Docker を使わない場合
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1 -SkipDocker
```

> **`-ExecutionPolicy Bypass` を毎回付けています。** 既定の Windows では
> 署名の無いスクリプトが実行できず、`.\scripts\setup.ps1` と打つと
> 「デジタル署名されていません」で止まるためです。この指定は**そのコマンドの間だけ**
> 有効で、システム設定は変えません。毎回打つのが面倒なら
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` を一度実行しておきます。
>
> **PowerShell 7(`pwsh`)は不要です。** 標準の Windows PowerShell 5.1 で動きます。

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

社内文書検索を本番運用する際は、メモリ実装から pgvector + OpenAI Embedder へ移行します。手順は [RAG_PGVECTOR_MIGRATION.md](../ops/RAG_PGVECTOR_MIGRATION.md) を参照してください。

## 画面テーマ（スキン）

アプリの画面デザインは `@platform/theme` のスキンで切り替えられます（標準 4 種 + 独自追加可）。`internal-app` の `/admin/themes` でギャラリーを確認できます。詳細は `packages/theme/README.md`。

## リファレンスサイト（仕様の閲覧）

基盤と各アプリの仕様を、検索できる HTML で閲覧できます。

```bash
pnpm gen:site   # docs/site/index.html（基盤）＋ app-<name>.html（各アプリ）を生成
```

`docs/site/index.html` をブラウザで開くと、パッケージ・公開 API・依存グラフ・各アプリの画面/API を確認できます（外部依存なし）。

