# 展開したあとに必ず実行すること

**この ZIP だけでは直りません。** ZIP はファイルを置くだけで、
npm からパッケージを取得することも、キャッシュを消すこともできません。

```powershell
# 1. dev サーバーを止める（Ctrl+C）★これをしないと 2 も 3 も失敗します

# 2. 依存を取得する（package.json に書いてあるだけの状態から、実体を入れる）
pnpm install

# 3. Turbopack のキャッシュを捨てる ★これが今の症状の本命
Remove-Item -Recurse -Force demos\showcase\.next

# 4. 起動
pnpm dev:demos          # http://localhost:3001
```

## なぜ「3」が本命なのか

エラーの Require stack がこれを指しています：

```
- C:\...\demos\showcase\.next\dev\build\postcss.js
```

`.next` の中の、**Turbopack が生成したファイル**です。
これはプラグインがまだ無かった頃に作られたもので、Turbopack は PostCSS の
解決結果をキャッシュします。あとから `pnpm install` しても、
**キャッシュを消すまで「モジュールが無い」と言い続けます**。

`Test-Path demos\showcase\node_modules\@tailwindcss\postcss` が `True` を返す、
つまり**パッケージは既にそこにある**のにエラーが出ている、というのが何よりの証拠です。

## それでも直らない場合

`demos\showcase` の中で実行して、結果を教えてください：

```powershell
cd demos\showcase
node -e "console.log(require.resolve('@tailwindcss/postcss'))"
```

| 結果 | 意味 |
|---|---|
| パスが表示される | Node からは見えている → Turbopack 側の問題。切り分けが変わります |
| `MODULE_NOT_FOUND` | pnpm の解決の問題 → `pnpm install` が効いていません |

## この ZIP に入っている Tailwind 関連の変更

| ファイル | 内容 |
|---|---|
| `package.json`（ルート） | `tailwindcss` / `@tailwindcss/postcss` を devDeps に |
| `demos/showcase/package.json` | 同上 |
| `demos/showcase/postcss.config.mjs` | 新規 |
| `demos/showcase/src/app/globals.css` | 新規（`@import "tailwindcss"` + `@source`） |
| `demos/showcase/src/app/layout.tsx` | `import "./globals.css"` |
| `packages/ui/src/styles/tokens.css` | 孤児だった `.platform-dashboard` を統合 |

ルートと showcase の両方に依存を書いているのは、`demos/showcase/next.config.mjs` の
`turbopack.root` がモノレポのルートを指しており、Turbopack が PostCSS プラグインを
そこから解決する可能性があるためです（`.npmrc` が巻き上げを抑えているので、
ルートに宣言が無いとルートの `node_modules` に現れません）。

## 削除が必要なファイル（ZIP では消せません）

```powershell
git rm packages/ui/src/tokens.css        # 孤児。styles/tokens.css に統合済み
```

## コミット

```powershell
git add package.json demos/showcase/package.json pnpm-lock.yaml
```

**`pnpm-lock.yaml` を必ず含めてください。**
`amplify.yml` は `pnpm install --frozen-lockfile` を使うので、lock が古いと即失敗します。

## ⚠️ この ZIP の基点について

基点は **あなたがアップロードした platform-main.zip** です。
そのあとあなたが作った `5345a22` 以降のコミットは含まれていません。

**展開後、必ず `git diff` で確認してください。** 意図しない巻き戻しがあれば
`git checkout HEAD -- <ファイル>` で個別に戻せます。

## まだ残っている既知の問題

1. **`1ed2b55` の 32 ファイルが未復旧**（`git checkout 1ed2b55 -- ...`）。
   `session` / `storage` / `ui` の 16 ファイルに型エラーが残っており、
   `pnpm build` は通りません（`pnpm dev` は型検査をしないので動きます）。
2. `pnpm build` 全体は未検証です。この環境では `@types/react` が無く実行できません。
