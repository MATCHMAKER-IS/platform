# ドキュメントの地図

「何が知りたいか」から探せる索引です。ドキュメントは 50 以上ありますが、**あなたが今読むべきものは 1〜2 個**です。

---

## 新しい資料を作ったとき

**下の索引に必ず足してください** ← **忘れると `check-docs-orphans` が落ちます**。

**なぜ**: **索引から辿れない資料は、書いていないのと同じ**です——
**43 件もあると、探せないものは無いのと同じ**になります。

**足す場所は「何をしたいか」で選んでください**——
**資料の名前ではなく、読む人の目的**で並べています。

## 気づいたことを、どこに書くか

**書く場所を間違えると、次の人が見つけられません。**
**書いていないのと同じ**になります。

| 気づいたこと | 書く場所 |
|---|---|
| `packages/` の関数の落とし穴 | **その `README.md` の「使う前に知っておくこと」** |
| 基盤の判断・失敗した理由 | `docs/ops/HANDOVER.md` |
| 「そう決めた」理由（後で覆したくなるもの） | `docs/adr/`（新しい ADR を書く） |
| 各アプリの画面・業務ルール | `apps/<名前>/HANDOVER.md` |
| 各アプリの出し先・試験の状況 | `apps/<名前>/README.md`（このアプリの運用） |
| 基盤に無くて自分で書いたもの | **`tools/suggest.mjs` の対応表**にも足す |

### 迷ったときの決め方

**他のアプリでも起きるなら基盤側、そのアプリでしか起きないならアプリ側**です。

**迷ったら基盤側に書いてください。** アプリ側に書いたものは、
**別のアプリを作る人が読みません**——**同じ失敗を繰り返します**。

### 何を書くか

**「何をするか」より「何を間違えやすいか」**を書いてください。

**前者は名前から分かりますが、後者は踏むまで分かりません。**

| 書く | 書かない |
|---|---|
| **無いと何が起きるか** | 「便利です」 |
| **具体的な症状**（「深夜の打刻が前日になる」） | 「注意してください」だけ |
| **判断の基準**（迷ったらどうするか） | 実装の詳細 |


## 目的から探す

### はじめて触る

| 知りたいこと | 読むもの |
|---|---|
| **引き継ぐ人へ**（いまどこまでできているか・何が残っているか） | [ops/HANDOVER.md](ops/HANDOVER.md) |
| **外部レビューの指摘と、その判定**（既にあるもの / 本当に足りないもの / 意図的にやらないもの） | [ops/EXTERNAL_REVIEW_2026-08.md](ops/EXTERNAL_REVIEW_2026-08.md) |
| **アプリを別リポジトリへ切り出す**（ADR-0026 の段階 3。1 本ずつ試す手順） | [ops/APP_EXTRACTION.md](ops/APP_EXTRACTION.md) |
| **はじめて触る**（今日、動くところまで） | [ops/../onboarding/02-first-hour.md](ops/../onboarding/02-first-hour.md) |
| **環境を作りたい**（何も入っていない PC から） | [ops/../onboarding/01-setup.md](ops/../onboarding/01-setup.md) |
| 開発〜テスト〜公開の流れを知りたい | [ops/../onboarding/03-development.md](ops/../onboarding/03-development.md) |
| **Git / GitHub が初めて** | [ops/GIT_GUIDE.md](ops/GIT_GUIDE.md) |
| **Cursor で開発したい** | [ops/CURSOR_GUIDE.md](ops/CURSOR_GUIDE.md) |
| どんなアプリ・デモがあるか | [APPS_AND_DEMOS.md](APPS_AND_DEMOS.md) |

### 開発する

