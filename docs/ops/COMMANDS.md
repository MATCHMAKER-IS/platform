# pnpm コマンド早見表

よく使う pnpm スクリプトの一覧です。`pnpm <コマンド>` で実行します。

## セットアップ・診断

| コマンド | 説明 |
|---|---|
| `pnpm setup` | 開発環境の初期構築（.env・DB・install・スキーマ適用まで） |
| `pnpm doctor` | 環境診断。Node/pnpm/Docker/.env/生成物 drift を読み取りだけでチェック |
| `pnpm fresh` | node_modules を消して再インストール（依存が壊れたとき） |
| `pnpm clean` | dist / .next / .turbo / node_modules を全削除 |
| `pnpm clean:build` | ビルド成果物（dist/.next/.turbo）のみ削除。node_modules は残す |

## 開発サーバ

| コマンド | 説明 | ポート |
|---|---|---|
| `pnpm dev` | **全アプリを一斉起動**（ポートは重複しないよう固定済み） | 3000〜3005 |
| `pnpm dev:internal` | 社内アプリ | 3000 |
| `pnpm dev:demos` | 基盤ショーケース（デモ） | 3001 |
| `pnpm dev:crud` | CRUD テンプレート | 3002 |
| `pnpm dev:equipment` | 備品管理 | 3003 |
| `pnpm dev:site` | 公開サイト | 3004 |
| `pnpm dev:portal` | 基盤ポータル | 3005 |

> ポートは各アプリの `package.json`（`next dev --port XXXX`）で固定しています。重複や記載漏れは `node tools/check-ports.mjs`（preflight に同梱）が検出します。

## 検証（コミット前・CI 前）

| コマンド | 説明 |
|---|---|
| `pnpm check` | 型 + lint + smoke をまとめて実行（ローカルの最終確認） |
| `pnpm smoke` | 依存不要のロジック検証（速い・全 900+ 項目） |
| `pnpm typecheck` | 型チェック |
| `pnpm lint` | ESLint |
| `node tools/check-tsdoc.mjs` | 公開 API の TSDoc 網羅性（`<package>` で詳細） |
| `pnpm verify:offline` | preflight（21 個の検査を一括。内訳は `docs/ops/CHECKS.md`） |
| `pnpm test` | ユニットテスト（vitest） |
| `pnpm e2e` | E2E（Playwright）。`pnpm e2e:ui` で UI モード |
| `pnpm loadtest -- --url ... --dry` | 負荷テスト（`--dry` はネットワーク不要の動作確認） |
| 業務パターンの負荷試験 | `demos/loadtest-scenarios`（朝の打刻・経費ラッシュ等）。[TESTING_GUIDE](TESTING_GUIDE.md) 参照 |

## 生成物・ドキュメント

| コマンド | 説明 |
|---|---|
| `pnpm gen:all` | 全生成物を正しい順で再生成し、drift ゼロを確認（2 パス） |
| `pnpm gen:portal-reference` | 基盤ポータルの API リファレンスを再生成（`gen:all` に含まれる。**TSDoc を直したら実行**） |
| `pnpm gen:site` | リファレンスサイト（docs/site/*.html）を生成 |
| `pnpm site` | サイト生成 + 開き方を案内 |
| `pnpm gen:erd` | ER 図（Mermaid）を生成 |
| `pnpm gen:appmap` | 各アプリの画面・API 一覧を生成 |
| `pnpm gen:depgraph` | パッケージ依存グラフを生成 |
| `pnpm gen:reference` | API リファレンス JSON を生成 |

## 基盤（packages/）を変更したとき

| コマンド | 説明 |
|---|---|
| `pnpm platform:check` | 基盤の変更を確認（**削除した API を誰が使っているか**まで表示）。読み取りのみ |
| `pnpm platform:sync` | 生成物と API スナップショットを更新。その後 `pnpm typecheck` で影響を確認 |

> モノレポなのでアプリは常にローカルの `packages/` を直接使います（`workspace:*`）。install も再ビルドも不要です。バージョン管理をしない理由は [ADR 0011](../adr/0011-no-versioning-monorepo.md)。

## パッケージ操作

| コマンド | 説明 |
|---|---|
| `pnpm scaffold <name> "<説明>"` | 規約に沿った新パッケージの雛形を生成 |
| `pnpm test:pkg <name> test` | 特定パッケージのテストだけ実行（例: `pnpm test:pkg @platform/utils test`） |
| `pnpm outdated` | 依存の更新可能なものを確認（変更はしない） |
| `pnpm deps:why <pkg>` | なぜその依存が入っているかを表示 |

## データベース（ローカル Docker）

| コマンド | 説明 |
|---|---|
| `pnpm db:up` | PostgreSQL + Mailpit を起動 |
| `pnpm db:down` | 停止 |
| `pnpm db:reset` | 停止 → 起動（作り直し） |
| `pnpm db:psql` | psql に接続 |

## そのほか

| コマンド | 説明 |
|---|---|
| `pnpm mcp` | 社内データの MCP サーバを起動 |
| `pnpm mcp:catalog` | **基盤カタログ MCP** を起動（AI から `search_platform` で基盤を検索。[詳細](../ai/mcp-catalog.md)） |
| `pnpm ws:demo` | WebSocket デモサーバ |
| `pnpm changeset` | リリース用の変更セットを作成 |

> 迷ったら `pnpm doctor` で現状確認、`pnpm check` で壊れていないか確認、が基本の流れです。

## リファレンスサイトの公開

main に push すると `pages.yml` ワークフローがリファレンスサイトを GitHub Pages に自動公開します。手元で確認するには `pnpm site`。
