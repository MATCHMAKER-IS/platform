# はじめての方へ（後編） — 開発・テスト・公開

[前編（環境構築）](GETTING_STARTED.md) の続きです。

---

# 5. 開発する

## まず知っておくこと: 基盤とアプリの分離

このリポジトリは 2 層に分かれています。**この区別が最も重要**です。

```
packages/  … 基盤（103個の部品）。CSV 出力、メール送信、PDF 生成、権限判定など
             → 「どの会社でも使える汎用の道具」。業務の判断は入れない

apps/      … アプリ（5個）。社内アプリ、公開サイトなど
             → 「うちの会社の業務」。基盤の部品を組み合わせて作る
```

**新しい機能を作るとき、まず基盤に部品があるか探します。** 無ければ基盤に部品を作り、アプリから使います。これがブラックボックス化・属人化を防ぐ肝です。

### 部品を探す

```bash
pnpm dev:portal      # http://localhost:3005 で 103 部品を検索
```

または AI（Claude Code など）を使っているなら:

```bash
pnpm mcp:catalog     # AI から search_platform("csv 出力") で探せる
```

詳細: [基盤カタログ MCP](../ai/mcp-catalog.md)

### 使い方を知る

各部品の `packages/<名前>/README.md` に使い方があります。実際の組み合わせ例は `demos/` にあります。

---

> **Cursor（AI エディタ）で開発する場合**は [CURSOR_GUIDE.md](CURSOR_GUIDE.md) を参照。
> MCP を繋ぐと AI が基盤を検索できるようになり、生成コードの質が変わります。

## 開発の始め方（3 パターン）

### パターン A: 既存アプリに画面を足す（いちばん多い）

社内アプリ（`apps/internal-app`）に画面を追加する例:

```
apps/internal-app/src/app/my-page/page.tsx       ← 画面
apps/internal-app/src/app/api/my-data/route.ts   ← API
```

Next.js の App Router なので、**フォルダを作れば URL になります**（`my-page/page.tsx` → `/my-page`）。

既存の画面をコピーして中身を変えるのが確実です。似た画面を `apps/internal-app/src/app/` から探してください。

### パターン B: 新しいアプリを作る

[新しいアプリを追加する手順](NEW_APP.md) を参照。`crud-template` をコピーするのが最短です。

### パターン C: 基盤に部品を足す

```bash
pnpm scaffold shipping "配送(送り状・追跡)"
```

規約に沿った雛形（package.json / tsconfig / README / テスト）が生成されます。**手で作らないでください**（設定漏れの原因になります）。

作った後は:

```bash
pnpm platform:check    # アプリへの影響を確認
pnpm platform:sync     # 生成物（部品カタログ等）を更新
```

---

## コードを書くときの約束

詳細は `CLAUDE.md` と [docs/ai/architecture.md](../ai/architecture.md) にありますが、最低限これだけ:

| 約束 | 理由 |
|---|---|
| **色は CSS 変数で書く**（`var(--color-primary)`） | テーマ切り替えに追従させるため |
| **`process.env` を直接読まない**（`server/env.ts` に集約） | 設定漏れに気づけるようにするため |
| **基盤（packages/）にアプリの業務知識を入れない** | 他のアプリでも使えるようにするため |
| **既存の部品を探してから作る** | 同じものが 2 つあると保守が倍になるため |

---

# 6. テストとデバッグ

> **詳しくは [テストとデバッグ](TESTING_GUIDE.md)** — 6 種類のテストの使い分け、負荷テスト、症状別の対処表。
> ここでは要点だけ。

## いちばん大事なコマンド

```bash
pnpm check
```

これ 1 本で「**型チェック + Lint + スモークテスト**」が走ります。**コミット前に必ず実行**してください。

## テストの種類

| コマンド | 何を確かめるか | 速さ |
|---|---|---|
| `pnpm smoke` | ロジック 1000 項目以上（DB 不要） | 速い（10秒） |
| `pnpm typecheck` | 型が合っているか | 普通 |
| `pnpm lint` | コードの書き方 | 普通 |
| `pnpm test` | ユニットテスト（vitest） | 普通 |
| `pnpm e2e` | ブラウザで実際に操作（Playwright） | 遅い |
| `pnpm verify:offline` | 上記＋依存関係・生成物の整合性 | 遅い |

**迷ったら `pnpm check`**、リリース前は `pnpm verify:offline` です。

## デバッグの仕方

### 画面が真っ白・エラーが出る

