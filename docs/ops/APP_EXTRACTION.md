# アプリを別リポジトリへ切り出す（ADR-0026 の段階 3）

基盤（`platform`）に同居しているアプリを、**独立したリポジトリ**へ移す手順です。

> **まず 1 本だけ試してください。** `line-console`（24 ファイル）を勧めます。
> `internal-app` は 680 ファイルあり、最初にやるものではありません。

## 前提（先に済ませること）

| | 状態 |
|---|---|
| `pnpm-lock.yaml` のコミット | 済 |
| スコープの改名（`@platform/` → `@mtmk-cc/`） | **未**（`node tools/rename-scope.mjs --apply`） |
| GitHub Packages への publish（1 回目） | **未**（タグ `v2026.8.0` を打つ） |

**publish が済むまで、切り出したアプリはビルドできません。**
基盤を `workspace:*` ではなくレジストリから取るためです。

---

## 手順

### 1. 新しいリポジトリを作る

GitHub で `app-line-console` を作ります（**private**）。

### 2. ファイルを移す

```bash
# 新リポジトリの中で
mkdir app-line-console && cd app-line-console
git init

# アプリの中身をそのまま持ってくる（apps/line-console/ の直下が root になる）
cp -r ../platform/apps/line-console/* .
cp -r ../platform/apps/line-console/.* . 2>/dev/null || true
```

**移るもの**: `src/` `prisma/` `docs/` `next.config.mjs` `postcss.config.mjs`
`prisma.config.ts` `tsconfig.json` `package.json` `README.md` `HANDOVER.md`

### 3. 基盤から受け継ぐ設定を持ってくる

アプリは基盤の設定ファイルを**相対パスで参照していました**。単独では動きません。

| ファイル | どうするか |
|---|---|
| `tsconfig.base.json` | **コピーする**（`tsconfig.json` の `extends` が `../../` を指している） |
| `eslint.config.mjs` | コピーする（アプリ用に削れる部分は削る） |
| `.npmrc` | **コピーして、GitHub Packages の行を足す**（下記） |
| `.gitignore` | コピーする |

`tsconfig.json` の `extends` を直します。

```diff
- "extends": "../../tsconfig.base.json"
+ "extends": "./tsconfig.base.json"
```

`next.config.mjs` の `outputFileTracingRoot` も直します。

```diff
- outputFileTracingRoot: path.join(__dirname, "../.."),
+ outputFileTracingRoot: __dirname,
```

### 4. `.npmrc` にレジストリを書く

```ini
# 基盤パッケージは GitHub Packages から取る
@mtmk-cc:registry=https://npm.pkg.github.com

# 依存の巻き上げを抑える（基盤と同じ方針）
auto-install-peers=true
strict-peer-dependencies=false
```

**認証が要ります。** 手元では次のどちらかです。

```bash
# 方法 A: gh CLI（推奨。トークンをファイルに書かない）
gh auth login
gh auth setup-git

# 方法 B: 個人アクセストークン（read:packages 権限）
npm login --scope=@mtmk-cc --registry=https://npm.pkg.github.com
```

CI では `secrets.GITHUB_TOKEN` を `NODE_AUTH_TOKEN` に渡します。

### 5. `package.json` の依存を書き換える

`workspace:*` を版の指定に変えます。

```diff
  "dependencies": {
-   "@platform/ui": "workspace:*",
-   "@platform/auth": "workspace:*",
+   "@mtmk-cc/ui": "^2026.8.0",
+   "@mtmk-cc/auth": "^2026.8.0",
```

**`line-console` は 20 パッケージに依存しています。** 手で書くと漏れるので、
機械的に置換してください。

```bash
node -e '
const fs = require("fs");
const p = JSON.parse(fs.readFileSync("package.json", "utf8"));
const V = "^2026.8.0";
for (const [k, v] of Object.entries(p.dependencies ?? {})) {
  if (typeof v === "string" && v.startsWith("workspace:")) p.dependencies[k] = V;
}
fs.writeFileSync("package.json", JSON.stringify(p, null, 2) + "\n");
'
```

**スコープの改名が済んでいれば**、名前はすでに `@mtmk-cc/*` になっています。

### 6. 動かす

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm dev
```

### 7. CI を置く

`platform` の `.github/workflows/ci.yml` を写し、**基盤自身を見る検査は外します**
（`tools/` はアプリ側に無いため）。残すのは:

- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`

`.npmrc` の認証は、`actions/setup-node` の `registry-url` と
`NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` で通ります。

### 8. 基盤側から消す

**動くことを確かめてから**にしてください。

```bash
cd ../platform
rm -rf apps/line-console
# package.json の dev:line-console などのスクリプトも消す（check-doc-commands が拾います）
node tools/gen-all.mjs
pnpm check
```

---

## 詰まりやすいところ

**「基盤を直したのに、アプリに反映されない」**

これは**壊れているのではなく、そういう設計になりました**（ADR-0026）。
基盤を直したら、タグを打って publish し、アプリ側で更新します。

```bash
# アプリ側
pnpm outdated              # どれが古いか見る
pnpm update "@mtmk-cc/*"   # 最新に上げる
```

**「型は通るのに実行時に落ちる」**

基盤の版がアプリごとに違うと起きます。`pnpm list @mtmk-cc/core` で
**実際に入っている版**を確かめてください。

**「`@mtmk-cc/xxx` が見つからない」**

`.npmrc` の行か、認証が無い状態です。`npm whoami --registry=https://npm.pkg.github.com`
で確かめられます。

---

## 移したあと、基盤側で見えなくなること

**`api-surface.mjs` の影響範囲が分かりません。**

いまは「消した API を**どのアプリが使っているか**」まで出せますが、
アプリが別リポジトリになると**基盤からは見えません**。

代わりに次の形になります。

1. 基盤の CI が「公開 API を消した／改名した」ことを検出（これは残ります）
2. **アプリ側が版を上げたときに、そのアプリの CI で気づく**

つまり**気づくのが遅くなります**。破壊的変更をするときは、
`docs/HISTORY.md` に書いて、更新の案内を出してください。
