# pnpm コマンド早見表

よく使う pnpm スクリプトの一覧です。`pnpm <コマンド>` で実行します。

## セットアップ・診断

| コマンド | 説明 |
|---|---|
| `pnpm setup` | 開発環境の初期構築（.env・DB・install・スキーマ適用まで） |
| `pnpm doctor` | 環境診断。Node/pnpm/Docker/.env/生成物 drift を読み取りだけでチェック |
| `pnpm db reset <app>` | **データを全部消してスキーマを作り直す**(開発用)。本番では動かない。そのあと `pnpm seed` | — |
| `pnpm dev:clean <app>` | **`.next` を消してから起動**。「直したのに反映されない」「Hydration failed」が出たとき | — |
| `pnpm seed` / `pnpm seed <app>` | **開発用のダミーデータ投入**。すべて架空。本番では止まる。既にデータがあれば何もしない |
| `pnpm drill` / `pnpm drill:dry` | **復元訓練**。ダンプ→新しい空 DB へ復元→件数照合まで自動。`:dry` は何をするか見るだけ(DB 不要) |
| `pnpm fresh` | node_modules を消して再インストール（依存が壊れたとき） |
| `pnpm clean` | dist / .next / .turbo / node_modules を全削除 |
| `pnpm clean:build` | ビルド成果物（dist/.next/.turbo）のみ削除。node_modules は残す |

## 開発サーバ

| コマンド | 説明 | ポート |
|---|---|---|
| `pnpm dev` | **全アプリを一斉起動**（ポートは重複しないよう固定済み） | 3000〜3004 |
| `pnpm dev:internal` | 社内アプリ | 3000 |
| `pnpm dev:showcase` | 基盤ショーケース | 3001 |
| `pnpm dev:crud` | CRUD テンプレート | 3002 |
| `pnpm dev:site` | 公開サイト | 3004 |

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
| `node tools/preflight.mjs --json` | 結果を**機械可読**で出す（落ちた検査の名前と出力だけ）。**AI のエージェントに「直す → もう一度回す」を回させる**ときに使う。人向けの出力はそのまま出ます |
| `node tools/rename-scope.mjs` | スコープ改名の**下見**（`@platform/` → `@mtmk-cc/`）。**一度きりの作業**（ADR-0026）<br>`--apply` で実行。**先に commit して、作業用ブランチで走らせてください** |
| `node tools/prepare-publish.mjs --version 2026.8.0` | publish 直前に `package.json` を配れる形へ整える。**CI の中だけ**で使い、**コミットに戻さないこと**（`workspace:*` が消えて開発が遅くなります） |
| `pnpm test` | ユニットテスト（vitest） |
| `pnpm e2e` | E2E（Playwright）。`pnpm e2e:ui` で UI モード |
| `pnpm loadtest -- --url ... --dry` | 負荷テスト（`--dry` はネットワーク不要の動作確認） |
| 業務パターンの負荷試験 | `packages/loadtest`(`pnpm loadtest`)（朝の打刻・経費ラッシュ等）。[TESTING_GUIDE](TESTING_GUIDE.md) 参照 |

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

## 探す・作る

| コマンド | 何をするか |
|---|---|
| `pnpm advisor find "二重送信"` | **やりたいことを日本語で**探す(関数・型の説明まで見る)。**新しく作る前に必ず** |
| `pnpm advisor dup` | 同名・類似の関数を洗う(**同名だから問題ではなく、挙動が違うと問題**) |
| `pnpm new-app <名前> "<説明>"` | アプリの雛形を作る(`crud-template` のコピー) |<br>**作ったあとは `pnpm gen:all` を流すこと**——資料と索引はアプリの一覧から生成しているので、忘れると `pnpm check` が落ちます
| `pnpm new-app --list` | **選べる機能と部品の一覧**（機能 26 = 繋ぎ方の見本つき / 部品 60 = 依存だけ）。`--features=login,pkg:address` で指定できます |
| `pnpm docs:platform` | 基盤の目録を作り直す |
| `pnpm docs:apps` | アプリ・デモの一覧を作り直す |
| `pnpm gen:docs-index` | 資料の索引を作り直す |

## ビルドの使い分け

