# 引き継ぐ人へ — いまどこまでできているか

この基盤を引き継ぐ／一緒に見ることになった人が、**最初に読む**ものです。

「何があるか」は他の資料にあります。ここに書くのは
**何が終わっていて、何が残っていて、どこが危ないか**です。

---

## 一言でいうと

社内アプリを作るための部品置き場（`packages/`）と、それを使ったアプリ（`apps/`）、
動く実例集（`demos/showcase`）のひとまとまりです。

**目的は「同じものを何度も作らない」こと**。それを守るために、
作法を決めて（`CLAUDE.md`）、機械が確認する（`node tools/preflight.mjs`）形にしてあります。

---

## できていること

| 領域 | 状態 |
|---|---|
| 部品 | **113 パッケージ**。会計・請求・勤怠・在庫・電帳法など日本の業務に対応 |
| アプリ | 5 つ（社内・備品・公開サイト・雛形・目録） |
| 作法の強制 | **44 種類の検査**が `preflight` で自動確認（実行 47 項目・約 15 秒） |
| テスト | smoke **1,443 件**（依存なしで動く）・単体テスト **112/113 パッケージ**（config はランタイムコード無し）・E2E 14 本 |
| 資料 | 82 件。すべて索引から辿れる |
| 認可 | API **250 本すべて**が認可を通すか、通さない理由を宣言済み |

**触る前に `node tools/preflight.mjs` を流してください。** これが緑なら、
作法・依存・資料の整合は取れています。

---

## 終わっていないこと（重要な順）

### 1. 復元訓練をしていない ⚠️

`check-drill` が警告を出し続けています。**バックアップは取れていますが、戻せるかは一度も試していません。**

> 取得だけして復元を試したことがない状態は、バックアップが無いのとほとんど同じです。

手順は `docs/ops/BACKUP_RESTORE.md` にあります。**1 時間で終わります。**
やったら `node tools/record-drill.mjs` で記録してください。

### 2. 外部サービスとの実接続を確認していない

契約テストの記録が **0 件**です（鍵が無いため）。
「モックでは通るが本物では動かない」を検出できていません。

鍵が用意できたら `docs/ops/CONTRACT_TESTING.md` の手順で記録を取ってください。

### 3. この課題を誰も試していない

`docs/ops/ONBOARDING_TASK.md` に新人向けの実地課題がありますが、**誰にも渡していません**。

1 人にやってもらい、詰まった箇所を記録すれば、**資料が実際に使えるかが分かります**。
バス係数を 1 から動かす最短の手でもあります。

---

## 意図的に残していること（直さなくてよい）

上限として記録済みで、**増えないことだけ**を守っています。

| 項目 | 数 | なぜ残しているか |
|---|---|---|
| 生タグ（`<input>` 等） | 33 | ハンドラの形が画面ごとに違う。1 件ずつ判断が要る |
| 色の直書き | 67 | **状態色は意味を固定したい**（赤が「成功」に見えるテーマを作れると事故） |
| 基盤と同名の実装 | 11 | `env()` のようにアプリ固有で妥当なものを含む |
| 自前で描いたグラフ | 4 | internal-app の 4 画面。`@platform/ui` のグラフ部品へ 1 つずつ移す（画面を動かして確認が要る） |
| 未実戦のパッケージ | 11 | どこからも import されていない。`module-list.md` とポータルに **⚠ 未実戦** と出るので、使う前に分かる |
| 長い行（200 字超） | 1,294 | 割ると意味が変わる箇所（JSX 属性・長い文章） |
| 600 行超のファイル | 6 | `utils/numbers.ts` などは関数の集まりで、分割しても探しやすくならない |

**上限を上げるときは理由をコミットに書いてください。** 検査を黙らせる操作なので、
理由が残らないと事故と区別がつきません。

---

## 危ないところ

