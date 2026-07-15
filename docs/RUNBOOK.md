# 運用 Runbook(バックアップ・DR・障害対応)

本番運用の手順書。オンコール担当が参照する。用語: **RPO**=許容データ損失時間、**RTO**=許容復旧時間。

## 目標(SLO)
- 可用性: 99.9%(月間ダウンタイム 約43分以内)
- **RPO: 15分**(直近15分ぶんまでのデータ損失を許容)
- **RTO: 1時間**(障害検知から復旧まで)

## 1. バックアップ

### PostgreSQL
- **自動バックアップ**: マネージド DB(RDS/Cloud SQL 等)の自動スナップショットを日次取得、保持14日。
- **PITR(ポイントインタイムリカバリ)**: WAL アーカイブを有効化し、任意時点へ復旧可能に(RPO 15分の担保)。
- **論理バックアップ(週次)**: `pg_dump -Fc` を別リージョンのオブジェクトストレージへ。保持8週。
  ```bash
  pg_dump -Fc "$DATABASE_URL" | gzip > backup-$(date +%Y%m%d).dump.gz
  # 別リージョンへ転送(例)
  aws s3 cp backup-*.dump.gz s3://backup-bucket/postgres/ --region ap-northeast-3
  ```
- **リストア確認**: 月次でステージングへリストアし、整合性を検証(バックアップは「復旧できて初めて有効」)。

### Redis
- キャッシュ/ロック/セッションは**揮発性前提**。失われても再構築できる設計(cache はミス時に再取得、lock は TTL、Outbox は DB 永続)。
- ただしセッションは Redis 障害でログアウトが発生するため、AOF 有効化＋レプリカ構成を推奨。

### オブジェクトストレージ(添付ファイル)
- バージョニング + クロスリージョンレプリケーションを有効化。`@platform/storage` の `createFallbackStorage` で読取フォールバックも併用。

## 2. リストア手順

### DB を特定時点へ復旧(PITR)
1. 影響範囲を確認し、必要ならアプリを**メンテナンスモード**に(feature flag の kill switch or `DISABLE_*` 環境変数)。
2. マネージド DB コンソールで復旧ポイント(障害直前)を選び、新インスタンスへ復元。
3. 接続文字列(`DATABASE_URL`)を新インスタンスへ切替、Prisma マイグレーション状態を確認。
4. スモーク(`/api/health?type=live` と主要フロー)で健全性確認 → メンテナンス解除。

### 論理バックアップから復旧
```bash
gunzip -c backup-YYYYMMDD.dump.gz | pg_restore -d "$NEW_DATABASE_URL" --clean --if-exists
```

## 3. DR(リージョン障害)
- **RTO 1時間の想定手順**:
  1. 別リージョンのスタンバイ(リードレプリカ)を昇格 or 最新スナップショットから起動。
  2. アプリを別リージョンにデプロイ(コンテナイメージは事前にマルチリージョンへ push 済み)。
  3. DNS/ロードバランサを切替。
  4. Redis/オブジェクトストレージも別リージョン構成へ。
- 事前準備: イメージ・バックアップ・シークレット(Secrets Manager のレプリケーション)を**常時マルチリージョン**に。

## 4. デプロイ・ロールバック
- **ゼロダウンタイム**: `createLifecycle` が SIGTERM で受付停止→処理完了待ち→接続切断(k8s の preStop/terminationGracePeriodSeconds を 30s 以上に)。
- **DB マイグレーション**: expand/contract 方式(1: 後方互換なカラム追加 → 2: 新旧両対応でデプロイ → 3: 旧カラム削除)。1リリースで破壊的変更をしない。
- **ロールバック**: 直前のイメージへ戻す。マイグレーションは「前進のみ」を原則とし、ロールバック用の逆マイグレーションを用意。
- **段階リリース**: `@platform/flags` の `rolloutPercent` で 10%→50%→100%。異常時は kill switch で即オフ。

## 5. 障害対応フロー
1. **検知**: `@platform/observability` のアラート(`createAlertManager`)が発報 → Slack/PagerDuty。
2. **一次対応**: `/api/health` と `/api/metrics`、トレース(OTLP 送信先の可視化ツール)で影響範囲を特定。同じ `traceId` でログを追跡。
3. **緩和**: 外部依存障害ならサーキットブレーカーが自動遮断。必要なら該当機能を feature flag でオフ。
4. **復旧**: 本 Runbook のリストア/DR 手順。
5. **事後**: ポストモーテムを記録(原因・影響・再発防止)。ADR に反映。

## 6. 監視・アラートの主要指標
| 指標 | しきい値(例) | ヘルパー |
|---|---|---|
| API エラー率 | 5% 超で warning、10% 超で critical | `errorRateAbove` |
| API レイテンシ(平均) | 500ms 超 | `avgLatencyAbove` |
| Zoho サーキットブレーカー | open(gauge=2) | `gaugeAtLeast` |
| 通知 Outbox の failed 累積 | 増加傾向 | メトリクス監視 |
| cron ジョブ失敗 | 連続失敗 | `cron_runs_total{outcome=failure}` |

## 7. 定期訓練
- **四半期ごと**にリストア訓練(バックアップからの復旧を実施)。
- **半期ごと**に DR 訓練(リージョン切替のドライラン)。