1. **ブラウザの開発者ツールを開く**（`F12` または `Cmd+Option+I`）
2. **Console タブ**に赤いエラーが出ていないか見る
3. **Network タブ**で API が失敗（赤い行）していないか見る

### API が動かない

ターミナル（`pnpm dev` を実行した画面）にサーバ側のエラーが出ます。まずそこを見てください。

### 「設定が原因かも」と思ったら

```
http://localhost:3000/admin/env
```

**今どの環境変数で動いているか**が見られます（秘密の値は伏せられます）。「API キーが未設定だった」といった原因がすぐ分かります。

### データベースの中身を見たい

```
http://localhost:3000/admin/db-viewer
```

ブラウザからテーブルの中身を確認できます。SQL を書きたい場合は:

```bash
pnpm db:psql
```

### メールが届かない

http://localhost:8025 （Mailpit）を確認。開発中のメールは**実際には送信されず**ここに溜まります。

### VS Code でブレークポイントを使う

1. 行番号の左をクリックして赤い点（ブレークポイント）を置く
2. `F5` を押す → 「Node.js」を選ぶ
3. 画面を操作すると、その行で止まる

### 環境そのものが怪しいとき

```bash
pnpm doctor      # Node/pnpm/Docker/.env/生成物の状態を診断
```

それでも直らなければ、作り直すのが早いです:

```bash
pnpm fresh       # node_modules を消して入れ直す
pnpm db:reset    # データベースを作り直す（データは消えます）
```

---

# 7. 公開する（デプロイ）

## 事前に必ずやること

### 1. 秘密の値を本番用に変える

開発では `dev-session-secret-change-me` のような**仮の値**で動いています。本番でこのままだと**起動しません**（安全のため、わざと止めています）。

強いパスワードを作ります:

```bash
# Mac / Linux
openssl rand -base64 32

# Windows (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Max 256 }))
```

これを本番サーバの環境変数 `SESSION_SECRET` に設定します。

> **なぜ止まるのか**: 「開発用の値のまま本番公開」は実際によくある事故です。この基盤は起動時に検出して止めます（`assertSecretStrength`）。

### 2. 必要な環境変数を確認

```bash
cat apps/internal-app/.env.example
```

`# --- 必須 ---` の項目は本番でも必ず設定してください。特に:

| 変数 | 内容 |
|---|---|
| `DATABASE_URL` | 本番データベースの接続先 |
| `SESSION_SECRET` | セッションの署名鍵（上で作った強い値） |
| `MAIL_FROM` | 送信元メールアドレス |
| `NODE_ENV` | `production` にする |

### 3. 動作確認

```bash
pnpm verify:offline    # 全部緑になることを確認
pnpm build             # 本番用にビルドできることを確認
```

> **公開したあと本番が止まったら**: [障害対応の手順](INCIDENT_RESPONSE.md)（まず `/admin/ops` を開く）

## デプロイ先の選択肢

| 方法 | 向いている場合 | ガイド |
|---|---|---|
| **ConoHa VPS** | 社内で完結させたい・費用を抑えたい | `.github/workflows/deploy-conoha.yml` |
| **AWS** | 規模が大きい・可用性が要る | [DEPLOY_AWS.md](DEPLOY_AWS.md) |
| **Vercel** | 手軽に試したい（公開サイトのみ） | Next.js の標準的な手順 |

デプロイは GitHub Actions で自動化されています。`main` ブランチに push すると走ります。

## 初回だけ必要な設定

1. **GitHub Secrets の登録** — サーバの接続情報や本番の環境変数を GitHub に登録します
   （リポジトリ → Settings → Secrets and variables → Actions）
2. **データベースの用意** — 本番用の PostgreSQL を立てて `DATABASE_URL` を設定
3. **マイグレーション** — 初回は `pnpm --filter internal-app exec prisma migrate deploy`

詳細は [CI_FIRST_RUN.md](CI_FIRST_RUN.md) を参照してください。

---

# 困ったときは

## セットアップで詰まった

