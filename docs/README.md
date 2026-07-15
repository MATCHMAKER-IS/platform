# ドキュメントの地図

「何が知りたいか」から探せる索引です。ドキュメントは 50 以上ありますが、**あなたが今読むべきものは 1〜2 個**です。

---

## 目的から探す

### はじめて触る

| 知りたいこと | 読むもの |
|---|---|
| **環境を作りたい**（何も入っていない PC から） | [ops/GETTING_STARTED.md](ops/GETTING_STARTED.md) |
| 開発〜テスト〜公開の流れを知りたい | [ops/GETTING_STARTED_2.md](ops/GETTING_STARTED_2.md) |
| **Git / GitHub が初めて** | [ops/GIT_GUIDE.md](ops/GIT_GUIDE.md) |
| **Cursor で開発したい** | [ops/CURSOR_GUIDE.md](ops/CURSOR_GUIDE.md) |
| どんなアプリ・デモがあるか | [APPS_AND_DEMOS.md](APPS_AND_DEMOS.md) |

### 開発する

| 知りたいこと | 読むもの |
|---|---|
| **どのコマンドを打てばいいか** | [ops/COMMANDS.md](ops/COMMANDS.md) |
| **基盤にどんな部品があるか** | `pnpm dev:portal`（:3005）で検索 / [ai/module-list.md](ai/module-list.md) |
| どう書くのが正解か（定型コード） | [ai/patterns.md](ai/patterns.md) |
| 設計のルール（層・依存の向き） | [ai/architecture.md](ai/architecture.md) |
| **テスト・デバッグの方法**（負荷テスト含む） | [ops/TESTING_GUIDE.md](ops/TESTING_GUIDE.md) |
| **ブラウザで調べる**（Chrome DevTools） | [ops/DEVTOOLS_GUIDE.md](ops/DEVTOOLS_GUIDE.md) |
| **新しいアプリを作りたい** | [ops/NEW_APP.md](ops/NEW_APP.md) |
| PR の出し方・このリポジトリの約束 | [../CONTRIBUTING.md](../CONTRIBUTING.md) |

### 困った

| 症状 | 読むもの |
|---|---|
| セットアップで詰まった | [ops/GETTING_STARTED.md](ops/GETTING_STARTED.md) |
| 動くはずなのに動かない | [ops/GETTING_STARTED_2.md](ops/GETTING_STARTED_2.md)（困ったときは） |
| Git の操作が分からない | [ops/GIT_GUIDE.md](ops/GIT_GUIDE.md)（よくある困りごと） |
| CI が赤い | [ops/CI_FIRST_RUN.md](ops/CI_FIRST_RUN.md) |
| とりあえず環境を診断したい | `pnpm doctor` |

### 運用・公開

> **本番が止まったら → [ops/INCIDENT_RESPONSE.md](ops/INCIDENT_RESPONSE.md)**（まず `/admin/ops` を開く）

| 知りたいこと | 読むもの |
|---|---|
| 本番へデプロイする | [ops/DEPLOY_AWS.md](ops/DEPLOY_AWS.md) / `.github/workflows/deploy-conoha.yml` |
| CI を初めて動かす | [ops/CI_FIRST_RUN.md](ops/CI_FIRST_RUN.md) |
| Windows でセットアップ | [ops/SETUP.md](ops/SETUP.md)（Windows の節） |
| RAG を本番構成にする | [ops/RAG_PGVECTOR_MIGRATION.md](ops/RAG_PGVECTOR_MIGRATION.md) |
| 基盤の健全性を点検する | [ops/AUDIT_REVIEW.md](ops/AUDIT_REVIEW.md) |
| **障害対応**（本番が止まった） | [ops/INCIDENT_RESPONSE.md](ops/INCIDENT_RESPONSE.md) |

### 判断の背景を知る

| 知りたいこと | 読むもの |
|---|---|
| **なぜこういう作りなのか** | [adr/](adr/) — 設計判断の記録（11件） |
| なぜバージョンを上げないのか | [adr/0011-no-versioning-monorepo.md](adr/0011-no-versioning-monorepo.md) |
| なぜ基盤とアプリを分けるのか | [adr/0002-platform-app-separation.md](adr/0002-platform-app-separation.md) |
| 何を作ってきたか（全変更履歴） | [../PLATFORM_SERVICES.md](../PLATFORM_SERVICES.md) |

### AI（Claude Code / Cursor）で開発する

| 知りたいこと | 読むもの |
|---|---|
| AI に読ませる規約 | [../CLAUDE.md](../CLAUDE.md) |
| **AI から基盤を検索させる** | [ai/mcp-catalog.md](ai/mcp-catalog.md) |
| Cursor の使い方 | [ops/CURSOR_GUIDE.md](ops/CURSOR_GUIDE.md) |

---

## 手書き / 自動生成の区別

**重要**: 自動生成のドキュメントは**手で編集しないでください**（`pnpm gen:all` で上書きされます）。

| 種類 | 場所 | 更新方法 |
|---|---|---|
| **手書き** | `docs/ops/` `docs/adr/` `CLAUDE.md` `CONTRIBUTING.md` など | 人が書く。数値のズレは `check-doc-numbers` が検出 |
| **自動生成** | `docs/ai/module-list.md` `docs/ai/advisor-report.md` `docs/platform/*` `docs/site/*` | `pnpm gen:all`。手で書くと `check-generated` が落ちる |

ファイル冒頭に「自動生成」と書いてあるものは触らないでください。

---

## 新しく入った人へ

GitHub の **Issues → New issue → 「オンボーディング」** テンプレートを使ってください。
環境構築から最初の PR まで、22 項目のチェックリストで進められます。

**詰まった箇所は必ず記録してください。** あなたが詰まった場所は次の人も詰まります。それを直す PR が、最初の練習にちょうどいいお題です。

## 読む順番（新しく入った人向け）

```
1. docs/ops/GETTING_STARTED.md      環境を作る
2. docs/ops/GIT_GUIDE.md            Git が初めてなら
3. docs/ops/GETTING_STARTED_2.md    開発の流れを知る
4. docs/APPS_AND_DEMOS.md           何があるか把握する
   ↓ ここまでで開発を始められます
5. docs/ai/patterns.md              書き方に迷ったら
6. CONTRIBUTING.md                  PR を出す前に
7. docs/adr/                        「なぜ」が気になったら
```

---

## リファレンスサイト（検索できる）

```bash
pnpm site        # 生成 → docs/site/index.html をブラウザで開く
```

103 パッケージ・465 API・ER 図・ADR・各アプリの画面/API を**検索**できます。`main` に push すると GitHub Pages に自動公開されます。

---

## それでも見つからないとき

1. **リポジトリ内を検索**: VS Code / Cursor で `Ctrl+Shift+F`（`Cmd+Shift+F`）
2. **AI に聞く**: `pnpm mcp:catalog` を繋げば基盤を検索して答えます
3. **人に聞く**: 情シス担当へ。その際「どこを探したか」を伝えると早いです
