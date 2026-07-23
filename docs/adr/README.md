# ADR(Architecture Decision Record)

「なぜこの設計にしたか」を残す場所。**設計を変える議論は、まず該当 ADR を読んでから**。新しい重要決定をしたら `template.md` をコピーして連番で追加する(1決定=1ファイル)。

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
