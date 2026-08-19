# GitHub Actions（自動で動く仕組み）

コードを push したり Pull Request を作ったりすると、**GitHub 上で自動的に確認が走ります**。
ここでは「いつ・何が動いて・落ちたらどうするか」をまとめます。

> はじめての方へ: GitHub Actions は「決まったきっかけで、決まった作業を代わりにやってくれる仕組み」です。
> 手元で `node tools/preflight.mjs` を流すのと同じことを、**push のたびに機械が繰り返します**。
> 人が忘れても、機械は忘れません。

---

## 一覧

| ワークフロー | いつ動くか | 何をするか |
|---|---|---|
| **CI** | push / PR | いちばん重要。型検査・42 種類の検査・テスト・ビルドを通す |
| **E2E** | push / PR | ブラウザを起動して、画面が実際に動くか確かめる |
| **PR Auto Review** | PR | 変更の要約を PR にコメントする（人の代わりに事実だけ並べる）。**変更した基盤がどこに影響するか**も出す |
| **新しい部品のレビュー** | PR（`packages/*/package.json` 追加時）| **既に同じものが無いか**候補を出す |
| **i18n** | PR | 翻訳の抜けを確かめる |
| **Security** | push / PR / 毎週 | 秘密情報の混入・依存の脆弱性を調べる |
| **CodeQL** | push / PR / 毎週 | コードの脆弱性を静的に解析する |
| **contract** | 毎週月曜 6:00 JST | 外部 SaaS の応答が変わっていないか確かめる |
| **debt** | 毎月 1 日 6:00 JST | 残債（上限方式で先送りしている件数）を記録し、3 か月動いていなければ Issue を立てる |
| **ops-reminder** | 毎月 1 日 9:00 JST | **後回しにされがちな運用タスク**を Issue にする（復元訓練・契約テストの記録など）|
| **Reference Site (Pages)** | push | API リファレンスのサイトを更新する |
| **Release (build & push image)** | タグを push | Docker イメージを作って公開する |
| **Publish packages (GitHub Packages)** | タグを push（`v*`） | 基盤 120 パッケージを **`@mtmk-cc` スコープで publish**。アプリ側はこれを `^2026.8.0` のように参照します（ADR-0026）。**配る前に `pnpm check` と build を通します**——壊れたものを配ると取り消せません |
| **Deploy to ConoHa** | Release の後 | サーバへ配る |

---

## 変更の影響範囲が PR に出る

この基盤は 120 パッケージあり、**`@platform/core` は 59 個のパッケージから使われています**。
core を 1 行変えると、そこから連鎖して **64 か所**に届きます。

ところが PR の画面に出るのは「変更したファイル」だけです。
レビューする人も、出した人も、**どこまで確認すべきか分からないまま**通してしまいます。

そこで **PR Auto Review** が次のようなコメントを付けます。

```
### `@platform/core` → 64 か所に影響

- 直接使っている(59): @platform/auth, @platform/db, ...
- そこから先へ届く(5): @platform/ui, public-site, ...

⚠ 64 か所に影響します。次を確認してください:
- pnpm smoke が通るか
- 公開 API を変えたなら api-surface.mjs で破壊的変更が出ていないか
- 使う側の画面を 1 つ以上、実際に動かしたか
```

手元でも同じことが確認できます。

```bash
node tools/impact.mjs packages/core/src/index.ts
node tools/impact.mjs --base origin/main      # git の差分から自動で
```

アプリだけの変更なら「影響はアプリ内に閉じています」と出て、コメントは付きません。

---

## 後回しにされる仕事を、月に 1 度 Issue にする

「やった方がいいが、緊急ではない」ことは必ず後回しになります。

たとえば**復元訓練**（バックアップから本当に戻せるか試すこと）は、
`preflight` が毎回警告を出しています。しかし**出続けると見えなくなります**。

そこで **ops-reminder** が毎月 1 日に Issue を立てます。Issue になれば、担当と期限が付きます。

対象は次の 3 つです。

1. **復元訓練** … 戻せるか試していないバックアップは、無いのとほぼ同じ
2. **契約テストの記録** … 実 API の応答が無いと「モックでは通るが本物では動かない」を検出できない
3. **未実戦のパッケージ** … どこからも使われていない = 動作が一度も確かめられていない

**すべて解消していれば Issue は作られません。**
毎月「やることはありません」と通知すると、通知そのものが無視されるためです。

手元でも確認できます。

```bash
node tools/ops-reminder.mjs
```

---

## ワークフロー自体も検査している

CI が壊れると、**46 種類の検査すべてが動かなくなります**。
しかも「落ちる」のではなく「そもそも走らない」ため、**緑に見えてしまいます**。

ワークフローは手元で試しにくく（push しないと動かない）、間違いに気づくまで時間がかかります。
そこで `check-workflows` が、機械的に拾えるものだけを先に見ます。

| 記号 | 何を見るか | 放っておくとどうなるか |
|---|---|---|
| W001 | `git diff` を使うのに `fetch-depth: 0` が無い | **既定は浅いクローン**（履歴 1 件）。差分が取れず、その処理だけ黙って失敗する |
| W002 | 秘密情報の直書き | トークンやパスワードがリポジトリに残る |
| W003 | `permissions:` の指定が無い | 既定の権限は広い。漏れたトークンでできることが増える |
| W004 | 呼んでいるスクリプトが実在しない | ツールの名前を変えたとき、CI だけが古いまま |
| W005 | `pnpm` を使うのに `pnpm/action-setup` が無い | `pnpm: command not found` で落ちる |

