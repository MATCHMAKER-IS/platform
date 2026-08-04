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
| 部品 | **114 パッケージ**。日本の業務(会計・請求・勤怠・在庫・電帳法)に対応。ただし**実アプリで使われているのは 69**(デモのみ 38 / 未実戦 7)|
| アプリ | **6 つ**（社内・備品・公開サイト・雛形・基盤ポータル・残高照会） |
| 作法の強制 | **47 種類の検査**が `preflight` で自動確認（実行 61 項目・約 30 秒） |
| テスト | smoke **1,400 件超**（依存なしで動く。正確な数は `pnpm smoke` の最終行）・単体テスト **112/114 パッケージ**（config はランタイムコード無し）・E2E **14 本** |
| 資料 | 83 件。すべて索引から辿れる |
| 認可 | API **252 本すべて**が認可を通すか、通さない理由を宣言済み |

**触る前に `node tools/preflight.mjs` を流してください。** これが緑なら、
作法・依存・資料の整合は取れています。

---

## 終わっていないこと（重要な順）

### 1. 復元訓練をしていない ⚠️

`check-drill` が警告を出し続けています。**バックアップは取れていますが、戻せるかは一度も試していません。**

> 取得だけして復元を試したことがない状態は、バックアップが無いのとほとんど同じです。

手順は `docs/ops/BACKUP_RESTORE.md` にあります。
**機械にできる部分は `pnpm drill` に自動化済み**なので、数分で流せます
(`pnpm drill:dry` で何をするかだけ見られます。DB も要りません)。
残るのは「アプリを起動して画面を開く」「暗号化項目が読めるか確かめる」の 2 つだけです。
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

2026-08 の時点で、多くは **0 まで減らし終わりました**。残っているのは次の 3 つだけです。

| 項目 | 数 | なぜ残しているか |
|---|---|---|
| デモでしか使われていないパッケージ | 38 | `stripe`（公式 SDK ラッパーで fetch を差し替えられず、デモも契約テストも作れない）と `testing`（テストの中から使うもの）。**理由は `module-list.md` に書いてある** |
| 長い行（200 字超） | 1,401 | 割ると意味が変わる箇所（JSX 属性・長い文章）。色を CSS 変数へ移した分だけ増えた（`text-neutral-500` → `text-[var(--color-muted)]`）|
| 600 行超のファイル | 6 | `utils/numbers.ts` などは関数の集まりで、分割しても探しやすくならない |

**0 になったもの**（増えたら検査が失敗します）:

生タグ・色の直書き（基盤とアプリの両方）・基盤と同名の実装・自前で描いたグラフ・
認可の無い API・「今」から UTC の日付を切る箇所。

**上限を上げるときは理由をコミットに書いてください。** 検査を黙らせる操作なので、
理由が残らないと事故と区別がつきません。

---

## 危ないところ