| 場所 | なぜ危ないか |
|---|---|
| `@platform/core` | **多数のパッケージが依存**（実測は check-core-signatures が示す）。引数を変えるだけで全体が壊れる（`check-core-signatures` が守っている） |
| `tools/smoke.mjs` | 12,000 行超。**227 の `section()` で区切ってある**ので検索で辿れる |
| パッケージの追加 | smoke 側の展開・パッケージ数の更新など**5 か所**の更新が要る（`docs/ops/PACKAGE_CONSOLIDATION.md`） |
| 数値の一括置換 | `108` を一括で置換して**給与計算の期待値を壊した**ことがある。文脈を限定すること |
| オブジェクトのスプレッド順 | `{ 既定値, ...options }` は `{ key: undefined }` の指定で**既定値が消える**。2026-07 に context・status-page(7 関数)・sheet-grid の z-index で**3 系統**見つかった |
| 型定義を持たない外部パッケージ | `ffprobe-static` のように `@types/*` も同梱型定義も無いものがある。`TS7016` で**ビルドだけが落ちる**（テストは通る）。`packages/<pkg>/src/<name>.d.ts` に `declare module` で宣言する（前例: `barcode/src/bwip-js.d.ts`・`media/src/ffprobe-static.d.ts`）。**トップレベルの import/export を書かないこと**（書くと既存モジュールの拡張になり宣言にならない）|
| smoke のスタブは実装と揃える | smoke は依存を避けるため一部をスタブ化するが、**署名が古いまま緑になる**ことがある。`workedMinutes` は本物が 1 引数なのにスタブが 3 引数で、**実装と違う形を検査していた**。スタブを書き換えたら本物の署名と突き合わせる |
| ビルドに接続情報を要求しない | `next build` はページデータ収集で env モジュールを読むため、`DATABASE_URL` を必須にすると**ビルドマシンに接続情報を置くまでビルドできない**。`requiredAtRuntime(runtime, build)` でビルド中だけ既定値にする（実行時の検証はそのまま） |
| 本番「実行」と本番「ビルド」は別 | `next build` は `NODE_ENV=production` で動き、ページデータ収集のため env モジュールを読む。`NODE_ENV === "production"` で秘密値を必須にすると、**ビルドマシンに本番の秘密を置くまでビルドできない**。`@platform/env` の `isProductionRuntime()` を使う（`NEXT_PHASE=phase-production-build` を除外する）|
| 相対 import に拡張子を書かない | `moduleResolution: "Bundler"` なので `.js` は不要。付けると **`tsc` は通るのに `next build` だけが落ちる**（実体は `.ts`）。Node の ESM 流儀と混ざりやすい。`check-build-ready` の `[A3]` が検出する |
| 環境変数はスキーマに無いものもある | `crud-template` の `PERSISTENCE` は `env` のスキーマに入れず、**真偽値 `usePrisma` として公開**している（`server/env.ts`）。`env.PERSISTENCE` と書くと `TS2339`。**生の環境変数を直接見ない**のがこの基盤の作法 |
| React フックを使うファイルは `"use client"` | 無いとサーバコンポーネントから import されたときに落ちる。**型検査は通る**ので `next build` まで気づけない。`mobile/hooks.ts` と `form/use-submit-flow.ts` が該当した。`check-build-ready` の `[A5]` |
| `app/robots.ts` などは `default` export | Next は `robots` / `sitemap` / `manifest` を**メタデータファイル**として扱い、`default` を要求する。`GET` を書くと落ちる（型検査は通る）。`check-build-ready` の `[A6]` |
| Next 16 は `proxy.ts`（旧 `middleware.ts`）| 改称されたので**両方あるとビルドが落ちる**。`internal-app` は中身の違う 2 つが並存していた（`middleware.ts` にメンテナンスゲート、`proxy.ts` にヘッダ付与だけ）。`check-build-ready` の `[A4]` が検出する |
| サブパス import は `exports` に載っているものだけ | `@platform/ui/styles/tokens.css` のように**存在しないサブパス**を書くと、**型検査は通るのに `next build` だけが落ちる**（Module not found）。正しくは `@platform/ui/tokens.css`。`check-build-ready` の `[A2]` が検出する |
| `createSearch` に渡すのは `SearchAdapter` | `createBm25Index()` は**同期 API** で渡せない。`createMemorySearch()` が BM25 のラッパー（非同期・Result）なのでそちらを使う |
| OGP は `buildMeta` とは別 | `MetaInput` に `openGraph` は無い。`buildOpenGraphTags()`（`@platform/seo` の open-graph）で作り、`renderMetaTags([...meta.tags, ...og])` と連結する |
| 同名の部品が 2 つあることがある | `@platform/ui` の `StatCard` は **2 種類**。主（`dashboard.tsx`／`delta` `trend` `format`）と `SimpleStatCard`（`stat-card.tsx`／`hint` `href`）。`hint` を使うなら後者。`balance-app` が間違えていた |
| README の書き方に従う | `createFreeeClient({ accessToken: "", fetchImpl: createFreeeAuthedFetch(tokens) })` が正しい形（`Authorization` は fetch 側が毎回付け直すので `accessToken` は使われない）。`balance-app` は fetch を直接渡していて型が合わなかった。**README に正解が書いてある** |
| `React` import は `jsx` 設定で変わる | `packages/ui` は `jsx: "react-jsx"` なので **JSX だけなら import 不要**（書くと `TS6133`）。ただし `React.ReactNode` を使うなら必要。アプリは `jsx: "preserve"` で**同じコードがエラーにならない**ので混同しやすい。2026-07 に ui で未使用 23 件・不足 3 件が同時に見つかった。`check-react-import` で守る |
| Result は一度変数に受ける | `f().ok && f().value` と**同じ呼び出しを 2 回書くと絞り込みが効かない**（別の式なので `Err` の可能性が残り `TS2339`）。API を 2 回呼ぶので**呼び出し回数も 2 倍**になる。`check-result-narrowing` で守る |
| DOM の型はサーバ側で使えない | 共通設定の `lib` は `["ES2022"]` で DOM を含まない。`BlobPart` `BodyInit` `RequestInit` などを書くと `TS2304` で**ビルドだけが落ちる**（**vitest は型を見ないのでテストは全部緑**）。**自分の tsconfig に DOM があっても安全ではない**: パッケージ間はソースを直接 import するので、DOM 無しの利用側で型検査される（`integrations`(DOM あり)を `ekyc`(DOM なし)が使って落ちた）。代替は `new Blob([new Uint8Array(bytes)])` / `FormData \| string` / `Parameters<typeof fetch>[1]`。**`new Uint8Array()` で包むこと**: TS 5.7 以降 `Uint8Array` は裏付けバッファでジェネリックになり、DOM 側は ArrayBuffer 裏付けを要求するため `Uint8Array<ArrayBufferLike>` は `TS2322` で弾かれる。`check-dom-lib` で守る |
| Windows のパス長 260 文字 | pnpm は `.pnpm/<pkg>@<版>_<ハッシュ>/node_modules/...` と**非常に深い階層**を作る。113 パッケージでは簡単に超える。2026-07 に実測 265 文字で踏んだ。対処は `LongPathsEnabled=1`（管理者権限・要再起動）。`node tools/check-path-length.mjs` が測る |
| turbo が Windows で動かない（**未解決**）| `turbo run build` / `dev` が `0xC0000409`（スタック破壊）で**タスクを 1 つも実行せず、ログも出さずに落ちる**。`ui: stream`・`--concurrency=1`・`LongPathsEnabled=1` のいずれでも変わらない（パス長が原因ではなかった）。**回避策**: `pnpm build:no-turbo` / `pnpm test:no-turbo` / `pnpm dev:no-turbo`。デプロイ（Amplify・Linux）は `demos/showcase` だけをビルドするので影響なし |
| Docker が要るテストは通常実行から外す | `*.integration.test.ts` は testcontainers で実 PostgreSQL を起動する。共通プリセットの `exclude` で外し、`pnpm --filter @platform/db test:integration` で明示的に実行する |
| Prisma の Json 列には `toJson()` | `InputJsonValue` は**索引シグネチャを要求する**ため、`interface Theme` のような名前付きの型やその配列はそのまま入らない。`@platform/db` の `toJson()` で包む（実行時は素通し）。読み出しは `as unknown as T` を挟む |
| トランザクション内のモデルは型が付く | `withTransaction(db, fn)` の `tx` は**クライアントの型から導かれる**（`TransactionClientOf`）。`createDb<PrismaClient>()` で自分の生成物を渡していれば `tx.expense` に型が付く |
| pnpm は未宣言の依存を解決しない | `prisma generate` を動かすパッケージは `@prisma/client` と `prisma` を**自分で宣言する**。基盤が持っていても届かない（`Could not resolve @prisma/client`）。`check-test-setup` が検出する |
| Prisma の生成物はアプリごとに分ける | `output` を書かないと全アプリが `node_modules/@prisma/client` を奪い合い、**同時に 1 アプリしか型が通らない**。`createDb<PrismaClient>()` に自分の生成物の型を渡す。基盤は `RawCapableClient` など**必要な形だけ**を要求する（ADR-0006 の追記）|
| Prisma 7 は CLI と実行時で設定が別 | `schema.prisma` に `url` を書けない(`P1012`)。CLI は `prisma.config.ts`、実行時は `createDb()` → アダプタ。**片方だけ直すと generate は通るのに動かない**。`prisma generate` は `build` の前段なので、放置すると**デプロイも落ちる** |
| vitest と Playwright の住み分け | `.test.ts` は vitest、`.spec.ts` は Playwright。vitest の既定 include は両方拾うため、`Playwright Test did not expect test.describe()` で落ちる。`vitest.preset.mjs` で `.test.ts` だけに絞ってある |
| Prisma の生成物 | `@prisma/client` は `prisma generate` 前だと **import した時点で落ちる**。`pnpm test`(turbo)なら先に生成されるが、`pnpm exec vitest run` を直接叩くと生成されない |
| API の例外は投げ返さない | `withApiObservability` は例外を **traceId つきの 500 に変換して返す**。素で投げると Next 既定の 500 画面になり、traceId が返らず調査できない。内部メッセージも漏らさない(`toErrorEnvelope`)|
| BM25 は短い文書を高く評価する | 同じ語を同じ回数含むなら**短いほうが上**(文書長正規化)。「請求書」で「経費と請求書」が「請求書の書き方」より上に出る。仕様どおりなので、タイトル一致を優先したいなら `fieldBoosts` を使う |
| ローカル時刻と UTC の混在 | `new Date(y, m, d)` はローカル、`toISOString()` は UTC。混ぜると **JST 機だけ日付が 1 日ずれる**。`@platform/invoice` の `endOfNextMonth` が該当し、**支払期日が 1 日早く**なっていた。CI は UTC なので**絶対に検出できない**。日付だけの値は `Date.UTC` で揃える |
| テストが「動かない」形で壊れる | `pnpm test` は**一度も成功していなかった**。① ワークスペースがディレクトリ指定で `demos/README.md` に当たる ② 共通プリセットが `.ts` で Node が読めない ③ `@platform/ui`(83 件)と `internal-app`(16 件)の test が echo で素通り ④ `packages/form` が `@platform/config` を未宣言。**どれもテストの中身とは無関係**。`check-test-setup` で守る |
| 生成物は検査しない | Prisma の `src/generated/prisma/index.d.ts` は数万行あり、「大きいファイル」「長い行」「相対 import の `.js`」を大量に誤検知する。`tools/lib/collect-files.mjs` と `check-maintainability` が `generated` ディレクトリを除外する |
| 生成物は走査順を固定する | `readdirSync` の順序は **OS で違う**（Linux と Windows で別）。ソートせずに生成すると、内容が同じでも環境ごとに差分が出て `check-generated` が恒常的に赤くなる。`doc-sections.mts` / `gen-erd.mjs` で名前順に固定した |
| 生成コードに絶対パスを埋めない | `from "${p}"` / `JSON.stringify(p)` / `.replace("./x", p)` のどの形でも同じ問題を起こす。**`impFile` が読み込み前に全 import を検査**し、`file://` でない絶対パスを弾く。**Linux でも検出できる形**にしてある（Windows のパスだけ見ると CI で守れているつもりになる）|
| 動的 import は `file://` にする | Windows では絶対パスをそのまま `import()` できない（`C:\...` が `c:` プロトコルと解釈され `ERR_UNSUPPORTED_ESM_URL_SCHEME`）。`smoke.mjs` は `impFile()` で `pathToFileURL` を通す |
| `/tmp` を直書きしない | Windows には存在せず `C:\tmp` と解決されて `ENOENT` で落ちる。`smoke.mjs` は `tmpdir()` を使う（282 箇所が直書きだった）|
| 検査ツールの OS 依存 | `find` は Windows で別コマンド。`path.join` の `\` と `/` 前提の比較も一致しない。**どちらも「落ちる」か「黙って素通りする」**ので、Windows で一度も動いていない検査が 5 つあった（`check-syntax` を含む）。走査は `tools/lib/collect-files.mjs` を使う |
| 非同期イベントを同期的に打ち切らない | `child.on("error", …)` を登録した直後に同期で成功を確定すると、**error は必ず後から来るのでハンドラが一度も勝てない**。`os-notify` は起動失敗を検出できず、履歴も常に成功で残っていた |
| TSDoc の `@returns` を信じる前に実装を見る | 「問題の一覧(空なら妥当)」と書いてあるのに **Result を返す** `validate*` が cms に 4 つあった。配列だと思って `.length` を見ると `undefined` になり、**常に妥当と判定される**。テストを書くたびに同種の食い違いが出ている |
| 属性に入る値のエスケープ漏れ | 本文だけエスケープして**属性値を素通し**にすると、`" onload="…` で任意の属性を差し込める。`linkify` の target/rel、`watermarkTextSvg` の fontFamily/color で実際に起きていた（どちらも同じ関数内で一部だけエスケープしていた） |
| テーマの補助テキスト色 | 「薄いグレーで上品」は**見えるが読めない**。2026-07 に 11 スキン中 7 つが WCAG AA 未達だった（最低 2.83:1）。smoke の「findContrastIssues は空」で守っている |
| Fragment で包んだ子要素 | recharts のように**子要素を走査する**ライブラリでは、`<>…</>` に入れたものが見えない。グラフの軸が丸ごと消え、横棒グラフが壊れていた |
| 検査が「宣言どうし」を比べていないか | `check-app-transpile` は宣言とそこから導出した値を比べており**何も検出していなかった**（未宣言 import 19 件）。`check-api-auth` も同型。**検査を足したら、わざと壊して発火するか確かめること** |

---

## 判断の履歴

「なぜこうなっているか」は `docs/adr/` に 18 件あります。特に読む価値があるもの:

| ADR | 内容 |
|---|---|
| 0015 | パッケージを増やすか統合するかの基準 |
| 0016 | 2 要素認証は自前ログインのときだけ（SSO では IdP に任せる） |
| 0017 | 権限は付けたら終わりにしない（棚卸し・退職時の停止） |
| 0018 | 保存義務と削除要求が衝突したら保存義務を優先し、本人に説明する |

**同じ議論を繰り返さないため**に残しています。判断を変えるときは、
新しい ADR を書いて「なぜ変えたか」を残してください。

---

## 最初の 1 週間ですること

1. `pnpm install && node tools/preflight.mjs` — 緑になるか
2. `pnpm dev:showcase` — 動く実例集を一通り眺める（80 デモ）
3. `docs/ops/ONBOARDING_TASK.md` の課題をやってみる（半日）
4. **復元訓練を 1 回**（1 時間）
5. `CLAUDE.md` を読む — 作法と、その理由

## 関連

- `CLAUDE.md` — 作法（AI に読ませる前提でも書いてある）
- `docs/README.md` — 資料の索引
- `docs/ops/CHECKS.md` — 44 種類の検査が何を見ているか
- `docs/RUNBOOK.md` — 障害対応
- `docs/ops/SUPPORT_GUIDE.md` — 利用者からの問い合わせ
