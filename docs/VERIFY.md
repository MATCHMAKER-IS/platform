# 検証手順(ビルド・型・テスト・起動)

> 検査の一覧（preflight が見ている 30 個）は `docs/ops/CHECKS.md` にまとめてある。

## 前提
外部依存(React / Radix / zod / Prisma / TipTap 等)の取得に **npm レジストリへの
ネットワークアクセスが必要**です。オフライン/レジストリ遮断環境では `pnpm install`
は失敗します(例: `403 Forbidden registry.npmjs.org`)。

## 1. 依存不要スモークテスト(インストール前でも実行可)
中核ロジック(チェックディジット・Luhn・カナ判定・全角半角・クッキー・CSRF・封緘
セッション・パスワード生成・レート制限)を、外部依存なしで実行検証します。

```bash
pnpm smoke      # = node --experimental-strip-types tools/smoke.mjs
```

### 追加のオフライン静的検査(インストール不要)
依存境界(循環依存・層破り)と公開 API 破壊検知も、レジストリ無しで実行できます。

```bash
pnpm verify:offline   # = check:deps + check:api + smoke
# 個別に:
pnpm check:deps       # 内部パッケージの循環依存・層破りを検出(tools/check-deps.mjs)
pnpm check:api        # 公開 API の破壊的変更を検出(docs/platform/api-surface.json と比較)
```
これらは CI の早期ゲート(`.github/workflows/ci.yml` の boundaries ジョブ)でも実行されます。
CI 上で `pnpm install` が通る環境では、続けて下記のフル検証が走ります。
期待結果: `1243 passed, 0 failed`。実ソース(`packages/validation/src/japan.ts` 等)を
直接読み込んで検証します。CI の早期ゲートにも使えます。

## 2. フル検証(レジストリのある環境)
```bash
corepack enable
pnpm install            # 全 workspace の依存を取得
pnpm verify             # = typecheck → test → build を順に実行
# 個別に:
pnpm typecheck          # turbo: 各パッケージ tsc --noEmit
pnpm test               # turbo: 各パッケージ vitest run
pnpm build              # turbo: 各パッケージ tsc / next build
pnpm lint               # turbo: eslint(境界ルール含む)
```

## 3. デモを起動して触る
```bash
pnpm --filter showcase-demo dev      # http://localhost:3001(DB不要)
```
確認できるページ: `/`(索引)、`/register`(CSRF+住所補完フォーム)、`/ui`・`/components`
(UI 全部品)、`/files`(アップロード/ダウンロード)、`/device`(端末情報)、
`/session`・`/dashboard`(セッション/保護ページ)など。

## 4. 本番アプリ + DB(任意)
```bash
docker compose up -d                 # Postgres / Redis / Meilisearch
pnpm --filter internal-app dev       # http://localhost:3000
```

## 参考: この環境で個別検証済みのこと
- スモーク 22 項目すべて green(`pnpm smoke`)。
- 純ロジックパッケージの型チェックを個別に実施(core/http/validation/address/
  upload/session/guard/device 等を、依存を stub して `tsc --noEmit` で通過)。
- 外部依存を含むパッケージ(ui/form/media/db 等)の型・ビルドは上記 2 で実施。

## Prisma schema の軽量検査

`node tools/check-schema.mjs` で model 重複・@id 欠落・括弧不整合を検出する(prisma CLI 不要・CI にも組込済)。

## AI向けドキュメントの再生成

`node tools/gen-module-list.mjs` で `docs/ai/module-list.md`(カテゴリ別パッケージ一覧)を再生成する。パッケージ追加時に実行。

## 環境変数ドキュメントの整合

`node tools/check-env-example.mjs` — 各アプリのコードが参照する環境変数が `.env.example` に記載されているかを検査(CI 組込済)。変数を追加したら `.env.example` にも追記する。

## 開発環境のセットアップ

clone 直後は `bash scripts/setup.sh`(または `pnpm setup`)。前提確認のみは `--check`。詳細は docs/ops/SETUP.md。

## 基盤ヘルスレポート

`node tools/platform-report.mjs` で `docs/ai/platform-report.md`(パッケージ/テスト保有率/公開API/アプリ別統計)を再生成する。四半期ごと・大きな追加後に更新。
