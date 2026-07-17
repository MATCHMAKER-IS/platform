# 統合デモサイトを AWS Amplify にデプロイする

`demos/showcase`(45 画面)を Amplify に載せます。**DB を持たない**ので、RDS などのバックエンドは不要です。

---

## 先にやること(これをしないとビルドが必ず失敗します)

### pnpm-lock.yaml をコミットする

```bash
pnpm install                       # lock が生成される
git add pnpm-lock.yaml
git commit -m "chore: add pnpm-lock.yaml"
git push
```

**なぜ必要か**: `amplify.yml` の `pnpm install --frozen-lockfile` は lock ファイルを前提にします。
無いと即座に失敗します。lock をコミットすると、**Amplify とローカルで同じ依存が入る**ことも保証できます。

---

## Amplify コンソールでの手順

### 1. アプリを作成してリポジトリを接続

1. Amplify のコンソール → **「新しいアプリ」→「ウェブアプリをホスト」**
2. GitHub を選び、リポジトリと **`main` ブランチ**を選択

### 2. モノレポの設定 ★ここが重要

「**モノレポですか?**」で **はい** を選び、

| 項目 | 値 |
|---|---|
| **モノレポのルートディレクトリ** | `demos/showcase` |

**これを設定しないと失敗します**。Amplify がリポジトリ直下を Next.js アプリだと思い込み、
`package.json` に `build` が無い(ルートはワークスペースの親)ためです。

### 3. ビルド設定

**そのまま次へ**。リポジトリ直下の `amplify.yml` が自動で読まれます。

> コンソールに表示されるビルド設定を編集する必要はありません。
> 編集すると `amplify.yml` より優先されてしまい、どちらが効いているか分からなくなります。

### 4. 環境変数

**不要です**。このサイトは DB も外部 API も使いません。

### 5. デプロイ

「保存してデプロイ」。初回は 5〜10 分ほどかかります。

---

## ビルドが失敗したときの見方

### `pnpm: command not found`

`amplify.yml` の `corepack enable` が効いていません。Amplify のビルドイメージが古い可能性があります。

**対処**: アプリの設定 → ビルドの設定 → **ビルドイメージ** を `Amazon Linux:2023` にする。

### `ERR_PNPM_NO_LOCKFILE`

`pnpm-lock.yaml` がコミットされていません。上の「先にやること」を実行してください。

### `No Next.js version detected`

モノレポのルートディレクトリが設定されていません。手順 2 を確認してください。

### `Module not found: Can't resolve '...'` が大量に出る(103 件など)

**build をモノレポのルートで実行している**のが原因です。`amplify.yml` の build が

```yaml
- cd ../.. && pnpm --filter showcase-demo build   # ❌ これはダメ
```

になっていると、Next.js がルートで動き、**相対 import も `node_modules` も解決できません**
(Turbopack が `./demos/showcase/...` を基準にしてしまう)。

正しくは、**appRoot のまま実行**します:

```yaml
- pnpm build   # ✅ demos/showcase で実行される
```

`install` はルートで行う必要があります(workspace 全体の解決のため)が、
**build は appRoot のまま**です。

### `No package found in this workspace`

`pwd` が `/` を指しています。`$AMPLIFY_APP_ROOT` などの環境変数が**空**で、
`cd ""` によりルートへ移動してしまっています。

**このバージョンの Amplify では `AMPLIFY_APP_ROOT` は提供されません**。
相対パスで移動してください(`amplify.yml` は既にそうなっています)。

### `Module not found` が全画面で出る

**Turbopack のせいではありません。** 基盤パッケージの `main` が、存在しない `dist` を
指しているのが原因です(詳細は PLATFORM_SERVICES.md の「【真因】」)。

`packages/*` は **ソースを直接公開**します(`main: "./src/index.ts"`)。
`dist` を指すとビルドしていない限り解決できません。dev では `transpilePackages` が
ソースを読むので気づけず、**`next build` で初めて出ます**。

