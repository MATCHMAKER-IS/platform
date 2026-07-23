# 0014: 本番投入時は、データを保持したままマイグレーションへ切り替える(baseline)

- 日付: 2026-07-22 / 状態: 採用

## 文脈(なぜ決める必要があったか)

ADR 0013 で「開発中は `db push`、**本番運用を開始したらマイグレーションへ移行する**」と決めた。
条件と大枠の手順はそこに書いてある。しかし、その手順は

```bash
pnpm --filter internal-app exec prisma migrate dev --name init
```

から始まっている。これは **開発用のコマンド** で、既存 DB とマイグレーション履歴が食い違うと
**「DB をリセットしますか」と促す**。つまり ADR 0013 の手順は

- 中身を捨ててよい開発 DB では正しい
- **既にデータが入っている DB では使えない(最悪、全件消える)**

切り替えが必要になる場面は、定義上いつも「消せないデータが入った後」である。
一番使いたい瞬間に使えない手順しか無い、という状態を解消する。

## 決定

本番 DB をマイグレーション運用へ移すときは、**`migrate dev` を使わない**。
既存のスキーマを「適用済みの初期マイグレーション」として登録する
(**baseline**)方式を正式な手順とする。

### 手順(internal-app の例。アプリごとに実施する)

前提: **この作業の直前に必ずバックアップを取得し、復元できることを確認する**
(`docs/ops/BACKUP_RESTORE.md`)。

```bash
# 0. 対象アプリへ移動して作業する
cd apps/internal-app

# 1. いま動いているスキーマから、初期マイグレーションの SQL を生成する
#    (DB には触れない。ファイルを作るだけ)
mkdir -p prisma/migrations/0_init
pnpm exec prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql

# 2. 生成された SQL が「今の本番と同じ形」かを目で確認する
#    (db push で入った差分が漏れていないか。ここだけは人間が見る)
less prisma/migrations/0_init/migration.sql

# 3. この SQL は「すでに適用済み」であると DB に記録する
#    (実行はしない。テーブルは既に存在するため)
pnpm exec prisma migrate resolve --applied 0_init

# 4. 差分が無いことを確認する(何も出なければ成功)
pnpm exec prisma migrate status
```

以降のスキーマ変更は通常どおり:

```bash
# 開発環境で差分マイグレーションを作る
cd apps/internal-app && pnpm exec prisma migrate dev --name add_task_table

# 本番へは deploy のみ(dev は本番で絶対に使わない)
cd apps/internal-app && pnpm exec prisma migrate deploy
```

### 決めごと

- **本番環境で `prisma migrate dev` と `prisma db push` を実行しない。** 使うのは `migrate deploy` だけ
- baseline 以降、`prisma/migrations/` は**消さない・書き換えない**(適用済みの履歴は事実の記録)
- 破壊的変更(列の削除・型変更)は**2段階**で行う
  1. 新しい列を追加して両方に書く → 移行 → 読み先を切り替える
  2. 十分な期間が経ってから古い列を削除する
- マイグレーションは**前進のみ**。切り戻しは「打ち消すマイグレーションを新しく作る」か、
  バックアップからの復元で行う(`migrate resolve --rolled-back` に頼らない)

## 検討した代替案と見送り理由

| 案 | 見送り理由 |
|---|---|
| ADR 0013 のまま `migrate dev --name init` を使う | 既存データのある DB ではリセットを促す。事故の温床 |
| 本番でも `db push` を続ける | 履歴が残らず、何をいつ変えたか追えない。列削除が無警告で走る |
| DB をダンプして作り直す | 停止時間が長い。データ量が増えるほど非現実的 |
| 別のマイグレーションツールを入れる | Prisma と二重管理になる。学ぶことが増える |

## 影響(良い点・受け入れるコスト・関連ドキュメント)

良い点:

- **本番稼働の当日に手順を考えなくてよい**。事故が起きやすい瞬間に、迷いが無くなる
- スキーマ変更の履歴が残り、いつ何を変えたかを追える
- レビューの単位が「差分の SQL」になる

受け入れるコスト:

- baseline の SQL を人間が一度確認する必要がある(初回だけ)
- 以降、スキーマ変更のたびにマイグレーションファイルが増え、ブランチ間で競合しうる

関連:

- `docs/adr/0013-db-push-not-migrations.md`(この ADR の前提。開発中は `db push`)
- `docs/ops/BACKUP_RESTORE.md`(baseline の前に必須のバックアップと復元確認)
- `docs/DATABASE.md`
