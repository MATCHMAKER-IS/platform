# ADR(Architecture Decision Record)

「なぜこの設計にしたか」を残す場所。**設計を変える議論は、まず該当 ADR を読んでから**。新しい重要決定をしたら `template.md` をコピーして連番で追加する(1決定=1ファイル)。

## 新しい ADR を書くとき

1. `template.md` を写して `NNNN-短い英語の名前.md` を作る
2. **下の「全件」の表に足す**
3. **上の「何を知りたいか」にも足す** ← **忘れると smoke が落ちます**

**なぜ 2 つに載せるか**: **番号順では目的から引けません**。
「基盤とアプリの分け方」は **0002・0015・0021 の 3 つ**にまたがっており、
**用途別の索引が無いと、1 つしか見つけられません**。

### 何を ADR にするか

**後で覆したくなる決定**だけにしてください。

| ADR にする | しない |
|---|---|
| **設計の決定**（保存先・分け方・方式） | **手順**（`CHECKS.md` や `CLAUDE.md` へ） |
| **「なぜそうしないか」が問われるもの** | 使い方の説明（README へ） |
| **法令や業務の制約から来るもの** | 一時的な回避策（HANDOVER へ） |

**全部を ADR にすると、本当に重要な決定が埋もれます。**

## 何を知りたいか から探す

**24 件を上から読む必要はありません。** 目的から引いてください。

| 知りたいこと | 見る ADR |
|---|---|
| **基盤とアプリの分け方** | [0002](0002-platform-app-separation.md)（コード）/ [0021](0021-handover-split-platform-and-apps.md)（引き継ぎ資料）/ [0015](0015-package-consolidation-policy.md)（パッケージを分ける基準） |
| **DB の扱い** | [0006](0006-prisma7-driver-adapter.md)（Prisma）/ [0013](0013-db-push-not-migrations.md)（適用の仕方）/ [0014](0014-migration-baseline-on-production.md)（本番投入） |
| **保存先（メモリ / Prisma）** | [0007](0007-dual-store-memory-prisma.md) / [0004](0004-production-stores-and-lifecycle.md) |
| **AI を使うとき** | [0010](0010-ai-gateway-required.md)（**必ず Gateway 経由**） |
| **外部連携** | [0005](0005-connector-token-management.md)（トークン）/ [0008](0008-mcp-minimal-inhouse.md)（MCP） |
| **ログイン・権限** | [0016](0016-two-factor-and-sso.md)（2 要素・SSO）/ [0017](0017-access-review.md)（棚卸し） |
| **データを消す・残す** | [0018](0018-data-retention.md)（**保存義務が削除要求より優先**） |
| **日付の扱い** | [0019](0019-jst-calendar-day.md)（**暦日は JST 基準**） |
| **性能** | [0012](0012-performance-targets.md)（目標値と測り方） |
| **出し先** | [0009](0009-deploy-conoha-first-aws-next.md) |
| **検査の作り方** | [0022](0022-check-limit-baseline.md)（**上限方式**） |
| **どのパッケージを本番で使ってよいか** | [0023](0023-package-tier.md)（**成熟度 tier**） |
| **作った部品を使う場所へ繋ぐ** | [0024](0024-wire-up-policy.md)（**アプリ側 CI・被覆率**） |
| **Next.js の版をどこで決めるか** | [0025](0025-nextjs-15.md)（**置き先 Amplify の対応範囲 12〜15**） |
| **アプリと基盤をどう分けるか・版をどう振るか** | [0026](0026-app-repos-and-platform-versioning.md)（**草案**。0011 を置き換える） |
| **バージョン管理** | [0011](0011-no-versioning-monorepo.md)（**しない**） |
| **ブラウザの保存** | [0020](0020-web-storage-package.md) |
| **信頼性の部品** | [0003](0003-resilience-observability-primitives.md) |
| **ADR そのもの** | [0001](0001-record-architecture-decisions.md) |

## 全件

| # | 決定 | 状態 |
|---|---|---|
| [0001](0001-record-architecture-decisions.md) | アーキテクチャ決定を記録する(ADR の導入) | 採用 |
| [0002](0002-platform-app-separation.md) | 基盤(packages)とアプリ(apps)の分離 | 採用 |
| [0003](0003-resilience-observability-primitives.md) | 信頼性・観測性プリミティブを内製の依存ゼロで提供 | 採用 |
| [0004](0004-production-stores-and-lifecycle.md) | 本番ストア実装・graceful shutdown・シークレット管理 | 採用 |
| [0005](0005-connector-token-management.md) | 外部連携の OAuth トークン管理を基盤に取り込む | 採用 |
| [0006](0006-prisma7-driver-adapter.md) | Prisma 7 + driver adapter(pg) | 採用 |
| [0007](0007-dual-store-memory-prisma.md) | ストアの memory / prisma デュアル実装 | 採用 |
| [0008](0008-mcp-minimal-inhouse.md) | MCP は SDK 非依存の最小自作 | 採用 |
| [0009](0009-deploy-conoha-first-aws-next.md) | デプロイは ConoHa 先行・AWS(Amplify)を次段 | 採用 |
| [0010](0010-ai-gateway-required.md) | AI 呼び出しは AI Gateway 経由を必須化 | 採用 |
| [0011](0011-no-versioning-monorepo.md) | 基盤パッケージのバージョン管理はしない(モノレポ内製前提) | 採用 |
| [0012](0012-performance-targets.md) | パフォーマンスの目標値と測り方 | 採用 |
| [0013](0013-db-push-not-migrations.md) | DB スキーマの適用は `db push`(履歴を持たない) | 採用 |
| [0014](0014-migration-baseline-on-production.md) | 本番投入時はデータを保持したままマイグレーションへ切替(baseline) | 採用 |
| [0015](0015-package-consolidation-policy.md) | パッケージを分ける基準(統廃合の判断軸) | 採用 |
| [0016](0016-two-factor-and-sso.md) | 2要素認証は自前ログインのときだけ・SSO では IdP に任せる | 採用 |
| [0017](0017-access-review.md) | 権限は付けたら終わりにしない(棚卸し・退職時の停止) | 採用 |
| [0018](0018-data-retention.md) | 保存義務と削除要求が衝突したら保存義務を優先し本人に説明 | 採用 |
| [0019](0019-jst-calendar-day.md) | 暦日の比較は JST 基準で行う(UTC だと深夜〜朝 9 時が前日になる) | 採用 |
| [0020](0020-web-storage-package.md) | ブラウザの保存(localStorage)は @platform/web-storage に集約する | 採用 |
| [0021](0021-handover-split-platform-and-apps.md) | 引き継ぎ資料を基盤とアプリで分ける | 採用 |
| [0022](0022-check-limit-baseline.md) | 検査は「上限方式」で増やさせない | 採用 |
| [0023](0023-package-tier.md) | パッケージに成熟度(tier)を宣言させる | 採用 |
| [0024](0024-wire-up-policy.md) | 繋ぎ込みはアプリ側 CI と被覆率で担保する | 採用 |
| [0025](0025-nextjs-15.md) | Next.js は 15 系に固定する（Amplify の対応範囲） | 採用 |
| [0026](0026-app-repos-and-platform-versioning.md) | アプリを別リポジトリにし、基盤に版を振る | **草案** |
