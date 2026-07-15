# 0009: デプロイは ConoHa 先行・AWS(Amplify 中心)を次段

- 日付: 2026-07-14 / 状態: 採用

## 文脈
壁打ち(2026-07)で AWS 展開を検討。結論は「Amplify(UI+Route Handler)中心、重い処理のみ Lambda、RDS/S3/SES/CloudWatch/Secrets Manager」。一方、現行実装は ConoHa VPS + Docker(release.yml→GHCR→docker-compose.prod)で一式が既に存在する。

## 決定
**現行の ConoHa 経路を本番第1経路として維持**しつつ、AWS は Amplify 中心構成を公式方針とし、導線(ルート amplify.yml・docs/ops/DEPLOY_AWS.md)を整備して次段で実走検証する。Lambda は「AI 大量処理・夜間バッチ・10万件級 CSV・OCR」等の重い処理を切り出す時のみ。

## 検討した代替案と見送り理由
- EC2 常用: OS 運用負荷が目的(AI で素早く量産)に合わない。ECS は将来の常時稼働サービス向け(deploy-aws.yml.template を温存)。

## 影響
二系統になるが、モノレポ・packages 構成はどちらでも無変更(壁打ち結論と一致)。AWS 側は未実走のため「未検証」を明記。