| 知りたいこと | 読むもの |
|---|---|
| **どのコマンドを打てばいいか** | [ops/COMMANDS.md](ops/COMMANDS.md) |
| **CI（push すると自動で走るもの）** | [ops/GITHUB_ACTIONS.md](ops/GITHUB_ACTIONS.md) |
| **基盤にどんな部品があるか** | `pnpm dev:showcase`（:3001 の「基盤ポータル」）で検索 / [ai/module-list.md](ai/module-list.md) |
| どう書くのが正解か（定型コード） | [ai/patterns.md](ai/patterns.md) |
| 設計のルール（層・依存の向き） | [ai/architecture.md](ai/architecture.md) |
| **テスト・デバッグの方法**（負荷テスト含む） | [ops/TESTING_GUIDE.md](ops/TESTING_GUIDE.md) |
| **どの検査が何を見ているか知りたい** | [ops/TESTING_GUIDE.md](ops/TESTING_GUIDE.md)（最初の節） |
| 100 人規模に向けて負荷を測りたい | [ops/LOAD_TESTING.md](ops/LOAD_TESTING.md) |
| 「遅い」と言われたので切り分けたい | [ops/SLOW_TRIAGE.md](ops/SLOW_TRIAGE.md) |
| 動いているデータを止めずに直したい | [ops/DATA_MIGRATION.md](ops/DATA_MIGRATION.md) |
| **ブラウザで調べる**（Chrome DevTools） | [ops/DEVTOOLS_GUIDE.md](ops/DEVTOOLS_GUIDE.md) |
| **新しいアプリを作りたい** | [ops/NEW_APP.md](ops/NEW_APP.md) |
| PR の出し方・このリポジトリの約束 | [../CONTRIBUTING.md](../CONTRIBUTING.md) |
| **開発の全体像**（設計から公開まで） | [DEVELOPMENT.md](DEVELOPMENT.md) |
| **検査は何を見ているか**（preflight の 21 個） | [ops/CHECKS.md](ops/CHECKS.md) |
| **デモを 1 本足す**（5 か所の更新） | [ops/NEW_APP.md](ops/NEW_APP.md) |
| **利用者からの問い合わせに答える**（ログインできない・権限がない等） | [ops/SUPPORT_GUIDE.md](ops/SUPPORT_GUIDE.md) |
| 新しい画面・機能の雛形を作る | [ops/PACKAGE_CONSOLIDATION.md](ops/PACKAGE_CONSOLIDATION.md) |
| Prisma の書き方の実例 | [DATABASE.md](DATABASE.md) |
| 生タグを @platform/ui へ置き換える | [ops/UI_MIGRATION.md](ops/UI_MIGRATION.md) |
| チャット機能を組み込む | [platform/CHAT.md](platform/CHAT.md) |

### 困った

| 症状 | 読むもの |
|---|---|
| セットアップで詰まった | [ops/../onboarding/01-setup.md](ops/../onboarding/01-setup.md) |
| 動くはずなのに動かない | [ops/../onboarding/03-development.md](ops/../onboarding/03-development.md)（困ったときは） |
| Git の操作が分からない | [ops/GIT_GUIDE.md](ops/GIT_GUIDE.md)（よくある困りごと） |
| CI が赤い | [ops/GITHUB_ACTIONS.md](ops/GITHUB_ACTIONS.md) |
| とりあえず環境を診断したい | `pnpm doctor` |

### 運用・公開

> **本番が止まったら → [ops/INCIDENT_RESPONSE.md](ops/INCIDENT_RESPONSE.md)**（まず `/admin/ops` を開く）

