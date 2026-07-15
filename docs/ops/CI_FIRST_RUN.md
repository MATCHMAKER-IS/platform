# CI 初回実走ガイド(チェックリスト)

オフライン環境で開発してきたため **pnpm install / build / vitest / Playwright / docker build は未実走**。GitHub 上での初回を最短で緑にするための手順書。実走で判明した修正は本表と SETUP.md の FAQ に追記していく。

## このコミットまでに整備済み(オフラインで可能な全て)

- **全8ワークフローを監査**: ci / e2e / security / i18n の `--frozen-lockfile` を暫定通常 install 化(TODO 付き・4ファイル5箇所)、pnpm バージョン固定を `packageManager` に一本化(ci / i18n)
- verify ジョブ: Typecheck 前の **prisma generate**、Build への**ダミー env**(fail-fast 対策)、e2e の暫定 `continue-on-error`
- boundaries ジョブ: **`node tools/preflight.mjs` に一本化**(smoke / check-deps / api-surface 差分 / schema×3 / env-example / setup.sh 構文 = 8ゲート約10秒)
- **デプロイ経路の欠落を修復**: release.yml が参照していた `apps/internal-app/Dockerfile` と `Dockerfile.migrate` を新設(+ `.dockerignore`)。**未検証** — 手順6で必ず確認

## ローカル再現済み(オフラインで緑を確認)

install を伴わない全ゲートは作成環境で緑を確認済み: **preflight 8ゲート**(smoke 871 / check-deps / api-surface / schema×3 / env-example / advisor / setup構文)、**check-generated**(module-list・advisor-report の drift なし)、全ワークフロー + amplify.yml + docker-compose×2 の **YAML 妥当性**。残るは install/build/docker/e2e の実走のみ(下表)。

## 【最初に必ず】CODEOWNERS の置換

`.github/CODEOWNERS` の **`@platform-team` はプレースホルダ**です。実在しないまま
「コードオーナーのレビュー必須」を有効にすると、**誰も承認できず PR がマージ不能**になります。

```bash
# 1. 自社のチーム or 個人に置換
#    例: @your-org/platform  または  @yamada
sed -i 's/@platform-team/@your-org\/platform/g' .github/CODEOWNERS
```

2. GitHub → **Settings → Branches → main** で以下を設定:

| 設定 | 値 | 理由 |
|---|---|---|
| Require a pull request before merging | ON | main への直接 push を禁止 |
| Require approvals | 1 以上 | レビューを必須に |
| **Require review from Code Owners** | ON | 基盤変更は基盤担当のレビューを必須に |
| Require status checks to pass | ON（`verify` / `boundaries` を選択） | CI が緑でないとマージ不可 |

> **1 人で運用する場合**: Code Owners を自分にすると「自分の PR を自分で承認できない」ため止まります。
> その場合は Require approvals を 0 にするか、Code Owners を無効にしてください（CI の必須化は残す）。

## 初回実走チェックリスト(上から順に・結果を記入)

| # | 作業 | コマンド / 場所 | 期待 | 結果 |
|---|---|---|---|---|
| 1 | lockfile 生成 | ローカル `pnpm install` → `pnpm-lock.yaml` を**コミット** | lockfile 生成 | ☐ |
| 2 | frozen に戻す | `git grep -l 'TODO: pnpm-lock'` の4ファイル(5箇所)を `--frozen-lockfile` へ | TODO 0件 | ☐ |
| 3 | verify 実走 | push → Actions verify | install〜build 緑 | ☐ |
| 3a | ↳ install 失敗 | peer 依存エラーの package を調整 | - | ☐ |
| 3b | ↳ typecheck 失敗 | 実 @types/react 差分(既知候補: @platform/ui の Props)を修正 | - | ☐ |
| 3c | ↳ build 失敗 | 不足 env を ci.yml Build の `env:` に追加 | - | ☐ |
| 4 | boundaries | 同 push 内 | preflight 8ゲート ✅ | ☐ |
| 5 | Docker: app | `docker build -f apps/internal-app/Dockerfile .` | イメージ完成・`docker run -p 3000:3000 --env-file ...` で起動 | ☐ |
| 6 | Docker: migrate | `docker build -f apps/internal-app/Dockerfile.migrate .` | 完成 | ☐ |
| 7 | e2e | ローカル `pnpm e2e`(3001/3002/3003 は webServer 自動起動) | 3 spec 緑 | ☐ |
| 8 | e2e 常設化 | ci.yml の `continue-on-error: true` を削除 | Actions でも緑 | ☐ |
| 9 | release | main push → GHCR へ app / migrate | push 成功(deploy-conoha が pull 可能に) | ☐ |
| 10 | 実測の還元 | 判明した修正を本表・SETUP.md FAQ へ追記 | - | ☐ |

## Docker まわりの注意(未検証ポイント)

Dockerfile は「pnpm fetch → offline install → prisma generate → Next **standalone**」の標準構成。ビルド時は env.ts の fail-fast を**ダミー値**で通し、実行時に `env_file` で上書きする。要確認になり得る点: standalone への Prisma エンジン同梱(不足なら runner 段に generate 追加)/ `public/` の有無 / ビルド時 env の過不足。migrate イメージは prisma@7.2.0 単体(`packages/db` の ^7.2.0 と同期を保つこと)。

## 完了条件

verify・boundaries・e2e(常設)・release(GHCR push)がすべて緑。以後の lockfile 更新は Renovate 等に委任。

## エラーログの取り込み(実走したら)

初回 Actions のログが出たら、失敗ジョブの**最後の 30〜50 行**を開発担当(または Claude)に共有する。定型:

```
### 失敗ジョブ: <verify / boundaries / e2e / release>
### ステップ: <Install / Typecheck / Build / ...>
<ログ末尾を貼り付け>
```

対応の当たり: Install 失敗→peer/lockfile(手順1-2)、Typecheck 失敗→実 @types 差分(3b)、Build 失敗→不足 env を ci.yml の `env:` へ(3c)、Docker 失敗→standalone 同梱(手順5-6)。修正後は本ファイルの表と SETUP.md の FAQ に**実際に効いた対処**を1行追記する(次の人のため)。