```bash
node tools/check-workflows.mjs
```

> **W001 は実際に踏みました。** 影響範囲を PR に出す仕組みを足したとき、
> `fetch-depth` を書き忘れて `git diff origin/main...HEAD` が失敗する状態でした。
> エラーにならず「差分なし」として扱われるため、気づきにくい種類の間違いです。

---

## CI が見ているもの

いちばん重要なので、中身を書いておきます。

### Linux（ubuntu-latest）

1. **型検査**（`pnpm -r typecheck`）— 型が合わないコードを止める
2. **Lint** — 書き方の作法
3. **42 種類の検査**（`node tools/preflight.mjs`）— 詳細は [CHECKS.md](CHECKS.md)
4. **smoke**（1,451 件）— 依存をインストールせずに動く論理の確認
5. **単体テスト**
6. **ビルド**

### Windows（windows-latest）

**開発者は Windows、CI は Linux** という食い違いが、実際に事故を生みました。
2026-08 に「Linux では通るが Windows では落ちる」問題を 4 種類踏んでいます。

- `/tmp` の直書き（Windows には無い）
- 動的 import に絶対パス（`C:\...` が `c:` プロトコルと解釈される）
- 生成コードへのパス埋め込み（同上）
- URL とパスの混同（`.pathname` が `/C:/...` になる）

どれも**手元で試すまで誰も気づけませんでした**。そのため Windows でも

- **smoke を通す**
- パス長 260 文字を測る
- `setup.ps1` の構文と静的解析

を行います。

---

## 落ちたときは

### まず PR のコメントを見る

CI が失敗すると、**失敗した理由の要約が PR に自動でコメント**されます
（`ci-log-summary` が失敗ログから抽出します）。ログ全体を読む前に、まずここを見てください。

### 手元で再現する

ほとんどの検査は**手元でそのまま動きます**。

```bash
node tools/preflight.mjs     # CI と同じ 42 種類の検査
pnpm smoke                   # 依存のインストール不要
pnpm test                    # 単体テスト
```

### よくある失敗

| 症状 | 原因 | 直し方 |
|---|---|---|
| `check-generated` が赤 | 生成物が古い | `node tools/gen-all.mjs` を実行してコミット |
| `check-doc-numbers` が赤 | 資料の数値が実態とずれた | `node tools/check-doc-numbers.mjs --fix` |
| `check-lockfile` が赤 | `pnpm-lock.yaml` が古い | `pnpm install` してコミット |
| Windows だけ赤 | `/tmp` や絶対パスの直書き | [HANDOVER.md](HANDOVER.md) の「Windows」の項を参照 |

---

## 新しい検査を足したとき

CI の設定を変える必要は**ありません**。`preflight` が `tools/check-*.mjs` を
まとめて呼ぶので、そこに追加するだけで CI にも入ります。

ただし 2 つ忘れないでください。

1. **`tools/verify-checks.mjs` に追記する** — 「その検査が本当に発火するか」を確かめる仕組みです。
   追記を忘れると `verify-checks` が「未分類」として落ちます。
2. **[CHECKS.md](CHECKS.md) に 1 行足す** — 何を見ている検査か分からないと、
   落ちたときに直しようがありません。

---

## 設定を変えるとき

ワークフローの定義は `.github/workflows/` にあります。
変更したら、**PR を出して CI が緑になることを確かめてから**マージしてください
（ワークフロー自体の誤りは、マージするまで分からないことがあります）。

秘密情報（API キーなど）は GitHub の **Settings → Secrets** に登録し、
`${{ secrets.NAME }}` で参照します。**ワークフローに直接書かないでください。**
`Security` ワークフローの Gitleaks が検出しますが、一度 push すると履歴に残ります。

---

# CI の初回実行（1 回きり）

**`docs/ops/GITHUB_ACTIONS.md` を統合したものです（2026-08）。**

オフライン環境で開発してきたため **pnpm install / build / vitest / Playwright / docker build は未実走**。GitHub 上での初回を最短で緑にするための手順書。実走で判明した修正は本表と ../onboarding/01-setup.md の FAQ に追記していく。

## このコミットまでに整備済み(オフラインで可能な全て)

- **build/deploy 事前点検で修正済み**(いずれも「build/deploy しないと気づけない」類):
  - **全5アプリの `next.config.mjs` の `transpilePackages` 漏れ**(internal-app は 46 依存中 9 しか記載が無く `next build` 失敗確実)→ **package.json の @platform 依存から動的生成**に統一。再発防止に **`tools/check-app-transpile.mjs`** を新設し preflight に組込。
  - **`Dockerfile.migrate` が `prisma migrate deploy`**(migrations/ が無く ADR-0013=db push に反し必ず失敗)→ **`prisma db push`** に是正。
  - **`Dockerfile`(app)の `COPY --from=fetch /repo/node_modules`**(pnpm fetch は node_modules を作らない=初回 COPY 失敗)→ 除去(ストア `/pnpm` のみ持込み `install --offline` で復元)。
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
| 10 | 実測の還元 | 判明した修正を本表・../onboarding/01-setup.md FAQ へ追記 | - | ☐ |

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

対応の当たり: Install 失敗→peer/lockfile(手順1-2)、Typecheck 失敗→実 @types 差分(3b)、Build 失敗→不足 env を ci.yml の `env:` へ(3c)、Docker 失敗→standalone 同梱(手順5-6)。修正後は本ファイルの表と ../onboarding/01-setup.md の FAQ に**実際に効いた対処**を1行追記する(次の人のため)。

