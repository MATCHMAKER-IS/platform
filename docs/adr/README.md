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
