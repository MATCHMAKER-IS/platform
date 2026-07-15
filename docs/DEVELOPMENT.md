# 開発・テスト・デバッグ(Cursor)

Cursor(VS Code 互換)での開発手順。`.vscode/` に設定済みです。

## セットアップ
```bash
corepack enable
pnpm install
cp .env.example .env      # 必要な環境変数を設定
```
推奨拡張は初回に通知されます(`.vscode/extensions.json`): Vitest / ESLint / Prettier / Tailwind / Prisma / Playwright / Pretty TS Errors。

## よく使うコマンド
| 目的 | コマンド |
| --- | --- |
| 開発サーバ(デモ) | `pnpm --filter @demos/showcase dev` |
| 全テスト | `pnpm -r test`(または Vitest ワークスペース `pnpm test`) |
| 依存不要スモーク | `pnpm smoke` |
| 型チェック | `pnpm -r typecheck` |
| Lint | `pnpm -r lint` |
| 一括検証 | `pnpm verify`(typecheck + test + build) |

## テスト
- 各パッケージに `*.test.ts`(Vitest)。`vitest.workspace.ts` で全体をまとめて実行・検出します。
- Cursor の **Testing** サイドバー(Vitest 拡張)からテスト単位で実行・デバッグできます。
- 外部依存(DB/ネットワーク)無しで動く軽量検証は `tools/smoke.mjs`(`pnpm smoke`)。CI でも実行します。

## デバッグ(F5)
`.vscode/launch.json` に構成済み:
- **Debug: 現在のテストファイル (Vitest)** — 開いている `*.test.ts` にブレークポイントを置いて F5。
- **Debug: 全テスト (Vitest)** — 全テストをデバッガ接続で実行。
- **Debug: スモークテスト** — `tools/smoke.mjs` をデバッグ。
- **Debug: Next.js (server-side)** — アプリのサーバ側をデバッグ(ブラウザも自動起動)。
- **Attach: 実行中の Node (--inspect)** — `node --inspect ...` で起動したプロセスに 9229 で接続。

### クライアント側(ブラウザ)のデバッグ
Next.js の構成起動後、Chrome DevTools か Cursor の JS デバッガでブレークポイントを設定できます。
React コンポーネントはソースマップ付きでそのままステップ実行できます。

## E2E テスト(Playwright)
```bash
pnpm exec playwright install   # 初回のみ
pnpm e2e                        # showcase を自動起動して検証
pnpm e2e:ui                     # UIモード
```
`e2e/*.spec.ts` に追加。詳細は `e2e/README.md`。

## ログ
`@platform/logger`(pino)を使用。開発時は見やすい整形、本番は JSON 構造化ログ。
`@platform/context` の AsyncLocalStorage でリクエスト ID をログに自動付与できます。

## トラブルシュート
- 型が古い場合は Cursor の「TypeScript: Restart TS Server」。
- `pnpm install` 後に workspace の型が解決しない場合は各パッケージを一度 `pnpm -r build`。

## 多言語(i18n)

- 翻訳文言は `packages/i18n/src/catalogs/{ja,en,zh,ko}.ts`(言語別)。
- 使用キーの網羅チェック: `pnpm i18n:check`(未定義キー・ロケール欠落を検出、CIで実行)。
- コンポーネントは `useT()`/`useI18n()` で翻訳。金額・日付は列 `format` やレポートの `{locale}` でロケール連動。
