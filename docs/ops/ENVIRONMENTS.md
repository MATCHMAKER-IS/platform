# 環境の使い分け（dev / staging / production）

**基本は本番そのままの運用です。** 検証(staging)は「本番の前に一度試したい」ときだけ使います。
**常時動かす必要はありません**——使うときに上げて、終わったら落として構いません。

## 3 つの環境

| | development | staging | production |
|---|---|---|---|
| どこで | 手元の PC | 本番と同じ VPS（別ポート） | 本番の VPS |
| `APP_ENV` | `development` | `staging` | `production` |
| `NODE_ENV` | `development` | **`production`** | `production` |
| ポート | 3000 | **3001** | 3000 |
| 使う `.env` | `apps/*/.env` | `.env.staging` | `.env` |
| DB のボリューム | ローカルの docker | `db-data-staging` | `db-data` |
| 出し方 | `pnpm dev` | 手動で起動 | main へマージ（自動） |

### `NODE_ENV` と `APP_ENV` は別物です

**混同すると事故ります。**

`NODE_ENV` は **Node と Next の動作モード**で、ビルド最適化・ソースマップの有無を決めます。
**検証環境も本番と同じ `production` でビルドします**——本番と違うものを検証しても意味がないためです。

つまり **`NODE_ENV` では検証と本番を見分けられません**。
「どの環境か」は `APP_ENV` で持ちます。

| 使うもの | 何を判定するか | 検証環境では |
|---|---|---|
| `isProductionRuntime()` | `NODE_ENV=production` で**実際に起動しているか** | **true**（秘密値は検証でも必須） |
| `appEnv()` / `isProductionEnv()` | **どの環境か**（`APP_ENV`） | `"staging"` / false |

```ts
import { appEnv, isProductionEnv } from "@platform/env";

// 宛先を分ける（検証から取引先へ送らない）
const to = isProductionEnv() ? customer.email : "dev-team@example.com";
```

**知らない値は `development` に倒します。** `prod` や `stg` と綴り間違えたときに
**本番扱いになる**のが最も危ないためです（権限の弱い側へ倒す）。

## 検証環境を使う

### 1. サーバ側の準備（初回だけ）

```bash
# 本番の .env をコピーして、検証用に書き換える
cp ~/app/.env ~/app/.env.staging
```

`.env.staging` で **必ず変えるもの**:

| 変数 | なぜ |
|---|---|
| `APP_ENV=staging` | ここが本体（compose 側でも上書きしていますが、明示しておく） |
| `POSTGRES_DB` | **本番と同じ名前にしない**。別ボリュームなので実害は無いが、psql で入るとき間違える |
| `SESSION_SECRET` | 分けておくと、**検証のクッキーで本番に入れない** |
| メール・通知の宛先 | **取引先へ飛ばさない**。SMTP を Mailpit に向けるのが安全 |
| 外部 SaaS の鍵 | Zoho / Stripe などは**サンドボックスの鍵**にする |

### 2. 出す

GitHub の **Actions → Deploy to ConoHa → Run workflow → environment: `staging`**

**本番と同じイメージ**を、別ポート・別 DB で動かします。
別ビルドにすると「検証では通ったのに本番で落ちた」の原因が追えなくなります。

手元から直接動かすこともできます。

```bash
cd ~/app
docker compose -f docker-compose.staging.yml pull
docker compose -f docker-compose.staging.yml run --rm migrate
docker compose -f docker-compose.staging.yml up -d app db
```

### 3. 終わったら落とす

```bash
docker compose -f docker-compose.staging.yml down     # データは残る
docker compose -f docker-compose.staging.yml down -v  # データも消す
```

## 本番と同じ VPS に置いてよいか

**小規模なら置いてよいです。** 1 台で足りるのに 2 台借りると、維持できなくなります。

ただし**同居の代償**は理解しておいてください。

- **負荷試験を staging に向けない。** 同じホストなので本番が遅くなります
- **VPS ごと落ちたら両方止まります**
- 本番のデータが増えてきたら、**まず DB だけを別ホストへ**分けるのが順当です

## スキーマの適用はどちらも同じ道具

**`db push` と `migrate deploy` を書き分けません。**
`tools/apply-schema.mjs` が `prisma/migrations/` の有無を見て選びます。

| 履歴 | すること |
|---|---|
| 無い | `prisma db push`（開発中。[ADR 0013](../adr/0013-db-push-not-migrations.md)） |
| ある | `prisma migrate deploy`（本番で安全な唯一の方法。[ADR 0014](../adr/0014-migration-baseline-on-production.md)） |

**検証環境がいちばん役に立つのはここです。**
既存データがある状態での列追加・型変更は、**空の DB では再現しません**。
本番へ出す前に、**本番のダンプを検証へ復元してから** `migrate` を通すと、当日の事故が減ります。

```bash
# 本番のバックアップを検証へ復元してから試す（手順は BACKUP_RESTORE.md）
docker compose -f docker-compose.staging.yml run --rm migrate
```

`check-migration-mode` が「方式の書き固定」を見張っています。
`db push` と直接書いた場所があると CI が落ちます——
**切り替えの日に、直し忘れた場所だけが古い方式で残る**のを防ぐためです。

## 関連

- [BACKUP_RESTORE.md](BACKUP_RESTORE.md) — 本番のダンプを検証へ復元する
- [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md) — 障害のときに見るもの
- [ADR 0014](../adr/0014-migration-baseline-on-production.md) — マイグレーションへの切り替え
