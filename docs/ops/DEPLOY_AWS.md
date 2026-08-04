# AWS デプロイ方針(Amplify 中心)— 未実走・導線整備版

壁打ち(2026-07)で確定した方針の具体化。**現行本番は ConoHa(release.yml→GHCR→docker-compose.prod)で、AWS は次段の併存経路**(ADR-0005)。ここに書く手順は本環境で実走できないため **未検証** — 初回は下のチェックで確認する。

## 全体像

```
GitHub ─ push ─▶ Amplify Hosting(monorepo/appRoot 指定)
                   └ Next.js SSR(UI + Route Handler)…9割はこれで足りる
重い処理のみ:      EventBridge ─▶ Lambda(packages を import)─▶ SES / S3
データ:            RDS(PostgreSQL) / S3(ファイル) / Secrets Manager(鍵) / CloudWatch(ログ)
```

Lambda 切り出しの目安: AI 大量処理・PDF/CSV の万件級・OCR・夜間バッチ・Webhook 集約。それ以外は Route Handler で実装する(構成を増やさない)。

## Amplify 手順(internal-app の例)

1. Amplify Console → Host web app → GitHub 連携 → このリポジトリを選択
2. **Monorepo** を有効化し、App root に `apps/internal-app` を指定(ルートの `amplify.yml` が applications/appRoot 形式で自動適用)
3. 環境変数を設定(**実値**。ビルド用ダミーではない): `DATABASE_URL`(RDS)/ `MAIL_FROM` / `SESSION_SECRET` / 必要に応じ `CHAT_PERSISTENCE=prisma`・SMTP(SES)・Zoho 系 — 一覧は `apps/internal-app/.env.example`
4. RDS へのマイグレーション: 初回は手元から `pnpm db migrate internal-app -- --name init`(DATABASE_URL を RDS に向ける)。以降は CI から `prisma migrate deploy` を推奨
5. Secrets Manager を使う場合は Amplify の環境変数へ参照値を注入(直書きしない)

## 初回チェック(未検証ゆえ必ず)

- [ ] Amplify ビルドログで `pnpm install --frozen-lockfile` と `prisma generate` が成功(要 lockfile: CI_FIRST_RUN 手順1)
- [ ] SSR(WEB_COMPUTE)として認識され、`/api/*` Route Handler が応答
- [ ] env.ts の fail-fast で落ちない(環境変数の過不足)
- [ ] RDS への接続(セキュリティグループ/SSL 要否 → `?sslmode=require` 付与)
- [ ] メール: SES 利用時は `SMTP_HOST/PORT` を SES SMTP に、サンドボックス解除

## 手元から本番の DB を見る（踏み台経由）

本番の RDS はプライベートサブネットに置くため、**インターネットから直接つながりません**。
踏み台（bastion）の EC2 を経由します。

```
  手元のPC ──SSH──> 踏み台EC2 ──> RDS(プライベート)
  localhost:15432                   db.xxx.rds.amazonaws.com:5432
```

### 準備（1 回だけ）

1. 踏み台に SSH でつながることを確認する

```bash
ssh ec2-user@bastion.example.com
```

つながらないなら、鍵とセキュリティグループを先に直します。
**初回は `known_hosts` への登録が必要**です（自動化のときに聞かれると止まるため）。

2. `.env` に踏み台の情報を書く

```bash
BASTION_HOST=bastion.example.com
BASTION_USER=ec2-user
# DB のホストは DATABASE_URL から自動で読むので、通常は不要
```

### 使い方

```ts
import { withTunnel } from "@platform/db/tunnel";

const count = await withTunnel(
  { bastionHost: "bastion.example.com", bastionUser: "ec2-user", dbHost: "db.xxx.rds.amazonaws.com" },
  async (url) => {
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try { return await prisma.invoice.count(); }
    finally { await prisma.$disconnect(); }
  },
);
```

`withTunnel` は**処理が終わったら必ずトンネルを閉じます**。
例外が出ても閉じるので、ssh のプロセスが残りません。

### 覚えておくこと

| | |
|---|---|
| **本番のアプリは踏み台を経由しない** | 同じ VPC 内にあるので直接つながる。`BASTION_HOST` を設定しなければ、そのまま動く |
| **`close()` を忘れない** | 手で `openTunnel` を使うときは `try/finally` で囲む。忘れると ssh が残り、次に同じポートで失敗する |
| **鍵は `~/.ssh/config` に書く** | コードや `.env` に鍵のパスを書くより安全。ssh-agent や多要素認証もそのまま効く |
| **接続文字列はホストとポートだけ差し替わる** | ユーザー・パスワード・DB 名・`?schema=` はそのまま保たれる |

### つながらないとき

`ssh` の出力がそのままエラーメッセージに出ます。よくある原因:

- **鍵が違う** … `ssh -i ~/.ssh/key.pem ec2-user@bastion` を手で試す
- **セキュリティグループ** … 踏み台の 22 番と、RDS の 5432 番（踏み台からのみ許可）
- **known_hosts に無い** … 一度手で `ssh` してから使う

## 使い分け早見

| サービス | 役割 | 対応する基盤 |
|---|---|---|
| Amplify | UI+軽量API(Next.js) | apps/*(そのまま) |
| Lambda | 重い/非同期処理 | packages を必要分だけ import |
| RDS | PostgreSQL | @platform/db(createDb) |
| S3 / SES | ファイル / メール | @platform/storage(adapter追加はP2)/ @platform/mail |
| EventBridge / SQS | 定期・キュー | cron/jobs の実行環境として |
| ECS(将来) | 常時稼働サービス | deploy-aws.yml.template(OIDC 雛形あり) |