検査できます:

```bash
node tools/check-build-ready.mjs   # 検査 A が main / exports の実在を見る
```

> **webpack へのフォールバックは不要です。**
> かつて `next build --no-turbopack` にしていた時期がありますが、
> **`--no-turbopack` は Next.js に存在しないオプション**で、書いても黙って無視されます
> (opt-out するなら `--webpack`)。当時 webpack のおかげで直ったように見えたことは
> 一度もなく、実際の原因は上の `dist` でした。Turbopack のままで通ります。

### `Cannot find module '@platform/xxx'`

`transpilePackages` の漏れです。ローカルで確認できます:

```bash
node tools/check-showcase-deps.mjs
```

### `Functions cannot be passed directly to Client Components`

```
Error occurred prerendering page "/_not-found"
Error: Functions cannot be passed directly to Client Components
  unless you explicitly expose it by marking it with "use server".
  {register: function e, registerAll: ..., get: ..., ...}
```

Server Component から Client Component へ、**関数を持つオブジェクト**を props で
渡しています。RSC のシリアライズを通れません。`/_not-found` に出るのは、そこが
最初にプリレンダされるページだからで、**そのレイアウト配下の全ページが同じ理由で落ちます**。

典型例は `createThemeRegistry()` の戻り値(メソッドの塊)を `layout.tsx` から
`<AppSkin registry={...}>` へ渡していた形。**基盤側で修正済み**で、今は
`<AppSkin>` と書くだけでよく、アプリに `lib/theme-registry.ts` は要りません。
カスタムテーマを足す場合も `themes={[...builtInThemes, ...custom]}`(プレーンデータ)を渡します。

同じ形を自作した場合は、**client 境界の内側でオブジェクトを作る**のが修正です。
機械的に検査できます:

```bash
node tools/check-build-ready.mjs   # 検査 J が server → client の関数渡しを見る
```

これも dev では動き、**`next build` で初めて出ます**。

### ビルドは通るが画面が真っ白 / 500 エラー

Next.js の SSR が動いていません。アプリの設定 → **プラットフォーム** が
`Web Compute`(SSR)になっているか確認してください。`Web`(静的)だと動きません。

ビルドログではなく **Hosting compute logs**(CloudWatch)にランタイムのスタックが出ます。

---

## デプロイ後の確認

| 確認すること | 見方 |
|---|---|
| トップが出るか | `/` に 55 デモが 3 区分で並ぶ |
| サイドバーが動くか | 区分をクリックして開閉できる |
| **使用例が表示されるか** | `/examples/workplace-ops` にコードが出る |
| アプリデモが動くか | `/apps/internal` でタブを切り替えられる |
| テーマが切り替わるか | 右上のスイッチャーで 11 スキン |

**使用例のコードが出ない場合**は、生成物が古いかもしれません:

```bash
pnpm gen:all       # example-sources.generated.ts を作り直す
git add demos/showcase/src/lib/example-sources.generated.ts
git commit && git push
```

---

## なぜ実行時にファイルを読まないのか

使用例のソースは**ビルド時に JSON へ固めています**(`example-sources.generated.ts`)。

実行時に `readFileSync` で読むと、**Amplify の SSR では `process.cwd()` が想定と違う場所を指し**、
ソースが読めずに 9 画面が壊れます。ローカルでは動くので、**デプロイして初めて気づく**類の問題です。

---

## apps/ をデプロイしたい場合

`apps/internal-app` は **DB(PostgreSQL)が必須**です。Amplify だけでは動きません。

必要なもの:
- RDS(または Aurora Serverless)
- VPC の設定(Amplify から RDS へ繋ぐ)
- 環境変数(`DATABASE_URL` など)
- `prisma generate` をビルドに追加

手順は `DEPLOY_AWS.md` を参照してください。**月額のコストがかかる**ので、
デモを見せるだけなら統合デモサイトで足ります。