| 知りたいこと | 読むもの |
|---|---|
| 本番へデプロイする | [ops/DEPLOY_AWS.md](ops/DEPLOY_AWS.md) / `.github/workflows/deploy-conoha.yml` |
| CI を初めて動かす | [ops/GITHUB_ACTIONS.md](ops/GITHUB_ACTIONS.md) |
| **定期実行(cron)する API を確認する** | [ops/CRON_JOBS.md](ops/CRON_JOBS.md) |
| Windows でセットアップ | [ops/../onboarding/01-setup.md](ops/../onboarding/01-setup.md)（Windows の節） |
| RAG を本番構成にする | [ops/RAG_PGVECTOR_MIGRATION.md](ops/RAG_PGVECTOR_MIGRATION.md) |
| 基盤の健全性を点検する | [ops/AUDIT_REVIEW.md](ops/AUDIT_REVIEW.md) |
| **障害対応**（本番が止まった） | [ops/INCIDENT_RESPONSE.md](ops/INCIDENT_RESPONSE.md) |
| **環境の使い分け**（dev / staging / 本番。`NODE_ENV` と `APP_ENV` の違い） | [ops/ENVIRONMENTS.md](ops/ENVIRONMENTS.md) |
| **秘密の入れ替え**（鍵が漏れた・担当者が退職した） | [ops/SECRET_ROTATION.md](ops/SECRET_ROTATION.md) |
| **メールが届かない**（SPF / DKIM / DMARC・バウンス） | [ops/MAIL_DELIVERABILITY.md](ops/MAIL_DELIVERABILITY.md) |
| **2026-08 の変更を適用する**（順序を守らないと壊れます。適用後は削除） | [ops/APPLY_2026-08.md](ops/APPLY_2026-08.md) |
| **バックアップと復元**（RPO/RTO・訓練） | [ops/BACKUP_RESTORE.md](ops/BACKUP_RESTORE.md) |
| **社内限定にする**（ログイン・権限・接続元） | [ops/ACCESS_CONTROL.md](ops/ACCESS_CONTROL.md) |
| 外部SaaSの API 変更を検知する | [ops/TESTING_GUIDE.md](ops/TESTING_GUIDE.md) |
| デプロイ構成の全体像 | [ops/DEPLOY_AWS.md](ops/DEPLOY_AWS.md) |
| デモサイトを Amplify で公開する | [ops/DEPLOY_DEMO_AMPLIFY.md](ops/DEPLOY_DEMO_AMPLIFY.md) |
| 外部リポジトリから取り込む | [ops/UPSTREAM_IMPORT.md](ops/UPSTREAM_IMPORT.md) |
| パッケージの統廃合を検討する | [ops/PACKAGE_CONSOLIDATION.md](ops/PACKAGE_CONSOLIDATION.md) |

### 判断の背景を知る

| 知りたいこと | 読むもの |
|---|---|
| **なぜこういう作りなのか** | [adr/](adr/) — 設計判断の記録（15件） |
| なぜバージョンを上げないのか | [adr/0011-no-versioning-monorepo.md](adr/0011-no-versioning-monorepo.md) |
| なぜ基盤とアプリを分けるのか | [adr/0002-platform-app-separation.md](adr/0002-platform-app-separation.md) |
| 何を作ってきたか（全変更履歴） | [../docs/HISTORY.md](../docs/HISTORY.md) |

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

最初の 1 機能を自分で作る実地課題は [ops/../onboarding/04-task.md](ops/../onboarding/04-task.md) にあります。

**詰まった箇所は必ず記録してください。** あなたが詰まった場所は次の人も詰まります。それを直す PR が、最初の練習にちょうどいいお題です。

## 読む順番（新しく入った人向け）

```
0. docs/onboarding/02-first-hour.md           まず動かす（1時間）
1. docs/onboarding/01-setup.md      環境を作る
2. docs/ops/GIT_GUIDE.md            Git が初めてなら
3. docs/onboarding/03-development.md    開発の流れを知る
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

120 パッケージ・465 API・ER 図・ADR・各アプリの画面/API を**検索**できます。`main` に push すると GitHub Pages に自動公開されます。

---

## それでも見つからないとき

1. **リポジトリ内を検索**: VS Code / Cursor で `Ctrl+Shift+F`（`Cmd+Shift+F`）
2. **AI に聞く**: `pnpm mcp:catalog` を繋げば基盤を検索して答えます
3. **人に聞く**: 情シス担当へ。その際「どこを探したか」を伝えると早いです
