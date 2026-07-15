# 新しいアプリを追加する

`apps/` に新しい社内アプリを足すときの手順です。**crud-template をコピーする**のが最短で、規約に沿った状態から始められます。

## 0. その前に — 本当に新しいアプリが必要か

- **既存アプリに画面を足すだけで済まないか**（internal-app は 73 画面ある。関連機能はまとめた方が使う人に優しい）
- **基盤に足りない部品はないか** → `pnpm mcp:catalog` の `search_platform`、または [platform-portal](http://localhost:3005) で探す

分ける理由が「デプロイ単位を分けたい」「担当者が違う」「使う人が違う」のいずれかなら、新規アプリが妥当です。

## 1. ポートを決める

`node tools/check-ports.mjs` で空きを確認します。現在 3000〜3005 が使用中なので、次は **3006** です。

## 2. 雛形をコピー

```bash
cp -r apps/crud-template apps/my-app
cd apps/my-app
rm -rf node_modules .next
```

## 3. package.json を直す

```jsonc
{
  "name": "my-app",                        // ← 変更
  "scripts": {
    "dev": "next dev --port 3006"          // ← 1 で決めたポート。--port は必須
  }
}
```

> `--port` を書かないと Next.js の既定 3000 を取りに行き、`pnpm dev`（一斉起動）で internal-app と衝突します。

## 4. 中身を差し替える

crud-template には次が入っています。不要なら消し、必要なら残してください。

| ファイル | 役割 |
|---|---|
| `src/app/layout.tsx` | ルートレイアウト。**AppSkin（テーマ）と ThemeSwitcher が入っている** |
| `src/lib/theme-registry.ts` | テーマレジストリ。独自スキンはここに `register` |
| `src/server/env.ts` | 環境変数。**process.env を直接読まない**（[patterns.md #9](../ai/patterns.md)） |
| `src/app/items-client.tsx` | CRUD 画面の実例。検証・エラー表示・ソフトデリート付き |
| `src/app/api/items/route.ts` | API の実例。認可・観測・監査の型 |
| `prisma/schema.prisma` | DB スキーマ。モデルを差し替える |
| `.env.example` | 環境変数の見本。**参照する変数はすべて書く** |

## 5. ルートに登録

`package.json`（リポジトリ直下）の scripts に起動コマンドを足します。

```jsonc
{
  "scripts": {
    "dev:myapp": "pnpm --filter my-app dev"
  }
}
```

## 6. ドキュメントを更新

- `docs/APPS_AND_DEMOS.md` — ポート一覧の表と、アプリの紹介（規模・できること）
- `docs/ops/COMMANDS.md` — 開発サーバの表

> どちらも `node tools/check-ports.mjs` がポートの記載漏れ・不一致を検出します。

## 7. 検証

```bash
pnpm doctor          # 環境の確認
node tools/check-ports.mjs      # ポート重複がないか
node tools/preflight.mjs        # 全ゲート（依存境界・生成物・ポート等）
pnpm gen:all                    # 生成物（ER 図・アプリマップ）を更新
```

`gen:all` を実行すると、新しいアプリの ER 図（`docs/platform/erd/my-app.md`）と画面/API 一覧（`docs/platform/appmap/my-app.md`）が自動生成され、リファレンスサイトにも載ります。

## チェックリスト

- [ ] ポートを `check-ports` で確認し、`--port` を package.json に明記した
- [ ] `name` を変えた（crud-template のままだと workspace が衝突する）
- [ ] `src/server/env.ts` を自分のアプリの変数に直した（`process.env` 直読みをしない）
- [ ] `.env.example` に参照する変数をすべて書いた
- [ ] ルートの `dev:*` スクリプトを足した
- [ ] `docs/APPS_AND_DEMOS.md` と `docs/ops/COMMANDS.md` を更新した
- [ ] `node tools/preflight.mjs` が全緑
- [ ] `pnpm gen:all` で生成物を更新した

## よくある失敗

| 症状 | 原因 |
|---|---|
| `pnpm dev` で片方が起動しない | `--port` の書き忘れ（3000 の取り合い） |
| 型チェックが素通りする | `tsconfig.json` が無い（`check-package-shape` が検出） |
| 本番で起動しない | 秘密値が未設定/脆弱（`requireEnv` + `assertSecretStrength` が正しく落としている） |
| テーマが効かない | 色をハードコードしている → `var(--color-primary)` を使う |
