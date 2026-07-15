# はじめての方へ — ゼロから開発・公開まで

**何も入っていない PC**（Git も Docker も無い状態）から、この基盤で開発を始めて、テストして、公開するまでの流れです。Windows / Mac 両方に対応しています。

所要時間の目安: **1〜2 時間**（ダウンロード待ちが大半）

---

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

> **Git を触ったことがない方**は [Git と GitHub の使い方](GIT_GUIDE.md) を先に読むと、この後の作業が理解しやすくなります。

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
.\scripts\setup.ps1
```

> **エラーが出る場合**: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` を実行してから、もう一度。これは「このセッションだけスクリプト実行を許可する」という意味で、PowerShell を閉じれば元に戻ります。

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

**`✅ セットアップ完了`** が出れば成功です。途中で `❌` が出たら、その行のメッセージを読んでください（[困ったときは](GETTING_STARTED_2.md#困ったときは)に対処法があります）。

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
  ✅ packages: 103 / apps: 5
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
| http://localhost:3005 | 基盤ポータル（部品カタログ） |

止めるときは、ターミナルで `Ctrl + C`。

### 1 つだけ起動したい

```bash
pnpm dev:internal    # 社内アプリだけ
pnpm dev:demos       # ショーケースだけ
```

### 送信されたメールを見る

http://localhost:8025 で Mailpit が開きます。アプリから送ったメールはここに届きます（**実際には送信されません**ので安心して試せます）。

---

## Docker を使わない場合

Docker が使えない環境では、次のいずれかで進められます。

**A. データベース無しで動かす**（一部アプリのみ）

```bash
pnpm dev:crud        # インメモリで動く（データは再起動で消える）
pnpm dev:demos       # ショーケースは DB 不要
```

**B. PostgreSQL を直接入れる**

- Windows: `winget install PostgreSQL.PostgreSQL.16`
- Mac: `brew install postgresql@16 && brew services start postgresql@16`

その後 `.env` の `DATABASE_URL` を自分の接続情報に書き換え、`bash scripts/setup.sh --skip-docker` を実行します。

---

**次**: [開発・テスト・公開の流れ →](GETTING_STARTED_2.md)