| 症状 | 対処 |
|---|---|
| `pnpm: command not found` | `corepack enable` を実行 → **ターミナルを開き直す**（PATH の反映に必要） |
| `docker: command not found` | Docker Desktop を**起動**する（インストールだけでは動かない） |
| `Cannot connect to the Docker daemon` | Docker Desktop が起動しているか確認（クジラのアイコンが Running） |
| PowerShell でスクリプトが実行できない | `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` |
| `pnpm install` が終わらない | ネットワークが遅いだけのことが多い。10〜15 分は待つ |
| ポートが使われている | 他のアプリが 3000 番などを使用中。そのアプリを止めるか、`node tools/check-ports.mjs` で状況確認 |
| `node -v` が v22 未満 | 古い Node.js が残っている。新しい方を入れ直すか、[Volta](https://volta.sh/) 等でバージョンを固定 |
| Mac で `brew: command not found` | Homebrew インストール後の `Next steps:` の指示（PATH 設定）を実行し忘れている |
| Windows で改行コードの警告が大量に出る | `git config --global core.autocrlf input` を設定してから clone し直す |
| 会社のプロキシで `pnpm install` が失敗 | `pnpm config set proxy http://プロキシ:ポート` と `https-proxy` を設定 |

## 開発中に詰まった

| 症状 | 対処 |
|---|---|
| 変更が画面に反映されない | ブラウザを強制リロード（`Ctrl+Shift+R` / `Cmd+Shift+R`）。それでもダメなら `pnpm dev` を再起動 |
| 型エラーが大量に出る | `pnpm fresh`（入れ直し）を試す |
| DB のテーブルが無いと言われる | `pnpm db:up` で DB が起動しているか確認 → `pnpm --filter internal-app exec prisma db push` |
| `pnpm dev` で一部のアプリだけ起動しない | ポート競合。`node tools/check-ports.mjs` で確認（重複していれば教えてくれます） |
| 新しく作ったパッケージが型チェックされない | `tsconfig.json` や scripts の書き忘れ。`node tools/check-package-shape.mjs` が検出します |
| `pnpm test` が「テストが見つからない」で失敗 | そのパッケージにテストが無いのに `vitest run` になっている。`--passWithNoTests` を付ける |
| CI だけ失敗する（手元では通る） | `pnpm verify:offline` を実行。生成物の更新漏れ（`pnpm gen:all`）が多い |
| 基盤を変えたらアプリが壊れた | `pnpm platform:check` で「削除した API を誰が使っているか」を確認 |
| よく分からないエラー | `pnpm doctor` で環境を診断 |

## 「動くはずなのに動かない」ときの順番

1. **`pnpm doctor`** — 環境そのものが壊れていないか
2. **ターミナルのログ** — `pnpm dev` を実行した画面にサーバ側のエラーが出ています
3. **ブラウザの Console**（F12） — 画面側のエラー
4. **`/admin/env`** — 設定（API キー等）が入っているか
5. **`pnpm check`** — 型・Lint・テストのどれかで引っかかっていないか
6. それでもダメなら **`pnpm fresh`**（入れ直し）

## 誰に聞けばいいか

1. **まずドキュメント**: [docs/README.md](../README.md) が地図です（目的から探せます）
   - [コマンド早見表](COMMANDS.md) — 何ができるか
   - [アプリとデモの紹介](../APPS_AND_DEMOS.md) — 何があるか
   - [設計の考え方](../ai/architecture.md) — なぜそうなっているか
   - [実装パターン集](../ai/patterns.md) — どう書くか
2. **AI に聞く**: `pnpm mcp:catalog` を繋げば、AI が基盤を検索して答えられます
3. **人に聞く**: それでも分からなければ情シス担当へ

---

# 補足: このリポジトリの考え方

初めて触る方に、なぜこういう作りなのかを 3 つだけ。

### 1. 「基盤」と「アプリ」を分けている理由

社内システムは往々にして「作った人しか分からない」状態になります。汎用的な部品（CSV 出力、メール送信…）を `packages/` に切り出しておけば、**次のアプリでも使え、直す場所も 1 か所**で済みます。

### 2. 検査ツールが多い理由

`pnpm check` を打つだけで型・Lint・1000 項目のテストが走り、`preflight` では依存関係の循環・ポートの重複・設定の漏れまで機械が検出します。

**人のレビューは見落とします。機械は見落としません。** 属人化を防ぐために、判断をなるべく機械に任せています。

### 3. ドキュメントが自動生成される理由

部品カタログ・API 一覧・ER 図・依存グラフは `pnpm gen:all` で自動生成されます。手書きだと必ず古くなるからです。手書きの資料（このページなど）も、数値のズレは `check-doc-numbers` が検出します。

---

**準備ができたら**: [コマンド早見表](COMMANDS.md) を手元に置いて、まず `pnpm dev` で触ってみてください。