| 場所 | なぜ危ないか |
|---|---|
| `@platform/core` | **多数のパッケージが依存**（実測は check-core-signatures が示す）。引数を変えるだけで全体が壊れる（`check-core-signatures` が守っている） |
| `tools/smoke.mjs` | 12,000 行超。**227 の `section()` で区切ってある**ので検索で辿れる |
| パッケージの追加 | smoke 側の展開・パッケージ数の更新など**5 か所**の更新が要る（`docs/ops/PACKAGE_CONSOLIDATION.md`） |
| TSDoc は「完備」でも中身が合っていないことがある | `check-tsdoc` は**書いてあるかしか見ない**。2026-08 に `check-tsdoc-params` を足して測ったところ、**並び順が実装と逆の関数が 7 件**あった(`reconcile(invoices, payments)` の説明が `(payments, invoices)` など)。型が同じだと**黙って入れ替わる**。P1(並び順)は 0 を保つ。P2/P3 は上限方式 |
| ドット付きの @param は中身まで見ないと嘘が通る | `@param options.foo` は**先頭(`options`)しか照合されない**設計だと、中身が出鱈目でも通る。実際 2026-08 に機械的に寄せたら `config.dc`(正しくは `dataCenter`)が素通りした。`check-tsdoc-params` の P4 が型のプロパティまで見る |
| 文書にあるのに実装に無い機能がある | 上の検査の P2 は、単なる文書の古さではなく**「作ると書いて作らなかったもの」の一覧**でもある。例: `isBusinessDay` の `extraHolidays`(会社独自の休業日は指定できない)、`hashApiKey` の pepper(実際は素の SHA-256)。**説明を消すか、実装するかを決めること** |
| pnpm は PowerShell では「スクリプト」 | Windows の `pnpm` は corepack が置く **`pnpm.ps1`**(`Get-Command pnpm` の CommandType が `ExternalScript`)。これに **`*> $null` を付けると成功しても終了コード 1 が返る**。「`pnpm smoke` は 1640 passed なのに setup だけ失敗する」形で踏んだ。出力を捨てたいときは変数で受ける(`$null = & $cmd 2>&1`)。`\| Out-Null` は問題ない |
| PowerShell は外部コマンドの stderr で止まる | `$ErrorActionPreference = "Stop"` のとき、外部コマンドが stderr に 1 行書いただけで **PowerShell 5.1 は致命的エラーにする**。`docker info` は正常時でも `WARNING: No blkio throttle...` を出すため、**Docker が動いていても setup が落ちた**。エラー文は PowerShell 内部のもの(NativeCommandError)で Docker の問題にしか見えない。`Test-Native` / `Invoke-Native` 経由にし、成否は `$LASTEXITCODE` で見る |
| `query` のようなオブジェクトは useMemo の中で組む | 外で作ると毎描画で新しい参照になり、依存配列に入れられない。中身だけを依存に並べると `exhaustive-deps` が「足りない」と警告する。**useMemo の中で組めば**警告も消え、何に依存しているかも読み手に伝わる |
| ブラウザ向けサブパスは**バレルを経由しない** | `@platform/sms/browser` が `./index` を再 export しており、そこから twilio まで辿られて **build が落ちた**(サブパスを作ったのに意味が無い状態)。中核を `core.ts` に切り出し、バレルとブラウザ入口の**両方がそこを参照する**形にした。検査もサブパスを対象に含め、相対 export を**最後まで辿る**(1 段だけだと 2 段先を見逃す)。ただし **`import type` は追わない**(実行時に消えるため。追うと誤検出になる) |
| client から**サーバ専用パッケージ**を読むと build だけが落ちる | `bullmq` / `ioredis` / `twilio` は `node:` 接頭辞**なし**で `fs` / `net` / `dns` を require するため、`check-build-ready` の FATAL(接頭辞つき)を素通りしていた。typecheck も lint も smoke も通るのに **`next build` が 14 件のエラー**で落ちる。`@platform/jobs/browser` などのサブパスへ逃がし、検査もサーバ専用 npm パッケージを辿るよう拡張した |
| フックは早期 return より前で呼ぶ | `TimelineChart` が `if (allX.length === 0) return null;` の**後ろ**で `useState` / `useRef` を呼んでいた。React はフックの呼び出し順で状態を対応づけるため、**データが空のときだけ順序がずれ、別の状態を読む**。`react-hooks/rules-of-hooks` を有効にして初めて出た(それまで lint 自体が TS を見ていなかった) |
| 無効化コメントは「そのルールが設定されている」前提 | `// eslint-disable-next-line react-hooks/exhaustive-deps` が 10 ファイルにあったが、**ルール自体が設定されておらず**「そんな規則は無い」というエラーになっていた。無効化を書くときは、そのルールが `eslint.config.mjs` で有効かを確かめること。逆に**有効でないルールの無効化は消す**(`no-control-regex` が「未使用の指示」警告になっていた) |
| 誤検出の多いルールは切る | `security/detect-object-injection` は `obj[key]` を一律に警告し、**約 500 件のうち 9 割以上**を占めていた。TS では型付きアクセスも同じ形なのでほぼ誤検出。**本物(ReDoS・非リテラルなパス操作)が埋もれる**ため切ってある。プロトタイプ汚染の防止は実装側の責任(利用者の入力をそのままキーにしない) |
| lint が「緑」ではなく「走っていない」ことがある | **ESLint 9 は既定で `.js` 系しか見ない。** `eslint.config.mjs` に `files` と TypeScript のパーサが無く、**TS が 1 ファイルも lint されていなかった**(`eslint src` は「all of the files … are ignored」で異常終了)。検査があるつもりで無い、という最も質の悪い形。**typescript-eslint の推奨ルール一式は入れていない** — 守りたいのは境界と危険なパターンで、書き方は tsconfig の strict と 47 種の検査が見ているため |
| `.d.ts` は置くだけでは外から見えない | 型定義を持たない外部ライブラリ用の `.d.ts` は、**同じフォルダに置くだけでは自分の tsconfig の include に入るだけ**。`demos/showcase` のように外から `index.ts` を辿ってきた場合はプログラムに含まれず TS7016(暗黙の any)になる。**`/// <reference path="./xxx.d.ts" />` を index.ts の先頭に書く**(`barcode` は書いてあり `media` は漏れていた)。また `.d.ts` にトップレベルの import/export を書くと「モジュール」になり、`declare module` が宣言でなく**既存モジュールの拡張**になる |
| 移行の取り残しは typecheck でしか出ない | 自作 SVG グラフ → `ComboChart` への移行で、**未使用の定数が残り import が漏れていた**(`cashflow-client.tsx`)。smoke も `check-handmade-chart` も通る。この層は **`pnpm typecheck` が唯一の網**。JSX タグの import 漏れを正規表現で検出しようとしたが、ジェネリクス(`useState<RunResult>`)や TSDoc 内の記述と区別できず**誤検出だらけ**になったので入れていない |
| package.json に shell のコマンドを直に書かない | `rm -rf` などは **cmd.exe に無い**ので Windows で止まる(`pnpm clean` と `pnpm fresh` が動かなかった)。掃除は `tools/clean.mjs`(Node の `fs.rm`)に寄せてある。同種のコマンドが混入していないか smoke が見張る |
| JSX コメントは要素の中にしか置けない | `{/* … */}` を `return (` や `map((x) => (` の**直後**に書くと構文エラー。`command-palette.tsx` / `log-viewer.tsx` がこの形で、typecheck が 22 件のエラーを出した。`check-syntax` なら捕まえられるが**あれは TypeScript の導入が要る**ので、依存なしの smoke でも弾くようにした。説明は要素の外に **`//` で書く** |
| 実装を厳しくしたらテストも見直す | `createSession` が**負の `maxAgeSec` を起動時に落とす**ようになったが、単体テストは `maxAgeSec: -1` で「即座に期限切れ」を作る古い形のまま残り、`pnpm test` で 1 件だけ落ちた。smoke には「負の秒数は落とす」検査があったので、**smoke は緑・test は赤**という食い違いになった。期限切れは `vi.useFakeTimers()` で時間を進めて再現する |
| smoke が緑でも型は通っていない | smoke は **node が型を落として実行するだけ**で、型検査をしない。しかも `@platform/core` をスタブに差し替えるため、**スタブが緩いと型の誤りを覆い隠す**。実際 `storage/operations.ts` が `AppError` の代わりに素の `new Error()` を返しており、smoke は 8 項目すべて緑なのに `pnpm typecheck` で 4 件落ちた。**スタブは本物と同じ形にすること**、そして **`pnpm check`(typecheck→lint→smoke)を通すこと** |
| 検査が「生成物」を見てしまう | `apps/*/src/generated/`(Prisma クライアント)には `process.env.DATABASE_URL` や色の直書きが含まれる。除外しないと **`prisma generate` を実行した環境だけが落ちる** = setup を完走した人が全員落ちる。共有の `tools/lib/collect-files.mjs` は除外済みだが、**smoke 内で自前に walk を書くと漏れる**(2026-08 に実際に踏んだ)。ディレクトリを自前で辿るときは `generated` / `node_modules` を必ず飛ばす |
| 改行コードで Windows だけ落ちる | `.gitattributes` が無いと Windows の Git が **checkout 時に CRLF へ変換**し、行単位で解析する道具が軒並み壊れる(advisor / リファレンスサイト / カタログ MCP / 資料の節分割)。**Linux の CI では再現しない**ので「自分の環境だけおかしい」に見える。`* text=auto eol=lf` で固定し、読む側でも `.replace()` で正規化して二重に守る(ZIP 展開や手コピーには .gitattributes が効かないため) |
| compose は「引数なし」で全部起動する | `docker compose up -d` を引数なしで打つと、開発に不要な検索・キャッシュまで起動・取得され、**初回に 100MB 以上を余計にダウンロードする**。`meilisearch` / `redis` は `profiles: ["optional"]` に入れてあるので既定では動かない。起動は `pnpm db:up`(db + mailpit を名指し)。image の `latest` も禁止(日によって中身が変わり環境が揃わない) |
| Prisma のオプションは版で消える | Prisma 7 で `db push --skip-generate` が廃止された。使う場所が **setup(sh/ps1)・tools/db.mjs・CI・Dockerfile の 5 か所に散っていた**ため、1 か所直しても他が残る。smoke が全箇所を見張る。同種の廃止に気づいたら、まず `grep -rn` で散らばりを確認すること |
| Windows 向けスクリプトは文字コードで動かなくなる | **`setup.ps1` は BOM 付き UTF-8 必須**(Windows PowerShell 5.1 は BOM 無しを CP932 として読み、日本語の引用符が壊れて**構文エラーで起動しない**)。逆に **`.bat` は BOM 禁止**(cmd.exe が先頭行を `∩╗┐@echo` と読む)ので `chcp 65001` を使う。2026-08 に実際に踏み、原因が「スクリプトのバグ」に見えて特定に時間がかかった。smoke が両方を見張る |
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
| デモを足したら nav / overviews / use-cases の 3 つ | **件数は `gen-all` が自動で直す**（`check-doc-numbers.mjs --fix`）。以前は 5 箇所を手で直す必要があり、毎回 smoke が落ちていた。smoke 側も件数の決め打ちをやめ、「3 区分の合計が全体と一致するか」を見る形にした |
| 未実戦のままにしてよいものがある | 「作り忘れ」と「意図して使っていない」は違う。`module-list.md` に**理由**を書ける（`gen-module-list.mjs` の `UNUSED_REASONS`）。2026-08 時点で残る 2 件は `stripe`（公式 SDK ラッパーで fetch を差し替えられず、契約テストも効かない）と `testing`（テストの中から使うもの）|
| 実 API が要る基盤は fetch を注入してデモにする | `notion` / `microsoft` は `fetchImpl`・`authedFetch` を受け取るので、**応答を模した fetch** を渡せば本物のクライアントが動く。認証情報なしで、ページ送りや権限の扱いを確かめられる |
| ブラウザから使う基盤はサブパスで | `@platform/fs` のバレルは `node:fs` を引き込むため、`"use client"` から import すると**Turbopack が解決できずビルドが落ちる**。node に依存しない部分は `@platform/fs/magic` のようにサブパスで出す。`check-build-ready` の `[F]` が検出する |
| サブパス import は `exports` に載っているものだけ | `@platform/ui/styles/tokens.css` のように**存在しないサブパス**を書くと、**型検査は通るのに `next build` だけが落ちる**（Module not found）。正しくは `@platform/ui/tokens.css`。`check-build-ready` の `[A2]` が検出する |
| `createSearch` に渡すのは `SearchAdapter` | `createBm25Index()` は**同期 API** で渡せない。`createMemorySearch()` が BM25 のラッパー（非同期・Result）なのでそちらを使う |
| OGP は `buildMeta` とは別 | `MetaInput` に `openGraph` は無い。`buildOpenGraphTags()`（`@platform/seo` の open-graph）で作り、`renderMetaTags([...meta.tags, ...og])` と連結する |
| 同名の部品が 2 つあることがある | `@platform/ui` の `StatCard` は **2 種類**。主（`dashboard.tsx`／`delta` `trend` `format`）と `SimpleStatCard`（`stat-card.tsx`／`hint` `href`）。`hint` を使うなら後者。`balance-app` が間違えていた |
| README の書き方に従う | `createFreeeClient({ accessToken: "", fetchImpl: createFreeeAuthedFetch(tokens) })` が正しい形（`Authorization` は fetch 側が毎回付け直すので `accessToken` は使われない）。`balance-app` は fetch を直接渡していて型が合わなかった。**README に正解が書いてある** |
| `React` import は `jsx` 設定で変わる | `packages/ui` は `jsx: "react-jsx"` なので **JSX だけなら import 不要**（書くと `TS6133`）。ただし `React.ReactNode` を使うなら必要。アプリは `jsx: "preserve"` で**同じコードがエラーにならない**ので混同しやすい。2026-07 に ui で未使用 23 件・不足 3 件が同時に見つかった。`check-react-import` で守る |
| Result は一度変数に受ける | `f().ok && f().value` と**同じ呼び出しを 2 回書くと絞り込みが効かない**（別の式なので `Err` の可能性が残り `TS2339`）。API を 2 回呼ぶので**呼び出し回数も 2 倍**になる。`check-result-narrowing` で守る |
| DOM の型はサーバ側で使えない | 共通設定の `lib` は `["ES2022"]` で DOM を含まない。`BlobPart` `BodyInit` `RequestInit` などを書くと `TS2304` で**ビルドだけが落ちる**（**vitest は型を見ないのでテストは全部緑**）。**自分の tsconfig に DOM があっても安全ではない**: パッケージ間はソースを直接 import するので、DOM 無しの利用側で型検査される（`integrations`(DOM あり)を `ekyc`(DOM なし)が使って落ちた）。代替は `new Blob([new Uint8Array(bytes)])` / `FormData \| string` / `Parameters<typeof fetch>[1]`。**`new Uint8Array()` で包むこと**: TS 5.7 以降 `Uint8Array` は裏付けバッファでジェネリックになり、DOM 側は ArrayBuffer 裏付けを要求するため `Uint8Array<ArrayBufferLike>` は `TS2322` で弾かれる。`check-dom-lib` で守る |
| Windows のパス長 260 文字 | pnpm は `.pnpm/<pkg>@<版>_<ハッシュ>/node_modules/...` と**非常に深い階層**を作る。114 パッケージでは簡単に超える。2026-07 に実測 265 文字で踏んだ。対処は `LongPathsEnabled=1`（管理者権限・要再起動）。`node tools/check-path-length.mjs` が測る |
| turbo が Windows で動かない（**未解決**）| `turbo run build` / `dev` が `0xC0000409`（スタック破壊）で**タスクを 1 つも実行せず、ログも出さずに落ちる**。`ui: stream`・`--concurrency=1`・`LongPathsEnabled=1`・turbo 2.10.7 への更新のいずれでも変わらない（パス長が原因ではなかった）。**そのため `pnpm dev` / `build` / `test` の既定を turbo なしにしてある**（誰も踏まないように）。turbo を試したい場合は `pnpm dev:turbo` などを使う。デプロイ（Amplify・Linux）は `demos/showcase` だけをビルドするので影響なし |
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
| 名前が同じでも別物のことがある | `check-reimplementation` は**名前だけ**で照合する。`summarize`（経費集計 / アクセス解析）のように用途が違うなら、TSDoc に「**基盤の実装を使う**」と明記して除外する（検査はこの文言を見る）。2026-08 に 12 件を精査し、本物の重複は `wrapForPrint` の 1 件だけだった |
| 色は変数から取る | 2026-08 に直書き 67 箇所を `--color-*` へ移行して 0 にした。薄い背景は `color-mix(in srgb, var(--color-danger) 15%, transparent)` のように**同じ変数から作る**（別の色を直書きするとテーマから外れる）。`--color-success` / `--color-warning` は `tokens.css` に既定値があり、`AppSkin` がテーマごとに上書きする |
| 曜日の色は `weekdayColorClass()` | 日曜=赤・土曜=青は日本の慣習。3 つのカレンダー部品で同じ判定を書いていたので `@platform/ui` に集約した |
| CI は Windows でも smoke を流す | **開発者は Windows、CI は Linux** という食い違いが事故を生んだ（2026-08 に「Linux では通るが Windows では落ちる」問題を 4 種類踏んだ）。`ci.yml` の `windows-scripts` ジョブで smoke を通している。一覧は [GITHUB_ACTIONS.md](GITHUB_ACTIONS.md) |
| 検査が本当に発火するか確かめる | `node tools/verify-checks.mjs`（preflight にも入っている）。わざと違反したファイルを置き、**赤になること**を見る。これで `check-hardcoded-colors` の `process.exit(0)` が `exitCode` を上書きしていたバグが見つかった。**検査 47 件すべてを分類済み**（発火を確認 19 / 仕組み上できない 28）。分類漏れがあると落ちるので、検査を足したら `CASES` か `NOT_VERIFIABLE` に必ず追記する |
| 検査の対象範囲を疑う | 2026-08 に全 47 検査を棚卸しした。**`check-a11y` と `check-jsx-tags` が `packages` を見ていなかった**（前者は違反 10 件、後者は 188 ファイルが未検査）。`check-hardcoded-colors` は基盤しか見ておらず、アプリ側の 1,457 箇所が野放しだった。**検査を足したら「何を見ていないか」も確かめること**。smoke に対象範囲の表明を置いてある |
| 色は変数から取る（アプリも）| 2026-08 にアプリ・デモの直書き 1,457 箇所を `--color-*` へ移行して 0 にした。`text-neutral-500` → `text-[var(--color-muted)]`、`bg-red-100` → `bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)]` のように**意味で対応づける**（濃さの数値ではなく用途で決める）|
| 上限は対象ごとに分ける | `check-hardcoded-colors` は基盤（0 を保つ）とアプリ（上限方式）で別ファイルに持つ。1 つにまとめると、**アプリで増やした分だけ基盤で増やせてしまう** |
| エラーの details は既定で外に出さない | `toErrorEnvelope` が返す `details` には**内部の事情**が入りうる（テーブル名・接続先 URL・存在するリソース ID）。「個人情報を含めないこと」と書くだけでは守れないので、**`VALIDATION` のときだけ**返す。利用者が直せる情報（どの項目が不正か）は価値があるが、それ以外は `message` に含める |
| 認証の要らない口で資源を使わない | AI の呼び出し・ファイル受け取り・外部プロセス起動を無防備に置くと、**スクリプトで連打されるだけ**で費用・ディスク・CPU を持っていかれる。攻撃と呼ぶほどのものは要らない。`createRateLimiter`（`@platform/ratelimit`）で制限する。`check-rate-limit` が検出する |
| セキュリティヘッダは付け忘れても動く | 2026-08 の時点で **7 アプリ中 6 つが未適用**だった（基盤に `securityHeaders()` があるのに使われていなかった）。付いていなくても画面は普通に動くため、**動作確認では絶対に気づけない**。各アプリの `src/proxy.ts` で全レスポンスに付ける。`check-security-headers` が検出する |
| 「管理者しか入力しない」を安全の根拠にしない | CMS の埋め込みブロックが raw HTML を素通ししていた（`embedHtml` は引数をそのまま返すだけ）。**管理画面に入れる人は増える**し、乗っ取られた 1 アカウントで全ページに `<script>` を仕込まれる。`sanitizeEmbed()`（`@platform/security`）を通す。`check-unsafe-html` が検出する |
| 輪郭を消したら代替を出す | `outline-none` だけ書くとキーボード利用者が「今どこにいるか」を失う。`focus-visible:ring` か枠線の色変えを同じ className に入れる。`A11Y006` が検出する |
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
2. `pnpm dev:demos` — 動く実例集を一通り眺める（84 デモ）
3. `docs/ops/ONBOARDING_TASK.md` の課題をやってみる（半日）
4. **復元訓練を 1 回**（1 時間）
5. `CLAUDE.md` を読む — 作法と、その理由

## 関連

- `CLAUDE.md` — 作法（AI に読ませる前提でも書いてある）
- `docs/README.md` — 資料の索引
- `docs/ops/CHECKS.md` — 47 種類の検査が何を見ているか
- `docs/RUNBOOK.md` — 障害対応
- `docs/ops/SUPPORT_GUIDE.md` — 利用者からの問い合わせ
