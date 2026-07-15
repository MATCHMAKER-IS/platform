# デプロイ構成

本番デプロイの全体像。属人化・ブラックボックス化を避けるため、既存の構成ファイルと手順を一望できるようにまとめる。

## 構成ファイル(すべてリポジトリに存在)
| ファイル | 役割 |
| --- | --- |
| `apps/internal-app/Dockerfile` | アプリ本体（node:22-alpine の多段ビルド: deps → build → runner、EXPOSE 3000） |
| `apps/internal-app/Dockerfile.migrate` | マイグレーション専用イメージ |
| `docker-compose.yml` | ローカル開発用（app + db） |
| `docker-compose.prod.yml` | 本番用（app / migrate / db(postgres:17-alpine, healthcheck 付き) / 永続ボリューム） |
| `.github/workflows/ci.yml` | CI（Typecheck → Lint → i18n → Smoke → Unit tests → Build、依存境界・公開API検査、E2E） |
| `.github/workflows/deploy-conoha.yml` | ConoHa への SSH デプロイ（compose 転送 → pull → migrate → 再起動） |
| `.github/workflows/deploy-aws.yml.template` | AWS 版デプロイの雛形 |
| `.github/workflows/{e2e,security,codeql,release,i18n}.yml` | E2E・セキュリティ・CodeQL・リリース・i18n |
| `.github/dependabot.yml` | 依存更新 |

## デプロイの流れ（ConoHa）
1. main への push で CI が通る（型・Lint・Smoke・単体・E2E・依存境界）。
2. `deploy-conoha.yml` が `docker-compose.prod.yml` をサーバへ転送。
3. サーバで `docker compose pull` → `docker compose run --rm migrate`（マイグレーション）→ アプリ再起動。
4. `db` サービスは healthcheck が通るまで待機してから app が起動。

## ヘルスチェック / レディネス
- **liveness**: `GET /api/health`（プロセス生存）。
- **readiness**: `GET /api/ready` — `lib/readiness.ts` の `checkReadiness` が DB 接続・セッション秘密などの必須チェックを集約し、
  必須がすべて OK なら 200、1 つでも落ちれば 503 を返す。非必須（Slack 等）は落ちても degraded として稼働継続。
  compose の healthcheck やロードバランサの監視先に使う。

## 環境変数
`server/env.ts` の `serverEnv` に集約（DATABASE_URL / SESSION_SECRET ほか）。本番は compose の環境変数・シークレットで注入。

## ロールバック
`docker-compose.prod.yml` の image タグを直前のリビジョンに戻して pull → 再起動。マイグレーションは後方互換を原則とする（RUNBOOK.md 参照）。

## 権限（RBAC）
アプリの権限は `lib/platform-authz.ts` の `PLATFORM_POLICY` に一元化（ロール別権限 + 画面アクセス）。追加ドメインはここに権限を足す。

## 通知チャネル
承認・アラートの実送信は `@demos/notify-channels` のアダプタ（mail/Slack/LINE）を `createNotifier` に組み合わせて構成。接続先は環境変数で注入。