| コマンド | いつ使うか |
|---|---|
| `pnpm build` | 通常。turbo のキャッシュが効く |
| `pnpm build:no-turbo` | **キャッシュを疑うとき**(「直したのに直らない」場合) |
| `pnpm dev:no-turbo` | 同上(開発サーバ) |
| `pnpm check:build` | ビルドが通る前提が揃っているか(**依存を入れずに**確認) |
| `pnpm check:deps` | 循環依存・層破り |
| `pnpm test:coverage` | カバレッジを計測する(`coverage/` に出力。**下限の判定に要る**) |
| `pnpm check:coverage` | カバレッジが前回より下がっていないか(下限は `tools/coverage-floor.json`) |
| `pnpm check:licenses` | **配布できないライセンス**（GPL / AGPL 等）の依存が混ざっていないか。`--list` で内訳、`--set-allow` で確認済みを記録 |
| `pnpm check:bundle` | **画面を開くのに読み込む JS の量**が増えていないか（`pnpm build` の後）。`--list` でページ別、`--set-limit` で上限を刻む |
| `pnpm sbom` | **部品表**（CycloneDX）を `docs/platform/` に出す。調達審査の提出用・脆弱性の影響調査用 |
| `pnpm check:mail-dns` | **メールが迷惑メール扱いされないか**（SPF / DKIM / DMARC を DNS から確認）。`<ドメイン>` を渡すか `.env` から自動判定 |
| `pnpm check:incubating` | **incubating の棚卸し**。`--list` で実戦利用つき一覧、`--mark-reviewed` で見直しを記録 |
| `pnpm check:indexes` | **他テーブルの ID を指す列に索引があるか**。`--list` で一覧、`--set-limit` で上限を刻む |
| `pnpm check:loops` | **ループの中で DB を呼んでいないか**。`--list` で一覧、`--set-limit` で上限を刻む |
| `pnpm check:safety` | **安全に関わる部品が繋がっているか**（`--list` で被覆、`--set-floor` で下限更新） |
| `pnpm check:app-ci` | 各アプリが自分の CI を持っているか（`--list` で一覧） |
| `pnpm check:schema-types` | schema の型の落とし穴と金額の入口（`--list` で該当箇所、`--set-limit` で上限更新） |
| `pnpm check:input-validation` | API の入力検証の被覆（`--list` で未検証の一覧、`--set-floor` で刻み直す） |
| `pnpm check:unreachable` | 実装があるのに公開されていないファイル（`--list` で一覧） |
| `pnpm verify:apps` | **アプリを見る検査だけ**を回す（基盤自身を見る 22 件を飛ばす。実測 6 分 → 2 分 40 秒） |
| `pnpm check:api` | 公開 API の破壊的変更 |
| `pnpm i18n:check` | 翻訳の抜け |

## 個別のアプリ

| コマンド | 何をするか |
|---|---|
| `pnpm dev:line` | LINE 連携の管理画面 |
| `pnpm seed:line` | その初期データ |
| `pnpm check:showcase` | 基盤ポータルの整合 |
| `pnpm apps` | アプリの一覧を出す |

## 残債の推移を見る

```bash
pnpm debt          # いまの残債と、前回からの増減
pnpm debt:record   # いまの値を記録する（日次で 1 件）
```

**上限方式の検査（見た目の直書き・並び順の指定漏れなど）が
増えているか減っているか**が分かります。記録は `ops/debt-history.json` です。

**増えていたら、直す前に「なぜ増えたか」を見てください**——
新しいアプリを足したなら当然増えます。**そうでないのに増えていたら、
上限に甘えている**ことになります。

**減ったら上限も下げてください**（`--set-limit`）。
下げないと**また増やせてしまいます**——smoke が
「上限と現在値が一致しているか」を見張っています。

## `pnpm suggest <やりたいこと>` — 基盤にある機能を探す

```bash
pnpm suggest 経費の申請
pnpm suggest 郵便番号の検証
pnpm suggest "Excel で出したい"
```

**119 個あると、あることを知らずに作り直します。**
**探せないものは、無いのと同じ**です。

**見つかると、こう出ます**:

```
@platform/address
  住所と郵便番号（正規化・検索）。入力の揺れを吸収します。
  import { normalizeZipcode, isValidZipcode } from "@platform/address";
  見本: pnpm dev:showcase → /toolbox
  詳しく: packages/address/README.md
```

**見本があるなら、読むより見た方が早い**です——**動くものを触れば、使い方がすぐ分かります**。

**業務の言葉で探せます**——「経費」「請求」「勤怠」「予約」。
`tools/suggest.mjs` に**言葉とパッケージの対応表**があります。

**探して見つからなかったら、対応表に足してください。**
**次の人が同じことで迷いません**——それがこの表の価値です。

**見つからなくても「無い」とは限りません**——
`docs/ai/module-list.md` を目で見るか、`pnpm dev:showcase`で探してください。
