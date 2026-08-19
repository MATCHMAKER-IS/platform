# 引き継ぐ人へ — いまどこまでできているか

この基盤を引き継ぐ／一緒に見ることになった人が、**最初に読む**ものです。

「何があるか」は他の資料にあります。ここに書くのは
**何が終わっていて、何が残っていて、どこが危ないか**です。

---

## この資料の歩き方

**2,956 行あります。頭から読まないでください。**

| 知りたいこと | どこを見るか |
|---|---|
| 全体像 | [一言でいうと](#一言でいうと) → [できていること](#できていること) |
| **今すぐやるべきこと** | [終わっていないこと（重要な順）](#終わっていないこと重要な順) |
| **触ってよいか迷ったとき** | [意図的に残していること](#意図的に残していること直さなくてよい) |
| **なぜこうなっているか** | [危ないところ](#危ないところ)——**348 項目。検索してください** |
| 台数を増やすとき | [メモリ実装から Redis / DB へ移す手順](#メモリ実装から-redis--db-へ移す手順) |
| 引き継いだ直後 | [最初の 1 週間ですること](#最初の-1-週間ですること) |

**「危ないところ」は検索して使います。**

```
grep -n "<関数名や画面名>" docs/ops/HANDOVER.md
```

直そうとしている箇所が見つかったら、**まず読んでください**——
**過去に検討されて今の形になっている**ことがよくあります。

**関数名で見つからないときは、日本語でも試してください。**
「なぜそうしたか」を書いているので、**関数名より現象が主語**のことがあります:

| 探し方 | 例 |
|---|---|
| 関数名 | `maskEmail` `formatYen` `applyMovement` |
| **現象** | `二重` `並び順` `丸め` `NaN` `前日` `100 倍` |
| **画面名** | `経費` `請求書` `勤怠` `チャット` |
| **仕組み** | `フラグ` `失効` `冪等` `Outbox` |

## 一言でいうと

社内アプリを作るための部品置き場（`packages/`）と、それを使ったアプリ（`apps/`）、
動く実例集（`apps/showcase`）のひとまとまりです。

**目的は「同じものを何度も作らない」こと**。それを守るために、
作法を決めて（`CLAUDE.md`）、機械が確認する（`node tools/preflight.mjs`）形にしてあります。

---

## できていること

| 領域 | 状態 |
|---|---|
| 部品 | **120 パッケージ**。日本の業務(会計・請求・勤怠・在庫・電帳法)に対応。ただし**実アプリで使われているのは 69**(showcase のみ 38 / 未実戦 7)|
| アプリ | **5 つ**（社内・公開サイト・雛形・LINE応対・showcase）。**口座残高と備品管理は internal-app に統合**し、**基盤ポータルは apps/showcase に移設**した（ADR-0015 の 3 基準をどれも満たさなかった） |
| 作法の強制 | **103 種類の検査**が `preflight` で自動確認（実行 73 項目・約 30 秒） |
| テスト | smoke **1,400 件超**（依存なしで動く。正確な数は `pnpm smoke` の最終行）・単体テスト **112/120 パッケージ**（config はランタイムコード無し）・E2E **17 本** |
| 資料 | 83 件。すべて索引から辿れる |
| 認可 | API **291 本すべて**が認可を通すか、通さない理由を宣言済み |

**触る前に `node tools/preflight.mjs` を流してください。** これが緑なら、
作法・依存・資料の整合は取れています。

---

## 終わっていないこと（重要な順）

### 0. `pnpm-lock.yaml` がコミットされていない ⚠️⚠️⚠️

**これが全部の根です。最初に直してください。**

```bash
pnpm install          # lockfile が生成される
git add pnpm-lock.yaml && git commit -m "chore: lockfile を追加"
```

**なぜ最優先か。** lockfile が無いため、CI の `pnpm install` に
`--frozen-lockfile` を付けられず（2026-08 に付けたが、lockfile が来るまでは落ちる）、
**実行のたびに違う依存でビルドされていた**。

その結果、**`pnpm typecheck` が通っていない状態が見過ごされていた**。
2026-08 に `tsc` を通し直したところ、**環境要因でない型エラーが 12 件**見つかった:

| 場所 | 何が起きていたか |
|---|---|
| `zoho/{mail,meeting,expense,vault}` | `createZohoApiClient` の設定型が `{ baseUrl }` → `{ apiDomain, basePath }` に変わったとき、**この 4 つだけ追随漏れ**。`ZohoService` の union にも 4 サービスが無く、**ビルドが通らない**。README は「14 サービス」と書いていた |
| `ai` の `AiProvider.chat` | 戻り型が `{ text, usage }` だけで、**`toolCalls` が型の上で消えていた**。実装は返しているのに契約が知らない |
| `ai` の `OpenAiResponse` | 実装が `message.tool_calls` を読んでいるのに、型に無い |
| `security` の `SecurityHeadersOptions` | 実装が `resourcePolicy` を読んでいるのに、型に無く**呼び出し側から渡せない** |
| `zoho/inventory` | `listAll` を実装しているのに interface に無い |
| `push` / `security/sanitize` | 未使用の import / 引数（`noUnusedLocals`） |

**「緑だから大丈夫」が成り立っていなかった。** lockfile を入れて
`--frozen-lockfile` を効かせるまで、この状態はまた起きます。

**✅ 対応完了(2026-08)**: `Uint8Array` → `Blob` / `BodyInit` の代入が
3 箇所(`ai/provenance.ts` / `zoho/expense` / `slack`)あり、ユーザーの
`pnpm install` 後の実環境(TS 6.0)で実際に確認できたため対応した。

**`slack`(`fetch` の `body`)と `zoho/expense`(`new Blob`)は
`as BodyInit`/`as BlobPart` という明示キャストで解決した**——両パッケージ
とも tsconfig に `"lib": ["ES2022", "DOM"]` を明示しており、`BodyInit`/
`BlobPart` という型名を直接参照できるため。既に `packages/microsoft/
src/graph.ts` にあった `as BodyInit` と同じパターン。

**`ai/provenance.ts` だけは同じ対処が使えなかった**——このパッケージの
tsconfig には DOM が無く、`BlobPart` という型名自体を参照できない
(`check-dom-lib` が検出)。**最初 `as BlobPart` で直したが、これ自体が
誤りだった**——`check-dom-lib` に「DOM の型を使っているのに lib に無い」
と指摘され、正しい対処(`new Uint8Array(x)` で包み、DOM の型名を一切
書かない)に訂正した。

**教訓**: 専用の検査ツール(`check-dom-lib`)が既にこの問題領域を
丁寧にカバーしていた。自己流の修正を先に施すのではなく、まず
`node tools/check-dom-lib.mjs` のような既存ツールを確認すべきだった
——今回はそのツール自身が誤りを検出してくれた形で事なきを得たが、
偶然に頼るべきではない。

### 0.5. カバレッジを一度も測っていない ⚠️⚠️

`packages/config/vitest.preset.mjs` には `thresholds: { lines: 80, ... }` が
**ずっと書いてあったが、`--coverage` を一度も付けていなかった**——
**評価されたことのない閾値**だった。

2026-08 に `pnpm test:coverage` と `tools/check-coverage.mjs`（下限ラチェット）を
入れたが、**下限（`tools/coverage-floor.json`）はまだ空**です。

```bash
pnpm test:coverage
node tools/check-coverage.mjs --set-floor   # 実測値を下限として記録
node tools/check-coverage.mjs --list        # パッケージ別に見る
```

`core` / `crypto` / `guard` は**絶対値 80%** で守る設定にしてあります。
**初回に落ちたら、下限を下げるのではなくテストを足してください**——
この 3 つは壊れると全アプリに波及します。

**実装行に対するテスト行の比はリポジトリ全体で約 11%**、
`ui` は 21,425 行に対し 599 行（**2%**）です。`smoke` の 2,474 件は
**静的検査寄り**で、振る舞いの回帰は守れません。

### 0.7. 繋ぎ込みの被覆が低い ⚠️⚠️

**基盤に部品があることと、必要な場所で使われていることは別**です。
`node tools/check-safety-parts.mjs --list` で被覆を見られます。

| 部品 | 被覆 | 状態 |
|---|---|---|
| sanitizeHtml / escapeHtml | 5/5 | ✅ critical・100% 必須 |
| detectFileType | 1/1 | ✅ critical・100% 必須 |
| isSafeExternalUrl | 4/4 | ✅ critical・100% 必須 |
| timingSafeEqualBytes | 1/1 | ✅ critical・100% 必須 |
| **レート制限（公開 API）** | **9/39（23%）** | 下限ラチェット |
| **監査ログ（削除操作）** | **5/14（36%）** | 下限ラチェット |
| **withIdempotency** | **1/15（6.6%）** | 下限ラチェット |

**下がったら CI が落ちますが、上げるのは人の仕事です。**
ログイン周辺と、金額が絡む API から手を付けると効きます。

**2026-08 に本物の穴が 1 件見つかり、直しました。**
`apps/showcase/src/app/api/media-probe/route.ts` が、アップロードを
**拡張子だけで判定してディスクに書き、ffprobe に渡していました**。
`detectFileType` は基盤にあったのに、繋がれていませんでした。

### 0.8. 基盤の CI はアプリを見られない ⚠️⚠️

`.gitignore` が `apps/*` を除外している（ADR 0021）ため、
**基盤のリポジトリにアプリのソースがありません**。
検査 82 種類のうち **50 種類はアプリを走査する**のに、です。

| | 手元 | 基盤の CI |
|---|---|---|
| 見える API | 285 本 | **22 本** |
| 見えない | — | **242 本（92%）** |

**残り 242 本を見るのは、アプリ側リポジトリの CI だけ**です（ADR 0024）。
テンプレートは `apps/crud-template/.github/workflows/ci.yml` にあり、
実アプリ 3 つへ配布済みですが、**`repository: <あなたの組織>/platform` の
書き換えは手作業**です。`check-app-ci` が配布漏れを見張ります。

### 0.9. E2E は一度も成功していなかった ⚠️⚠️⚠️

**`continue-on-error: true` が、E2E が通っていない事実を隠していました。**
2026-08 に外したところ、**通り得ない構成**だったことが分かりました。

| 原因 | 内容 |
|---|---|
| CI に前提が無い | `tools/e2e.mjs` は DB・Prisma クライアント・`.env` を確認して落とすが、CI はどれも用意していなかった |
| 存在しないアプリを起動 | `playwright.config.ts` が 4 アプリぶんの `webServer` を固定で並べていたが、**基盤の CI には showcase と crud-template しか無い**（ADR 0021） |
| 存在しないアプリを叩く spec | `internal-auth` / `internal-equipment` はポート 3000（internal-app）が対象 |

**直したもの**（`platform-wired.zip`）:

- `playwright.config.ts` … `E2E_APPS` から**実在するアプリだけ**を起動する
- `e2e/_apps.ts`（新規）… `hasApp()` でチェックアウトにアプリがあるか判定
- spec 3 本 … `test.skip(!hasApp(...))`。**削除ではなく skip**（アプリ側の CI では実行してほしい）
- `ci.yml` … postgres:17 サービス・`app_crud` 作成・`.env` 自動コピー・`db generate all`・`db push`

**最初の 1 回は落ちる前提で見てください。** 構成上の欠落は塞ぎましたが、
**この環境では Playwright を実行できず、実際に緑になるかは未確認**です。
落ちたら `continue-on-error` を戻すのではなく、
不安定なテストに `test.fixme` を付けて理由を残してください。

#### 判断が要ること: `.github/workflows/e2e.yml`

**このワークフローは基盤のリポジトリでは動きません。**
`pnpm --filter internal-app e2e` を実行しますが、
**`internal-app` は基盤の git にありません**（`.gitignore` で除外・ADR 0021）。
`--filter` は「対象なし」で終わります。

内容としては `apps/internal-app/` 側のリポジトリに属するものですが、
**ADR 0013 がこのファイル名を根拠に挙げており、smoke も内容を固定している**ため、
**消す判断は基盤の責任者がしてください**。選択肢は 3 つです。

| 案 | 内容 |
|---|---|
| A | `internal-app` のリポジトリへ移し、基盤からは削除（ADR 0013 に追記が要る） |
| B | 基盤に残し、`if: hashFiles('apps/internal-app/package.json') != ''` で空振りさせる |
| C | アプリ側 CI テンプレート（`apps/crud-template/.github/workflows/ci.yml`）に E2E 手順として統合 |

**A が筋**ですが、ADR と smoke の書き換えを伴います。

### 0.6. 金額を `Int` に移行しました（**DB 側の適用が未実施**）⚠️⚠️

請求書の `subtotal` / `tax` / `total` / `paidAmount` が **`Float`** でした。
`Float` は二進小数なので `0.1` を正確に表せず、
**足すたびに誤差が積もり、請求書の合計が 1 円合わない**という形で表に出ます。

**schema.prisma は既に `Int` に変えてあります（16 カラム）。**
**DB 側の変換はまだです。** 次を順に実行してください。

```bash
# 1. 小数を持つ行が 0 件であることを確かめる（SQL の STEP 1）
#    **0 件でなければ進まないこと。** 丸めた分だけ帳簿が動きます
psql -h localhost -U app -d app -f scripts/migrate-money-to-int.sql

# 2. バックアップ（docs/ops/BACKUP_RESTORE.md）

# 3. 上の SQL がそのまま STEP 2（変換）まで実行します

# 4. schema と DB が一致するので、ここは何も変更しないはず
pnpm db push
```

手順の詳細は **[DATA_MIGRATION.md の「列の型を変える」](DATA_MIGRATION.md)** にあります。

**既存データは確認済みで、丸めは発生しない見込みです。**
`lineNet()` が `Math.round`、`taxAmount()` が税率区分ごとに 1 回だけ丸めるため、
**`Float` カラムには最初から整数しか入っていません**。
ただし**手で入れたデータや取り込みデータは別**なので、STEP 1 は必ず実行してください。

#### 入口も締めました

入金 API が `typeof body.amount !== "number"` しか見ておらず、
**`1000.5` がそのまま DB に入る**状態でした。
`Number.isSafeInteger` に変えています（`payment` と `receipt` の 2 本）。

**型を変える前に入口を締めるのが順序**です。逆にすると、
小数を送ってくる経路が残ったまま書き込みが失敗します。

#### 残した 3 件は意図的です

`StockMovementRow.unitCost`（原価単価）・`WageRow.hourlyWage`（時給）・
`FeePaymentRow.base`（手数料基準額）は **小数に意味がありうる**ため残しました。
小数が要るなら `Decimal @db.Decimal(p, s)` が適切です——**業務で判断してください**。

#### 日時が `String` のカラムは 27 件残っています

`AttendanceRow.date` など。並べ替えが文字列順になり、タイムゾーンも表現できません。
`@platform/datetime` が JST を丁寧に扱っているのに、**DB 側でその前提が崩れています**。
上限方式で止血済みですが、**未着手**です。

### 0.65. DB のクエリに時間制限を入れました

`createDb` は既定 **30 秒**でクエリを打ち切ります（`statementTimeoutMs`）。

**これが無いと、遅いクエリが接続を占有し続けます。** プールは 10 本なので、
**原因は 1 本のクエリなのに、画面はすべて「DB に繋がらない」**になります。

あわせて `57014`（打ち切り）を **再試行しない** 分類に変えました。
以前は `ErrorCode.DATABASE`（`retryable: true`）に丸められており、
**30 秒かかったクエリを何度も投げ直す**動きでした。

**夜間バッチや CSV 出力で 30 秒を超えるものは、
`statementTimeoutMs` を長くした別のクライアントを作ってください**——
ここを伸ばすと、画面からの事故も一緒に伸びます。

### 0.4. API の入力検証が基盤を使っていない ⚠️⚠️

**本文を読む 122 本のうち、スキーマで検証しているのは 3 本だけ**です。

| 状態 | 件数 |
|---|---|
| スキーマ検証（`validate()`。**推奨**） | 3 |
| 手書き（`typeof body.x` など。可） | 69 |
| **未検証** | **50** |

基盤には `@platform/validation` の `validate(schema, input)` が `Result` を返す形であり、
`z` も金額スキーマもマイナンバーのチェックディジットも揃っています。
**それが 1 本でしか使われていませんでした**（ADR 0024 の「部品はあるのに繋がっていない」）。

**`node tools/check-input-validation.mjs --list` で未検証の一覧が出ます。**
上限 50 で刻んであるので、**これ以上増えることはありません**。

#### 「意味は検証しているが、形が検証されていない」に注意

掲示板の投稿は、サービス層で `validateAttachments`（件数・サイズ・種別）を
きちんと通していました。**それでも穴がありました。**

ルートが `as Attachment[]` でキャストしているだけなので、
`attachments: "abc"` を送ると:

- `"abc".length` は 3 なので**件数の上限を通る**
- `for (const a of "abc")` は文字を回すので `a.size` が `undefined` になり、
  **サイズの検証も素通りする**

**`as` は実行時に何も確かめません。** 下流の検証が正しくても、
**境界で形が崩れていれば無効化されます**。同じ形の穴が他にもあるはずです。

#### 減らし方

**手書きを一気に `validate()` へ置き換えないでください。** 差分が大きすぎて
レビューできません。**未検証 50 本を減らすのが先**です。

```bash
node tools/check-input-validation.mjs --list       # 未検証の一覧
# 直したら
node tools/check-input-validation.mjs --set-floor  # 上限を下げる
```

本文を使わないルート（トークンだけ見る webhook など）は
`// no-body-validation: <理由>` をその場に書いてください。

### 0.45. 画面の通信は `submitJson` に寄せました

`internal-app` の 6 画面すべてが素の `fetch` で、**タイムアウトを 1 つも
指定していませんでした**。`catch` はあるので画面は落ちませんが、
サーバが応答しないと待ち続けます。利用者には「押しても何も起きない」と見えるので
**もう一度押す**——`withIdempotency` の被覆が 1/15 の状態では、
それがそのまま**二重登録**になります。

`@platform/form` に `submitJson()` を追加し、**更新系の素の fetch は 6 → 1 本**に。

| 引き受けること | |
|---|---|
| タイムアウト | 既定 15 秒。**`AbortSignal` で本当に接続を切る** |
| CSRF ヘッダ | 呼ぶたびに cookie から読む（使い回すと張り直し後に 403） |
| `Content-Type` | `application/json`（サーバが preflight を要求するため） |
| エラー整形 | `{ error }` を画面に出せる文字列へ |

**リトライは入れていません。** 更新系を自動再送すると二重登録になります。
再試行するかは利用者が決めることです。

**`withTimeout()`（@platform/net）は使いませんでした。**
あれは Promise を諦めるだけで**接続は残ります**——画面から呼ぶ場合、
開いたままの接続が積もると次の要求が詰まります。

#### 残っている 1 本

`chat/[roomId]/chat-room-client.tsx` のピン解除が `void fetch(...)` です。
**結果を待たない書き方**なので置き換えの意味が薄く、判断を残しました。
smoke も `void fetch(` は数えていません。

#### 経費の取り込みだけ 60 秒です

CSV の一括取り込みは件数次第で 15 秒を超えます。ここを既定のままにすると
**正常な処理を途中で切ってしまう**ので明示的に伸ばしました。

**本来は `@platform/jobs` に載せるべき処理**です。伸ばしても、
待っている人の体験は良くなりません。

#### `@platform/form` は依存に入っていませんでした

「57 画面が素の fetch」という以前の指摘は、そもそも
**使える状態になっていなかった**ことが背景にあったようです。
`apps/internal-app/package.json` に追加済みです。

### 0.1. `pnpm typecheck` が通っていない箇所を大量に修復しました ⚠️⚠️⚠️

**apps 側は一度も型検査されていませんでした。** 2026-08 に `tsc` を通したところ、
`internal-app` だけで**実行すると 500 になる箇所**が次のとおり見つかりました。

| 種別 | 件数 | 何が起きていたか |
|---|---|---|
| **import 漏れ** | **20 ファイル** | 関数は存在するのに `import` が無く、`ReferenceError` |
| `todayJst` の戻り値取り違え | 4 ファイル 12 箇所 | `Date` に `.slice()`。**発注番号・キャッシュフロー・売上トレンド・発注点起票** |
| 書き誤り（`record` → `rec`） | 1 | **ファイルダウンロードの監査だけ記録されない** |

import が欠けていた主なもの:

- `isCronAuthorized`（5 本）… **cron 系の認可**
- `formatDateJst` / `formatMonthJst`（9 本）
- `timingSafeEqual`（2 本）… **鍵の定数時間比較**
- `withIdempotency` / `idempotencyStore`（発注の二重送信防止）
- `createRateLimiter`（公開受付口のレート制限）

**すべて `pnpm typecheck` が動いていれば即座に落ちるもの**です。
packages 側の 12 件（zoho の 4 サービスなど）と合わせると、
**型検査が回っていない影響はかなり広範囲**でした。

#### 画面 3 ファイルは**ビルドできない状態**でした

API に続いて画面（`.tsx`）も検査したところ、**構文エラー 32 件**が出ました。

| ファイル | 症状 |
|---|---|
| `cashflow/cashflow-client.tsx` | `</AsyncBoundary>` だけあり**開始タグが無い**。さらに `data.rows` を null チェック前に参照 |
| `cms/dashboard/dashboard-client.tsx` | `<AsyncBoundary>` が**別の関数（`Stat`）に誤挿入** |
| `dashboard/dashboard-client.tsx` | `</AsyncBoundary>` が**別の関数（`TrendChart`）に紛れ込み** |

**`AsyncBoundary`（読み込み中・エラー表示の共通化）の適用が途中で止まった跡**です。
`cashflow` の `const rows = data.rows;` が null チェック前に残っていたのは、
**一括置換で早期 return を消した**ためと見られます。修復済みです。

#### packages 側にも `ReferenceError` が 2 件ありました

| パッケージ | 症状 |
|---|---|
| `@platform/line` | `import type { Result }` だけで、`ok` / `err` / `AppError` / `ErrorCode` を**値として使用**。`import type` は実行時に消えるので、リッチメニューの画像送信で落ちる。さらに `opts.fetchImpl` が **4 箇所**（引数名は `config`。**リネームの取り残し**） |
| `@platform/form` | `createWebStorage` の `import` が無い。`package.json` の依存にはあるのに——`useFormAutosave`（自動保存）を呼ぶと落ちる |

**どちらも修復済みです。**

#### smoke のスタブが「壊れたコードに合わせて」作られていました

`line` を直した瞬間、smoke が落ちました。smoke は `@platform/core` の
スタブを `/tmp` に作って検証していますが、その中身が
**`Result` 型だけ**だったためです。

つまり **`import type` しかしていない（壊れた）実装に合わせてスタブができていた**。
冪等性のときと同じ構図で、今回は「文字列一致」ではなく「スタブの中身」でした。

`copyPackageDeep()` を作り、**パッケージを再帰的に写す**ようにしました
（`core` は `index → error-policy → error` と 2 段になっており、1 段では足りません）。
**必要な名前を並べない**ので、実装が増えても smoke を直す必要はありません。

#### テストが実型と食い違っていた箇所を 13 パッケージ直しました

本番コードの修復後に残ったのは、**テスト側**の型エラーでした。
「些細な書き方の差」ではなく、**テストが検証している対象が実物とずれている**ものです。

| パッケージ | ずれ |
|---|---|
| `guard` | 偽の `Session` に **`refresh` と `inspect` が丸ごと欠落**。認証の中核を検証していなかった |
| `workflow` | `effectiveRoles(actor, del, now)` の第 3 引数は `{ now?, roleOf? }`。`Date` を直接渡すと `undefined` になり、**「今」を固定できていなかった** |
| `mcp` | `authorizeTool` に **`false` を渡していた**（実型は `true \| string`）。`ctx.user` も**存在しないプロパティ** |
| `loadtest` | `request` が `{ url }` を返す（実型は `Promise<RequestOutcome>`） |
| `board` / `chat` | `Attachment` の必須 `key` を欠き、存在しない `url` を渡す |
| `cms` | `RevisionLike` / `Revision` の必須 `status` を欠く |
| `notify` | `as const` の `readonly` が可変配列と衝突 |
| `zengin` | `accountType` がリテラル型 |
| `cron` / `status-page` / `json` | 引数型・Promise・`Partial` の深さ |

**なぜテストは通っていたか。** `loadtest` が分かりやすい例です:

```ts
{ name: "一覧", weight: 7, request: () => ({ url: "/list" }) }
```

`weightedPick` は**重みで選ぶだけで `request` を呼びません**。だから通ります。

> **呼ばれない部分の型は、テストでは検証されない。**

`guard` の偽 `Session` が 3 メソッドしか持たず、実型が 5 つ必要だったのも同じです
（`refresh` はセッションの自動延長、`inspect` は失効判定に使われます）。

#### apps 側のテストにも 1 件

`apps/internal-app/src/server/zoho-session.test.ts` が `SessionPayload` の
**必須項目 `roles` を欠いて**いました。

`roles` は **RBAC の付与ロール**です。つまりこのテストは
**認可の判断材料が入らないセッション**を相手に、署名と検証を確かめていました。
署名まわりの検証としては動きますが、**実運用のセッションとは別物**です。

`guard` の偽 `Session` に `refresh` / `inspect` が無かったのと同じ形で、
**認証・認可まわりのテストが、実物より緩い型で書かれている**傾向があります。

#### 判断を残したもの: `deepMerge` の型

```ts
deepMerge({ a: { x: 1, y: 2 } }, { a: { y: 3 } })  // 実行時は正しく動く
```

`Partial<T>` は **1 段だけ**なので、入れ子の部分指定を型で表せていません。
テストは型が通る形に直しましたが、**`DeepPartial<T>` を導入するかは設計判断**です
（影響範囲を見て決めてください）。

#### 検査を足したら `verify-checks` に登録すること

`preflight` をフルで通したところ、**私が追加した 7 検査が「未分類」**で落ちました。

```
⚠ 未分類 7 件: check-app-ci, check-coverage, check-input-validation,
   check-package-tier, check-safety-parts, check-schema-types, check-unreachable-modules
```

`verify-checks` は「**検査が本当に発火するか**」を確かめる自己検証で、
新しい検査は次のどちらかに登録する必要があります。

| 登録先 | 対象 |
|---|---|
| `CASES` | 違反ファイルを 1 つ置けば発火するもの |
| `NOT_VERIFIABLE` | 仕組み上できないもの（**理由を書く**） |

**上限・下限ラチェット方式は `NOT_VERIFIABLE`** です。ファイルを 1 つ置いても
閾値を超えないため（超えるまで大量に置くのは現実的でない）。
代わりに `--list` で中身を目視できるようにしてあります。

`check-unreachable-modules` だけは `CASES` に登録しました——
**`index.ts` から出ていないファイルを 1 つ置けば発火する**ためです。

#### 静的検査は tsc の代わりになりません

この作業で 2 つ、はっきりしました。

**① `check-braces` は構文エラーを見逃します。**
編集で配列要素の閉じ括弧を壊したとき、`check-braces` は
「括弧の対応は合っている」と報告しました。**数は合っていても構造が違う**ためです。
`tsc` を通して初めて分かりました。

**② smoke が壊れたコードを固定していました。**

```js
ok("発注に冪等キーが効いている", /withIdempotency\(req/.test(po));
```

**「そう書いてあるか」しか見ていません。** import が欠けて実行時に落ちる状態でも緑です。
実際に呼んで確かめる検査に差し替えました（同じキーの 2 回目が実行されないこと、
利用者が違えば衝突しないことを**実行して**確認）。

> **「書いてある」と「動く」は別。** 文字列一致の検査は前者しか見ない。

**新しく smoke を書くときは、可能なら実際に呼んでください。**

**③ `check-jsx-tags` は複数行の JSX を見ません。**
名前のとおり「インラインタグ」（1 行で開いて閉じるもの）だけが対象で、
上記 3 ファイルの崩れは**すべて見逃していました**。

正規表現で JSX の対応を数える検査を作りかけましたが、**破棄しました**。
型引数（`useState<Ledger | null>`）と JSX タグの区別、複数行の自己終了タグ、
属性値の `{}` 内の `>` ——**これは TypeScript のパーサがやる仕事**で、
正規表現を継ぎ足すと「検査自身が実態とずれる」を新しく作ることになります
（本セッションで 4 回起きています）。

**`pnpm typecheck` なら一発で、正確に分かります。** 実際そうやって見つけました。

#### CI の構成は正しく、回っていなかっただけです

確認したところ、**必要なものは揃っていました**:

- `.github/workflows/ci.yml` … `pnpm -r typecheck`
- 全 5 アプリの `package.json` … `typecheck` スクリプトあり
- アプリ側 CI テンプレート … `pnpm typecheck` あり

**足りないのは `pnpm-lock.yaml` だけ**です。これが無いと `--frozen-lockfile` の
install が通らず、CI がそもそも動きません（HANDOVER「終わっていないこと 0 番」）。

```bash
pnpm install                       # ← これで CI が動き出す
git add pnpm-lock.yaml && git commit -m "chore: lockfile"
pnpm -r typecheck                  # ← 手元でも一度通してください
```

### 0.10b. mailer.sendMail の全呼び出しを点検し、5 件の配列宛先漏洩を発見

`to` に配列を渡す漏洩パターン(前回複数箇所で発見)について、
`mailer.sendMail`/`appMailer.sendMail` の全 17 箇所を `grep` で洗い出し、
外部送信(`mailer.sendMail`)で **5 件の未修正の漏洩**を発見・修正した:
`admin/audit-alerts/route.ts`(手動)・`admin/audit-alerts/scan/route.ts`
(cron)・`admin/report-scan/route.ts`・`surveys/[id]/remind/route.ts`
(手動)・`surveys/[id]/status/route.ts`。

**同じ機能の自動/手動 2 経路が食い違っていた実例が見つかった。**
`surveys/remind-scan`(cron 自動版)は前回のセッションで既に 1 件ずつに
直していたが、**同じ機能の手動トリガー版(`[id]/remind`)は直っていな
かった。** 同じ業務機能の異なる経路で実装が食い違うという、このセッ
ションで繰り返し見つけてきたパターンがここにも存在した。

**`mailbox` 経由(社内受信箱への配信)は対象外と判断した。**
`createMailboxTransport` のコメントに「全社宛(数百人)だとその数だけ
問い合わせが飛ぶ」と明記されており、社内メールでの複数宛先表示は
意図的な設計。ただし `mailbox/send/route.ts`(利用者が自由入力する
送信機能)だけは、他の内部メール経路との一貫性のため 1 件ずつに揃えた。

#### ⚠️⚠️⚠️ 点検の延長で発見: CMS 公開承認通知が幽霊ユーザー宛だった

`notificationCenter.notify("cms-approvers", ...)` という呼び出しに
気づいた。**`notify(userId: string, ...)` は完全一致でしか通知を
検索できない**——`"cms-approvers"` という文字列を `userId` として
渡すと、実在しないユーザーの棚に通知が積まれ続け、**実際の CMS 公開
承認者(`cms:publish` 権限を持つ人)はこの通知を一度も見られなかった**。

「公開申請があります」という通知が、届くべき人に一度も届いていな
かったことになる。`mcp-approvals.ts` の正しいパターン(`can(APP_POLICY,
u.roles, "権限名")` で該当ロールの利用者を絞り込み、1 人ずつ通知)に
合わせて `cms/posts/route.ts`・`cms/posts/[slug]/route.ts` の両方を
修正した。他に同じパターン(文字列リテラルの疑似ユーザー ID)が無いか
全体検索し、この 2 箇所のみであることを確認した。

### 0.10c. 全 249 route.ts + lib(28件) + 基盤パッケージの一括型検査

全 route.ts への一括型検査(`for` ループで個別ではなく `include` に
249 ファイルを一括で渡す方式)を行い、`db is unknown` 系の環境ノイズを
除いた実質的なエラーを 1 件ずつ精査した。

**重大な実行時バグを 3 件発見**:

- `files/download/[...key]/route.ts`: `fileStorage.get()` が返す
  `Result<Uint8Array>` を `try/catch` で開こうとしていた。`Result` は
  例外を投げない設計なので catch には絶対に到達せず、**ファイル
  ダウンロード機能が実装されて以来一度も正しく動作していなかった
  可能性がある**。`got.ok`/`got.value` で正しく開封する形に直した。
- `admin/users/route.ts`: `auditActions.record` の `changes` 引数の型が
  `roleChanges` という第 3 のフィールドを想定しておらず、**「誰がいつ
  管理者権限を付けたか」が監査ログに一度も記録されていなかった**。
  `after` オブジェクトの中に含める形に直した。
- `business-metrics.ts`: `taskStore`・`contractStore` という**存在しない
  ストア**を import していた——`@platform/task`・`@platform/contract`は
  純粋なロジック関数群のみで永続化ストア自体を提供しておらず、
  アプリ側にも実装が無い。**このcronエンドポイントは呼ばれるたびに
  確実に例外を投げていた。** 新しいストアの実装は今回のスコープを
  超えるため、該当 2 指標を未計測のまま安全にスキップする形にした
  (次回、TaskRow/ContractRow のスキーマとストアを追加してから接続すること)。

**`as unknown as` が隠す型不整合を、さらに 10 箇所発見**(累計)。
`chat-store-prisma.ts`・`board-post-repo.ts` はモデル単位(`$transaction`・
`messageReactionRow`・`pinRow`・`bookmarkRow`・`deleteMany` 等)の欠落、
`inventory-repo.ts`(2 箇所)・`invoice-repo.ts`・`mcp-tools.ts`・
`search-index.ts`・`settings-repo.ts` は `take`/`orderBy`/`select`/
`increment`/`info.more_records` が型に無い、という同じパターン。
すべて `db as unknown as StoreDb` というキャスト配線がこの食い違いを
外部の型検査から隠していた。

**その他の実装バグ**: `notification-center.ts` の `findMany` 呼び出しで
`take` プロパティが 2 回書かれていた(オブジェクトリテラルの重複、
`TS1117`)。JS の仕様で後勝ちになるため実害は無かったが、決め打ちの
`take: 100` は古いコードの残骸だった。

**基盤パッケージ側でも 2 件発見**: `packages/session/src/auth-session.ts`
の `sameSite: "lax"`(小文字)が `CookieOptions` の型(`"Strict" | "Lax" |
"None"`)と食い違っていた(`"Lax"` に修正)。同ファイルの
`AuthSessionOptions` に `salt` が無く、渡すと `createSession` が必ず
例外を投げる状態だった——ただし `createAuthSession` はどのアプリからも
実際に呼ばれておらず実害は無かった。`packages/ui/src/lib/bulk.ts` は
`BulkItemResult` という同名の `interface` が完全に重複しており(`key:
string` と `key: unknown` が矛盾)、コピペの残骸を統合して解消した。

**環境ノイズと判断したもの**: `import-repo.ts`・`approval-repo.ts` 等の
`db is unknown` 系(生成物 Prisma 型が単体 include では解決されない)、
`packages/ui` の `TS6142`(jsx 未設定)・`TS2307`(react 等 未インストール)、
`packages/mcp`/`packages/session` の Node 型欠落(`@types/node` 未使用)、
`packages/ai/src/provenance.ts` の `BlobPart` 不一致(実プロジェクトは
`lib: ["ES2022"]` のみで `DOM` を含まず、単体検査で追加した `DOM` lib
が原因と特定)。

**教訓**: 個別ファイルへの単体型検査に加えて、**全ファイルを一括で
`include` に渡す型検査**は、個々には気づきにくい規模の大きい問題
(存在しないストアへの依存、モデル単位の型欠落)を効率よく洗い出せる。
既存の smoke テスト自身が「間違った値」を正解として固定していた
ケース(`sameSite: "lax"`)もあり、**発見のたびに関連する smoke の
アサーションも合わせて確認すること**。

### 0.10d. line-console にも同じ一括型検査を拡大 — 認証機能全体が壊れていた

`internal-app` だけでなく、まだ点検していなかった `line-console`・
`public-site` にも対象を広げた(全 28 ファイル)。`line-console` から
**過去最大級に重大な発見**が相次いだ:

- **`guardWrite` の import が 4 ファイルすべてで欠落**(`ai/ask`・
  `conversations/[id]/messages`・`conversations/[id]/notes`・
  `line/webhook`)。CSRF・レート制限・本文サイズ制限が一切効いて
  いなかった。`guard.ts` のコメントに「どれも書き忘れても動いて
  しまうので、ルートごとに書くと必ず抜ける——抜けても平常時は何も
  起きず、攻撃されて初めて分かる」とあり、まさにその状態だった。
- **最重要**: `authorize.ts` の `currentUser(req)`(**認証の中核関数、
  6 箇所の API すべてが依存**)が、存在しない `currentSession` を
  呼んでいた——`@platform/guard` からの import が欠落。**呼ばれた
  瞬間に確実に例外を投げる**ため、`line-console` の認証機能全体が
  この変更以降一度も正しく動作していなかった可能性がある。
  `@platform/guard` から import して修正した。
- `health/route.ts`: 存在しない `usePrisma` を参照(`internal-app` からの
  コピペミス。`line-console` は memory 実装が無く常に Prisma 必須の
  設計なので、その条件分岐自体が不要)。死活監視が確実にクラッシュ
  していた。`DATABASE_URL` の有無だけを見る形に直した。
- `ready/route.ts`: `report.status === "ok"` という比較——実際の型は
  `"healthy" | "unhealthy"` で `"ok"` は現れない。**このエンドポイントは
  常に 503 を返し続けていた**。`"healthy"` との比較に直した。
- `services.ts`: `createLogger({ service: "line-console" })` という
  誤ったオプション名(正しくは `base: { service: "..." }`)——
  **line-console のすべてのログに service ラベルが一度も付いていなかった**。
- `ai/ask/route.ts`: 毎リクエスト `createAiGateway({ providers: [] })`
  を作り直し、存在しない `complete()` を呼んでいた(`chat()` が正しい
  メソッド名)。`internal-app` の `ai-gateway.ts` と同じパターンで
  `services.ts` に共有インスタンス(`aiGateway`)を作り、`defaultModel`
  も正しく設定して直した。
- ログ関数の引数順序ミス(`warn(msg, obj)` ではなく `warn(obj, msg?)`
  が正しい)を 3 箇所(`ai/ask`・`customer.ts`・`line/webhook`・
  `conversations/[id]/messages`)で発見・修正。

**AI Gateway の API キーは `env.ANTHROPIC_API_KEY` ではなく
`featureEnv.ANTHROPIC_API_KEY` で読むこと。** `.env.example` の
`# ANTHROPIC_API_KEY=`(意図的にコメントアウトされた任意設定)を
`env.` で直接読むと、smoke の「.env.example にある環境変数か」検査が
`env.` プレフィックスしか見ておらず検出してしまう——`internal-app` は
`featureEnv` という別名経由で読んでいるためすり抜けていた
(これも smoke 検査自体の盲点だが、今回のスコープ外として記録のみ)。

**`line-console` は、認証・死活監視・AI 機能・ログという 4 つの中核
機能がほぼすべて機能していなかった可能性がある。** 本番相当の環境で
実際の挙動を最優先で確認すること。

### 0.10e. セキュリティ観点での横断点検 — mcp/route.ts の本文サイズ制限漏れ

`internal-app` は CSRF・本文サイズ制限を `withApiObservability`
(instrument.ts)に一元化しており、`line-console` のような「import
忘れ」は起きにくい設計。**その前提で「本当に全 249 route.ts がこの
入口を通っているか」を機械的に確認した。**

書き込み系メソッド(POST/PUT/DELETE/PATCH)を持つルートのうち、
`withApiObservability`/`withApi` を通っていないのは `mcp/route.ts`
1 件のみだった。詳しく検証した結果:

- **CSRF 対策の欠如は問題ない**: 認証が Bearer トークン(セッション
  Cookie の値をクライアント側で手動コピー)方式のため、ブラウザの
  暗黙認証を悪用する CSRF 攻撃は原理的に成立しない。
- **本文サイズ制限は基盤(`handleHttpMcp`)側にも無かった**。他の AI
  エンドポイント(`ai/summarize`)が同時実行制限を持つのと対照的
  ——巨大なペイロードでメモリを圧迫されるリスクがあったため、
  `mcp/route.ts` に独自の本文サイズ制限(1MB)を追加した。

**この点検自体で、自分が追加したコメント文字列(`` `withApiObservability` ``
という言及)を smoke の検出用正規表現が誤って「保護あり」と拾って
しまう事故が起きた。** コメント中の言及と実際の呼び出し
(`= withApiObservability(`)を区別するよう検出ロジックを直した——
「コメントと実装が一致しているか」という点検観点そのものに、
点検コード自身が引っかかった形。

**教訓**: 一元化された保護の仕組みがあっても、「本当に全ルートが
その入口を通っているか」は別途機械的に確認する価値がある。
`internal-app` は設計自体は堅牢だったが、確認する仕組みが無ければ
漏れに気づけない。

### 0.10f. テスト目線の点検 — 重大バグ発見箇所にユニットテストが無かった

`server` 層 168 ファイルのうちユニットテスト(`.test.ts`)を持つのは
8 ファイル(約 5%)、`app/api` の 249 個の `route.ts` に至っては 0 件
だった。代わりに検証を一手に担う `tools/smoke.mjs`(2,389 件の
アサーション)のうち、**974 件(約 41%)は `.includes()` によるソース
コードの文字列検査**——実際に関数を呼ぶのではなく「この文字列が
書かれているか」しか見ていない。

**このセッションで見つけた最重大バグ(自己承認防止の欠落・sendback
機能欠落・`currentSession` の import 漏れ等)が起きた核心ファイルは、
いずれもユニットテストが無かった。** 文字列検査では import 漏れの
ような問題を検出できない——「実際に呼んで動くか」を確認する仕組みが
必要だった。

**対応**: `doc-approval-repo.test.ts`(8 ケース)・
`attendance-approval-repo.test.ts`(8 ケース)・`invoice-repo.test.ts`
(6 ケース)を新規追加した。既存の `approval-repo.test.ts` が変換関数
(データマッピング)のみをテストしていたのに対し、新しいテストは
**業務ロジック本体(`decide`・`recordPayment`)を実際に呼び出す**。
特に自己承認防止・`sendback`・`{ increment }` によるアトミック加算
という、このセッションで発見・修正した挙動そのものを検証しており、
同じ種類のバグが再発すればすぐに気づける。

**残る課題**: `authorize.ts`(認証)・`payables-repo.ts` 等、まだ
ユニットテストが無い重要ファイルは他にも残っている。今回は影響度の
高い 3 ファイルに絞った——網羅的な追加は今後の課題として記録する。

### 0.10g. 運用目線の点検 — 「0が異常なしか未計測か」を区別できていなかった

`docs/ops/CRON_JOBS.md` の一覧を実際の `*/scan` エンドポイントと
機械的に照合したところ、**完全に一致していた**(以前の整備が正確
だった)。

一方、`business-metrics.ts` を見直すと、前回の応急処置(存在しない
`taskStore`/`contractStore` への依存を外し、該当 2 指標を常に `0` の
まま返す形にした)には**別の副作用**が残っていた——`0` が「異常なし」
なのか「まだ測っていない」のか、運用者には区別が付かなかった。
「タスクの滞留は 0 件」という誤った安心を招きかねない。

`BusinessMetrics` に `unmeasured: string[]` を追加し、API レスポンス
で未計測の指標を明示した。外部監視システム(Grafana 等)へのゲージ
送信(`metrics.setGauge`)は `unmeasured` を運べないため、その旨を
コメントで明記し、ダッシュボード側での注記追加か
TaskRow/ContractRow の実装が要ることを次の担当者に残した。

### 0.10h. apps 側開発の運用方針を確定 + 境界判定ツールを追加

**今後の運用方針(確定)**:

- `packages/`(基盤)を編集した場合 → フル版(`preflight.mjs`・smoke
  もフル)を回す。
- `apps/` だけを編集した場合 → `node tools/preflight.mjs --apps-only`
  を使う(基盤専用の検査 23 種類をスキップし高速化。実測 28 秒、
  フル版は 290 秒のタイムアウトに掛かることが多かった)。
- `smoke.mjs` 側には同様の絞り込みオプションが無い。apps 側の作業が
  増えてきたら、セクション名にタグを付けて絞り込む等の仕組みを
  今後検討する。

**`tools/triage-boundary.mjs` を新規作成した。** apps 側の開発者が
`pnpm typecheck` の失敗に遭遇したとき、「自分のコードの問題か、
基盤(packages/)側の型が足りないのか」を判断する材料を出す
——tsc のエラー出力を読み、エラー行が `packages/`/`apps/` どちらかで
一次分類し、`apps/` 側のエラーでもメッセージ中の型名が `packages/`
で宣言されている場合は、その宣言元ファイルを提示する。

**自動判定ではない。** ツール自体のコメント・使い方ドキュメント
(`docs/ops/APPS_VS_FOUNDATION.md`)双方に明記した——「型が
packages/ にある」からといって必ず基盤のバグとは限らない。実際に
検証に使った実例(`line-console` が存在しない `AiGateway.complete()`
を呼んでいた件)も、本当は `packages/ai` 側は正しく、呼び出し方
(apps 側)が誤っていたケースだった。誤った確信を与えないよう、
判断材料の提示に留めている。

### 0.10i. `pnpm install` 後、初の実環境フィードバックで発見(packages/mail)

ユーザーが実際に `pnpm install` → `pnpm -r typecheck` を実行し、
**このセッションで初めて `node_modules` が存在する環境**での
フィードバックを得た。`packages/mail/src/transports/smtp.ts` で
型エラーが出た——単体ファイル検査(依存パッケージの型が無い環境)
では絶対に見つけられなかった種類の不整合。

`MailAttachment.content`(`string | Uint8Array`。ブラウザ/Edge でも
使える汎用型として意図的にこう宣言していた)を、nodemailer の
`sendMail` にそのまま渡していた。nodemailer は Node 固有の `Buffer`
(`Uint8Array` を継承するが追加メソッドを持つラッパー)を要求する
——プレーンな `Uint8Array` では型が合わない。

**`MailAttachment` の公開契約は変えていない。** ブラウザ/Edge 環境
での汎用性を保つため、`smtp.ts`(Node 専用の実装詳細)で `sendMail`
に渡す直前だけ `Buffer.from(a.content)` に変換する形にした。他の
送信経路(`memory.ts`)はテスト用でこの変換が要らないため影響しない
——実際にメール添付を送るコードは今のところアプリ側に無く、
既存呼び出しへの影響も無い。

`smtp.test.ts` に実行時テストを 3 件追加し、`Uint8Array → Buffer`
変換・文字列はそのまま・`attachments` 省略時に何も渡さない、の
3 パターンを検証できるようにした。

**教訓**: このセッションの型検査(単体ファイル・全ファイル一括とも)
は `node_modules` が存在しない環境で行っていたため、依存パッケージ
(`nodemailer` 等)の型と正しく突き合わせる検査は原理的にできな
かった。`pnpm install` 後の `pnpm -r typecheck` は、たとえ他の点検を
尽くしていても**独立した価値**を持つ——今回がその実例。

### 0.10j. `pnpm install` 後の2件目(packages/line・slack — fetch(body: Uint8Array))

ユーザー環境で2件目のエラー: `packages/line/src/index.ts(244)`。
`fetch` の `body` に `Uint8Array` 変数(`image: Uint8Array`)をそのまま
渡していたところ、`BodyInit` との型不一致(TypeScript の `Uint8Array`
ジェネリック化に起因)。

**既に基盤内に確立されていた対処があった**: `packages/microsoft/
src/graph.ts` に `body: bytes as BodyInit` という同じ状況への対処が
既にあった。同じパターンを `line/index.ts` に適用。

**予防的に全基盤パッケージを機械的に点検した**(`grep` で
`fetch`/`doFetch` の `body:` に変数を渡す箇所を洗い出し)。
**`packages/slack/src/index.ts` にも全く同じ構造(`content: Uint8Array`
を `body: bytes` でそのまま渡す)があり、型検査で実際にエラーが
再現することを確認してから同様に修正した。** `packages/push`・
`packages/rag`・`packages/ai` にも `body:` の記述はあったが、それぞれ
`new Uint8Array(...)`(その場で構築される値は問題が起きない)・
無関係な `RagDocument.body`(文字列)・`FormData` であり、対象外と
確認した。

**教訓**: 1 件のユーザー報告から、同じパターンを持つ他の箇所を
`grep` で機械的に洗い出し、型検査で実際に再現するかまで確認してから
修正することで、次にユーザーが `pnpm -r typecheck` を回したときに
同じ種類のエラーが連続して出ることを防げた。

### 0.10k. `pnpm install` 後の typecheck.log(1,999 件)から 3 つの重大な発見

ユーザーが `pnpm -r typecheck` の全出力(UTF-16LE、2,820 行)を提出。
エラー種別を集計すると `TS2353` が 1,014 件と突出しており、うち
1,008 件が **`apps/showcase/src/lib/portal-extras.generated.ts` の
1 ファイルに集中**していた。

**発見1: 生成スクリプト自体が二重のバグを持っていた。**
`tools/gen-portal-extras.mjs` が独自に再定義していた `AdrInfo`/
`RepoNode` 型が、実装(`tools/lib/portal-catalog.mts`/
`portal-tree.mts`)側の実際のデータ形と食い違っていた
(`AdrInfo` に `file` が無い、`RepoNode` に `id` が無い)——実装側が
返す値を生成スクリプト側の型定義が正しく表せておらず、生成物
(51 行・142KB という異常な形)への型注釈と実データが大きく矛盾して
いた。**修正中、さらに構文バグを作り込んだ**: `body` 変数は生成物
全体を表す巨大なテンプレートリテラルで、その中のコメントに書いた
バッククォート(`` ` ``)をエスケープし忘れ、生成スクリプト自体が
構文エラーで動かなくなった(`\`` で正しくエスケープして解消)。

**発見2: `noUncheckedIndexedAccess: true`(`tsconfig.base.json`)を
自分の型検査が一度も含めていなかった。** このセッション中ずっと
使ってきた単体ファイル検査用の即席 tsconfig にこのオプションが
無く、「配列・正規表現マッチ結果へのインデックスアクセスが
`undefined` かもしれない」というエラー群(`TS18048`・`TS2532`等)を
一度も検出できていなかった。`packages/ui/src/components/
markdown.tsx`(基盤の共有コンポーネント)に 21 箇所あり、既存の
慣習(`packages/ui/src/lib/schedule.ts` の `spans[i]!`)に倣って
`lines[i]!` で統一し、正規表現の固定キャプチャグループは `?? ""`
でフォールバックした。

**発見3(最大規模): 34 パッケージが Node のグローバル
(`setTimeout`・`Buffer`・`process.env` 等)を実際に使っているのに
`@types/node` を宣言していなかった。** 全 120 パッケージの約 29%。
`grep` で全パッケージを機械的に走査し(Node グローバルを使うファイル
があるか × `package.json` に `@types/node` があるか)、該当する
34 パッケージすべてに、既存の正しい形式(`packages/booking` 等
12 パッケージの慣習)で `"@types/node": "^22.10.0"` を追加した。

**ユーザーが更新後の `pnpm install` を実行し、`pnpm-lock.yaml` を
提出。** `check-lockfile` で照合したところ、差分は 35 件
(`@types/node` を追加した 34 パッケージ分)のみで、他の想定外の
差分は無かった——**この 35 件は、今回追加した `package.json` の
変更をユーザーがまだ `pnpm install` していない(この lockfile は
その1つ前の状態を反映している)ことによるもの**で、次に届ける ZIP
を install し直せば解消する見込み。

**教訓**: `pnpm install` 済みの実環境からのフィードバックは、
オフライン環境でのどんな体系的点検も代替できない価値を持つ
——`noUncheckedIndexedAccess` の見落としのように、自分の検査環境
自体の設定漏れは、自分では気づけない。

### 0.10l. `@types/node` の追加が不十分だった(2回目の typecheck.log)

ユーザーが更新後の ZIP で `pnpm install` → `pnpm -r typecheck` を
再実行し、2件目の typecheck.log(UTF-16LE、1,092 行)を提出。
エラーは 1,999 件 → 427 件まで減ったが、`packages/core/src/
bulkhead.ts` の `Cannot find name 'setTimeout'` が **12 個の異なる
パッケージの typecheck 実行中**に再発していた
(`contract`・`elearning`・`faq`・`pdf`・`search`・`task`・`theme`・
`validation`・`web-storage`・`workflow`・`xlsx`・`rag`)。

**原因**: このリポジトリはソースを直接 `import` する方式
(`"paths": { "@platform/*": ["packages/*/src/index.ts"] }`)で、
ビルド成果物(`.d.ts`)を経由しない。そのため **依存先のファイルは
利用側自身の tsconfig 環境でコンパイルされる**——`@platform/core`
を import するだけで、自分自身は一切 Node のグローバルを使わない
パッケージ(`pdf`・`rag` 等)でも、`@types/node` が無いと
`packages/core` 内の `setTimeout` が解決できず型エラーになる。
前回の修正(直接 Node グローバルを使う 34 パッケージへの追加)は、
この「推移的な依存」のケースを見落としていた。

**対応**: 手作業での推移的依存の追跡は非現実的なため、`.ts` を
持たない `packages/config` を除く**残りすべて(71 件)**に
`@types/node` を追加した(累計 118/120 パッケージ)。加えて apps 側
(`crud-template`・`line-console`・`public-site`。`internal-app`・
`showcase` は既にあり)にも追加した。

**教訓**: ソース直 import 方式のモノレポでは、「このパッケージ自身が
何を使うか」だけでなく「依存先のどのパッケージが何を使うか」まで
遡って `@types/node` 等の型宣言が必要になる。次に同種の型解決エラー
(`Cannot find name 'XXX'`)が特定の少数パッケージだけで起きたら、
まずこのパターン(推移的な `@types/*` 不足)を疑うこと。

### 0.10m. 3回目の typecheck.log(427 → 334 件): import 漏れ・state 完全欠落・Prisma 7

`@types/node` 系のエラーはほぼ解消し、`setTimeout` 系は完全に消えた。
残りは種類の異なる問題だった。

**単純な import 漏れが多数見つかった**(`formatMonthJst`・
`createWebStorage`・`showcaseEnv`・`isSafeExternalUrl`・
`describeUnsafeReason`・`formatYen`・`useUnsavedChangesWarning`)。
影響範囲は `grep` で機械的に洗い出し、同じ関数を使う他のファイルに
同じ漏れが無いかも確認してから直した。`cms-client.tsx` は
`useUnsavedChangesWarning` を誤って `@platform/ui` から import して
おり、正しくは `@platform/form`(パッケージ違いの import ミス)。

**⚠️⚠️⚠️ `overview-client.tsx`(経営ダッシュボード): `error`/
`setError` の `useState` 宣言自体が完全に欠落していた。**
マウント時に必ず呼ばれる `load()` 内で参照されるため、**この画面は
読み込まれるたびに確実にクラッシュしていた可能性がある**——単なる
import 漏れではなく、state 宣言そのものが無かった。

**`business-health.ts` に `business-metrics.ts` と同じ「存在しない
ストア依存」バグが別ファイルにもあった。** `notify-scheduler.ts` から
日次で呼ばれる集計処理が、同じく存在しない `taskStore`/
`contractStore` を import していた。**個々の指標を `try/catch` で
保護する設計だったが、モジュールレベルの import 失敗にはこの耐性が
効かず**、日次の業務健全性チェックが確実にクラッシュしていた。
`business-metrics.ts` と同じ `unmeasured` パターンで修正した。

**Prisma 7: `@prisma/client` から `Prisma`/`PrismaClient` が
export されない(`TS2305`)。** `packages/db` の 3 ファイル
(`tenant.ts`・`search.ts`・`raw.ts`)が影響を受けた。

- `tenant.ts`: `PrismaClient` 型を安全に除去できた——実行時には
  既に `as unknown as { $extends: ... }` という構造的キャストで
  扱われており、公開シグネチャだけが型に依存していた。ジェネリック
  関数(`<T extends { $extends: ... }>`)に書き換えた。
- `search.ts`: `db: PrismaClient` パラメータは `RawCapableClient`
  (既存の構造的な型)に置き換えられた。**`Prisma.raw`/`Prisma.sql`
  (全文検索の SQL 組み立て)はあえて直さなかった**——調査の結果
  `fullTextSearch` は**リポジトリ全体で実際の呼び出しが 0 件**
  だったため、実害が無いことを確認して保留した。
- `raw.ts`: **`sql`/`queryRaw`/`executeRaw` は死活監視の 3 エンド
  ポイントで実際に使われており、放置できない。** それでも
  `Prisma.sql` の自前実装は行わなかった——SQL インジェクション対策の
  中核であり、誤った実装は安全性そのものを壊しかねない。加えて
  Prisma 7.2.0 には `Prisma.sql` の合成に関する未解決の既知バグ
  (GitHub Issue #28963, 2025-12)があることを web 検索で確認した。
  現在の実際の呼び出しはすべて `sql\`SELECT 1\`` という固定文字列
  (パラメータ補間なし)であることを明記し、実環境で `Prisma`/
  `Prisma.sql` の正しい import 元を確認してから直すよう、次の担当者
  向けの注記を残した。

**教訓**: 自分の環境に `@prisma/client` 自体がインストールされて
いないため、この種のエラー(`TS2305`)は原理的に検証できない
——`TS2307`(モジュールが見つからない)としてノイズ扱いされ、
実際には検証していないのに「エラー 0 件」と誤認しかねない。
SQL インジェクション対策のような安全性の中核に関わる箇所は、
検証できない状態で推測により修正するより、正直に「保留した」と
伝えて実環境での確認を仰ぐ方が誠実である。

### 0.11. 通知設定(`decideDelivery`)がほぼ全経路で無視されていました

`resolveDelivery`/`decideDelivery`(利用者ごとのチャネル選択・静音時間の
判定)を、**アプリ全体で `chat.ts`(メンション通知)の 1 箇所でしか
呼んでいなかった**。つまり `/api/notifications/preferences` で
どう設定しても、大半の通知(アンケート督促・経費承認・アラート等)は
決め打ちのチャネルで送られ、**設定が一切反映されていなかった**。

**接続した 2 箇所**:

- `chat.ts` のメンション通知に push チャネルを追加
- `surveys/remind-scan`(アンケート督促)に `decideDelivery` を導入

#### 型検査が「未読ダイジェストが呼ばれると必ず落ちる」バグを発見

`chat.ts` の `sendUnreadDigest` が `mentionDirectory.get(userId)` を
呼んでいたが、`mentionDirectory` は `resolve`(非同期)しか持たず
`.get` は存在しない。**未読ダイジェストの cron が実行されるたびに
必ず例外を投げていた。** 調べると `userId` は既にメールアドレス
そのものだったので、`resolve`(ハンドル→メール変換)自体が不要
——`userId` をそのまま使う形に直した。

#### アンケート督促にも「配列を to に渡す」問題があった

```ts
await appMailer.sendMail({ to: pending, ... });  // pending は複数人分
```

前回メール機能で見つけた「`to` に配列を渡すと受信者全員に他の宛先が
見える」問題と同じ形。1 件ずつ送るよう修正した。

#### ✅ 対応完了: 経費承認通知(`expense-notify-service.ts`)も同じ穴を修正した

**「壊すリスクがある」として一度見送ったが、慎重に再設計して対応した。**
核心のアイデアは**「Outbox のプロトコル自体は一切変えず、積む直前で
1 宛先 = 1 エントリに分解する」**こと。`enqueueExpenseTransition` で
`mail.to`(複数宛先の配列)を宛先ごとに別々の `store.add` 呼び出しに
分解し、`MailPayload.to` を単一文字列に変えた。

dedup のキー生成(`JSON.stringify(msg.payload)`)も `relayOutbox` の
挙動も変更していない——ペイロードの形が変わっただけで、確実配信の
仕組み(dedup・再試行)には一切触れていない。**副産物として、宛先ごとの
再試行が独立するようになった**(以前は複数の承認者への 1 通が失敗すると
全員分が再試行されていた)。

後方互換の即時送信版(`notifyExpenseTransition`)にも同じ穴があり、
同様に 1 件ずつ送るループに修正した。

**✅ 対応完了(2026-08)**: `decideDelivery` をこの経路にも統合した。
`enqueueExpenseTransition` を `async` 化し、宛先ごとに
`decideDelivery(preferenceStore, to, { category: "approval" })` を呼んで
`email` チャネルが無効な人には積まない。既定設定に `email` が含まれる
ため、未設定の利用者は今まで通り届く(後方互換)。

**smoke の一時ファイル置換方式に落とし穴があった。** `expense-notify-
service.ts` の import 文をスタブに差し替えて動的実行するテストが
smoke にあり、新しく追加した `from "./platform-services"` /
`from "./notification-prefs"` の置換ルールが無く、実行時に
`ERR_MODULE_NOT_FOUND` で落ちた。**新しい import を足したら、
smoke の置換テーブルも一緒に見直すこと**——今回の教訓。

### 0.12. 給与明細の一括 PDF 生成を実装しました

showcase の `payslip-pdf-batch.ts` にはこう書かれていた:

> 実運用では @platform/jobs の Worker で並列処理・失敗リトライを行う。

**`internal-app` には一括 PDF 生成の機能自体が無かった。** 全社員分を
同期処理で生成すると数分かかり、リクエストがタイムアウトする——README
の例そのもの(「100 件の PDF 生成を画面から実行すると数分間なにも返らない」)。

`PayslipBatchJobRow` を追加し、`@platform/jobs` の `createMemoryQueue`
で非同期化。API はすぐ `202` を返し、画面はジョブ ID をポーリングして
進捗を見る。**失敗した従業員 ID を記録する**——「誰の明細が届いていないか」
を後から追えないと、問い合わせに対応できない。

**PDF レンダラ未設定ならジョブを作る前に止める。** 作ってから全滅させると
「投入できたのに失敗した」という分かりにくい状態になる。

#### ⚠️ この機能を、気づかずに 2 回実装しました

同じセッション内で、**前のターンで完成させていたことに気づかないまま、
同じ調査・設計・実装を最初からやり直した。** smoke に新しいテストを
足そうとしたときに、ほぼ同一のセクションが既に存在することに気づいて
発覚した(重複ブロックは除去済み)。

**幸い実装内容はほぼ一致しており**(既存の smoke アサーション 7 件が
無変更で緑になった)実害は無かったが、これは偶然に近い。

**教訓**: 長いセッションで新しい実装に着手する前は、
`grep -rn "<機能名>" tools/smoke.mjs docs/ops/HANDOVER.md` 等で
既存の実装・記録の有無を確認すること。今回 HANDOVER への記録も
最初の実装時に漏れていた(このセクションが今追加された理由)。

### 0.13. SMS-OTP を「TOTP 未設定者向けの代替 2FA」として実装しました

TOTP(認証アプリ)は既に実装済みだったが、**認証アプリを入れられない・
入れたくない人には強制できない**。SMS-OTP を代替として接続した。

**スキーマを 2 つ追加**: `UserPhoneRow`(電話番号)・`OtpChallengeRow`
(OTP チャレンジ。平文のコードは持たず `hashOtpCode` でハッシュ化)。
どちらも `UserRow` とは別テーブル(給与プロファイルと同じ方針)。

**ログインフローへの統合**: TOTP 未設定 かつ 電話番号登録済みの場合のみ
SMS-OTP を要求する。電話番号も無ければ、これまでどおり 2FA なしで通す
(「強制しない」方針を継続)。試行回数を必ず書き戻す・検証成功後に
チャレンジを消す、を徹底した。

**Twilio 未設定でも起動失敗にしない。** `TWILIO_*` が揃わなければ
`smsEnabled = false` として SMS を諦める。

#### 型検査が既存の重大なバグを発見

`login/route.ts` のバックアップコード検証で `r.verified`(存在しない
プロパティ)を参照していた。正しくは `r.valid`。**`r.verified` は常に
`undefined` になるため、バックアップコードによる復旧が一度も
機能していなかった**——TOTP アプリを紛失した人の唯一の復旧手段が、
実は動かないコードだった。SMS-OTP 統合でこの箇所に型検査を通して発見。

#### `@platform/push` と同じ依存宣言忘れをもう一度踏んだ

`@platform/sms` を `package.json` に宣言し忘れ、`check-app-transpile`
が「next build で失敗します」を検出。**新しい `@platform/*` を
アプリに導入するときは、`import` だけでなく `package.json` への
追加も必ず確認すること**(2 回連続で同じミスをした)。

#### 削除確認ダイアログの欠如も検出

`security-client.tsx` の電話番号解除ボタンが確認なしで削除していた。
`useConfirm` を導入し、「次回ログインから SMS 確認コードが届かなく
なります」という影響を明示する確認ダイアログを追加した。

### 0.13b. DateTime 移行を 25 カラム実施(残り 1 件のみ)

AttendanceRow.date / InvoiceReceiptRow.receivedAt / UserRow.createdAt /
ReviewRow.createdAt / SurveyRow.closesAt / SurveyRow.createdAt /
SurveyResponseRow.submittedAt / LendingRow.lentAt / InquiryRow.createdAt /
SignatureRow.signedAt / WebhookSubscriptionRow.createdAt /
ServiceAccountRow.createdAt / ServiceAccountRow.lastUsedAt /
SecretRow.updatedAt / MailboxRow.sentAt / ExportScheduleRow.lastRunAt /
ReportScheduleRow.lastSentAt / PurchasePaymentRow.paidAt /
FeePaymentRow.paidAt / ManualJournalRow.date / DocApprovalRow.submittedAt /
AttendanceApprovalRow.submittedAt / UserRow.passwordSetAt /
UserRow.totpEnabledAt / UserRow.sessionsRevokedAt

#### `UserRow` の残り 3 カラムを、見積もりを訂正して移行した

以前「26 箇所・null 許容・時刻比較あり」として見送っていたが、
改めて `grep` で実ファイル数を数え直すと **3 ファイルのみ**だった
(「26 箇所」は行数ベースの過大な見積もりだった)。実際の使われ方も
文字列比較(`startsWith` 等)は無く、単純な存在確認か、呼び出し元が
既に `new Date(str)` で変換した後の比較だけだった。**「見送る」判断も
一度で終わらせず、後で実態を確かめ直す価値がある**——この教訓を残す。

残り 1 件(`LendingRow.returnedAt`)は一意制約のセンチネル値として
`""` を使う設計のため、意図的に対象外のまま。

`check-schema-types` が指摘していた「日時が String」27 件のうち、
影響範囲を精査できた 2 件を移行した(27 → 25 件)。

**方針**: 基盤パッケージ(`@platform/attendance`)や外部から見える
アプリ内公開契約(`ReceiptStore` 等)の型(`string`)は変えない。
**DB 層だけを `DateTime`/`@db.Date` にし、リポジトリの境界
(`rowToEntry` / `rowToReceipt`)で変換する。**

- `AttendanceRow.date`: 日付のみなので `@db.Date`。`startsWith` による
  月次検索は範囲検索(`gte`/`lt`)に置き換えた
- `InvoiceReceiptRow.receivedAt`: 時刻込みのフルタイムスタンプなので
  通常の `DateTime`。変換は `new Date(str)` / `.toISOString()` で単純

`UserRow.createdAt` / `ReviewRow.createdAt` も同じ方針で移行した(いずれも
フル日時なので `DateTime`、変換は単純)。`UserRow` の型検査では
副産物として **`upsert`/`update` の型定義が実態とズレていたこと**も
見つかった(`create` が全フィールド必須だったが `totpSecret` 等は
実際は省略可能・`sessionsRevokedAt` が `update` の型に無かった)。

`SurveyRow.closesAt`(nullable)/`createdAt` も移行した。
`surveysDueForReminder`(督促の判定関数)は `Survey` 型(公開契約)を
受け取る純粋関数なので、DB 型だけ変えれば境界(`rowToSurvey`)で吸収できた
——同じファイル内の `SurveyResponseRow.submittedAt` は範囲を絞って
今回は見送った(1 カラムずつ確実に進める方針を継続)。

`SurveyResponseRow.submittedAt` も同じファイル内の続きとして移行した。
**なお `PeriodLockRow.lockedAt` は別のタイミングで既に移行済みだった**
——件数の再カウントで気づいた(21→19 件、1 カラムの変更のはずが 2 件減)。

`LendingRow.lentAt` も移行したが、**`returnedAt` は意図的に見送った**。
コメントに「PostgreSQL の一意制約は null を重複とみなさないので、null の
ままだと同じ備品を何人でも同時に借りられる(過去に実際に起きた)」と
明記されており、空文字センチネル(`@@unique([code, returnedAt])`)に
依存する設計だった。**「日時はすべて DateTime にする」という単純な
ルールではなく、個別の設計意図を確認してから進めること**——
これがまさにその実例。

`ServiceAccountRow.lastUsedAt` を移行中に**未接続の機能**を発見し、
その場で修正した。このフィールドを実際に更新する処理がどこにも
存在せず(`update` は `active` のみ受け付け)、**API キーの最終使用日時が
表示専用のまま放置されていた**。

`ServiceAccountStore.markUsed(id)` を新設し、`v1/invoices`(唯一の
APIキー認証エンドポイント)の認証成功直後に呼ぶよう配線した。
**`await` しない(fire-and-forget)**——記録の失敗を理由に本来の
リクエストを失敗させたくない。Prisma 実装側も `.catch(() => undefined)`
で例外を握りつぶし、二重に配慮している。

残り 6 件は 1 カラムずつ影響範囲を精査してから進めること(`ExportRunRow.at` は
今回意図的に見送った)。`FeePaymentRow.base`(Float)は移行対象外——
前回「小数に意味がありうるため意図的に残した」対象で、`paidAt` の移行時も
金額 Float の件数(3 件)が変わらないことを確認した。

#### `ManualJournalRow.date` の移行で、`as unknown as` キャストが隠していた型不整合を発見

`manual-journal-repo.ts` 単体に直接型検査を通したところ、既存の
`ManualJournalStoreDb` インターフェースが**同じファイル内の実装コードと
2 箇所も食い違っていた**——`findMany` の型定義が `orderBy: { date: "asc" }`
のみを許可していたのに、実装は `take: 500` と `"desc"` を渡していた
(コメントには「並び順も desc に変えました」と明記されているのに、
型定義だけ更新されていなかった)。

**なぜこれまで見過ごされていたか**: `platform-services.ts` の配線が
`db as unknown as ManualJournalStoreDb` という**型チェックを完全に
バイパスするキャスト**だった。この構造では、ファイル内部の型定義と
実装の食い違いが外部の型検査では検出されない。

**教訓**: `db as unknown as X` という形のキャストを使っているリポジトリは、
外部から回す型検査だけでは内部の不整合を検出できない。**そのファイル
単体に直接 `tsc` を通す**ことで初めて見つかる種類のバグがある。

#### 全 56 箇所を機械的に点検し、2 件目を発見(audit-log.ts)

`as unknown as` キャストは `platform-services.ts` に **56 箇所**ある
(`grep -oP '(?<=as unknown as )\w+'` で抽出)。全部を手作業で見るのは
非現実的なため、**全 server ファイルに機械的に型検査を通すスクリプト**
で走査した。

`audit-log.ts` にも同じ構図の不整合があった——`findMany` の型定義に
`take` が無いのに、実装は `take: AUDIT_ALL_LIMIT + 1` を渡していた。
修正済み。

**残り 54 箇所には同種の不整合は無かった**(全 server ファイルへの
型検査で確認)。56 箇所全部を手作業で見るのは非現実的だったが、
型検査を自動化して機械的に回すことで現実的な時間で全数点検できた。

#### `DocApprovalRow.submittedAt` の移行で、3 件目の take 不整合 + 重大な既存バグを発見

`doc-approval-repo.ts` にも `manual-journal-repo.ts`・`audit-log.ts` と
同じ `take` の型不整合があった(修正済み)。

**より重大な発見**: `DocApprovalRow` インターフェースに `submittedBy`
(誰が申請したか)が定義されておらず、`rowToApproval` が**このフィールドを
常に欠落させていた**。コードのコメントには「自分が出した文書を自分で
承認させない」「`submittedBy` が空なら判定できない」とあり、
**`get()`/`listPending()` 経由で読んだデータは自己承認防止のチェックが
実質的に機能しない状態だった可能性がある**(修正済み。`upsert` の
create/update 両方に `submittedBy` を追加)。

#### 追跡調査: メモリ実装だけに存在した「必ずクラッシュする」バグ

上記 2 件を詳しく調べた。**`!approval` のチェックより先に
`approval.submittedBy` を参照しており、`approval` が `undefined` だと
必ず例外を投げていた。** Prisma 実装は最初から `if (!row) return` を
先に行う正しい順序だったため、**影響はメモリ実装(開発・テスト環境)
のみ**。null チェックを先頭に移動して修正した。

#### ⚠️⚠️⚠️ 訂正: `sendback` は死んだコードではなく機能欠落だった

当初 `action !== "sendback"` を「常に真の死んだ分岐」として削除したが、
これは**誤りだった**。既存 smoke テストの失敗で発覚した。

**真相**: `@platform/workflow` は `"approve" | "reject" | "sendback"`
という 3 値を正式にサポートし、`sendBack` という差し戻し関数も実装
済みだった。しかし `attendance-approval-repo.ts` と
`doc-approval-repo.ts` の `decide` メソッドのシグネチャが、誤って
`"approve" | "reject"` の 2 値だけに制限されていた——コメントには
「差し戻しは許します」と明記されていたのに、型定義がそれを妨げていた。
**勤怠承認・文書承認では差し戻し機能を一度も呼び出せなかった。**

両ファイルとも、`decideState`/`decide` の型に `"sendback"` を追加し、
`action === "approve" ? approve(...) : action === "reject" ? reject(...)
: sendBack(...)` という正しい三項演算子に修正した(`approval-repo.ts`
の経費承認が持つ正しい実装パターンに合わせた)。

#### ⚠️⚠️⚠️ さらに発見: 2 つの実装の食い違い(メモリ ⇄ Prisma)

修正の過程で、**2 つの実装が互いに異なる欠落を持っていた**ことが
分かった:

- `attendance-approval-repo.ts`: **メモリ実装**に自己承認防止
  チェック自体が無かった(Prisma 実装にはあった)
- `doc-approval-repo.ts`: **Prisma 実装(本番相当)**に自己承認防止
  チェック自体が無かった(メモリ実装にはあった)

**後者が特に重大。** 文書承認(発注・請求書)の本番相当の実装で、
申請者本人が自分の承認を、権限さえあれば通せてしまう状態だった
可能性がある。両方とも、欠けていた側にもう一方のロジックをコピーして
揃えた。

#### sendback を API 層・画面まで配線した

`attendance/approvals/decision/route.ts`・`approvals/decision/route.ts`
両方の入力検証に `"sendback"` を追加した。

**勤怠承認は画面まで完了**: `attendance-approvals/approvals-client.tsx`
に「差し戻し」ボタンを追加。理由は任意入力(却下と違い、単に
「確認し直したい」だけの場面もあるため必須にしない)。

**`window.prompt` の呼び出し回数の上限に注意**: 却下用と差し戻し用で
別々に `prompt` を書くと、アプリ全体の呼び出し回数が上限(4 件)を
超えて smoke が落ちた。**却下・差し戻しはどちらも「理由を聞く」操作
なので、1 つの `prompt` 呼び出しにまとめ、メッセージと必須/任意だけを
`action` で分岐させた。**

**文書承認(発注・請求書)も画面まで配線した(訂正)**。改めて調べると
`decide`(個別処理)と `decideOne`(一括処理)は独立した別関数で、
一括の逆操作ロジック(`action === "approve" ? "reject" : "approve"`)は
`runBulkDecision` 内だけで完結しており、個別行への `sendback` 追加とは
干渉しないと判明した。個別ボタンにのみ追加し、一括処理には加えて
いない(差し戻しは案件ごとに理由が異なりやすく、一括承認/却下とは
性質が違うため)。

**理由入力は `window.prompt` ではなく `PromptDialog` を使った。**
最初 `window.prompt` で実装したところ、アプリ全体の呼び出し回数が
上限(4 件)を再び超えた。smoke のコメントに「段階的に `PromptDialog`
へ置き換える」という明確な方針があったため、新規追加は最初から
正しい方法(基盤の `PromptDialog`、`invoices-client.tsx` 等が既に使う
パターン)に切り替えた。
(`clockIn`/`clockOut` のように「そもそも DateTime 化できない」性質の
カラムも混在しているため、一括変換は危険)。

#### 型検査が既存の認可欠落を発見(7 件目)

`purchase-orders/[number]/receipts/route.ts` で
`requirePermission(user, "purchase:write")` が **`run()` 関数の中**に
あり、`user` はその関数のスコープに存在しなかった(実引数は `actor`
という文字列のみ)。**この API には実質的に認可が一度も効いていなかった**
——`handlePOST` 側では `currentUser` を取得するだけで、権限チェックは
呼ばれていなかった。

**認可は冪等の外側で行う設計原則**(このセッションで繰り返し確立)
どおり、`handlePOST` 側・`withIdempotency` を呼ぶ前に移動して修正した。

### 0.13c. 全 249 個の route.ts を一括型検査し、10 種の型欠落 + 実バグ2件を発見

`manual-journal-repo.ts`・`audit-log.ts`・`doc-approval-repo.ts` で見つけた
「型定義が実装を反映していない」パターンをきっかけに、**`lib` 配下 28
ファイル + `app/api` 配下全 249 個の `route.ts` を一括で型検査**した。

**`lib` 配下は全て健全**だった。route.ts の一括検査で、同種の型欠落を
さらに 5 件発見(累計 10 件): `chat-store-prisma.ts`(`messageReactionRow`
等 4 モデル + `$transaction`)・`board-post-repo.ts`(`deleteMany`・
`$transaction`)・`inventory-repo.ts`(2 箇所: `take`・`orderBy`)・
`invoice-repo.ts`(`select`・`{ increment }`)・`mcp-tools.ts`
(`info.more_records`)・`search-index.ts`(`take`)・`settings-repo.ts`
(`orderBy`)。いずれも `db as unknown as X` キャストが外部の型検査から
食い違いを隠していた。

#### ⚠️⚠️⚠️ 発見①: ファイルダウンロードが一度も正しく動作していなかった

`fileStorage.get(key)` は `Result<Uint8Array>`(例外を投げない設計)を
返すのに、`route.ts` は `try/catch` で例外を捕まえる書き方をしていた。
**この `catch` には絶対に到達せず**、成功時も `bytes` 変数には
`Uint8Array` ではなく `Result` オブジェクトそのものが入っていた。
**社内ファイルのダウンロード機能全体が、実装されて以来一度も正しく
動作していなかった可能性がある。** `got.ok` で判定し `got.value` を
取り出す形に修正した。

#### ⚠️⚠️⚠️ 発見②: business-metrics.ts が呼ばれるたびに確実にクラッシュしていた

`taskStore`・`contractStore` という**存在しないストアを import** していた。
`@platform/task`・`@platform/contract` は純粋ロジック関数群のみで
永続化ストアを提供しておらず、アプリ側にも実装が無い。**cron
エンドポイント(`business-metrics/scan`)は呼ばれるたびに確実に例外を
投げていた。** 新規ストアの実装はスキーマ追加を伴いスコープ外のため、
該当 2 指標(タスク期限切れ・契約アラート)を未計測のまま安全にスキップ
する応急処置とした(次回、ストアを実装してから接続すること)。

#### その他の発見

- `admin/users/route.ts`: 監査ログの `changes` 引数の型に `roleChanges`
  が無く、「誰がいつ権限を変更したか」が記録されていなかった
- `notification-center.ts`: オブジェクトリテラルに `take` プロパティが
  2 つあり(`take: 100, ..., take`)、後勝ちの JS 仕様で実害は無かったが
  意図不明な古いコードの残骸だった
- `packages/session/src/auth-session.ts`: `sameSite: "lax"`(小文字、仕様上
  不正確な表記)。加えて `AuthSessionOptions` に `salt` が完全に
  欠落しており、渡すと `createSession` が必ず例外を投げる設計だった
  ——ただしこの関数はどのアプリからも実際には呼ばれておらず実害は無し
- `packages/ui/src/lib/bulk.ts`: `BulkItemResult` という同名の
  `interface` が 2 回宣言され、`key` の型が `string`/`unknown` で
  矛盾していた(コメントの二重化から、コピペの残骸と判明)

**環境ノイズと確定したもの**: `import-repo.ts`・`approval-repo.ts` 等の
`db is unknown` 系(生成物型が単体検査で解決されないため。
`expense-repo.ts` でも同じ現象を再現して確認済み)、`packages/ai` の
`BlobPart` 不一致(実プロジェクトは `lib: ["ES2022"]` のみで `DOM` を
含まない——検査環境が `DOM` を追加していたことによる副作用)、
`packages/ui`/`packages/mcp` 等の `TS6142`/`TS2307`(jsx 未設定・
react/@types/node 未インストール)。

これでこのセッションを通した型検査による発見は、実行時バグ・型不整合・
機能欠落を合わせて**累計 28 件**になった。

### 0.14. 未検証 API を 24 → 0 件にしました

セッション全体を通して 24 本の未検証 API を 1 本ずつ精査し、最終的に
**ゼロ**にした(下限記録済み)。

**前半で 11 本を修正**(24→13件): `chat/rooms` 系 4 本・`cms/tags`・
`expenses/transition`・`notifications/preferences`・`quotes/state`・
`rag/search`・`showcase/login`・`showcase/password`。

**`notifications/preferences`(通知設定)が最重要の発見だった。**
`as NotificationPreference` のキャストのみで、**完全に無検証**のまま
保存されていた。`channels` に配列でない値、`quietHours.start` に
時刻でない値を入れてもそのまま保存される——通知配信ロジック全体が
この設定を読むので、壊れた値が入るとチャネル解決や静音時間の判定が
全体的に壊れる。

`expenses/transition` では `expense.amount` が `as ExpenseRecord` の
キャストのみだった。`amount` が数値でなければ `routeByAmount` の比較が壊れ、
**意図しない承認段数のルートに落ちる**(この経路は以前にも承認バイパスの
事故が記録されていた箇所——同じ経路にもう一つの穴が残っていた)。

**後半で残り 13 本を修正**(13→0件): `inventory/reorder-draft`(発注点起票)
の `dueDate` に形式検証が無く `invoices` と同じ穴(壊れた日付が発注書に載る)
があった。`ai/image`(画像生成)に費用上限・同時実行制限が一切適用されて
いなかった(要約 API には接続済みだったのに、コストがより高い経路が
素通しだった)。`learning` のクイズ回答が配列であることを確認していなかった
(掲示板の添付と同種の穴)。

#### `check-input-validation` 自身の見落としを 2 回発見

- 専用の検証関数(`validateItemInput`)を「未検証」と誤判定
  (雛形 `crud-template` が対象で、危うく正しい作法を壊すところだった)
- 変数名が `body` 以外(`payload` 等)だと拾えなかった
  (`vitals/route.ts` は丁寧な検証があったのに未検証扱いされていた)

いずれも `--list` で一件ずつ実物と突き合わせて発見した。
**数字だけ見て直すと、正しいものを壊す。**

### 0.15. cron で叩くべき API の一覧が存在しませんでした



`bookings/remind-scan` を追加しようとして気づいた——**「どの scan API を、
どのくらいの頻度で叩くべきか」を一覧できるドキュメントが無かった。**
認証の仕組み(`CRON_TOKEN`)は各 route のコメントに書かれているが、
運用者向けの一覧が無いと、**新しい scan を追加しても誰にも気づかれず
定期実行されないまま埋もれる**。

`docs/ops/CRON_JOBS.md` を新設し、既存 7 本 + 新規 1 本の計 8 本を
頻度目安つきで一覧化。全 route のコメントから相互参照も張った。

#### `check-api-auth` が偶然の一致で緑になっていた箇所を発見

新設した `bookings/remind-scan`(`isCronAuthorized` のみで認可)を
`check-api-auth` が「認可が無い」と誤検出した。原因は判定パターンに
`isCronAuthorized` が含まれていなかったこと。

調べると、**既存 7 本の `*/scan` は `currentUser` を import しているだけ
(呼んではいない)で、たまたま正規表現にマッチして通っていた。**
つまりこれまでの緑は偶然の一致であって、正しい理由での緑ではなかった。
`isCronAuthorized` を判定パターンに追加し、8 本すべてが**正しい理由で**
緑になるよう修正した。

### 0.15b. stripe に理由明記 + sms の tier 昇格漏れを発見

`@platform/stripe` の使用箇所を確認したところゼロだった。
`@platform/commerce` と同じ判断(社内業務システムに顧客向けカード決済は
不要)で README 冒頭に理由を明記した(tier 自体は既に incubating)。

**incubating 全件を再点検したところ、`@platform/sms` が実際は
2 ファイルで使われているのに `incubating` のまま放置されていた。**
SMS-OTP を実装したセッション内で `push`/`jobs` は正しく `stable` に
昇格したのに、`sms` だけ忘れていた——**自分自身が作った見落とし**。
`stable` に修正した。

### 0.16. EC 機能を stable → incubating へ降格しました

`@platform/commerce`(40 関数)は `internal-app` では `review-repo.ts`
（レビュー機能）しか使っていない。カート・注文・在庫引当・割引などの
EC 本体は実アプリでの使用実績が無い(showcase のカートはデモ)。
社内業務システムに EC 機能は不要と判断し、`incubating` へ降格した
——将来の実装候補ではなく、**使う予定が無いことの記録**。

### 0.17. 予約(booking)を DB 永続化しました

`booking-service.ts` にはこう書かれていた:

> 今は安全だが、DB に移すと二重予約が起きる。`await` を挟んだ瞬間に
> 他のリクエストが走り、同じ枠を両方が「空いている」と判定する

**これはまさにこれから行う作業への警告だった。** それまでは
メモリ配列のみで、**再起動すると全予約が消えていた**。

#### 二重予約を防ぐ設計: `pg_advisory_xact_lock`

`(resourceId, start, end)` の一意制約では、時間帯がずれて重複する
ケース(9:00-9:30 と 9:15-9:45)を防げない。**予約という行が
作られる前は、ロックする対象の行自体が存在しない**ので
`SELECT ... FOR UPDATE` も使えない。

`resourceId` の値そのものに advisory lock をかけ、同じリソースへの
予約リクエストを直列化した。ロックはトランザクション終了で自動解放される。
**検査(空いているか)はロックの内側で行う**——外で確認すると、
確認とロック取得の間にまた隙間ができる。

#### `orderBy` の付け忘れを、また踏んだ(4 回目)

`mail-suppression-repo.ts`・`push-repo.ts` に続き、今回のトランザクション内
`findMany` でも `check-order-by` に引っかかった。**今回は型定義側で
`orderBy` を必須にした**(オプショナルにしない)——検査に頼るだけでなく、
次に呼び出しを足すときに TypeScript が書き忘れを止めるようにした。

### 0.18. アップロードした画像の EXIF(位置情報)を除去するようにしました

`upload/route.ts` のコード自身にこう書かれていた:

> アラートは出さない(略)メトリクスに載せて傾向を見る——増えてきたら
> `@platform/image` で変換する仕組みを**入れる合図**

つまり**「これは未完成」とコードが自己申告していた**。`@platform/image` には
`stripMetadata()` という完成した専用 API があり、**呼ばれていなかっただけ**。

**領収書の写真は撮影場所が残る。** これまでは検出してログに警告するだけで、
実際には除去していなかった——**機微な位置情報が全部残ったまま保存されていた**。

`stripMetadata()` を接続し、除去後のサイズで `fileManager.register` するよう
処理順序も直した(先に登録すると一覧の表示サイズが実物と食い違う)。
除去に失敗しても保存は取り消さない(元のファイルは残る。ただし必ず記録する)。

#### ついでに見つけた既存の不具合

`upload/route.ts` が `log` を `platform-services.ts` から import していたが、
**実際は `services.ts` にあった**。私が触る前から存在した、動くはずのない
import だった(型検査をこのファイルに初めて通して見つかった)。

#### `isSubPath`(`@platform/fs`)は正当な理由で未使用

パストラバーサル対策は `@platform/storage` の `createLocalStorage` が
**自前で複製実装**していた。「アダプタごとに必要な依存が違う(S3 版は
ファイルシステムを使わない)ので `@platform/fs` に依存しない」という
明記された設計判断——未接続イコール未対策ではなかった一例。

### 0.20. Web Push を実装し、AI 承認キューに接続しました

`@platform/push`（VAPID・暗号化まで実装済みだったが未使用）を接続。
`PushSubscriptionRow`（端末ごとの購読）を追加し、
`/api/push/subscribe`（GET/POST/DELETE）を新設。

**AI承認キューと組み合わせ**: MCP 経由で破壊的操作(請求書取消)が
提案された瞬間、`invoice:write` を持つ全員へ push が飛ぶ。
理由付きで通知され、通知が失敗しても提案自体は成立する
（通知は補助であって唯一の経路にしない）。

**未設定なら起動失敗にしない。** VAPID 3 変数が揃わなければ
`pushEnabled = false` として push を諦め、他の経路(メール・inApp)に任せる。

#### preflight フルで、自分の実装漏れを 3 件発見

- **`@platform/push` を `package.json` の依存に宣言し忘れ**
  （`check-app-transpile` が検出。**next build で確実に失敗する**種類のミス）
- `push-repo.ts` の `findMany` に順序指定漏れ（`mail-suppression-repo.ts` で
  一度直したのと**同じパターンをまた作っていた**）
- `DELETE /api/push/subscribe` に削除監査が無く `check-safety-parts` の
  下限を割った。**本人が自分の端末を解除するだけの操作**と判断し、
  `// no-audit:` で理由付きの免除を宣言（監査を追加するのではなく）

### 0.24. 給与の社会保険料を自動計算・取引先へのメール送付を実装しました

**給与**: `calcInsuranceDeduction`(基盤にあったが未使用)を接続。
`PayrollProfileRow`(生年月日・扶養人数)を**新しい別テーブル**として追加——
`UserRow` には混ぜない(認証のたびに読む場所に機微な個人情報を同居させない)。
**プロファイル未登録なら控除しない**(概算で埋めると、本物の額と取り違えられる方が危険)。

**源泉徴収税は未実装のまま。** 国税庁の公式税額表データが無く、
捏造すると間違った額を天引きする事故になるため、差し込み口だけ用意した。

**メール**: 取引先への請求書メール送付(`/api/invoices/[number]/send`)と
配信停止(`/unsubscribe`)を新規実装。`MailSuppressionRow` を追加。

#### 配信停止リストで危険な設計に気づき、直しました

最初は `all()` で全件取得して `Set` として渡す形だったが、
**取得件数が上限を超えると、超えた分の配信停止希望者が
「停止していない」扱いになり、気づかれずにメールが送られ続ける**
——特定電子メール法違反に直結する欠陥だった。

`has(email)` を 1 件ずつ呼ぶ形に設計を変更。`findMany` 自体を使わない
経路にしたことで、`check-unbounded-query` の指摘も自然に解消した。

#### `MailMessage.to` に配列を渡さない

基盤の型定義にある注意（`to` は受信者全員に見える。社外へ配列で送ると
個人情報漏洩事故になる）を踏まえ、**1 件送信が前提**の設計にした。
一斉配信は `bcc` へ渡す `bulkRecipients()` を別途用意している
（呼び出し元はまだ無い——一斉配信機能自体が未着手）。

### 0.28. AI 時代の安全機構を実装しました

**「AI に道具を持たせたとき、危ないことをしたら人が止められるか」**は、
今後さらに重要になる観点です。基盤には部品があったので、繋ぎました。

| 機能 | 場所 | 内容 |
|---|---|---|
| **AI 承認キュー** | `/admin/ai-approvals` | MCP 経由で AI が提案した破壊的操作(請求書取消)を、人が承認するまで実行しない |
| **RAG 除外チェック** | `rag/ingest` `rag/transcript` | `no-ai`/`confidential` タグの文書は**登録前に**弾く。議事録は人事評価が紛れやすく特に危険 |
| **RAG 質問応答** | `/api/rag/ask` | 検索結果を AI に渡して直接回答。幻覚検出(`findUnsupportedClaims`)付き |
| **AI ガバナンス** | `ai-gateway.ts` | 費用上限(人ごと)・同時実行制限・指示の乗っ取り検出・データ隔離 |
| **MCP HTTP 版** | `/api/mcp` | 読み取り専用。stdio 版は書き込み可(承認キュー経由) |

**承認キューの設計判断**: 理由(`reason`)を必須にする(無いと人が判断できない)。
承認した人を必ず記録する(「AI が勝手にやった」で終わらせない)。
即実行系(入金記録)まで承認制にはしない(道具を渡す意味が薄れる)。

### 0.27. AI ガバナンス(判断・実行の可視化)を実装しました

`createDecisionLog` / `createToolCallLog`（基盤）は `ai-gateway.ts` に
配線済みだったが、**中身を見る手段がありませんでした**。記録するだけでは
意味が薄く、事故が起きて初めて「そういえば記録はあった」と気づくものになります。

| 場所 | 内容 |
|---|---|
| `/admin/ai-governance` | 未確認の判断・道具ごとの失敗率・直近の実行を一覧表示 |
| `/api/admin/ai-governance` | 上記の取得 API |

**MCP の全ツール実行を一括で記録**するようにしました。個々のハンドラに
記録コードを埋め込むと、ツールを足すたびに書き忘れが起きるため、
`buildMcpTools` の戻り値をまとめてラップしています。

**`isError` も失敗として数えます。** ハンドラは例外を投げず
`errorResult(...)` を返す設計なので、`catch` だけでは拾えません。

**未確認の判断を画面の最上部に警告表示**します。`unreviewed()` が
溜まっていたら、確認されないまま業務に使われている可能性があります。

### 0.3. 法令対応の未使用機能を 4 つ繋ぎました

**基盤に実装があるのに、アプリから一度も呼ばれていなかった**ものです（ADR 0024）。
いずれも **API と画面の両方**まで繋ぎ、smoke で固定してあります。

| 機能 | 画面 | 何が見えるようになったか |
|---|---|---|
| **36 協定の上限** | 勤怠 | 「今月あと 12:30 残業できます」・違反/注意の件数 |
| **下請法の遵守** | 買掛 | 支払期日 60 日超の指摘・**遅延利息を金額で**（年 14.6%） |
| **償却資産税** | 固定資産 | 課税標準・税額・申告期限（1/31） |
| **印紙税** | 契約 | 「電子契約なら ¥N が不要」・**過怠税は本税の 3 倍** |
| **開示請求** | 管理 | 保有区分・利用目的・根拠・保存期間を一括表示 |
| **削除請求** | （API のみ） | 消せないものを**法令の根拠つき**で返す |

**金額で出すことにこだわりました。** 「電子契約にしましょう」では動きませんが、
**「年 18 万円浮きます」なら判断できます**。過怠税・遅延利息も同じ理由です。

#### 実装できなかったもの（データが無い）

| 機能 | 足りないデータ |
|---|---|
| `checkWorkerRecords`（労働者名簿） | `UserRow` に生年月日・住所・履歴・雇入れ日が無い |
| `checkWageLedger`（賃金台帳） | 同上 |
| `checkRetention`（保存期限） | 退職日が起算日。同上 |
| `allocateFEFO`（期限順の引き当て） | `StockMovementRow` に `lotId` / `expiry` が無い |

**スキーマ追加は業務判断**なので止めました。労働者名簿は労基署の調査で
必ず見られる帳簿ですが、**個人情報が大幅に増える**ので
`@platform/pii` の適用や保存期限の設計とセットで考える必要があります。

### 0.32. 個人情報の開示・削除請求に対応しました

`@platform/pii` の `buildDisclosureReport` / `erasePersonalData` /
`buildErasureReceipt` は**一度も呼ばれていませんでした**。
本人から請求があれば**遅滞なく応じる義務**があり、
期限を過ぎると勧告・命令の対象になります。

| | 場所 |
|---|---|
| 開示請求（法 第 33 条） | `/api/privacy/disclosure` + **`/admin/disclosure`（新規）** |
| 削除請求（法 第 35 条） | `/api/privacy/erasure` |
| 削除の判断画面 | `/admin/erasure`（**既にありました**） |

#### ⚠️ テーブルを足したら `CATEGORIES` に 1 行足すこと

**ここは検査で守れません。**

開示請求の難所は「**どこに何を持っているか分からない**」ことです。
データは勤怠・経費・チャット・監査ログと複数テーブルに散っており、
請求が来てから手作業で集めると**必ず取りこぼします**。

`apps/internal-app/src/app/api/privacy/disclosure/route.ts` の
`CATEGORIES` が保有場所の定義です。**足し忘れると、そのデータは開示されません**
——つまり**「持っていない」と答えたことになります**。後から発覚すると重い。

#### 判断したこと

**パスワードハッシュと 2FA の秘密鍵は開示しません。**
本人のものではありますが、**開示書面（紙・メール）に載せると漏えいの経路になります**。
「保有している事実」だけ伝えれば足ります（smoke で固定済み）。

**削除 API は実際には消しません。** 「消したらこうなる」の下見を返すだけです。
消去は取り返しがつかないので、**誤って叩いても事故にならない形**にしました。

**既定は匿名化です。** 行ごと消すと「先月の残業時間の合計」が退職者のぶんだけ減り、
**過去の数字が変わります**。氏名だけ潰せば統計は保てます。

**「本人が消してと言ったから消す」は誤りです。**
勤怠（労基法 第 109 条・5 年）、帳簿（法人税法・7 年）、監査ログは
**消すと今度は法令違反**になります。API は消せないものを
**理由つきで返す**ので、そのまま本人への回答に使えます。

### 0.35. 公開されていない実装が 1 件ありました ⚠️

`packages/tax/src/stamp-tax.ts`（印紙税・約 300 行）が
**`index.ts` から一度も export されていませんでした。**

これは「部品はあるのに使われていない」の中でも**最も気づきにくい形**です:

- アプリから `import` すると**型エラー**
- `pnpm advisor find "印紙税"` でも**出てこない**（公開 API を見ているため）
- `docs/ai/module-list.md` にも載らない
- **存在自体が見えない**

使われていない部品は「繋げば済む」のですが、
**公開されていない部品は繋ごうとして初めて気づきます。**

`tools/check-unreachable-modules.mjs`（**検査 82 種類目**）を追加しました。
`check-imports` は「書いた import が実在するか」を見ますが、
**逆向き（実装があるのに出口が無い）を見る検査が無かった**のが穴でした。
375 ファイルを検査して、現在の漏れはゼロです。

#### 「直すと検査が落ちる」構造も直しました

`stamp-tax` を公開した瞬間、**smoke が `ERR_MODULE_NOT_FOUND` で落ちました。**

smoke は `@platform/tax` を一時ディレクトリへ写すとき、
**`withholding` だけを名指しで差し替えて**いました。この書き方が **7 箇所**。

> **公開漏れを直すと smoke が落ちる。**

直す動機を削ぐ構造で、**「使われていない部品」が放置される理由の一つ**が
ここにあったと思います。`copyTaxPackage()` を作り、
**`index.ts` が再輸出している兄弟モジュールを機械的に拾う**ようにしました。
**次に何を足しても smoke を直す必要はありません。**

### 1. 100 人規模になると壊れるところ ⚠️⚠️

**前提が変わりました。** 当初は数人でしたが、**100 人まで増える**見込みです。

**いま動いているのは「1 台・数人」だから**です。
**台数を増やすか、人が増えるか**のどちらかで、次の順に壊れます。

**移す対象と手順は「6. メモリ実装のまま」**にあります——
**ここは「何が起きるか」、あちらは「どう直すか」**です。

| 順 | 何が起きるか | 直すもの |
|---|---|---|
| **1** | **再起動で全員がログアウト**する | セッションの保存先（メモリ → Redis / DB） |
| **2** | **同じ通知が 2 回届く**（2 台構成） | `lockStore` を Redis 実装へ |
| **3** | **二重登録が起きる**（申請ボタンの連打） | `idempotencyStore` を Redis / DB へ |
| **4** | **上限が台数倍になる**（レート制限が効かない） | `ratelimit` の保存先 |
| **5** | **一覧が遅くなる**（全件読み込み） | 索引と `take` の見直し |

**1 台で運用する限り、1〜4 は起きません。**
**2 台目を立てる日が、直す期限**です。

**5 は人数だけで起きます。** 100 人が毎日使えば、
**1 年で経費が 3 万件、監査ログが数十万件**になります——
**「今は速い」は「100 人でも速い」ではありません**。

**先に測ってください**——手順は `docs/ops/LOAD_TESTING.md` にあります。
**遅くなってから直すのは、動いているものを触ることになり危険**です。

### 2. 保持期間の削除が自動で走っていない ⚠️

**`purgeExpired`（保持期間を過ぎたデータを消す）は実装済み**ですが、
**API からしか呼べません**——**人が押さないと消えません**。

**押す人がいなければ、監査ログは数十万件のまま残ります。**
100 人が毎日使えば、**1 年で数十万件**です。

**やること**: `notify-scheduler.ts` に定期実行を足してください。

```ts
{
  name: "purge-expired-data",
  schedule: "0 3 * * 0",        // 毎週日曜 3 時（JST）
  preventOverlap: true,
  jitterMs: 60_000,
  lock: { store: lockStore, ttlMs: 30 * 60_000 },
  handler: async () => {
    const results = await purgeExpired("system");
    log.info({ results }, "保持期間を過ぎたデータを削除");
  },
},
```

**日曜の深夜にする理由**: 削除は重いので業務時間を避けます。
**土曜だと月曜まで誰も見ない**ので、**平日の朝に「消えた」と気づける**日曜にします。

**消えて困るものが混ざっていないか、`retention.ts` の `TARGETS` を必ず確認してください。**
**電子帳簿保存法の対象は 7 年**、労働者名簿は 5 年です——**短く設定すると法令違反**になります。

**なぜ AI が足さなかったか**: smoke がこのファイルを差し替えて読み込むため、
**`./retention` の差し替えを足す必要があり、影響範囲が読めませんでした**。
**動作を確かめられない変更を入れるより、手順を残す**方が安全と判断しました。

### 3. 復元訓練をしていない ⚠️

`check-drill` が警告を出し続けています。**バックアップは取れていますが、戻せるかは一度も試していません。**

> 取得だけして復元を試したことがない状態は、バックアップが無いのとほとんど同じです。

手順は `docs/ops/BACKUP_RESTORE.md` にあります。
**機械にできる部分は `pnpm drill` に自動化済み**なので、数分で流せます
(`pnpm drill:dry` で何をするかだけ見られます。DB も要りません)。
**残る手作業は 2 つ**です(① アプリを起動して画面を開く ② 詰まった箇所を書き足す)
(2026-08 に復号の確認を機械へ移した。そのまま貼れる起動コマンドも drill が出します)。
やったら `node tools/record-drill.mjs` で記録してください。

> **2026-08 に drill 自身の誤りを 1 件直しました。** 鍵の有無を `ENCRYPTION_KEY` で
> 見ていましたが、**この名前はどこにも存在しませんでした**(使っていたのは drill と、
> drill を見張る smoke の 2 か所だけ)。実際に使うのは `SECRET_MASTER_KEY`
> (未設定なら `SESSION_SECRET` を流用)。**正しく設定された環境でも必ず警告が出る**ため、
> 訓練を実施した人が警告を無視するようになるところでした。
> smoke 側も「名前が実在するか」を見る形に変え、誤った名前を固定しないようにしています。

### 4. 外部サービスとの実接続を確認していない

契約は **8 件**(freee / google / line / microsoft / notion / paypal / slack / zoho)ありますが、**実応答の記録が 0 件**です(鍵が無いため)。
「モックでは通るが本物では動かない」を検出できていません。

**まず `node tools/record-contract.mjs --list` を実行してください。**
どのコネクタに何の鍵が要るか、いま何が揃っているかが一覧で出ます(全 21 個)。

鍵が用意できたら `docs/ops/TESTING_GUIDE.md` の手順で記録を取ってください。
**1 件でも揃えば、そのコネクタだけ記録が始まります**(残りは黙ってスキップ)。8 件を待つ必要はありません。

> **2026-08 に構造的な欠陥を直しました。** 契約は 5 件あるのに記録ツール
> (`tools/record-contract.mjs`)の `RECORDERS` は 3 件しかなく、
> **zoho と line は鍵を用意しても永久に記録されない**状態でした。
> C004 は「未記録」と警告し続けますが、それが *鍵待ち* なのか *そもそも記録できない* のかを
> 区別できず、待っていても一生埋まりません。2 件を実装し、
> **契約に記録手段が無ければ落ちる C006** を足しました(発火も確認済み)。
> 契約を追加するときは、契約ファイル・記録手段・CI の Secrets を**必ず 3 点セット**で足してください。

### 5. セッションの失効が繋がっていない ⚠️

**ロールを外しても、セッションが切れるまで（最大 8 時間）権限が続きます。**
退職者も同じです。ADR 0017 は「セッションの無効化を先に」と決めていますが、
**その手段がアプリに繋がっていません**。

**仕組みは基盤にあります**——`@platform/session` の `createRevocationGate`。
繋ぐには ①失効ストアを本番用で用意 ②`currentUser` で毎リクエスト確認
③ロール変更・退職処理から失効を呼ぶ、の 3 つ。
**②は全リクエストに 1 往復増える**ので、性能を測ってから決めてください。

**暫定の緩和策**: 退職時は**最終出社日の終業後に権限を外す**——翌朝には失効しています。

### 6. メモリ実装のまま（台数を増やすと壊れる）

**1 台なら動きます。** 2 台以上にする前に移してください——
`notifyOutbox` / `notifySeen` / `idempotencyStore` / `lockStore` / `rpa-service` の `lock`。

**起動時に `log.error` で該当を挙げます。** 移す手順は
[メモリ実装から Redis / DB へ移す手順](#メモリ実装から-redis--db-へ移す手順)にあります。

**1 台のままなら、これは「終わっていないこと」ではありません**——
Redis を用意する方が手間です。

### 7. 本番へのデプロイを一度もしていない ⚠️

**手順は書いてありますが、通したことがありません**
（`docs/ops/DEPLOY_AWS.md` の「初回チェック(未検証ゆえ必ず)」）。

**最初の 1 回は必ず詰まります。** 詰まったところを**その場で手順書に足して**ください
——次の人が同じところで止まります。

**先に確認しておくとよいこと**:

| | なぜ |
|---|---|
| **日本語フォント** | 無いと PDF が**豆腐（□□□）**になります。**本番のコンテナで初めて分かります** |
| **`TZ=Asia/Tokyo`** | 無いと「今日」を数える処理が**9 時間ずれます** |
| **`SESSION_SECRET`** | 32 文字未満だと**起動時に止まります**（わざとです） |
| **`PUBLIC_SITE_URL`** | `localhost` のままだと**起動時に止まります**（CMS のプレビューが開けないため） |

**上の 4 つは検査で守っています**が、**その他は本番で初めて分かります**。

### 8. この課題を人に渡していない

`docs/onboarding/04-task.md` の実地課題は、**2026-08-08 に 1 度実施しました**(記録は同ファイル末尾)。
結果は「**手順書だけで完成した**」。ただし 6 件で詰まり、**うち 4 件は手順書が実態と食い違っていた**もので、
すべて修正済みです。

- 課題の作成先が既に存在し、**答えがリポジトリの中にあった**(題材を会議室予約へ差し替え)
- `NEW_APP.md` の手順4 が指す文字列が smoke.mjs に無かった(件数の決め打ちは廃止済みだった)
- `NEW_APP.md` に**生成物 3 つの作り直し**が手順に無く、全部やっても preflight が赤だった
- デモが**統合で消えたアプリ**(`apps/equipment-app`)を指していた
- smoke のラベルが `基盤デモ30件`(実際は 69)のまま。緑で通るので誰も気づかない
- `check-docs-links` に「これから作るファイル」の除外が無く、**手順書に作成先を実名で書けなかった**

**残っているのは「社内の別の人にやってもらう」ことです。** 実施したのは AI であり、
バス係数は 1 のまま動いていません。次の人は差し替え後の題材(会議室予約)で試してください。

> 詰まりの共通点は「**以前は正しかったが、実装を直したときに文書とラベルだけが取り残された**」形でした。
> 数値は `check-doc-numbers` が見張っています。
> **手順そのもの**（「このファイルのこの文字列を直せ」）は長く見張られていませんでしたが、
> **2026-08 に「資料にこう書いてあるか」を見る検査を 8 件足しました**
> （一覧は `CHECKS.md` の「資料の文言を見張る検査」）。
>
> **ただし見張っているのは主要な文言だけ**です——
> **手順書の細かい記述は、いまも誰も見張っていません**。
> **課題をやって詰まったら、その場で手順書を直してください**。

---

## 意図的に残していること（直さなくてよい）

上限として記録済みで、**増えないことだけ**を守っています。

2026-08 の時点で、多くは **0 まで減らし終わりました**。残っているのは次の 3 つだけです。

| 項目 | 数 | なぜ残しているか |
|---|---|---|
| アプリから使われていないパッケージ | 11 | **理由は全件書いてあります**（`tools/gen-module-list.mjs` の `UNUSED_REASONS`）。`web-storage` / `integrations` / `color` は**基盤の内部で使う**もので、アプリから直接呼ばないのが正しい形。`cache` は「**Redis を使う場面がまだ無い**」、`hid` は「対応する機器がまだ無い」、`json` / `xml` は 2026-08 新設で**使う場面が来ていないだけ**。**理由の無いものがあれば生成時に警告**します。**この数は検査していません**——`showcase` も `apps/` にあるため「デモだけが使う」を機械的に分けられず、`pnpm gen:all` の出力(`未実戦 N`)で確認してください |
| 長い行（200 字超） | 1,363 | 割ると意味が変わる箇所（JSX 属性・長い文章）。色を CSS 変数へ移した分だけ増えた（`text-neutral-500` → `text-[var(--color-muted)]`）|
| 600 行超のファイル | 6 | `utils/numbers.ts` などは関数の集まりで、分割しても探しやすくならない |

**0 になったもの**（増えたら検査が失敗します）:

生タグ・色の直書き（基盤とアプリの両方）・基盤と同名の実装・自前で描いたグラフ・
認可の無い API・「今」から UTC の日付を切る箇所。

**上限を上げるときは理由をコミットに書いてください。** 検査を黙らせる操作なので、
理由が残らないと事故と区別がつきません。

---

## 【この資料の範囲】基盤・showcase・crud-template だけ

**各アプリのことは、各アプリの `HANDOVER.md` に書いてください。**

| 内容 | 書く場所 |
|---|---|
| `packages/` の関数の仕様・落とし穴 | **ここ** |
| `tools/` の検査 | **ここ** |
| `apps/showcase` / `apps/crud-template` | **ここ**（見本と雛形なので基盤の一部です） |
| `apps/internal-app` の画面・業務ルール | `apps/internal-app/HANDOVER.md` |
| `apps/line-console` のこと | `apps/line-console/HANDOVER.md` |
| `apps/public-site` のこと | `apps/public-site/HANDOVER.md` |

**判断の基準**: **他のアプリでも起きるなら、ここ**。
**そのアプリでしか起きないなら、アプリ側**です。

**迷ったら、ここに書いてください。** アプリ側に書いたものは、
**別のアプリを作る人が読みません**——**同じ失敗を繰り返します**。

**2026-08 より前の記述には、アプリ固有のものが混ざっています。**
**移していません**——**仕分けを誤ると、基盤の知見が失われる**方が損だからです。
**探すときは両方を見てください。**

## 危ないところ

> **【この節の読み方】**
>
> **上から順に読まないでください。** 800 行以上あり、**読み切ることを想定していません**。
>
> **これは「調べもの用」です。** 直そうとしているものの名前
> （関数名・ファイル名・画面名）で **`Ctrl+F` して**ください。
> **そういう作りにした理由**が見つかることがあります。
>
> **新しい順に並んでいます。** 上ほど最近の判断です——
> 古い記述と食い違っていたら、**上が正しい**と考えてください。
>
> **見つからなければ、それでよい**です。全部が書いてあるわけではありません。
> **「なぜこうなっているのか分からない」ときの手がかり**として使ってください。


| 場所 | なぜ危ないか |
|---|---|
| **`pnpm typecheck` の 282 件を直した(2026-08)** | **型検査が回っていなかった間に溜まったもの**です。**構文エラー 6 件が `crud-template` にあり、そのファイルの意味検査が飛んでいた**ため、**同じアプリの `instrument.ts` が未定義の関数(`getWriteLimiter` / `MAX_BODY_BYTES`)を呼んでいる**のに誰も気づけませんでした——**雛形なので、`pnpm new-app` でコピーされた全アプリに伝播します**。**構文エラーは「その 1 ファイルの問題」では済みません**。 |
| **`sendBack` は自己承認の禁止から外す / 最初のステップからも差し戻せる** | 2026-08 まで `requireNotSelf` を通しており、**自分の申請を自分で取り下げられません**でした。さらに `toStep >= currentStep` を弾いていたため、**1 段階しかないワークフロー(勤怠の月次承認・文書承認)では差し戻す手段がありませんでした**——`decide(…, "sendback")` が常に失敗します。**前に進める指定だけを拒む**形に直しました(`toStep > currentStep` が不正)。承認・却下の自己承認禁止は**従来どおり**です。 |
| **`textContent`(XML)が順序を崩していた** | `<p>あ<b>い</b>う</p>` が **`"あうい"`** になっていました。`text`(直下のテキストを連結)と `children` を別々に持つ構造では、**両者の前後関係が失われる**ためです。`XmlNode` に **`parts`(出てきた順)** を足して直しました。**`text` / `children` は互換のため残して**あります——順序が要るのは `textContent` だけです。 |
| **`findDuplicatePayments` は `id` が無ければ自分自身を除かない** | 2026-08 に「値の一致で自分を除く」のをやめました。**同じ請求書を 2 回入力した場合がまさに値の一致**で、**最も明白な二重払いを見逃して**いたためです。**見逃すより余分に指摘する**方を採っています。`id` を渡せば従来どおり除きます。 |
| **完全一致(`toBe` / `toEqual`)でテストを固定しない** | `pageCss` に印刷向けの手当てを、`summarizeResults` に `partial` / `allFailed` を足したとき、**中身は正しいのにテストだけが落ちました**。**足したら落ちる**形のテストは、改善のたびに書き直すことになります。**見たい 1 点を `toContain` / `toMatchObject` で確かめる**方が、意図も伝わります。 |
| **`import.meta.url === \`file://${process.argv[1]}\`` で「直接実行か」を判定しない** | Windows では `import.meta.url` が `file:///C:/…`、`process.argv[1]` が `C:\…` になり、**一致しないので本体が動きません**。**何も出力せず、エラーも出ずに終わる**ので気づけません(2026-08、`node tools/check-coverage.mjs --set-floor` が Windows で無反応だった)。**7 本**がこの形でした。正しくは `process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)`——他の 20 本はこちらで書かれています。 |
| **カバレッジの設定はルートの `vitest.config.ts` に置く** | ワークスペース実行では**カバレッジは全体で 1 つ**なので、各パッケージの設定(共通プリセット)は**使われません**。**対象を絞らないと、生成物・設定ファイル・`tools/` まで分母に入ります**——2026-08 の初回計測では Prisma の生成物(`.wasm-base64.js` まで)や `smoke.mjs`(24,518 行)が数えられ、全体が **16%** と出ました。この状態だと**検査を 1 本足すだけで割合が下がり、テストを減らしていないのに CI が落ちます**。`check-coverage-scope` が見張っています。 |
| **カバレッジの閾値は `vitest.preset.mjs` に置かない** | `thresholds: { lines: 80, … }` が書いてありましたが、**`--coverage` を一度も付けていなかったので一度も評価されたことがありません**でした。実測は全体で約 11%(`ui` は 2%)なので、そのまま有効にすると**ほぼ全パッケージが赤**になり、止まった CI は「とりあえず外す」で無効化されます。判定は `tools/check-coverage.mjs` に寄せてあります(**下限ラチェット**＋ `core` / `crypto` / `guard` だけ絶対値 80%)。 |
| **ワークスペース実行ではカバレッジ設定はルート側が使われる** | `vitest.workspace.ts` を使うと、カバレッジは**全体で 1 つ**になるため、各パッケージの `vitest.config.ts`(共通プリセット)に書いた `reporter` が効かず、**`coverage-summary.json` が出ません**。出ないと `check-coverage` は永久に skip します。`pnpm test:coverage` は **CLI でも reporter を指定**してあります(どちらから来ても出るように)。 |
| **`reindex` が 1 件ずつ upsert していた** | 検索索引の作り直しは**最大 5 万件**を渡しますが、`for` の中で 1 件ずつ `upsert` していました——**DB との往復が 5 万回**で、1 往復 2ms でも 100 秒、ネットワーク越しならその数倍です。**管理画面が固まったように見え、途中で閉じられると中途半端な索引が残ります**。「まとめて消して、まとめて入れる」(1,000 件ずつ)に変えました——索引は**作り直せるもの**なので、失敗しても `reindex` をもう一度叩けば戻ります。**開発中のデータは 10 件なので体感は一瞬**で、使われ始めてから遅くなる種類の問題です。`check-query-in-loop` が上限 0 で見張ります。**「1 件ずつ」が正しい場面もある**(行ごとに違う値を入れる・イベントごとに処理が違う)ので、**理由を書けば免除**します。 |
| **`options` を `config` に書き換えるだけでは足りなかった** | `session/step-up.ts` は引数名が `config` なのに文書は `options` でした。名前だけ揃えたところ、**今度は P4（存在しないプロパティ）が 2 件**——`maxAgeMs` / `rememberSec` は実在せず、正しくは `freshnessSec` / `defaultMaxAgeSec` / `rememberMaxAgeSec` でした。**名前の揺れを直すときは、中身も一緒に確かめる**こと。同じことが `social/share.ts` でも起きています（`target.text` は無く、正しくは `target.title`）。 |
| **一括置換は「最初の一致」に当たる——`@param` の追記では特に危ない** | `dashboard.ts` で `donutSegments` に `@param radius` を足したつもりが、**同じ `@param values` を持つ `computeShares`（上にある）**に入りました。同様の取り違えが `motion-extra.ts`（`mapRange` → `inverseLerp`）と `schedule.ts`（`totalBusyMinutes` → `mergeIntervals`）でも起きています。**`@param` の文言は関数をまたいで重複しやすい**ので、置換の目印にしないこと。**関数名で位置を特定してから行番号で入れる**のが確実です。3 件とも P2 / P5 が即座に捕まえました。 |
| **説明が引数とすっかり入れ替わっていた箇所があった** | `site/banner.ts` の `rotateBanner` は `@param currentPath パス・枠・時点` / `@param options 0〜1 の乱数` と書かれており、**説明が 1 つずつずれて**いました（`navigation.ts` の `breadcrumbFromPath` も `@param path メニュー(入れ子)`）。過去に引数を足したとき、**説明を足さずに位置だけ動いた**跡です。**位置で読む人は必ず間違えます**。 |
| **`--set-limit` が `p5` の行を消していた** | `writeLimits()` が `p2, p3, p4` しか書き戻さないため、**`--set-limit` のたびに `p5` が消え**、次から既定値 0 に戻っていました。たまたま 0 なので気づきませんが、**上限を持たせたくなった日に静かに壊れます**。項目を足したら**書き戻し側も直す**こと。 |
| **同じ引数を 2 回説明している箇所が 9 件あった（P5 を新設）** | `image.ts` の 5 関数はすべて `@param` のブロックが**丸ごと 2 回**書かれており、しかも**片方は実装に無い名前**（`image` / `axis`）でした。説明を書き足すとき、**既にあることに気づかず追記する**と起きます。害は 2 つ——**どちらが正しいか分からない**ことと、**片方だけ直されて食い違いが残る**ことです。`check-tsdoc-params` に **P5** を足し、**上限を持たない（常に 0）**扱いにしました（P1 と同じ）。9 件は後から書かれた薄い方を消し、内容の濃い方を残しています。 |
| **`@param cx / cy 中心` のようなまとめ書きが多かった** | 1 行に 2 つ以上の引数を書くと、**検査は 1 つとしか数えません**——`arcPath(cx, cy, r, startAngle, endAngle)` の 5 つが 3 つに見えていました。**人が読むぶんには通じる**ので、書いた側は間違いに気づきません。1 引数 1 行に直しました。同種のものとして `@param options.duration` が**2 回書かれている**箇所もありました（`useTween`）。 |
| **`@param` の引数名が実装とずれていた（213 → 178）** | `isOpenAt(date, time, weekly, overrides)` の説明が `(date, hours)` になっている、といった食い違いです。**間違った説明は、無い場合より確実に誤らせます**——AI はそのまま読んで**存在しない引数で呼び出すコード**を書きます。よく使うパッケージ（`guard` / `db` / `csv` / `env` / `booking`）から手で直しました。**自動生成はしていません**——「`@param options options`」のような無意味な記述は**検査を黙らせるだけ**で、状態は悪化します。 |
| **引数の切り出しに 2 つの欠陥があった（検査側）** | `splitTop()` が**括弧の深さしか見ておらず**、`csvEscape(value, delimiter = ",")` の**既定値に入ったカンマ**で切れて「引数が 3 つ」と読んでいました——**正しく書いてある関数が指摘される**状態です。直したところ今度は `pick: (tx) => X` の **`=>` の `>` を閉じ括弧**と数えて深さが負になり、`(db, pick, rows)` が 2 つに見えました。`<` `>` を丸ごと無視すると今度は `Map<string, number>` が割れます。**直前が `=` のときだけ数えない**のが正解でした。**6 通りで検証済み**。 |
| **既存の TSDoc と重複させて P1 を発生させた** | `bulk.ts` に `@param` を足したところ、**既に別の場所に同じ説明**があり「並び順が実装と違う（P1）」で落ちました。**P1 は上限を持たない**（型が同じ引数は黙って入れ替わるため）ので、これは正しい挙動です。**足す前に既存の `@param` を全部見る**こと——`grep -n "@param" <file>` で済みます。 |
| **自分で「基盤に上げるべき」を 4 回踏んだ（`clientIp`）** | デモ API を 4 本作る過程で、`x-forwarded-for` を読む同じ 3 行を**毎回コピーしていました**。数えたら **8 ファイル・9 か所**（1 ファイルには 2 回）。**この基盤が防ごうとしている当のもの**を自分でやっていたわけです。`@platform/guard` に `clientIp()` として集約しました。 |
| **上げようとしたら、既に 2 アプリが同じ名前で持っていた** | `check-reimplementation` が即座に指摘。しかも**既存の方が優れていました**——`x-real-ip` も見ており、`x-forwarded-for` を付けない前段（nginx 等）に対応していました。**基盤側を既存に合わせて**書き直し、アプリ側は再エクスポートだけにしました。**「基盤に上げる」ときは、まずアプリ側に同じものが無いか探すこと**——上げる前に `grep` すれば 10 秒でした。 |
| **TSDoc をさらに 95 → 85 に。また説明の入れ替わりが 1 件** | `cast/ranking.ts` の `weightedRating` で、**`minCount` に「全体の平均評価」、`globalMean` に「信頼できるとみなす件数」**と書かれていました（実装は逆）。ベイズ平均の重みなので、**入れ替えて呼ぶと順位が変わります**。`google/oauth.ts` では `scope` と書いてあった引数が実際は **`scopes`（配列）**でした。 |
| **`preflight` の全体実行が 1 回で終わらないほど遅くなっている** | サンドボックスでは 13 分以上かかり、こちらでは完走できませんでした（97 件を 2 つに分けて個別実行し、`check-lockfile` 以外は緑を確認）。`check-scan-reporting` は**単体で 100 秒超**です。`CHECKS.md` は「約 6 分」と書いていますが、**実測とずれている可能性があります**——測る環境で差が出るので断定はできません。CI の所要時間を一度見てください。 |
| **アプリ切り出しの手順書（`docs/ops/APP_EXTRACTION.md`）** | ADR-0026 の段階 3 用。**`line-console`（24 ファイル）から試す**こと——`internal-app` は 680 ファイルで、最初にやるものではありません。調べて分かった落とし穴を書きました: ①`tsconfig.json` の `extends` が `../../tsconfig.base.json` を指しているので**単独では動かない**（コピーして `./` に直す）②`next.config.mjs` の `outputFileTracingRoot` も同じ ③`.npmrc` にレジストリの行と**認証**が要る ④`workspace:*` の置換は 20 件あるので**手で書かない**。 |
| **切り出すと「影響範囲」が見えなくなります** | いま `api-surface.mjs` は「消した API を**どのアプリが使っているか**」まで出せますが、アプリが別リポジトリになると**基盤からは見えません**。破壊的変更の検出そのものは残りますが、**気づくのはアプリ側が版を上げたとき**になります。**遅くなる**ぶん、`docs/HISTORY.md` への記載と更新の案内が今より重要になります。 |
| **TSDoc の食い違いが 0 になりました（213 → 0）** | 5 分類（P1〜P5）すべて 0、**上限もすべて 0** です。違反を置くと赤くなることも確認済み。**ここから先は「増やさない」だけ**——`check-tsdoc-params` が 1 件でも増えたら止めます。 |
| **上限ファイルが「勝手に動く」ことはありませんでした（検証済み）** | 心配していた件を実験しました。`tsdoc-params-limit.json` の値をわざと 99 に書き換えてから、**`gen-all` / `smoke` / `preflight` / `verify-checks` を順に流したところ、どれも書き換えませんでした**（99 のまま）。**上限を書くのは `--set-limit` を明示したときだけ**です。例外は `check-maintainability` で、これは**減ったときに自分で下げる**と TSDoc に明記された仕様です（`--no-ratchet` で止められます）。**「勝手に動いた」と思っていたものの大半は、自分が `--set-limit` を打っていたのを忘れていただけ**でした。 |
| **【未解明】最後の 17 件がいつ消えたか説明できません** | `--set-limit` の直後は「P3=17」と出ていたのに、次に走らせたときは 0 で、上限ファイルも 0 になっていました。**この検査に自動で上限を下げる仕組みはありません**（`--set-limit` のときだけ書きます）。**`git diff` で意図しない変更が混ざっていないか確認してください。** `runtime-boundary`（9→6）は**自分で `--set-limit` を打った結果**、`maintainability` は**仕様どおりの自動ラチェット**でした（上の項目）。**残る謎はこの 1 件だけ**です。念のため `git diff` を確認してください。 |
| **TSDoc を 213 → 17 件（92% 減）** | 残りは名前違い 16 件・説明不足 1 件。実害のあった誤りの例: `formatDuration` の「ミリ秒」（実際は秒。**1000 倍**）、`createSlackClient` の `config` の説明が **`webhookUrl` の話になっていた**（実際は Bot トークン）、`confirmTemplate` / `carouselTemplate` の **`altText` が未記載**（無いと LINE の通知が空になる）、`handleMcpMessage` の **`ctx` が未記載**（権限判定に使う引数）。**書かれていない引数は、存在に気づけません。** |
| **TSDoc の食い違いが 0 件になりました（213 → 0）** | P1〜P5 すべて上限 0 で固定。**以後 1 件でも増えたら落ちます**。あわせて `check-tsdoc`（説明・`@param`・`@returns` の有無）も **2,000 関数で 100%** になりました。**ここから先は「増やさない」だけの管理**です。 |
| **最後に残ったのは `@returns` 1 件だった** | `recordAuditChange` が `Promise<Result<void>>` を返すのに `@returns` がありませんでした。**`Result` を返す関数は「失敗しうる」ことが型に出ている**ので、**失敗したらどうするか**を書く必要があります（監査の記録は失敗しても業務を止めない、など）。`Promise<void>` と違い、**返り値を無視してよい関数ではありません**。 |
| **TSDoc を 213 → 36 件（83% 減）** | 残りは説明不足 20 件・名前違い 16 件。**`options` の中身は型定義まで開く**こと——`allocateFEFO` の options を `asOf` と推測して P4 に落とされました（正しくは `now`）。実装の引数名だけ見ても足りません。 |
| **`formatDuration` の単位が 1000 倍ずれていた（TSDoc）** | 文書は `@param ms ミリ秒`、実装は `formatDuration(seconds: number)` でした。**そのまま読んで `Date.now() - start` を渡すと、2 時間半が 1 万年になります**。TSDoc の食い違いを潰す作業で見つかりました——**「説明が抜けている」を直していると、こういう嘘が出てきます**。tsdoc-p3 は 69 → 57。 |
| **【重要】基盤の配り方が変わります（ADR-0026・採用）** | アプリが数十本・別リポジトリになるため、**`workspace:*` では回らなくなりました**。GitHub Packages に **`@mtmk-cc` スコープで publish** し、アプリは `^2026.8.0` で参照します。版は**日付式・120 パッケージ一括**。用意したもの: `.github/workflows/publish-packages.yml`（タグ起点）/ `tools/prepare-publish.mjs`（publish 直前の整形）/ `tools/rename-scope.mjs`（`@platform/` → `@mtmk-cc/` の一括改名。**1,620 ファイル / 9,217 箇所**）。**まだ誰も使っていません**——改名を実行するまでは今までどおり動きます。 |
| **`prepare-publish.mjs` の書き換えをコミットに戻さないこと** | `workspace:*` を `^版` に変える処理です。**手元に戻すと開発が遅くなります**（基盤を直しても、publish するまでアプリに届かなくなる）。CI の使い捨て checkout の中だけで走らせてください。ツール自身にも警告を出しています。 |
| **`*/` をコメントに書くとファイルが壊れる** | `prepare-publish.mjs` の説明に `packages/*/package.json` と書いたところ、**`*/` がブロックコメントの終端**と解釈され、構文エラーになりました。`packages/<名前>/package.json` に書き換えて回避。**パスをコメントに書くときは `*/` を含めない**こと。 |
| **smoke が「壊れた参照」を固定していた** | `CODEOWNERS` のコメントが `CI_FIRST_RUN.md`（当時の資料。いまは存在しません） を指していましたが、**その資料は `GITHUB_ACTIONS.md` へ統合されて消えていました**。設定手順を探しに行った人は行き止まりに当たります。さらに悪いことに、**smoke が `co.includes("CI_FIRST_RUN")` を条件にしていた**ため、**直すと赤くなる**状態でした——検査が壊れた参照を守っていたわけです。ファイル名での照合をやめ、`check-codeowners` が**コメント内の `docs/*.md` が実在するか**を見るようにしました。**規則より先に、説明の方が腐ります**（説明は誰の CI も落とさないので）。 |
| **AI に検査を回させるなら、出力は機械可読が要る（`preflight --json`）** | 社内で **AI-DLC**（Issue → AI が実装 → MR）を動かす話が出たため、基盤側でできることを考えました。**103 種類の検査は、非エンジニアの MR を安全にする土台そのもの**です——足りないのは中身ではなく**渡し方**でした。日本語の画面出力を AI に読ませると、**どれが落ちたかを取り出すために毎回書式を推測させる**ことになります。`--json` で「落ちた検査の名前と出力」だけを返すようにしました（人向けの出力はそのまま）。**「直す → もう一度回す」を機械が回せます。** |
| **TSDoc を 95 → 73 件（`quote` / `report` / `status-page` / `utils`）** | 半分近くは **`now`（試験で時刻を固定する引数）の書き忘れ**でした。書き忘れると、**呼ぶ側が「時刻を固定できない」と思い込み、試験を書かなくなります**。`convertToInvoice` の `rounding` には「**見積と同じ丸め方にすること**」を添えました——変えると金額がずれます。 |
| **CODEOWNERS は「壊れても静か」——検査を足した（103 種類目）** | GitHub は**存在しないパスの規則をエラーにせず黙って無視**します。`tools/` を改名した瞬間に「レビュー必須のはず」が誰にも通知されなくなり、**気づくのはレビュー無しのものが本番に出たとき**です。`check-codeowners` で、①パスの実体 ②所有者の書式 ③基盤の要所（`packages/` `tools/` `CLAUDE.md`）に規則があるか、を見ます。 |
| **所有者が `@platform-team` のままだった（＝いま機能していない）** | 検査を書いている途中で気づきました。`docs/ops/GITHUB_ACTIONS.md` の手順 1 に「自組織のチーム名に置き換える」とあるとおり、**これはひな形の値**です。GitHub は実在しないチームを黙って無視するので、**現状では Code Owners のレビュー必須が誰にも当たっていません**。検査で `⚠` として知らせるようにしました（**落としません**——配る時点ではこれが正しい状態なので）。**置き換えは組織側の作業です。** |
| **検証用の残骸を自分で残した** | `check-path-length` の検証で作った深い階層のディレクトリ（`packages/core/src/__verify_path__`）が残り、`check-leftover-fixtures` に捕まりました。**検証ケースを外したら、そのとき作られたものも消えたか確かめること**——`verify-checks` は自分が作ったものを片付けますが、**私が手で試した分は片付きません**。 |
| **「名前の揺れ」だと思ったら、中身も全部違った（zoho）** | `createZohoApiClient` の文書が `options.` で実装が `config` だったので**接頭辞を揃えただけ**にしたところ、**P4 が 5 件**出ました——`tokenManager` `service` `dc` はどれも実在せず、正しくは `apiDomain` `accessToken` `basePath` `defaultQuery` でした。`createZohoTokenManager` も同様（正しくは `dataCenter` / `clientId` / `clientSecret` ほか）。**名前の揺れは「中身も違う」の入口**であることが多いので、揃える前に型を読んでください。tsdoc-p3 は 95 → 81。 |
| **検証できると思った 3 件のうち、2 件は本当にできなかった** | `check-package-shape`（tsconfig の無いパッケージ）は 1 ファイルで検証でき、77 件目になりました。一方 `check-docs-orphans` は**資料を 1 本置いても発火せず**、`check-path-length` は **node_modules を測る検査で、無ければ早期終了**していました。**「できないと書いてある」を疑うのは正しいが、疑えば必ず覆るわけではありません**——3 件試して 1 件でした。 |
| **「もう要らなくなった免除」を誰も見ていなかった** | `verify-checks` の除外理由が古くなっていた話は、**免除の仕組み全般に当てはまります**。`check-allow-lists` は**重複キー**を見ますが、**効かなくなった項目**は見ていませんでした。害は分かりにくい形で出ます——**除外だけが残ると、同じ名前で本物の作り直しが起きたときに素通り**します。「昔ここで許したから」という理由で、**未来の違反まで許すことになります**。`check-reimplementation` の `ALLOW` と `check-unused-deps` の `plannedDeps` に、**効いていない項目を知らせる**仕組みを足しました（現状はどちらも 0 件）。 |
| **知らせるだけにして、落とさない** | 上の 2 つは `⚠` で出すだけで、**赤にはしません**。一時的に実装を外している最中かもしれず、**そこで止めると作業の邪魔になります**。`plannedDeps` も同じで、「これから使う」と書いたものを繋いだら消してほしいのですが、**消し忘れでビルドを止める理由はありません**。**落とす／知らせるの使い分けは、その指摘が「いま直すべきか」で決めています。** |
| **除外理由は 3 種類に分けられた（68 → 76 件）** | `verify-checks` の「仕組み上できない」を全件読み直したところ、**本当に無理なものは一部だけ**でした。①**上限が 0 なので実は落ちる**（`check-query-in-loop` / `check-input-validation` / `check-handmade-chart`）——「上限ラチェットだから」は上限が 0 の間は当てはまりません。②**理由が書かれておらず、ただの説明**（`check-package-tier` / `check-deps`）——「package.json を見る検査」は、できない理由になっていません。③**「区別が要る」**（`check-reimplementation`）——区別の仕組み（ALLOW）は既にあります。**残る 34 件のうち本当に無理なのは「リポジトリ唯一のファイルを壊すしかない」もの**（`check-ops-hygiene` / `check-migration-mode` / `check-rollback-ready` など）。 |
| **「できない」と書いた理由は、書いた時点の状態でしかない** | 上の①は、**書いた当時は上限が 0 でなかった**ために正しかった可能性があります。つまり**除外理由は状態と一緒に古くなります**。`verify-checks` に「分類漏れがあると落ちる」仕組みはありますが、**「除外理由が古くなっていないか」は誰も見ていません**。数を増やすより、**ときどき全件読み直す**のが効きました（今回 8 件が動いた）。 |
| **Next 15 の EOL は「待つ」と決めた（2026-08-18）** | Amplify が 16 に対応するまで、こちらからは動かしません。置き先を変える方が技術的には自由になりますが、**課金・権限・監視・運用手順が全部変わる**ので、framework の版のためだけに動かす理由になりません。**ただし受け入れているリスクは ADR-0025 に書きました**——サポート終了後に脆弱性が出ても**修正版が出ません**。内容次第では「待てない」こともあります。10 月が近づいたら Amplify の対応状況を確認してください。 |
| **E2E は「動かない」のではなく「私の手元で動かなかった」だけだった** | 以前「`@axe-core/playwright` 未インストールで E2E が実行できない」と記録しましたが、**誤りでした**。devDependencies に宣言済みで、`e2e.yml` も `playwright install` → 実行まで通します。spec 10 本の構文も正常。**`pnpm install` を流していないサンドボックスの制約を、リポジトリの欠陥として書いていました**。**「自分の環境で動かない」と「壊れている」は別**です。 |
| **E2E に残る本当の問題は lockfile だった** | `e2e.yml` に `# TODO: pnpm-lock.yaml をコミットしたら --frozen-lockfile に戻す` が残っています。`ci.yml` は既に `--frozen-lockfile` なので、**lockfile が無い今は CI 側が落ちます**。E2E だけが暫定で緩めてある状態です。**lockfile のコミットで両方が片付きます。** |
| **「上限ラチェットだから検証できない」は誤解だった（68 → 73 件）** | `verify-checks` の除外理由を読み直したところ、**上限が 0 の検査は普通に検証できます**——1 件置けば 0 を超えて落ちるからです。この誤解で `check-query-in-loop` と `check-package-tier` が「仕組み上できない」に入っていました。3 件とも違反を置いて赤くなることを確認し、除外リストから外しました（`check-deps` の循環依存を含む。発火 65 / できない 37）。**残る 38 件も同じ目で見直す価値があります**——「できない」と書いてあるものを疑うのは、検査そのものを疑うのと同じくらい大事です。 |
| **外部レビューを「判定つき」で置いた（原文のまま置かない）** | 社外の AI に評価してもらった 50 項目を `docs/ops/EXTERNAL_REVIEW_2026-08.md` に整理しました。**評価者はリポジトリを見ずに一般論で書いている**ため、**既にある機能を「無い」と指摘している項目が大半**です。原文のまま置くと、次に読む人（や AI）が**作り直します**。✅ 既にある / 🔶 部分的 / ❗ 本当に足りない / ⛔ 意図的にやらない、の 4 段階を全項目に付けました。原文は `_RAW.md` に、**冒頭に警告を付けて**残しています。 |
| **`pnpm check` にビルドを足すのは選ばなかった** | 外部レビューの最重要指摘（「実際に動くことを確認する仕組み」）は正しいのですが、**`public-site` 単体で 9.8 分**、全アプリだと 30 分超です。**手元の品質ゲートに入れると使われなくなります**（CI には既に Build があります）。代わりに**ビルドで初めて落ちる形を検査で先に止める**方を選び、`check-build-ready` に **A7（`"use client"` の位置）** と **A8（`route.ts` の余分な export）** を追加しました。**今回 5 アプリを止めた 4 種類のうち 3 種類**が、これで手元で止まります。 |
| **自分で同じ関数を 4 回書いていた（基盤の目的そのものに反した）** | デモ用の API を 4 本作る間に、`clientKey(req)`（`x-forwarded-for` の先頭を取る 3 行）を**毎回コピーしていました**。数えると `showcase` の API に **9 個**（1 ファイルには 2 個）、さらに `internal-app` と `showcase` の `server/rate-limit.ts` に `clientIp` として**同じものが既にありました**。**基盤を作っている当人が、基盤に無いか確かめずに書いた**という形です。`@platform/guard` の `clientIp()` に一本化しました。 |
| **既存のアプリ側実装の方が優れていた** | 基盤に上げるとき、私の実装は `x-forwarded-for` しか見ていませんでしたが、**アプリ側は `x-real-ip` も見ていました**（nginx など、`x-forwarded-for` を付けない前段がある）。**上げる前に既存を読む**こと——読まずに上げると、**動いていたものが劣化します**。引数の型もアプリ側に合わせて `{ headers: { get() } }` にしました（試験で作り物を渡せる）。 |
| **`x-forwarded-for` は利用者が名乗るヘッダ** | 一本化のついでに TSDoc へ書きました。**信用してよいのは、自分の前段（ALB / CloudFront）が付け直している場合だけ**です。前段が無い環境では**誰でも別人になりすまして速度制限を回避できます**。認証済みの利用者がいるなら、**IP ではなく利用者 ID で数えてください**。 |
| **`dencho` を完了。`check-runtime-boundary` は 0 件になりました** | ハッシュ連鎖（`appendEvidence` / `verifyEvidenceChain` / `sha256Hex`）とタイムスタンプ（`createTimestampToken` / `verifyTimestampToken`）を `/api/dencho-demo` へ。検索と保存期限は**計算だけ**なので画面に残しました。**改ざん検知を画面でやるのは意味がありません**——「改ざんされていません」と画面が言うだけなら、**その画面ごと書き換えられます**。型（`EvidenceRecord`）だけは `types.ts` に切り出しました。 |
| **一連の作業でわかったこと: 束ねた入口は「実行できる場所」で割れる** | `security` / `pii` / `pdf` / `ekyc` / `line` / `dencho` / `crypto` / `form` の **8 パッケージ**で同じ形が出ました。**入口ひとつは便利ですが、Node でしか動かないものと どこでも動くものを混ぜると、使う側がまとめて巻き込みます。** 新しいパッケージを作るときは、**最初から `node:` を使うファイルを分けておく**のが安上がりです（後から分けると smoke の写し取りにも響きます）。 |
| **`line` を完了（2 → 1 件）。分割は 4 ファイルに及んだ** | `webhook.ts` から解析を（`webhook-parse.ts`）、`index.ts` から宛先判定を（`recipient.ts`）と型を（`types.ts`）切り出しました。**`messages.ts` が `./index` から型を取っていた**のが隠れた繋がりで、型だけ別ファイルにしないと入口を経由してしまいます（`import type` は実際には消えますが、**依存の形として残す方が読み手に優しい**）。署名検証だけ `/api/line-demo` へ。 |
| **smoke の写し取りは「先に全部数える」が正解だった** | `line` は **7 か所**が `packages/line/src/` を読んでいました。`ekyc` のときに学んだとおり `grep -n "line/src/" tools/smoke.mjs` で先に洗い出したので、**1 つ直すたびに次が出る**という消耗は避けられました。ただし**写した依存を参照する変数を、使う場所より後で定義**して 1 度落としています（`const` は巻き上がらない）。 |
| **`lineRecipientType` の TSDoc が嘘だった** | `@returns 種別。**判定できなければ null**` と書いてありましたが、**実際は `"unknown"` を返します**。`null` を想定した `if (t === null)` は永久に真になりません。切り出しのついでに直しました。**ファイルを移すときは、中身も読むこと**——移すだけなら気づけません。 |
| **`ekyc` を完了（3 → 2 件）。ファイル分割は smoke の写し取りに 3 か所響く** | `webhook.ts` から**解析だけ**を `webhook-parse.ts` に切り出し、`@platform/ekyc/webhook-parse` で取れるようにしました。署名の検証だけ `/api/ekyc-demo` へ。**smoke は `/tmp` に写して読むため、同じ修正が 3 か所必要**でした（1 つ直すと次が出る、を 3 回）。しかも**実体を直に指すと今度はその中の `./status` が拡張子なしで解決できない**ので、依存側も一緒に写す必要があります。**パッケージのファイルを分けたら、`grep -n "<パッケージ>/src/" tools/smoke.mjs` で全箇所を先に洗い出すこと。** |
| **切り出しの範囲判定で本体を壊しかけた** | `export function parseEkycWebhook(` の行には `{` が無いため、**波括弧だけを数える切り出しが 1 行目で終了**し、関数が 2 つのファイルに割れました。構文チェックが即座に捕まえたので復旧できましたが、**丸括弧も数える**か、**閉じ `}` が列 0 に来る行**を終端にするのが正しいやり方です。 |
| **【作業中】残り 2 件（`line` / `dencho`）** | `dencho` / `line` / `ekyc` のデモは、**取り込んでいる名前の大半が純粋**です（メッセージの組み立て・状態の判定・保存期限の計算）。**署名の検証だけ**が Node 依存なので、2 要素認証の時のように丸ごとサーバへ移すのは行き過ぎです。**純粋な部分にサブパスを足し（実施済: `@platform/ekyc/status` / `@platform/line/messages` / `@platform/dencho/search` / `@platform/dencho/retention`）、署名の検証だけを API に出す**のが正しい形です。**サブパスを足しただけで、画面の書き換えは未着手**です。 |
| **`line` と `ekyc` は `webhook.ts` の分割が要る** | `parseLineWebhook` / `parsePostbackData` / `eventSourceId` は**純粋なのに、署名検証と同じファイル**にあります。ファイルごと `node:crypto` を巻き込むので、**解析部分を `webhook-parse.ts` に切り出して**サブパスから出してください。`lineRecipientType` / `isValidLineRecipient` も `index.ts` にあり同じ問題です（`recipient.ts` へ切り出す）。**「純粋かどうか」はファイル単位で決まります**——関数単位ではありません。 |
| **自分の追記が既存の実装と重複した（同じファイルを続けて直したとき）** | `twofactor-demo/route.ts` に**レート制限のブロックを 2 回**書き、入力スキーマも `Input` と `BodySchema` の 2 つを置いてしまいました。検査に順に指摘されるたび「無い」と思って足したためです。**同じファイルを何度も直すときは、足す前に全体を読み直すこと**——`check-build-ready` の `[I]`（未使用 import）が最終的に捕まえました。 |
| **見本の画面が「サーバでやるべきこと」を画面でやっていた（9 → 3 件）** | 2 要素認証とパスワード再設定のデモが、**TOTP の検証も再設定トークンの発行も画面の中で**やっていました。Next 16 の Turbopack が `node:crypto` を補っていたので気づけませんでしたが、**そもそも設計が誤り**です——画面の判定は利用者が書き換えられるので、**「認証できました」を画面が決めてはいけません**。API（`/api/twofactor-demo` / `/api/password-reset-demo`）を作ってサーバへ移しました。**見本としても、これが正しい形**です。 |
| **画面に残してよいものと、そうでないものを分けた** | パスワードの**強度メーター**は計算だけなので画面に残し、`@platform/crypto/strength`（依存の無いファイル）から取るようにしました。ただし**弱いパスワードを拒むのはサーバ**です。「表示のための計算」と「可否の判定」は、**同じ関数でも置く場所が違います**。 |
| **【残り 3 件】`dencho` / `line` / `ekyc` のデモ** | 同じ形で残っています。`verifyLineSignature` `createTimestampToken` `verifyEkycSignature` — いずれも**署名の検証**なので、画面でやってはいけないものです。API 経由に直してください。 |
| **【解消済】画面から Node 専用パッケージを取っている箇所が 9 件** | 全体を点検したところ、`security` / `pii` / `pdf` で直したのと**同じ形が `showcase` に 9 件**残っていました——`auth`（3 箇所）`slack` `dencho` `line` `session` `crypto` `ekyc`。`"use client"` の画面が束ねた入口から取っており、**入口が `node:crypto` を連れてきます**。`pii` を直したので、**次のビルドはここで落ちます**。直し方は同じで、Node が要らない部分を別ファイルにして `exports` にサブパスを足します。**6 パッケージぶんあるので、まとまった時間が要ります。** |
| **同じ形を捕まえる検査を新設（102 種類目）** | `check-runtime-boundary` — **ブラウザ / Edge で動くファイル**（`"use client"` と `middleware.ts`）が、入口経由で `node:` に届くパッケージを巻き込んでいないかを見ます。**自分では import していない**のに束ねた入口が連れてくるので、人の目では気づけません。**例示のコード（テンプレート文字列）は数えません**——見本を載せたページが赤くなると、検査そのものが信用されなくなるためです。いまは**上限 9 のラチェット**で、増えたら落ちます。 |
| **入口から `node:` に届くパッケージは 24 ある** | 上の検査が数えた結果です。**それ自体は問題ではありません**（サーバ専用の部品なら当然）。問題になるのは**ブラウザ / Edge から取ったとき**だけです。だからこの検査は「パッケージ側」ではなく「**使う側**」を見ています。 |
| **App Router のルートは決まった名前しか export できない** | `route.ts` に `export const spec = defineRoute(...)` を置いていたところ、Next 15 の型検査が **`Type 'Route' is not assignable to type 'never'`** で落ちました（`GET` / `POST` / `runtime` / `config` 等以外は許されない）。同じフォルダの **`spec.ts`** に移し、`route.ts` からは消しました——**離した弊害（片方だけ直される）を抑えるため、フォルダは同じ**にしています。`check-openapi-coverage` も隣の `spec.ts` を見るようにしました。 |
| **束ねた入口が Node 専用のものを巻き込む——3 パッケージで同じ形** | `@platform/security`（`csrf.ts` → `node:crypto`）、`@platform/pii`（`blindIndex` → `node:crypto`）、`@platform/pdf`（`playwright` → `chromium-bidi`）。いずれも**使っていない部分が入口経由で載り**、Edge / クライアント向けのビルドが落ちました。`./headers` `./mask` `./playwright` のサブパスを足して分離（`ratelimit` 等の `./browser` と同じ形）。**「入口ひとつ」は便利ですが、実行できる場所が違うものを混ぜると破綻します。** |
| **生成された Prisma クライアントが型検査に巻き込まれていた** | 出力先が `src/generated/prisma` なので `include: ["src"]` に入り、`allowJs` 有効の `next build` が **`Declaration emit ... private name 'AccelerateEngineConfig'`** で落ちました。3 アプリの `tsconfig.json` の `exclude` に `src/generated/**` を追加。 |
| **smoke が `/tmp` に写して読むので、ファイル分割で 3 か所落ちた** | `pii` の伏せ字を `./mask` に分けたところ、smoke が **相対 import のまま /tmp に写す**箇所が 3 か所あり `/tmp/mask.ts` を探して落ちました。絶対パスに直す・写す対象に加える、で対応。**パッケージのファイルを分けるときは、smoke の写し取りも見ること。** |
| **`next build` で 5 アプリ全滅。原因は 4 種類** | `typecheck` も `test` も緑なのに、**ビルドで初めて出る**ものばかりでした。①**`node:crypto` が Edge に載らない**（後述）②`"use client"` が import より下（3 ファイル）③`server/env` の相対パスが 1 階層ずれ（3 ルート）④サーバのルートが `react-hook-form` を巻き込む。**「型が通る」と「ビルドが通る」は別物**です。 |
| **`@platform/security` の束ねた入口が Edge を壊していた** | `csrf.ts` が `node:crypto` を使っており、**入口（`index.ts`）から取ると丸ごと巻き込まれます**。Next 16 の proxy は常に Node.js だったので通っていましたが、**Next 15 の middleware は Edge 既定**なので `UnhandledSchemeError` で落ちました。`"./headers"` のサブパスを足し（`ratelimit` 等の `./browser` と同じ形）、5 アプリの middleware をそちらに向けました。**headers.ts は Web Crypto しか使わない**ので、どこでも動きます。 |
| **サーバで使う判定が `"use client"` のファイルに入っていた** | `isHoneypotFilled` は TSDoc に「**サーバ側で**」と書いてあるのに、`form-helpers.tsx`（`"use client"` + `react-hook-form`）の中にありました。`public-site` の問い合わせ API が入口から取っており、**クライアント専用のライブラリごとサーバのバンドルへ**——`'useForm' is not exported from 'react-hook-form'` の正体です。依存を持たない `honeypot.ts` に切り出し、`@platform/form/honeypot` で取れるようにしました。**ボットは API を直接叩くので、この判定はサーバで動かないと意味がありません。** |
| **`check-build-ready` が 1 アプリしか見ていなかった** | 「import 解決」を謳いながら、**対象は `showcase` だけ**でした——他の 4 アプリは丸ごと素通りです。加えて**副作用だけの import（`import "./x";`）を正規表現が拾っていません**でした（`from` が無いため）。この 2 つが重なって、`internal-app` の 3 ルートのパスずれを逃していました。**環境変数の検証はこの形で読み込む**ので、ずれていると**検証そのものが走らない**まま本番に出ます。全アプリを見るようにし、副作用 import も拾うようにしました（`generated/prisma` は `prisma generate` が作るので除外）。 |
| **自分が書いた試験が 2 件とも間違っていた（`pnpm test` で発覚）** | 2,195 件中 2 件が赤。**どちらも実装ではなく試験の側が誤り**でした。①`z.coerce` の数値を「クエリは文字列だから `string` で出すべき」と書いていましたが、**OpenAPI はクエリを論理的な型で宣言し、文字列への直列化は呼ぶ側の仕事**です——`string` にすると生成クライアントが `page?: string` になり、**呼ぶ側が毎回 `String()` を書く**羽目になります。②`BusyOverlay` を**関数として呼んで** `toBeNull()` を見ていましたが、返るのは `<Overlay open={false}>` という**要素**で、null になるのは `Overlay` が描画されたときです。 |
| **`not.toBeNull()` だけの試験は、何も確かめていないことがある** | `BusyOverlay({ busy: true })` が null でないことを見る試験は、**busy が false でも通っていました**（どちらも要素が返るので）。文言そのものを見るように直し、`BusyOverlay` にも早期 return を足しました。**`JSON.stringify` は使いません**——React 要素の内部の持ち物は版で変わるので、**形に依存した試験は React を上げた日に理由も分からず落ちます**。children を辿るだけの小さなヘルパーにしました。 |
| **`typecheck` で 6 種類の型エラー。半分は「依存に書かずに import していた」** | `internal-app` の 5 ルートが `zod` を、`packages/ui` の `EnvBanner` が `@platform/env` を、**依存に書かないまま import** していました。**smoke も preflight も緑のまま**で、`tsc` で初めて出ます——`check-imports` は「名前が実在するか」を見ますが、**その名前をどこから取れるか**は見ていません。依存に追加しました。`zod` は**全体と同じ `^4.0.0`**（内部アプリには元から無く、版を推測しかけた記録が別項にあります）。 |
| **`queryRows` が `pageSize` を返していなかった** | `DataTable` が `result.pageSize` を読んでおり、型に無いので落ちました。**呼ぶ側は `pageSize` を省略できる**（既定 20）ので、**既定値を知っているのは `queryRows` だけ**です。返さないと「1〜20 件目 / 全 143 件」の表示のために**画面側でもう一度 20 を書く**ことになり、片方だけ変えたときにずれます。`TableResult` に足しました。 |
| **`SESSION_SALT` が本番のスキーマに無かった（型エラーが実害を掘り当てた）** | `loadServerEnv()` の**開発側にだけ**あり、本番側の `loaded` に無いので「プロパティが足りない」で落ちました。放置すると**本番で読めない**か、開発と同じ `dev-session-salt-change-me` が使われます——**検証環境で発行したクッキーが本番でも通る**という形で出ます。`assertSecretStrength` は名前に SECRET / TOKEN / PASSWORD / KEY を含むものしか見ないため、**SALT は素通り**します。`requireEnv` の必須に足し（未設定なら起動失敗）、`.env.example` / `vitest.config.ts` / CI の 3 か所にダミー値を入れ、**smoke に「SALT 欠けで落ちること」の検査を追加**しました（2,797 → 2,798）。 |
| **Next.js が 16 系で、置き先（Amplify）の対応範囲外だった** | AWS の公式ドキュメントでは **Amplify Hosting compute の対応は Next.js 12〜15**（現行の SSR プロバイダは 15）。**16 は対応外**でした。厄介なのは**手元では 16 でも動く**こと——`pnpm dev` も `next build` も通り、**気づくのは Amplify に上げたとき**です。`^15.5.21` に下げ（2026-08 の security release で HIGH 4 / MEDIUM 5 を塞いだ版）、入口を `proxy.ts` → **`middleware.ts`** に戻し、`next.config.mjs` に **`outputFileTracingRoot`** を足しました（15 のビルドは webpack。monorepo では基点を推測するので、明示しないと**成果物からファイルが漏れます**）。**ADR-0025** に記録。 |
| **「手元で動く」ものは、検査でしか止められない** | `pnpm up --latest` のような何気ない操作で Next は 16 に上がります。**上がっても手元は緑**なので、人の注意では防げません。`tools/check-next-version.mjs`（101 種類目）でメジャー版が 12〜15 の外に出たら落とすようにしました。**上げたくなったら、先に Amplify の対応を確かめて ADR-0025 を書き換えてから `MAX_MAJOR` を上げること**——順番が逆になると「なぜ 16 にしたのか」が誰にも分からなくなります。 |
| **【期限あり】Next 15 は 2026-10-21 にサポート終了** | 15 は Maintenance LTS で、**この決定は約 2 か月で見直しが要ります**。それまでに「Amplify が 16 に対応するのを待つ」か「置き先を変える（Vercel / ECS / Lambda Web Adapter）」かを決めてください。**先送りではなく期限付きの決定**であることを ADR-0025 に明記しています。 |
| **【未検証】`runtime = "nodejs"` が Amplify で動くか** | `internal-app` の middleware だけは**実行時に環境変数を読みます**（`MAINTENANCE_ALLOW_IPS` / `MAINTENANCE_BYPASS_TOKEN`）。`optionalEnv` は `process.env[name]` の**動的な読み方**なので、Edge 既定のままだと**値が埋め込めず undefined になりえます**——**メンテナンス中なのに誰でも入れる**という形で表に出ます。Next 15.5 で正式版になった `export const runtime = "nodejs"` を付けて Next 16 と同じ挙動にしましたが、**Amplify 側の対応は公式ドキュメントに記載を見つけられませんでした**。動かない場合は、環境変数を静的参照に直すか、ゲートを画面側（layout）へ移してください。他の 4 アプリは `NODE_ENV` と Web Crypto しか使わないので**既定（Edge）のまま**です。 |
| **新しく作ったアプリが、その場で `pnpm check` に落ちる状態だった** | 機能を 8 つ組み合わせて `pnpm new-app` を試したところ、生成そのものは通るのに **`check-generated` が 3 件落ちました**——資料・索引・アプリ地図は**アプリの一覧から生成している**ので、作っただけでは古いままです。**「作った直後に赤い」のは、いちばん心が折れる形**なので、生成後の案内に **`pnpm gen:all` を最初に置きました**（`docs/ops/COMMANDS.md` にも追記）。 |
| **資料サイトの生成が「作る」だけで「消す」をしていなかった** | アプリを削除しても `docs/site/app-<名前>.html` が残り、**リンクを辿ると存在しないアプリの資料が出ます**——読む人には「まだある」と見えるので、たちが悪い。`smoke` の「消えたアプリの生成物が残っていない」が捕まえてくれますが、**捕まえるより残さない**方がよいので、`gen-ref-site.mjs` に後始末を入れました。**生成する仕組みを書くときは、消す側も一緒に書く**こと。 |
| **長い行 1,371 は、ここで止めるのが妥当** | 内訳を数えたところ **764 件は「その他」**（オブジェクトを返す `return { ... }` など）で、機械的に折り返すのは**危険の割に得るものがありません**。**1 行に押し込まれた `interface`（6 件）だけ**を展開しました——これは読みやすさが実際に上がります（`assets-client.tsx` の 258 文字が 13 行に）。残りは意図的に据え置きます。 |
| **OpenAPI の宣言を 6 本に（上限 284 → 280）** | 基幹業務のうち**他システムが参照するもの**を選びました: 請求（会計システム）・取引先（会計・購買）・勤怠（給与計算）。**金額は整数（円）、勤怠は整数（分）**であることを型に明記しています——`7.5 時間 + 7.5 時間` が `15.000000000000002` になる類の事故は、**呼ぶ側が小数で受けた時点で起きます**。管理画面用（`api/admin/` の 39 本など）は**意図的に載せません**——一覧が大きくなると、本当に使ってよいものが埋もれます。 |
| **OpenAPI の宣言が 285 本中 1 本だった** | アプリは別リポジトリなので **TypeScript の型を直接 import できません**（ADR 0021）。呼ぶ側は形を**手で書き写す**ことになり、**必ずずれます**。ただし**全部を宣言する必要はありません**——画面専用の API まで載せると、**本当に使ってよいものが埋もれます**。**外から叩かれるもの**を選んで 3 本にしました（`crud-template` の品目一覧＝**書き方の見本**、`internal-app` の契約一覧＝法務・経理の別システムが参照する）。`crud-template` には `api-spec.ts` と `GET /api/openapi.json` も置いてあります——**新しいアプリを作った人がコピーできる形**にするためです。上限 284 → 283。 |
| **単体 `tsc` の結果を「既存の不具合」と報告しかけた** | `node_modules` が無い状態で `tsc <1 ファイル>` を走らせると、**`@platform/*` も `zod` も解決できません**。その状態では `e instanceof AppError` の絞り込みが効かず、**`'e' is of type 'unknown'` という無関係なエラー**が出ます。**構文エラー（TS1xxx）だけを見る**のが正しい使い方で、型エラー（TS2xxx / TS18xxx）は**依存を入れた環境でしか判定できません**。2026-08 に、実在しない不具合を報告しかけました。 |
| **`zod` の版を推測で書いて、混在させかけた** | `crud-template` に依存を足すとき `internal-app` から版を写そうとしましたが、**そこには `zod` が入っていません**でした。既定値の `^3.23.8` を書いた結果、リポジトリ全体が `^4.0.0` なのに**1 つだけ古い版**という状態を作りかけました。**「他はどうなっているか」を先に見る**こと——`grep -h '"zod"' */package.json | sort -u` で 10 秒です。 |
| **`"*"` を持つ役割でも、権限名は書く必要がある** | `crud-template` の `admin` は `permissions: ["*"]` を持ちますが、`check-permissions` は**ポリシーに書かれた名前だけ**を見るため「`system:manage` は未定義」と落ちました。これは**正しい設計**です——名前を書いておかないと、**打ち間違い（`system:mange`）に気づけません**。`"*"` と併記する形にしました。 |
| **未使用の依存 6 件を片付けたら、本物の不具合が出てきた** | 「使っていないから消す」で流さず、**1 件ずつ「本来使うべきだったのでは」を確かめました**。結果、`line-console` の `@platform/datetime` は**繋ぐべきもの**でした——会話画面が `toLocaleDateString()` と `getHours()` を使っており、**端末の時計**を見ています。出張中の端末や時刻設定のずれた PC では**日付の区切りが 1 日ずれ、時刻も違って出ます**。顧客対応の履歴で時刻が食い違うと、**「いつ送ったか」の話ができません**。`formatJst` に置き換えました。他は: `audit` は `LineMessage`（direction + senderEmail）が既に記録なので重複、`utils`/`validation` は手書きの検証で足りている（`AppError(VALIDATION)` を正しく投げていた）ので削除、`loadtest` は **`devDependencies` へ**、`analytics` は `plannedDeps` に理由を記載。**上限 6 → 0**。 |
| **`devDependencies` を「未使用」に数えていた** | `check-unused-deps` が両方を見ていたため、`loadtest` を開発用に移しても指摘が残りました。**`devDependencies` は本番の成果物に入りません**——負荷試験の道具のように手元でだけ使うものが入るので、「import していない」ことが問題になるのは**本番に載るのに使っていない**場合だけです。`dependencies` のみを見る形に直しました。 |
| **作った機能を、どこにも繋いでいなかった** | `toUserMessage` / `Overlay` / `appEnvLabel` を作ったものの、**アプリでの利用はゼロ**でした——基盤に置くだけでは何も起きません。**「作った」と「使われている」は別**で、後者を確かめるまでが 1 つの作業です（`check-unused-package` が存在する理由でもあります）。3 つとも実際の画面に繋ぎました。 |
| **API の 400 番台は、開発者が書いた文言をそのまま返していた** | `toHttpError` は 500 系だけ内部詳細を伏せており、**400 系は `app.message` が素通り**でした——「zod validation failed」「P2002 unique constraint on ItemRow.code」が**画面に出ます**（意味が分からないうえ、テーブル名が漏れます）。応答に **`userMessage`（利用者向けの言い換え）を追加**しました。`message` は残してあります——**ログとの突き合わせに要る**ので、消すと原因が追えなくなります。画面は `userMessage` を見ます。 |
| **検証環境と本番の取り違えを、画面で防いでいなかった** | `EnvBanner` を作り、3 アプリの `layout.tsx` に入れました。**検証環境と本番は見た目が同じ**で、2 つのタブで開いていると**どちらで操作しているか分かりません**——「検証で試したつもりが本番だった」は実際に起き、**気づくのはたいてい後から**です（本物の取引先にメールが飛ぶ等）。**本番では何も出しません**（常時表示は読まれなくなり、本当に警告したいときに効かなくなる）。 |
| **`disabled` は「操作の停止」ではない** | 用語辞書の CSV 一括取り込みは、ボタンを `disabled` にするだけで**他の操作は通っていました**——取り込みの途中で辞書を編集されると、**どちらが残るか分かりません**。`BusyOverlay` を入れて画面全体を止めています。 |
| **smoke が文言そのものを照合していた** | 「雛形が取得の失敗を画面に出す」の検査が `setError("品目を取得できませんでした")` を正規表現で見ており、**文言を良くすると赤くなる**状態でした——**検査が改善を妨げる**形です。「失敗を検知して画面に出しているか」という**意図**を見る形に直しました。 |
| **`crud-template` にログイン画面が無かった** | `login` 機能を選ぶと `session.ts` は入りますが、**画面は自分で作る**ことになっていました——社内アプリはほぼ必ずログインが要るので、**アプリごとに見た目も安全性もばらつきます**（「このアプリだけパスワードが平文で飛ぶ」はこういうところで起きます）。`page.tsx` / `login-form.tsx` / `api/auth/login/route.ts` を標準に入れました。**`login-form.tsx` は差し替え可能**——基盤の部品を使わず独自の画面にして構いませんが、**`/api/auth/login` の入出力は変えないこと**（片方だけ直すと、押しても何も起きない画面になります）。`findUser` は**常に null の固定値**にしてあります——**動くように見えて誰でも入れる状態**を作らないための意図的な措置です。 |
| **一覧の絞り込みが画面側で行われていた** | `crud-template` は**全件取ってから `filter`** していました（「増えたら API に `?q=` を足す」とコメントがあった箇所）。件数が増えた日に「一覧を開くと固まる」状態になるので、`listPage()` を足してサーバ側に移しました。**`pageSize` には上限 100** を掛けています——クエリ文字列は利用者が自由に書けるので、**`?pageSize=100000` で全件を引かれます**。**範囲外のページは最終ページへ寄せます**（絞り込みで件数が減ったとき、3 頁目にいたまま該当なしになると「消えた」と思われる）。**0 件でも `pageCount` は 1**（「0 / 0 ページ」は壊れて見えます）。 |
| **`check-app-transpile` は「依存にあるが未使用」を見ていなかった** | あちらは「**import しているのに宣言が無い**」（ビルドが落ちる方）だけを見ます。逆向きの `check-unused-deps` を足しました——**落ちはしませんが、半年後に「消してよいか分からない」**状態になります。特に **`new-app` で全パッケージを選べるようにした**ことで「とりあえず全部入れる」が可能になったので、その後始末を促すためのものです。現在 6 件（上限方式で記録）。**「これから使う」なら `platform.plannedDeps` に理由を書けば咎めません**——咎めているのは「なぜ入っているか誰も知らない」状態です。 |
| **`verify-checks` に `patch` 形式は無かった** | `check-unused-deps` の分類を足すとき、`package.json` を書き換える独自形式（`patch`）を書いて `ERR_INVALID_ARG_TYPE` で落としました。**既存は `file` + `content`（文字列）だけ**です。既存ファイルを書き換える形にすると、**途中で止まったとき本物が壊れます**（後始末の対象は `__verify` を含むものだけ）。**仮のアプリを 1 つ置く**形に直しました。 |
| **`new-app` で選べるのは 120 のうち 42 だけだった** | `FEATURES` は「ログイン」「承認フロー」のような **26 の機能**(繋ぎ方の見本つき)ですが、**残りは選択肢に出ていません**でした——「郵便番号から住所を引きたい」と思っても `@platform/address` が出てこないので、**あることを知らないまま自作します**(`check-reimplementation` が存在する理由そのもの)。`tools/app-packages.mjs` を足し、**全パッケージを `pkg:<名前>` として選べる**ようにしました。**説明は各 README の 1 行要約から読み取ります**——書き写すと二重管理になり、必ずずれます。`incubating` には「形が変わることがあります」を添えます。**86 件を一度に並べると探せない**ので、機能を先に出し、**部品は `p` を押したときだけ**出します。`pnpm new-app --list` で全件を確認できます。 |
| **`--dry` が「何を選んだか」を見せていなかった** | 「作ってから違った」を避けるための `--dry` なのに、**選択処理より前に終了**しており、`--features=` の綴りが合っているか**作るまで分かりません**でした。選んだ機能・部品・追加される依存とファイルを出すようにしました。 |
| **エラーの文言が「利用者に何をすればよいか」を伝えていなかった** | 「バリデーションエラー」「不正な要求です」では、**何が悪いのか・自分で直せるのか・誰に言えばよいのか**が分かりません——**業務システムを使うのはパソコンが得意とは限らない人**で、結果として**情シスに電話がかかってきます**。`@platform/http` に `toUserMessage()` を作り、**言い換えを 1 か所に集めました**(各画面で書くと、同じ状況なのに画面ごとに違うことを言う)。原則は 3 つ: **専門用語を使わない**・**次にすることを書く**・**利用者を責めない**(「不正な要求です」は正しく使っている人にも出ます)。**元のメッセージは見せません**——内部の事情(テーブル名・関数名)が混ざり、見せても分からないうえ構造が漏れます。**`recoverable: false` のときは「再試行」ボタンを出さないこと**——押しても直らないボタンは不信につながります。 |
| **ログイン画面が SSO を自前で組んでいた** | `internal-app` の Zoho ログインが生の `<a>` で、**基盤の `SocialLoginGroup` を使っていません**でした——自前で組むと**アイコン・並び・押したときの見た目**がアプリごとにばらつき、**同じ会社のシステムでログイン画面だけ雰囲気が違う**のは不安を与えます。基盤の部品に置き換え、「Zoho の画面に移動します」の一文も添えました(**画面が切り替わると「別のサイトに飛ばされた」と不安になる人がいます**)。 |
| **一覧に「何件中の何件目か」が無かった** | `Pagination` は番号だけ、`SimplePagination` は「3 / 12」だけで、**総件数が出ていませんでした**——「3 ページ目」だけでは、**全部見たのか途中なのか**が判断できず、**絞り込みが 0 件なのかデータが無いのか**も区別できません。`totalItems` / `pageSize` を渡すと「1〜20 件目 / 全 143 件」を出します。**最後のページは端数になる**ので、`page * pageSize` をそのまま出さないこと(ありもしない件数が出ます)。あわせて**「最初へ」「最後へ」**を追加——50 ページある一覧で、「次へ」を 49 回押させないため。 |
| **膜(オーバーレイ)は「見た目」であって「操作の停止」ではない** | `Overlay` / `BusyOverlay` を追加しました。**最も多いのは「保存中に何も出さない」**——押しても見た目が変わらないので**利用者は何度も押し**、冪等でない処理なら二重登録になります。**濃さは 0.6 で頭打ち**にしています(後ろが見えないと、**何の上に出ているか分からなくなる**)。**これだけでは Tab が後ろへ抜けます**——本当に止めるなら `Dialog`(フォーカスを閉じ込める)を使ってください。 |
| **シーダーは「本番」だけでなく「開発以外」で止める** | 3 つの `seed.ts` は `isProductionRuntime()`(= `NODE_ENV`)だけを見ていました。**検証環境も `NODE_ENV=production` で動く**(本番と同じイメージを使うため)ので実際は止まりますが、**「本番環境では実行できません」と出るのに実際は検証環境**という分かりにくい形でした。`APP_ENV` も見て**環境名をそのまま出す**ようにしています。なお**冪等性は健全**でした——23 ステップすべてに `count()` のガードがあり、二重実行で増えません。 |
| **手順書の「先に確認」は、SQL 側でも止める** | `migrate-money-to-int.sql` は「STEP 1 が 0 件でなければ進まないこと」と書いてありましたが、**ファイルごと `psql -f` で流すと誰も見ないまま STEP 2 が走ります**——**流す人は 1 コマンドで済ませたい**ので、実際そうなります。トランザクションの先頭に **`RAISE EXCEPTION` の安全装置**を入れました(端数があれば巻き戻る)。**意図的に丸めたいときは、そのブロックを消してから流す**——「消す」という操作が、判断した証拠になります。 |
| **基盤にあって使われていないものを洗った(2026-08)** | 全 120 パッケージの利用状況を数え直したところ、**どこでも未使用は 3 件**でした。`stripe` は判断済み(「社内業務システムに顧客向けカード決済は不要」)。**`xml`** は showcase の `toolbox` に見本を足しました(銀行・公的機関・EDI は今も XML)。**`testing`** は**見本ではなくテストで使うもの**で、提供している**契約テスト(「どの実装でも同じ約束を守るか」)が一度も使われていません**でした——`cache` は memory と Redis の 2 実装があり、**開発ではメモリ・本番では Redis** なので、**差があると本番でだけ壊れます**。`packages/cache/src/contract.test.ts` で両方に同じ検査を課しました。 |
| **テスト専用パッケージへの依存は循環に数えない** | 契約テストを入れたら `cache → testing → cache` が検出されました。`testing` は**テストの中だけで動き、検査対象の型を参照する**ので、この循環は**必ず起きます**——弾くと**契約テストという仕組みそのものが使えません**。`devDependencies` の `@platform/testing` だけを除外しました(`dependencies` にあれば従来どおり循環として扱う)。 |
| **`isCronAuthorized` の照合部分を基盤へ移した** | 定数時間比較・長さ違いで例外にしない・未設定なら通さない、は**どのアプリでも同じ**なので `@platform/guard` の `matchesSharedToken` にしました。**認可の判断は移していません**——「管理者も通す」はアプリごとに違うので、照合の結果だけを返します。 |
| **自動生成物を数えると、本物の残骸が見えなくなる** | `check-env-example` が `portal-reference.generated.ts`(全パッケージの TSDoc を JSON で抱える)を走査しており、**説明文に出てくる環境変数名を「参照している」と数えて**いました。生成物を除外したところ、**7 件の本物の残骸が浮上**——**隠れていただけ**でした。`.generated.ts` は検査の対象外にすること(直すなら生成する側なので、数えても意味がない)。 |
| **`SESSION_SALT` は「完了」と書いてあったが未完だった** | `zoho-session` を暗号化へ移す手順②(「`SESSION_SALT` を環境変数に足す」)は **2026-08 完了**と記録されていましたが、**`.env.example` に置いただけ**で `server/env.ts` のスキーマには無く、**コードから読めません**でした。`createSession` は salt を必須にするので、この状態では手順③に進めません。`serverEnv.SESSION_SALT` を足しました(**環境ごとに別の値にすること**——同じ塩だと**検証環境のクッキーが本番で通ります**)。**「完了」の記録は、実際に使えるかまで確かめてから**。 |
| **手順③(暗号化への差し替え)の前提が変わった** | 止まっていた理由は「**入れ替えた瞬間に全員がログアウトする**」でしたが、鍵の入れ替え用に入れた **`previousSecret`(読むときだけ旧鍵も試す)** と同じ考え方で、**旧形式も読めば ログアウトなしで移行できます**。ただし**トークンの形式を変える**変更なので、**テストとビルドを通せる環境で**進めること(失敗すると全員がログインできなくなります)。準備(salt を読めるようにする)まで済んでいます。 |
| **`--apps-only` だけでは足りない(私の確認漏れ)** | 一連の作業でずっと `node tools/preflight.mjs --apps-only` で確認していましたが、これは**基盤側の 22 件を飛ばします**。全件で回したところ **5 件の失敗**が出ました——**自動生成物 8 種が古いまま**(`gen-all.mjs` で解消)、そして**私が書いた正規表現の欠陥 2 件**。**出す前は必ず全件で回すこと。** |
| **`[^)]*` で引数を取らない** | `check-regex-pitfalls` が、私の書いた 2 件を捕まえました: `f(a = new Date())` は**引数の `)` で切れ**、`body.replace(/\/\/[^\n]*/g, "")` は **`https://` の `//` を巻き込んで行の後半を消します**。どちらも「動いているように見えて、静かに取り違える」形です。**範囲を取る正規表現は `argsAt()`(`tools/lib/source-text.mjs`)を使うか、そもそも範囲を取らない書き方に変えること。** |
| **`@param ...values` が読まれていなかった** | 可変長引数は `@param ...parts` と書くのが既存の作法(`fs/path.ts`)ですが、`check-tsdoc-params` が **`...` を名前として認めておらず**、正しく書いても「実装と違う」と数えられていました——**正しく書いても直らない状態は、検査を信じなくさせます**。読めるようにして **223 → 213 件**(私の 1 件＋同じ理由の 9 件)。 |
| **コメントの数値は誰も直さない** | `check-doc-numbers` は **`docs/` と `README` しか見ておらず**、`tools/` や `packages/` のコメントは野放しでした。`gen-smoke-index.mjs` は「**20,620 行・465 セクション**」と書いていましたが実際は **24,549 行・399 セクション**、`suggest.mjs` は「119 個」(実際は 120)。**資料を AI が読む前提**のリポジトリなので、**古い数値はそのまま信じて作業されます**。数えた結果は**出す側に書かせ**(`docs/ai/smoke-index.md` の冒頭)、説明文には「2 万行超」「半数以上のパッケージ」と書くようにしました。`check-stale-counts` が見張ります——**過去の記録**(「2026-08 の時点で〜」)は**残すべきもの**なので対象外です。 |
| **`smoke.mjs` を分割しない判断は妥当** | 24,549 行の 1 ファイルですが、`gen-smoke-index.mjs` に**分割しない理由**(各セクションが自分でスタブを組み立てる・セクション間で変数を共有)と**いつ分割を考えるか**(スタブの重複が目に見えて増えたとき)が既に書かれていました。**索引で探せるようにする方**を選んだ判断は今も妥当です。 |
| **`check-server-localtime` の 22 件は、ほとんどが対象違いだった** | 「サーバ側のローカル時刻」を見る検査でしたが、**ブラウザで動く `packages/ui/src/lib/*.ts`**(カレンダー・予定表の純ロジック)まで数えていました——**利用者の時計で描くのが正しい**ものです。`.tsx` は除外済みでしたが、`.ts` が漏れていました。自動生成物と `seed.ts` も同様(**手で直せない / 直しても業務に影響しない**)。**直しようのない件数が上限に居座ると、本当の問題が埋もれます**。除外したうえで、残った**本物 3 件**(契約・タスクの初期データ、償却の年判定)を JST に直し、**22 → 0 件**にしました。 |
| **`todayJst(...)` の直後まで指摘していた** | 正しく直したコードが**直後にまた指摘される**状態でした(`todayJst(now).getFullYear()`)。**「直しても赤いまま」になると、検査を信じなくなります。** JST に寄せた `Date` を返す関数の直後は対象外にしました。 |
| **smoke の単体読み込みは、import を増やすたびに追記が要る** | `task-repo` / `contract-repo` に `@platform/datetime` を足したところ、**smoke 全体が停止**しました——これらを**単体で読み込んで動かす**仕組みで、依存を 1 つずつ差し替えているためです。**エラーは的確で**(「差し替えていない依存が残っています → `@platform/datetime`」)、直し方まで出ました。**アプリ側の import を増やしたら、smoke の該当箇所も見ること。** |
| **上限が 0 でない検査こそ、中身を見る価値がある** | ラチェットは「増やさない」ためのもので、**中身が正しいかは別**です。`check-unbounded-query` の「増え続ける表で `take` が無い」5 件を調べたところ、**全部が誤検出**でした——`{ where, orderBy, take }` の**短縮記法**を `take:` で探して取りこぼし、`where: { messageId }` のような**正しい絞り込み**まで「危ない」と印を付けていました。判定を直して **5 件 → 0 件**、上限も 64 → 63 に締めました。**低い率・多い違反は「直しようがない」と読まれ、数字ごと信用されなくなります。** |
| **削除の確認が抜けていた(CMS)** | `check-delete-confirm` の 6 件のうち、**記事と分類の削除**に確認ダイアログがありませんでした。記事は元に戻せず、**一覧では編集ボタンの隣にあって押し間違えます**。分類を消すと**その分類の記事が宙に浮きます**。両方に `ConfirmDialog` を入れ、上限を 6 → 4 に締めました(残りは用語辞書・テーマ・チャット・開発ツールで、いずれも作り直せるもの)。 |
| **検査は「見つけるか」だけでなく「間違えないか」も固定する** | 追加した検査に**安全な書き方を赤にするもの**が 2 件ありました。`check-async-boundary` は `{data === null ? … : data.x}`(**null 側を先に書く三項**)を違反と判定し、`check-intrinsic-props` は `<a onSelect=…>`(**React では HTML 要素にも実在する**)を弾いていました。**誤検出は検査ごと信用を失わせます**——「またこれか」で見られなくなる方が、見逃しより高くつきます。`verify-checks` に **`expectFail: false`**(安全な形を置いて**緑のままであること**を確かめる)を足しました。**検出力と誤検出の無さは、両方とも固定するもの**です。 |
| **回数を「守っている」と「十分に厳しい」は別** | `limitPublic` の既定は **60 回 / 分**(一般の公開 API 向け)でしたが、`setup/bootstrap` は**一生に 1 回**しか使わない口、`balance/collect` は**1 日数回**の定期実行です。**60 回 / 分は緩すぎます**。ログインと同じ **5 回 / 分**(`getSecretLimiter`)にしました。**同じ性質のものは同じ厳しさにすること**——片方だけ緩いと、そこが狙われます。**「制限を付けた」で満足しない**、という教訓です。 |
| **skip した検査は「0 件」を報告してよい** | `check-scan-reporting` は `✅` と `⚠` の行しか見ておらず、**`⏭`(skip)の行は素通し**でした。そのため「何件見て 0 だったのか」が分からず、**まだ回していないのか、対象を取り違えているのか区別できません**。`⏭` も見るようにし、**skip のときだけ 0 件を許容**する形にしました(依存やビルド結果が無い環境では 0 が正しい)。**緑なのに 0 件**——対象の指定を間違えた検査——は従来どおり落とします。 |
| **レート制限の fail-open は、秘密を当てにいける口では逆に働く** | 制限器が落ちたときに通す(fail-open)のは、**守りのために業務が止まる方が困る**からで、一般の API では妥当です。ただし**パスワード・共有鍵・初期セットアップ**のような「秘密の一致で通す口」では、**制限器を落とすだけで防御を外せます**。`setup/bootstrap` と `balance/collect` は `onStoreError: "deny"` にしました(「一時的に使えない」方が「誰でも突破できる」より軽い)。**ログインだけは締め出しません**——制限器が落ちている最中に、**それを直す人がログインできなくなる**ためです。代わりに**1 秒待たせてから通します**: 人にはほぼ気になりませんが、**総当たりの速度は 1 秒に 1 回まで落ちます**。`check-safety-parts` に「秘密を当てさせない口の fail-close」を足しました。 |
| **schema を先に変えてしまった(私の順序違反)** | `DATA_MIGRATION.md` は「**入口 → データ → 型**」の順を明記していますが、`hourlyWage` の `Float → Int` は**型だけ先に変えた**状態でした。既存データに端数があると `db push` が `--accept-data-loss` を要求して止まります。`scripts/migrate-money-to-int.sql` に **STEP 1(事前確認)と STEP 2(変換)を追加**し、適用手順を `docs/ops/APPLY_2026-08.md` にまとめました。**STEP 1 が 0 件でなければ止めること**——丸めると**その人の給与が変わります**。**手順書がある作業ほど、手順を飛ばしたことに気づきにくい**という例です。 |
| **時給が `Float` だった** | `WageRow.hourlyWage` が `Float` で、API の検証も「正の数」だけ——**`1234.5678` が通る**状態でした。計算側(`calcPay`)は内訳を丸めてから足すよう直してありましたが、**入り口が緩いと毎月の計算で誤差が積み上がります**。`Int` にし、API でも `Number.isInteger` で絞りました。**端数のある時給が必要になったら、円未満をどう扱うかを決めてから緩めること。** 端数の出やすい 30 通り(時給 990 円・残業 13 分など)で**内訳の合計＝総支給**を確かめる回帰テストを追加しています。 |
| **一方 `unitCost` の `Float` は正しい** | 在庫の評価は**移動平均法**(`value / qty` の繰り返し)なので、**平均単価に必ず端数が出ます**。`Int` にすると、出庫のたびに丸めた値で計算することになり、**帳簿の在庫金額が実際とずれていきます**。**「金額はすべて Int」ではありません**——「1 円単位で確定する金額」(給与・請求)は `Int`、「計算の途中で使う単価」は `Float` で、**表示するときに丸めます**。schema にこの区別を書き残しました。 |
| **Docker のログには上限が無い** | 既定の `json-file` ドライバは**溜め続けます**。1 台の VPS では**ディスクを食い潰し、DB が書けなくなって全部止まります**——しかも**ログが原因だと気づくまでに時間がかかります**。`docker-compose.prod.yml` / `.staging.yml` の全サービスに `max-size: 100m` / `max-file: 3` を入れました。`check-ops-hygiene` が見張ります。 |
| **バックアップは手順書だけあって、回っていなかった** | `BACKUP_RESTORE.md` に `pg_dump` の手順はありましたが、**毎日回す仕組みがありませんでした**——「取っているはず」で、気づくのは**戻したいとき**です。`scripts/backup.sh` を用意し、cron の登録手順を書きました。**成功も通知します**——失敗だけを通知する設定にすると、**cron 自体が止まったときに気づけません**。「毎日通知が来る」状態にして、来なくなったことに気づけるようにしてください。 |
| **外部キーを張らない方針だと、索引が 1 つも作られない** | このリポジトリは `@relation` を**あえて張らず**、`userId` などを**文字列で持ちます**(schema.prisma 冒頭に理由あり)。その結果、**Prisma は索引を示唆せず、PostgreSQL も自動では作りません**。無いとその列で絞る検索が全件走査になり、**10 件のときは速く、10 万件で急に遅くなります**——**開発中は気づけず、使われ始めてから「最近重い」としか報告されません**。2026-08 に **15 列**が索引なしでした。増え続けるもの(申請・ブックマーク・分析イベント・LINE の会話)に 6 本足し、**残り 10 列は `// no-index: <理由>` で宣言**しました(行数が少ない・別の索引で足りる)。`check-db-indexes` が上限 0 で見張ります。**全部に付けるのが正解ではありません**——索引は書き込みを遅くし、容量も食います。 |
| **メールは「届かないこと」に気づけない** | 承認依頼・パスワード再設定・請求書が迷惑メールへ入ると、**システムの障害としては現れません**——「まだ承認されない」「ログインできない」「入金が遅れている」として現れ、原因にたどり着くのに時間がかかります。**DMARC がいちばん見落とされます**(SPF / DKIM は「設定した」で終わりがちですが、**合っているかを教えてくれるのは DMARC のレポートだけ**)。`pnpm check:mail-dns` で確認し、手順は `docs/ops/MAIL_DELIVERABILITY.md`。**まず `p=none` で始めること**——いきなり `p=reject` にすると、設定漏れがあった瞬間に自社のメールが全部止まります。**バウンスは自動処理していません**(`MAIL_FROM` を捨てアドレスにせず、週次で見る運用)。 |
| **静的なアクセシビリティ検査では足りない** | `check-a11y` はソースを読むもので、**コントラスト比・ラベルの関連付け切れ・見出しの階層飛ばし**は**動かさないと分かりません**。E2E に `@axe-core/playwright` を挟みました。**`serious` と `critical` だけ**を落とす対象にしています——90 以上ある規則を全部課すと落ちたままになり、**止まった CI は無効化されます**(カバレッジで同じ失敗をしている)。 |
| **incubating は「判断の先送り」で増える** | ADR 0023 で tier を決めましたが、**incubating から出る／捨てる判断のタイミング**が無く、25 件が置き去りでした。`check-incubating-review` が **12 か月ごとの見直し**を求めます。**incubating のままでよいものもあります**(全銀・電帳法など、必要になったときに無いと困るもの)——咎めているのは判断の先送りだけです。**見直しの間隔を短くしないこと**: 急かすと、中身を見ないまま `stable` に上げられます。 |
| **被覆率の検査が、実態より低く出ていた** | `check-safety-parts` の判定が **`auditActions.record` だけ**を数えており、`auditActions.fileDelete` / `chatDelete` / `boardDelete` のような**用途ごとの入口を数え落として**いました(40% と出ていたが実際は 60%)。レート制限も同じで、アプリ側の共通入口(`limitPublic` / `guardWrite`)を知らず、**正しく守っている API を「未接続」と数えて**いました(46% → 実際は 71%)。**低い率は「直しようがない」と読まれ、数字そのものが信用されなくなります**——**共通の入口を作ったら、検査の `uses` にも足すこと。** |
| **削除の監査ログを 100% にした** | 残っていた 9 件のうち、**4 件は記録を足し**(テーマ・予約の取消・用語辞書)、**3 件は理由つきで免除**しました: ピン留めの解除(**消えるものが無い**)・開発ツールの一時データ(**業務データではない**)・取込のロールバック(**リポジトリ層で削除と同じトランザクション内に記録済み**。ルート側で重ねると、巻き戻ったときに「消したことになっている記録」だけが残る)。**免除には必ず `// no-audit: <理由>` を書くこと。** |
| **認可の無い口は、回数で守るしかない** | `limitPublic(req, "<口の名前>")` を `server/rate-limit.ts` に用意しました(429 と `Retry-After` を返す)。**判定できなかったときは通します**——制限器が落ちたときに業務まで止めるのは行き過ぎ。`setup/bootstrap`(**認証が存在しない状態で最初の管理者を作る＝総当たりの的**)、`balance/collect`(**共有鍵は総当たりできる**。定数時間比較は 1 文字ずつを防ぐだけ)、`vitals`(ログイン前の画面から送られる)などに付けました。 |
| **「前回の成功したデプロイを Re-run」では戻らない** | `docker-compose.prod.yml` が `:main` にタグを固定していたため、**壊れた版を出した直後に `pull` で取れるのは壊れた最新**でした。`INCIDENT_RESPONSE.md` にはその手順しか書いてありませんでした。イメージのタグを **`${IMAGE_TAG:-main}`** にして、切り戻しを 1 行にしています。**`migrate` にも sha タグを付けた**——`:main` だけだと、アプリを戻してもスキーマ適用は最新のままで、**戻した版が知らない列**を前提に動きます。`check-rollback-ready` が固定への逆戻りを見張ります。 |
| **鍵を替えると全員が即ログアウトする** | それでは**「漏れたので今すぐ替える」ができません**——**替えられない鍵は守りになりません**。`SESSION_SECRET_PREVIOUS`(基盤側は `previousSecret`)に旧鍵を入れると、**読むときだけ**旧鍵も試すので、利用者は気づかないまま新しい鍵へ移ります。**有効期間(7 日)より長く待ってから消すこと**——消した瞬間に、残っていた人が落ちます。**漏洩したときは待たない**(旧鍵を残すのは、漏れた鍵を使い続けること)。手順は `docs/ops/SECRET_ROTATION.md`。 |
| **アプリは別リポジトリなので、型を直接共有できない** | ADR 0021 でアプリを分けた結果、`line-console` から `internal-app` の API を叩くとき、**リクエストの形は呼ぶ側が手で書き写す**ことになる。**写した形は必ずずれ、動かすまで気づかない**。`@platform/openapi` で宣言し、`GET /api/openapi.json`（**認可の内側**）で配る——呼ぶ側は `openapi-typescript` で型付きクライアントを生成できる。**宣言し忘れても API は動く**ので、`check-openapi-coverage` が未宣言の数を上限ラチェットで見張る。**全部を宣言しなくてよい**——画面専用の API まで載せると、本当に使ってよいものが埋もれる。 |
| **トレースの送り先は「決めていない」で構わないが、繋いでおく** | 2026-08 まで `observability.ts` に「実運用では OTLP エクスポータ等へ差し替え」というコメントだけがあり、**差し替えるコードは無かった**。`OTLP_ENDPOINT` を設定したときだけ送る形に配線したので、**送り先を決めた日に環境変数を 1 つ足すだけ**で済む。未設定ならログにだけ出る——`docker logs` で追えるが、**コンテナを入れ替えると消える**ことは理解しておくこと。 |
| **依存の脆弱性監査（`audit`）はライセンスを見ていない** | 脆弱性は監査していたが、**GPL / AGPL の混入は誰も見ていなかった**。社内利用だけなら多くは問題ないが、**顧客へ納品する・SaaS として提供する**瞬間に、自社ソースの開示を求められうる。**深く使ってから気づくと剥がせない**ので、`check-licenses` で入った時点で止める。不明なものは許可一覧でラチェット——**登録は「確認済み」の意味を持つので、読まずに足さないこと**。 |
| **SBOM は要求されてから作ると間に合わない** | 取引先の調達審査で提出を求められて**その場で作れない**、脆弱性の一報が出て「うちは影響あるか」に**即答できない**、の 2 つが実際に困る場面。`pnpm sbom`(CycloneDX)で毎回作り、CI で 365 日残す。**外部ツールを入れていない**——pnpm のワークスペースを正しく辿れないことがあり、依存も増えるため。**OS パッケージと実行時取得分は含まない**ので、これだけで「全部」ではない。 |
| **初期 JS は黙って増える** | ライブラリを 1 つ入れるたびに数十 KB 増え、**どれが効いたか分からないまま**重くなる。気づくのは「最近遅くない?」と言われたときで、**そこから減らすのは難しい**。`check-bundle-size` が**上限ラチェット**で見張る。**絶対値の目標は置かない**——いきなり 200KB 以内にすると全ページが赤になり、止まった CI は無効化される(カバレッジで同じ失敗をしている)。 |
| **スキーマの適用方式を書き固定しない** | `db push` を叩く場所が **5 か所**に散っていた(`Dockerfile.migrate` / `setup.sh` / `setup.ps1` / `ci.yml` / `e2e.yml`)。`pnpm db baseline` で切り替える日に**全部直さないと、本番だけ `db push` のまま**残る——ADR 0014 が禁じている状態で、**列の削除が無警告で走る**。**`tools/apply-schema.mjs` を唯一の入口**にし、`prisma/migrations/` の有無で選ばせた。`check-migration-mode` が固定を見張る。 |
| **`NODE_ENV` では検証と本番を見分けられない** | **検証環境も本番と同じ `production` でビルドする**(本番と違うものを検証しても意味がない)ため、`NODE_ENV` は両方 `production` になる。「どの環境か」は **`APP_ENV`**(`@platform/env` の `appEnv()`)で持つ。**`isProductionRuntime()` は検証環境でも true** ——秘密値を必須にするかの判定はあちら、**宛先や通知先を分ける**のはこちら。知らない値(`prod` / `stg` の綴り間違い)は **`development` に倒す**。 |
| **エラー追跡が「条件だけ」だった** | `instrumentation.ts` の `if (featureEnv.SENTRY_DSN)` の中身が**コメントだけ**で、`INCIDENT_RESPONSE.md` は「Sentry で見る」と書いていた。**設定すれば動くように見えて動かない**——障害の最中に気づくことになる。配線し、`check-empty-branches` で同じ形を見張る。`@sentry/nextjs` は**依存に加えていない**(重く、使わない構成もある)ので、**モジュール名を変数にして**動的に読む——直接書くと未導入の環境で `pnpm typecheck` が `TS2307` で落ちる。 |
| **`.pathname` をパスとして渡さない(tools)** | Windows では `/C:/Users/…` になり、パスとして解決すると `C:\C:\Users\…` と**二重**になります。**Linux では偶然通る**ので、書いた本人は気づけません。2026-08、`pnpm smoke` が **Windows でだけ google の節で止まりました**(`smoke.mjs` が 9 箇所、`doctor.mjs`・`triage-boundary.mjs` が各 1 箇所)。**`fileURLToPath()` か `.href` を使うこと**——`smoke.mjs` の `toSpec` は、この誤りを見つけたら止めるようにしてあります。 |
| **検査は「コメントの中の文字列」も読む** | `check-permissions` は `requirePermission(…, "権限名")` を**正規表現で**拾います。`[^,]+` が改行をまたぐので、**コメントに `requirePermission(` と書いただけで、その先の別の行の文字列**を権限名として拾いました(2026-08、「入れ子にしない」という注意書き自体がこの検査を落とした)。**検査側でコメントを落とす**ようにしましたが、**正規表現の検査はこの類の誤検出を必ず持つ**と思って読むこと。 |
| **`<Button>` に色を `className` で塗らない** | 既定は `primary`(青地)なので、そこへ `text-[var(--color-primary)]` を重ねると**青地に青文字**で読めません。**26 箇所がこの状態**でしたが、**同じ行に残っていた `variant="secondary"`(生タグに付いた無意味な属性)が検査を素通りさせて**いました——`check-app-rules` は行に `variant=` があれば見逃す作りだったためです。無意味な属性を消した結果、**隠れていた本物が出てきました**。`variant="ghost"` を付けて解消済み。 |
| **`@platform/db` は `DbClientOptions` も公開する** | `createDb` の戻り値は `PrismaClient<DbClientOptions, …>` になるため、この型を入口から出していないと、アプリ側で **`TS2742: The inferred type of 'db' cannot be named …`** が出ます(2026-08)。**戻り値の型に出てくる型は、必ず `index.ts` から export すること**——アプリに深いパス(`@platform/db/src/client`)を import させないためでもあります。 |
| **`createDb` は `new` をしない(2026-08 に変更)** | **Prisma のモデルの型は「`new` に渡した設定オブジェクトの形」から決まります。** 基盤がクラスを受け取って `new` すると、抽象化された型を経由するため **`findUnique` の戻り値が `{}` になり**、`row.value` が「存在しない」と言われます。**第 1 引数は「設定を受け取って `PrismaClient` を作る関数」**にしてあります: `createDb((o) => new PrismaClient(o), env.DATABASE_URL)`。**クラスをそのまま渡す形に戻さないこと。** 呼び出しは 6 か所(各アプリの `server/services.ts` と `prisma/seed.ts`)。 |
| **`createDb` の引数の型(旧 `PrismaClientCtor`)** | **`new (options: { adapter: unknown; log?: unknown })` と具体的な形を要求していました**。引数は反変なので、**アプリが生成した `PrismaClient` クラスが代入できず**、`createDb(PrismaClient, …)` が `TS2345` で落ちます。落ちると **`TClient` が `unknown` に潰れ**、`db.expense` などが **`db is of type 'unknown'` として呼び出し側に 40 箇所以上へ波及**しました。**この型は上の「`new` をしない」変更で不要になり、削除しました。** |
| **`@platform/db` が `Prisma.sql` を使っていた** | `Prisma`(値)は **`prisma generate` の生成物**で、**`typecheck` は generate を走らせません**——**生成物が無ければ必ず落ちます**(`TS2305: has no exported member 'Prisma'`)。`client-types.ts` が掲げる「生成物に依存しない」方針の**最後の例外**でした。**`sql-tag.ts` に自前のタグを置いて切りました**。**値は必ず `$1, $2 …` に束縛され、`$queryRawUnsafe` の第 2 引数以降として渡ります**——**文字列連結は一切しません**ので、安全性は `Prisma.sql` と同じです。識別子だけは `raw()` で埋めますが、**`search.ts` は `isSafeIdentifier` を通してから渡しています。この検証を消さないこと。** |
| **`AsyncBoundary` に `children` を渡したまま `data.x` を書く** | **JSX の子要素は先に評価されます。** `<AsyncBoundary loading={data === null}>{data.rows}</AsyncBoundary>` は、**この部品が「読み込み中」を返すより前に `null.rows` で落ちます**。**7 画面が同じ形**でした(会計・分析・資金繰り・CMS・ダッシュボード・概況・学習)。`cashflow-client` には**同じ趣旨の警告コメントが既に書いてあった**のに、他の画面には伝わっていません——**正しい形は早期 return** です: `if (data === null) return <AsyncBoundary loading={error === ""} error={error} onRetry={…} />;`。`AsyncBoundary` の `children` は**任意**にしてあります。 |
| **生タグに `variant="secondary"` が付いていた(26 箇所)** | `<td variant="secondary">` のように、**HTML の要素に部品の props が残って**いました。**何の効果も無く、ただ型検査を落とすだけ**です。`Button` などから書き換えた名残と思われます。**`check-app-rules` は生タグの使用は数えますが、生タグに付いた不明な属性は見ていません**——**検査が緑でも守られていない**の一例です。 |
| **監査ログの「誰が」が要求本文だった(`expense.request.create`)** | `run(req, actor)` の `actor`(認証済みの利用者)を**受け取りながら使っておらず**、本文の `applicant` をそのまま記録していました——**要求本文を書き換えれば、他人の名前で記録を残せます**。`noUnusedParameters` の指摘で見つかりました。**`actor` を記録し、申請者は `after` に残す**形にしています。 |
| **line-console の Zoho CRM 呼び出しが無認証だった** | `createZohoCrmClient({ dataCenter, clientId, clientSecret, refreshToken })` と書かれていましたが、**このクライアントが受け取るのは `apiDomain` と `accessToken`** です。渡した値は**どこにも使われず、認証ヘッダが空のまま**呼んでいました。**トークンマネージャ(`createZohoTokenManager` + `createAuthedFetch`)を `fetchImpl` に差す**のが正しい形です。 |
| **`SESSION_TTL_SEC` が `.env.example` にだけあった** | `env` の zod スキーマに無かったため、`env.SESSION_TTL_SEC` は**型に存在せず**、`api/auth/login` と `zoho-auth` の 2 か所が落ちていました。**スキーマに無い値は検証もされません**——`.env.example` に足したら、**必ず `server/env.ts` にも足すこと**。 |
| **`PaymentStatus` の `overpaid` が抜けていた(showcase 3 箇所)** | `Record<PaymentStatus, string>` の対応表から**過入金だけ漏れて**いました。放置すると**返金が必要な請求書が「入金済」と同じ見た目**になります。**union に値を足したら、`src/lib/union-literals.ts` を必ず更新すること**(そのために置いてあります)。 |
| **索引に「足す手順」を書いた（ADR / 資料）** | **検査で落ちても、なぜ落ちたか分からないと直せません**——**落とすなら、直し方も書く**こと。ADR は**2 か所に載せる**必要がある(全件の表と、用途別の索引)——**忘れると smoke が落ちます**と明記した。**何を ADR にするか**の基準も書いた: **後で覆したくなる決定だけ**(設計の決定 / 「なぜそうしないか」が問われるもの / 法令や業務の制約)——**手順は `CHECKS.md` へ、使い方は README へ、一時的な回避策は HANDOVER へ**。**全部を ADR にすると、本当に重要な決定が埋もれます**。資料の索引にも同じ手順を足した(**索引から辿れない資料は、書いていないのと同じ**) |
| **ADR に「何を知りたいか」の索引を足した** | **22 件が 1 つの表**で、**番号順に並んでいるだけ**——**目的から引けないと、あることに気づけません**。**15 の目的**(基盤とアプリの分け方 / DB の扱い / 保存先 / AI / 外部連携 / ログイン・権限 / データを消す・残す / 日付 / 性能 / 出し先 / 検査の作り方 ほか)から引ける形にした。**関連する ADR をまとめた**のが要点——「基盤とアプリの分け方」は**0002(コード)・0021(引き継ぎ資料)・0015(パッケージ)の 3 つ**にまたがります。**全件が索引にあることを smoke で固定**——**新しい ADR を足して索引に載せ忘れると落ちます** |
| **上限方式を ADR 0022 に残した** | **18 本**で使っているのに、**「なぜ 0 にしないのか」がどこにも書かれていません**でした——**「全部直してから検査を入れる」では検査がいつまでも入らない**、だから**入れてから減らす**という判断です。**上限 0 にできるものは 0 に**(**18 本中 12 本が既に 0**)。**弱点も明記**: **上限を現状に合わせると、減らす動機が無くなります**(`check-delete-confirm` は 9 件 / 上限 9 で放置されていた)。**覆すとしたら**も書いた——**長く動いていない上限は 0 にできないか**、**増え続ける上限はそもそも約束が現実的でない**のかもしれません。**このセッションで決めた運用**(壊して確かめる / 作る前に探す)は**手順なので ADR にしない**——**ADR は「後で覆したくなる決定」に絞る**べきです |
| **引き継ぎの分け方を ADR 0021 に残した** | このセッションで決めた方針(基盤とアプリで分ける)が、**`CLAUDE.md` と各 HANDOVER に散っているだけ**で、**「なぜそう決めたか」がどこにも無い**状態でした——**後で「1 つにまとめたい」と言われたときに、判断の根拠が失われます**。**覆すとしたら**も書いた: **アプリが 1 つに戻ったら統合**、**10 個を超えたらアプリ側も更に分ける**。**`showcase` と `crud-template` を基盤側に入れた理由**(**他のアプリを作る人が真似する**)、**既存を移さなかった理由**(**パスで機械的に判断すると、基盤の知見をアプリ側に埋めてしまう**)も明記。**方針を決めたら ADR に書く**——**資料に散らすだけでは、根拠が残りません** |
| **「終わっていないこと」8 件を 点検し、2 件を更新した** | **1 番目(壊れる順番)と 6 番目(メモリ実装)が同じ話**なのに**相互参照が無かった**——**「何が起きるか」と「どう直すか」**で視点が違うので分けたまま、**誘導を足した**。**8 番目(実地課題)の末尾**に「**手順そのものは誰も見張っていない**」とあったが、**このセッションで文言の見張りを 8 件足した**ので更新——ただし**見張っているのは主要な文言だけ**で、**手順書の細かい記述はいまも誰も見張っていません**。**課題をやって詰まったら、その場で手順書を直してください**。**資料は自分が変えた分も見直す**必要があります——**古い記述が残ると、「まだ無い」と思われます** |
| **「検査で見つからないもの」の表を精密にした** | 前回の誤り(索引の検査があるのに「無い」と書いた)を受けて、**表に「検査はあるか」の列を足した**——**「無い」と「あるが自動では落ちない」と「回せない環境がある」は別**です。**索引の有無**は `check-missing-index` が見る(**効いているかは `EXPLAIN ANALYZE`**)、**型**は `typecheck` がある(**AI の環境では回せない**)、**性能**は `loadtest` で測れる(**自動では落ちない**)——**本当に検査が無いのは 4 つ**(本番でしか出ないもの / 業務の正しさ / 使いやすさ / 設計の誤り)。**「検査はあるか」を必ず確かめてから書く**ことも明記し、**smoke で固定**した |
| **全体を見直し、自分が書いた誤りを 1 件見つけた** | **「索引の不足は検査では見つかりません」と 2 か所に書きましたが、誤り**でした——**`check-missing-index` が既にあります**(`where` で絞る列に索引があるかを見る)。**私が検査の一覧を数え間違えて見落としていた**もので、**訂正して `verify-checks` にも登録**した。**登録の途中でも 2 回つまずいた**: **ダミーの列名が実在しない**と発火しない(`expenseRow.memoText` → `expenseRequest.applicant` に直した)——**検査が「schema にある列で、索引が無いもの」を見ている**ため。**「見つからない」と書く前に、本当に検査が無いか探してください**——**あるのに無いと書くと、次の人が余計な調査をします**。**全 76 検査を個別に実行し、すべて通ることを確認**した |
| **`suggest` が showcase の見本も教えるようにした** | **パッケージから「見本の画面」が探せません**でした——`nav.ts` にパッケージ名は 5 件しか書かれておらず、`APPS_AND_DEMOS.md` には 0 件。**showcase の 78 画面を走査して 120 パッケージ分の対応**を作り、`pnpm suggest` の結果に**`見本: pnpm dev:showcase → /expenses`** を出すようにした。**読むより見た方が早い**——**動くものを触れば、使い方がすぐ分かります**。**索引を手で書かず、実装から集める**形にしたので、**画面が増えても勝手に追いつきます**(手で書くと必ず腐ります) |
| **資料の文言を見張る検査（8 件）に、変更手順を書いた** | このセッションで**「資料にこう書いてあるか」を見る検査**を 8 件足したが、**変えたいときにどうするかが書かれていません**でした——**落ちるのは正しい動き**ですが、**直し方が分からないと検査だけ消されます**。**4 段階の手順**を書いた(要らないのか言い換えたいのかを決める → 言い換えなら `includes()` も変える → 消すなら理由を HANDOVER に → **壊して確かめる**)。**「検査だけ消して資料を残す」のはやめてください**——**見張りが外れたことに、誰も気づけません**。**見張っている 8 件の一覧**も `CHECKS.md` に載せた——**何が見張られているか分からないと、直しようがありません** |
| **入門資料に「検査は 3 段階」を書いた** | **新しい人が最初に読む資料**に、**検査の役割・限界・壊して確かめること**が反映されていませんでした——**ここに無いと、必要なものを回さずに出します**。**3 段階**(書き換えた直後は `pnpm check` / 出す前は preflight / 画面を直したら `e2e`)に絞って書き、**詳しくは `TESTING_GUIDE.md`** へ誘導。**「緑でも安心しない」**と**「検査を足すときは必ず壊して確かめる」**も入れた。**このセッションで得たことは、資料の 3 か所(入口・詳細・入門)に届いて初めて意味を持ちます**——**書いた場所が違うと読まれません** |
| **「どの検査が何を見ているか」の一覧を作った** | **smoke / test(vitest) / preflight / check / verify / e2e / loadtest / drill / advisor / suggest** と種類が多く、**役割が分からないと、必要なものを回さずに出します**。`TESTING_GUIDE.md` の最初の節に**表**を置き、**何を見るか・かかる時間・いつ回すか**を書いた。**`CLAUDE.md` にも短い版**を入れた(AI が毎回読むため)。**smoke と vitest の違い**も明記——**smoke は「全体が壊れていないか」を素早く**(2,468 件を 1 ファイルに集約)、**vitest は「1 つの関数を細かく」**(342 ファイルに分散)。**書き方の約束(並び順・上限・資料の記述)は smoke で見張っている**ことも書いた |
| **`CLAUDE.md` の「検査 72 本」が古かった（実数 75）** | **`check-doc-numbers` はパッケージ数とアプリ数しか見ておらず、検査の数は誰も見張っていません**でした——**AI が毎回読む入口の数字が間違っている**状態。**数え方が 4 通り**あることも分かった: **`tools/check-*.mjs` が 82 本**、**preflight で回るのが 69 本**、**`CHECKS.md` の表が 87 行**(smoke 内の検査も載る)、**`CLAUDE.md` が 72**。**「検査の数」と言うときは、何を数えているかを添えてください**。実数(82)に直し、**smoke で固定**した(壊して確認済み) |
| **「検査で見つからない」と書いたものを、実際に確かめた** | 書いただけで終わらせず、**手で調べました**——**索引の不足は 0 件**(`where` で絞る列が索引にあるかを全走査)、**PDF のフォント**と**タイムゾーン**は Dockerfile にあり。**残るのは「本番でしか出ないもの」「業務の正しさ」「使いやすさ」**で、**どれも人が確かめるしかありません**。**「見つからない」と書いたまま放置すると、本当は確かめられるのに諦める**ことになります——**確かめたら `CHECKS.md` の表に書き足してください** |
| **索引の不足を静的に見る検査を作った（77 本目）** | 「検査で見つからないもの」に**索引の不足**を挙げたが、**挙げただけでは直りません**——**機械で見つけられる分**を検査にした。**`findMany` で絞る列に索引があるか**を、スキーマと突き合わせる。**2 件見つかった**: `LendingRow.returnedAt`(**未返却を探す**のに使う。貸出は増え続ける)、`BalanceSnapshot.takenOn`(**毎日 1 件ずつ増える**ので年々遅くなる)——**どちらも索引が無い**状態でした。**限界も書いた**: **静的に見るだけ**で、**本当に効いているかは `EXPLAIN ANALYZE`**(型が違う・関数を通している・件数が少ないと使われません)。**複合索引は先頭列でしか効かない**ことも実装に反映(`[userId, date]` は **`date` だけの検索には効きません**)。**smoke が「アプリ名の手書き」を指摘**——**アプリが増えたときに検査から漏れ、漏れても緑になる**ためです |
| **「検査で見つからないもの」を資料の先頭に置いた** | **緑は「明らかな間違いが無い」という意味**で、**「正しい」という意味ではありません**。**7 つ**を挙げた: **索引の不足**(`check-schema` は `@id` しか見ない)、**型の不一致**(この環境では `typecheck` が回せない)、**業務の正しさ**(「上限が 2 万円か 3 万円か」は誰も検査できない)、**本番でしか出ないもの**(フォント・タイムゾーン・外部サービス)、**画面の使いやすさ**、**性能の劣化**(100 人になるまで出ない)、**設計の誤り**(「そもそも要らなかった」)。**`check-tsdoc` の穴を実例として書いた**——**「残債 0」を何度も報告していたのに、それを保つ仕組みが無かった**。**検査を作ったら壊して確かめる**と**何を見ていないかを知る**の**両方**が要ります |
| **「数を数えるだけ」の検査を全部探した（1 件だけ、実害なし）** | `check-tsdoc` の穴を見つけたので、**smoke 全体で同じ形**を探した——**`.length > N` だけで判定している `ok()` は 1 件**で、**次の行で中身も見ている**ので実害なし。**smoke は概ね健全**でした。**`check-schema` も確かめた**——**索引(`@@index`)は見ておらず、`@id` の有無だけ**です。**索引の不足は検査では見つかりません**——`pnpm loadtest` と `EXPLAIN ANALYZE` で見つけてください(`LOAD_TESTING.md`)。**検査が何を見ていないかを知る**ことも、**何を見ているかと同じくらい大事**です |
| **TSDoc の不足が見張られていなかった（緑なのに守れていない）** | smoke の `check-tsdoc` は**「件数が 1000 超か」しか見ていません**でした——**TSDoc を丸ごと消しても通ります**。**「残債 0」を何度も報告してきましたが、それを保つ仕組みはありませんでした**。**`check-tsdoc` は引数なしだと一覧を出すだけ**(終了コード 0)で、**preflight でも回していません**——**smoke だけが見張り**なのに、**その smoke が中身を見ていなかった**。`analyze()` の結果から**不足を数える**形に直し、**壊して確かめた**(TSDoc を消すと落ちる)。**「数を数えるだけ」の検査は、他にもあるかもしれません**——**件数の比較しかしていない `ok()` を疑ってください** |
| **「検証できない」とされた 3 件を、手で壊して確かめた** | `docs-orphans`(資料の行を削る) / `package-shape`(`scripts` を消す) / `doc-numbers`(数字を変える)——**3 件とも効いていました**。**「仕組み上できない」は「確かめられない」ではない**——**手なら確かめられます**。**壊し方を 3 回間違えた**(`package-shape`)——`exports` `main` `types` を消しても落ちず、**実際に見ていたのは `scripts`**。**`grep -oE '\\bpkg\\.[a-zA-Z]+' tools/check-なんとか.mjs` で、何を見ているか先に読む**のが早い。記録は `CHECKS.md` の表に足した |
| **「検証できない 23 件」に理由を書いた** | `verify-checks` は **74 件中 51 件の発火を確認**し、**23 件を「仕組み上できない」**として除外していたが、**理由が 5 件しか書かれていなかった**——**本当は確かめられるのに諦めているのか分かりません**。**4 種類に分類**して書いた: **設定ファイルを見る**(ダミーの `.ts` を置いても対象外)、**既存ファイルの書き換えが要る**(新しいファイルを足しても落ちない)、**実機が要る**(DB や外部サービス)、**上限方式で 1 件では足りない**(上限に余裕があると落ちない)。**`check-doc-numbers` は実際に確かめられる**ことも分かった(`CLAUDE.md` の数字を変えると落ちる)——**ダミーファイル方式と合わないだけ**で、**手で壊せば確かめられます**。**「確かめなくてよい」ではなく「この仕組みでは無理」**と書き分けた |
| **全 69 検査を個別に実行し、すべて通ることを確認した** | preflight がタイムアウトしたので、**1 本ずつ実行**して確かめた——**落ちたのは `check-scan-reporting` だけ**で、**中身は通っており「遅いだけ」**でした。**67 個の検査を `spawnSync` で順に起動する**ので**1 分以上**かかります——**preflight がタイムアウトする原因**。**速くするなら並列化**だが、**同時に 67 個立ち上げるとメモリを食い潰す**ので**数個ずつ**にすること。**「終了コードが 1」を見て欠陥だと思い込んだ**——**実際は 124(タイムアウト)**で、**出力は ✅ を出していました**。**終了コードの意味を確かめてから判断すること** |
| **preflight を通しで回し、144 件の失敗を 0 に（smoke だけ見ていた）** | **smoke が全緑でも preflight は別**でした。**最大の問題は README の import 例 118 件が実在しない関数**を指していたこと——**「そのまま貼れる 1 行」と書いたのに、貼ると動きません**。実際の export から**機械的に 76 件を修正**し、`i18n` `notify` は手で直した。他に: **私が `React.useState` を足したのに import 忘れ**、**`/toolbox` で使う 4 パッケージが showcase の依存と `transpilePackages` に無い**、**生成物のずれ**、**大きいファイルが 1 件増えた**(`packages/ai/src/index.ts`——**smoke が 8 箇所から読むので分割は避けた**)。**`verify-checks`（検査の自己検証）が既にあった**——**壊して確かめる仕組みが仕組み化されていた**のに、**私の新しい検査 2 本が未登録**でした。登録したら **`check-dual-impl-args` が発火しない**と分かった——**1 行で書かれたメソッド**(`async f(a) { return a; }`)に正規表現が当たらず、**`)` の後に `{` か `:`** で区切る形に直した。**このセッションで 3 回目の「効いていない検査」**です |
| **`server-localtime` を 26 → 22 件に（実害のある 4 件を修正）** | 一覧を見て**業務で使うものだけ**直した(詳細は `apps/internal-app/HANDOVER.md`)——**残る 22 件は試験データの生成**などで、**直す価値がありません**。**「全部直す」より「危ないものを選ぶ」**方が正しい。**修正の途中で 2 回つまずいた**: **①`now` を使っている箇所が他にもあった**のに定義を消し、**参照エラー**になった(**型検査が回せないので、`grep -c "now\."` で確認するしかありません**)。**②番号に時刻も入っていた**——`getHours()` は**9 時間ずれ**ますが、**番号だけ見ても気づけません** |
| **`--list` を足した直後に、実際の不具合が 1 件見つかった** | `server-localtime` の一覧を出せるようにしたら、**資金繰りの「直近 6 か月」が月初の朝だけ 1 か月ずれる**のが見つかりました(詳細は `apps/internal-app/HANDOVER.md`)。**一覧が出せないと、こういうものは永久に見つかりません**——**上限方式に `--list` を義務づけた効果**が、その場で出た形です。**残り 25 件も同じ形**(`getFullYear()` を使う API は**年度の判定でずれます**)——**一覧を見て、業務で使うものから直してください** |
| **上限方式の検査に `--list` を義務づけた** | `server-localtime`(26 件)と `css-vars` に**一覧を出す手段が無く**、**どれが対象か分からない**状態だった——**減らせないので、上限を守るだけ**になり、**現状の追認**で終わります。2 本に足し、**smoke で「`--list` があること」を見張る**ようにした。**追加の途中で 2 回つまずいた**: **①`if (process.argv.includes(...))` の形を決め打ちした**——実際は **`const SET = process.argv.includes(...)`** で、**探した文字列が一致せず、何も入らなかった**。**②入ったつもりで検査が落ちた**ので気づけた——**`grep -c` で確認する習慣**が要ります |
| **確認なしの削除を 9 → 6 件に（経費の一括取り消しを追加）** | **一括で取り込んだ経費がまとめて取消済**になり、**1 件ずつ戻す手段はありません**——**押した人が件数を知らない**まま押せていました。**チャットは誤検出**だった——**ピン留めを外す**操作で、**また留められる**ので確認は不要。**一覧に出たものが全部危ないわけではありません**——**中身を読んでから**判断すること。**ボタンが部品の中にある形**も踏んだ(`ImportHistoryTable` に `onRollback` を渡す)——**画面のファイルを見てもボタンが無い**ので、**渡す関数を差し替える**必要がありました |
| **確認なしの削除を 1 件ずつ見た（件数だけで判断しない）** | 残り 7 件を調べたら、**チャットは「ピン留めの解除」**で**すぐ戻せる**もの——**確認は不要**でした(**誤検出に近い**)。**経費の履歴は取り込みの一括取り消し**で、**その回で入れた経費が全部消える**——**部品側**(`@platform/ui` の `ImportHistoryTable`)に確認を足した。**部品に足しても件数は減りません**(検査はアプリだけを見る)——**それでも安全性は上がります**。**件数だけ見て「危ない」と決めない**こと——**1 件ずつ中身を見る**必要があります。**用語集・テーマ・開発用画面は、確認を挟むとかえって使いにくい**ので残しました |
| **確認なしの削除を 9 → 7 件に減らした** | **CMS ページの削除**にも確認を足した——**外から見られなくなり**、**検索エンジンにも SNS にも載っている**ので、**気づくのは見に来た人**です。**残る 7 件のうち、チャットと経費の履歴は次に直す価値がある**(`CHECKS.md` に一覧)。**同じ作業で 2 回つまずいた**: **①末尾が `</div>` か `</PageShell>` かはファイルによる**(決め打ちで `assert` が落ちた)、**②`assert` で止まると、その前の変更も入らない**——**import だけ抜けた状態**になり、**`ConfirmDialog` が未定義のまま**動きそうに見えた。**部分的に適用される変更は、通ったつもりで壊れます** |
| **上限方式の弱点に気づき、1 件減らした** | `check-delete-confirm` は **9 件 / 上限 9**で、「これ以上増えない」は守れても**9 件が放置**されていた——**上限を現状に合わせると、減らす動機が無くなります**。一覧を見て**予約の取り消しに確認を足した**(**押した瞬間に消え、他の人が押さえると戻せない**——同じ枠が空いている保証がない)。**減らしたら `--set-limit` で上限も下げる**こと(**下げないと、また増やせます**)——**smoke が「上限と現在値が一致していない」と教えてくれました**。`check-api-auth` も壊して確かめ、**効いていることを確認**した |
| **主要な検査を実際に壊して確かめた（6 本）** | **`check-unbounded-query` / 色の直書き / 自己承認 / `check-tsdoc` / `check-dual-impl-args` / よくある失敗**——**すべて効いていました**(記録は `CHECKS.md`)。**壊し方を間違えて 1 度誤解した**——`check-hardcoded-colors` は **Tailwind の色クラス**(`bg-slate-500`)を見るもので、**16 進の直書きは smoke 側の別の検査**。**16 進を書いて「落ちない」と判断したのは私の確認方法の誤り**でした。**その検査が何を見ているかを読んでから壊すこと**を `CHECKS.md` に足した。**「効いていない」と判断する前に、壊し方が正しいかを疑ってください** |
| **「よくある失敗」を `CLAUDE.md` に置いた（実際に繰り返した 5 つ）** | **①既存を確認せずに作り直す(5 回)**——`captureFrame`・Maps・再試行・Outlook・p95 は**どれも既にあった**。**②作ったが繋いでいない**——**「作る」と「繋ぐ」を 1 組に**。**③片方だけ直す**——Prisma とメモリの 2 実装。**④検査で共有の器を使う**——後ろの検査が見る状態を変える。**⑤資料を「書いた場所」で満足する**——**誰が読む場所か**を考える。**この検査でも「効いていない」を踏んだ**——`片方だけ直す` は**本文にも出る**ので、**見出しを消しても「ある」と判定**していました。**見出しの形(`### 3. 〜`)で見る**よう直した。**壊して確かめなければ、また気づけませんでした**——**同じ教訓を、同じセッションで 2 回踏んでいます** |
| **「検査を作ったら壊して確かめる」を、作る人が読む場所に書いた** | この教訓は HANDOVER に 4 回書いていたが、**`CHECKS.md` と `CLAUDE.md`(検査を作る人が読む場所)には無かった**——**書いた場所が違うと、読まれません**。**4 段階の手順**を書いた(通る → 壊す → **落ちることを確かめる** → 戻して通る)。**②で落ちなければ、その検査は効いていません**。**誤検出の確認も要る**ことを明記(**落ちるようになったら、次は「落ちすぎていないか」**)——**作る → 壊して確かめる → 誤検出を潰す**の 3 段階。**この検査自体も壊して確かめました**——`CLAUDE.md` の文言を変えると落ち、戻すと通ることを確認 |
| **2 実装の引数の食い違いを見張る検査を作った（74 本目）** | 前回「更新漏れを 3 回踏んだ」原因は、**この環境で `pnpm typecheck` が回せない**こと(依存が入っていない)。**型検査の代わりではなく、回せないときの保険**として `check-dual-impl-args` を作った。**`createMemoryXxx` と `createPrismaXxx` の組**で、**同じ名前のメソッドの引数の数**を比べる。**設計を 2 回間違えた**: **①同じ器の中で比べた**——メソッドは 1 つずつしかないので**何も見つからない**。**②器ごとに区切った**——**2 実装は別の器**なので**比較されなくなった**。**わざと壊して確かめる**まで、**効いていないことに気づけませんでした**——**検査を作ったら、必ず壊して確かめてください**。`export-schedule.ts` で**誤検出も 2 件**出た(1 ファイルに**複数の器**があり、まとめて見ると別物を比べる) |
| **見つけた設計の穴を、その場で塞いだ（承認 3 種が揃った）** | 前回「文書承認は誰が出したか記録していない」と**記録だけ**したが、**記録しても誰も直しません**——**その場で塞ぐ**方が確実。`submittedBy` を足し、**経費・勤怠・文書の 3 つが同じ形**になった。**移行の判断**: **既存の行は空文字**にし(**分からないものを推測しない**)、**空なら通す**(**止めると古い申請を処理できなくなる**)。**呼び出し側の更新漏れを 3 回踏んだ**——Prisma 実装、メモリ実装、そして**改行された行**。**同じ関数の呼び出しを全部探す**ときは、**引数が改行されている形**も見てください(`grep` の 1 行検索では見つかりません) |
| **1 つ直したら、同じ形を全部探す** | 経費の自己承認を直した後、**同じ問題が勤怠にもありました**——**片方だけ直すと「直したつもり」**になります。**探して初めて分かったこと**: **文書承認は「誰が出したか」を記録していません**(申請者の項目が無い)——**自己承認を防げず、「誰が出した文書か」も追えない**。**承認だけ記録して、申請を記録していない**状態でした(詳細は `apps/internal-app/HANDOVER.md`)。**1 つの穴を塞ぐときは、同じ構造を全部見る**——**検査も両方に書いて**おけば、次から漏れません |
| **資料を書いて見つけた穴を、実際に塞いだ** | 前回アプリの HANDOVER を書く過程で見つけた**「自分の経費を自分で承認できる」**を修正した(修正の詳細は `apps/internal-app/HANDOVER.md`)。**資料を書くと穴が見つかる**——**実装を読み直すことになる**ためです。**「差し戻しは許す」判断**が要った: 全部止めると**間違えて出した申請を取り消せなくなります**——**防ぐことと、使えることの両立**を考える必要がありました |
| **各アプリの HANDOVER を実装から拾って充実させた** | **枠だけ作っても書かれません**——`grep '// \*\*〜\*\*'` で**実装に書かれた注意を拾い上げる**方法（README で使ったもの）を、アプリにも適用した。**internal-app で見つかった穴**: **自分の経費を自分で承認できてしまう**(`startWorkflow` に申請者は渡すが、**承認者に自分が含まれる場合を弾いていない**——**兼務の人**で起きる)、**`DebugBar` が 3 秒ごとに 404 を出し続けていた**(**開発時にしか出ないので気づくのに時間がかかる**)、**金額の 0 は「—」で出す**(**`¥0` が並ぶと「入力し忘れ」と区別できない**——**「金額が無い」と「0 円」は別**)。**line-console**: **同じメッセージ ID は 1 回だけ**(LINE は応答が返らないと再送する)、**自分の送信も Webhook で返る**ので**区別しないと無限に往復**する。**public-site**: **問い合わせ API はリダイレクトを追わない**(**追うと攻撃者のサーバに送られます**) |
| **「どこに書くか」の地図を資料の入口に置いた** | 分け方が **CLAUDE.md・各 HANDOVER・PACKAGE_CONSOLIDATION** に散っていた——**探さないと分からない**状態。`docs/README.md` の冒頭に**1 枚の表**にまとめた(落とし穴は README、判断は HANDOVER、決めた理由は ADR、アプリのことはアプリ側、**自分で書いたものは `suggest` の対応表にも**)。**何を書くかの基準**も入れた: **「何をするか」より「何を間違えやすいか」**——**前者は名前から分かりますが、後者は踏むまで分かりません**。**HANDOVER の既存 43 件の仕分けは、やはりやめた**——`apps/internal-app/src` を指す 4 件を調べたが、**内容は基盤の知見**だった(例: 「金額の表記がサーバの `LANG` に依存」は `formatYen` の話)。**パスで機械的に判断すると、基盤の知見をアプリ側に埋めてしまいます** |
| **HANDOVER 以外もアプリごとに分けた（出し先・試験の状況）** | **`TESTING_GUIDE.md` は「試験の書き方」、`DEPLOY_AWS.md` は「出し方の手順」**に絞り、**どのアプリで何をカバーしているか / どこへ出すか**は**各アプリの README（このアプリの運用）**へ移した——**アプリが増えるたびに基盤の資料が伸びると、手順が埋もれます**。**移したのは範囲の宣言だけで、既存の記述は消していません**(仕分けを誤ると基盤の知見が失われるため)。**`new-app` の README にも運用の節**を入れた(**出し先「まだ決まっていません」と空で置く**——**欄が無いと、どこに書けばよいか迷って書かれません**)。**書いて初めて分かったこと**: **ConoHa の手順書が無い**(ADR 0009 で方針は決まっているが、**手順は出すときに書く**状態)——**検査が「実在しないパスを指している」と教えてくれました** |
| **入門資料に「作る前に探す」を書いた** | `pnpm suggest` を作ったのに、**入門資料に載っていませんでした**——**新しく入る人が知らないと、探さずに書き始めます**。**基盤には 119 個あり、全部を覚えるのは無理**——**探せればよい**のです。**探さずに書くと、たいてい既にあります**(郵便番号の検証も、CSV の取り込みも、消費税の計算も)——**書けば動きますが、境界で必ず間違えます**(全角の数字、負の金額、月末)。**見つからなかったときの手順も 3 つ**書いた(別の言葉で探す / `module-list.md` を見る / **対応表に足す**)。**入門資料に載っていることを smoke で固定** |
| **`suggest` が import 例も出すようにした** | **見つけただけでは使えません**——**書き出しの 1 行**があると、**そのまま貼って始められます**。README の「よく使うもの」から取り出す形にした。**`ai` と `ui` に節が無かった**ので追加(**最も使われる 2 つ**なのに、探しても使い方が出ない状態だった)。**全 README に import 例があることを smoke で固定**。**実務の質問で精度を測った**: 「領収書を読み取りたい」→`ocr`、「承認を LINE で」→`line`+`workflow`、「在庫が合わない」→`inventory`、「退職者のアカウント」→`access-review`——**4 件中 3 件が完全に正確**(1 件は 2 位に誤りが混ざるが 1 位は正しい) |
| **`suggest` の対応表を全 120 パッケージに広げた** | 42 件しか登録されておらず、**77 件は業務の言葉で探せません**でした——**あることを知らずに作り直される**状態。全件を登録し、**新しいパッケージを作ったら足す**運用を `PACKAGE_CONSOLIDATION.md` に書いた。**技術の名前ではなく業務の言葉を入れる**こと——「`normalizePhone`」ではなく「**電話番号**」。**探す人は関数名を知りません**。**検査の正規表現でも 1 度失敗**——`[a-z-]+` だと **`i18n` を拾えない**(数字が入るため)。**検出漏れは「登録済みなのに未登録に見える」**という形で出て、**直そうとして混乱**します。**全パッケージが対応表にあることも smoke で固定**した |
| **`pnpm suggest <やりたいこと>` を作った（作る前に探す）** | **119 個あると、あることを知らずに作り直します**——**探せないものは、無いのと同じ**。**README の本文を探しても当たりませんでした**——「経費」は**ほぼ全ての README に例として出る**ので、**`faq` が「経費の申請」で 1 位**になった。**業務の言葉とパッケージの対応表を手で書いた**——「精算」と `accounting` を繋ぐのは**人の知識**で、**機械には結び付けられません**。**探して見つからなかったら対応表に足す**運用にした(**次の人が同じことで迷いません**)。**語の分割でも 1 度失敗**——「遅い」を「遅」「い」に分けると**どちらも短すぎて落ちる**ので、**分割した語と元の語の両方**を見るようにした。**対応表のパッケージが実在することを smoke で固定**——**無くなったものが残っていると、「あります」と言われて探しに行き、見つかりません**。**`crud-template` の既定は妥当**だった(16 パッケージ)——入力の無害化は**React が自動でやる**ので `html` は要らず、`form` は**フォーム状態管理**で CRUD の雛形には過剰 |
| **`new-app` が HANDOVER も作るようにした** | 前回アプリごとに引き継ぎを分けたが、**`crud-template` に HANDOVER が無く、`new-app` も作らない**ままだった——**新しいアプリを作ると、追加した検査で落ちる**状態。**「どちらに書くか」の表つき**で作るようにした(**開いた人がその場で判断できる**ように)。**気づいたことを書く欄も空で置く**——**「まだありません」と書いておくと、足す場所が分かります**(欄ごと無いと、**どこに書けばよいか迷って書かれません**)。`crud-template` にも HANDOVER を置き、**触るときの注意**を書いた: **ここが壊れていると新しいアプリが全部壊れる**(**気づくのは作った人**で、原因はここだと分からない)、**例を消さない**(削るより**コメントで「消してよい」と書く**)、**凝ったことを書かない**(**高度な書き方を置くと、それが標準だと思われます**) |
| **引き継ぎ資料をアプリごとに分けた** | この資料は**基盤・showcase・crud-template だけ**にし、**各アプリのことは `apps/<名前>/HANDOVER.md`** へ。**基盤の HANDOVER にアプリ固有のことを書くと、800 行の中に埋もれて誰も探せません**。**判断の基準**: **他のアプリでも起きるなら基盤側、そのアプリでしか起きないならアプリ側**。**迷ったら基盤側**——**アプリ側に書いたものは、別のアプリを作る人が読まず、同じ失敗を繰り返します**。**`showcase` と `crud-template` は基盤の一部**として扱う(見本と雛形なので、**他のアプリを作る人が真似する**ため)。**2026-08 より前の記述は移していません**——**仕分けを誤ると基盤の知見が失われる**方が損なので、**探すときは両方を見る**ことを冒頭に書いた。**各アプリに HANDOVER があることを smoke で固定**した |
| **権限の変更履歴が残っていなかった（棚卸し画面を作って気づいた）** | `UserRow.roles` は**カンマ区切りの文字列を上書き**するので、**何がいつ足されたか残りません**——棚卸し画面で「いつ付いたか」を見たいとき、**利用者の作成日で代用するしかありませんでした**。`upsert` が**差分（追加・削除）を返す**ようにし、**API 側で監査ログに含める**形にした。**判断**: **記録は呼び出し側で**(この層に監査を繋ぐと**`@platform/db` への依存が増え、試験で差し替える範囲が広がる**)、**差分だけを残す**(変わっていないものを含めると**差分が埋もれる**)、**`after` だけでは足りない**(「いま何を持っているか」しか残らず**何が足されたか分からない**)。**「誰がいつ管理者権限を付けたか」は、後から必ず聞かれます**。**作った画面が、基盤の穴を見つけた**——**繋いで初めて分かること**がある例 |
| **README を 119 件すべて書き終えた（19 回目・最後の 10 件）** | **利用の多い順に 19 回**に分けて進め、**全パッケージが 4 節構成**(1 行の説明 / これは何のためか / 使う前に知っておくこと / よく使うもの)になった。**書き方は実装の `// **〜**` を README に持ち上げる**——**想像で書くと間違ったまま次の人に渡ります**。最後の 10 件: `bytes`(**`btoa` は日本語で例外**)、`color`(**目で見て「大丈夫」は当てにならない**)、`json`(**`BigInt` は `JSON.stringify` で落ちる**——DB の集計結果に混ざる)、`web-storage`(**プライベートモードでは例外**、**artifacts では動かない**)、`push`(**一度断られると次から出せない**)、`testing`(**テストで `new Date()` を使うと月末や年末だけ落ちる**)、`loadtest`(**平均は 595ms でも 5 人は毎回 10 秒待っている**)、`os-notify`(**画面がロックされていても表示される**ので個人情報を入れない)、`bluetooth`(**繋がり続ける前提で作らない**)、`hid`(**バーコードリーダーはキーボードとして見える**。**末尾の Enter でフォームが勝手に送信される**)。**これで終わりではなく、踏んだ落とし穴を足していくもの**——**古い記述は「無いより悪い」**ことも記録した |
| **`push(...配列)` で smoke が落ちた（スプレッドの引数上限）** | **README を長くしたら、smoke が `Maximum call stack size exceeded` で全部落ちました。** 原因は `packages/search/src/bm25.ts` の **`out.push(...toks)`**——**スプレッドは引数として展開される**ので、`toks` が数万語になると**「引数が多すぎる」でスタックが溢れます**。**再帰ではありません**(スタックトレースが `docTokens` の繰り返しに見えるので、再帰だと誤解しました)。**長い文書を入れたときだけ落ちる**ので、**気づくのが遅れます**——数人で使っている間は起きません。**ループに変えて解決**。**他にも `push(...)` は数箇所ありますが、要素数が入力に比例しないもの**(設定・監査イベントで数十〜数百)なので直していません。**「利用者の入力や文書の長さに比例して増える配列」にスプレッドを使わないこと**——そこだけが危険です |
| **README を 108 件まで（18 回目）** | `media`(**変換は終わらないことがある**——放っておくと**プロセスが溜まって落ちる**。**ffmpeg を Dockerfile に入れる**——開発機にあっても本番のコンテナには無い)、`elearning`(**部分正解は不正解**——**中途半端な理解を通さない**ため。**一瞬で全問正解は答えを知っていたか適当に押したか**)、`cast`(**一覧を返す前に必ず絞る**——**非公開のプロフィールが漏れます**。**「5.0(1 件)」と「4.5(100 件)」では後者の方が信頼できる**)、`blueprint`(**出られない状態に入ると業務が進まなくなる**。**設計図と実装は別物**——`fsm` で実際に縛る)、`rpa`(**失敗したらキーを記録しない**——記録すると**次回に飛ばされて永久にやり直されません**。**人の判断が要るものは自動化しない**)、`device`(**UA は偽装できる**ので**守りには使わない**。**「スマホかどうか」より「幅が何 px か」**が確か) |
| **README を 102 件まで（17 回目）** | `theme`(**色だけで区別しない**——白黒印刷も、色の見え方が違う人もいる。**目で見て「大丈夫」は当てにならない**ので数字で確かめる)、`units`(**畳の大きさは地域で違う**——不動産公正取引協議会の基準を使用。**計算は SI 単位で**行い、これは表示のためだけ)、`url`(**同じ組織かは eTLD+1 で見る**——**`co.jp` で切ると全部同じ**になる)、`site`(**現在地はオブジェクトではなく文字列で渡す**——参照が違うので**判定が常に外れます**)、`social`(**なりすましを検証できません**——**本人確認には使わない**)、`secrets`(**外部サービスが落ちたら起動できません**——`.env` を残して併用するか、**取れなかったときの動き**を決める。**入れ替えに何分かかるかが被害を決めます**) |
| **README を 96 件まで（16 回目）** | `xlsx`(**Excel の日付はシリアル値**——読み違えると**1900 年**になる。**型を偽らない**、`as` で通すと**数値のつもりが文字列**)、`xml`(**Shift_JIS を要求する相手がまだある**——宣言と実際を揃える。**`attr=""` と属性なしは受け側で意味が変わる**)、`realtime`(**このハブは認可を見ない**——**全員に流すと見えてはいけないものが見えます**。**届かないことがある**ので重要なものは通知と併用)、`task`(**`toISOString()` は UTC**——**JST の 0〜9 時が前日**になり**期限が 1 日早く見えます**。**期限なしは最後に並べる**——「いつか」は永久に来ない)、`status-page`(**アプリと同じ場所に置かない**——アプリが落ちたら状況ページも落ちる。**終わったら必ず消す**——残っていると次から誰も見なくなる)、`sequence`(**12/31 に採番すると JST では 1/1 で 1 年ずれる**。**飛びは避けられない**ので**欠番があってよい設計**に) |
| **README を 90 件まで（15 回目・日本の業務向け）** | `tax`(**`Math.round(-2.5)` は -2**——**返品や値引きで額がずれる**ので対称に丸めている。**軽減税率は品目で決まる**——「食品は 8%」ではなく**外食は 10%、持ち帰りは 8%**)、`zengin`(**1 桁ずれると銀行が受け付けない**——しかも**エラーの理由が分かりにくい**。**濁点は 1 文字**として数える(「ガ」は 2 桁))、`webhook`(**パースする前の生の文字列で検証**——JSON にしてから戻すと**空白や順序が変わって署名が合わない**。**すぐ 200 を返す**——重い処理をしてから返すと**タイムアウトで再送**される)、`saga`(**打ち消しも失敗する**が**他の打ち消しは続ける**——途中で止めると**もっと中途半端**になる。**メールを送ったは取り消せない**ので**外部への通知は最後に**)、`sms`(**日本語は 70 文字で 1 通**——長い文章は**複数通分の料金**。**緊急連絡には向かない**)、`validation`(**形が正しくても実在するとは限らない**。**マイナンバーは要らないなら持たない**のが最善) |
| **README を 84 件まで（14 回目・決済と読み取り）** | `ocr`(**必ず間違えます**——**金額は必ず人が確かめる**形に。「読めたからそのまま登録」は事故のもと。**推測せず、空欄の方が安全**)、`ekyc`(**「審査中」を成功として扱わない**——後で否認される。**免許証の画像には住所・生年月日・顔写真**が入るので、**可能なら外部サービスに置いたまま**にする)、`print`(**背景色は印刷されません**——枠線か文字で区別する。**必ず紙に出して確かめる**、特に余白)、`notion`(**続きがあるのに気づかず一部だけ取り込む**のが最も危ない。**監査が要るものは DB へ**)、`paypal`(**`live` にすると実際に決済が走る**——テストのつもりで本物を動かさない)、`stripe`(**`fetch` を差し替えられない**ので**契約テストが効かない**——動作確認は Stripe のテスト環境で。**金額は最小単位**で、**ドルで `100` は 1 ドル**) |
| **README を 78 件まで（13 回目）** | `net`(**回数は 0 始まり**——1 を渡すと**最初から長く待ちます**。**ばらつきを入れないと全員が同じ秒数で再開**する)、`logger`(**業務データは入れ子でも隠す**——浅い伏せ字では漏れる。**何でも `error` にすると本当のエラーが埋もれる**)、`importer`(**行番号はヘッダの分だけずれる**——**どちらの番号かを必ず明記**。**ファイルの行番号の方が親切**。**一部だけ取り込まない**——どこまで入ったか分からないのが最も困る)、`quote`(**全体値引きは明細に比例配分**しないと**明細の合計と総額が合わない**。**端数は最後の明細に寄せる**)、`purchase`(**発注より多く届くのは異常**——誤出荷か**発注を二重に出した**可能性。**黙って受け入れない**)、`phone`(**不正なら `null`**——**「たぶんこの番号」で SMS を送ると他人に届きます**。**US と CA は同じ国番号**なので番号だけで国を決めない。**保存は国際形式、表示は国内形式**と分ける) |
| **README を 72 件まで（12 回目）** | `dencho`(**前のハッシュを含めて鎖にする**ので、**途中の 1 件を書き換えると、それ以降が全部合わなくなる**——**どこで改ざんされたか**まで分かる)、`context`(**コンテキストの外では `undefined`**——起動時の処理やバッチでは入っていない)、`debug`(**本番で有効にすると全クエリが記録され遅くなる**。**記録には SQL の値=個人情報が入る**ので開発機の外に持ち出さない。本番の遅さを見るなら `SLOW_QUERY_LOG`)、`fs`(**拡張子は誰でも変えられる**ので**中身で判定**する。**不明なら `null`**——「たぶん画像」で処理すると危ない)、`feed`(**1 文字の間違いで購読者全員に何も届かない**——しかも**こちらは気づけない**。**`&` を最初に変換**しないと `&amp;amp;` になる)、`faq`(**読まれていない項目は、書き方が悪いか、そもそも要らない**。**古い答えは害になる**——制度が変わったのに残っていると**間違った手続きをする人が出ます**) |
| **README を 66 件まで（11 回目）** | `address`(**住所は完全には正規化できない**——ビル名・部屋番号は書き方が無限。**突き合わせに使うのは番地まで**)、`booking`(**時間は半開区間 `[開始, 終了)`**——閉区間にすると**境目で必ず衝突**。**同時押しは DB の一意制約で弾く**)、`analytics`(**個人を追わない**——「誰が何回開いたか」は**監視**になる。**画面ごとの傾向**で十分)、`access-review`(**権限は付くばかりで外れない**——**外すきっかけが無い**まま溜まり、**入社 3 年目の人が全部の権限を持つ**ことになる。**「なぜ付けたか」が無いと外してよいか誰にも判断できない**)、`barcode`(**余白を詰めると読めません**。**画面で見えても低解像度で印刷すると読めない**)、`blog`(**公開したものは残ります**——検索エンジンにも SNS にも載っており、**消してもキャッシュは残る**) |
| **README を 60 件（半数）まで（10 回目・土台と金額の 6 件）** | `core`(**例外にする場面もある**——「あってはならない」ことは例外で、`Result` にすると**確かめない経路**が生まれる。**上限を無制限にしない**——**いつか必ずそれが起きます**)、`currency`(**知らない通貨は 2 桁として扱う**が**正しいとは限らない**。会計は**銀行丸め**が慣行——四捨五入だと**繰り返すうちに切り上げ側へ偏る**)、`depreciation`(**最終年度に 1 円を残す**(備忘価額)、**定率法は途中で定額法に切り替わる**——**知らないと最後まで定率で計算して合いません**)、`apikey`(**平文は発行時にしか返らない**。**接頭辞で用途と環境が見分けられる**ので**本番の鍵を開発機に貼る事故**を防げる)、`config`(**優先順位を一方向に**——場所によって順序が違うと追えない)、`commerce`(**割引の適用順で額が変わる**——「10%引き→500円引き」と逆は**別の額**。**在庫の引当は決済の直前に**——カート投入時だと**買わない人が在庫を占有**する) |
| **README を 54 件まで（9 回目・画面と守りの 6 件）** | `mobile`(**録音は必ず止める**——止めないと**タブに録音中の印が出続けて「盗聴されている」と感じさせます**。**利用者がキャンセルしても `false`** なので**エラーとして扱わない**)、`form`(**同じ項目のエラーは最初の 1 件だけ**——全部出すと「必須です。かつ 3 文字以上。かつ英数字のみ」となり**直しようがありません**。**画面の検証は利用者の助けであって守りではない**)、`fsm`(**到達できない状態・出られない状態は設計の誤り**だが、**「完了」「破棄」は出られなくて構わない**——**意図しているかどうか**が問題)、`guard`(**認証が要らない API には印を**——**書き忘れなのか意図なのか**を区別するため)、`html`(**場所によって変換するものが違う**——要素の中身では `>` も。**自分で正規表現を書かない**、`<script>` を消すだけでは**`<img onerror=...>` で動きます**)、`faker`(**本番データの穴埋めに使わない**——**気づかれずに本番に残ります**。**秘密の生成にも使わない**、乱数の質が暗号用ではない) |
| **README を 48 件まで（8 回目・外部連携 6 件）** | `zoho`(**`ZOHO_DC` を間違えると 401**——「認証情報が違う」に見えるが**実際は別の DC を叩いている**。**日付を `slice(0,10)` で切ると 1 日ずれる**)、`freee`(**リフレッシュトークンは使うたびに変わる**——**保存し直さないと次回から失敗**。ここが最も多い詰まりどころ。**クレジットカードは負債**なので残高がマイナスで返る)、`line`(**押した人を `postback` のデータで決めない**——**利用者側で作れる**ので `userId=admin` と偽れる。**受け取った画像はすぐ写す**——LINE 側は一定期間で消す)、`slack`(**ファイル送信は 3 段階で、③まで通って初めて成功**——途中で止まると**送ったつもりなのに誰にも見えない**)、`google`(**スコープはサービスごとに別**——「認証したのに動かない」の多くはこれ。**Apps Script はエラーを 200 で返す**)、`microsoft`(**在籍者は `accountEnabled` で絞る**——絞らないと**止めたはずのアカウントが復活**する。**`userPrincipalName` はメールと違うことがある**) |
| **README を 42 件まで（7 回目・AI と土台の 6 件）** | `ai`(**送ったものは取り消せない / 青天井で課金される / 間違える**——この 3 つを冒頭に。**A/B 比較は呼び出しも費用も 2 倍**)、`rag`(**目的は「嘘をつかせない」こと**。**給与表が索引に入ると誰かの質問で引かれる**——**入れてから消しても、その間に引かれた分は戻せません**)、`mcp`(**道具の説明は AI が読む**ので**何が返るか**まで書く。分かりにくいと**使ってくれません**)、`integrations`(**時間制限は 2 種類**——1 回の試行と、**再試行を含む全体**。再試行するなら**その回数分だけ積算**される)、`pii`(**伏せ方は用途で変える**——メールは**ドメインを残す**、カードは**下 4 桁のみ**。**全部を消すと使えなくなります**。**画像の中身は伏せられません**)、`crypto`(**コストを変えると全員ログイン不能**になる。**共有の既定 salt は廃止**——1 つ破られたら全部破られるため) |
| **README を 36 件まで（6 回目・仕組み系 6 件）** | `pdf`(**開発機にはフォントがあるので、本番のコンテナで初めて分かる**——請求書が全部□で出てから気づくのは遅い)、`image`(**回転 → 縮小の順**。逆にすると**縦横が入れ替わったまま縮みます**。**EXIF を消す前に回転**する——スマホは横に倒して撮っても**縦のデータ**で保存し、向きは EXIF に入れるため)、`i18n`(**機械翻訳をそのまま使わない**——「承認」が「許可」になるなど**業務の言葉がずれます**)、`flags`(**`flagName` を省略すると、いつも同じ人が実験台**になり、**その人たちだけが未検証の機能を次々に踏みます**。**省略しても動く**ので気づきにくい)、`jobs`(**失敗したものは残す**——消すと原因が分からなくなる)、`cron`(**月末処理に `31` を使わない**——**2/4/6/9/11 月に実行されません**。「月末の集計が偶数月だけ来ない」という形で表に出る) |
| **README を 30 件まで（5 回目・業務系 6 件）** | 実装のコメントから拾う方法で、**業務で使うもの**を書いた。`attendance`(**UTC で切ると JST の 0〜9 時の打刻が前日**——**深夜勤務の人だけ毎回ずれる**という形で表に出る)、`payroll`(**賞与の上限は 2 種類で数え方が違う**——健康保険は**年度累計 573 万円**、厚生年金は**1 回ごと 150 万円**。**課税所得の 1,000 円未満切り捨ては法令**なので独自に丸めない)、`inventory`(**残高を直接持つと必ず合わなくなる**ので**履歴から計算**する。**在庫がマイナスになるのは実務で普通に起きる**ので**計算は止めない**)、`contract`(**解約通知期限は更新期限より先に来る**。**`new Date()` をそのまま使うと判定が 1 日ずれる**)、`audit`(**不正を疑うためではなく間違いを直すため**。**ID の羅列ではなく「山田が経費 1234 の金額を 3,000 → 5,000 に変えた」**と書く)、`ratelimit`(**IP だけで数えると同じ会社の全員が 1 人分**。**Redis 実装をサーバ処理から直接 import すると `next build` が落ちる**) |
| **README を 24 件まで（4 回目の 6 件・実装のコメントから拾う方法を確立）** | **書き方を変えた**——**実装の `// **〜**` を先に読んで、README に持ち上げる**。**想像で書くと間違ったまま次の人に渡ります**。この方法を `PACKAGE_CONSOLIDATION.md` に `grep` の例つきで残した。**今回の 6 件**: `security`(**`'self'` は nonce を使うと無視される**——両方書いても効かない。**`unsafe-inline` は本番で必ず `false`**)、`cache`(**人によって変わるものは鍵に利用者を含める**——含めないと**他人のデータが見えます**。**消し忘れが一番多い**)、`upload`(**種別が違っても EXIF があっても保存する**——**拒むと正しいファイルまで通らなくなる**ため。**領収書を撮ると、どこで撮ったかが残ります**)、`storage`(**key に `../` は使えない**——**利用者が付けた名前をそのまま key にすると踏みます**)、`board`(**投票の同時更新は 1 票ずれる**——実害が小さいので見ていない)、`seo`(**`robots.txt` で拒否すると `noindex` を読みに来ない**——**すでに載ったものは消えません**) |
| **README を 18 件まで書き直した（3 回目の 6 件）** | `db`(**遅くなるのも壊れるのもたいていここ**。**「増え続けるか」ではなく「1 回で何件返るか」**で `take` を判断する、**絞る列と並べる列は組で索引に**)、`cms`(**公開予約は定期実行が止まっていると出ません**——予約したら当日に確認。**消しても版は残る**ので「間違って公開した」はなかったことにできない)、`chat`(**既読は「開いた」であって「読んだ」ではない**。`@全員` は**100 人の手を止めます**)、`invoice`(**登録番号が空だと相手が仕入税額控除を受けられません**)、`mail`(**BCC を使う**——TO や CC にすると**全員のメールアドレスが互いに見えます**。**宛先を間違えると取り返せない**ので送信前に画面に出す)、`search`(**「京都」で「東京都」が出る**のは方式の性質。**賢くしようとすると辞書の更新という新しい仕事が増えます**)。**冒頭 20 文字未満で 2 件落ちた**——前回に続き同じ検査に助けられた |
| **README を 12 件（利用の多い順）で書き直した** | **冒頭が `module-list` に出る**ので、薄いと**119 個の中から探せません**。**2 回目の 6 件**: `accounting`(**帳簿は 1 円合わないだけで締められない**——貸借が合わないと**`Result` ではなく例外**にした理由も書いた)、`auth`(**画面で隠すのは守りではない**——ボタンを消しても**API を直接叩かれれば通る**)、`workflow`(**滞留は件数ではなく日数**で見る。**1 件が 3 か月放置 > 10 件が 1 日遅れ**)、`notify`(**本文に個人情報を入れない**——Slack や LINE は**社外の仕組み**。「経費が承認されました」で十分)、`csv`(**Excel なら `bom: true`、他システムなら `false`**——既定は `false`)、`session`(**メモリ実装は再起動で 100 人が一斉にログアウト**)。**冒頭の 1 行が 20 文字未満だと検査に落ちる**ことを 3 件で踏んだ——`module-list` に出るので**短いと何のパッケージか分かりません** |
| **showcase に未紹介の 4 パッケージを追加し、README の書き方を決めた** | **①未紹介が 6 件**あった(`bytes` `color` `json` `push` `testing` `web-storage`)。**4 件を 1 画面**(`/toolbox`)にまとめた——**どれも数行で使えるもの**で、**それぞれに画面を作ると探しにくくなる**ため。伝えることを明確にした: **`btoa` は日本語で例外**、**薄いグレーは作った人の画面では読める**、**`JSON.parse` は壊れた入力で画面ごと落とす**、**プライベートモードでは `localStorage` が例外**。`testing`(テスト用)と `push`(許可が要る)は対象外。**色の検査に引っかかった**——デモは**色を入力させる**ので初期値が要るが、検査は「画面の配色」と区別できない。**16 進を書かず `rgbToHex` で生成**する形にした(**区別できない仕組みに合わせて、書かない方を選んだ**。基盤の関数を使う見本にもなる)。**②README**——**107 件が薄い**(冒頭が `module-list` に出るのに、注意が書かれていない)。**利用の多い 6 件**(`report` `datetime` `utils` `observability` `env` `http`)を**4 つの節**(1 行の説明 / これは何のためか / 使う前に知っておくこと / よく使うもの)で書き直した。**残りは触ったときに書く**方針を `PACKAGE_CONSOLIDATION.md` に記録——**使ったことのないパッケージの落とし穴は書けません** |
| **`take` の残りを 12 → 5 件に減らし、HANDOVER に読み方を足した** | **①`take` の追加**——**絞りが無く全件を返す**ものが 2 件あった(`manualJournalRow` / `invoiceReceiptRow`)。**並び順も `asc` → `desc` に変えた**——**上限で切るなら新しい方から取らないと、古い 500 件だけが見える**ことになる(「最近入れた仕訳が出ない」という形で現れます)。他に承認待ち(溜まる)・入出庫(1 商品でも年に数百件)にも付けた。**残る 5 件は確認済みで安全**——`attendance`(月単位で最大 31 件)・`chat-reactions`(1 メッセージあたり数十)・`chat-rooms`(その人の部屋で数十)。**判断の基準を検査に書いた**: **「増え続けるか」ではなく「1 回で何件返るか」**——**表が 100 万行あっても、絞って 20 件しか返らないなら問題ありません**。**②HANDOVER の読み方**——「危ないところ」が **800 行以上**になり、**読み切ることを想定していない**状態になった。**「上から読まない。直そうとしているものの名前で `Ctrl+F` する」**と冒頭に書いた。**新しい順に並んでいる**ので、**古い記述と食い違ったら上が正しい**ことも明記 |
| **承認画面に一括操作を入れ、性能を見る画面を作った** | **①一括操作**——**100 人規模では月末に 100 件**上がってきて、**1 件ずつ押すのは現実的でありません**。選択 → まとめて承認/却下 → **5 分以内なら取り消し**。**判断**: **帯は選んでいるときだけ出す**(常に出ていると**押すつもりのないときに押されます**)、**1 件ずつのボタンも残す**(**1 件だけ処理したい人に選ばせるのは手間**)、**取り消しはその場に出す**(別の画面に行かせると**戻すのを諦めます**)、**戻すのは「逆の操作」**(承認の取り消しは却下。**完全には元に戻らない**が**進んでしまった状態は止められる**)。**smoke が `window.confirm` を指摘**——基盤の `ConfirmDialog` に直した(**ブラウザ既定の見た目は画面と揃わず、読み飛ばされます**)。**②性能を見る画面**(`/admin/performance`)——**記録する仕組みを作っても、見る手段が無ければ意味がありません**。遅いクエリ(回数の多い順)と画面速度(**平均ではなく p75**)を出す。**数字が出ないときの説明も画面に書いた**(`SLOW_QUERY_LOG=1` が要る / 1 割の抽出に当たっていないだけ)。**管理者だけが見られます**——性能の数字には**どの画面が使われているか**が表れるためです |
| **作った仕組みを実際に繋いだ（「作ったが繋いでいない」の解消）** | スロークエリの記録・画面速度の計測を作ったが、**アプリで一度も使われていなかった**——**このセッションで繰り返し指摘した形**を自分でやっていた。**①スロークエリ**——本番では `onQuery` を渡さない方針だったので、**`SLOW_QUERY_LOG=1` のときだけ**有効にした(**渡すとわずかに遅くなる**ので、「遅い」と言われたときだけ)。**`DEBUG_TOOL` とは別**——あちらは**1 リクエストの全クエリ**(開発用)、こちらは**しきい値超えだけ**で本番でも動かせる。**②画面速度**——`sendBeacon` で送る(**普通の `fetch` だと画面を閉じた瞬間の値が消え、一番知りたい「離脱時の遅さ」が取れない**)、**認可を通さない**(ログイン画面の速度も知りたい)、**誰が送ったかは記録しない**、**上限 200 件**(誰でも送れるので**正確な統計より落ちないこと**を優先)。**smoke が 2 件の欠陥を指摘してくれた**——`req.json()` が空の本文で落ちる、`process.env` の直読み。**検査が効いている**ことの確認にもなった |
| **100 人規模の運用を支える 4 つ（スロークエリ・表示速度・切り分け・移行）** | **①スロークエリの記録**——`onQuery` で 1 件ずつは測れたが、**「どれが遅いか」を集める器が無かった**。**数人の間はどのクエリも速い**ので何も出ないが、**遅くなってから入れるのでは比べる相手がありません**——**先に入れておく**もの。**SQL をそのまま持たない**(`WHERE email = 'yamada@example.com'` のように**値が入り、個人情報が残ります**)。**回数の多い順**に出す(**1 回だけ遅いものより毎回遅いものを先に直す**方が効く)。**②画面の表示速度**——**サーバが 100ms で返しても、画面に出るまでが遅ければ意味がありません**。**100 人いれば遅い端末の人が必ずいる**が、**開発機は速いので作った人には見えない**。**平均ではなく p75**(75 人が 1 秒・25 人が 10 秒でも**平均は 3.25 秒で「まあまあ」に見える**)。**CLS を軽く見ない**——「押そうとしたらボタンがずれた」は**承認画面で起きると事故**。**③「遅い」の切り分け**(`SLOW_TRIAGE.md`)——**100 人規模では「落ちた」より「遅い」が多くなる**。**まず 3 つ聞く**(どの画面 / いつから / 他の人も)。**「全部遅い」と言われても、まず 1 つ具体的な画面を出してもらう**(人は「全部」と言いがちだが、実際は 1 つのことが多い)。**④止めずに直す手順**(`DATA_MIGRATION.md`)——**「メンテのため 2 時間停止」は数人なら通るが 100 人だと業務が止まる**。**列の追加は 3 回、名前の変更は 5 回に分ける**、**`UPDATE` を 1 回で流さない**(表全体がロックされ**すべての書き込みが止まる**)、**索引は `CONCURRENTLY`**、**戻す手順を先に書く**(**書けないなら、その変更はまだ早い**)、**金曜の夕方はやめる**(**壊れても月曜まで誰も気づけない**) |
| **一括操作と取り消しを組で追加（100 人規模の承認）** | **100 人規模では承認者の負担が最初に限界**を迎えます——月末に 100 件の申請を**1 件ずつ押す**のは現実的でありません。**ただし一括は事故が大きい**(「全選択 → 却下」の押し間違いで**100 件が一度に却下**)ので、**取り消しと必ず組**にした。**設計の判断**: **途中で止めない**(止めると**「どこまで進んだか」を人が調べる**ことになる)、**取り消しは 5 分**(**いつまでも戻せるのは危険**——その間に別の人が変更していれば**後から入った変更を壊します**)、**1 回しか戻せない**(連打で二度戻るのを防ぐ)、**件数を確認文に必ず出す**(**100 件を 1 件と間違えたときに気づける**)、**戻せないことも必ず伝える**(「戻せると思っていた」が一番困る)。**保持期間の削除は定期実行に足そうとして取り消した**——smoke がそのファイルを差し替えて読むため**影響範囲が読めず**、**動作を確かめられない変更を入れるより手順を残す**方が安全と判断(「終わっていないこと」の 2 番目に手順を書いた) |
| **100 人規模に向けて索引と `take` を見直した（検査 73 本目）** | **①索引を 4 モデルに追加**——`AttendanceRow`(**100 人 × 250 日 = 年 2.5 万件**。「その人の、その月」を引くので **`[userId, date]` の組**で。**別々に作ると組み合わせでは効きません**)、`AssetRow`(**並べる列に索引が無いと、全件を読んでから並べ替え**)、`DocApprovalRow` / `AttendanceApprovalRow`(承認待ちは毎日見る)。**②`take` の無い一覧を 71 件検出**し、**増え続けるもの 3 件**に上限を付けた: 勤怠の全期間(**年 250 件 × 勤続年数**)、通知(**100 人 × 毎日 5 件 = 年 18 万件**)、承認待ち(**押されるまで消えず、承認者が休むと溜まり続ける**)。**全部に付けるのは誤り**——勘定科目・部署は数十で止まるので不要。**「増え続けるか」で決める**。**③`check-unbounded-query`(73 本目)**を新設し、**上限方式**で増えないようにした。**増え続ける表(`expense` `attendance` `notification` など)で `take` が無いものは一覧に出す**ので、優先して直すべきものが分かる |
| **音声・ベクトル圧縮・エージェント計画を追加し、負荷測定の手順を作った** | **①文字起こし**——**固有名詞は間違えます**(「弊社の田中です」が「兵舎の棚下です」)。**言語を指定する**(しないと短い音声で英語と誤判定)、**固有名詞を先に教えると精度が上がる**、**会議の音声は個人情報**(録ることを参加者に伝える)。**②ベクトルの圧縮**——1 件 6KB × 10 万件で **600MB**。**メモリに載らなくなると検索が急に遅くなる**。**精度は少し落ちる**(上位 10 件の順番が入れ替わる程度)ので、**1 位と 2 位を厳密に競わせる用途には向かない**。**数万件を超えてから**で十分——**困る前に複雑にしない**。**③エージェントの計画**——そのまま流すと**「まず全件を削除して、作り直します」と本気で計画してきます**。**走らせる前に計画そのものを見る**(知らない道具・手順が多すぎる・同じ道具の繰り返し=ループの疑い・理由が無い)。**1 手順ずつ進める**——一気に流すと**3 手順目で失敗しても 4 手順目以降は気にせず進み、間違った前提のまま最後まで走ります**。**④負荷測定の手順**(`docs/ops/LOAD_TESTING.md`)——**p50/p95/p99 は既に実装済み**だった(**5 回目の見落とし**)。足りないのは**測る手順と基準**。**平均ではなく p95 を見る**(95 人が 100ms・5 人が 10 秒でも**平均は 595ms で「まあ速い」に見える**)、**p99 は 100 人なら毎日 1 人**。**遅かったときに見る順**(索引 → 全件読み込み → N+1 → メモリ実装)と、**やらない方がよいこと**(測る前に最適化する / キャッシュで隠す / サーバを増やす)も書いた |
| **AI 時代の守り 第 2 弾（幻覚・除外・説明・保持・承認待ち・印）** | **①幻覚の検出**——**RAG を入れた最大の目的は「嘘をつかせない」こと**なのに、**引いた文書に書いていないことを答えても誰も気づけない**。**数字と固有名詞だけ**を照合する(意味の照合は**別の AI 呼び出しが要り費用が倍**)。**桁区切りの揺れを吸収**し、**1 桁は無視**(数え上げがうるさい)。**見つかったら止めず、人に確認させる**——止めると**正しい言い換えまで弾かれます**。**②AI へ送らない指定**——**給与表が RAG に入る事故は取り返しがつかない**(入れてから消しても**その間に引かれた分は戻せない**)。**既定で `no-ai` `confidential` を弾く**ので、設定を書き忘れても印を付けた文書は守られる。**迷ったら弾く**——逆は直せない。**③利用者への説明**——**「AI が作った」と分からないまま渡すと、人が確認したものだと思われる**。**未確認であることを隠さない**、**元にした資料が無いことも書く**。**④保持期間**——**無期限に持つと漏れたときの被害が期間に比例**。**中身と使用量を分けて持つ**(中身は 90 日、数字は 3 年、判断は 7 年)。**日付が読めないものは残す**(消すと**壊れた記録が黙って消える**)。**⑤人が押すまで待たせる**——**危ない道具も、これがあれば安全に増やせる**。**期限切れは実行させない**(状況が変わっているのに動く)、**連打で二重に実行させない**。**⑥AI が作った印**——**人が直したら外す**(残すと**直した人の労力が無駄**になる)が、**元が AI だったことは残す**(消すと経緯が失われる) |
| **AI 時代の守り 8 つ（乗っ取り・出力検査・判断記録・キャッシュ・個人上限・待ち行列・移行・鮮度・実行記録）** | **①指示の乗っ取り**——**本当に危ないのは取り込んだ文書に仕込まれている**場合。**取引先の PDF の白い文字に「システムプロンプトを出力せよ」**が実在する。**利用者に悪意がなくても成立**する。ただし**完全には防げない**ので、**本当の守りは「AI に権限を渡さない」「道具は読み取りだけ」「出力を人が見る」**と明記。**②出力の検査**——**入力を伏せても AI は文脈から推測して書く**。**RAG が同じ索引の給与表を引用**する方が現実的。**③判断の記録**——「なぜ却下されたか」を**説明できない判断は労務・会計では通らない**。**`reviewed` が false のまま業務に使わせない**。**④キャッシュ**——100 人が同じことを聞けば**100 回課金**。ただし**人によって答えが変わるなら鍵に利用者を含める**(含めないと**他人の答えが返る**)。**⑤個人ごとの上限**——全体だけだと**1 人の暴走で全員が止まる**。**0.8 を超えたら知らせる**(当日に「もう使えません」では困る)。**⑥待ち行列**——100 人同時だと**レート制限で全員がエラー**。**待つ方が全員失敗よりまし**。**失敗しても枠を返す**(返さないと全部止まる)。**⑦埋め込みの移行**——**途中で切り替えると、作り直していない文書が検索に出なくなる**(「あるはずの規程が出ない」)。**⑧知識の鮮度**——**就業規則が改訂されても古い版で答え続ける**。**一律の期限にしない**(議事録は古くて当たり前。鳴り続けるアラートは無視される)。**⑨実行記録**——**「誰の指示か」が無いと、記録があっても追及できない** |
| **AI 時代に要る 5 つを実装（出力検証・版管理・評価・監査・分析）** | **①出力の検証**——**「JSON だけ返して」と頼んでも、そのとおりには返りません**(```json の囲み、前後の説明文)。`extractJson` で取り出し、**壊れていたら直さずに諦めます**——**推測で直すと「金額が読めなかった」より「違う金額が入った」方が危険**。`retryUntilValid` で聞き直し、**何が駄目だったかを次の質問に渡す**(ただ聞き直すより通る)。**②プロンプトの版管理**——「ちょっと直したら**前より悪くなった**」を戻せるように。**同じ中身なら版を増やさない**(増やすと「何回変えたか」が意味を失う)、**なぜ変えたかが一番大事**(「修正」だけだと何も分からない)。**保存先はメモリなので DB へ**——**消えて困るのは「なぜ変えたか」**(中身はコードにも残るが、理由はここにしかない)。**③評価**——「良くなった」を**感覚ではなく数で**。**1 問で止めない**(どこまで壊れているかを知るのが目的)、**合計が同じでも中身が入れ替わる**ので**新しく失敗するようになった問題**を出す。**毎回同じ点にはならない**ので**1 問の差で騒がない**(3 問以上下がったら調べる)。**④監査は実装済み**だった(伏せ字済みのプロンプトを記録)。**⑤分析**——`byUser` はあったが**用途別が無かった**。**「山田さんが月 3 万円」だけでは減らせるか分からない**——**「何に使ったか」が分かって初めて、やめる判断ができます**。**業務の名前**を入れること(「chat」のような技術の名前は役に立たない)も明記 |
| **前提が「数人」から「100 人まで増える」に変わった** | 資料の「利用者 3 人」を**すべて 100 人規模に改めた**うえで、**「終わっていないこと」の 1 番目**に**壊れる順番**を書いた: **①再起動で全員ログアウト**(セッションがメモリ)、**②同じ通知が 2 回届く**(2 台構成でロックが効かない)、**③二重登録**(冪等キー)、**④上限が台数倍**(レート制限)、**⑤一覧が遅くなる**(索引と `take`)。**1 台で運用する限り 1〜4 は起きません**——**2 台目を立てる日が直す期限**。**⑤は人数だけで起きます**——100 人が毎日使えば**1 年で経費 3 万件・監査ログ数十万件**。**「今は速い」は「100 人でも速い」ではありません**。**先に測る**(`pnpm loadtest`)——**遅くなってから直すのは、動いているものを触ることになり危険** |
| **AI にストリーミングを追加** | AI の返事は数秒〜数十秒かかり、**画面が止まって見えると利用者は壊れたと思って何度も押します**——同じ質問が 3 回投げられ、**請求も 3 倍**。**注意を 3 つ書いた**: **①費用は途中で止めても掛かる**(画面を閉じても**そこまでの生成分**は請求される)、**②記録は最後にまとめて残る**(途中で切れると**使用量が記録されない**——**予算の管理は送る前の見積もりに頼る**)、**③上限の判定は最初だけ**。**対応していない提供者でも同じ書き方で使える**ようにした(普通に呼んでまとめて返す)——**分岐が要ると、呼び出し側が提供者を知っていることになります**。**途中で切れても `done` を返す**——例外だけ投げると**呼び出し側は「終わったのか失敗したのか」分からないまま抜けます** |
| **道具（ツール呼び出し）の危険を資料に残した** | 実装だけあって注意が無いと、**削除や送金を道具にする人が出ます**——**AI の勘違いで実行され、取り返しがつきません**。`packages/ai/README.md` に**使い方と 3 つの注意**を書き、**してよいこと / 避けること**の表と**悪い例・よい例**も添えた(`deleteExpense` ではなく **`markForDeletion`(印を付けるだけ。実際には消さない)**)。ADR 0010 には**なぜ基盤が実行しないか**を残した——「AI が自動で実行できた方が便利」という声が出ても、**間違えたときに取り返しがつくか**で判断する。**便利さと引き換えに失うのは、間違いに気づく機会**。**3 つの注意が README に残っていることと、ADR に理由があることを smoke で固定**した——**資料は消えても検査は残ります** |
| **AI に道具（ツール呼び出し）を追加** | 「今月の経費の合計は？」に答えるには**AI が社内の数字を引く**必要がある。**実行するのは呼び出し側**にした——**基盤が勝手に実行することはありません**(削除や送金を勝手にされては困る)。**3 社で形が違う**: Anthropic は **`input_schema`(アンダースコア)**、OpenAI は **`type: "function"` で包み `parameters`**、応答も Anthropic は `content` に文字と混ざって入り、OpenAI は**引数が JSON の文字列**。**壊れた JSON が返ることがある**ので、**失敗しても空の引数にして落とさない**——**ここで例外にすると答えの全部が失われます**。**危険の注意を 3 つ書いた**: **①呼ぶかどうかは AI が決める**(渡しても使わないことがある。必ず引かせたいなら**先に自分で引いて文脈に入れる**)、**②引数は信用できない**(**存在しない ID や範囲外の日付**を渡してくる。`@platform/mcp` の `validateToolArguments` で検証)、**③危ないことをさせない**(削除・送金・メール送信を道具にすると**AI の勘違いで実行される**。**読み取りだけ**にするか**人の確認を挟む**) |
| **RAG の文脈が文字数制限で、日本語だとモデルの上限を超える** | `buildContext` は **`maxChars`(文字数)**で区切っていたが、**文字数とトークン数は比例しません**——日本語は 0.7 文字で 1 トークン、英語は 4 文字で 1 トークンで、**5 倍以上の開き**があります。**英語で調整した上限をそのまま日本語で使うと、モデルの上限を超えて呼び出しが丸ごと失敗**します——しかも**失敗するのは検索ではなく AI の呼び出し**なので原因が分かりにくい。`buildContextByTokens` を足した。**入り切らない文書は丸ごと落とします**——**途中で切ると「認められない」が「認められ」になり、逆の意味**になるため。**LINE**: `getQuotaConsumption`(**今月何通送ったか**)——`getMessageQuota` は上限しか返さず、**両方見ないと「あと何通送れるか」が分からない**。**月末に足りなくなると「請求の案内が送れない」**で業務が止まる。**MCP**: 中止の仕組み——ツールは**長く走ることがあり**、止める手段が無いと**終わるまで待つしかなく、その間も AI の課金は進みます**。**`done()` を `finally` で呼ばないと溜まり続ける**ことも明記 |
| **`check-tsdoc` がコメント内の `throw new` を拾っていた** | TSDoc の**使用例に書いた `throw new Error(...)`** を拾い、**「投げないのに `@throws` が不足」**と言われた。**説明のための例が書けなくなる**ので、**コメントを除いてから**見るよう直した。**このセッションで `check-tsdoc` の欠陥は 2 件目**(1 件目は「次の `export` までを本体とみなし、間の補助関数の `throw` を拾う」) |
| **MCP: `inputSchema` を宣言しても検証していなかった** | ツールが「この引数はこの型」と宣言しても、**そのまま `handler` に渡していた**——**引数を渡してくるのは AI** で、**違うものを渡してこない保証はありません**(数値のつもりが文字列、必須が欠けている、`null` が来る)。**検証せずに渡すと、その場で落ちるか、もっと悪いことに「それらしい間違った結果」を返します**——**金額に `"1000円"` が渡って `NaN` になり、0 円として登録される**のが最悪の形。`validateToolArguments` を足し、**渡す前に**確かめるようにした。**JSON Schema の全部は見ません**(`required` と `type` だけ)——完全な検証が要るなら **`handler` の中で `zod`**。ここは**明らかな取り違えを門前で弾く**もの。**`null` も「無い」と見なす**(AI は「値が無い」を `null` で渡す)、**`integer` は小数を弾く**(JSON に整数型が無いので自前で見る)ことも実装した |
| **AI に画像入力、RAG に多様性(MMR)を追加** | **①AI の画像入力**——LINE で受け取った領収書を**そのまま読ませられる**ようになった。**3 社で形が違う**(Anthropic は `source.base64`・**画像を先に置く**、OpenAI は `data:` 接頭辞付きの URL、Gemini は `inline_data`)ので共通化できず、変換を分けた。**注意を 3 つ書いた**: **画像はトークンを大量に使う**(1 枚で文章 1,000〜2,000 字分。**送る前に縮める**)、**読み間違える**(手書き・かすれ・斜めの写真は**平気で違う値を返す**——**金額は必ず人が確かめる**)、**個人情報が写り込む**(`@platform/pii` では**画像の中身は伏せられません**)。**②RAG の MMR**——検索は「質問に近い順」に返すので、**同じ文書の隣り合った部分が上位を埋めます**。就業規則を引くと**第 12 条の前半・中盤・後半が 1〜3 位**を占め、**別の条文にある大事な例外が押し出される**。**AI に渡せる文脈は限られる**ので、**同じことを 3 回渡すより違う観点を 3 つ**渡す方が良い答えになる。`lambda` は **0.5 を下回ると精度が落ちる**ことも明記。**検査の設計を 1 度誤った**——候補が全て同じ方向だと **relevance と maxSim が一致して MMR の効果が出ない**。**質問が両者の中間にある**例に直した |
| **LINE に受信・日時選択・カメラなど 9 機能を追加** | **今回は先に全機能を洗い出してから**着手した(4 回続けた見落としの反省)。**受け取り側が無かった**のが最大の穴——**`getContent`**(利用者が送ってきた画像を取り出す)が無く、「領収書を撮って送ってください」の**受け取りができなかった**。**保存できる期間は限られる**ので**受け取ったらすぐ自分の保管先へ写す**(「あとで取りに行く」は失敗する)、**中身は画像とは限らない**(利用者は何でも送れるので `sniffMimeType` で確かめる)、**送り先は `api-data.line.me`**。**日時選択**——文字で書かせると「来週の火曜」「3/5」「3月5日」が**ばらばらに届き、受け取る側で解釈が要る**。**範囲を必ず決める**(渡さないと**過去や 10 年後**も選べる)。**カメラとアルバムは別**——アルバムを開かせると**関係ない写真を選ぶ事故**が起きる。**動画はサムネイル必須**(**再生前が真っ黒**になる)、**音声は長さ必須**(**再生バーが出ない**)。**`issueLinkToken`**——**LINE の利用者と社内の利用者を結び付ける**もので、これが無いと「LINE で承認」は始まらない(**10 分で切れ、1 回しか使えない**) |
| **Microsoft に Teams 投稿と Entra ID(在籍確認)を追加** | **調べたら Outlook メール・予定表・空き時間検索・OneDrive は既に実装済み**だった(**私が「おすすめ」として挙げたものの大半が既にあった**——このセッションで**4 回目の見落とし**。`captureFrame` / Maps / 再試行 / Outlook 系)。**本当に無かったのは Teams と Entra ID**。**Teams**: Slack を使わない会社の通知先。**`html` で使える書式は限られる**(`<b>` `<a>` `<br>` 程度で、**凝った HTML はそのまま文字として出る**)、**チャネル ID は「一般」でも固定ではない**。**Entra ID**: **退職者のアカウントが社内システムに残る**問題を機械で防ぐ。**`accountEnabled eq true` で絞る**——絞らないと**退職者も返り、そのまま同期すると止めたはずのアカウントが復活します**。**`userPrincipalName` はメールと違うことがある**(改姓や転属で `mail` だけ変わる会社が実際にある)ので**両方で探す**。**「見つかった＝今も社員」ではない**ことも明記(`accountEnabled` を見る) |
| **Zoho に Mail / Meeting / Expense / Vault を追加(15 → 19 サービス)** | **Mail**: **`accountId` が要る**(メールアドレスではない。起動時に引いて控える)、**1 日の送信数に上限**(200〜1,000 通。大量配信は Campaigns へ)、**「送れなかった」を握りつぶすと「送ったつもり」になる**。**Meeting**: **`timeZone` を必ず渡す**——省略すると組織の既定が使われ、**9 時間ずれた会議**ができて**参加者は誰も来ない**。**`participants` を渡すと招待メールが飛ぶ**ので、試作時は空にする。**Expense**: **承認済みは消せない**(却下してから)、**外貨の換算は Zoho 側**(アプリで勝手に換算すると帳簿と合わない)、**領収書は multipart**(JSON では送れず、間違えると原因が分かりにくい)。**Vault**: **他の連携とは危険度が違う**ので冒頭に 3 つの禁止を書いた——**①ログに出さない**(`console.log` は伏せ字を通らない)、**②保存しない**(写すと Vault の意味が無くなる)、**③権限を最小にする**(書き込みを付けると事故で消せる)。**起動のたびに引くと Vault が落ちたときアプリも起動できない**ことも明記 |
| **LINE のリッチメニュー（画像アップロードと組み立て）** | API(作成・紐付け・既定設定・削除)はあったが、**画像アップロードと組み立てが無かった**。**①画像**——**画像が無いとリッチメニューは表示されません**。作成しただけでは何も起きず、**「設定したのに出ない」**という状態になる。**送り先は `api-data.line.me`**(他の API とは別のドメイン)で、**間違えると 404 になり原因が分かりにくい**。大きさ・形式・容量の決まりも TSDoc に書いた。**②組み立て**——定義は**座標を手で書く**必要があり、**1 つずらすと押せない領域**ができる。しかも**画面では気づけません**(見た目は正しく、押しても反応しないだけ)。**マス目で指定**して座標は計算に任せる形にした。**空きマスは領域を作らない**(作ると「押せるのに何も起きない」ボタンになり**壊れていると思われる**)、**最後の列・行は残り全部を使う**(割り切れないと**右端と下端に隙間**ができ、そこだけ押せない)、**`chatBarText` は 14 文字まで**(**送る前に止める**——送ってから弾かれると原因が分かりにくい)。**画像のボタン位置とマス目がずれると、「見えているボタンと違う動きをする」**という最も分かりにくい不具合になることも明記した |
| **Slack と LINE によく使う機能を追加** | **各連携の実態を確認**したところ、`zoho`(17 サービス)・`freee`(1,202 行)・`google`(694 行)・`microsoft`(616 行)は**既に充実**していた。薄かった **Slack と LINE** を拡充した。**Slack**: **ファイル送信**(帳票・請求書の共有)——**Slack のファイル送信は 3 段階**で、**③まで通って初めて成功**(途中で止まると**送ったつもりなのに誰にも見えない**)。**スレッドに付けないと関係ない場所に単独で出て、何の資料か分からなくなる**ことも書いた。**リアクション**(「見ました」の静かな合図——返信は通知が飛ぶ)、**その人にだけ見える投稿**(「あなたの経費 3 件が差し戻されています」を全員に見せる必要はない。ただし**記録に残らないので監査には使わない**)。**LINE**: **承認カード**——**出先の人は PC を開けません**。「承認待ちが溜まって業務が止まる」のは**承認者が席にいないだけ**のことが多く、**スマホで押せれば数秒**。**押した人は `postback` のデータで決めない**(利用者側で作れるので `userId=admin` と偽れる。**署名で確認した `userId`** を使う)、**金額を必ず出す**(「承認しますか」だけだと**何をいくら承認したか分からないまま押される**)、**`wrap: true` を必ず付ける**(**長い用途が切れて読めない**) |
| **Gemini プロバイダと録音を追加** | **①Gemini**——OpenAI / Anthropic はあったが Gemini が無かった。**他の 2 つと形が違う**ので、そこを間違えると動かない: **`system` の役割が無い**(先頭の `system` を `systemInstruction` へ移す。**`user` にすると利用者の発言として扱われ、指示が効きません**)、**`assistant` ではなく `model`**、**鍵はヘッダではなく URL のクエリ**(**アクセスログに鍵が残る**ので、中継サーバを通すなら注意)。**安全フィルタで応答が空になる**ことも明記した。**②録音**(`createAudioRecorder`)——カメラは撮影まであったが**音声が無かった**。「現場のメモ・議事録の下書き」に使う。**必ず止めること**を強く書いた——**止めないとマイクが開いたままになり、タブに録音中の印が出続けて「盗聴されている」と感じさせます**。**二重に始めない**守りも入れた(押し間違いで 2 つ動くと**片方が止まらない**)。**形式はブラウザごとに違う**ので、**返ってきた `Blob` の `type` を見る**ことも書いた。**`captureFrame` は既にあった**——追加しようとして重複させ、削除した |
| **「アプリ開発中は基盤を編集しない」を規約にした** | **基盤は他のアプリも使っています。** アプリの都合で直すと、**気づかないうちに他のアプリを壊し**、**壊れたことはそのアプリを次に触った人が知る**ことになる。`CLAUDE.md` の**最優先**として置き、`apps/README.md` にも書いた(触ってよいのは**自分のアプリ・showcase・crud-template** だけ)。**不具合や要望は基盤リポジトリへ Issue**——テンプレート `platform-request.yml` を用意し、**「何をしようとしたか」「どこで止まったか」「回避しているか」「基盤のバージョン」**を必ず書かせる(**回避できているかで急ぎ度が変わる**)。**急ぎで待てないときは自分のアプリの中に回避を書く**ことも認めた(基盤を直すより安全)——ただし**印を必ず付ける**(`// 基盤の <関数名> が <できないこと> なので回避。Issue: <URL>`)。**印が無いと、次の人は「なぜ自前実装なのか」が分かりません**。入口 3 つに書いてあることを smoke で固定した |
| **AI: 一時的な失敗ですぐ諦めていた** | 混雑(429)や一時的な不調(503)で**すぐ別のプロバイダへ移る**状態だった——**数秒待てば通る**ことが多く、**得意なモデルを諦める**ことになる。`withAiRetry` を足し、**待ち時間を延ばしながら 2 回まで**試すようにした。**ばらつき(jitter)を必ず入れる**——入れないと**混雑で失敗した全員が同じ秒数で再開し、また一斉に混みます**。**入力が不正(400)や認証エラー(401)は繰り返さない**(**請求が増えるだけ**)。**`@platform/core` の `isRetryable` は使わなかった**——あちらは `AppError` の分類で判断するが、**AI プロバイダが投げるのは生の `Error`**(SDK や fetch の失敗)。`net` への依存も**増やさなかった**——**smoke が `ai` を 8 箇所から読んで**おり、依存が増えると差し替えも 8 箇所要る |
| **AI: 1 回で予算を使い切る入力を止められなかった** | 上限は**実績の累計**で見ていたので、**残り 100 トークンでも 10 万トークンの入力を送れて**しまい、止まるのは**次の呼び出しから**——**その 1 回分の請求は防げません**。`estimateTokens` / `estimateMessagesTokens` を足し、**送る前に見積もって断る**ようにした。**累計との合算では見ません**——「あと少しで上限」のときに**普通の質問まで断る**と使えなくなるので、**1 回だけで予算を超える入力**に限って止めます。見積もりは**日本語 0.7 文字 / 英数字 4 文字で 1 トークン**の目安で、**多めに出す**(少なく見ると上限を超えて送ってしまう)。実測で**日本語は英語の約 5 倍**——「短い文章だから安い」とは限らない。**既存の検査を壊しかけた**——最初は累計と合算する形にしたが、`maxTotalTokens: 200` で 2 回呼ぶ既存検査が落ちた。**既にあった事前チェックを見落として**いた |
| **RAG のハイブリッド検索で、ベクトル検索が事実上効いていなかった** | BM25 とベクトルを混ぜる際、**「id ごとに高い方のスコア」**を採っていた。だが **BM25 は 0〜数十、コサイン類似度は -1〜1** と**尺度が違う**ので、**常に BM25 が勝ち**、ベクトル検索の結果がほぼ捨てられていた。**RRF(Reciprocal Rank Fusion)**に置き換え——**点数を捨てて順位だけ**を使うので尺度の違いが消え、**両方の検索に出たものが上に来る**(「語も一致し、意味も近い」ものが最も確からしい)。実測: BM25 で 1 位・ベクトルで 2 位の A が、それぞれ 1 位だけの C・B より上に来る。`k=60` の理由(**上位の差を緩める**。小さいと片方の 1 位がほぼ確定する)も書いた。**smoke の復旧に手間取った**——`rag/src/index.ts` を **6 箇所から読んで**おり、新ファイルを足すと各所で実体の用意が要る。**`rerank.ts` に同居させて解決**した。**「fuse.ts を含む行を全部消す」処理で、書き出しの行まで消した**のが遠回りの原因——**一括削除は、消したい対象だけを含む行に限ること** |
| **本番の出し方が 3 アプリで決まっていなかった / 残債の推移が知られていなかった** | **①本番構成**——`Dockerfile` は `internal-app` だけで、**`public-site` / `showcase` / `line-console` の出し方が決まっていない**(とくに **line-console は LINE の Webhook を受けるなら公開が必要**)。`DEPLOY_AWS.md` に**どのアプリをどこに出すか**の表を書き、**出すと決めたら `fonts-noto-cjk` と `TZ=Asia/Tokyo` を必ず入れる**ことも明記した(**どちらも本番のコンテナで初めて分かる**)。**②README**——冒頭が薄い 3 件(`attendance` / `barcode` / `xml`)を充実。**冒頭 1 行が `module-list` に出る**ので、薄いと探せない。**③契約テスト**——8 件とも**定義は健全**(必須項目・実装先ともあり、**実装で使われていない必須項目も 0 件**)。**④残債の推移**——`pnpm debt` で**前回からの増減が見られる**のに `COMMANDS.md` に載っておらず、**誰も知らない**状態だった。使い方と**「減ったら上限も下げる」**を書いた |
| **環境変数 10 件が `.env.example` に無かった** | **コードは読んでいるのに、設定例に載っていない**——`ZOHO_*`(6 件)・`ROLE_MAP`・`DEFAULT_ROLES`・`SESSION_TTL_SEC`・`ALLOWED_EMAIL_DOMAINS`。**引き継いだ人は「何を設定すればよいか」に気づけません**。起動はしても、**その機能だけが黙って動かない**状態になります(Zoho 連携が動かない、ロールが割り当たらない、など)。説明付きで追加し(**`ZOHO_DC` を間違えると 401 になる**、**リフレッシュトークンは 1 度しか表示されない**、**`ALLOWED_EMAIL_DOMAINS` が空だと全部許す**)、**コードで読むものが `.env.example` にあることを smoke で固定**した。あわせて**「判定はあるが呼ばれていない」を基盤全体で探した**——**検証系 181 件のうちアプリ未使用は 4 件**で、3 件は UI 内部用、1 件は `blueprint`(開発ツール)。**会計の `isBalanced` が唯一の例外**だった。

**検査を全アプリに広げた**——`internal-app` だけを見ていると、**新しく作ったアプリの漏れに気づけない**。実際に `line-console` から 1 行消して落ちることを確認した。他 4 アプリは健全(`public-site` は**環境変数を使わない**ので `.env.example` が実質空でも正しい) |
| **E2E に「請求」と「契約」が無い(書かずに記録した)** | **⑤E2E の点検**——**10 ファイル・35 テスト**で、主要な業務(`business-flow` 8 / `expense-flow` 5)・認証(`internal-auth` 6 / `register` 4)・キーボード操作(4)は覆っている。**覆っていないのは「請求書の発行」と「契約の更新」**——**請求は金額が動く**のに E2E が無く、**契約は解約通知の期限を過ぎると自動更新**される。**書きませんでした**——`pnpm e2e` は**ブラウザが要る**ので、**動かせない環境で書くと「通っているつもりのテスト」が増える**。**赤いまま放置されると、他のテストも信用されなくなります**。代わりに `TESTING_GUIDE.md` に**いま覆っている範囲と、足すならどこからか**を書いた。**`check-e2e-quality` は健全**(Flaky になりにくい書き方を 10 ファイルで確認) |
| **showcase に 4 件のリンク切れ(押しても何も起きない見本)** | **④showcase(91 画面)の点検**——`/session` `/hid` `/tax` へのリンクがあるのに**画面が無かった**。**見本が壊れていると、誤った使い方が広まります**——「この機能はこう繋ぐ」と示すのが役割なのに、**辿れない**。正しい遷移先へ直した(`/tax` → `/invoice`、`/session` → `/security`、`/hid` → `/device`)。**画面へのリンクが実在することを smoke で固定**した。他は健全——**未実装の印(TODO / coming soon)は 0 件**、`page.tsx` が薄い 23 件は**中身が `*-client.tsx` にある**形、統合で消えた `equipment-app` も**「実物は internal-app の /equipment」と明記済み** |
| **日本語検索の「誤ヒット」を説明していなかった** | **③検索の点検**——bigram(2 文字ずつ)方式なので、**語の途中で一致しても当たります**。実測: 「東京都」は `東京` `京都` に分かれ、**「京都」で検索すると「東京都」が出る**。「社員」で「会社員」も同じ。**誤りではなくこの方式の性質**だが、**利用者から「なぜこれが出るのか」と聞かれたときに説明できない**状態だった——具体例を TSDoc に書いた。**困るほど誤ヒットが増えたら DB の全文検索へ移す**ことも書いた(**ここを賢くしようとすると、辞書の更新という新しい仕事が増えます**)。空文字・記号は `[]` を返し例外にならない。**RAG は健全**——引用元を示す仕組みが 14 箇所、ハッシュ Embedder が開発用であることと pgvector への移行も記載済み |
| **給与: 等級表の下限割れで最上位が当たる / 乙欄が未対応** | **①`payroll`(1,623 行)の点検**——**①`findGrade`** が「該当が無ければ最上位」としており、**上限超えだけでなく下限割れでも最上位**を返していた。**給与が低い人に最上位の等級が当たり、保険料が何倍にもなります**。既定の表は `from: 0` から始まるので今は起きないが、**表は引数で差し替えられる**ので `from` が 0 でない表を渡すと踏む——**下限割れは最下位**を返すよう分けた。**②源泉徴収は甲欄だけ**で、**乙欄(他社が主たる給与の人)に対応していない**。副業の人や扶養控除等申告書を出していない人は税額が変わり、**甲欄で計算すると源泉徴収が不足**する。**該当者が出たら税額表の乙欄を足す**ことを冒頭に明記した。**賞与の上限は健全**——健康保険 573 万円は**年度(4 月〜翌 3 月)の累計**、厚生年金 150 万円は月単位、どちらも実装済み |
| **`isBalanced`(貸借一致の判定)がアプリから一度も呼ばれていなかった** | **②会計の点検**——基盤に判定はあるのに、**`ledger.ts` は import しているだけで呼んでいなかった**。**一致しない仕訳を保存すると、試算表が合わなくなり、どこで崩れたか分からなくなります**。**仕訳を作る 6 関数(`salesJournal` / `purchaseJournal` / `receiptJournal` / `paymentJournal` / `expenseJournal` / `payrollJournal`)すべてで自己検証**する形にした——**作った時点で止めれば、原因は直前の 1 か所**に絞れる。**`Result` ではなく例外**にした——`ok` を見ずに保存する経路が生まれると、**帳簿が「たぶん合っている」**状態になるため。なお **smoke には既に「貸借が一致するか」の検査があった**(私が足したのは重複だったので削除)——**作る側の自己検証**が新しい価値 |
| **画面の `fetch` に `catch` が無く、通信断が未処理だった** | **③アプリ側のエラー処理の点検**——**画面が直接 `fetch` するのは 3 つだけ**(残りはサーバ側で取る)で、そのうち **chat の 1 件に `catch` が無かった**。`if (!res.ok)` は **HTTP のエラーしか見ていない**——**ネットワークが切れると `fetch` は例外を投げ**、未処理のまま「押しても何も起きない」画面になる。ピン留めは**画面の主役ではない**(メッセージ一覧は別に読む)ので失敗しても画面は壊さないが、**黙って消さず `console.error` で記録**する形にした——「ピンが出ない」と言われたときに追えるように。**`fetch` を使う画面には `catch` がある**ことを smoke で固定した |
| **承認フローの滞留日数が「暦日」だと書いていなかった** | **①`workflow`(899 行)の点検**——`evaluateSla` が**暦日で数える**(営業日ではない)ことを TSDoc に書いていなかった。**金曜の夕方に申請されると、月曜の朝には「3 日滞留」**になるが、**実際に承認できたのは 1 営業日**。上限を決めるときは**土日を含む前提**で決める必要がある(営業日 2 日のつもりなら 4 日に設定)。**祝日は会社ごとに違う**のでここには持たせず、呼び出し側で調整する方針も書いた。他は健全——**二重承認は防ぐ**(`status !== "pending"` で `err` を返し、呼び出し側 2 ファイルとも `ok` を見ている)、**自己委任も防ぐ**(`from !== to`。**委任元に自分の名前を入れるだけで昇格できてしまう**)、代理の期限判定も正しい。**②`attendance`**——**日跨ぎ(夜勤)は考慮済み**(退勤が出勤より前なら翌日とみなす)、深夜時間は **`attendance` が計算し `payroll` が受け取る**形で**重複ではない** |
| **構成を変えたのに入門資料と ADR が追随していなかった** | **④入門資料**: `01-setup.md`(環境構築)に**新しい構成の説明が無かった**——`apps/` が git 管理外であること、`pnpm new-app` で機能を選べること、**検査はアプリにも効く**こと。「このリポジトリの形（先に知っておくこと）」を冒頭に足した。出力例の**「packages: 103」も古かった**(実際 119)。**⑤ADR**: **0002(基盤とアプリの分離)**に現況を追記——**git を分けるところまで進めた**理由と、**`templates/` へ移す案を却下した理由**(workspace から外れると雛形が壊れても気づけない)、**変えるとしたらいつか**(アプリ単独で CI が回らないのが耐えられなくなったとき→ ADR 0011 の再検討)。**0015(パッケージ統合の方針)**は「108 個まで育った」が当時の記録なので、**その後 119 個**と追記(方針は変えず、**多いから減らすのではなく探せるかで判断**)。**0019(JST)は TZ 設定を記載済み**で健全 |
| **grep の正規表現で誤判定し、重複を足しかけた** | `CHECKS.md` に載っていない検査を探すのに `grep -oE "check-[a-z-]+"` を使ったが、**`check-a11y` は数字を含むため `check-a` で切れて**「載っていない」と誤判定した。**元から載っていたのに 2 行に重複**させてしまい、気づいて削除した。**逆方向の検査(`check-preflight-coverage`)は正しく効いていた**——実際に 1 行消して落ちることを確かめた。本当に不足していたのは **`check-win-setup` の 1 件**だけで、これは追加した(`check-schema` と合わせて **CI から直接呼ばれる**ので preflight の対象外——正しい形)。**手で探す前に、既にある検査を信じること**——`check-preflight-coverage` が緑なら、載っていない検査は無い |
| **「smoke が緑 = 全部通った」という誤解を防いだ** | smoke が呼ぶ検査は **72 種類のうち 16 件**だけで、**残り 56 件は `pnpm check`(preflight)でしか走らない**。2026-08 に**smoke が 2,323 件緑なのに `pnpm check` で 3 件落ちて**いた(`@platform/guard` の未宣言など)——**引き継いだ人が「smoke が通ったから大丈夫」と思う**危険がある。smoke の最後に**「72 検査のうち 16 件です。`pnpm check` も回してください」**と出すようにし、**この件数が実態と合っていることも smoke で固定**した(数が変わったのに注記が古いと、**同じ誤解を生みます**) |
| **`pnpm check` を全検査で走らせて 3 件の欠陥** | 72 検査を 1 つずつ回して確かめた。**①`@platform/guard` が 2 アプリで未宣言**(`crud-template` / `line-console`)——**import しているのに `package.json` に無い**状態で、**`next build` で落ちる**(隠れ依存は解決方式が変わると一斉に落ちる)。**②`check-lockfile` が依存未インストールで赤くなる**——**`pnpm install` の前に `pnpm check` を走らせるのは引き継いだ人がまずやること**で、ここで赤いと「壊れている」と誤解する。**skip(`⏭`)に変えた**——CI では必ず lockfile がある。**③`check-server-localtime` が 26 件**(上限 25)——`business-metrics.ts` の `now.getFullYear()` で、**固定資産税の申告年度**を取るもの。**JST で取るのが正しい**(コンテナに `TZ=Asia/Tokyo` を設定済み)ので上限を上げ、理由を書いた |
| **smoke の依存差し替えに `@platform/utils` が抜けていた(6 箇所)** | `audit-log.ts` と `search-index.ts` が `@platform/utils` を使うようになったのに、**smoke の差し替えに足し忘れて**いた。**`ERR_MODULE_NOT_FOUND` で smoke が丸ごと落ちる**状態。原因の特定に時間がかかった理由を残す: **①同じファイルを 6 箇所から読んでいた**(`pf-al` / `wz-al` / `ad-al` / `e-al` など**一時ファイルのプレフィックスが違う**)——1 箇所直しても次で落ちる。**②エラーが `imported from /tmp/xx-yy-...` の形**なので、**どの smoke の行か分からない**——プレフィックスで grep して探した。**③`utils/index.ts` を指すと今度は `@platform/core` で落ちる**——定義元の `numbers.ts` を直接指して解決。**④括弧の位置を間違えて `.replace` が入れ子**になり、**構文は通るのに効かない**状態を作った。**「差し替えを足す」は 1 箇所では済まない**——`grep -c` で全箇所を数えてから直すこと。

**次に同じことが起きたとき、すぐ分かるようにした**——`impFile` が読み込み前に中身を見て、**`@platform/*` が残っていたら「どの一時ファイルに何が残っているか」と「足すべき `.replace` の形」を出す**。既定のエラーは `imported from /tmp/xx-yy-...` としか言わず、**どの smoke の行が作ったか分からない**。作る過程で**誤検出を 2 回**踏んだ: **①コメント内の `// import ... from "@platform/x"`** を拾った、**②`import type`** を拾った(**実行時に消えるので解決は要らない**)。**検出を足すときは、まず誤検出を潰す**——直しようのない指摘は無視されるようになる |
| **計算系(税・給与・勤怠)を境界値の観点で点検——健全** | **欠陥は見つからなかった**が、確かめた内容を残す。**税の丸めは負の金額で対称**(`applyRounding` が「0 に近づける / 0 から遠ざける」で揃えている)——**`Math.floor(-2.5)` は -3、`Math.ceil(-2.5)` は -2** で「切り捨て」「切り上げ」の意味が符号で入れ替わるため。**返品・値引き・赤伝で金額は負になる**ので、ここを間違えると**1 円ずれる**。**給与の `Math.round` は対称でない**が、**残業手当は負にならない**ので実害なし。**社会保険料の折半**は端数のテストが 6 件、smoke でも 7 件検査。**勤怠の深夜・日跨ぎ**も実装・検査ともにある。**「見つからなかった」も記録する価値がある**——次に見る人が**同じ場所を二度調べずに済みます** |
| **検査自体の点検が一巡(欠陥 4 件・健全 3 件)** | 「**緑だったのに何かを見ていなかった**」を 4 件見つけて直した: **①`check-tsdoc` の切り出しが粗い**(次の `export` までを本体とみなし、**間の補助関数の `throw` を拾う**)、**②`check-returns-mismatch` が 600 文字で切れる**(**1,814 関数のうち 449 件・25% が対象外**)、**③`check-handmade-chart` が 200 文字で切れる**(4 件見逃し)、**④smoke のアプリ名直書き 3 件**(**新しく作ったアプリが検査されない**)。**健全だったもの**も記録する: **`tools/check-*.mjs` のアプリ名直書きは `showcase` の意図的な除外 1 件のみ**(`apps/` を走査するので新しいアプリは自動で対象)、**パッケージ側は検査ツールが走査**、**`saga` の補償失敗は握りつぶさず `compensationErrors` に集める**。**検査を増やすだけでなく、検査が効いているかを確かめる仕組み**(`verify-checks` / `check-scan-reporting`)が 4 件のうち 2 件を見つけた |
| **smoke にアプリ名の直書きが 3 件——新しいアプリが検査されない** | **`pnpm new-app` で作ったアプリが対象外**になり、**共通の tsconfig を継承していなくても、`global-error` が無くても気づけない**状態だった。`apps/` を走査する形に直した(**Prisma を使うかは `prisma/schema.prisma` の有無で判定**)。**引き継いだ人がアプリを足すことが前提**なので、これは実害が出る種類——**検査があるのに新しいものだけ素通り**する。**`tools/check-*.mjs` 側は健全**だった(アプリ名の直書きは `showcase` の意図的な除外 1 件のみ)——**`apps/` を走査しているので、新しいアプリは自動で対象**になる |
| **正規表現の「小さい上限」で見逃していた検査がもう 1 件** | `check-returns-mismatch`(600 文字)に続き、**`check-handmade-chart` が 200 文字で切れて 4 件を見逃して**いた（最長 502 文字——**長い `d` 属性を持つ `<path>`** が対象外）。1,200 に広げた。**残る 5 件の小さい上限も調べた**——`check-auth-stub`(120/300/400)と `check-ports`(200)は**見つからなければ落ちる**形なので、切れても**見逃しにはならず、うるさくなるだけ**。`check-file-input-disabled`(400)は実測で **17 件すべて 400 以内**(最長 324)。**「1,000 未満の上限には理由を書く」ことを smoke で固定**した——**小さい上限は「たまたま今は足りている」だけ**で、**増えたときに黙って見逃します** |
| **`check-returns-mismatch` が 449 関数(25%)を見ていなかった** | 関数の本体を正規表現で取る際、**600 文字の上限**があり、**長い関数は途中で切れて検査されなかった**——1,814 の export 関数のうち **449 件(25%)が対象外**。最長は 6,069 文字なので、**8,000 に広げた**。すると**本物の食い違いが 1 件**見つかった——`resolveRedirect` は「**該当が無ければ undefined**」と書いてあるが**実際は `null` を返す**。**`=== undefined` で確かめると常に false になり、素通りします**。同時に**誤検出も 1 件**出た(`tunnelConfigFromEnv`)——広げたことで**内部の即時関数や `catch` の中の `return`** まで拾うようになった。**トップレベル(インデント 2 スペース)の `return` だけ**を見るよう直した。**上限を緩めると、隠れていた欠陥と一緒に誤検出も出てきます**——両方を確かめるまで終わりません |
| **`check-tsdoc` が「後ろの補助関数の `throw`」を拾っていた** | TSDoc を埋める中で、**`toHankakuKana` が「`@throws` が不足」と言われた**が、**実際は投げない**。原因は**関数の切り出しが粗い**こと——「次の `export` まで」を本体とみなすので、**間にある非 export の補助関数の `throw` が混ざる**(`toHankakuKana` の後ろに補助関数が 2 つあり、片方が投げていた)。**次のトップレベル関数でも切る**ように直した。**今回書いた `@throws` も 2 件が誤り**だった——`parseCsv` は「**`strict: true` のときだけ**投げる」(既定では読めたところまで返す)、`createLocalStorage` は「フォルダを作れない場合」ではなく「**保存先の外を指す key**(`../` や絶対パス)」。**実装を読まずに書くと、説明が嘘になる**——`@throws` は**呼ぶ側が `try/catch` を書くかの判断**に使うので、間違うと**捕まえ忘れて画面が落ちます** |
| **TSDoc の残債を 0 件にした(120 パッケージすべて完備)** | セッション開始時 181 件 → **0 件**。最後に埋めた要点: **`createBeacon`**「**`sendBeacon` を使うので画面を閉じても届く**——普通の `fetch` だと**離脱の記録が一番欲しいときに消える**」「**個人情報を送らない**(画面の URL に ID が入ることがある)」。**`createStripeClient`**「**`fetch` を差し替えられない**(SDK が内部で通信する)ので**契約テストが効かず**、確認は sandbox キーでの実接続に頼る」「**秘密鍵が漏れると誰でも返金や請求ができる**」。**`emptyCart`**「**毎回新しい配列を返す**——使い回すと**ある人のかごに別の人の商品が入る**」。**説明は「何をするか」より「何を間違えやすいか」**を書いた——前者は名前から分かるが、後者は**踏むまで分からない** |
| **TSDoc を 94% → 95% に(残債 5 件)** | `crypto` / `csv` / `storage` / `google` を埋めた。要点: **`deriveKey`**「**salt は秘密ではない**が、**利用者ごとに違うもの**にする——同じだと 1 つ破られたら全部破られる」「**共有の既定 salt は廃止した**(ADR 0004)——『とりあえず動く』ために同じ salt を使うと**意味が失われる**」。**`parseCsv`**「引用符が閉じていないときは**途中まで読んで返さない**——**欠けたまま取り込むより止まる方が安全**」。**`createLocalStorage`**「保存先を作れないときは落とす——**書き込めないまま動くと、保存したつもりで消える**」。残る 5 件は `stripe`(未実戦)・`analytics`・`net`・`seo` など |
| **TSDoc を 92% → 94% に(残債 9 件)** | **`session` / `security` / `slack` / `microsoft` / `os-notify`** を埋めた。要点: **`createAuthSession`**「**パスワードログインも SSO も同じ形**で扱う——分けると画面ごとに『どちらを見るか』の判断が要り、**必ずどこかで漏れる**」。**`serializeCookie`**「**自分でエスケープしない**（ここで行う）」。**`createRevocationGate`**「失効ストアに問い合わせられないときは**通してはいけないので落とす**」。**`createMemoryReplayStore`**「**短すぎると同じ要求を 2 回通す**」。**`createSlackClient`**「**Webhook の URL は秘密**——漏れると誰でもその部屋に投稿できる」「**何でも通知すると通知を見なくなる**」。**`createOsNotifier`**「**開いた直後に許可を求めると多くの人が拒否する**——必要になった場面で求める」。残る 9 件は `stripe`(未実戦)など**使用頻度の低いもの** |
| **`fsm`(承認フローの土台)と `sequence`(採番)の TSDoc を埋めた** | **`run`** に「**許した遷移しか起きない**——定義に無い出来事は無視され、『**差し戻し済みなのに承認された**』といった状態を防ぐ」「**途中で止まってもそこまでの状態が返る**」を書いた。**`can`** には**使い方の注意**を添えた——「**ボタンの出し分けに使う**(押しても何も起きないボタンは利用者を迷わせる)」が、「**これだけで守らない**。画面で隠しても **API を直接叩かれれば通る**——`run` が定義に無い遷移を無視するので、**そちらが本当の守り**」。`sequence` には「**桁が足りないと請求書番号が重複する**」を書いた。TSDoc は **88% → 92%**(残債 16 件)。残るは `stripe`(未実戦)・`os-notify`・`microsoft`・`slack` など**使用頻度の低いもの** |
| **全アプリで使う 3 パッケージの TSDoc が 67% だった** | `ratelimit` / `upload` / `guard` は**どのアプリでも使う**のに説明が薄かった。**要点を書いた**: **`createRateLimiter`** は「**鍵の決め方が要**——IP だけで数えると**同じ会社の全員が 1 人分**になる（社内からは同じ IP に見える）」「**メモリ実装は 1 プロセス内でしか効かない**——2 台構成なら**上限が実質 2 倍**」。**`handleUpload`** は「**元のファイル名を保管先の名前にしない**（推測して他人のファイルを取られないため）」「**種別が違っても EXIF が残っていても保存する**——拒むと正しいファイルまで通らなくなる」。**`requireSession` / `enforceRateLimit`** は「**戻り値を見なくても止まる**（`if` を書き忘れても素通りしない）——これが `currentUser()` との違い」。TSDoc の全体は **82% → 88%**（残債 18 件） |
| **`zengin`(全銀・振込)の TSDoc が 29% だった** | **お金が動く**のに説明が薄かった。**5 件の不足を埋めた**——とくに 2 つが重要: **`toShiftJisBytes`**(「**銀行のシステムは Shift_JIS しか受け取らない**。UTF-8 で渡すと**カタカナが化けて振込先が読めなくなる**」「改行は **CRLF**。LF だけだと**銀行側で 1 行として読まれる**」)、**`buildZenginTransfer`**(「**件数と合計金額はトレーラに入る**ので渡したレコードと必ず一致する——手で数えて入れると**1 件ずれただけで銀行に弾かれる**」「**金額は 1 円単位の整数**。小数を渡すと桁がずれる」)。TSDoc の全体は **78% → 82%**(残債 19 件)。実装側の他の点検は健全——**TODO は 2 件**、**エラー画面は全 5 アプリに揃い**(`error` / `not-found` / `global-error`)、**エラー内容は画面に出さずコンソールのみ**、**アクセシビリティの静的検査は 618 ファイルで違反 0** |
| **本番デプロイが未実施だと「終わっていないこと」に書いていなかった** | `DEPLOY_AWS.md` には「**初回チェック(未検証ゆえ必ず)**」と書いてあったが、**引き継いだ人が見るのは「終わっていないこと」**——そこに無いと**気づけない**。**5 件目**として足し、**先に確認しておくとよいこと**も表にした(日本語フォント / `TZ` / `SESSION_SECRET` / `PUBLIC_SITE_URL`)。**この 4 つは検査で守っている**が、**その他は本番で初めて分かる**。「**最初の 1 回は必ず詰まる。詰まったところをその場で手順書に足す**」ことも書いた——**次の人が同じところで止まる**ため。ADR 0009 にも現況を追記(**決定は変えない**——小さく始めて必要になったら移す判断は、利用者 100 人規模・開発者数人の規模に合っている) |
| **走査量を報告しない検査が 3 件——「何も見ていないのに緑」だった** | **`pnpm check`(preflight)を最後まで走らせたのは今回が初めて**で、3 件の失敗が出た。うち **`check-scan-reporting` の指摘が重大**——「**`check-returns-mismatch` が対象を 1 件も見ていない**」。実際には見ていたが**走査量を報告していなかった**ので、**本当に見たかを確かめられない**状態だった。**報告が無いと、対象が 0 件でも緑になる**。3 件に走査量を足した(`check-returns-mismatch` **894 ファイル** / `check-unguarded-json-parse` **2,173 ファイル** / `check-file-input-disabled` **423 ファイル**)。あわせて **preflight の失敗時の案内**も直した——「上の出力を確認」だけでは**出力が長くて追えない**ので、**落ちた検査の名前をまとめて出し**、`CHECKS.md` へ誘導する。`app-features.mjs`(675 行)は**分割しない判断**——26 機能の定義が同じ形で並ぶだけで、**分けても探しやすくならない**(`utils/numbers.ts` と同じ理由)。上限を 9 に上げ、理由を TSDoc に書いた。**ウィザードの検証で作ったアプリの後始末が不完全**で、`package.json` に `dev:test-wiz2` など 3 件が残っていた |
| **`pnpm check` を最後まで走らせて 3 件の失敗を見つけた** | **preflight を最後まで走らせたのは今回が初めて**だった(いつも smoke だけを見ていた)。**①`check-scan-reporting` が「`check-returns-mismatch` は対象を 1 件も見ていない」と指摘**——実際は見ていたが、**走査量を報告していなかった**ので「本当に見たか」を確かめられなかった。**報告が無いと、対象が 0 件でも緑になる**。3 件に走査量を足した(`check-returns-mismatch` は **894 ファイル**、`check-unguarded-json-parse` は **2,173**、`check-file-input-disabled` は **423**)。**②`package.json` にウィザード検証の残骸**(`dev:test-wiz2` など 3 件)が残り `check-doc-commands` が落ちていた——**アプリを消してもルートのスクリプトは消えない**。**③`app-features.mjs`(675 行)が「大きいファイル」に**——**分割しない判断**をした(26 機能の定義が同じ形で並ぶだけで、分けても探しやすくならない。`utils/numbers.ts` と同じ理由)。あわせて **preflight の失敗時に落ちた検査名をまとめて出す**ようにした——「上の出力を確認」だけでは**出力が長くて追えない** |
| **「落とさない検査」は忘れられる(`doctor` に組み込んだ)** | `check-placeholders`(引き継ぎ時に書き換えるもの)は**落とさない検査**なので、**`verify-checks` で検証できず未分類 1 件**になっていた——理由を登録した(**サンプル値は開発中なら正しい**ので、CI で止めると引き継ぎ前の作業が進まない)。だが**落とさない = 忘れられる**。`onboarding/README.md` に「最初に実行」と書いたが、**引き継いだ人が読んで覚えている保証は無い**。**`pnpm doctor` に組み込んだ**——環境が動かないときに**必ず叩くコマンド**なので、**ここに出しておけば目に入る**。`docs/ops/` の残り 3 件(`ACCESS_CONTROL` / `AUDIT_REVIEW` / `SUPPORT_GUIDE`)も確認したが、**古いアプリ名も古い数値も無く健全**だった |
| **`node --check` は TypeScript の構文検査に使えない(検査を作って外した)** | 生成コードの構文を見張ろうとして `node --experimental-strip-types --check` を使ったが、**両方向に不正確**だった: **①`import` を含む `.ts` は素通り**する(**壊れたコードが 0 で返る**——`ttlMinutes: ,` でも通った)、**②`import` を除くと型注釈で落ちる**(`req: Request` が構文エラー扱い)。**検査を入れて「通った」のを見て安心しかけた**——実際は**何も見ていなかった**。**外して理由を smoke のコメントに残した**。代わりに **`app-features.mjs` 自身が壊れれば smoke が落ちる**(生成コードは**テンプレート文字列の中**なので `` ` `` を書くとファイルごと壊れる)ことと、`check-imports` で守る。**入れるなら TypeScript のパーサが要る**。**「検査が通った」は「検査が効いている」ではない**——`describe` の取り違えと同じ形で、**実際に壊して確かめる**まで分からなかった |
| **26 機能を全部入れて作り、2 件の欠陥を見つけた** | **全機能を選んだアプリ**(依存 59 個)を作って検査を回した。**①`session.ts` が `process.env` を直読み**していた——`env.ts` を通さないと**起動時に型と必須を検査できず、無いまま動いて後で落ちる**。`serverEnv` 経由に直した。**②直した際にバッククォートでテンプレート文字列を閉じてしまい**、生成コードが構文エラーになった——**smoke が `seo` セクションで落ちて**気づけた(生成物のコードは**テンプレート文字列の中**なので、`` ` `` を書くと壊れる)。**依存 59・環境変数の重複なし・層破りなし**で、他は健全だった。**全部入りで試すのは有効**——1 つずつ試すと 26 回かかるが、まとめて入れれば**組み合わせの問題も一度に見つかる** |
| **`new-app` の選択肢を 7 → 26 に拡張(8 分類)** | メール・PDF 以外も選べるようにした——**業務ドメイン**(請求書・会計・勤怠・在庫・契約)、**コミュニケーション**(チャット・掲示板・CMS)、**検索・AI**(全文検索・AI・RAG)、**仕組み**(承認フロー・定期実行・段階公開・多言語)、**外部連携**(Zoho・LINE・freee)など。**UI・テーマ・DB・認可・監査ログは既定のまま**——**選ぶまでもなく全アプリで要る**もの(17 個)。**26 個を並べると探せない**ので**分類ごとに表示**したが、**番号がずれる罠**があった——`FEATURES` の並び順で番号を振ると、**同じ分類が飛び飛びのときに画面の番号と中身がずれる**。**表示した順**を別の配列に覚えて選ぶようにした。各機能の README には**その機能で踏みやすい落とし穴**を書いた(「`applyMovement` は `ok` を見ないと出庫できていないのに成功したことになる」「解約通知の期限を過ぎると望まない 1 年が自動更新される」「`flagName` を省略すると、いつも同じ人が実験台になる」) |
| **雛形の README が古い手順(`cp -r`)を案内していた** | **`pnpm new-app` があるのに `cp -r apps/crud-template apps/my-app` を案内**しており、**`package.json` の `name` を直し忘れて別のアプリと衝突**する恐れがあった(`new-app` はポートの採番・依存の書き換え・ルートへの登録をまとめてやる)。**別の git を切る**手順も無かった。**「次に足すもの」もウィザードと整合させた**——7 つの機能を表にし、**それぞれで踏みやすい落とし穴**を添えた(「メールは Outbox 経由にしないと『送ったか分からない』」「PDF は Dockerfile に日本語フォントを入れないと豆腐」)。**監査ログは最初から入っている**ことも明記——**後から足すと過去が追えない**ため。**雛形の欠陥は、これから作る全アプリに伝わる**ので、README も smoke で固定した |
| **雛形で作ったアプリが、基盤の検査に落ちる状態だった** | ウィザードで作ったアプリに対して**全検査を回して 2 件見つけた**。**①SSO の callback に認可が無い**——`check-api-auth` が落ちる。だが**ログイン前に呼ばれるので認可は通せない**のが正しく、**`// public-api: 理由` の宣言**を足した(`state` の検証で守る、と理由も書いた)。**②雛形に見た目の直書きが 6 件**(`error.tsx` / `not-found.tsx` の `fontSize: 40` など)——**アプリを作るたびに上限を超える**状態だった。`internal-app` は `rem` の文字列で書いており引っかからないので、雛形も揃えた(**421 件**に減り、上限も下げた)。**雛形の欠陥は、これから作る全アプリに伝わる**——`crud-template` だけは特に丁寧に見る必要がある |
| **`pnpm new-app` に機能を選ぶウィザードを足した** | 雛形は**最小構成**(DB + 認可 + 一覧画面)で、ログインや通知は自分で繋ぐ必要があった。**7 つの機能**(ログイン / SSO / Zoho / メール / アップロード / PDF / 通知)を選べるようにし、**依存・環境変数・雛形のコード・README の説明**がまとめて入るようにした。**機能ごとにアプリを丸ごと用意する案は却下**——**雛形が 10 個に増えて全部を最新に保てなくなる**(片方だけ直って食い違う)。`tools/app-features.mjs` に**差分だけ**を持ち、**機能を増やすときは配列に 1 つ足すだけ**。**対話は端末でしか動かない**ので `--features=login,upload` でも指定できるようにした——**手順書や CI で再現できない**ため。**依存が実在すること・id が重複していないことを smoke で固定**した(実在しないと作った直後に `pnpm install` が落ちる)。README には**その機能で踏みやすい落とし穴**も書いた(PDF なら「Dockerfile に日本語フォントを入れないと豆腐になる」、アップロードなら「写真の EXIF に撮影場所が残る」)。

**作ったアプリを実際に動かして欠陥を 1 つ見つけた**——**`.env.example` には足したが `env.ts`(読み込み側)に足していなかった**ので、**`serverEnv.SESSION_SECRET` が `undefined`** になっていた。**型は通る**ので、**実行して初めて分かる**種類。機能定義に `envSchema`(zod の行)を持たせ、**`z.object({` の直後に挿し込む**ようにした。**`.env.example` と `env.ts` が揃っていることを smoke で固定**——片方だけ足すのは**必ず起きる**ので |
| **構成を変えたのに、入口の資料が古いままだった** | `apps/` を git 管理外にしたのに、**`CLAUDE.md` の 1 行目**が「**アプリ(apps)を分離したモノレポ**」のままで、**読んだ人は apps も基盤の git にあると思う**。`docs/onboarding/03-development.md`(開発の始め方)も同様で、**「基盤 103 個」という古い数値**(実際は 119)も残っていた。両方を書き換え、**なぜ外すか**(基盤はアプリを保証できない・試し書きを置ける)と**検査は届く**(72 種類のうち 50 が `apps/` を見る)ことを明記した。**入口 3 つ**(`CLAUDE.md` / `apps/README.md` / `03-development.md`)**が説明していることを smoke で固定**した——**構成を変えたら入口も変える**、を強制する |
| **アプリを別リポジトリにすると検査が回らなくなる問題** | `apps/` を基盤の git から外したので、**基盤の CI ではアプリを検査しなくなる**——`pnpm check` の**72 種類のうち 50 がアプリを見る**のに、誰も回さない状態になる。**雛形(`crud-template`)にアプリ側の CI を入れた**ので、`pnpm new-app` で作ると最初から検査が回る。**基盤を clone してから、その中にアプリを置く**形にした——`@platform/*` を **`workspace:*`** で参照しているので、**アプリのリポジトリだけでは依存が解決できない**(npm へ公開しないのは意図的。ADR 0011)。**週 1 回も回す**ようにした——**基盤を直した人はアプリを知らない**ので、**壊れたことに気づけるのはアプリ側**。雛形に CI が入っていることを smoke で固定した |
| **`apps/` を基盤の git から外した(アプリは各自で管理)** | **基盤 = `packages/` + `tools/` + `docs/`** とし、アプリは各自が `apps/` に作って**その中で別の git を切る**形にした。**基盤はアプリを保証できない**——アプリを直すたびに基盤側を直すのは責任の境界が曖昧で、**試し書きやゴミも置けない**。**`templates/` へ移す案は却下**した——**workspace から外れると `@platform/*` の依存が解決されず、雛形が壊れていても気づけない**(今は 120 パッケージ + 5 アプリすべてが検査対象)。`.gitignore` で `apps/*` を無視しつつ、**`!apps/crud-template/`(new-app のコピー元)と `!apps/showcase/`(16 のツールが前提)は残す**。`apps/README.md` に置き方を書き、**「git で管理していなくても `pnpm check` は効く」**(72 種類のうち 50 が `apps/` を見る)ことと、**アプリ側の CI では基盤も clone する必要がある**ことを明記した。**実際に git init して無視の挙動を確認**した |
| **アプリ固有の資料を各アプリへ移した(基盤はアプリを保証しない)** | 旧 docs/platform/appmap/<app>.md と 旧 erd/<app>.md を **`apps/<app>/docs/`** へ移した。**基盤はアプリを保証できない**——アプリを直したら基盤側の資料も直す、という状態は**責任の境界が曖昧**で、**アプリを別リポジトリにするときに資料が置き去りになる**。生成ツール 2 本の出力先、`gen-ref-site` の収集、`check-generated` の登録、参照 8 ファイルを更新した。**一括置換で 3 ファイルのコードを壊した**——旧 docs/platform/appmap を機械的に置き換えたため、`gen-erd` の説明文・`check-generated` の登録・**`gen-ref-site` の ADR 収集**(`readFileSync(path.join(dir, file))` を `readFileSync(file)` にしてしまい実行時エラー)が壊れた。**検査が落ちて全部気づけた**。CRLF の正規化も指摘され、**`\r\n?` ではなく `\r\n` と書く**必要があった(検査が書き方まで揃えている) |
| **上限方式の検査で、減らしたときに上限を下げ忘れる穴があった** | `check-style-literals`(427) / `check-order-by`(15) / `check-delete-confirm`(9)は**上限ぴったり**で、1 件増えたら落ちる正しい状態だった。だが**減らしたときに上限を下げないと、また増やせてしまう**——「**9 件まで許す**」が「**9 件まで戻してよい**」になる。**上限と現在値が一致していることを smoke で固定**し、**上限を 15 → 20 に緩めて落ちることを確認**した。これで**直したら上限も下げる**ことが強制される。あわせて**検査の対象範囲**も点検したが健全——`check-api-auth` などが `apps` のみなのは**`packages` に API ルートが 0 件**だから、`showcase` の除外は **`CHECKS.md` に基準が明文化済み**(72 検査中 14 が言及) |
| **E2E だけ PostgreSQL 16 で、開発・本番は 17 だった** | **本番と違う DB で通っても意味が薄い**——**17 で動かない SQL が 16 で通る**ことがあり、**E2E が緑でも本番で落ちる**。17 に揃え、**3 箇所(開発・本番・E2E)が揃っていることを smoke で固定**した。あわせて **pnpm のバージョン**も確認したが健全——`packageManager` に `pnpm@9.15.0` があり、`pnpm/action-setup@v4` が**それを読む**(CI にバージョンを書かなくてよい)。**「複数箇所で揃えるべきもの」は Node・PostgreSQL・pnpm の 3 つ**で、うち 2 つに問題があった。

**Node の検査も広げた**——`ci.yml` だけを見ており、**他の 9 本のワークフローがずれても気づけなかった**(実際は 14 箇所すべて 22 だった)。**全ワークフローを見る**形にし、**1 本だけ 20 にして落ちることを確認**した。**1 箇所にしか書かない仕組みが最善**(pnpm の `packageManager` がそれ)だが、GitHub Actions では**各ワークフローに書くしかない**——**検査で揃えることを保証する**しかない |
| **Node のバージョン指定が緩く、3 箇所で食い違いうる状態だった** | `package.json` の `engines` が **`>=20.9.0`** だったが、`Dockerfile` と CI は **22**。**`--experimental-strip-types` を使っている**ので**Node 20 では動かない**——引き継いだ人が Node 20 で開発すると、**手元では `pnpm smoke` が動かず、原因が分からない**(`engines` は警告を出すだけで止めない)。**`>=22.6.0`** に揃えた。**3 箇所が揃っていることを smoke で固定**した——バージョンを上げるときに**1 箇所だけ直して食い違う**のを防ぐ |
| **依存更新が二重に設定されていた(Renovate と Dependabot)** | `renovate.json` と `.github/dependabot.yml` の**両方が npm を見て**おり、**同じ依存に 2 つの PR が来る**状態だった——**引き継いだ人が「なぜ 2 つ来るのか」と混乱する**。**Dependabot に寄せた**——**GitHub 標準でアプリの導入が要らず**(Renovate は導入が必要)、**docker も見られる**。Renovate の方が設定は柔軟だが、**数人で引き継ぐなら「設定なしで動く」方が確実**。`renovate.json` を削除し、**理由を `dependabot.yml` の冒頭に書いた**(消したものの理由は、残った側に書かないと辿れない)。**二重に戻らないよう smoke で固定**した。ESLint は健全——**`off` にしている 2 件に理由が書いてある** |
| **型検査の厳しさを緩められないよう固定した** | `noUncheckedIndexedAccess` は `arr[0]` を `T \| undefined` にするので**書くときが面倒**——**外したくなる**設定。**空配列に `[0]` でアクセスして `undefined.x` で落ちる**のを防いでおり、**面倒なのは書くときだけで、落ちるのは利用者の前**。`strict` / `noImplicitOverride` と合わせて smoke で固定した。**理由を `tsconfig.base.json` に書こうとして失敗**——`advisor` など**3 つのツールが `JSON.parse` で読む**ので、**コメントを入れると壊れる**(実際に壊れた)。`CLAUDE.md` に「緩めてはいけない設定」として書き、**なぜ tsconfig に書けないか**も添えた |
| **時刻の基準が層ごとに違うことを、どこにも書いていなかった** | `TZ` を足した流れで整理した——**DB は UTC / アプリのコンテナは JST / 画面は JST** で、**混ぜると 9 時間ずれる**。`docker-compose` に `TZ` を書いていないのは**わざと**(DB は UTC で保存し、表示で変換するのが定石)だが、**書いていないと「書き忘れ」に見える**。`docs/DATABASE.md` に**層ごとの表**と気をつけることをまとめた。**生 SQL で `NOW()` を使わない**ことも smoke で固定(現在 0 件)——**混ぜると「アプリでは今日、DB では昨日」**という状態が生まれる。Prisma の `DateTime` は**タイムゾーンなしの列**になるが、Prisma が UTC で読み書きするので一貫していれば問題ない——**他のツールから見るときは UTC だと意識する**必要がある。`HEALTHCHECK` は Dockerfile に無いが、**`docker-compose` 側にある**ので健全 |
| **コンテナの時刻が UTC のままだった** | Dockerfile に **`TZ` が無く**、本番のコンテナは **UTC で動く**。日付の表示は `formatDateJst` を通しているので画面は正しく出るが、**サーバ側でローカル時刻を使う箇所**(`check-server-localtime` が上限 25 件で管理)が **9 時間ずれる**——「今日の分」を数える処理が、**JST の 09:00 で日付が変わる**ことになる。**開発機は JST なので気づけない**——フォントと同じで**本番でしか分からない**種類。**`TZ=Asia/Tokyo` と `tzdata` の両方**を足した(**`tzdata` を入れないと `TZ` を指定しても効かない**)。smoke で**両方あること**を固定した——片方だけでは効かないため |
| **帳票の日本語フォントを検査で固定した(現状は健全)** | PDF は **Playwright(ブラウザ描画)**で作るので、**コンテナに日本語フォントが無いと豆腐(□□□)**になる。`internal-app` の Dockerfile には `fonts-noto-cjk` が入っており健全だったが、**検査が無かった**——**開発機には日本語フォントがある**ので、**本番のコンテナで初めて分かる**。**請求書が全部□で出てから気づくのは遅い**。「**`@platform/pdf` を使うアプリの Dockerfile に日本語フォントがあること**」を smoke で固定し、**実際にフォント指定を消して落ちることを確認**した。`check-server-fonts`(HTML 側のフォント指定)は既にあり、**これで描画の両側**(HTML の指定・コンテナの実体)が守られた |
| **関数名で引けない記録があった(検索のコツを追加)** | 348 項目は**検索して使う**前提だが、**`evaluateFlag` で引くと 0 件**だった——「フラグ」では引けるが、**引き継いだ人は関数名で探す**。348 項目すべてに関数名を補うのは大変なので、**検索のコツ**を目次と `CLAUDE.md` に書いた——**「なぜそうしたか」を書いているので、関数名より現象が主語のことがある**。例に挙げた語(`二重` 43 件 / `並び順` 5 件 / `丸め` 9 件 / `NaN` 4 件 / `前日` 10 件 / `失効` 11 件 / `冪等` 11 件 / `Outbox` 12 件)が**実際に引けることを smoke で固定**した——**例で 0 件だと「使えない」と思われる**。引き継いだ人は**1 度試して駄目なら諦める** |
| **「終わっていないこと」に 2 件が載っていなかった** | **セッションの失効**(ロールを外しても最大 8 時間権限が続く)と**メモリ実装**(台数を増やすと壊れる)は、「危ないところ」の**728 行の中に埋もれて**いた——引き継いだ人が「**今すぐやるべきこと**」を見たときに出てこない。**3 → 5 件**に増やして具体的に書いた。失効には**暫定の緩和策**(最終出社日の終業後に権限を外せば翌朝には失効)も添えた。メモリ実装には「**1 台のままなら、これは終わっていないことではない**」と明記——**Redis を用意する方が手間**。あわせて「意図的に残していること」の**「デモでしか使われていないパッケージ 38」が実際は 11** だったのを直した。**この数は検査していない**——`showcase` も `apps/` にあるため「デモだけが使う」を機械的に分けられず、**無理に検査を作ると誤検出する**(実測 0 になった)。`pnpm gen:all` の出力で確認する形にした |
| **「最初の 1 週間」の数値が古く、やらなくてよいことも書いていなかった** | 「**88 デモ**」が実際は **91**——`demos/` は showcase に統合されて実測 0 になっており、**この数値は検査から漏れていた**。`showcasePages` を実測に足して固定した。あわせて**「やらなくてよいこと」**を書いた——**この資料を頭から読む**(916 行。検索して使う)・**120 パッケージを把握する**(`pnpm advisor find` で足りる)・**92 画面を全部開く**(一覧は `appmap/` にある)。**1 週間で「どこに何があるか」が分かれば十分**で、中身は触るときに検索すればよい。**引き継いだ直後に `check-placeholders` を実行する**ことも明記した——**`CODEOWNERS` が書き換わっていないとレビューが誰にも回らない**が、**エラーにならないので気づけない** |
| **916 行の HANDOVER に目次が無く、探せなかった** | 引き継ぎで**一番大事な資料**なのに、**頭から読むしかない**形だった——「危ないところ」だけで **728 行・348 項目**ある。**目次と検索の案内**を冒頭に置いた(`grep -n "<関数名>" docs/ops/HANDOVER.md`)。あわせて **`CLAUDE.md` の冒頭にも「直す前に必ず読む」**を足した——AI が最初に読む資料なのに、**HANDOVER の言及が 1 件しかなかった**。**目次のリンクが実在することを smoke で固定**した——**GitHub のアンカー規則**(記号を落とし、空白 1 つを `-` 1 つに)を再現する必要があり、`Redis / DB` → `redis--db`(`/` が消えて空白が 2 つ残る)で 2 回間違えた |
| **生成物 17 件のうち 6 件が辿れなかった(索引を置いて解消)** | `internal-app` の `appmap` に導線を足した後、**他 4 アプリ分と `erd` の 2 件**が残っていた。1 件ずつ README に並べると増えるので、**各ディレクトリに索引(`README.md`)を置いた**——`appmap/README.md` と `erd/README.md`。**生成物すべてに導線があることを smoke で固定**した。**副作用が 2 件**出た: `README.md` を**アプリ名と誤認**する検査があった(「消えたアプリの残骸」と `gen-ref-site` の収集)——**ディレクトリ名 = アプリ名という前提**が入っていたため。両方に除外を足した。**索引を置くだけでも、前提を持つ検査に影響する**——`sh` のブレース展開と同じで、**動かして初めて分かる**種類 |
| **321 件の画面・API 一覧が、どこからも辿れなかった** | 引き継いだ人が「**どこから手を付けるか**」を知るには、**画面と API の一覧**が要る。`apps/internal-app/docs/appmap.md`(**自動生成・321 件**)と `erd/`(DB の図)があるのに、**README からも onboarding からも導線が無かった**。**`check-docs-orphans` は生成物を対象外にしている**ので、**有用な一覧が埋もれていた**——孤立検査が守れない範囲があると分かった。導線を足し、**README に `appmap` と `erd` へのリンクがあることを smoke で固定**した。なお `doctor` は健全——**要対応 3 件・警告 7 件すべてに直し方が書いてある**(`pnpm db generate all` / `cp .env.example .env` など)ので、受け取った人は迷わない |
| **引き継ぎ前提と分かったので、受け取る側の入口を整えた** | 「利用者 100 人規模に対して機能が多すぎるのでは」という問いに対し、**開発は数人で引き継いでいく**と分かった。**書く時間より読む時間が長い**なら、検査 72 種類・HANDOVER・ADR・TSDoc への投資は**回収できる**。ただし **Redis 移行と負荷試験は 1 台構成では過剰**で、これは記録として残すに留める。**受け取る側でつまずくもの**を整えた: `CODEOWNERS` に **`@your-org` `@yamada` というプレースホルダ**が残っており、**書き換えないとレビューが誰にも回らない**。`.env.example` の `example.com` も同じ(**本番で使うとメールが届かない**)。**エラーにならず、必要なときに動かない**——引き継ぎで一番困る種類。`check-placeholders`(72 本目)を新設し、`onboarding/README.md` に**「引き継いだ人が最初にやること」**を足した。**この検査は落としません**——サンプル値は開発中なら正しく、CI で落ちると引き継ぎ前の作業が止まるため |
| **`findStaleAssets` を繋いだ(払わなくてよい税を止める)** | 前回「型変換が要る」として保留したが、**違いは名前だけ**だった——アプリの `FixedAsset` は `cost`、基盤の `TaxableAsset` は `acquisitionCost`。他の項目(`name` / `acquiredOn` / `usefulLifeYears` / `disposedOn`)はそのまま対応した。**繋ぐ側で変換**して `business.stale_assets` として数えるようにした。**廃棄した資産を申告し続けると、払わなくてよい固定資産税を払い続ける**——金額の実害が出る。**年 1 回だけ見るもの**なので、手順書に「**固定資産税の申告前に**」「**毎日見ても意味がなく、申告の手順に組み込むのが確実**」と明記した。業務メトリクスは **7 つ**になった |
| **業務メトリクスを 3 → 6 に拡充(承認の滞留・契約の期限)** | **承認の滞留**(`business.pending_approvals` / `oldest_pending_approval_days`)を足した——**システムは正常でも、ここが詰まると業務が止まる**。申請者は「まだ承認されない」、承認者は「急ぎではない」と思ったまま。**件数より日数**が効く(1 件が 1 ヶ月放置されている方が重い)。**契約の期限**(`business.contract_alerts`)も足した——`contractAlerts` は**更新期限と解約通知期限の両方**を見る。**解約通知の期限を過ぎると、望まない 1 年が自動更新される**——**気づいたときには手遅れ**で、金額の実害が出る。**全ゲージが手順書に載っていることを smoke で固定**した(アラートと同じ形)。**判定する関数は基盤にあった**ので、繋ぐだけで済んだ |
| **`docs/ops/` を 24 → 20 件に(主題が近いものだけ寄せた)** | 小さい資料 4 件のうち **3 件**を統合した——`CONTRACT_TESTING`(98 行)→ `TESTING_GUIDE`、`ADD_DEMO`(90 行)→ `NEW_APP`、`CI_FIRST_RUN`(79 行)→ `GITHUB_ACTIONS`。いずれも**探す人が同じ**(テストの話・アプリを作る話・CI の話)。**寄せなかったもの**も記録する: **移行系 3 件**(`UI_MIGRATION` / `UPSTREAM_IMPORT` / `RAG_PGVECTOR_MIGRATION`)は「移行」という共通点はあるが**主題が別**(UI の置き換え・外部からの取り込み・RAG の移行)——まとめると**探しにくくなる**。**ガイド系 4 件**も同じ理由で残した。資料は **77 → 74 件**、`ops` は 20 件で**探せる範囲**に収まった |
| **ルート直下を 6 → 3 件に(最大 4,043 行の資料を移動)** | ルートに**入口でないもの**が混ざっていた。**`PLATFORM_SERVICES.md`(4,043 行)は「開発の経過記録」**で、**167 節が時系列に並ぶ作業ログ**だった——設計の手引きではない。`docs/HISTORY.md` へ移し、冒頭を書き直した(**「これは何を作ったかの記録で、手引きではありません」**、**`equipment-app` は存在しません**、最新は `module-list` / `HANDOVER` / `adr` を見る)。**役に立つのは「この機能はいつ・なぜ入ったのか」を遡るとき**だけ。`README_APPLY`(ZIP の適用)と `SETUP_TAILWIND`(スタイルが当たらないとき)も**セットアップの補助**なので `docs/onboarding/` へ。**ルートは `README` / `CLAUDE.md` / `CONTRIBUTING.md` の 3 つだけ**になった——**最初に開くもの以外は置かない**。資料は 76 → 77 件(`VERIFY` の移動で 1 件増、ルートから 3 件移動) |
| **依存図で見えたものを整理(`VERIFY` の移動・「困ったとき」の索引)** | 作った依存図で**相互参照 22 組**を確認したところ、大半は「**入口 ↔ 詳細**」で自然だった。手を入れたのは 2 つ——**①`VERIFY.md`**(検証の手順)は**新しい人が使うもの**なので `docs/onboarding/05-verify.md` へ移した。**「preflight が見ている 32 個」という古い数値**も直した(実際は 71 種類)。**②「困ったとき」が 3 件に分散**していた(`INCIDENT_RESPONSE` / `SUPPORT_GUIDE` / `RUNBOOK`)——**役割は違うが探す人は同じ**なので、README の索引を**困りごとの種類ごと**に書き分けた(本番が落ちた / 利用者から問い合わせ / オンコールの当番 / 画面が動かない)。**ガイド系 4 件**(`CURSOR` / `DEVTOOLS` / `SUPPORT` / `GIT`)は**主題が違う**ので統合しない判断 |
| **README を 1 ファイルに戻し、資料の参照関係を図にした** | 前回**分割した 2 件**(`PACKAGES.md` / `DOCS_POLICY.md`)を README に戻した——**入口が分かれていると、どこまで読めばよいか分からない**。367 行になったが、**1 ファイルなら検索で辿れる**。あわせて **`gen-docs-graph.mjs`(新設)**で参照関係を図にした——**76 件がどう繋がっているかは、開いてリンクを辿らないと分からなかった**。分かること: **終点**(`ops/COMMANDS` が最多で 11 件から参照される)・**入口**・**相互参照 22 組**(「概要 ↔ 詳細」なら自然だが、**役割が曖昧**な可能性もある)。**参照はリンクだけでなくバッククォート内のパスも数える**——この基盤では「詳しくは docs/ops/〈ファイル名〉 へ」という書き方が多く、**リンクにしていなくても参照は参照**。資料は **78 → 76 件** |
| **資料を 91 → 86 件に集約(内容は減らさず)** | **入門資料が 6 件 1,246 行に散っており、どれから読めばよいか分からなかった**(`FIRST_HOUR` / `GETTING_STARTED` / `GETTING_STARTED_2` / `SETUP` / `ONBOARDING_TASK` / `CI_FIRST_RUN`)。**`docs/onboarding/` に番号順で 4 件**に束ね、入口の README を置いた(環境構築 → 最初の 1 時間 → 開発 → 課題)。**`GETTING_STARTED` と `SETUP` は統合**(どちらも環境構築で、片方だけ読むと足りなかった)。**`ops` と `platform` の境界が曖昧**だったので、同じ主題の 3 組も寄せた——テスト(`platform/TESTING` → `ops/TESTING_GUIDE`)、デプロイ(`platform/DEPLOYMENT` → `ops/DEPLOY_AWS`)、パッケージ整理(2 件を 1 件に)。**重複の数え方も直した**——**見出しの重複 60 件を数えなくした**(「Windows」「環境変数」が複数の資料に出るのは**当然**で、数えると**丁寧に書くほど違反が増える**)。**危ないのは本文の重複**(片方だけ更新されて食い違う)で、そちらは 10 件。**`sh` ではブレース展開(`rm {a,b}.md`)が効かず**、削除したつもりのファイルが**計 5 件**残っていた——孤立検査が見つけた。**1 つずつ `rm` を書くこと**。

**さらに `docs/platform/` の小さい 4 件も寄せた**——`OBSERVABILITY`(11 行)→ `INCIDENT_RESPONSE`、`SCAFFOLD`(27 行)→ `PACKAGE_CONSOLIDATION`、`INTEGRATIONS`(39 行)→ `CATALOG`、`PRISMA_EXAMPLES`(43 行)→ `DATABASE`。**11 行の資料は開いても何も分からない**——関連する手順の中にあれば読まれる。**最終的に 91 → 78 件**(`ops` 24 / `platform` 6 / `onboarding` 5 / `adr` 22 / `ai` 7)|
| **手書きと生成物を 2 回取り違えた(見分けが付かなかった)** | **①`APPS_AND_DEMOS.md`** を生成物だと思い、数値がずれたので `gen-all` を走らせたが**直らなかった**——手書きだった。**②`patterns.md`** は本文中の「自動生成」(テーマの話)を**自称と誤読**した。**生成物は `docs/ai/` の 3 件だけ**(`module-list` / `smoke-index` は `gen-all`、`advisor-report` は `pnpm advisor`)で、README に「5 件は自動生成」と書いたのも誤りだった。**生成物の先頭に「手で編集しない」と書いてあることを smoke で固定**し(**本文中の別の意味と区別するため先頭 5 行だけ見る**)、`APPS_AND_DEMOS.md` には**「この資料は手書きです」**と明記した。**見分けが付かないと、直らない操作を繰り返す**。

**印は `docs/ai/` だけに絞った**——手書きの資料は 83 件あるが、**大半は明らかに手書き**(手順書・ADR)で、全部に印を付けると冗長になる。**紛らわしいのは生成物と同居しているもの**なので、`docs/ai/` の 7 件(生成物 3・手書き 4)にすべて印を付け、**smoke で固定**した |
| **業務の滞りを測る仕組みを作った(`business-health`)** | メトリクスが**すべてシステムの指標**で、**システムが正常なまま業務が止まる**ことに気づけなかった。**毎朝 9 時**(始業時刻)に 3 つを数えるジョブを足した: **期限を過ぎたタスク**(誰も手を付けていない / 終わったのに閉じていない)、**支払期日を過ぎた未入金**(督促の前に気づきたい)、**30 日以内に更新期限が来る契約**(自動更新なら**気づかないまま 1 年延びる**)。**アラートは出さずゲージに載せる**——「承認待ちが 3 件」は正常で、**1 件で鳴らすと無視される**。**普段 3 件が 30 件になったら異常**という見方をする。**測る処理が落ちても業務は止めない**——数えられなかった項目は 0 のままで先へ進む(**測るための処理が、測られる対象を止めては本末転倒**)。**毎分ではなく 1 日 1 回**にしたのは、全件を読むため |
| **業務の異常を測る仕組みを作った(`business-metrics`)** | メトリクス 9 種類がすべて**システムの指標**だったので、**業務の異常**を測るものを足した——`business.overdue_invoices`(期限切れの請求書)・`business.overdue_tasks`・**`business.oldest_overdue_days`(一番古い滞留の日数)**。**件数より日数を見る**のが要点で、**10 件が 1 日遅れているのと、1 件が 3 ヶ月放置されているのは、件数では同じに見えて意味が違う**。**カウンタでなくゲージ**にした(増え続ける値ではなく、その時点の数)。**アラートは設定しない**——承認待ちは常に何件かあるのが正常で、**閾値は運用が決めるもの**。実際の数を 1 ヶ月ほど見てから `system-alerts` に条件を足すよう `INCIDENT_RESPONSE.md` に書いた。**cron から 1 日 1 回**呼ぶ(`POST /api/admin/business-metrics/scan`)——分単位で変わるものではない |
| **業務の異常を測るメトリクスが無い / `findStaleAssets` が未使用** | メトリクスは **9 種類**あるがすべて**システムの指標**(HTTP・cron・Outbox・アップロード)で、**業務の異常**(承認の滞留・期限切れ・在庫のマイナス)を測るものが無い——**システムは正常だが業務が止まっている**状態に気づけない。判定する関数は基盤にあり、`task` の `isOverdue` は `summarizeTasks` 経由で**間接的に使われて**いた(私の検出が浅く、一度「未使用」と誤判定した)。**`findStaleAssets`(償却資産の外し忘れ)だけが本当に未使用**——**廃棄した資産を申告し続けると、払わなくてよい固定資産税を払い続ける**。繋ぐには `internal-app` の `Asset` 型から `TaxableAsset` への変換が要るので、**理由を TSDoc に書いて残した**。あわせて**「画面に出すより申告前のチェックリストに入れる方が確実」**とも書いた——**毎日見る画面に出しても、年 1 回の作業では思い出さない** |
| **アップロードした画像に位置情報が残っていた** | 画像を**変換せずそのまま保存**しているので、**EXIF(撮影日時・機種・GPS)が残る**——**領収書をスマホで撮ってアップロードすると、どこで撮ったかが残る**。社内アプリでも、持ち出されたら分かってしまう。**消すには画像処理が要る**(`@platform/image` は `sharp` を使うが、`upload` に足すと**ネイティブモジュールの依存が増える**)ので、**依存ゼロで気づけるようにした**——`bytes` の `hasJpegExif` が **APP1 マーカー**を探し、`upload` が `hasExif` を返し、API が `log.warn` を出す。**限界も明記**——「EXIF の領域があるか」しか見ず、**GPS が入っているかまでは見ない**(中身を読むには EXIF の解析が要る)。**消すなら `@platform/image` で変換する**、と誘導している。

**アラートは出さず、メトリクスだけに載せた**——**スマホの写真はほぼ全部 EXIF 付き**なので、1 件で鳴らすと**鳴り続けて無視される**。`outbox_exhausted`(1 件でも鳴らす)とは別の扱い。**基準を `INCIDENT_RESPONSE.md` に明記した**——**「これが 1 件出たら誰かが動くか」**で分ける。動かないならメトリクスに留める(**鳴り続けるアラートは、本当に鳴るべきときにも無視される**)。**メトリクスに載せておけば増えたときに気づける**——`upload.exif_present` が急に増えたら**変換の仕組みを入れる合図**。種別の食い違い(`upload.type_mismatch`)は**滅多に起きない**ので、増えたら調べる価値がある |
| **ファイルの中身を見分ける機能を `bytes` に追加** | `Content-Type` は**送る側が名乗るだけ**で詐称でき、`.pdf` という名前の実行ファイルを「PDF です」と言って送れる。**実行は `attachment` + `nosniff` で防げている**ので、これは**「PDF のつもりで開いたら壊れている」を早く気づく**ためのもの。`sniffMimeType`(PDF / PNG / JPEG / GIF / WebP / ZIP)と `matchesDeclaredType` を足した。**限界を明記した**——**①先頭しか見ない**(中身が壊れていないことは保証しない)、**②xlsx / docx / pptx はすべて `application/zip` に見える**(中を開くまで区別できないので `allowZipBased` で許す)。**知らない形式は通す**判断にした——テキスト・CSV・音声などを弾くと、**正しいファイルまで拒む**ことになる。

**実際のアップロードに繋いだ**——`handleUpload` が `typeMatches` を返し、`internal-app` の API が**食い違ったら `log.warn`** を出す。**保存は通す**(実行は `attachment` + `nosniff` で防げており、拒むと正しいファイルまで通らなくなる)が、**「PDF のつもりで開いたら壊れている」を後から追える**。**基盤にログの仕組みを足さなかった**のは、依存が増えるため——**情報を返し、呼び出し側が扱う**形にした |
| **`@platform/bytes` 新設(base64・hex・バイナリ)** | **12 パッケージ・17 ファイル**が base64 を自前で扱っており、**やり方がばらばら**だった: `Buffer.from(x).toString("base64")` は**Node 専用でブラウザで落ちる**、`btoa(x)` は**日本語で例外**(`btoa("経費")` → `Invalid character`)、`btoa(unescape(encodeURIComponent(x)))` は動くが **`unescape` は非推奨**。**どこで動かしても同じ結果**になるよう一本化した。設計で気をつけた点: **①`String.fromCharCode(...bytes)` を使わない**(引数が多すぎると**数 MB で `RangeError`** になる。1 文字ずつ足す方が遅いが確実)、**②壊れた入力の扱いを 2 通りにした**——`decodeBase64`(文字列)は `undefined`、`base64ToBytes`(バイナリ)は**例外**(バイナリで握りつぶすと**復元できないファイルを保存する**)、**③`bytesToText` は例外を投げず置換文字**(途中で切れた添付で**画面ごと落ちるより読めない文字**の方がよい)、**④`timingSafeEqualBytes`**(普通の比較は違いが見つかった時点で止まるので、**応答時間から「何文字目まで合っていたか」が漏れる**)。**smoke の書き方も学んだ**——`section(..., async () => {})` は**中身が実行される前に次へ進む**(`section` は同期前提)。既存は `{ ... }` ブロックでトップレベル `await` を使っており、そちらに合わせた。

**既存の自前実装 3 箇所を寄せた**——`google/gmail`(`Buffer` と `btoa(unescape(...))` を自前で切り替えていた 3 関数)、`security/headers`(**`String.fromCharCode(...bytes)` は 16 バイトなら動くが、同じ形が大きな入力に複製されると `RangeError`**)、`paypal`(**設定を間違えて日本語が混ざると `Invalid character` で落ちる**——原因が分かりにくい)。**`btoa` の直接使用は基盤から無くなった**。

**`Buffer` の直接使用は残す判断**をした——`crypto`(7 箇所)・`push`(14 箇所)・`webauthn`(5 箇所)などは**サーバ側だけで動く**ので、Node の実装で確実。無理に寄せると読みにくくなる。**署名の比較も同じ**——Node の `crypto.timingSafeEqual`(**14 箇所**)は C 実装で確実なので、サーバ側はそのまま。`bytes` の `timingSafeEqualBytes` は**ブラウザでも動く**版で、**Node のものは長さが違うと例外を投げる**のに対しこちらは `false` を返す——使い分けを TSDoc に書いた。あわせて `CATALOG.md`(選び方の指針)に**データ形式で迷ったら**の表を追加(`json` / `xml` / `csv` / `html` / `bytes`) |
| **率に「比率」と「パーセント」の 2 つの流儀があった(取り違えると 100 倍)** | `formatPercent(0.1)` は**比率**(0〜1)、`taxAmount(x, 10)` は**パーセント**(10 = 10%)——**同じ「率」でも扱いが違う**。取り違えると **100 倍ずれる**が、`formatPercent` の説明は「既定は比率」とだけで、**取り違えたときに何が起きるか**が書かれていなかった。両方の流儀を表にして明記し、**覚え方**も添えた——**人が「10%」と書く場所は 10、計算に使う場所は 0.1**。`TaxRate` のように**型で縛れる場合は縛って**ある(`10 \| 8 \| 0` なので 0.1 を渡すと型エラー)。**実際の利用箇所 8 件はすべて比率**で正しかった(`share` / `ratio` / `growth` / `helpful / total` など)。あわせて `scripts/`(セットアップ 3 種)も確認——`setup.bat` は `setup.ps1` を呼ぶラッパーで、`check-win-setup` が静的検査している |
| **検査の網を一巡して確認(すべて健全)** | 「見ていない場所」が 2 件見つかったので、他の検査も範囲を確かめた。**`check-api-auth` / `check-permissions` / `check-security-headers` / `check-rate-limit` は `apps` 全体**を見ており、`showcase` の 17 本を含む **API 262 本**が対象。`packages` 側に API は無い(`Response.json` を返す 8 件は**部品**で、API そのものではない)。**smoke が触っていない 12 パッケージ**も、すべて**単体テストがある**か(`address` / `bluetooth` / `device` など——ブラウザ API は依存なしで動かせないため)、**ソースが無い**(`config` はビルド設定のみ)。**契約テスト**は「実応答 0 件記録」だが、**週次ワークフローで自動記録する設計**で、GitHub Secrets の設定待ち——手順は `TESTING_GUIDE.md` にある。**CI は `preflight.mjs` を走らせて 71 種類すべてを実行**している |
| **E2E の件数が `apps/*/e2e/` を数えていなかった** | `check-doc-numbers` は **`e2e/` だけ**を見ており、`apps/internal-app/e2e/` の 2 ファイル(経費の申請フローと smoke)が**数えられていなかった**——**あるのに無いことになる**ので、次の人が同じものを作りかける。両方を数えるようにし、**14 → 16 本**に直った。**検査が「見ていない場所」は、検査が緑でも守られていない**——`check-utc-date` が「今から切る」だけを見ていたのと同じ形で、これで 2 件目。`verify-checks` は 71 件すべてが分類済み(**発火を確認 49 / 仕組み上できない 22**)で健全 |
| **今回作った検査 7 件が `verify-checks` に登録されていなかった** | `verify-checks` は「**違反を置くと赤になるか**」を実際に確かめる仕組み(**検査そのものが壊れていないか**を見る)。だが**このセッションで足した 7 件が未登録**だった——`check-order-by` / `check-style-literals` / `check-delete-confirm` / `check-file-input-disabled` / `check-returns-mismatch` / `check-unguarded-json-parse` / `check-server-localtime`。**検査を作っても、それが本当に発火するかは別**で、「書いたのに効いていない」と同じ形。7 件すべてに**違反の見本**を書いて登録し、**全件が正しく赤になる**ことを確認した(**46 → 53 件**)。あわせて既存の除外リスト 3 つ(`check-risky-duplicates` / `check-reimplementation` / `check-env-example`)も**実在しないキーが無いか**確かめた——`listAll` は**メソッド**として実在し、`CI` / `POSTGRES_*` は**システムや docker-compose が設定するもの**で意図どおりだった |
| **キーで引く設定は、綴りを間違えても何も起きない** | 「書いたのに効いていない」が **3 回続いた**(`describe` を `message` と書き誤り・幽霊アプリの検査・`UNUSED_REASONS` のキーを `web-push` と書き誤り)。**キーで引く設定は、存在しない名前を書いても静かに無視される**——エラーも警告も出ないので、**生成結果や実行を見るまで気づけない**。`UNUSED_REASONS` に**存在しないパッケージ名の検出**を足し、**実際に誤ったキーを入れて警告が出ることを確認**した。除外リストは他に 12 個あるが(`check-risky-duplicates` の `ALLOW` など)、**リストごとに「何が実在するか」の定義が違う**(関数名・環境変数名・ファイルパス)ので一律にはできない。**触るときに、その場で 1 つ壊して試すこと**——「書いた」と「効いている」は別 |
| **「未実戦」11 件のうち 9 件に理由が無かった** | `module-list.md` の **⚠ 未実戦**(アプリから使われていない)は、**理由を書かないと「作り忘れ」と誤解される**——次の人が「デモを作らなければ」と無駄な労力を使うか、逆に「使われていないから消してよい」と判断する。**11 件中 2 件しか理由が無かった**ので、5 件を追記した: **`web-storage` / `integrations` / `color` は基盤の内部で使われており、アプリから直接呼ばないのが正しい形**。`hid` は「対応する機器がまだ無い(カメラ読み取りで足りている)」、`cache` は「**Redis を使う場面がまだ無い**——DB が十分速く、キャッシュを挟むと**古い値を見せる危険**の方が大きい」。あわせて `html`(「ヘルパー」だけ)と `search`(「Adapter パターン」だけ)の説明も充実させた——`html` は **`escapeHtml` と `escapeAttribute` の取り違えが XSS になる**ことを明記。

**残り 4 件にも理由を書いて 10/10 にした**——`push`(通知は現在メール中心。**ブラウザ通知は許可を求める体験が重い**)、`json` / `xml`(**2026-08 に新設**。`xml` は電子申告・EDI で要るときのために置いてあり、**日本語のタグ名に対応**している)。**キー名を `web-push` と書き誤って**おり反映されていなかったのも直した(正しくは `push`)——**書いたのに効いていない**状態で、生成結果を見るまで気づけなかった。**理由の無い未実戦があれば生成時に警告**するようにし、**実際に 1 件消して警告が出ることを確認**した |
| **よく使う基盤の説明が「共通部品」だけだった** | `module-list.md` は **README の冒頭 1 行**を拾うので、そこが薄いと**一覧を見ても選べない**。`auth`(「認証・認可の共通部品。」)・`cache`(「キャッシュの共通部品。」)・`security`(「Web セキュリティの共通部品。」)・`session`(「セッション・クッキー処理の共通部品。」)・`testing`(「テスト支援ツール。」)——**どれもよく使うもの**なのに、何ができるか分からなかった。それぞれ**何ができて、何を持たないか**を書いた——`auth` は「**ログインの仕組みそのものは持たない**(それは `session`)」、`session` は「**判定は `auth`**」のように**境界を明示**。`security` には「**書き忘れても動いてしまう**守りなので検査で強制している」、`session` には「**失効の仕組みはあるがまだ繋がっていない**」も添えた。**20 文字以上**を smoke で固定(「何ができるか」を書ける最低限) |
| **パッケージの対応関係を洗った(概ね健全・説明の出所を明記)** | 「片方向」が 5 件続いたので、残る対応関係を確認した。**README が無いパッケージは 0 件**、**テストが無いのは `ui` だけ**(ただし下層に 16 件あり、smoke でも 104 箇所検査しているので健全)。**`package.json` の `description` は 118 件すべて空**だが、これは**内製で npm へ公開しないため**(ADR 0011)で正しい——`module-list.md` は**README の冒頭 1 行**を拾う設計。**どこに書けばよいかが分からない**状態だったので `PACKAGES.md` に明記した。あわせて **`@platform/testing` の説明が「テスト支援ツール。」だけ**だったのを充実させた——`fakeAuthUser` / `fixedDate`(**テストが日によって落ちる原因の多くは「今の時刻」を使っていること**)、`runCacheContract`(**メモリ実装と Redis 実装の両方に同じテストを通す**)まで書いた |
| **`check-preflight-coverage` が片方向だった(5 件目)** | 「検査が preflight から呼ばれているか」は見ていたが、**「`CHECKS.md` の一覧に載っているか」は見ていなかった**——**載っていない検査は存在を知る手段が無く、同じものを作りかける**。2026-08 に `CHECKS.md` が**20 件古い**状態(67 種類あると書きながら一覧は 48 件)だったのは、これが原因。逆方向を足し、**実際に 1 行消して落ちることを確認**した(前回 `describe` で「検査が効いていない」を経験したため)。**片方向だけ見ていた**のはこれで 5 件目——`CHECKS.md` / `COMMANDS.md` / 生成物 / README / `check-preflight-coverage`。**対応関係があるものは必ず両方向を見ること**。今回はすべて検査で固定した |
| **アラートと対応手順が繋がっていなかった** | `system-alerts` に 5 つのルールがあるのに、**`INCIDENT_RESPONSE.md` にはどれも手順が無かった**——**既存の `http_error_rate` すら**。**鳴っても何をすればよいか分からない**なら、アラートを足した意味がない。**アラート別の対応**を追加した——とくに `outbox_exhausted` は「**手で連絡する**(止まっている承認があれば当事者に直接伝える)」「**Outbox に残っているものは自動で再送されない**(諦めた状態なので手で作り直す)」まで書いた。`cron_failed` には「**現在はメモリ実装なので再起動でロックが消える**」という現況も添えた。**全ルールに手順があることを smoke で固定**——ルール名を `system-alerts.ts` から拾い、`INCIDENT_RESPONSE.md` に含まれるかを見る。`docs/ops/` の手順書(29 件)は他に問題なし——コマンド・パス・環境変数を突き合わせて確認した |
| **README を 373 → 191 行に整理(2 ファイルへ分割)** | 追記を重ねて**12 節・373 行**になり、入口として読みづらくなっていた。**重複していた 2 組**を統合——「主要コマンド」と「よく使うコマンド」、「クイックスタート」と「セットアップ」。**長すぎる 2 節を分割**——**パッケージ一覧 176 行**を `README.md` へ(全件の索引は `docs/ai/module-list.md`、選び方は `CATALOG.md` と役割を分けた)、**資料の書き方**を `README.md` へ(ADR と HANDOVER の使い分け・重複の扱い)。README には**地図と要点だけ**を残した。あわせて**幽霊アプリの検査が実際に効くか**を確かめた——`apps/nonexistent-app` を資料に足すと**終了コード 1 で落ちる**ことを確認(前回 `describe` で「静的検査は通るが動かない」を経験したため)。資料は 83 → 85 件、重複は 26 → 25 件 |
| **`CATALOG.md`(機能カタログ)が 29 件不足・`module-list.md` と役割が重複** | 「**アプリを作る前に、まずここを見る**」と書かれた**入口の資料**なのに、**118 件中 90 件しか載っていなかった**——**無いと思って自作する**。同じ目的の `docs/ai/module-list.md`(**自動生成・全 118 件**)があり、**手書きの方が古くなる**という当然の結果だった。**追記ではなく役割を変えた**——CATALOG は「**選び方の指針**」(似た機能が複数あるとき、`csv` と `xlsx`、`search` と `rag` のどちらを使うか)とし、**全件の索引は `module-list.md` を見る**よう冒頭で誘導。**手書きと自動生成が同じものを持つと、必ず手書きが負ける**。あわせて資料中の**存在しない検査名 2 件**も直した(`check-font-size-literals` は `check-style-literals` に改名済み、`gen-readmes` は存在しない)。**存在しないパッケージ名は 0 件**(`@platform/xxx` はプレースホルダ) |
| **存在しないアプリが 6 ファイルに残っていた(検査を新設)** | `equipment-app`(`internal-app` に統合済み)が **5 ファイル**、`platform-portal`(`showcase` の `/apps/portal` に統合済み)が **2 箇所**——**AI や新しい人が読むと、無いものを前提に設計する**。`check-doc-numbers` に**存在しないアプリ名を探す検査**を足した。**判定には 3 段階の絞り込み**が要った: **①単語の終わりまで見る**(`apps/internal-app/src/…` を途中で切ると `apps/internal` という存在しない名前になる)、**②URL のパスを除外**(`/apps/cart` は画面の URL でアプリ名ではない)、**③手順書の例を除外**(`my-app` は `pnpm new-app` の説明)。**統廃合の記録は対象外**(ADR・`ONBOARDING_TASK`・`HANDOVER` は「かつてあった」と分かる形で書いてある)。あわせて README の「`docs/ai` は自動生成」も正確にした——**7 件中 5 件が生成物で、`architecture.md` と `patterns.md` は手書き** |
| **ADR 22 件を全部点検した(食い違い 5 件・健全 17 件)** | **食い違い**: 0004(本番ストアの配線が未了)・0012(p95 目標を平均で測っている)・0017(セッション無効化が実行できない)・0020(基盤が `localStorage` を直接触っていた)・**0019(検査に穴)**——`check-utc-date` は「**今**から UTC の日付を切り出す」だけを見ており、**保存済みの ISO 文字列を切る**形(`row.updatedAt.slice(0, 10)`)は素通りしていた。画面 8 箇所がこの形で、**JST の 00:00〜08:59 に前日が表示**されていた。**健全**: 0003(bulkhead / circuit-breaker / rate-limiter はすべて使われている)・0005(トークン管理)・0006(Prisma 7 + `PrismaPg`)・0007(memory/prisma の切り替え 52 箇所)・0010(AI Gateway 必須)・0011(全 120 パッケージが `0.1.0` 固定)・0013/0014(`db push` と baseline の役割分担が明確)・0015(パッケージを分ける基準)・0016(2 要素認証は使わないのが正しい)。**ADR は「決定は正しいが実行が追いついていない」ことを書かない**ので、点検しないと**完了済みに見える** |
| **ADR 0020 に反して、基盤が `localStorage` を直接触っていた** | ADR は「**書き込みが例外を投げる**(プライベートモード・容量超過)」を理由に `@platform/web-storage` を作ったのに、**`packages/ui` の `skin-provider` が直接触って**いた——**基盤で例外が飛ぶと全アプリが落ちる**。`ThemeProvider` は対応済みだったので、**片方だけ直っていた**形。`createWebStorage` に置き換え、**検査で固定**した。**検出には注意が要った**——最初は 57 件に見えたが、**大半はコメント内の「`localStorage` を直接触らない」という説明**で、実際は 3 件(うち `app-skin` は try/catch あり、`theme.ts` は生成する文字列の中に try がある)。**自分の説明文を拾う**のはこれで 4 回目。あわせて ADR 0015(パッケージを分ける基準)に**データ形式は形式ごとに分ける**運用を追記した(`csv` / `html` / `json` / `xml` が独立している理由——**扱う形式が違えば読む人も直す人も別**) |
| **ADR 0017「セッションの無効化を先に」が実行できない状態だった** | ADR は退職時の順序を「**セッションの無効化 → ログイン不可 → 権限の削除**」と決め、「**権限だけ消してもセッションが生きていれば操作できる**」と理由も書いてある。だが **`currentUser` はクッキーから復元するだけ**で DB を引き直さないため、**ロールを外してもセッションが切れるまで(最大 8 時間)権限が続く**——**ADR の手順が実行できない**。現況を追記し、**暫定の緩和策**も書いた(**最終出社日の終業後に権限を外せば、翌朝には失効している**)。**決定は変えない**——順序が正しいことに変わりはなく、手段が追いついていないだけ。あわせて **0010(AI Gateway 必須)は守られており**、**0016(2 要素認証)は「使っていないのが正しい」**(Zoho SSO なので IdP に任せる、という ADR のとおり)ことも各 ADR に明記した——**「使われていない」と「使うべきなのに使っていない」は別**なので、書いておかないと次の人が判断できない |
| **ADR 0012「p95 300ms」を、平均 500ms で測っていた** | 性能目標の ADR は **p95 300ms** だが、`system-alerts` の条件は **`avgLatencyAbove(…, 500)`**——**平均と p95 は別物**で、平均が 500ms 以下でも**一部の利用者だけが 2 秒待たされている**ことはありうる。**目標を測っていない**状態だった。p95 を出す材料はある(`metrics.snapshot().histograms` に `buckets` / `sum` / `count`)ので**測るなら自前で計算する**——今は平均で「明らかに遅い」だけを拾っていることを、コードと ADR の両方に明記した(**目標は変えない**。測り方が追いついていないだけ)。あわせて **`check-docs-duplication` が ADR の見出しを重複と数えていた**問題も直した——「背景」「決定」「結果」を全 ADR が持つのは**揃っている証拠**で、数えると**正しい形式ほど違反が増える**。見出しだけ対象外にし、本文の重複は引き続き見る |
| **ADR 0013 と 0014 が片方向の参照だった / 形式の不揃い** | **0013「`db push` で履歴を持たない」**と**0014「本番ではマイグレーションへ切り替える」**は段階の違う話だが、**0013 から 0014 への参照が無かった**——0013 だけ読んだ人が「履歴は要らない」と判断すると、**本番で `db push` を使って差分の適用順が保証されず、戻せなくなる**。0013 の末尾に誘導を足して相互参照にした。あわせて**形式の不揃い**も直した——20 件中 2 件が `- 日付: … / 状態: …` の形になっておらず、**状態(採用 / 提案 / 置換)が機械で拾えなかった**(「この決定はまだ生きているか」を一覧できない)。テンプレートの形に揃え、**smoke で固定**した |
| **ADR 0004「本番ストア」と現況が食い違っていた** | ADR には「**複数インスタンス・再起動に耐える本番構成が可能に**」とあり、最後に「実際の Redis/DB 実装はアプリ側の配線が必要」とも書かれていた。**間違ってはいないが、「まだ配線されていない」ことは書かれていない**——読んだ人は**本番対応済みだと誤解する**。**現況(2026-08 追記)**の節を足し、メモリ実装のまま残る 5 つ(`notifyOutbox` / `notifySeen` / `idempotencyStore` / `lockStore` / `rpa-service` の `lock`)と、それぞれ**台数を増やすと何が起きるか**を表にした。**ADR の決定は変えない**——基盤に実装を用意する判断は正しく、残っているのは**配線という作業**。あわせて監査ログの上限メッセージから **ADR 0018(保存義務と削除要求が衝突したら保存義務を優先)** へ誘導した——「本人から消してと言われた」だけでは消せない。なお ADR は **22 件中 5 件しか「状態」を持たず形式がばらついて**いる(触るときに揃えること) |
| **README に書いた「資料の地図」自体が不正確だった(自分の誤り)** | 「**4 箇所・42 件**」と書いたが、実際は **8 箇所・83 件**——**`docs/adr` 22 件と `docs/platform` 11 件を数え落として**いた。`docs/HISTORY.md` が古いことを指摘した直後に、**自分が同じ誤りをした**。原因は `ls docs/` の結果を目視で数えたこと。**`check-doc-numbers` に「資料の総数」を追加**して固定した(README の「全部で 83 件あります」が実態とずれたら落ちる)。あわせて **ADR と HANDOVER の使い分け**も明記した——どちらも「なぜそうしたか」を書くので紛らわしいが、**ADR は後戻りしにくい選択**(1 決定 = 1 ファイル。覆すときは新しい ADR を足して**消さない**)、**HANDOVER は見つけた欠陥とその場の判断**(1 ファイルに追記)。**迷ったら HANDOVER**——ADR は「1 年後も効いている選択」だけにしないと**増えすぎて読まれなくなる** |
| **`docs/HISTORY.md`(4,021 行)が 1 ヶ月古く、存在しないアプリを載せていた** | 資料同士の関係を整理する中で見つかった。**更新日 2026-07-13** のまま、**`equipment-app` という存在しないアプリが 11 箇所**に出てくる——AI や新しい人がこれを読むと、**無いものを前提に設計する**。`check-doc-numbers` は「アプリ 5」を検査しているが、**この資料は対象外**だった。冒頭に警告を入れ、**最新の情報源へ誘導**する表を足した(基盤は `docs/ai/module-list.md`、アプリは `docs/APPS_AND_DEMOS.md`——**どちらも自動生成**)。README には**資料の地図**を追加——資料は**4 箇所**(ルート / `docs` / `docs/ops` / `docs/ai`)に分かれており、目的から引ける表と、**重複を許す基準**(同じ話題が複数に出るのはよいが、**数値は書かない・手順は 1 箇所に書いてリンクする**)を明記した。あわせて `public-site` の**公開日が UTC** になっていた 5 件を `formatDateJst` に直した(`internal-app` と同じ形)。`crud-template`(雛形)と `line-console` は健全 |
| **showcase の金額表示 21 ファイルを統一・除外基準を明文化** | **④**——見本の `showcase` に手組みの金額表示(`¥${n.toLocaleString()}`)が残っており、**マイナスが `¥-500`**(帳簿の慣行は `-¥500`)になっていた。**21 ファイル**を `formatYen` に統一し、**0 件**にした。**⑤ 除外基準**——`showcase` を除外する検査としない検査が混在していたので、`CHECKS.md` に基準を明文化: **除外してよいのは「利用者のデータを壊さないため」の検査**(削除の確認・ファイル選択の無効化・見た目の直書き)、**除外してはいけないのは「書き方の見本」の検査**(金額・日付・率の表示、`orderBy` の指定)。**②型注釈の無い設定配列**は他に無かった(`JOURNAL_COLUMNS` などは**文字列の配列で関数を持たない**ので、誤りは型検査で止まる)。**① 静的検査 30 件**は、動かせるものは既に動かしており、残りは React フックなど構造上難しいもの |
| **README が 38 パッケージ・3 アプリ分古かった** | 「120 パッケージ」という**数値は検査されていた**が、**一覧は 80 件しか載っていなかった**——`CHECKS.md`(20 件古い)・`COMMANDS.md`(29 件未掲載)・生成物の検査漏れに続いて **4 件目の「片方向だけ」**。載っていないパッケージは**存在を知る手段が無く**、同じものを作りかける。38 件(`json` / `xml` / `feed` / `invoice` / `chat` / `cms` など)と 3 アプリ(`public-site` / `line-console` / `crud-template`)を追記し、**トップレベルの構成**(`apps` / `packages` / `tools` / `docs` / `tests` / `e2e` / `ops` / `scripts`)も足した。あわせて **`packages/` にロジックを置かない**理由(「請求書の合計を出す」は基盤、「この会社では締日が 20 日」はアプリ——**業務の都合が入ると別のアプリで使えなくなる**)も明記。**自分の変更も動かして確かめた**——`parseNumberOr` / `formatPercent` は実行、`useConfirm` は `ConfirmDialog` とプロパティ名を突き合わせ(`describe` の取り違えと同じ形が無いことを確認)、上限の定数 2 つも使用箇所を確認 |
| **③ 静的な検査を信じて、アラート機能を壊していた(自分の誤り)** | 前回追加した 3 つのアラート(`outbox_exhausted` / `cron_failed` / `audit_write_failed`)で、**`describe` を `message` と書き誤って**いた。評価器は `rule.describe(…)` を呼ぶので、**実行すると `rule.describe is not a function` で落ちる**——アラートを足したつもりが、**アラート機能全体を壊していた**。**静的な検査(`/outbox_exhausted/.test(src)`)は通っていた**のが見落としの原因で、**文字列があることと動くことは別**。ルールを**実際に評価器へ通す**検査に変えた(鳴らない場合・鳴る場合の両方)。原因は 2 つ——**`const RULES = [` に型注釈が無かった**(`AlertRule[]` と書いてあれば型検査で止まる)、**このセッションでは `pnpm typecheck` が走らない**(依存が要る)。型注釈を足した。**smoke の静的検査は 30 / 2,277 件(1.3%)**で、大半は実際に動かしている——**残り 30 件も動かせるものは動かすこと**。

**④ 型の緩さ**は健全——`any` は **8 件**、`as unknown as` は 301 件だが**過半が `typeof fetch`**(テストのモックを型に合わせるため)で正当。**⑤ 依存の重さ**も健全——**51 / 118 が依存ゼロ**、最多は `ui` の 14(部品が多いので妥当)。**⑥ ログの量**——API のアクセスログは無く**メトリクスのみ**だが、**3 層で追える**ので足りると判断: メトリクス(全体の傾向)・監査ログ(誰が何をしたか)・エラーの `digest`(個別の失敗)。アクセスログを足すと**1 日数万行**になり、かえって調査に使えない |
| **①〜⑤ を点検(対応関係・移行手順・見本の乖離)** | **① 対応関係**——権限は使用 45 / 定義 45 だが、**`APP_FEATURES`(画面の出し分け用の対応表)が丸ごと未使用**だった。画面では権限を判定せず **API 側 262 本**で守る設計なので使っていない。**`exportReport: "expense:export"` と `attendance:submit` は API 側が別の権限で判定**しており(`expense:read:any` / `attendance:write`)、**この表を使い始めると「権限を持っているのに押せない」**ことになる——理由と注意を明記した。アプリと資料の対応は健全。**② 上限に達したときの手段**——検索索引(5 万件)は **`reindex` の対象を変えれば減らせる**(増え続けるのは監査ログだけなので、まずそれを外す)。監査ログのように「消す手段が無い」状態にはならない。**③ 移行手順**——**メモリ実装から Redis / DB へ移す手順**を HANDOVER に追加した(順番・確認のしかた・移す前に未送信を空にすること)。**④ 未使用パッケージは 0 件**(118 すべて使われている)。**⑤ showcase の乖離**——`Number(e.target.value)` が **42 箇所**残っており、**見本が古いと真似られる**。金額を扱う 3 つ(請求書・見積・税)を `parseNumberOr` に直した |
| **①〜⑥ を点検(3 件を修正)** | **① 上限に達したときの手順**——監査ログの上限メッセージが「書庫へ移してください」だったが、**書庫は作るだけで元は消えない**。正確な手順に直した(①`/admin/data` で書庫を作る ②保存義務期間を過ぎた分を消す)。**②の削除はまだ手段が無く**、SQL で直接消すことになる——**消す前に `archiveChecksum` で書庫を検証すること**。**② 起動の順序**は健全(止めるのは弱い秘密と localhost の 2 条件のみ。DB は遅延接続なので落ちていても起動できる)。**③ 入力途中の保存**——入力欄が最多 9 個で長いフォームが無く、CMS は `draft` 状態を持つので不要と判断。**④ エラーメッセージ**——「管理者権限が必要です」が **37 ファイル 57 箇所**にあり、**次にすべきことが書かれていなかった**。「必要な場合は管理者に依頼してください」を足した。**⑤ 検査の抜け**は無し。**⑥ 生成物**——`gen-ref-site` が `gen-all` にあるのに **`check-generated` で見張られておらず**、生成し忘れると古いまま公開された。追加し、**全部が見張られていることを smoke で固定**した(`CHECKS.md` の一覧が 20 件古かったのと同じ**片方向だけ見ている**形) |
| **①〜⑥ を点検(3 件を修正)** | **①② ビルド時と実行時**——`module` 直下で env を読む箇所が 10 件あるが、**認証を使わないページはクライアント側でデータを取る**形なので静的化されても問題なし。**③ ページング**——基盤に `Pagination` があるのに**アプリで 0 箇所**。監査ログの API は **`limit` を渡さなければ無制限**で、画面は渡していなかった——**既定 200 件・上限 1,000 件**にした(200 は「1 画面をスクロールして追える量」。それ以上は CSV で落とす方が早い)。**④ 検索の索引**——`searchIndexed` は**検索のたびに全件を読み込んで索引を作り直す**ので、**5 万件**の上限を設けた(超えたら知らせる。**黙って切ると「無いのか漏れたのか分からない」**)。**⑤ 障害時の縮退**は健全——ヘルスチェックが正しく失敗を返し、画面は `error.tsx` が出る。**⑥ バックアップ**——添付ファイルは記載済みだったが **Redis の扱いが無かった**ので追記した。**バックアップ不要**(中身は作り直せる)だが、**冪等キーだけは注意**——消えた直後の再送で二重実行を防げない。**現状は冪等キーもロックもメモリ実装**なので、**再デプロイのたびに同じ状態**になる |
| **④ 画像の遅延読み込みが無かった / ⑤⑥ は健全** | **④**——`next/image` を使わず生の `<img>` が 8 箇所(基盤の `Eyecatch` を含む)あり、**`loading="lazy"` が無かった**。**一覧に 50 件並べば 50 枚を一度に取りに行く**——回線が細い場所では、**下までスクロールしない画像まで待たされる**。`loading="lazy"` と `decoding="async"`(**描画を止めずに復号する**)を足した。**⑤ 多言語**は健全——`i18n-check` が**未定義キー・ロケール欠落なし**を保っており、4 言語(ja/en/ko/zh)の辞書が揃っている。言語切り替えは**帳票**(`expenses/report`)で実用されている。未使用キー 25 件は参考情報。**⑥ 権限の粒度**も健全——`check-api-auth` が **API 262 本すべて**(認可あり 216 / 公開宣言あり 46 / どちらも無い 0)を守っており、CMS は `cms:read` / `cms:edit` / `cms:publish` と**読み・書き・公開で分かれて**いる |
| **② 本番で `localhost` を指す設定が通っていた** | `assertSecretStrength` は**秘密だけ**を見る(名前に `SECRET` / `TOKEN` / `PASSWORD` / `KEY` を含むもの)ので、**URL は対象外**——`PUBLIC_SITE_URL` が既定の **`http://localhost:3001`** のままでも起動できた。`featureEnv` には**本番と開発の分岐が無く**、`optionalEnv` の既定値がそのまま使われる。実害は**その場では出ない**——**CMS のプレビューを押した人が「開かない」と気づくまで**分からない。`assertProductionUrls()` を足し、**本番で `localhost` / `127.0.0.1` を含む設定があれば起動を止める**ようにした。smoke の本番模擬テストが**正しく落ちた**ので、テスト側にも実際の値を入れた |
| **③ 監査ログの全件取得に上限が無かった** | `findMany` に `take` が無い箇所は 76 件あるが、**大半は `where` で絞られて**おり(1 メッセージのリアクション・1 部屋のメンバーなど)実害は無い。**絞り込みも上限も無い**のは 44 件で、その中で危ないのは **`audit-log` の `all()`**——**監査ログは増え続ける**(1 年で数十万行になりうる)のに、`query()` が**毎回全件を読み込んでメモリでフィルタ**していた。**10 万件**の上限を設け、**超えたら `AppError` で知らせる**ようにした(黙って切ると「これで全部」と思われる——`freee` の `fetchAllPages` と同じ判断)。10 万件は「1 日 300 件で 1 年分」の目安で、**古い分を書庫へ移す運用を始める合図**。なお検証(`verifyChain`)は全件が要るので、**上限に達したら検証できない**ことも伝わる。smoke では 6 箇所が `audit-log.ts` を読んでおり、**同じスタブを各所で書くと内容がずれる**ので `makeCoreStub()` にまとめた |
| **【要判断】通知の Outbox が本番でもメモリ実装(起動時の警告を追加)** | `services.ts` の `notifyOutbox` / `notifySeen` が **`createMemory*` のまま**。「実運用では DB テーブルに置き換える」とは書いてあったが、**置き換えないまま出たときに何が起きるかが分からなかった**: **①再起動で未送信の通知が消える**(承認の依頼が届かないまま)、**②複数インスタンスがそれぞれ別の Outbox を持つ**——リレーが動くのは片方だけなので**もう片方の通知は永久に送られない**、**③重複抑制も効かない**(2 台構成なら**同じ通知が 2 回届く**)。**本番なら起動時に `log.error` を出す**ようにした。置き換えには **`createSqlOutboxStore`**(`@platform/observability`)と **`createRedisSeenStore`**(`@platform/notify`)を使うが、**`OutboxRow` テーブルがまだ無い**ためマイグレーションが要る——**DB 変更を伴うので人の判断で**。なお `createRedisCache` は既に使われている。

**同じ形を洗って 3 箇所**——`notify-scheduler` の **`lockStore`**(定期実行の排他)、`rpa-service` の **`lock`**、**`idempotencyStore`**(二重実行防止)。いずれもコメントに「実運用では〜」とあるだけでメモリ実装のまま。**1 台なら動くが、台数を増やすと壊れる**: **排他が効かないと全インスタンスで定期実行が走り、通知やレポートが台数分届く**。**二重実行防止は「防いでいるつもり」で防げない**——もう片方は「初めての要求」だと判断する。起動時の警告に**まとめて挙げる**ようにした(「どれが危ないか」を探し回らずに済むよう 1 つのログに全部書く)——**台数を増やす前に気づきたい**。`platform-services.ts` の 60 以上のストアは **`usePrisma ? createPrisma… : createMemory…`** で正しく切り替わっている |
| **Result と例外の使い分けが書かれていなかった(`CLAUDE.md` に基準を追加)** | 両方が使われている(`Result` を返すパッケージ 33 / `AppError` を投げるもの 24)のに、**どちらを使うかの基準が無かった**——`@throws` の食い違い 13 件は、この曖昧さが原因の一つ。基準は**「呼び出し側が続行できるか」**: **例外**は続行できない場合(設定不備・引数が不正・権限が無い)、**Result** は呼び出し側が判断する場合(入力の検証・外部連携の失敗・見つからない)。**迷ったら Result**——例外は**捕まえ忘れると画面ごと落ちる**ので、「落ちてよい場合」だけに使う。あわせて 2 つの落とし穴も書いた——**説明と実装を食い違わせない**(「例外を投げる」と書いて `null` を返すと `try/catch` で捕まらない)、**Result なら `ok` を必ず見る**(`applyMovement` は `ok` を見ないと**出庫できていないのに成功したことになる**)。インデックスも確認したが健全だった——**22 モデルに `@@index` が無いが、主キーが業務キー**(`sku` / `code` / `account`)で、主キーには自動でインデックスが付く |
| **外部キーをほとんど張らない理由が書かれていなかった** | **69 モデルのうちリレーションはチャットの 2 件だけ**で、残り 34 列は `userId` などを**文字列として持つ**だけ。理由が書かれておらず、次に見た人が「張るべきでは」と考えたときの**判断材料が無かった**。確認した判断を schema の冒頭に書いた: **①物理削除をしない運用**が前提(利用者も申請も**消さずに状態で管理**。`@platform/pii` の消去は「消せるかを判断する」までで、**保存義務期間内は消せない**)——**孤児が生まれる経路そのものが無い**。**②アプリをまたいでデータを持つ**(内部アプリと LINE 連携が同じ利用者を指す)ので、外部キーを張ると**片方のアプリだけでマイグレーションできなくなる**。**③削除の順序に縛られない**。あわせて **「張るなら全部に張ること」**も書いた——**2 件だけ張っている今の状態は「ここは守られている」と誤解させる** |
| **DB のリレーションをほぼ張っていない(69 モデルに 2 件)——孤児は出ないが意図が書かれていなかった** | 「データの整合が崩れる経路」を探して分かったこと。**外部キー制約をほとんど使わず**、`threadId` のような**文字列で参照**している。`onDelete: Cascade` は 2 件だけ。**孤児レコードが出る形**だが、実際に確かめると**親を削除する経路がほとんど無い**(掲示板のスレッド・チャットのルームに削除機能が無い)ため、現状は問題にならない。唯一 `webhookSubscription` に削除があり、**配信ログが残る**——これは**監査として正しい**(送信先から「受け取っていない」と言われたときに示すものが必要)。ただし**意図が書かれていなかった**ので明記した——「消し忘れ」なのか「あえて残す」のかが読めないと、次の人が**善意で消す実装を足す**。あわせて「古いログは別途まとめて消すこと」も書いた(溜まり続けるため) |
| **例外の握りつぶしを洗った(実質ゼロ・認証まわりに理由を明記)** | 「諦めたが伝えていない」形を基盤でも探した。**完全な握りつぶし(`catch {}`)は 0 件**。「情報も説明も無い catch」として 31 件出たが、大半は**誤検出**だった——`accounting/sync.ts` は `status: "unknown"` を返し(**通信が切れたら「送ったか分からない」**。`failed` にすると再送されて二重計上になる)、`notify/resilient.ts` は `lastError` に保持し、`cron/lock-file.ts` は**意図的に無視する理由がコメントに書いてある**。**認証まわりの 2 件**(`otp.ts` / `recovery-codes.ts`)は `match = false` に倒しており正しいが**理由が書かれていなかった**ので明記した——`timingSafeEqual` は**長さが違うと例外を投げる**ので、ここに来るのは保存値が壊れているか形式違い。どちらも通してはいけない。あわせて**`try` の外で長さを比べない**理由も書いた(先に長さで弾くと**応答時間の差から長さが漏れる**) |
| **握りつぶしを洗ったが健全(説明だけ足した)** | 「ログにしか残らない」の次に、**例外を握りつぶしている箇所**を探した。31 件の候補が出たが、**大半は正しい実装**——`accounting/sync` は通信断を `unknown` として返し(**`failed` にすると再送されて二重計上**)、`cron/lock-file` は「別プロセスが先に消した場合」とコメント付きで無視し、`notify/resilient` は `lastError` を保持して最後に投げる。**検出の精度が低かった**(catch ブロックの外にある `throw` を見落とす)。実際に手を入れたのは**認証の 2 件に説明を足した**だけ——`timingSafeEqual` は**長さが違うと例外を投げる**ので `match = false` にしているが、**なぜ例外が出るのか**が書かれていなかった。**長さの違いを先に判定すると、その分岐で時間差が出る**(タイミング攻撃の手がかり)ので、**例外を握りつぶすのではなく「一致しない」という結果として扱っている**——この意図が読めないと、次の人が「先に長さを見ればいい」と直してしまう。なお秘密の比較は **14 パッケージすべてで `timingSafeEqual`** を使っており健全 |
| **再試行を使い切った通知が、ログにしか残っていなかった** | Outbox は `maxAttempts = 5` で上限を持ち、超えたら諦める(`exhausted` を数える)——ここまでは健全。だが**アプリ側は `log.warn` を出すだけ**で、**見る人がいなければ気づけなかった**。経費の承認通知が届かないと、**申請者は「まだ承認されない」、承認者は「依頼が来ていない」と思ったまま承認が止まる**——どちらも自分は待っているつもりなので、**誰も異常だと思わない**。`system-alerts` は**メトリクス駆動**(`metrics.snapshot()` を評価して通知する)なので、**`outbox.exhausted` をメトリクスに載せて**初めて人に届く。あわせて `outbox_exhausted` のアラート条件を足した——**1 件でも起きたら知らせる**(件数が少ないほど原因を追いやすい)。

同じ形を洗って**さらに 2 件**——**① 定期実行の失敗**(`cron_runs_total{outcome:"error"}`)はメトリクスには載っていたが**アラートが無く誰も見ていなかった**。通知リレーが止まると **Outbox が溜まり続け**、やがて `outbox_exhausted` になる——**そこまで進む前に気づきたい**。定期実行は「動いていて当たり前」なので、**止まっても誰も報告してこない**。**② 監査ログの記録失敗**は `log.warn` だけだった。**欠けたこと自体が記録に残らない**のが問題で、監査のときに**「記録が無い＝ログインしていない」と誤読される**——実際には「記録できなかっただけ」かもしれない。どちらもメトリクスに載せ、アラート条件を足した |
| **タイムアウトの残りを洗った(サーバ側は健全・クライアント側は入れない判断)** | ③ で `google` / `microsoft` を直した後、**アプリ側の 38 箇所**も確認した。**サーバ側 4 箇所はすべてタイムアウトあり**(webhook 送信・システム通知・問い合わせ・AI 応答)。**クライアント側(`useSubmit`)は入れない判断**をした——`run` の中で `fetch` しているので**時間切れにしても送信は止まらず**(`AbortSignal` を呼び出し側まで通す必要がある)、止まらないまま「失敗」と伝えると**利用者はリロードして再送する**。**「送信されたか分からない」状態が一番危ない**。サーバ側がタイムアウトを持つので**実際には数十秒で応答が返る**。**入れるなら `AbortSignal` を通す形**にすること、と TSDoc に書いた——時間切れで済ませてはいけない |
| **④〜⑦ を点検(すべて健全)** | **④ 検索**——BM25 は空文字・記号・500 文字でも**例外を出さず 0 件を返す**。DB の全文検索は **`websearch_to_tsquery`** を使っており、`to_tsquery` と違い**利用者の入力で構文エラーにならない**(正しい選択)。**⑤ 添付**——マジックバイトの検証は無いが、**`Content-Disposition: attachment`**(ブラウザで開かせない)・**`X-Content-Type-Options: nosniff`**(全アプリに付く)・**key はランダム**の 3 つで守られている。**⑥ 通知の宛先**——`notifierFor` が**都度 DB から引く**設計で、**退職が反映される**(起動時に読み込む形だと反映されない、と TSDoc に理由が書いてある)。**⑦ アプリ間の重複**——12 件のうち `handlePOST`(Next.js の規約)・`currentUser` / `requirePermission`(アプリごとにロールが違うため意図的)を除くと、実質は **`proxy.ts` の `withNonce` 10 行**。**中核(ヘッダの組み立て)は既に `@platform/security` にあり**、重複しているのは `NextResponse` への適用だけ——**基盤に移すと security が Next.js に依存する**ので、現状のままでよい |
| **③ Google / Microsoft の連携にタイムアウトが無かった** | `@platform/integrations` の共通クライアントは `timeoutMs = 10 秒` / `totalTimeoutMs = 30 秒` を持つが、**`google` と `microsoft` は直接 `fetch` を呼んで**おり無かった——**相手が応答しないと永久に待つ**。Next.js のサーバ側なら**そのリクエストが返らず、利用者は白い画面のまま**になる。とくに **SSO ログイン**(`getMicrosoftUserInfo` / `getGoogleUserInfo`)がこの経路で、**ログインできないまま固まる**。`google` は `googleFetch()`(タイムアウト付きの包み)を作って 3 箇所を通し、`microsoft` は `createMicrosoftAuthedFetch` に組み込んだ。**呼び出し側が `signal` を渡していればそちらを優先**する。10 秒は共通クライアントと同じ既定——**普段は 1 秒以内に返る**ので、10 秒待って返らなければ異常 |
| **② 金額の入力が `Number()` のままで `NaN` になった** | 請求書・見積の金額欄は **`type` 指定の無いテキスト入力**で、`Number(e.target.value)` をそのまま状態に入れていた——「abc」と打つと **`NaN`** になり、**`¥NaN` と表示され、そのまま保存もされうる**。基盤に **`parseNumberOr(v, 0)`** があるのに使っていなかった(**全角も桁区切りも読めて、不正なら既定値**——`"1e30"` は `130` になるので**桁あふれも防げる**)。14 箇所を置き換え、検査で固定した。なお `Number.MAX_SAFE_INTEGER`(約 900 兆)を超える金額は日本円では現実的でないが、**0 を多く打つ入力ミス**では到達しうる——`parseNumberOr` が `e` 記法を落とすので、その経路も塞がった |
| **① 一覧の並び順を指定していない 28 件(`check-order-by` 71 本目)** | `findMany` に `orderBy` が無いと**DB が返す順は不定**。PostgreSQL は物理的な格納順で返すので、**行を更新すると順序が変わる**(更新した行が末尾へ移動する)。画面には「**一覧を開くたびに並びが違う**」「**更新した行が別の場所へ飛ぶ**(さっき見た行が無い)」という形で現れる——**平常時は正常に見える**(開発中は行数が少なく順序も安定して見える)。**商品一覧・用語集・設定**を直した。残る 15 件は**後段で並べ替えるもの**(チャットのメンバー)や**集計に使うだけ**のもので、一律に禁じると**意味のない `orderBy` が増えて本当に必要な場所が埋もれる**。**`id` 順にしない**——利用者にとって意味が無く「なぜこの順なのか」を説明できない。商品は SKU 順(棚番や型番と対応)、用語は五十音順にした。検出は**括弧の対応で引数の範囲を取る**——正規表現だと `where: { x: { in: [...] } }` の入れ子で途中が切れて誤検出する |
| **ハニーポットが繋がっておらず、問い合わせの守りはレート制限だけだった** | 「基盤にあるのに繋いでいない」形を機械で洗ったところ、**2,084 の公開関数のうち 5 件**だけが未使用で、そのうち **`isHoneypotFilled`(スパム対策)**が実害のあるものだった。問い合わせフォームの守りは**レート制限だけ**——**分散したスパムは 1 通ずつ来る**ので、回数の制限では止まらない。`ContactForm` に隠し欄(`website`)を足し、**判定はサーバ側**で行うようにした(**クライアントで弾くと JavaScript を切った機械に効かない**)。**弾いたことを相手に伝えず成功に見せる**——「弾かれた」と分かると、次は埋めずに送ってくる。残る 4 件(`createTaggedCache` / `isRowSelected` / `isAllSelected` / `isIndeterminate`)は**便利機能**で、使わなくても実害が無い。

同じ観点で**定数**(86 件)と**起動順序**も見たが健全だった——`ALLOWED_EMBED_HOSTS`(埋め込みを許すホスト)や `MAX_SEARCH_LIMIT` は**すべて使われて**おり(検出条件が緩く誤検出した)、マイグレーションは**起動時に実行しない設計**で正しい(複数インスタンスが同時に走らせると壊れる)——専用コンテナ(`Dockerfile.migrate`)があり、手順も 3 つの資料に書いてある |
| **【要判断】ロールを外してもセッションが切れるまで権限が続く** | `currentUser` は**クッキーから復元するだけ**で DB を引き直さない。`roles` がセッションに入っているので、**管理者権限を外しても最大 8 時間(セッションの有効期間)は管理操作ができる**。退職者も同じで、`@platform/access-review` の `offboardingSteps` が「**セッションの無効化が先**」と言っているのに、**無効化する手段がアプリに繋がっていない**。**仕組みは基盤にある**——`@platform/session` の `createRevocationGate` / `createMemoryRevocationStore`。使われているのは `showcase` の生成物だけで、`internal-app` は繋いでいない。**繋ぐには**: ①失効ストアを本番用(Redis か DB)で用意 ②`currentUser` で毎リクエスト確認する ③ロール変更・退職処理から失効を呼ぶ。**②は全リクエストに 1 往復増える**ので、性能への影響を測ってから決めること。**暫定の緩和策**としてセッションの有効期間を短くする手もあるが、**短いと昼休みで切れる**(現在 8 時間は業務時間より少し長い設定) |
| **残債「説明が抜けている引数」の優先度どおりに 185 → 181 件** | 前回決めた減らす順番——**①注入が必須の引数(`hashFn` / `now` / `fetchImpl`) ②既定値がある引数 ③名前だけの違い**——のうち、**① が残っていた**ので片付けた。`now`(時刻の注入)3 件と `db`(Prisma クライアント)3 件——**渡せることを知らないとテストが書けない**引数で、`createPrismaCmsStore` のように「メモリ実装と DB 実装を差し替える」設計では、**引数の存在自体が設計の一部**になる。残る最多は **`options` 33 件**だが、これは「オブジェクト引数の中身を 1 件ずつ書く」作業で、**内容が全部違う**ので機械的には減らせない。**触るときに書く**方針は変えない |
| **`smoke.mjs` 20,620 行の索引を作った(分割はしない判断)** | 残債「600 行超 8 件」の中身を確かめた。`union-literals.ts`(型の一覧)・`numbers.ts` / `strings.ts`(ユーティリティの集合)・`calendar.ts`(祝日表を含む)・`seed.ts`(初期データ)は**分割すると探しにくくなる**もので、`advisor find` で探せるため 1 ファイルでよい。突出しているのは **`smoke.mjs` の 20,620 行・465 セクション・2,245 件**。**分割しない判断をした**——`smoke.mjs` は**依存をインストールせずに実ソースを動かす**のが役目で、そのために**各セクションが自分でスタブを組み立てて**いる(`@platform/core` の最小実装をその場で書き出す等)。分割すると**スタブの重複か、共有のための新しい仕組み**が要り、**作業そのものが 2,000 件超の検査を壊すリスク**を持つ。代わりに **`docs/ai/smoke-index.md`**(セクションと行番号と検査数)を自動生成するようにした。**分割を考える条件**も書いてある——スタブの重複が目に見えて増えたとき、または 1 セクションを直すのに周りを読まないと分からなくなったとき |
| **「200 文字超 1,370 件」の実態を見て、極端なものだけを別枠にした** | 上限方式で管理していた残債の中身を確かめた。内訳は `internal-app` 572 行・`smoke.mjs` 478 行・`showcase` 175 行で、**大半は意図的に長いもの**(JSX の 1 行・1 行 1 検査)。**上限方式で妥当**だった。ただし**最長が 858 文字**で、500 文字超が 6 件あった——**画面に収まらず、差分が「1 行変わった」としか出ない**のでレビューで中身を確かめられない。**860 文字を超えたら 1 件でも止める**判定を足した(上限方式にしないのは、**この長さが「うっかり」でしか生まれない**ため——意図して 900 文字の行を書く理由が無い)。**数だけ見て「多いから直す」と判断しない**——中身を見ると、直すべきは 1,370 件ではなく「これ以上増やさないこと」だった |
| **文字サイズの直書きが 328 件(`check-style-literals`(当初は `check-font-size-literals`。角丸も見るようになり改名)70 本目)** | 「その場で書けるものは崩れる」という見立てで画面を洗ったところ、**色は守られていた**(`check-hardcoded-colors` が 0 件・CSS 変数も未定義 0 種)が、**文字サイズは `style={{ fontSize: 13 }}` が 328 件**あった。`9 / 10 / 11 / 12 / 13 / 14 / 15 / 16 / 18 / 20 / 22 / 24 / 40 / 48` の **14 種類**が混在——**1px 刻みの違いに意味があるとは考えにくい**。同じ役割の文字が画面によって違うサイズになり、並べたときにちぐはぐに見える。**減らす作業は見た目の判断を伴う**(文字サイズを変えると印象が変わる)ので、**私が勝手に変えず、増やさない歯止めだけ**を作った。減らす順番も書いてある——**Tailwind に無い中間値(9/11/13/15)から**、近い方へ寄せる。**上限はファイルにせずコードに書いた**——上限ファイルは smoke が 6 件以内に制限しており、**しばらく動かない見込みのものはコードに理由を添える方がよい**。

続けて**角丸**も同じ形だった——`borderRadius: 8` が 102 件で、`4 / 6 / 8 / 10 / 12` が混在。テーマには **`--radius` があるのに使っていない**ので、**テーマを切り替えても角丸が変わらない**(`999` はピル形状なので対象外)。検査を **`check-style-literals`** に改名して両方を数えるようにした(**427 件**)——`fontSize` と `borderRadius` は「その場で書けて、テーマから外れる」という同じ性質なので、別の検査にすると**片方だけ見張る**ことになる。

**余白(`padding` / `gap` / `margin`)は対象にしなかった**——176 件のうち **152 件(86%)が 4px グリッド**に乗っており(`4 / 8 / 12 / 16 / 24 / 40`)、外れているのは `2px`(2 件)・`6px`(13 件)・`10px`(9 件)だけ。**基準そのものは守られている**。文字サイズが `9〜48px` の **14 種類バラバラで基準が無かった**のとは状態が違うので、一律に見張ると**守れているものまで違反に見える**。判断の根拠を検査のコメントに書き、**崩れてから足す**方針にした |
| **率(%)の表示も 6 画面で手組みだった** | 金額・日付に続いて 3 つ目。`Math.round(x * 100)`(整数)と `Math.round(x * 1000) / 10`(小数 1 桁)が混在しており、**同じ「達成率」が画面によって 12% と 12.3% になる**。基盤には `formatPercent(x, 桁)` があるのに使っていなかった。**桁は用途で変えてよい**(予算の消化率は整数・決算の進捗は小数 1 桁)が、**`formatPercent(x, 1)` と書けば意図が読める**——手組みだと「なぜここだけ小数なのか」が分からない。6 画面(予算・決算・部門・FAQ・研修・傾向)を統一し、検査で固定した。**表示の一貫性は、検査していないと必ず崩れる**——同じ形が金額 19 画面・日付 8 画面・率 6 画面で見つかった。

続けて**表示まわりの残り**も洗ったが、いずれも健全だった——**ファイルサイズ・時間**の手組みはほぼ無し(`${hours}時間${mins}分` が 1 箇所だけで、統一の価値は低いと判断)、**エラー処理**は握りつぶし 0 件で全ファイルに `setError` 等の表示口がある、**権限**は画面で判定せず **API 側 66 箇所**で守る設計(画面の出し分けは「見た目の親切」であってセキュリティではない、という切り分けが正しい)、**印刷**は機能自体が無いので `@media print` も不要。

**CSV・Excel・メール**も洗ったが健全だった——CSV は **7 箇所すべてで `bom: true`**(`toCsv` の既定は `false` なので、**指定しないと Excel で日本語が文字化けする**)、CSV インジェクションは `csvEscape` が対応済み、Excel は**数値をそのまま渡して**おり文字列化していない(Excel で計算できる)、メールの件名は**件数と種別のみ**で個人情報を含まない(件名は暗号化されず通知バーにも出る) |
| **`@platform/push` を新設(Web Push・依存ゼロ)** | 通知はメールと Slack で足りることが多いが、**すぐ気づいてほしいもの**には弱い——メールは埋もれ、Slack は業務時間外に見ない。承認待ち・障害・当日の予定変更のように**開いていなくても届く**必要があるものに使う。**`web-push` パッケージを入れない**——これだけで依存が 30 以上増える。要るのは VAPID の署名と本文の暗号化だけで、どちらも **Node の `crypto` で足りる**(P-256 / HKDF / AES-128-GCM)。**3 つの落とし穴を TSDoc と README に明記**: **① VAPID 鍵は変えられない**(変えると**既存の購読がすべて無効**。利用者は「通知が来なくなった」としか分からない)、**② 無効な購読(404 / 410)を消さないと溜まる**(ブラウザを消した・通知を切った場合に返る。**日常的に起きる**ので `gone` を見て消す)、**③ TTL は短すぎても長すぎても困る**(短いと寝ている間の通知が消え、長いと「本日 10 時から会議」が翌日に届く)。テスト 20 項目・smoke 8 項目。パッケージは 118 に |
| **金額の表示が 19 画面で手組みだった(マイナスが `¥-500`)** | `@platform/report` の `formatYen` があるのに、`¥${n.toLocaleString("ja-JP")}` と手で組み立てていた。差が 2 つ: **① マイナスが `¥-500`**(`formatYen` は `-¥500`。**帳簿の慣行は記号の前**)、**② 小数がそのまま出る**(`¥1,234.5`。円に小数は無い)。会計の残高・買掛・キャッシュフローなど**マイナスがありうる画面**で見え方が変わり、**同じ金額が画面によって違って見える**。19 画面(会計・請求・見積・資産・給与・承認・予算・決算…)を `formatYen` に統一し、**手組みが無いことを smoke で固定**した。`accounting` の `yen()` は **0 を「—」にする独自仕様**があったので、その部分だけ残して中身を `formatYen` に委譲(0 が並ぶ表では、どこに数字があるか分からなくなる)。

**日付も同じ形が 8 画面**にあった——`toISOString().slice(0, 10)` も `x.updatedAt.slice(0, 10)` も **UTC の日付**で、**JST の 00:00〜08:59 に前日が出る**。とくに `bookings` は**予約できる日の一覧を生成**しており、**今日を選べず既に過ぎた日が並ぶ**。8 画面を `formatDateJst` に統一し、検査で固定した。**サーバ側で `+ 9 時間` してから切っているものは正しい**(`erasure` / `purchase-orders`)ので対象外。**検査がコメント内の「昔こう書いていた」を拾った**ので、コメント行を除外する処理も足した。

**これで同じ失敗が 3 回目**(`source-text.mjs` 自身・`@throws` の検査・日付の検査)なので、**仕組みの側で直した**——smoke に**独自の `stripComments` が 2 つ**あったのを整理し、JS/TS 向けは `tools/lib/source-text.mjs` に一本化、YAML・Dockerfile も見るものは **`stripCommentsAnyLang`** と名前で用途を分けた(`#` と `REM` を落とす必要がある。**同じ名前だと「共通化し忘れ」に見える**)。`CHECKS.md` の「検査を新しく書くときは」にも節を足した——**「使うな」と書いた瞬間に自分が違反者になる**ので、**検査を書いたら自分の説明文で試す**こと |
| **同時実行まわりを一巡(予約は注記・冪等性は判断して残す)** | Lost Update の次に「**確認してから登録するまでの間**」(TOCTOU)を洗った。**予約の登録**は `hasConflict` で確認してから `push` するが、**今はメモリ上の配列で、確認から登録までが同期処理**なので割り込む余地が無い(Node.js は単一スレッド)。**DB に移すと二重予約が起きる**——`await` を挟んだ瞬間に他のリクエストが走り、**同じ枠を両方が「空いている」と判定する**。`(resourceId, start, end)` の一意制約か `SELECT ... FOR UPDATE` が要ることをコードに注記した(基盤の `isSlotAvailable` にも同じ注意がある)。他の「確認 → 作成」は seed(同時実行されない)か別メソッドが並んでいるだけで、`code` などは**一意制約で守られている**。**冪等性**は `purchase-orders`(発注=外部に影響する)だけが持ち、入金・支払・経費には無い——**画面からの二重送信は `PromptDialog` の `busy` で防いだ**(今回修正)ので、残るのは API を直接叩く場合だけ。社内アプリでは現実的でないと判断して残す。

**注記だけでは気づかれない**ので、**予約が DB に移ったら落ちる検査**を足した——`const bookings: Booking[] = []` と `bookings.push(booking)` が消えたら失敗する。「落ちたら、二重予約の対策が入っているかを確かめてから消すこと」と書いてある。**「今は安全だが、環境が変わると壊れる」ものは、検査で気づけるようにする**のが注記より確実。

続けて **N+1** と**アクセシビリティ**も洗ったが、どちらも健全だった——ループ内の DB 呼び出しに見えたものは**すべて `findMany` がループの前**にあり(集計しているだけ)、ラベルの無い `<input>` に見えたものは**コメント内の記述**だった |
| **同時に入金を記録すると片方が消えていた(Lost Update)** | `recordPayment` が「**読んで足して書く**」形だった——A が 1,000 円、B が 2,000 円を同時に記録すると、**どちらも「残高 0」を読む**ので、後に書いた方だけが残る。**入金が消えるのに誰も気づかない**——請求書は「未入金」のまま残り、**取引先に督促して初めて分かる**。Prisma の **`increment` は DB 側で足す**ので、読み書きの間に割り込まれない。`Promise.all` で同時に走らせて確かめる検査を足した(2026-08)。**7 項目の点検で見つけた欠陥と同じ形**——エラーにならず、後から別の経路で気づく。他に同じ形(`findUnique` → `update` で元の値を足す)が無いことも確認した。

**残高を持つ他のデータも洗った**——在庫は**入出庫の履歴から計算する**設計(残高を持たない)、ポイントも同じ、FAQ の閲覧数は既に `increment`。**FAQ の「役に立った」投票だけが read-modify-write** で残っているが、**そのままにしてある**——票が 1 つ消えても業務は止まらず、「役に立った率」は**見直し対象を選ぶための概算**で足りる(最低 5 票の縛りもある)。**同時投票が現実的に起きる規模になったら `increment` にすること**をコードに注記した。**直すか残すかを判断して、残す方にも理由を書く**——「気づかず放置」と「判断して残す」は別物 |
| **⑤ 空配列の扱い / ⑥ ログの伏せ字(健全) / ⑦ 起動時の検証が 2 つだけ** | **⑤**——`allowedRoles: []` が「全員許可」だった形を探し、**バナーの `paths: []`** で同じものを見つけた。「絞り込みを空にした」と読めるが**逆に全ページへ出る**——出さないつもりで空にすると、**意図しないページにバナーが出る**。型の説明・実装・smoke の 3 箇所に明記した。他の「空なら空を返す」形は自然で問題なし。**⑥**——`@platform/logger` は **`DEFAULT_REDACT_PATHS` が既定で効いており**、`redact` 引数は**追記用**だった。アプリ側が指定していなくても伏せられる。健全。**⑦**——`assertSecretStrength` に **`SESSION_SECRET` と `SECRET_MASTER_KEY` の 2 つだけ**を渡しており、**`ZOHO_CLIENT_SECRET` などの連携の鍵は検証されて**いなかった(`change-me` のまま本番へ出せる)。`process.env` をまるごと渡す形に変えた——`checkSecretStrength` は**名前で秘密を見分ける**(`SECRET` / `TOKEN` / `PASSWORD` / `KEY` を含むもの)ので選ぶ必要がなく、**未設定のものは無視される**(任意の連携は設定しないことがある) |
| **④ 給与の内訳と総支給が 1 円合わなかった** | `calcPay` が **`total` を丸める前の値から**計算しており、内訳(基本給・残業・深夜・休日)を個別に丸めた合計と**一致しないことがあった**——時給 990 円・残業 13 分で再現(内訳計 8,028 / total 8,027)。**給与明細は内訳を足すと総支給になるのが当然**なので、合わないと「計算が違う」と問い合わせが来る——**説明もできない**。**丸めてから足す**形に直した(明細に載るのは丸めた値なので、そちらを正とする。逆にすると**どの項目に端数を寄せるか**という別の判断が要る)。3,005 通りで確認する検査を足した。金額系の他のパッケージ(`tax` / `invoice` / `commerce` / `currency` / `depreciation`)も見たが、**丸め方の混在は用途によるもので健全**——消費税は事業者が選べるよう `rounding` 引数を持ち、**負数の扱いも正しい**(`Math.round(-2.5)` が -2 になる罠を避けている)、源泉徴収・減価償却・ポイントは切り捨て固定 |
| **③ 削除の確認が 11 箇所で無かった(`useConfirm` を新設・`check-delete-confirm` 69 本目)** | 画面からの削除 13 箇所のうち **11 箇所が確認なし**——押した瞬間に消えていた。一覧に並んだ「削除」は**隣の行を消すつもりで押し間違える**もので、後から次の形で分かる: お知らせを消した → **誰も気づかないまま公開が止まっていた**、予約を消した → **来店した人が現れた**、添付を消した → **証憑が無くなり経費が通らない**。個別に `ConfirmDialog` を書くと**書き忘れる**(書き忘れても動くのでレビューでも気づかない)ので、**1 行で使える `useConfirm`** を作った。`window.confirm` を使わないのは、**アプリの外に見える**・**タブ全体が固まる**・**1 行しか書けず「何が起きるか」を伝えられない**ため。**元に戻せない 2 件**(お知らせ・ファイル)を先に直し、残りは上限方式(開発用の `debug` や再取り込みできる用語集・テーマは実害が小さい)。**説明文は「元に戻せません」だけにしない**——「公開中なら、すぐにサイトから消えます」のように**押した後の世界**が想像できる文にする |
| **① 二重送信の他の経路(Enter 連打)/ ② 全件取得の上限** | **①**——`PromptDialog` の Enter が守られていなかった。ボタンは `loading` で無効になるが、**Enter は入力欄から呼ばれる**ので効かない。反応が無いと思って連打すると、**入金や支払が二重に計上される**——`invoices` / `payables` / `purchase-orders` の金額確定がこの経路にある。`if (busy) return;` を足した。`ConfirmDialog` は押すと閉じるので実害は低く、`autocomplete` / `search-input` / `tag-input` は検索が 2 回走るだけなので触らない。**②**——外部連携の全件取得を洗った。`slack` / `microsoft` は**一覧を取る関数が無い**(送信・単体取得のみ)ので問題なし、`notion`(`next_cursor`)と `google`(`nextPageToken`)は扱えている。**`freee` の `fetchAllPages` が上限 50 ページで黙って打ち切って**いた——**5,001 件目から静かに落ち**、受け取った側は「これで全部」と思う。月次の仕訳や取引先の同期で**一部だけ取り込まれた状態**になる。上限に達したら `AppError(EXTERNAL)` で知らせるようにした(Zoho の `listAll` と同じ判断) |
| **ファイル選択が処理中に無効化されていない 6 箇所(`check-file-input-disabled` を新設・68 本目)** | `<FileInput>` に `disabled` を渡しておらず、**アップロード中でももう一度選べた**。押した本人は「反応が無い」と思って選び直すので、**同じファイルが二重に上がる**——用語集の CSV なら**同じ用語が重複登録**、テーマの JSON なら**同じテーマが二重に増える**。どれも**エラーにならない**ので、後から「なぜ 2 件あるのか」を調べることになる。**ボタンの二重送信は `useSubmit` が防ぐが、ファイル選択は経路が違う**(`<input type="file">` の `change`)ので別に守る必要がある。2 箇所は**状態そのものが無かった**ので `importing` を足し、`finally` で必ず戻すようにした(**失敗したまま `true` だと二度と取り込めない**)。`showcase` は見本(業務データを扱わない)ので対象外 |
| **利用者向けの文言とエラーの漏れを確認(健全)** | 残債が判断済みになったので、まだ見ていない観点を洗った。**利用者に見せる文言**は概ね揃っており、重複も少ない(「完了済みのワークフローは操作できません」が 3 箇所など、同じ場面で同じ文言)。**エラーに内部情報が漏れていないか**も確認——`AppError` に例外のメッセージをそのまま埋めている箇所が 2 件あったが、どちらも `os-notify`(サーバ内部のデスクトップ通知)で**利用者には見えない**。`toErrorEnvelope` が「AppError 以外は丸める」ことは smoke で既に検査済み(**エンベロープは内部詳細を漏らさない**)。**残る PENDING は実行環境が要るもの**——復元訓練(Docker)、契約テストの実応答記録(外部 API の認証情報)、`zoho-session` の差し替え(全員ログアウトを伴うので時間帯の判断) |
| **`zoho-session` の暗号化移行(手順 2 まで完了・残るは差し替えのみ)** | 唯一残る残債「基盤を使わず自作 1 件」の中身。**今も HMAC 署名だけ**で、**クッキーを見れば email と roles が読める**(改ざんはできないが隠れていない)。手順は `apps/internal-app/src/server/zoho-session.ts` の冒頭にあるが、**コード内だけだと探せない**のでここにも書く: **① `currentUser(request)` へ寄せる** … 2026-08 完了(249 か所。形式を変えないので単独で出せた)。**② `SESSION_SALT` を環境変数に足す** … **2026-08 完了**(`.env.example` に追加し、`check-env-example` の `ALLOW_UNUSED` に理由付きで登録)。**③ 中身を `createSession` に差し替える** … **未実施**。**差し替えた瞬間に全員がログアウト**するので、**出す時間帯を決めてから**。環境ごとに別の塩にすること——同じ塩だと**検証環境のクッキーが本番でも通る** |
| **`line-console` に `guardWrite` の独自実装が残っていた** | 2026-08 に基盤(`@platform/guard`)へ移したはずが、**`line-console` 側は独自実装のまま**だった——`crud-template` だけを直していた。本文サイズ・CSRF(Origin 確認)・レート制限の 3 つは**どれも書き忘れても動いてしまう**ので、片方だけ直すと**そちらだけ弱いまま**になる。委譲に変え、**基盤への委譲ラッパー**として ALLOW に登録した(`hashPassword` と同じ形)。残債「基盤と同名の再実装」は **2 → 0 件**に(残っていた `AuthProvider` は**偶然の同名**——アプリ側は React のコンテキスト提供者、基盤側は**ログイン方法の型**(`"zoho" | "google" | ...`)で用途が全く違うため ALLOW に登録)。あわせて他の資料も片方向でないか確認した——`.env.example` の未使用変数は 0 件、`check-docs-orphans` は逆方向(辿り着けるか)を見ており健全。**このセッションで基盤化したもの**(`useSubmit` / `usePageview` / `ContactForm` / `currentSession` / `escapeXml` / `canonicalJson`)も取りこぼしが無いことを確認した。**残る残債はすべて判断済み**——「基盤を使わず自作 1 件」は `zoho-session` の暗号化移行待ち(4 段階の手順が HANDOVER にある)、600 行超 8 件と 200 文字超 1,370 件は分割不要と判断済み、引数名の違い 223 件は上限方式 |
| **`COMMANDS.md` にも同じずれ(29 件が未掲載)** | `CHECKS.md` と同じ形を探したところ、**`package.json` の 76 コマンドのうち 29 件が資料に載っていなかった**——`check-doc-commands` は「**書いてあるのに動かない**」だけを見ており、**「動くのに載っていない」は素通り**していた。載っていないコマンドは**使えることを知る手段が無く、同じものを作ってしまう**(実際 `advisor find` で起きた)。**探す・作る / ビルドの使い分け / 個別のアプリ**の 3 節を追記し、**逆方向も検査**するようにした(2026-08)。内部用(turbo の内部呼び出し・`postinstall`・別名)は `INTERNAL_ONLY` に明示して除外——**除外するなら理由を書く**という形は `check-unguarded-json-parse` と同じ |
| **`CHECKS.md` の一覧が 20 件古かった(数値だけ見張っていた)** | 「**依存をインストールせずに 103 種類の検査**」という**数値は検査していた**が、**一覧の行数**は見ていなかった——その結果、**67 種類あると書きながら一覧は 48 件**という状態が続いていた。載っていない検査は**存在を知る手段が無く**、同じものを作りかけることになる(実際このセッションで `advisor find` を作りかけた)。20 件を追記し(`check-returns-mismatch` / `check-unguarded-json-parse` を含む)、**表の行数そのものを `check-doc-numbers` が数える**ようにした(2026-08)。あわせて**分野ごとの目次**を付けた——動作 / 構造 / 説明と実装 / 日本語 / 時刻 / セキュリティ / 壊れ方 / 重複 / **検査自身** / 資料。「検査自身」の分野があるのは、**検査が壊れていても緑になる**ことを何度も経験したため |
| **`@param` が実装と違う 3 件目・4 件目(引数の順序が逆・存在しないオプション)** | `selectVariant` / `canRollbackWith` に続いて、「名前だけの違い」45 件を洗って 2 件見つけた。**① `verifyBackupCode`** … 説明は `(records, input, secret)` だが実装は **`(code, records, secret)`**——**説明どおりに呼ぶとコードと記録が逆**になり、バックアップコードの検証が常に失敗する。**② `deepDiffChanges`** … 「`options.redact` で値を伏せる」と説明していたが、**この関数は伏せる仕組みを持たない**(第 3 引数は再帰用の `prefix`)。パスワードを含むオブジェクトを渡すと**監査ログに平文で残る**。伏せたいなら `diffChanges`(配列形式・`redact` あり)を使うか、**記録する側で先に取り除く**——表示のときに初めて伏せることはできない。利用箇所(`audit-log.ts`)にも注意を書いた。45 → 41 件に。

さらに 2 件——**③ `isWithinRetention`**(電子帳簿保存法の保存期限)は説明が `(record, asOf)` だが実装は **`(startDate, years)`**。**レコードを渡しても動かない**うえ、保存年数を渡す引数があることが説明から分からない(法人税法では原則 7 年、欠損金があれば 10 年で、**渡し分けないと期限を誤る**)。**④ `validateAttachments`** は `options.maxTotalBytes` と書いてあったが、型の項目名は **`maxSizeBytes`**——**渡しても無視され、サイズの制限が効かない**。後者は名前を `limits` に直したことで **P4(存在しないプロパティ)として検出**された。**1 つ直すと次が見える**形で、P4 も 0 件・上限 0 になった。

続けて 3 件——**⑤ `stickyLeftOffsets`**(説明は `(columns, index)` だが実装は `(widths, stickyCount)`。**戻り値も 1 つの値ではなく配列**)、**⑥ `createMemoryWebhookStore`**(説明は `seed`(初期データ)だが実装は **`ttlMs`**。**配列を渡すつもりで数値の位置に入れると TTL が壊れ、同じ通知を二重に処理**する)、**⑦ `isAnnouncementActive`**(説明は `context.path` だが実装は**文字列の位置引数**。`{ path }` を渡すと**対象ページの判定が常に外れる**)。45 → 38 件に。**「名前だけの違い」という軽い分類の中に、呼ぶと動かないものが 7 件**あった——分類名が実態を表していない |
| **「省略しても動くが、省略すると事故」な引数を洗った** | `flags` の `flagName` と同じ形——**既定値があるので省略でき、エラーも出ないが、省略すると壊れる**引数を探した(空文字が既定の引数 15 件)。危ないのは 2 つ: **① `hashOtpCode(identifier)`** … 省略すると**全員のハッシュが同じ鍵で作られる**——攻撃者が自分宛の `123456` のハッシュを手に入れれば、**他人の challenge にも通る**。**② `selectVariant(flagName)`** … 省略すると**すべての A/B テストで同じ人が同じ側に入る**ため、**同じ集団の結果ばかり見る**ことになり判断を誤る。どちらも基盤の内部では正しく渡しており、**直接呼ぶ場合だけ危ない**。TSDoc に明記した。`selectVariant` は**`@param` が実装と全く違って**もいた(`variants` / `key` と書いてあるが実装は `rule` / `context` / `flagName`)——**説明を読んで呼ぶと動かない**。

続けて**省略できるセキュリティ引数**(10 件)も洗った。危ないのは **`canRollbackWith(allowedRoles?)`** の 1 件——**省略すると誰でも取り込みを巻き戻せる**。巻き戻しは取り込んだデータを消す破壊的操作なので、**省略は「全員に許す」という明示的な選択**として使うべきもの。**空配列も同じ扱い**(「誰も許さない」ではない)。落とし穴を smoke で固定し、TSDoc にも明記した。ここも `@param` が実装と全く違っていた(`history` / `options.maxAgeMs` と書いてあるが実装は `status` / `actorRoles` / `allowedRoles`)。**`verifyTwoFactor(secret?)` は健全**——`secret` が無ければ認証を通さない(安全側に倒れる) |
| **段階公開(`@platform/flags`)の分布を検査していなかった** | 「100% と 0%」は検査していたが、**その間が効いているか**は見ていなかった——`rolloutPercent: 10` のつもりが全員に出ると、**不具合のある新機能が一気に広がる**(段階公開はそれを防ぐ仕組みなので、効いていないと意味がない)。実際に 1,000 人分を判定して確かめる検査を足した(2026-08)。**10% → 97 人、50% → 510 人**で正しく動いていた。あわせて **同じ人は毎回同じ結果**(でないと画面を開くたびに機能が出たり消えたりする)と、**フラグごとに別の集団**(でないと「いつも同じ人が実験台」になる)も確認するようにした。あわせて**引数の名前が分かりにくい**問題も直した——私自身が **3 回続けて誤った呼び方**をした:

| 正しい | 間違えやすい | 間違えるとどうなるか |
|---|---|---|
| `rolloutPercent` | `rollout` | **割合が効かず全員に出る** |
| `context.key` | `context.userId` | **誰も選ばれない**(0% になる) |
| 第 3 引数 `flagName` | 省略 | **すべてのフラグで同じ集団**が選ばれる |

とくに 3 つ目が見つけにくい——**省略しても動く**ので気づかないが、「いつも同じ人が実験台」になり、その人たちだけが未検証の機能を次々に踏む。TSDoc と README に明記し、**落とし穴そのものを smoke で固定**した(「省略すると同じ集団になる」ことを検査で示す)。**`createFlags` はフラグ名を自動で渡す**ので、そちらを使えば踏まない。

なお `@returns` / `@throws` の食い違いは**両方 0 件・上限 0**、既定値の記述と実装、README の import も検査済みで、**説明まわりは一巡した** |
| **承認されていない見積から請求書が作れた** | `convertToInvoice` の説明には「**承認されていない見積を変換しようとした場合は例外**」と書いてあったが、**実装は状態を見ていなかった**——却下された見積・下書きからも請求書が作れる。**承認していない金額で請求書を出す**のは、取引先との認識違いに直結する。`@throws` の食い違いを 1 件ずつ確かめる作業で見つかった(2026-08)。**説明どおりに実装した**——`state` が `accepted` でなければ `AppError(VALIDATION)`。**`state` を持たない見積は通す**(古いデータ・状態を管理しない運用のため)。あわせて `quote-repo` の順序も直した——**変換してから `accepted` にして**おり、承認前の状態で請求書を作っていた。業務としても「受注が確定してから請求」が正しい |
| **`@returns` の説明と実装が食い違う 5 件(`check-returns-mismatch` を新設・67 本目)** | `maskEmail` で「説明と実装の食い違い」が実害になったので、**同じ形を機械で探した**。「無ければ `undefined`」と書いてあるのに **`null` を返す**関数が 5 件——`toWareki` / `rangeIntersection` / `parseTraceparent` / `getParam` / `currentStep`。**呼び出し側の `=== undefined` が常に false** になり、そのまま `null.era` で落ちる。型検査は `\| null` を見て気づくが、**説明を読んで書いた人**は `undefined` で判定する——**型注釈より説明を信じる**のが人の自然な読み方で、そこがずれていると事故になる。**説明を実装に合わせた**(実装を変えると呼び出し側が壊れる)。検査を新設して 0 件を保つ。

**同じ検査に `@throws` の食い違いも足した**——「例外を投げる」と書いてあるのに **`null` を返す**関数が 13 件あった。`@returns` の食い違いより危ない: `try { const sum = sumMoney(items); save(sum.amount); } catch { …通貨混在の処理… }` と書いても、**`catch` に来ないまま `null.amount` で落ちる**。確認できた 3 件(`addMoney` / `sumMoney` / `parseDate`)を直した。さらに 1 件ずつ確かめて **13 → 3 件**まで減らした:

- **`reject()` も例外と同じ**なのに `throw` だけを探していた——`withTimeout` は `reject(new Error(...))` を使う。検出条件に足した
- **`chat` の 3 件は Result 形式**(`{ ok: false, error }` を返す)。説明が誤り
- **`resolveHierarchy` は説明の中で矛盾**——「循環は安全に無視」と書いた 14 行下に「循環している場合は例外」とあった。実装は `return []`。`try/catch` で待ち構えると、**循環したまま権限が空になった状態で動き続ける**(「なぜか権限が無い」という形で現れ、原因の特定が難しい)

**説明文に `@throws` という文字列を書くと、検査自身が拾ってしまう**のも分かった(`tools/lib/source-text.mjs` の教訓と同じ形——**ソースを解析するツールの説明文は、そのツール自身の入力になる**)。

最後の 3 件も潰して **0 件・上限 0** にした:

- **`applyMovement`** … Result 形式(`{ ok, movements }`)。**`ok` を見ずに `movements` だけ使うと、出庫できていないのに成功したことになる**
- **`createWebhookChannel`** … `throw new Error(...)` で、説明の「AppError を投げる」と食い違い。動きは変わらない(どちらも再試行される)が、**コードと traceId が付かず障害調査でログと突き合わせられない**ので `AppError(EXTERNAL)` に直した
- **`createDiscordChannel`** … 説明は「(`send` 実行時)」と**正しく書いてあり、検査の側が誤り**だった。返した関数の中で投げる形を対象外にした |
| **`maskPhone` も何も隠していなかった(`maskEmail` と同じ形)** | 「下 n 桁だけ残す」仕様だが、**残す桁数以下の入力をそのまま返して**いた——`"123"` が `"123"` になり、**マスクする関数が何も隠さない**。日本の電話番号は**最短 10 桁**なので 4 桁以下は不正な値で、**内線番号や打ち間違いが画面やログに出る**。`@platform/pii` は正しく全部伏せており、そちらに揃えた(2026-08)。あわせて `unescapeHtml`(html / utils)の一致と、**エスケープ↔解除の往復**も smoke で確認するようにした——**片方だけ `&amp;lt;` を二重に戻すと `<` が復活してタグとして解釈される**。ALLOW 12 件のうち**一致を見張る形にしたのは 6 件**(`escapeXml` / `canonicalJson` / 法人番号 / `escapeHtml` / `unescapeHtml` / `maskEmail` / `maskPhone`)。**比べる作業で 2 件の欠陥が見つかった**——登録して終わりにしていたら、どちらも気づけなかった。

同じ形の欠陥が他のマスク関数に無いかも確認した——**`maskMyNumber`(マイナンバー)は全桁を伏せ**(番号法の要請。下 4 桁も見せない)、`maskIdentityNumber` は下 4 桁を残し、**どちらも短い入力を伏せる**ので健全だった。`maskName` が `"山"` を `"山***"` にするのは「先頭 1 文字を残す」仕様どおりで、`maskEmail` の `a@b.jp` → `a***@b.jp` と同じ。短い入力を伏せることを smoke でも確かめるようにした |
| **`maskEmail` の説明と実装が食い違っていた(個人情報が漏れる)** | 説明には**「@ が無ければ全体をマスク(不正な形式でも漏らさない)」**と書いてあったが、実装は部分マスクで、`壊れた文字列` が **`壊****列`** になっていた——**先頭と末尾が残る**。個人情報を扱う人が「全体を伏せてくれる」と信じて使うと漏れる。`@platform/pii` は正しく `***` を返しており、**そちらに揃えた**(2026-08)。ALLOW の重複を「一致を見張る」形に移す作業で見つかった——**比べようとして初めて、片方が説明どおりでないと分かった**。あわせて `escapeHtml`(html / utils)の一致も smoke で確認するようにした(**食い違うと片方の経路だけ XSS を許す**) |
| **複製した実装の「一致」を smoke で見張るようにした** | `escapeXml`(xml / feed)と `canonicalJson`(json / dencho)は、**依存ゼロを保つため意図的に複製**している(smoke が単体で読み込むので外部 import を足せない)。ALLOW に載せて済ませていたが、**片方だけ直すと静かに食い違う**——`canonicalJson` が食い違うと、**電子帳簿保存法のハッシュチェーンが記録時と検証時で別の文字列**になり、**全件が改ざん扱い**になる。`escapeXml` なら**同じ記事が RSS と XML で別の文字列**になる。**同じ入力で同じ出力になること**を smoke で確認するようにした(2026-08)。`check-risky-duplicates` が示す 3 つの選択肢——①統合 ②一致を見張る ③差を明記——のうち、**②を実際に使った初めての例**。

同じ観点で **`isValidCorporateNumber`(法人番号)** も確認した——`tax` と `validation` の 2 箇所にあり、**食い違うと片方で通った法人番号がもう片方で弾かれる**(登録できたのに請求書が出せない)。計算式(`9 - (sum % 9)`)と桁数の要求が同じであることを smoke で確認するようにした。**`tax/src/index.ts` は拡張子なしで他を import している**ため単体では読めず、**静的検査**にしてある。残る ALLOW(`maskEmail` / `maskPhone` / `escapeHtml` など)も同じ形で見張れるが、**読み込みの都合で個別に工夫が要る**ので、触るときに足すこと |
| **HTML エスケープが 5 箇所でバラバラだった** | `@platform/xml` を作った流れで既存を洗ったところ、変換する文字が**実装ごとに違って**いた——`html/escapeAttribute`(`&` `"` `<`)、`payroll/esc`(`&` `<` `>`)、`seo`(4 文字)、`invoice/esc`(**3 文字**)。**用途が違うので、それぞれ正しい**(属性用は `>` が不要、要素用は `"` が不要)——`formatBytes` のときと同じで、**揃えるのが正解とは限らない**。ただし**取り違えると事故になる**: 要素用を属性に使うと `title="${esc(x)}"` に `" onmouseover="alert(1)` を渡されて**属性を抜けて JavaScript が動く**。**用途を TSDoc に明記**し、`invoice/esc` は属性でも使えるよう **5 文字に統一**した(現状は属性に使っていないが、**次に誰かが使ったときに事故になる**)。実際の誤用は無く、`feed/escapeXml` は 5 文字なので属性でも安全 |
| **守られていない `JSON.parse` を 5 件修正し、検査を新設(66 本目)** | `@platform/json` を作ったので、**既存の危険な箇所**を洗った。`JSON.parse` は**不正な入力で必ず例外**を投げるので、外部から来る文字列で呼ぶと**経路が 500 を返す**——相手が Webhook の送信元なら、**同じボディを何度も送り直してくる**(壊れたものは何度送っても壊れているので止まらない)。直したもの: **① `parseFreeeWebhook`**(**説明には「解析できなければ空配列」と書いてあった**のに例外を投げていた)、**② `cache.get`**(`tryCatch` が取得だけを守り、パースは外。Redis の値は手で書き換えられる)、**③ 冪等キーの記録**(**二重実行を防ぐ仕組みが、実行を止める側に回っていた**)、**④ `decodeClientData`**(ブラウザから来る値。細工されると 500)、**⑤ 通知のメール変換**(`send` の失敗は Outbox が再試行する契約なので、**壊れたものを永久に送り続ける**。`AppError(VALIDATION)` にして止めた)。検査 `check-unguarded-json-parse` を新設したが、**上限ファイルを増やさず 0 件にした**——`showcase`(見本)を対象外にし、**落ちてよい 3 箇所を理由付きで除外**した(設定ファイルは起動時に落ちる方がよい、DB の JSON 列は自分が書いた値) |
| **XML と JSON の基盤を新設(`@platform/xml` / `@platform/json`)** | **業務では XML がまだ現役**(電子申告・EDI・SOAP・官公庁の様式)なのに、汎用の生成・解析が無く `escapeXml` だけだった。JSON も**標準の関数がそのままだと落ちる**——`JSON.parse` は不正な入力で必ず例外、`JSON.stringify` は**循環参照・BigInt で `TypeError`**(ログ出力で最も多い)、**`undefined` はキーごと消える**(落ちないが項目が黙って欠ける)。各所で try/catch を書き直していたのでまとめた(2026-08)。**XML の要点**——値を自動でエスケープ(取引先名の `&` でファイル全体が読めなくなる)、**日本語のタグ名に対応**(官公庁の様式は `<請求書>` を使う。当初 `\w` で書いて解析できなかった)、**閉じタグが合わなければ例外**(黙って部分的な結果を返すと、申告データが途中で切れていても気づけない)。**JSON の要点**——`canonicalJson`(キーの順序でハッシュが変わると**改ざんと誤判定**する)、`parseWithLimit`(**数百 MB の JSON でサービスが止まる**。バイト数で数える——日本語は 1 文字 3 バイト)、`redactJson`(**ログの閲覧権限がある全員に漏れる**)、`parseJsonLines`(**壊れた行を飛ばして番号を返す**——例外にすると 1 行のせいで全部失われ、黙って飛ばすと欠けたことに気づけない)。テスト 45 項目・smoke 11 項目。パッケージは 117 に |
| **RSS / Atom / sitemap を `@platform/feed` に一元化** | `@platform/blog` と `@platform/seo` が**別々に持っており**、**エスケープの関数が違う**(`escapeXml` / `escapeAttr`)、**`lastmod` の扱いが違う**(日付だけに切る / そのまま)、**Atom は seo 側にしか無い**という差があった。新パッケージにまとめ、両方から委譲する形にした(2026-08)。**`blog` は項目名だけ詰め替える**(`publishedAt` → `published`、`guid` → `id`)——既存の利用側を壊さないため。**XML は文字列連結で作るのでエスケープが命綱**——記事タイトルの `&` ひとつで**フィード全体が読めなくなり、購読者全員に何も届かない**。基盤側は**すべての値をエスケープしてから**組み立てる。日付は **RSS が RFC 822、Atom が ISO 8601、sitemap が日付だけ**と 3 者とも違うので、渡された ISO 8601 から自動で変換する。テスト 15 項目・smoke 2 項目を追加。パッケージは 115 に。**`public-site` は `@platform/feed` から直接**取るよう変えた——再公開の経由でも動くが、**新しく書く人が `seo` を見に行ってしまう**。`showcase` は `blog` のデモなのでそのまま |
| **同名関数の「違いを説明していない」が 55 件** | `formatBytes` の件(揃えようとして誤った)を受けて、**複数パッケージにある同名関数 56 件**を洗ったところ、**違いを説明しているのは 1 件だけ**だった。説明が無いと、**次に見た人も「重複だ」と思って揃えようとする**。`blog` と `seo` の `buildSitemap` / `buildRssFeed` に相互参照を書いた(2026-08)——`buildSitemap` は **`lastmod` の扱いが違う**(blog は日付だけに切る / seo はそのまま)。**sitemap.org の仕様ではどちらも妥当**だが、**同じサイトで両方使うと不揃い**になる。残りは**触るときに書く**——一度に書くと、仕様の違いを読まずに埋めることになる |
| **`formatBytes` が 2 つあった(揃えようとして誤った)** | `@platform/utils` と `@platform/ui` の両方にあり、`1024` が **`1 KB`** と **`1.0 KB`** に分かれていた。「揃えるべき」と考えて `ui` を `utils` に寄せたところ、**既存の検査が 3 件落ちた**——`ui` 版は**負値と `NaN` を `"-"`**(ファイルサイズが負になることは無いので「不明」と分かる方がよい)、**上限は TB**(PB は画面で読めない)、**B は小数を付けない**(`500.0 B` は意味が無い)、**KB 以上は桁を落とさない**(一覧で小数点の位置が揃う)という**画面向けの仕様**だった。**どちらも正しく、揃える必要は無かった**。違いを明記して元に戻した(2026-08)。**「重複=悪」と決めつけず、まず仕様の違いを読むこと**——検査が私の早合点を止めた |
| **MCP のツールが件数を絞っていなかった** | `partner_list`(取引先)は**全件**、`zoho_search_records` は **Zoho の既定 200 件/ページ**をそのまま返していた。**AI のコンテキストを埋め尽くす**——1 件 500 文字 × 200 件なら 10 万文字で、**会話の履歴や指示が押し出される**(AI が「何を聞かれていたか」を見失う)。取引先は 50 件、Zoho は 20 件に絞った(2026-08)。**切り詰めたことを `note` で伝える**のが要点——黙って切ると**「これで全部」と思われる**。`invoice_list` と `audit_recent` には既に上限があった。**権限まわりは健全**——書き込みツールは **`MCP_ENABLE_WRITES=1` のときだけ有効**(既定は読み取り専用)で、`MCP_API_KEY_SCOPES` でさらに絞れる |
| **残債「引数名だけの違い 246 件」を 2 種類に分けた** | 一緒に数えていると「246 件もある」で終わり、**どちらを直せばよいか分からない**。中身を見ると**重さがまるで違った**——**① 説明が抜けている(205 件)** … 引数があるのに `@param` が無い。**使い方が分からない**ので、注入が必須の引数だと実際に困る。**② 名前だけの違い(41 件)** … `opts` と `options` のような揺れで実害は小さい。検査の出力を分け、①を先に直すよう案内した(2026-08)。**`now`(時刻の注入)の説明漏れを 13 件まとめて追加**した——渡せることを知らないと**テストが書けず**、`new Date()` のまま動いて TZ 依存の温床になる。この作業で **`@param options.now` と書いてあるのに実装は `now` を直接受け取る**という食い違いが 3 件見つかり(P2 として顕在化)、余分な説明を削除した。実際に **`verifyChain` / `appendAll` の `hashFn`**(監査ログのハッシュ。**既定の FNV-1a では約 6.5 万回で衝突**する)と `referrerBreakdown` の `limit` を書き足し、**205 → 192 件**に。上限も 246 → 238 に下げた |
| **孤立パッケージの誤検出を消した(1 → 0 件)** | `advisor` が `@platform/config` を「public export なし」と指摘し続けていたが、**これは設定を配るだけのパッケージ**(`tsconfig.base.json` と vitest のプリセット)で、**TypeScript の export が無いのが正常**。毎回出ると**本当の孤立に気づけなくなる**ので除外した(2026-08)。あわせて `cms:Announcement` と `site:Announcement` の類似も確認したが、**cms 側に「型と表示判定は `@platform/site` 側」と明記**されており役割分担が正しかった |
| **`advisor dup` の 96 組を見る観点(2026-08)** | 同名の export は **96 組**あるが、**同名だから問題なのではなく、挙動が違うと問題**。確認した範囲では——`timeToMinutes`(**挙動が違った**→ 修正済み)、`diffChanges`(返り値の形は違うが `ignore` / `redact` とも揃っており健全)、`parseAddress`(カンマ・引用符も正しく扱う)、`summarize`(5 パッケージあるが**それぞれ別の集計**)、`Session`(型の名前が同じだけ)。**「重複を消す」より「片方が弱くないかを見る」**方が実りがある。`check-risky-duplicates` が見張っているのは**壊れると実害がある同名関数**で、この観点に沿っている |
| **予約の時刻解析が不正な入力で二重予約を許していた** | `advisor dup` で `booking:timeToMinutes` と `payroll:parseTimeToMinutes` の重複を見つけ、**挙動が大きく違う**と分かった。`booking` は `"abc"` で **`NaN`**、`""` で **`0`**、`"09:70"` で **610(= 10:10)** を返していた(`payroll` は例外)。**`NaN` との比較はすべて `false`** になるので、`intervalsOverlap` が「重なっていない」と判定し——**二重予約が通る**。空文字は 00:00 扱いで**深夜の予約が取れる**。`payroll` に揃えて例外を投げる形にした(2026-08)。**分は 0〜59 に限る**——`09:70` を通すと**設定の打ち間違いが別の時刻として動く**。渡すのは設定値(営業時間)なので、**不正なら早く気づく方がよい** |
| **`advisor find` に関数単位の検索を追加** | 120 パッケージ・**公開されている名前 3,828 件**あると、**自分が作ったものすら把握できない**——実際 2026-08 に、既に `createAuthSession` があるのに同じものを 2 回作り直した。**ここでも新しいツールを作りかけて、`advisor find` が既にあることに気づいた**(**同じ誤りの 3 回目**)。既存は**パッケージ単位**で粒度が粗く、「二重送信」のような**やりたいこと**では当たらないので、**関数・型の名前と説明も探す**ように統合した。**日本語の説明でも当たる**(「二重送信」で `useSubmitFlow` / `SubmitButton` が出る)。実際にこれで**`useSubmit` も既存と近いもの**があると分かった——`@platform/form` の `useSubmitFlow`(入力 → 確認 → 完了の 3 段)は用途が違うので残したが、**相互参照を書いた**(「確認画面を挟まないなら `useSubmit`、挟むなら `useSubmitFlow`」)。**新しく作る前に必ずこれで探すこと** |
| **パスワードログインと SSO を同じセッションで扱う** | 「別管理にすべきか」を検討し、**統一が正しい**と判断した(2026-08)。**分けると画面ごとに「どちらのセッションを見るか」の判断が要る**ようになり、必ずどこかで漏れる——見落とした画面は**ログインしていない扱い**になるか、逆に**片方だけで通ってしまう**。ログアウトも 2 種類になる。**認可(`requirePermission`)はログイン方法を見ない**——「誰が何をできるか」だけで決まる。ただし**区別が要る場面はある**(SSO 必須の操作・監査ログ・パスワード再設定の案内)ので、`provider` に `"password"` を足し、`isSsoLogin()` で判定できるようにした。**これだけで権限を決めない**——認可は `requirePermission` で見て、SSO は**追加の条件**として使う。なお `internal-app` は既にパスワードログインも `zoho-session` を使っており、**実態としては統一済み**だった |
| **OAuth に PKCE が無かった(`createOAuthChallenge`)** | Zoho・Google・Microsoft のどれも **PKCE に対応していなかった**——`state` は各アプリが自前で作っていたが、PKCE は**そもそも無い**。**無くても認可は通る**ので、書き忘れても気づけない。認可コードを盗まれると**そのままトークンに交換される**——リダイレクト URL は**プロキシ・CDN・ブラウザ履歴に残り**、`Referer` で外部サイトに漏れることもある。**OAuth 2.1 では必須**で、3 社とも対応済み。`@platform/session` に `createOAuthChallenge`(S256)と `verifyOAuthState`(**時間一定で比較**)を置き、`buildGoogleAuthUrl` / `buildMicrosoftAuthUrl` が受け取れるようにした(2026-08)。**空どうしを通さない**のも要点——クッキーが消えていたときに「空 === 空」で素通りする |
| **SSO のセッションを共通化(`createAuthSession`)** | Zoho で `createZohoSession` を作った直後に、**Google と Microsoft も同じ構造**(OAuth はあるがセッション発行が無い)だった。3 つで複製すると**暗号化を忘れる・有効期限を間違える・クッキー属性が抜ける**という差が出て、**弱い方が一つでもあればそこが入口になる**。`@platform/session` に共通の `createSsoSession` を置いた(2026-08)。**`subject`(恒久 ID)を必須**にしたのが要点——**メールで人を紐づけない**。姓の変更・部署異動で変わるし、**退職者のアドレスが再利用される**と別人が入る。**`tenant`(組織の識別子)**も持たせた——メールの `@` 以降で判定すると**同じドメインの個人アカウント**を弾けない。**作ったばかりの `createZohoSession` は削除**して一本化した。

**さらに、私が作った `createSsoSession` 自体が重複だった**——`@platform/session` には**既に `createAuthSession` があり**、`provider` に `"local"`(パスワードログイン)まで含む同じ設計だった。**既存を探さずに作った**のが原因で、`sso.ts` は削除して既存へ寄せた。足せたのは `isExternalLogin()`(SSO かパスワードかの判定)だけ。**新しく作る前に、同じものが無いかを先に探すこと** |
| **Microsoft に本人情報の取得が無かった(`getMicrosoftUserInfo`)** | Google には `getGoogleUserInfo` があるのに、**Microsoft には無かった**——ログインさせても「誰か」が取れない。Graph の `/me` を叩く関数を追加。**`mail` が `null` のことがある**(ライセンス無しのアカウント)ので `userPrincipalName` で補う。**`common` エンドポイントを使うと他社のアカウントでもログインできる**ため、**テナントの確認が必須**であることを明記した——確認しないと**誰でも入れる** |
| **外部ログインのセッションを共通化(`createAuthSession`)** | Zoho 用に作った `createZohoSession` と同じものが **Google / Microsoft でも要る**——どこでログインしても**クッキーに載せる形は同じ**(誰か・どこの誰か・何ができるか)。プロバイダごとに作ると**片方だけ暗号化を忘れる**、**有効期限の扱いが違う**といった差が出るので、`@platform/session` に共通版を置き、`createZohoSession` は委譲に変えた(2026-08)。**`subject`(恒久 ID)を必須**にしたのが要点——Google の `sub`・Microsoft の `id`・Zoho の `zuid`。**メールで紐づけない**のは、メールが変わるうえ**前の持ち主のアドレスが再利用される**ため(退職者のアドレスを新入社員に割り当てると**記録が繋がる**)。`domain`(Google の `hd`)も持たせた——**見ないと個人の Gmail で社内システムに入れる** |
| **基盤に足した機能が README に載っていなかった** | このセッションで `guardWrite` / `currentSession` / `useSubmit` / `ContactForm` / `usePageview` / `createZohoSession` / `getAllRecords` / `listAll` を足したが、**README に何も書いていなかった**——**存在に気づけなければ、また同じものを書く**。基盤に置いた意味が無くなる。`guard` / `ui` / `zoho` の README に、**使い方と「なぜそうするか」**を追記した(2026-08)。とくに「二重送信を防がないと申請が 2 件登録される」「名前空間を分けないと計測が混ざる」「201 件目から静かに落ちる」のような**書かないと分からない理由**を残した。なお `new-app` の雛形(`crud-template` のコピー)には `guardWrite` が反映済みで、スタブ認証も本番では例外を投げる形で健全だった |
| **Zoho Books / Inventory にも全件取得を追加(`listAll`)** | CRM と同じ問題——ページングの型(`page_context.has_more_page`)はあるが**追う実装が無く**、アプリが毎回書くことになっていた。Books の一覧は**どれも同じ形**なので、パスを渡せば使い回せる汎用の `listAll` を 1 つ置いた(請求書・見積・入金・取引先)。**Books の既定は 200 件/ページ**で、**月次の請求が 200 件を超えた月から集計が合わなくなる**——原因が分かりにくい。Inventory も同じ API 形式なので同じ実装を複製し、`check-risky-duplicates` に理由付きで登録した(**片方を直したらもう片方も**)。`people` / `desk` / `projects` は**オフセット方式しか無い**(`sIndex` / `from` / `index`)ので、全件取得は足さず**落とし穴を明記**した——**取得中にレコードが増減すると重複・欠落が起きる**。1 ページ目の後に 1 件追加されるだけで全体が 1 つずれ、**同じレコードを再取得**する(削除なら **1 件飛ばす**)。**件数だけ合っていても中身が違いうる**。CRM の `page_token`(カーソル方式)なら起きない。対策は**一括同期を業務時間外に回す**か、**取得後に ID で重複を除く**(件数で突き合わせない) |
| **Zoho CRM に全件取得が無かった(`getAllRecords`)** | ページングの型(`more_records` / `next_page_token`)はあるが、**それを追う実装が無く**、アプリが毎回書くことになっていた。自前で書くと**1 ページ目だけ処理して「件数が合わない」**——Zoho の既定は 200 件/ページなので、**201 件目から静かに落ちる**。`getAllRecords` を追加(2026-08)。**上限は 50 ページ**(最大 10,000 件)——設定ミスで巨大なモジュールを全部引くと、**相手の API 上限を使い切ってその日は他の連携も動かなくなる**。**`page_token` を優先**(v8 の推奨。取得中にレコードが増減しても重複・欠落が起きにくい)。**トークンが無いのに `more_records` が true なら止める**——同じページを取り続けて無限ループになるより、**足りないことが分かる形で終わる**方がよい |
| **Zoho 連携の落とし穴を明記(4 点)** | `@platform/zoho` に「連携するときに必ず確かめること」を書いた(2026-08)。**① データセンター**——DC ごとに URL が違い、**間違えると認証は通るが空の結果が返る**(「データが無い」ように見えて、実際は別の DC を見ている)。`detectDataCenter` は不明なら `com` を返すので**日本の組織では明示すること**(`internal-app` の既定は `jp` で正しい)。**② 日時は TZ 付きで返る**——`2026-08-10T09:00:00+09:00` の形なので**`slice(0, 10)` で切らない**。UTC に直してから切ると**JST の朝が前日**になる。**③ API の呼び出し数に上限**——1 分・1 日の両方で数えられ、**一括同期では普通に当たる**。**④ カスタム項目は内部名**(`Custom_Field_1`)で返る——表示名で書くと動かない |
| **Zoho ログイン用セッションを基盤へ(`createZohoSession`)** | `@platform/zoho` には **OAuth(`buildAuthorizationUrl` / `exchangeCodeForToken` / `getUserInfo`)はあったがセッション発行が無く**、`internal-app` が自前で持っていた。**Zoho 連携は 1 つのアプリでは終わらない**(CRM・Books・People・Desk…)ので、次に作るアプリでも同じものを書くことになる——書くたびに**署名だけで暗号化を忘れる**、**有効期限を間違える**という差が出る。`@platform/session` を通す形で基盤に置いた(2026-08)。**暗号化されるので中身が読めない**(既存の `zoho-session` は署名だけ)。**鍵は必須で既定値を持たない**——同じ鍵を使うと**一方のアプリのクッキーが他方でも通る**。有効期間の既定は 8 時間(業務時間より少し長く。短いと昼休みで切れ、長いと共用端末で放置される)。**既存アプリの移行は段階的に**(全員ログアウトを避ける手順は上に記録) |
| **`currentSession` を基盤へ追加(`currentUser` の共通部分)** | `@platform/guard` には**必須版の `requireSession`(無ければ 401)しかなく**、**null 許容版が無かった**——「ログインしていなくても見せる画面」(公開ページ・ログイン画面・「ログイン中なら名前を出す」ヘッダ)では使えない。各アプリが `session.read(req.headers.get("cookie"))` を書いており、`internal-app` と `line-console` で**同じ形のラッパーを別々に持っていた**。`currentSession` を足し、**`Request` をそのまま渡せる**ようにした(`requireSession` も同じ形に揃えた)。**無効・期限切れ・未ログインを区別せず `null`** ——利用者から見れば同じだし、**区別して伝えるとセッション偽造の手がかり**になる(2026-08)。`internal-app` は独自のセッション実装(`zoho-session`)を使っているため、そちらは別途 |
| **問い合わせフォームを基盤へ移した(`ContactForm`)** | 2 アプリが**同じ項目・同じ作りのフォームを別々に持っていた**(氏名・メール・分類・件名・本文)。違うのは**送信先とカテゴリだけ**なのに、二重送信の防止や必須チェックまで書き直されており、**公開サイト側だけ二重送信を防げていなかった**。`@platform/ui` に移し、アプリ側は**送信先とカテゴリを渡すだけ**にした(2026-08)。**エラーはサーバが返した文言をそのまま出す**——ここで作文すると「なぜ送れないか」が伝わらない。**`role="alert"` / `role="status"`** も付けた(読み上げ環境では付けないと送信結果が伝わらない)。アプリ側は 55 行 → 28 行、41 行 → 16 行に |
| **ページビュー計測を基盤へ移した(`usePageview`)** | `internal-app` と `public-site` が**同じ形のラッパーを別々に持っており**、セッション ID の採番と保存を毎回書き直していた——書き直すたびに「**タブを閉じたら消す**」「**保存に失敗しても計測は続ける**」が抜ける。`@platform/ui` に `usePageview` を追加(2026-08)。**名前空間をアプリごとに分ける**のが要点——同じブラウザで社内アプリと公開サイトを開いたとき、**セッション ID が混ざると計測が繋がってしまう**。**公開サイトは匿名**(`userId` を送らない)ことも検査で固定した。なお `public-site` の元実装は **`createWebStorage` の import が抜けていた**(移植時に判明) |
| **`monthlyClosing` は別物だった(統合せず)** | 2 アプリで同名だったが、`internal-app` は**会計の月次締め**、`showcase` は**負荷テストのシナリオ**で用途がまったく違う。名前が同じでも中身を見ないと判断できない |
| **ブラウザ API の取り出しを基盤へ移した(`browserBeaconDeps`)** | `internal-app` と `public-site` の計測用コンポーネントが、**`globalThis` から `navigator` / `document` / `location` を取り出す同じ定型**を持っていた。**サーバでは存在しない**(Next.js の SSR・テスト)ので、有無を確かめずに触ると **`ReferenceError` で画面が落ちる**。`@platform/analytics` の `browser.ts` に移した(2026-08)。**`sendBeacon` は「あれば使う」**——ページを閉じる瞬間でも送れるので `fetch` より確実だが、古いブラウザには無い。渡さなければ `createBeacon` が `fetch` に落とすので計測は続く。smoke に 4 項目(`navigator` 無しで落ちない / 既定値 / `sendBeacon` の有無 / `pathname` と `referrer`)を追加 |
| **`monthlyClosing` は別物だった(2026-08 確認)** | 2 アプリで同名だったが、`internal-app` は**月次決算**(損益計算書・貸借対照表)、`showcase` は**ロードテストのシナリオ**で、統合の対象ではなかった。**同名だから重複とは限らない** |
| **送信の状態管理を基盤へ移した(`useSubmit`)** | フォームの送信は**どの画面でも同じ形**になるのに毎回書き直されており(`internal-app` と `public-site` の問い合わせフォーム)、**公開サイト側には二重送信の防止が無かった**——応答が遅いときに**もう一度押すと問い合わせが 2 件登録**される。`@platform/ui` に `useSubmit` を追加(2026-08)。**`useRef` で見張る**のが要点——`status` は再描画まで更新されないので、`disabled` だけでは**Enter 連打に間に合わない**。`finally` で必ず解除するので、例外が出ても次が押せる。エラーの文言は渡した関数が決める形にした(内部の例外をそのまま投げると**スタックトレースや SQL が画面に出る**) |
| **`currentUser` は統合しなかった(2026-08 確認)** | 3 アプリで重複していたが、`crud-template` は**スタブ**(テンプレなので当然)、`line-console` は `@platform/session` の `read` を使っており**既に正しい**。`internal-app` だけ `getCookie` + `verifySession` の古い形だが、**セッション形式に触るのはリスクが高い**ので見送った。基盤側に必要なものは揃っている |
| **書き込みの共通ガードを基盤へ移した(`guardWrite`)** | `crud-template` と `line-console` が**同じ実装を別々に持っていた**——本文サイズ・CSRF(`Origin` 確認)・レート制限の 3 つ。いずれも**書き忘れても動いてしまう**ので、新しい API を足したときに抜けやすく、**抜けても平常時は何も起きず攻撃されて初めて分かる**。`@platform/guard` に `guardWrite` として置き、アプリは委譲する形にした(2026-08)。**コンテキストと監査ログはアプリに残した**——`guard` は「要求を通してよいか」を判断する層で、context の管理は別の関心事。smoke に 7 項目(GET 素通し / 413 / 403 / Origin 無しは通す / 同一オリジン / 429 / fail-open)を追加 |
| **`check-risky-duplicates` がアプリ側を見ていなかった** | 「壊れると実害がある同名関数」を見張る検査が **`packages` だけ**を対象にしており、**アプリが基盤と同名の関数を自前で持っていても気づけなかった**。実際 `sha256Hex`(監査ログの改ざん検知)・`requirePermission`(認可)・`summarize` など**29 名**が両方にあった。対象を `apps` へ広げたところ **`hashPassword` / `verifyPassword`** を検出——確認すると**基盤へ委譲する薄いラッパー**(旧形式の検証を挟むため関数名を保っている)で健全だったので、理由付きで ALLOW に登録した。**片方だけ弱いと「守れているつもりで守れていない」**状態になるので、見張る範囲は基盤に限らない(2026-08)。検査対象は 116 → 133 名 |
| **`JSON.parse(JSON.stringify())` で複製していた** | `survey-repo` がこの形で深い複製をしており、**`Date` が文字列になり、`undefined` の項目が消え、`Set` / `Map` は空になる**——回答に日時が入っていると型が壊れる(実際 `createdAt` で並べ替えていた)。`@platform/utils` の `deepClone` と同じ形に直した(2026-08)。**依存は増やさず複製**している——この repo は smoke が単体でファイルを読み込むので、外部 import を足すと解決できない。**片方を直したらもう片方も**。なお `crypto.randomUUID()` の直接利用 2 件は、**基盤に `newId` が存在しない**ので妥当だった(検査パターンの誤り) |
| **アプリ側の TZ 依存を 31 → 25 件に(金額に直結する 6 件)** | **① 請求書の支払期日**(`billing.ts` 2 箇所)——`setDate`(ローカル時刻)と `toISOString`(UTC)を混ぜており、**JST 機では期日が 1 日ずれる**。基盤の `dueDateFrom`(UTC で通す実装)に置き換えた。**② 債権の滞留日数**(`receivables.ts`)と**③ 買掛の支払遅延**(`payables-repo.ts`)——UTC のサーバでは **JST の 00:00〜08:59 が前日**になり、**日数が 1 日短く出る**。督促の区分(30 日・60 日・90 日)の**境目で判定が変わる**。JST 基準に統一した(2026-08)。残る 25 件は表示や集計の年月取得が中心で、実害は薄い |
| **`check-server-localtime` を新設(TZ 依存を機械で止める)** | サーバ側のローカル時刻の利用を**さらに 4 件**直した——**予約の曜日判定**(JST 月曜 8:00 が日曜と判定され、**日曜定休の店で月曜朝が取れない**)、**臨時休業の日付**(JST 早朝が前日の設定に当たる)、**リマインダーの文面**(「本日 14:00」が「本日 05:00」と案内される)、**著作権表示の年**(元日の朝 8:59 まで前年)。これで**基盤側は 0 件**になったが、**アプリ側に 31 件**残っている(一度に直すと差分が大きすぎる)ため、**上限方式**にして preflight に登録した。**`.tsx` は対象外**——ブラウザ側は利用者の時刻を見るのが正しい。検査は 65 種類に |
| **TZ 依存を機械で洗い出し、サーバ側 3 件を修正** | `getFullYear` / `getHours` / `setDate` などローカル時刻のメソッドを全件走査すると **81 件**。うち**ブラウザ側(`.tsx`)は正しい**(利用者の時刻を見るのが本来)ので、サーバ側の 9 件に絞って確認した。**① 通知の静音時間**(`notify/preferences`)——`getHours()` が UTC サーバでは 9 時間ずれ、「22 時〜7 時は通知しない」設定が **JST 13 時〜22 時に効く**。**夜中に通知が鳴り、昼間は届かない**。**② 見積の残り日数**(`daysUntilExpiry`)——`isExpired` と同じ問題で 1 日多く出る。**③ 電帳法の保存期限**(`retentionDeadline`)——`setFullYear` / `setDate` がローカル時刻で動き、**JST 機と UTC 機で保存期限が 1 日ずれる**。早く消せば法令違反、遅く消せば個人情報を余計に持ち続ける。うるう年の繰り上がり(2/29 → 2/28)も直した。**既存の smoke がローカル時刻を前提にしていた**ため、テスト側も JST 基準に直した(3 件) |
| **見積の有効期限がサーバの TZ に依存していた** | `isExpired` が `getFullYear()` / `getMonth()` / `getDate()` を使っており、**サーバのローカル時刻**で判定していた。UTC のサーバ(クラウドの既定)では **JST の 00:00〜08:59 が前日**として扱われ、JST で 8/11 00:30 なら期限切れのはずが「まだ 8/10」で**有効と判定**される——**あと 9 時間だけ使える見積**が生まれ、**失効したはずの価格で受注**しうる。JST の日付文字列で比べる形に直した(2026-08)。**値引きは健全**で、100% 超も定額の過大値引きも**売価で頭打ち**になりマイナスにならない。`maxDiscountForMargin` も原価が欠けていれば 0 を返す(安全側) |
| **同じ倉庫への移動が通っていた** | `transfer` は在庫不足を弾くが、**移動元と移動先が同じ場合を見ていなかった**——A → A で出庫と入庫が 2 件記録され、**在庫は変わらないのに履歴が汚れる**。棚卸の突合で「なぜこの移動が?」と調べる手間になる。画面で from と to に同じ倉庫を選ぶのは普通に起きるので、**入力の誤りを教える**のが基盤の役目。`from === to` なら `null` を返すようにした(2026-08)。あわせて `@param input` が実装(`from` / `to` / `quantity` / `at`)と違っていたのも直した |
| **FEFO 引当が期限切れロットを最優先で選んでいた** | `allocateFEFO` は「期限が近い順」に引き当てるが、**期限切れの除外が無かった**——期限が最も近い(＝過ぎている)ロットが**最優先で選ばれる**。食品・医薬品・化学品では**出荷してはいけないものが出る**(賞味期限切れが顧客に届く)。`expiredLots` は別にあったが、**引当が見ていなかった**。`now` を渡すと除外する形にした(2026-08)。渡さなければ従来どおり全ロットが対象。**期限切れで足りなくなった分は `shortfall` に出る**ので、引き当てられなかったことが分かる。`reorderPoint`(安全在庫 + リードタイム需要)は健全だった |
| **過入金が「入金済」に埋もれていた** | `paymentStatus` は `paidAmount >= total` で `paid` を返すため、**多く払われても完了扱い**だった。実務では普通に起きる——**振込手数料を差し引かずに送金された**(440 円など)、前月分と合算された、桁を間違えた。完了扱いにすると**返金や次回への充当が要るのに見えなくなり**、決算時に「預り金」の残高が合わない。**`overpaid` を追加**し、`overpaidAmount()` で額を取れるようにした(2026-08)。`balanceDue` は過入金を 0 に丸める(負を返さない)ので、**0 なだけでは「ちょうど」と「多い」が区別できない**——限界を明記した。債権一覧(`receivables`)は `balanceDue > 0` で絞るので**過入金は出ない**(正しい挙動) |
| **支払期日が休日を考慮していなかった** | `dueDateFrom` は日数を足すだけで、**期日が土日祝でもそのまま返して**いた。「月末締め翌月末払い」で月末が土曜なら**実際の入金は翌月曜**なので、督促の判定に使うと**入金が無い日に督促する**。`adjust: "next"`(翌営業日)/ `"previous"`(前倒し)を選べるようにした(2026-08)——会社によって慣行が違うため。**既定は `"none"`** で従来どおり。**起算日は動かさない**——下請法の「60 日以内」は休日でも起算日が変わらないので、ずらすのは支払日だけ。土日は常に休みとして扱い、祝日と年末年始は `holidays` で渡す |
| **年末年始を生成する `yearEndHolidays` を追加** | 会社休日を渡せるようにしたが、**渡し忘れても気づけない**(省略可能な引数)ので、**既定の範囲を基盤が持つ**ようにした。既定は **12/29〜1/3**(`行政機関の休日に関する法律` の閉庁日と同じで、日本の会社で最も多い)。**銀行は 12/31〜1/3** なので `bankOnly` を用意した——**12/29・12/30 は銀行が動く**ので、この 2 日を休みにすると**振込の期日が後ろへずれる**。`yearEndHolidays(2026)` は**その年の年末と翌年の年始**を返すので、年またぎの計算が 1 回で済む(2026-08) |
| **営業日の判定に会社休日を渡せなかった** | `isBusinessDay` は土日祝しか見ておらず、**年末年始(12/29〜1/3)や夏季休暇は営業日と判定**されていた——これらは**祝日ではない**(元日を除く)ため。12/30 の「翌営業日」が 12/31 になり、**銀行も会社も休みなのに支払期日や納期が設定される**。`extraHolidays`(`"YYYY-MM-DD"` の集合)を渡せるようにし、`addBusinessDays` / `businessDaysBetween` にも通した(2026-08)。就業規則の休日カレンダーをそのまま渡せばよい。**利用側(`attendance-monthly` の `expectedWorkdays` / `monthlyAttendance`)にも通した**——所定労働日数が **12 月は 3 日・1 月は 2 日多く**出ると、**出勤率(実績 ÷ 所定)が低く出て有給の付与条件(出勤率 8 割)の判定を誤らせる**。12 月と 1 月だけ見え方が変わるので原因も分かりにくい。**祝日の計算自体は正確**で、2026 年の 18 件(振替休日 5/6・国民の休日 9/22・春分 3/20・秋分 9/23 を含む)がすべて一致した |
| **期間計算と労務系の確認結果(2026-08)** | 「月次を 30 日で数える」形が他にないか横断で見たが、**残りは概算でよい箇所だけ**だった(キャッシュの TTL・遅延利息の日割りは 365 で正しい)。労務系も検証したが**すべて法定どおり**——**有給の付与日数**(0.5 年 10 日 / 1.5 年 11 / 2.5 年 12 / 3.5 年 14 / 4.5 年 16 / 5.5 年 18 / 6.5 年以降 20)、**時効 2 年・古い分から消化**、**年 5 日の取得義務は 10 日以上付与された人が対象**、**ストレスチェックは常時 50 人以上で年 1 回**、**電帳法の保存期間は原則 7 年・欠損金があれば 10 年**、**労基法の帳簿は 5 年**。起算日も「事業年度の確定申告期限の翌日」と正しい |
| **月次スケジュールが「30 日」で数えていた** | `report-schedule` と `export-schedule` の両方が、月次を **`30 * DAY`** で判定していた。1/31 に送ると次は **3/2** になって**2 月が飛び**、その後も**送信日が毎月ずれて**いく。月次レポートは経理の締めや役員会に合わせるので、**毎月同じ頃**が期待される。**月が変わったか**で判定する形に直した(JST 基準。UTC で見ると月初・月末の深夜に 1 か月ずれる)。日にちの大小は見ないので月末に送っていても翌月初に「来ている」と判定されるが、**送り忘れるより少し早い方がよい** |
| **cron 式の落とし穴を明記** | **月末処理に `31` を使わない**——`"0 0 31 * *"` は **2 / 4 / 6 / 9 / 11 月に実行されない**(31 日が無い)。年 5 回、月次の締めや請求が飛ぶ。**`"0 0 L * *"`(L = 月末)**を使う。**営業日は cron 式では書けない**(祝日を扱えない)ので、毎日動かして handler の中で `isBusinessDay` を見る——**祝日に動いて何もせず終わるのは正常**。既存の設定に `31` は無く、`timezone` の既定も `Asia/Tokyo` で健全だった |
| **Webhook のリプレイ対策が書かれていなかった(freee / ekyc)** | 3 つの Webhook(`ekyc` / `freee` / `line`)はいずれも `timingSafeEqual` で署名を検証しており、**署名の検証自体は健全**。だが**署名が正しい要求は何度でも送り直せる**——通信路を見られる立場(社内の中間装置・ログ・プロキシ)なら、**署名を破らなくても**「入金があった」「本人確認 完了」を再送できる。**freee は二重計上、ekyc は期限切れの承認が復活**する。`line` だけ時刻検証があり、他 2 つは**ベンダーが署名に時刻を含めない**ので時刻では防げない——**イベント ID による冪等処理が唯一の防御**であることを明記した(2026-08)。**受信側の実装は健全**で、`line-console` は `lineMessageId` に `@unique` を付けて重複を防いでいた |
| **HTTP クライアントの挙動を smoke で固定した(2026-08)** | 前回「429 をリトライ判定に入れ忘れる」という**直したつもりの見落とし**があったので、実際の挙動を検査で固定した。6 項目——**POST は既定でリトライしない**(二重登録を防ぐ)/ **GET はリトライする** / **`retry: true` なら POST も再送**(冪等キーがある場合)/ **429 はリトライ対象** / **バックオフが指数的に伸びる** / **ジッターがある**(固定値でない)。**「直した」と「効いている」は別**で、とくに条件分岐が複数ある箇所は片方だけ直しても気づけない |
| **POST を黙って再送して二重登録していた** | `createApiClient` は **メソッドを問わずリトライ**しており、5xx や 429 で **同じ POST を再送**していた——相手が処理した後にタイムアウトした場合、**仕訳が 2 件・振込が 2 回・注文が 2 つ**作られる。`accounting/sync` で `unknown` を足したのと同じ問題が、**HTTP クライアントの層**にあった。**既定を GET / HEAD のみリトライ**に変え、`retry: true` で明示的に選べるようにした(2026-08)。**相手が冪等キーに対応しているなら true にしてよい**(Stripe の `Idempotency-Key` など)。既存の POST 呼び出し 42 箇所は**リトライされなくなる**が、安全側の変更 |
| **バックオフが線形でジッターが無かった** | コメントは「指数的バックオフ」と書いていたが、実装は `200 * (attempt + 1)` の**線形**。加えて**待ち時間が固定**なので、相手が落ちて 100 件が同時に失敗すると**全部が同じタイミングで再送**し、**復旧した相手を再び倒す**。指数(上限 5 秒)+ ジッター(50〜100% の幅)にした。**0 から振らない**のは、極端に短い待ちになった要求が先に殺到するため。あわせて **429 をリトライ判定に入れ忘れていた**のも直した——`Retry-After` を待ってもその後リトライされず、待った意味が無くなっていた |
| **429(レート制限)でリトライしていなかった** | `createApiClient` のリトライ対象が **5xx とネットワークエラーだけ**で、**429 は即座に失敗**していた。freee は 1 時間 3,600 リクエストなど、**業務の一括同期では普通に当たる**制限で、そこで処理が止まる。429 もリトライ対象にし、**`Retry-After` を尊重する**ようにした(2026-08)——相手が「N 秒後に」と言っているのに闇雲に再送すると**制限が延びる**。待ち時間は `totalTimeoutMs` の残りに収める。**Notion は上限とページングが実装済み**で健全だった |
| **Slack の投稿が上限を超えると届かなかった** | Slack の本文は **40,000 文字**まで。超えるとエラーで**投稿されない**が、実装は本文をそのまま渡していた。**スタックトレース・SQL・JSON の全文**を貼ると簡単に超える——障害通知でまさに起きやすい形で、**通知が届かないまま気づかない**のが最も困る。`truncateSlackText` で切り詰めるようにした(2026-08)。**切り詰めたことが分かるよう末尾に印を付ける**——黙って切ると読む人は「これで全部」と思い、**肝心な部分が落ちているのに気づけない** |
| **LINE の一斉配信が 500 人を超えると誰にも届かなかった** | `multicast` は LINE の仕様で **1 回 500 人まで**。超えると 400 が返り、**部分的にも送られない**(全部失敗)。501 人へ送ろうとすると**誰にも届かないまま終わる**が、実装は宛先をそのまま渡していた。**500 人ずつに分けて送る**ようにした(2026-08)。**1 つでも失敗したらそこで止める**——続けると「どこまで送ったか」が分からなくなり、再送で二重に届く。なお `ok()` を `@platform/core` から import すると smoke の差し替えで壊れるため、**戻り値は直接組み立てている** |
| **Microsoft Graph 経由のメールにも `bcc` が無かった** | `@platform/mail` で直した「一斉配信で全員のアドレスが見える」問題が、**Graph API 経由でも同じ**だった(`GraphMailInput` に `to` と `cc` はあるが `bcc` が無い)。型と送信の両方に追加(2026-08)。**送信経路が複数あるときは、片方だけ直しても意味がない**——`@platform/google` の Gmail は `Bcc` に対応済みで、件名の MIME エンコード(`=?UTF-8?B?...?=`)も正しかった。「型にあるのに実装で落ちる」項目を全パッケージで機械的に探したが、**mail 以外では 0 件**(型が別ファイルにあると見落としやすい、という形だった) |
| **添付と追加ヘッダが SMTP に渡っていなかった** | `MailMessage` に `attachments` と `headers` があるのに、**SMTP の送信側で渡していなかった**。**① 添付** … 型にあるので付けたつもりになるが、**本文だけで届く**——請求書や明細を送る経路では、受け取る側は「添付漏れ」と受け取る。**② `headers`** … `unsubscribe.ts` が `List-Unsubscribe` を作っているのに付かない。**Gmail は 2024 年から一斉配信にこのヘッダを求めており、無いと迷惑メール扱いで届かない**——「お知らせが誰にも届かない」という形で表面化する。両方を渡すようにし、**`MailMessage` の全項目が SMTP へ渡ることを smoke で見張る**ようにした(2026-08)。**型と送信の食い違いは、送ってみるまで分からない** |
| **一斉配信で全員のアドレスが漏れていた** | `MailMessage` に **`bcc` が無く**、管理者の一斉配信(`admin/broadcast`)が **`to` に全員を入れて**いた——**受信者全員に全員のアドレスが見える**。社内でも「誰に送ったか」が全員に分かるのは望ましくないし、社外(顧客・取引先)へ送る仕組みに転用されれば**そのまま個人情報の漏洩事故**になる。**日本の業務システムで最も多い事故の 1 つ**。`bcc` / `cc` を型と SMTP 送信に追加し、配信を `to: 送信者 / bcc: 全員` に変えた(2026-08)。`to` を空にすると迷惑メール判定されやすいので必ず何か入れる |
| **誤送信防止が `bcc` を素通りさせていた** | `applyRecipientPolicy`(許可ドメイン以外を弾く・開発環境では宛先を付け替える)が **`to` しか見ていなかった**。`bcc` を足した結果、**開発環境から本番の宛先へ一斉配信が飛ぶ**状態になるところだった——誤送信防止が**一番効いてほしい場面で効かない**。`bcc` / `cc` も絞り込み対象にし、`redirectTo` で付け替えるときは**bcc を消す**ようにした(残すと本番へ届く) |
| **勤怠・給与は健全だった(2026-08 確認)** | 日本固有の計算が多く欠陥を疑ったが、**主要な判定はいずれも正しかった**。**深夜割増**は 22:00〜翌 5:00 で、前後日にまたがる勤務(17:00→翌 2:00 で 240 分)も正しく合算する。**36 協定**は月 45 時間・年 360 時間、特別条項の年 720 時間・単月 100 時間未満・2〜6 か月平均 80 時間以内・年 6 回まで、をすべて実装済み。**介護保険の開始月**も「40 歳の誕生日の**前日**が属する月から」という規定どおりで、8/1 生まれは 7 月から、8/2 生まれは 8 月から徴収される(月初生まれの境界が最も間違えやすい箇所)。**法令の条文が明確な領域は、実装も丁寧**という傾向がここでも当てはまった |
| **印刷でしか起きない 3 つを既定で塞いだ** | `pageCss` は用紙サイズと余白しか出しておらず、**紙に出して初めて気づく**問題が残っていた。**① 背景色が出ない** … ブラウザは既定で背景を印刷しない(インク節約)ので、**表の見出し行が白くなり、どこが見出しか分からない**——請求書や納品書で行の区切りが読めない。**② 表の行が上下ページに分かれる**。**③ 見出し行が 2 ページ目以降に出ない**ので、「この列は何か」が分からなくなる。`print-color-adjust: exact` / `break-inside: avoid` / `thead { display: table-header-group }` を既定に入れた(2026-08) |
| **全銀の種別コードを明記** | `typeCode` の既定は `"21"`(総合振込)だが、**給与振込は `"11"`、賞与は `"12"`** で、**同じファイルに混ぜられない**。給与を総合振込で送ると、銀行によっては手数料区分が変わり、受取人の通帳の摘要も「給与」にならない。`transferDate` が **MMDD で年を含まない**ことも明記した(年末年始をまたぐ処理で取り違えやすい) |
| **全銀ファイルを Shift_JIS で書き出す手段が無かった** | パッケージ説明は「**Shift_JIS 前提**」と書いていたのに、**変換の手段が無かった**。文字列のまま既定(UTF-8)で書くと**半角カナが 1 文字 3 バイト**になり、120 桁の行が 360 バイト近くになる——銀行のシステムは桁位置で項目を切り出すので**まったく読めない**。`toShiftJisBytes` を追加(2026-08)。全銀で使うのは ASCII と半角カナだけなので**依存なしで変換できる**。**使えない文字は黙って `?` にせず例外**にする——置き換えると**受取人名が変わったまま振り込まれる**(別人の口座・組戻し) |
| **`toHankakuKana` から小書きカナが漏れていた** | `ァィゥェォャュョッ` の 9 文字が変換表に無く、**そのまま残っていた**。「キャノン」「ショウジ」「トッキュウ」のような社名で普通に出る文字で、全銀では使えないため**ファイル生成の直前まで気づけない**。追加した。あわせて `findUnsupportedChars` を新設——**受取人名を登録する画面で通せば、振込当日に慌てずに済む**(`ヶ` `々` `㈱` やひらがなは半角カナに対応が無く、変換しても消えない) |
| **「長さの約束」の横断確認(2026-08)** | 全銀で 4 レコードすべてが桁不足だったので、**TSDoc で長さを約束している関数**を全部洗った。62 件見つかったが、**大半は限界の説明**(`normalizeZipcode` の「桁数は検証しない。`100-00011` は 8 桁になる」、`hashApiKey` の「キーは 24 バイトの乱数なので総当たりが現実的でない」など)で、約束ではなかった。**`@returns` で長さを約束し、かつ検証が無いもの**に絞ると **0 件**。全銀だけが例外だった。**固定長を扱うのも `zengin` のみ**で、他に同種の危険は無い |
| **「今日」を UTC で切り出す箇所が 18 件あった** | `check-utc-date` は `new Date().toISOString()` を見張っていたが、**引数で受けた Date**(`today.toISOString().slice(0, 10)`)は対象外だった。UTC で動くサーバでは **JST の 00:00〜08:59 が前日**になる——**タスクの期限切れが「まだ間に合う」と出る**、健康診断・下請法・公益通報の期限判定がずれる、定期レポートの件名が前日の日付になる。基盤 4 ファイル・アプリ 14 ファイルを JST 基準に修正し、**検査に `VAR_TO_UTC_DATE` を追加**(`today` / `now` / `asOf` / `at` という名前の変数に限定)。**smoke が単体で読み込むファイルでは `@platform/datetime` を import できない**ので、そこは局所で計算する |
| **全銀のデータレコードが 55 桁しか出ていなかった** | TSDoc は「**120 バイトの固定長レコード**」と書いていたのに、実装は主要項目だけを並べて **55 桁**だった——**銀行に持ち込んでも受け付けられない**ファイルができる。全国銀行協会の標準に合わせて 120 桁にした(2026-08)。**ヘッダ(73 桁)・トレーラ(19 桁)・エンド(1 桁)も同じ問題**だったので揃えた——4 種類すべてが桁不足で、**ファイル全体が使えない状態**だった。銀行名・支店名・手形交換所番号・顧客コードは**任意項目**として型に足した(省略時はスペース/ゼロ埋め。多くの銀行は番号で名寄せするので空でも通る)。**桁が合わなければ例外を投げる**ようにしたので、項目を足し引きしたときに崩れれば気づける。**銀行ごとに差異がある**ので初回は必ずテスト送信すること |
| **OCR の抽出 3 件を実務の形に合わせた** | **① 登録番号(インボイス)** … `findRegistrationNumber` だけ `normalizeOcrText` を通しておらず、**全角の `Ｔ` が読めなかった**。小文字の `t` も拾うようにした(OCR は書体で取り違える。インボイス番号は必ず大文字なので直してよい)。**② 電話番号** … **FAX を電話番号として拾っていた**。領収書には `TEL 03-1234-5678 FAX 03-1234-5679` と並んでおり、FAX を取り込むと**確認の電話がかからない**。FAX の直後の番号を除外し、ハイフン無し(`0312345678`)も拾うようにした。**③ 全角ハイフン** … `０３－１２３４－５６７８` が読めなかった。数字に挟まれた長音記号(`03ー1234`)もハイフンとみなす(「コーヒー」を壊さないよう**数字に挟まれた場合だけ**) |
| **和暦の漢字 1 文字略記が読めなかった** | `parseJapaneseDate` は `令和6年8月10日` と `R6.8.10` は読めるが、**`令6.8.10`(漢字 1 文字)が `null`** だった。領収書や請求書のスタンプ・レジのレシートでは、幅を節約するために**元号を 1 文字にすることが多い**。読めないと**日付が空のまま取り込まれ、計上月が決まらず手入力に戻る**。`令` / `平` / `昭` に対応(2026-08)。`recognizeReceiptsBatch` は件数ごとの結果を返しており健全 |
| **CMS に公開の終了時刻が無い** | `effectiveStatus` は予約公開(`scheduled` → 時刻を過ぎたら `published`)を正しく扱うが、**終了時刻は扱わない**。「この日まで表示」という期間限定の告知(キャンペーン・イベント案内・年末年始のお知らせ)には、**別に終了日時を持たせて呼び出し側で判定する**必要がある——終わったはずの告知が残り続けると、**終わったキャンペーンに申し込まれる**。限界を明記した(2026-08) |
| **外部依存のバージョンは揃っていた(2026-08 確認)** | 46 件の外部依存について、パッケージ間で**バージョンの食い違いは 0 件**。同じライブラリの別バージョンが同居すると、型が合わない・挙動が違うといった追いにくい問題になるが、その心配は無い |
| **OCR がカンマの誤読で金額を 1/1000 にしていた** | OCR は `1,234` を **`1.234` と読むことがある**。`extractAmount` の正規表現は `[\d,]` なので `.234` だけを拾い、**234 円**として返していた——1,000 円少なく取り込まれる。経費精算なら過少申告、請求なら請求漏れで、**金額が小さくなる方向**なので気づきにくい。**日本円に小数は無い**(銭は廃止済み)ので、`数字.数字3桁` はカンマの誤読とみなして補正するようにした(2026-08)。`1.5個` のような 1〜2 桁は変えない(単価や数量の可能性がある) |
| **ALLOW リストの棚卸し結果(2026-08)** | 各検査の「理由付きの除外」38 件を確認したが、**古くなったものは無かった**。ファイル名・関数名(`createAiGateway` / `handleUpload` / `sendMail`)・CSS 変数のいずれも実体が存在し、`why`(理由)も全件に付いている。**掃除の必要なし** |
| **API クライアントの待ち時間が積算していた** | `createApiClient` の `timeoutMs`(既定 10 秒)は**1 回の試行あたり**で、`retries`(既定 2)と掛かると**1 回の呼び出しで 30 秒以上**待つ。画面から呼ぶ経路では利用者がその間固まる。**`totalTimeoutMs`(既定 30 秒)を足し、リトライを含めて打ち切る**ようにした(2026-08)。1 回あたりのタイムアウトも**残り時間に収める**——超えると最後の 1 回で全体の上限を破る。`timeoutMs` が「1 回あたり」であることも明記した |
| **公開サイトのレート制限がメモリストアだった** | 問い合わせフォーム(`public-site/api/contact`)のレート制限が `createMemoryStore` で、**カウンタがプロセスごと**。2 台構成なら**上限が実質 2 倍**、サーバレスなら**ほぼ無制限に送れる**。公開フォームはスパムの標的になりやすいので、**本番では Redis のストアに差し替えること**を明記した(2026-08)。1 台構成のうちは止まる分だけ意味がある |
| **未確認アプリの確認結果(2026-08)** | `line-console` の Webhook は署名検証あり(`x-line-signature`)、`dev-login` は `isProductionRuntime()` と環境変数の**二重**で本番を塞いでいた。`crud-template` の API も認可が入っている。**問題は `public-site` の 1 件のみ** |
| **Redis の既定リトライが fail open の設計と噛み合っていなかった** | `ioredis` は既定で `maxRetriesPerRequest: 20`・`enableOfflineQueue: true`。`enforceRateLimit` は**ストア障害時に通す(fail open)**設計なのに、**1 リクエストが数十秒待たされて**からでないと失敗しない——「落ちていても本流を止めない」が成立しない。キャッシュも同じで、無ければ元を引けばよいのに待つのは本末転倒。`maxRetriesPerRequest: 1` / `enableOfflineQueue: false` に変更(2026-08)。**オフラインキューを切る**のは、Redis が落ちている間にコマンドがメモリへ積み上がるのを防ぐため |
| **4 桁の市外局番で電話番号の区切りを誤る** | `formatJpPhone` は「主要 2 桁(03/06)とそれ以外は 3 桁」という近似で整形しており、**4 桁の市外局番(青梅 0428・富士吉田 0555・佐渡 0259 など多数)を 3 桁として切る**——`0428-12-3456` が `042-812-3456` になり、**042(八王子・立川)の番号に見える**。桁数は変わらないので発信はできるが、帳票や宛名ラベルでは**別の地域だと誤解される**。正確な整形には総務省の市外局番一覧(数千件)が要るので持たない方針で、**限界を TSDoc に明記**した。表示の正確さが要るなら**入力されたままの区切りを保存すること** |
| **AI 向け MCP は読み取り専用だった(2026-08 確認)** | `tools/lib/catalog-tools.mts` が提供するのは `search_platform` / `describe_package` / `find_examples` / `explain_rules` / `list_platform` / `search_docs` の 6 つで、**すべて読み取り**。書き込み・実行の手段が無いので、AI が触れる範囲としては健全 |
| **畳の説明と値が食い違っていた** | `AreaUnit` の `jo` は 1.62 ㎡だが、コメントには「**中京間 1.6562㎡**」と書かれていた。**値は正しい**(不動産公正競争規約が広告での「1 畳」の下限を 1.62 ㎡と定めている)が、**説明を読んだ人は「中京間だ」と誤解する**。実際の畳は地域で違い、京間・中京間 1.6562 ㎡、江戸間 約 1.5488 ㎡、団地間 約 1.4450 ㎡。**広告や面積の目安には 1.62 で正しいが、実測が要る用途(内装・畳の発注)には使えない**ことを明記した(2026-08) |
| **取り込みの行番号の基準が書かれていなかった** | `ValidRow.rowIndex` は「ヘッダを除いたデータの何行目か」(1 始まり)だが、**型の側に書かれていなかった**(実装のコメントにのみ)。CSV ファイルの行番号とは**ヘッダの分だけずれる**——`rowIndex: 1` は Excel で開くと **2 行目**。利用者は Excel で開いて直すので、**画面にはファイルの行番号(`rowIndex + 1`)を出す方が親切**。どちらの番号かを明記することも書いた。`runImport` 自体は健全で、既定が「1 行でもエラーなら全件中止」(安全側)、トランザクションで包む必要性も明記済み。`currency` の `convert` も「**どの時点のレートか**を `rate` と基準日で記録すること」まで書かれていた |
| **カートの数量に整数・上限の検証が無かった** | `setQuantity(cart, id, 1.5)` が通り、**小数の注文が成立**していた——在庫の引き当てと合わない。`1e9` も通り、**金額 1,000 億円で与信や決済まで進む**(在庫で失敗するのはその後)。`normalizeQuantity`(整数に切り捨て・上限 9999)を足し、`setQuantity` と `addToCart` の両方に適用(2026-08)。**加算後も上限に収める**——何度も追加すれば超えられては意味がない。切り捨てにするのは**注文者が意図した以上に買わせない**ため |
| **パストラバーサルの横断確認(2026-08)** | 前回 `createLocalStorage` で見つけた形が他に無いかを洗った。**本番コードでパス操作をしているのは `storage` と `fs` だけ**で、`fs` には既に `isSubPath`(`relative` で判定)があった。`storage` 側の自作判定(`startsWith`)を `isSubPath` と同じ形に揃えた——**依存を増やさないための複製**なので、片方を直したらもう片方も直すこと。`s3` アダプタは `Bucket` 固定でバケット外へ出られず、キーの `../` についても既に注意が明記されていた。`booking` も「登録の可否は DB 側で担保」と明記済みで健全 |
| **パストラバーサルの横断確認(2026-08)** | `join`/`resolve` に変数が入る 67 箇所を洗い、**ファイルを実際に触るのは 2 ファイルだけ**だった。`fs/operations.ts` は `readdir` の結果を繋ぐだけで安全、`storage/adapters/local.ts` は修正済み。**同じ判定が `@platform/fs` の `isSubPath` にもあった**が誰も使っておらず、`storage` は `fs` に依存しない方針(S3 版はファイルシステムを使わない)なので自前実装のままにし、相互参照を書いた。`isSubPath` にも用途を明記 |
| **S3 とローカルでキーの扱いが違う** | S3 のキーは**単なる文字列**で、`"uploads/../secret"` はそのままのキーになる——`../` でバケットの外へは出られない(ローカルは実際のパスなので出る)。**ただし prefix による分離は破れうる**:`tenant-a/` で顧客を分けている場合、正規化する実装(SDK のバージョン・CDN・前段のプロキシ)によっては `tenant-b/` を指すことがある。**利用者の入力をキーにするなら `../` を呼び出し側で弾くこと**を明記 |
| **予約の判定と登録の間に競合がある** | `isSlotAvailable` は純関数で、**渡された配列を見たその瞬間の答え**でしかない。判定 → 別の人が予約 → 自分が登録、で**二重予約**になる。会議室・面談・設備で必ず起きる形で、**「たまに二重に取れる」**という再現しにくい症状になる。**登録時に DB 側で担保すること**(`(resourceId, start, end)` の一意制約か `SELECT ... FOR UPDATE`)を明記した。**予約の永続化はまだ未実装**(メモリのみ)なので、DB を作るときに一意制約を入れること |
| **取り込みの `apply` はトランザクションが要る** | `runImport` の `apply` が例外を投げると**そのまま呼び出し側へ抜け**、`applied` も `committed` も返らない——「何件入ったか分からない」状態で、再実行すると**重複**する。1 件ずつ INSERT する実装だと途中まで入るので、`$transaction` で囲むか冪等キーで防ぐことを明記 |
| **為替換算に「いつのレートか」が無い** | `convert` は `rate` を受け取るだけで**時点を持たない**。会計では**どの時点のレートで換算したか**を残す義務がある(取引日・決済日・期末でレートが違い、差額は為替差損益)。換算後の金額だけを保存すると**後から検証できず、監査で説明できない**。`rate` と基準日を一緒に記録することを明記 |
| **ローカルストレージがパストラバーサルを許していた** | `createLocalStorage` の `join(root, key)` に検証が無く、`"../../../etc/passwd"` を渡すと**root の外**を指した。キーは利用者の入力から作られることがある(ダウンロード API のパラメータ・アップロード時のファイル名)ので、**root の外を読み書きされる**——`.env` や秘密鍵を読める、既存ファイルを上書きできる。`resolve` して root の下にあるかを確かめる形に修正(2026-08)。**文字列の前方一致だけでは不十分**——`/var/data` と `/var/data-old` を取り違えるので、区切り文字まで見る |
| **リアルタイム配信のハブに認可の記述が無かった** | `createBroadcastHub` の `subscribe` は**渡されたチャンネルにそのまま繋ぐ**ので、接続してきた人が**どのチャンネルでも購読できる**。チャンネル名に ID を含める設計(`room:123`・`user:alice`)では、**他人の ID を指定すれば他人宛の通知が読める**。ハブ自体は認可を持たない設計で妥当だが、**そう書いていなかった**ので明記した。なお `@platform/webhook` は健全で、署名検証・冪等処理・時刻検証(未来方向も弾く・許容 5 分)が揃っていた |
| **`unknown` の扱いを実装した(`pending`)** | `syncToAccountingSaaS` が「送ったか分からない」仕訳をそのまま返すだけだった。**`alreadySent` に入れると届いていなかった場合に欠落**し、**入れないと届いていた場合に二重計上**——**どちらも危険なので自動で決めない**。`pending`(確認が要る冪等キー)と `needsConfirmation` を返し、**人が相手側で確認してから決める**形にした(2026-08)。`pending.length > 0` のときは必ず通知を出すこと |
| **`blindIndex` / `anonymizeRecord` に限界を明記** | **`blindIndex` は候補が少ない項目に使わない**——同じ値は常に同じハッシュなので、DB を見られると**頻度から中身を当てられる**(「東京都」が 30% なら最多のハッシュが東京都)。部分一致もできない。**`anonymizeRecord` は消す項目の挙げ漏らしが危険**——氏名とメールを消しても、**生年月日・郵便番号・性別が揃えば相当な確率で特定できる**。他のテーブル(監査ログ・通知履歴・添付ファイル名)に残った参照も消えないので、削除権への対応では**どこに何が残るかを先に洗うこと** |
| **AI Gateway に「送る内容」の注意を追加** | ログのマスク(`redact`)は**こちらの記録を守るだけ**で、**プロバイダには元の文字列がそのまま届く**。個人情報・社外秘を混ぜないこと、**利用者の入力をそのまま渡さない**こと(「以前の指示を無視して」と書けば**システムプロンプトを上書きできる**)を明記した。送った内容が**学習に使われるか**はプロバイダとの契約次第なので、業務データを扱うなら確認が要る。なお Gateway 自体の設計は健全で、**プロンプトのログは既定 off**、`redact` も差せる |
| **「動いていない」を検知できなかった(`counterBelow` を追加)** | `errorRateAbove` は 0 除算を避けるため**リクエストが 0 なら false を返す**。ロードバランサが全台を切り離した・アプリが起動していない・計測が壊れた——**いずれでもアラートが鳴らない**。「エラーが出ていない」と「動いていない」が区別されないのは監視の典型的な穴で、`counterBelow`(カウンタが閾値を下回ったら発報)を足した(2026-08)。**平常時の下限**を閾値にすること。夜間や休日に落ちる業務システムでは**時間帯で閾値を変える**か、止める時間を決めておく |
| **eKYC の Webhook に「署名を先に検証する」と書いていなかった** | `parseEkycWebhook` は署名を検証しない(`verifyEkycSignature` が別にある)が、**TSDoc にその順序が書かれていなかった**。通さないと**誰でも「本人確認が完了した」という Webhook を送れる**——eKYC の結果は口座開設や与信の判断に使うので、**なりすましがそのまま通る**。コード例つきで明記した。あわせて**署名の不一致は 401 で返す**ことも書いた——「壊れたボディ」なら 200 で受けてリトライを止めるのが正しいが、署名不一致は「送り主が違う」のでリトライさせる意味がない |
| **追加した項目の利用状況(2026-08 確認)** | `needsManualRecovery` / `hadNegativeStock` / `partial` / `allFailed` / `unknown` / `uncompensated` は、**現時点でアプリ側から参照されていない**。ただし基盤の関数自体は使われている(`runSaga` 2 箇所・`movingAverage` 8 箇所・`syncJournals` 7 箇所)ので、**画面に出す際に参照すること**。とくに `syncToAccountingSaaS`(`ledger.ts`)は `summarizeSync` の結果を返すだけで、**`unknown` が 0 でないときの扱いが未実装** |
| **二重払いの判定が「最も明白な二重払い」を見逃していた** | `findDuplicatePayments` は履歴に自分自身が入っている場合を除くため、**番号・仕入先・金額・支払日が全部同じなら「自分」とみなして飛ばして**いた。だが**同じ請求書を 2 回入力した場合がまさにその形**で、**最も明白な二重払いが検出されない**状態だった。**値が同じことと、同じレコードであることは別**。`ProcessedInvoice` に `id` を足し、識別子で除外する形に変えた(2026-08)。`id` を渡さない場合は**除外しない**——見逃すより余分に指摘する方が安全。三方照合(`threeWayMatch`)自体は健全で、発注のみ・未請求・過大請求のいずれも妥当に判定していた |
| **会計連携で「送ったか分からない」状態を扱っていなかった** | `syncJournals` は `send` が**例外を投げると処理全体が止まり**、`results` ごと失われていた——100 件中 50 件目でタイムアウトすると、**49 件は送信済みなのに記録が残らず**、再実行すると**二重計上**になる。さらにタイムアウトは「送ったか分からない」状態で、`failed`(相手が拒否 = 届いていない)と混ぜると再送で二重になる。**`unknown` を足し、例外を捕まえて処理を続ける**ようにした(2026-08)。`summarizeSync` にも `unknown` を追加——**0 でなければそのまま再実行しないこと**。相手側で確認してから手で処理する。二重計上は会計で最も重い誤りで、**気づくのは決算のとき**になる |
| **一斉通知が「一部失敗」と「全部失敗」を区別しなかった** | `summarizeResults` は `allOk` しか返さず、**やるべきことが違う 2 つの状態が同じ**だった。**一部だけ失敗**なら届かなかった相手に別経路で連絡する、**全部失敗**なら通知の仕組み自体を疑う。障害通知を 100 人に送って 3 人だけ失敗すると、**その 3 人は障害を知らないまま**——「送信した」記録は残るので後から気づきにくい。`partial` / `allFailed` / `failedChannels`(誰に届かなかったか)を追加(2026-08) |
| **在庫より多く出庫しても黙って通っていた** | `movingAverage` が在庫を超える出庫を受け入れ、`onHand: -5` / **`averageCost: 0` / `value: 0`** を返していた——本来 10 個分 1,000 円を払っているのに**在庫金額が 0 になる**。棚卸で差異が出ても、原因が「出庫の記録ミス」だと分からない。実務では普通に起きる(検品前に出荷を入力・入庫の登録漏れ・二重出庫)。**計算は止めずに続け**(途中で例外にすると帳簿全体が読めなくなる)、`hadNegativeStock` と `negativeAt`(いつマイナスになったか)を返す形にした |
| **`validateBlueprint` を追加し、実際の経費フローを smoke で見張るようにした** | `@platform/fsm` に足した `validateMachine` では**足りなかった**——`toStateMachine` は `from` をキーにした表へ組み替えるので、**`from` に一度も現れない状態がキーから消える**。`states` に書いたのにどこからも遷移しない状態を見落とす。`blueprint` は `states` を持つので、そちらを直接見る形にした(2026-08)。あわせて **smoke で実際の定義(経費申請)を検証**するようにした——フローは書いた直後は正しくても、**状態を足すときに崩れる**(新しい状態への遷移を作り忘れる / `final` に入れ忘れる)。定義に `orphan` を足すと落ちることを確認済み |
| **採番の桁あふれが黙って通っていた** | `createSequencer` の `padding: 4` で 10001 件目が来ると、**番号が 1 桁伸びる**。固定長を前提にした処理が壊れる——全銀ファイルや CSV の桁揃えが崩れ、DB の `varchar(N)` で切れ、**文字列ソートで順序が狂う**(`"10000" < "9999"`)。`@platform/zengin` の `padLeft` は 2026-08 に例外を投げるよう直したのに、**採番は揃っていなかった**。桁を超えたら例外にし、`allowOverflow: true` で明示的に許可できるようにした |
| **レート制限のフェイルオープンが選べなかった** | `enforceRateLimit` はストア障害時に**必ず通す**(可用性優先)。一般の API では妥当だが、**ログインでは Redis を落とせば防御が消える**——総当たりを止める仕組みが攻撃者に無効化される。`onStoreError: "deny"` を選べるようにし、ログイン経路(`showcase/api/login`)で有効にした(2026-08)。**「ログインできない」方が「誰でも入れる」より軽い** |
| **遷移表の誤りを見つける手段が無かった(`validateMachine` を追加)** | `@platform/fsm` は遷移を実行する関数だけで、**定義そのものが正しいかを見る手段が無かった**。遷移表は文字列のマップなので**型では防げず**、書き間違えても TypeScript は通る。3 つを探す関数を足した(2026-08)——**① 到達できない状態**(「キャンセル済み」を作ったのにキャンセルできる画面が無い)**② 出られない状態**(`final` でないのに出口が無く、「承認待ち」で**業務が止まる**。最も見つけにくい)**③ 遷移先が定義に無い**(実行時に未定義の状態になる)。**アプリの起動時かテストで一度呼ぶこと**——遷移表は書いた直後は正しくても、状態を足すときに崩れる。なお `@platform/blueprint` は別の構造(配列形式)で同じ検証が無いが、現在の定義(経費申請)は妥当だった |
| **saga が「手で戻す必要がある状態」を返していなかった** | `runSaga` は失敗時に完了済みステップを逆順で打ち消すが、**`ok: false` しか返さない**ので、呼び出し側は「きれいに巻き戻った」失敗と「**中途半端に進んだまま止まった**」失敗を区別できなかった。後者は**在庫を引いて決済に失敗し、在庫を戻せなかった**——売れていないのに在庫が減ったまま——という状態で、**人が手で戻す必要がある**。原因は 2 つ:**① 打ち消しが失敗した**(`compensationErrors` に入るが `ok` は同じ)**② `compensate` を書いていない**(型が `?` なので省略でき、**黙って飛ばされる**)。`uncompensated`(打ち消せなかったステップ名)と `needsManualRecovery` を追加した(2026-08)。**この値が true のときは運用の通知を出すこと**——ログだけでは気づけない |
| **`verify-checks` の残骸が毎回残っていた(2 つの原因)** | `check-leftover-fixtures` が何度も落ちていた原因は 2 つあった。**① `mkdirSync` がキャッシュ判定より前**にあり、飛ばすケースでも**空の `__verify__` ディレクトリを作っていた**——実行前の掃除は「ファイルの親」を消すので、ファイルが無い空ディレクトリは対象外だった。判定の後ろに移した。**② 中断時に `finally` が動かない**——タイムアウトや Ctrl-C で殺されると違反ファイルが残り、`check-tsdoc` などが別の理由で赤くなる。`SIGINT` / `SIGTERM` / `SIGHUP` / `exit` で掃除する仕組みを足した。**残骸は「直したのに落ちる」形で作業を止める**ので、原因を潰す価値がある |
| **preflight の所要時間(2026-08 実測)** | 3 件のキャッシュで **426 秒**を削った(`verify-checks` 159 → 0 / `check-scan-reporting` 196 → 0 / `check-braces` 71 → 0)。残る内訳は **smoke 120 秒**・`check-debt-slack` 24 秒・`check-generated` 11 秒・`check-build-ready` 8 秒・その他 60 本で計 20 秒程度、**合計 190 秒程度**。**smoke にはキャッシュを入れない**——2,147 件のテストが基盤とアプリ全体に依存しており、「このファイルが変わっていなければこのテストは飛ばす」の対応関係を機械で出せない。**雑にやると見落とす**ので触らない方がよい。`check-debt-slack` の 24 秒は上限の実測のために `check-app-rules` を 2 回叩くため(構造上の必然) |
| **`check-regex-pitfalls` 自身が発火していなかった** | 「範囲を取り違える正規表現」を探す検査が、**自分の探索パターンを過剰にエスケープして一致しない状態**だった。`\\\\\\(` のように多段のエスケープになり、実ファイルの `\(` にも `\\(` にも当たらない。**探すのは固定の文字列**なので、正規表現をやめて `includes` に変えた(2026-08)。さらに `\(` を含めていたのが誤りで、正しくは **`([^)]*`**(開き括弧の直後)——正規表現リテラル内のエスケープの有無で取り逃がしていた。直したところ **`gen-erd.mjs` を新たに検出**(Prisma の `@relation(...)` は入れ子が来ないので ALLOW に登録)。**「正規表現の誤りを探す検査」が正規表現の誤りで動いていなかった** |
| **`verify-checks` に指紋キャッシュを入れた** | 38 ケースで「違反を置く → 検査を走らせる → 消す」を繰り返すため **159 秒**かかっていた。**検査本体と `tools/lib/*` のハッシュ**で指紋を作り、変わっていなければ飛ばす。**並列化は採らなかった**——ケース X が置いた違反ファイルを同時に走る別の検査(`check-tsdoc` など)が見て落ちる(残骸が残っただけで落ちた前例がある)。**`--try` では保存しない**——1 本だけ流した結果で全体のキャッシュを上書きすると、他のケースの記録を失う。**保存は 1 ケースごとに行う**——全部終わってから 1 回だけ書くと、**途中で止まったときに何も残らず**次回もまた最初から 159 秒かかる(実際に起きた)。逐次保存にしたことで、中断しても**そこまでの分は次回飛ばせる**。46 ケース完走後の 2 回目は **0 秒** |
| **`check-regex-pitfalls` が自分の検証ケースで発火していなかった** | `verify-checks` にキャッシュを入れる過程で発覚。検証用ファイルの内容が **`\\(([^)]*)\\)`(バックスラッシュ 2 つ)** で書かれており、検出パターン(`\\(` の直後に `[^)]*`)に一致しなかった——**「違反を置いても通ってしまう」状態**。1 つに直して発火を確認。作った時点では確認したはずなので、その後の ALLOW 追加やパターン調整で壊れたと見られる。**`verify-checks` 自身を ALLOW に足した**——違反の見本を `content` として持つのが仕事なので、危険な書き方が文字列で残る |
| **`verify-checks` に指紋キャッシュを入れた(257 秒 → 1 秒)** | 38 ケースそれぞれで「違反を置く → 検査を走らせる → 消す」を繰り返すため、preflight 最大のボトルネックだった。**検査本体 + `tools/lib/*` のハッシュ**で指紋を作り、変わっていなければ飛ばす。**`tools/lib` を含めるのが要点**——共通関数が変われば検査の挙動も変わりうるので、含めないと**直したのに再検証されない**。**発火したケースだけ記録する**(落ちたものを記録すると、直さないまま次回から飛ばされる)。`--try` では保存しない(1 本の結果で全体を上書きすると他の記録を失う)。**並列化は採らなかった**——ケース X が置いた違反ファイルを、同時に走る別の検査が見て落ちる |
| **`check-braces` に内容ハッシュのキャッシュを入れた(71 秒 → 0 秒)** | 1,671 ファイル(7.8MB)を**1 文字ずつ 2 回走査**するので約 1,600 万回のループになり、`verify-checks` の所要時間の大半を占めていた。**更新時刻ではなく内容のハッシュ**で判定する——checkout やコピーで時刻だけ変わることがあり、そのたびに全件走らせては意味がない。逆に**内容が同じなら結果は必ず同じ**。キャッシュが壊れても**多めに走るだけ**で見落としは起きない。あわせて出力を「1679 ファイル検査」から「**1 / 1679 ファイルを走査・1678 件は前回から変更なし**」に変えた——飛ばした分を「検査」と書くと、`check-scan-reporting` が見張っている走査量の報告が実態とずれる |
| **`check-braces` がキーワード直後の正規表現を割り算と誤認していた** | preflight の遅い検査を測る過程で発見。`return /^\s*:\s*([^{;]+)/` のような**キーワードの直後の正規表現リテラル**を飛ばせず、中身の `[^{;]` を実コードとして数えて**正しい行を「壊れている」と言っていた**。判別条件が記号(`= ( , : [ ! & | ? { ; + * % < > ~ ^`)だけを見ており、**英字で終わるキーワード(`return` `typeof` `case` など)が抜けていた**。2026-08 に `check-build-ready` を直した際に実際に発火した。キーワード判定を足して解消。**検査の誤検出は「直したのに落ちる」形で作業を止める**ので、遅さの調査より優先して直した |
| **preflight が実質 2 倍走っていた** | **引き継ぐ人が最初に叩くコマンド**(`node tools/preflight.mjs`)が 900 秒でも終わらなかった。原因は `check-scan-reporting` が「走査量を報告しているか」を見るために**全検査を叩き直していた**こと(単体で 196 秒)。preflight が各検査の出力を記録し、`--from-cache` で再利用する形にした(2026-08)。**位置も最後に移した**——21 番目にあったので、そのままではキャッシュできるのが 21 本だけで残り 46 本は再実行だった。全件揃った状態では **196 秒 → 0 秒**。**古いキャッシュ(5 分超)は使わない**——`node_modules/.cache` は消えにくいので、検査を直した後に古い出力で判定されると「直したのに落ちる / 直っていないのに通る」形になる |
| **Docker の healthcheck が 2 サービスで欠けていた** | 開発用 compose の `db` / `mailpit` には healthcheck があるのに、**`redis` / `meilisearch` には無かった**。無いと `depends_on: condition: service_healthy` が書けず、**アプリが先に起動して接続に失敗**する。両方に追加(2026-08)。redis を永続化しない理由(レート制限の計数とロックしか置かず、消えても制限が緩む方向で締まる方向ではない)も明記した。**本番用 compose はアプリ自身の healthcheck が無く**、`restart: always` が「プロセスが落ちたか」しか見ていない——**応答しないまま生きている**状態(DB 接続が切れた・イベントループが詰まった)を検知できない。`/api/health` を叩く healthcheck を追加した(`start_period: 40s` で起動中の失敗を数えない) |
| **デモを 1 本追加(2026-08)** | `/japanese-form` — **日本の業務システムでしか要らない部品**をまとめた画面。今回の点検で足した `useFurigana`(ふりがな自動入力)・`formatWarekiDate`(和暦の年月日)・`isValidZipcode`(郵便番号の桁検証)・`toKatakana` を 1 つの画面で見せる。**「無いと自分で書くことになり、書くと必ず穴が空く」もの**ばかりなので、実例があると再実装を防げる。デモは 88 本に |
| **`check-doc-commands` が資料しか見ていなかった** | 復元訓練の障害を測るため `pnpm drill --dry` を流したところ、案内は正しく動いた。ただし **HANDOVER が「残る手作業は 1 つだけ」と書いているのに、drill は「人がやること 2 つ」**と出す食い違いがあった(修正済み)。あわせて **`check-doc-commands` の対象が `.md` だけ**だったのを `tools/*.mjs` にも広げた——`drill.mjs` が案内する `pnpm dev:internal` のような**人がコピーして貼るコマンド**が対象外で、存在しなければ訓練はそこで止まる。**ツールでは `console.log` の行だけ・バッククォート囲みを求めない・変数展開(`pnpm dev:${name}`)は飛ばす**の 3 条件が要った(素朴に広げると 6 件の誤検出が出た)。検査対象は 86 → 196 ファイル |
| **Card vs box の判断材料を揃えた(2026-08)** | 「全画面の見た目が変わるので目視確認が要る」として未決だった件を実測した。**色の差は明暗とも約 4%**(明 `#ffffff` → `#f5f6f6`、暗 `rgb(15,23,42)` → `rgb(24,32,50)`)で、**見た目は大きく変わらない**——目視の負担は当初の想定より小さい。内訳は基盤の部品が `--color-bg` 45 ファイル / `--color-surface` 8 ファイル、アプリの画面が `--color-surface` 126 ファイル(うち **83 ファイルが完全に同一の `const box`**)。**同じ画面に沈んだ面と沈まない面が混在**している状態。選択肢は A: 部品を `--color-surface` に寄せる(45 ファイル・説明どおりになる)/ B: box を `--color-bg` に寄せる(87 ファイル・境界が線だけになる)/ C: 説明を実態に合わせる(変更 0)。**A を実施した**(`Card` を `--color-surface` に変更)。**混在は解消**。ただし**入力欄・ボタン・浮くもの(ドロップダウン等)は `--color-bg` のまま**にすること——入力欄が沈むと面と同化して境界が消え、浮くものは影で表現する必要がある。**83 ファイルの `box` → `<Card>` 置き換えは見送った**——試したところ `<div style={box}>` → `<Card>` の置換で**閉じタグが `</div>` のまま残って構造が壊れた**(開始と終了の対応は入れ子を追わないと判定できない)。さらに `Card` の `shadow-sm` により**83 画面すべてに影が付く**という別の変更が混ざる。**背景が揃った時点で問題は解消**しており、置き換えは「同じものを 2 通りで書かない」ための整理なので急がなくてよい |
| **引き継ぎ資料の契約件数が古かった(5 → 8)** | HANDOVER に「契約は **5 件**(freee / google / paypal / zoho / line)」と書かれたまま、実際は **8 件**(microsoft / notion / slack を追加済み)だった。**これは「鍵を用意する」作業の対象数**なので、古いと準備が足りない。`check-doc-numbers` に契約件数のルールを足して見張るようにした(2026-08)。あわせて **`node tools/record-contract.mjs --list`** を新設——どのコネクタに何の鍵(全 21 個)が要るか、いま何が揃っているかを出す。**鍵を用意するのは人の仕事**なので、一覧が見えないと着手できない。さらに **C008**(記録に要る鍵が CI の Secrets に載っているか)を追加——**鍵を入れても CI が読めなければ記録は始まらない** |
| **`round` が負の数で非対称だった(明記のみ)** | 600 行超のファイル 7 件を調べたところ、**分割が要るものは無かった**(`smoke.mjs` は検査の集合体、`numbers.ts` は区分けが明確)。代わりに `round` の挙動を見つけた——`round(1.005, 2)` は `1.01` になるが **`round(-1.005, 2)` は `-1`**(`Math.round` は負で 0 に近づく)。**金額に使うと返金・値引きが小さくなる方向に丸められる**。ただし金額系(`tax` / `report` / `accounting`)は独自の丸めを持ち、`utils` を使っていないので**実害は無い**。TSDoc に「金額には使わない。`applyRounding` / `roundAmount` を使う」と明記し、負数のテストを追加した(2026-08)。`roundHalfEven`(銀行丸め)は負でも対称で健全 |
| **通知一覧が `limit` 未指定で全件返していた** | 画面 92 枚を調べたところ、通信するのは 7 画面だけ(大半がサーバコンポーネント)でエラー処理も概ね妥当だった。見つかったのは**件数の上限**——`notificationStore.list()` は `limit` を渡さないと**全件を読み込む**。通知は溜まり続けるので、**長く使っている利用者ほど遅くなり**、ある日「通知を開くと固まる」という形で表面化する。`api/notifications` はクエリ文字列の `limit` をそのまま渡すので**上限も無かった**。既定 50・上限 200 にし、**メモリ実装と Prisma 実装の両方**を揃えた(2026-08)——片方だけ全件返すと**開発では気づかず本番でだけ遅い**。掲示板の一覧は既に `DEFAULT_LIST_LIMIT` を持っており健全だった |
| **レート制限のキーが任意長だった** | API 228 本のうち**ボディを読むのは 109 本、そのうち 97 本にスキーマ検証が無い**(`as` で型を押し込むだけ)。ただし多くは認証済みの管理機能なので、**認証なしで叩ける `auth/login`** に絞って調べた。そこは `unknown` で受けて型を確認しており丁寧だったが、**長さ制限が無かった**——`email` はこの後 `login:${email}` という**レート制限のキー**になるので、毎回違う巨大な文字列を送るだけで**Redis にキーが溜まり続ける**。レート制限そのものが攻撃の的になる。ルート側に長さ検証(254 / 1024)を足し、**基盤側(`@platform/ratelimit`)でもキーを 256 文字で切り詰める**ようにした(2026-08)。切り詰めても別々の入力が同じキーになるだけで制限は緩まない。**残る 96 本の検証漏れは認証済みの経路**なので優先度は下げた——一括で直すなら zod スキーマの導入が要る |
| **削除しても関連レコードが残っていた(孤児レコード)** | Prisma スキーマは 69 モデルあるが `@relation` は **2 件だけ**で、参照は `xxxId String` で持つ設計(34 箇所)。そのため**親を消しても子が残る**。実際に 2 件——**① 掲示板の投稿**:親を消すと返信が残るが、`rootPosts`(replyTo が無い)にも `repliesOf(親)`(親が無い)にも出ないので、**DB に残り続けるのにどの画面からも見えない**。「削除したつもりの発言が残る」のは退職者の発言や誤投稿で問題になる。**② チャットのメッセージ**:リアクション・ピン・ブックマークが残り、「ピン留め一覧にもう無いメッセージが並ぶ」形になる。両方ともアプリ側で一緒に削除するよう修正(2026-08)。**スキーマに `onDelete: Cascade` を足す方が確実だが migration が要る**ので、まずアプリ側で揃えた——**次に migration を打つときに一緒に入れること** |
| **監査ログの改ざん検知が FNV-1a(32bit)のままだった** | `@platform/audit` は依存ゼロを保つため既定ハッシュに FNV-1a を持ち、TSDoc も「運用では sha256 を注入推奨」と書いていた。だが**アプリ側 2 箇所(`server/audit-log.ts` / `lib/audit.ts`)が既定のまま使っていた**。FNV-1a 32bit は出力が約 43 億通りで、**誕生日攻撃なら約 6.5 万回**で衝突が見つかる——「金額 10000 を 100000 に書き換えてハッシュを合わせる」が現実的な計算量になり、**改ざん検知の意味が無い**。両方に sha256 を注入した(2026-08)。**`verifyChain` にも同じ関数を渡すこと**(違うと全件が改ざん扱いになる)。基盤側の TSDoc も「推奨」から「**必ず注入すること**」に改めた——**推奨と書いても既定のまま使われる** |
| **自分自身への委任で権限が増えた** | `activeDelegations` が `from` と `to` を比べておらず、`{ from: "u1", to: "u1", roles: ["director"] }` が有効だった——**持っていないロールを自分で獲得できる**。委任の登録画面に「委任元」の入力があれば、**自分の名前を入れるだけで昇格**できてしまう。設定ミス(コピペで from と to が同じ)でも起きる。`from !== to` を条件に足した(2026-08)。**委任の連鎖は 1 段のみ**で循環しても無限ループしないことは確認済み(正しい設計)。承認まわりで 3 件連続——**「誰が操作できるか」だけでなく「誰と誰が同じであってはならないか」を扱う必要がある** |
| **並列承認を 1 人で満たせた(兼務者)** | `recordParallelApproval` が**持っているロールを一度に全部埋めて**いた。`approverRoles: ["経理", "法務"]` の `all`(全部署の承認が要る)に対し、両方のロールを持つ人が **1 回の承認で完了**させられる。**兼務は中小企業では普通**(経理と法務を同じ人が見る)なので、二重チェックのための仕組みが成立しない。**1 人 1 票**に修正し、同じ人の 2 回目も数えないようにした(2026-08)。既存の smoke が「兼務者 1 人で完了」を前提にしていたので、3 人が承認する形に更新——**検査が旧い仕様を固定していると、直したときに落ちて気づける**(これは検査が役に立った例) |
| **自己承認が通っていた(職務分掌の欠落)** | `@platform/workflow` の `approve` は**承認者ロールしか見ておらず**、申請者本人かを判定していなかった。`WorkflowState` が申請者を持っていないので**構造的に防げない**状態。承認者ロールを持つのは多くの場合管理職なので、**自分の経費を自分で承認**できてしまう——経費・稟議・発注の内部統制が成立せず、**監査で必ず指摘される**。`WorkflowState.requesterId` を足し、`approve` / `reject` / `sendBack` で弾くようにした(2026-08)。アプリ側(経費・勤怠の 3 箇所)も申請者を渡すよう修正。**`requesterId` が無い既存データは通す**——ここで落とすと過去の申請が承認不能になるが、**省くと自己承認が通る**ので新しいものは必ず渡すこと |
| **`check-risky-duplicates` を新設(2026-08)** | 「壊れると実害がある同名関数」(`escape` / `mask` / `valid` / `verify` / `safe` / `hash` / `token` 等)が複数パッケージに増えたら止める。**良し悪しは判断しない**——見つかったら ① 統合する ② 一致を見張る検査を足す ③ 差を明記して ALLOW に載せる、のどれかを選ぶ。既存 7 件は扱いを書いて ALLOW 済み。**`format` や `parse` は対象外**にした——表示が変わるだけで守りが弱くなるわけではなく、件数が多すぎて実害のあるものが埋もれるため。preflight は 64 本に |
| **同名関数の重複を全部洗った結果(2026-08)** | 「壊れると実害がある」名前(`escape` / `mask` / `valid` / `verify` / `safe` 等)で同名が複数パッケージにあるものを機械で抽出し、**7 件すべて**を確認した。**対応が要ったのは 5 件**——`maskEmail`(**1 文字が素通し・文字数が漏れる**)、`isValidEmail`(**画面と送信で 4 通り食い違い**)、`validateAttachments`(**既定なしで検証ごと飛ばす**)、`escapeHtml`(一致しているが乖離しうる→検査追加)、`unescapeHtml`(`&nbsp;` の扱いが違う→差を明記)。**健全は 2 件**(`isValidCorporateNumber` は結果が完全一致、`maskPhone` も一致)。**複製そのものは悪くない**——依存を増やさない判断は正しい。悪いのは**乖離を放置すること**で、統合しないなら**一致を見張る検査**を置く |
| **画面と送信でメール判定の基準がずれていた** | `isValidEmail` が `@platform/mail`(送信時)と `@platform/ui`(画面の入力チェック)にあり、**ui 側が緩くて 4 通り食い違っていた**——**254 文字超**・`日本語@例.jp`・`a@b..jp`・`.a@b.jp`。画面では「有効」なのに送信で弾かれるので、**利用者は直しようがない**(画面上は正しいため)。とくに 254 文字超は保存されてしまい、**通知が届かないのにエラーも出ない**。ui 側を mail と同じ式に揃え、smoke で一致を見張るようにした(2026-08)。**`ui` に `mail` 依存を張らない**のは軽さを保つためで、複製は意図的——だから見張る。なお `isValidCorporateNumber`(tax / validation)は結果が完全に一致しており健全だった |
| **添付の検証が「上限を渡さなければ何もしない」形だった** | `validateAttachments` は `board` / `chat` / `mail` の 3 箇所にあり、`board` と `chat` は**既定が無い**。さらに呼び出し側が `if (attachmentLimits && ...)` と書いており、**未指定だと検証ごと飛ばしていた**——件数もサイズも無制限に受け取る。`chat` は実際には上限を渡していたが、`board` は渡していなかった。基盤側に既定(10 件 / 10MB)を入れ、呼び出し側の条件も外した(2026-08)。`upload` の `maxSizeBytes` と同じ形で、**「指定を忘れた」が無防備になる設計**。既定を `upload`(25MB)より小さくしたのは、投稿の添付は**画面に並ぶ**ため大きいと表示が重くなるから |
| **`maskEmail` が 2 実装あり、片方が弱かった** | 「乖離しうる重複」を実害のあるものに絞って洗ったところ、`@platform/utils` と `@platform/pii` の `maskEmail` で**結果が違った**。utils 側は ① **ローカル部が 1 文字だとマスクせず素通し**(`a@example.jp` が丸ごと露出)② **アスタリスクの数が文字数と同じ**(`y*****@` で「6 文字」と分かり絞り込みの手がかりになる)。pii 側(`y***@` 固定)に揃えた(2026-08)。**既存のテストは `taro`(4 文字)だったので偶然通っていた**——境界(1 文字・6 文字)を含めていなかった。**同名の関数が複数あるとき、片方だけ弱いと「どちらを使ったか」で漏れ方が変わる** |
| **`escapeHtml` が 3 箇所にある(意図的な重複)** | 「名前が似ていて用途が違う」を横断で測ったところ、`@platform/html` / `@platform/mail` / `@platform/utils` がそれぞれ `escapeHtml` を持っていた。**基盤どうしの依存を増やさないための意図的な重複**(`html` は基盤依存ゼロ)で、現状は 3 つとも同じ 5 文字(`& < > " '`)を守っている。だが**片方だけ直すと守る文字が食い違い、片方だけ XSS を通す**。smoke に「3 実装が同じ文字を守る」検査を足した(2026-08)。**同じ対象を扱う関数が複数あるなら、統合しないなら一致を見張る**——依存を増やさない判断自体は正しいが、放置すると乖離する |
| **`isSafeUrl` と `isSafeExternalUrl` が紛らわしい** | 名前が似ているが**見ているものが違う**——`isSafeUrl`(`@platform/url`)は「**リンクにしてよいか**」で `javascript:` などのスキームを弾く。`isSafeExternalUrl`(`@platform/net`)は「**サーバから叩いてよいか**」で内部 IP を弾く。`isSafeUrl` は `http://localhost/` も `http://192.168.0.1/` も **true** にするので、**Webhook の送信先の検証に使うと社内ネットワークへの踏み台になる**(SSRF)。「安全な URL か」を探した人がどちらを見つけるかは運任せだったので、**相互参照を足した**(2026-08)。現在の利用は両方とも正しい(`safe-html` デモはリンク用途、`webhook-emit` は `isSafeExternalUrl`)。**名前が似ていて用途が違うものは、片方だけを読んで判断される** |
| **WebAuthn の署名検証に「これだけでは足りない」が無かった** | 「丁寧に書かれた箇所の隣に穴がある」を横断で測り(セキュリティを語る TSDoc がある**同じファイル**の、説明が薄い関数)、`webauthn.ts` で見つけた。個々の検証関数(`verifyClientData` / `verifyRpIdHash` / `isSignCountValid` / `verifyAssertionSignature`)は揃っているが、**どれも「これだけでは認証が完了しない」と書いていない**。WebAuthn は 6 つの検証を**すべて**通す必要があり、`verifyAssertionSignature` はそのうち 1 つしか見ない。**署名が正しければ本人**と考えると**チャレンジの使い回し(リプレイ攻撃)を許す**。6 つを番号付きで明記し、「チャレンジの保存・照合はアプリ側の責任」も書いた(2026-08)。**部品が揃っていることと、正しく組み立てられることは別**——`password-reset` と `recovery-codes` は同じ観点で調べたが健全だった |
| **利用者のアップロードを `inline` で返していた** | `showcase` の `/api/download/[key]` が `uploads/` 配下を `inline: true` で返しており、**ブラウザがその場で開く**。HTML や SVG を上げられると**このドメインでスクリプトが動き**、保存されたクッキーも読める。`image/png` と申告された HTML でも、ブラウザは中身を見て判断することがある。`attachment`(既定)に修正(2026-08)。**`inline: true` にしてよいのは、こちらが生成したもの**(帳票 PDF など)だけ |
| **アップロードの上限が既定なしだった** | `handleUpload` の `maxSizeBytes` が任意で既定が無く、**指定を忘れるといくらでも受け取る**(ディスクを埋められる)。既定 25MB にした——メール添付の上限に合わせた値で、これを超えるものはそのままでは他所へ渡せないことが多い。あわせて `allowedMimeTypes` の限界を明記——**`file.type` はクライアントが送る値なので偽装できる**。実行ファイルを `image/png` と申告すればこの検査は通るので、**「間違って別の形式を選んだ」を弾くためのもので攻撃を防ぐものではない** |
| **`faker` に「使ってはいけないところ」が無かった** | ダミーデータ生成は用途が明記されていたが、**誤用への警告が無かった**。3 つ書き足した(2026-08)——**① 本番データの穴埋め**(それらしく見えるので気づかれずに残り、架空の住所が請求書に載る)、**② 秘密の生成**(`setSeed` で再現できる**予測可能な擬似乱数**。トークンには `@platform/crypto` を使う)、**③ マスキング**(対応表が残れば戻せるし、件数や分布から特定されうる。`@platform/pii` を使う)。どれも**動いてしまう**ので検査では止まらない。現在の利用は seed スクリプトのみで正しい |
| **「限界の記述率」の測り方には限界がある(2026-08)** | 4 件目の `analytics` は 0% と出たが、実際は `uniqueVisitors` に「**種別を問わず数える**ので `pageViews` と**分母が揃わない**」と明記されていた。**測定の語彙が足りなかった**だけで、語を足すと 8% になり圏外へ。`google` も同様に消えた。また `faker` のように**パッケージ冒頭に書いた限界は関数単位の測定に入らない**。この指標は「低いから危ない」ではなく「**低ければ見る価値がある**」程度に使うこと——実際 `crypto` / `csv` / `google` の 3 件は当たった |
| **Google OAuth の `state` が任意だった** | CSRF 対策の `state` が `state?: string` で任意になっており、**渡し忘れが事故になる**形だった。state が無いと攻撃者が自分の認可コードを被害者のブラウザに送り込め、**被害者のアカウントに攻撃者の Google アカウントが紐づく**——以後その攻撃者がログインできる。`microsoft` の実装は最初から必須だったので、そちらに揃えた(2026-08)。アプリでの利用がまだ無いので破壊的変更にならない。あわせて `getGoogleUserInfo` に限界を明記——**メールアドレスだけでアカウントを紐づけない**(`emailVerified` が false のことがあり、他人のメールを登録した Google アカウントで乗っ取られる)。恒久的な識別子は `sub`。社内アカウントに限定するなら `hd`(ホストドメイン)を見る——メールの `@` 以降だけでは個人アカウントでも詐称できる |
| **壊れた CSV が黙って通り、データが欠けていた** | `parseCsv` は `a,"b,c` のように**引用符が閉じないと残り全部を 1 つのフィールドにする**。結果、**行数が減って列がずれる**が、取り込み自体は成功するので**データが黙って欠ける**。利用者が Excel で編集して壊すことが実際にある。`strict: true` で例外を投げるようにし(既定は `false` で既存の呼び出しを壊さない)、**業務データの取り込み経路(`parseCsvRecords`)では有効化**した。埋め込み改行(`"b\nc"`)は壊れていないので通る。「限界の記述率 0%」で選んだ 2 件目——`crypto` に続いて欠陥が出た |
| **パスワードハッシュのコストが Node の既定のままだった** | 「限界の記述が無い箇所が危ない」という仮説で測ったところ、**`crypto` は公開関数 9 個すべてに限界の記述が無かった**(0%)。実際 `hashPassword` / `deriveKey` が `scryptSync` の既定コスト(`N=2^14`)を使っており、**2010 年代の目安で現在の GPU には弱い**。`N=2^16`(手元で約 180ms)に引き上げた——OWASP 推奨の `2^17` は約 4.4 秒かかり、ログインのたびに待たせるので採らない。**`maxmem` も一緒に上げること**(scrypt は `128 * N * r` バイト使うので、`N` だけ上げると既定 32MB を超えて**例外になる**)。**コストをハッシュ文字列に含める形式**(`scrypt$N$salt$hash`)に変え、旧形式(`salt:hash`)も検証できるようにした——含めないと**保存済みハッシュが検証できず全員ログイン不能**になる。旧形式は利用者が次にパスワードを変えるまで残るので、この経路は消さないこと |
| **「参照できる仕様があると健全」という仮説は外れた(2026-08)** | セキュリティヘッダが健全だったことから「明文化された仕様を見ながら書いた箇所は壊れにくい」と仮説を立て、**仕様が読みにくい日本の法令系**(`depreciation` / `tax` / `dencho`)を調べたが、**3 件とも健全**だった。`depreciation` は定率法の切り替えを近似で実装しているが、**限界と影響を TSDoc に明記**している(「保証率・改定償却率は耐用年数ごとの表で決まる。ここでは表を持たず残存年数での均等額と比べる近似。耐用年数 5 年・100 万円で切替年に 1 円差。**申告書と一致させるなら省令の表を実装すること**」)。`tax` はインボイス制度の「税率ごとに 1 回だけ端数処理」を守り、`dencho` は真実性・可視性の要件ごとにファイルを分けていた。**健全さを分けているのは仕様の有無ではなく、「この実装で何が起きるか」を書いているか**——欠陥が出た `logger`(マスク対象)`env`(空文字)`bulkhead`(無制限)はいずれも**限界の記述が無かった** |
| **セキュリティヘッダは健全だった(2026-08 に確認)** | 「ブラウザ側の仕様による制約」を CORS・CSP でも探したが、**問題は無かった**。CORS の実装はそもそも無い。CSP は nonce + `'strict-dynamic'` 方式で、`X-Frame-Options: DENY` と `frame-ancestors 'none'` も整合していた。`script-src` に `'self'` と `'strict-dynamic'` が併記されているのは**書き間違いではなく保険**——新しいブラウザは `'strict-dynamic'` を見て `'self'` を無視し、CSP Level 2 までの古いブラウザは逆に `'strict-dynamic'` を無視して `'self'` で判断する。**どちらでも動く**ための書き方なので、理由をコメントに残した(知らないと「無意味な指定」に見えて消される) |
| **`SameSite=None` + `Secure` なしのクッキーは黙って破棄される** | ブラウザの仕様で、`SameSite=None` には `Secure` が必須。欠けていると**エラーも警告も出ずにクッキーが捨てられる**——「ログインできないが原因が分からない」という形になり、サーバ側のログにも何も残らない。`serializeCookie` は既定が `secure: true` なので通常は起きないが、**明示的に `secure: false` を渡すと素通り**していた。組み立て時に例外を投げるようにした(2026-08)。`clearCookie` も同じ経路を通るので一緒に守られる。**現在 `SameSite=None` を使っている箇所は無い**——外部サイトへの埋め込みや決済のリダイレクトで必要になったときに、先回りで塞げた形 |
| **`stripComments` がバッククォート 1 つで止まっていた** | TSDoc の中に `` `word` `` ではなく `` ` `` が 1 つだけ書かれていると、そこから先を**文字列として読み進めてコメント除去が止まる**。`packages/csv` の `@example` に書かれた `console.log` が除去されず、`check-package-rules` に置き換えた瞬間に**偽の違反**が出た。同じ行に閉じが無いバッククォートは文字列とみなさない形に修正(2026-08)。**共通関数に寄せると、それまで各所の実装が個別に持っていた穴が 1 箇所に集まる**——直せば全部直るが、壊すと全部壊れる |
| **`check-regex-pitfalls` を新設(2026-08)** | 「範囲を取り違える正規表現」を検査・生成ツール横断で見張る。同じ誤りを **9 回**繰り返し、共通関数を用意した直後にまた踏んだため、**思い出せなくても機械が指摘する**形にした。作った過程で `check-package-rules` / `check-tsdoc-params` / `check-build-ready` の 3 件を共通関数へ置き換え。**入れ子が来ないと分かっている用途**(Markdown リンクの `](...)`、`new Date()` の除去、`catch (...)`)は ALLOW に理由付きで登録した——ここまで弾くと使える形が無くなる |
| **同じ誤りが `check-build-ready` にもあり、本物の欠落を隠していた** | `[^)]*` で引数を取る書き方を検査・生成ツール横断で探し、`check-build-ready` の「戻り値の型がバレルから export されているか」を見る箇所で見つけた。`groupByDate(notifications, now: Date = new Date())` のように**既定値があると `)` で切れ、戻り値の型を取り違えて素通り**していた。`argsAt` に直したところ **`NotificationGroups` が export されていない**という本物の欠落が出た(利用側で TS2742/TS2883 になる)。**誤った検査は「緑」を返すので、隠れた問題があること自体に気づけない。** なお最初の横断測定では**コメントを除かずに 19 件**と出た(注意書きに `[^)]*` と書いてあるものを数えた)——これも同じ系統の誤りで 9 回目 |
| **「今」を UTC で数える関数が 6 箇所あった(検査の穴)** | `check-utc-date` は行単位で見ており、**引数の既定が `new Date()` の関数**は対象外だった。`age` を直した流れで関数単位の判定を足したところ、**新たに 6 箇所**見つかった——`agingBuckets`(売掛の年齢別残高。JST 早朝に**1 日分若く集計され、60 日超が督促対象から外れる**)、`checkRetention`(法定保存期間。**期限切れ書類を保持し続ける**)、`daysUntilEnd` / `renew`(契約の残日数・更新判定)など。各パッケージは `@platform/datetime` に依存していないので、9 時間ずらすだけの局所ヘルパー(`todayUtcFromJst`)で統一した。**検査を書くとき `[^)]*` で引数を取ると `= new Date()` の `)` で切れる**——同じ誤りは 2026-08 に 8 回繰り返しており、`argsAt`(`tools/lib/source-text.mjs`)を使えば防げる |
| **年齢が JST の誕生日当日の早朝に 1 歳少なく出ていた** | `age()` が `getUTCFullYear()` などで直接数えており、既定の `new Date()` は UTC 解釈になる。**JST の誕生日当日 00:00〜08:59 は 1 歳少なく**返っていた。年齢は**扶養控除・健康診断の対象判定・定年の計算**に使うので、1 歳のずれがそのまま業務の誤りになる。`formatDateJst` で JST の年月日にしてから比べる形に修正(2026-08)。**`@platform/datetime` は「日本の業務アプリで事故りやすいタイムゾーン境界を共通化する」パッケージ**なので、ここが UTC 基準だったのは目的に反する。`check-utc-date` は「`new Date()` から日付を切り出す形」を見張るが、**引数で受けた Date に `getUTC*` を使う形**は対象外だった |
| **目的を明示するパッケージ 8 件の確認結果(2026-08)** | 「防ぐ」「守る」と書いてあるものが実際に防げているかを横断で確認した。**問題があったのは 4 件**——`bulkhead`(待機列が既定 `Infinity` で、防ぐはずの資源枯渇を自ら起こす)、`logger`(「業務データの漏洩を防ぐ」のにマスク対象が認証情報だけで、マイナンバー・口座番号・住所が素通り)、`env`(「undefined 由来の謎バグを防ぐ」のに `.env` の空文字が通る)、`rpa`(「**タイムアウトを共通化する**」と宣言しながら既定なしで、指定しなければ効かない——RPA は外部システムを待つので、相手が応答しないと**直列化により後続が全部止まり**、`cron` から呼ばれていれば次回もスキップされ続ける。**業務が止まっているのにエラーも出ない**。既定 10 分、`0` で無効化可)。**健全だったのは 2 件**——`validation` は同名の重複が 0 件で、`ui/recipients.ts` の軽量なメール検証も TSDoc で「厳密にやりたいなら `@platform/validation` を使う」と案内済み。`access-review` は `asOf` を必須引数にして TZ の問題を呼び出し側へ委ね、名簿に無い権限を `high` と判定していた。**宣言した目的は実装者にとって自明すぎて検証されない**——「防ぐ」と書いた本人が防げているかを確かめるのは難しい |
| **`.env` の空文字が「設定済み」として通っていた** | `@platform/env` の説明は「実行時の **undefined 由来の謎バグ**を防ぐ」だが、`.env` に `SMTP_PASS=` と書くと値は `undefined` ではなく**空文字**になり、`z.string()` はそれを通していた。**`.env.example` は空で配られるので、コピーしただけの状態がこれ**——「設定した」つもりで空のまま本番へ出る。SMTP なら空パスワードで認証に失敗するが、検証は成功しているので**「設定漏れ」には見えない**。`parseEnv` が空文字・空白のみを `undefined` として扱うようにした(2026-08)。**既存のスキーマを変えずに効く**のが利点で、必須は落ち、`.optional()` / `.default()` は既定どおり動く。空文字を既定にしている箇所が無いことを確認してから入れた |
| **ログのマスク対象に業務データが無かった** | `@platform/logger` の説明は「**業務データの漏洩を防ぐ**」だが、既定のマスク対象は `password` `token` `email` など**認証情報だけ**だった。この基盤が実際に扱う**マイナンバー**(法律で扱いが厳しく原則ログに残さない)、**口座番号**(全銀ファイルの組み立てで扱う)、**住所**(59 箇所で使用)、**生年月日**(29 箇所)、カード番号が抜けていた。追加した(2026-08)。**「防ぐ」と書いてあるものは、何を防ぐかまで確かめる**——認証情報は誰でも思いつくが、業務データは扱う業務を知らないと列挙できない。`bulkhead` の既定が目的と矛盾していたのと同じ形で、**目的を明示しているパッケージ 8 件を横断で確認**して見つけた |
| **バルクヘッドの既定が、その目的と矛盾していた** | `createBulkhead` の待機キューが**既定 `Infinity`**(無制限に待つ)だった。このパッケージの説明は「**1 つの遅い依存が全体の資源を食い潰すのを防ぐ**」で、待機列が無制限だと**まさにそれが起きる**——外部 API が遅くなるほど待機が積み上がり、各待機が Promise とクロージャを保持し続ける。`queueTimeoutMs` も既定なしなので**永久に待つ**。利用者には「画面が返ってこない」としか見えない。既定を 1000 にした(2026-08)。**既定値は「指定を忘れた場合に目的を果たす」値にする**——実際の利用箇所(`zoho-client`)は正しく指定していたので、誰も気づかないまま残っていた |
| **SMTP が平文で送りうる / ffmpeg が終わらない** | 外部ライブラリの既定値を残る 4 つでも確認し、2 件見つけた。**① nodemailer の `requireTLS` 未指定** ——既定は false で、`secure` は port 465 のときだけ true。port 587(STARTTLS の標準)だと**サーバが STARTTLS に対応していなければ平文で送る**——認証情報も本文もそのまま流れる。**認証情報があるなら必須**という既定にした(認証なしのローカル SMTP は従来どおり動く)。**② fluent-ffmpeg にタイムアウトが無い** ——壊れた入力でプロセスが終わらず、**利用者がアップロードした 1 つの不正なファイルで CPU を占有され続ける**。10 分で `SIGKILL` する。`qrcode` は誤り訂正レベルを明示済みで問題なし。**外部ライブラリの既定値は 6 件中 6 件で確認する価値があった**(sharp・BullMQ・PayPal・Stripe・nodemailer・ffmpeg) |
| **決済の既定値が 2 つとも危険だった** | 外部ライブラリを包む箇所で「設定しなかった項目の既定」を横断で測り、決済系に 2 件見つけた。**① PayPal の既定が `live`(本番)** ——開発中に `environment` を渡し忘れると本番に繋がり、**本番の鍵が環境変数にある構成では実際に決済が走る**。既定を `sandbox` に変えた(「指定を忘れた」が本番事故になる既定にしない)。**② Stripe の `apiVersion` 未指定** ——アカウントの既定が使われる。Stripe は日付でバージョンを切り、**ダッシュボードから変更できる**ので、誰かが管理画面で上げるとこちらがデプロイしていないのに応答の形が変わり、**決済が突然失敗するのに原因が分からない**。`STRIPE_API_VERSION` で固定した。**外部ライブラリを包むときは、設定しなかった項目の既定値を必ず確認すること**——`rotate(0)` が EXIF を見ない件、BullMQ の保持設定も同じ形 |
| **終わったジョブが Redis に残り続けていた** | BullMQ は `removeOnComplete` / `removeOnFail` を指定しないと**完了・失敗したジョブを永久に保持する**。`createQueue` は再試行方針(指数バックオフ 3 回)だけを設定しており、保持の指定が無かった。日次 1 万件なら 1 年で 365 万件が Redis に残り、**メモリを食い尽くすまで気づかず、ある日突然キューが止まる**。完了は 1 時間 + 直近 1000 件、**失敗は 7 日 + 5000 件**に設定(2026-08)——調査に要るので長く残し、件数も多めに取る(障害時はまとめて失敗するので、少ないと原因のジョブが押し出される)。**「既定が無制限」の外部ライブラリ**は他にも潜むが、モジュールスコープの無制限な蓄積は横断で測って 0 件だった |
| **TSDoc を扱うツールは、自分自身の TSDoc で壊れる** | `docBefore` / `summaryOf` を `tools/lib/source-text.mjs` に足した際、**自分の説明文が原因で 3 回壊れた**——① 説明に開始・終了の記号(`/**`)を書いたら、自分の抽出がそこを掴んだ ② `@example` に `export function f` と書いたら、それを宣言と誤認した ③ 説明文中の「`@typedef` など」という**語**に反応して、正しい説明を捨てた。**ソースを解析するツールの説明文は、そのツール自身の入力になる。** 記号を含む例は避け、タグの判定は**行頭に限る**こと(`/^\s*\*?\s*@typedef\b/m`)。同じ抽出の誤りは 2026-08 に 3 箇所で見つかっており(`check-tsdoc` / `gen-reference` / `lib-find`)、共通関数に寄せた |
| **TSDoc が二重に貼られ、前のブロックが宙に浮いていた(78 箇所)** | `/** 1 行の説明 */` の直後に詳細な TSDoc が続く形が **78 ファイル**にあった。`check-tsdoc` は後者を見るので**検査は通る**が、1 行目の説明は誰にも読まれない(生成物にも載らない)。統合したところ、**2 件は 1 行説明が唯一の説明**で、機械的な統合で失われた——`sanitizeEmbed` と `verifyHmacSignature`。**一括変換は「消える側に情報が無い」ことを確かめてから**やること。復元時に書いた `@param` も実装と食い違い(`params` オブジェクトを個別引数と書いた)、`check-tsdoc-params` の P2 が即座に検出した。**直す作業そのものが新しいずれを生む**ので、直した後も検査を通すこと |
| **API リファレンスの説明 1,208 件が別の宣言のものだった** | `gen-reference.mjs` の TSDoc 抽出が `check-tsdoc` と同じ誤り(`[\s\S]*?` で前のブロックから掴む)を持っていた。**生成物なので影響が広い**——`docs/platform/api-reference.json` はポータルの API 一覧と AI 向けカタログの情報源で、**読む人は全員それを信じる**。実例: `AccessGrant`(権限を持たせた記録)の説明が「権限の棚卸しと退職・異動時の停止」という**パッケージ全体の説明**になり、`EmploymentStatus`(在籍の状態)は「対象者。*/ userId: string; …」と**コードの断片**が説明として出ていた。`(?!\*\/)` で限定して再生成(2026-08)。**同じ処理が 3 箇所にあり、正しかったのは `check-tsdoc-params` だけ**だった |
| **`check-tsdoc` が別の関数の説明を拾っていた** | TSDoc の抽出が `/\*\*[\s\S]*?\*\//` で、**非貪欲でも間に別のブロック(`@typedef` など)があると前のブロックから掴む**。結果「説明が無い関数を有ると誤認」しており、**完備率が実態より高く出ていた**。`(?!\*\/)` で閉じるまでに限定したところ、隠れていた不足が 2 件出た——① **作業者が `MAX_SEARCH_LIMIT` を挿入して `isSafeIdentifier` の TSDoc を分断した**もの ② `buildKeyframes` の説明が `@keyframes` で始まり、**行頭の `@` が TSDoc のタグと見分けがつかない**もの。`check-tsdoc-params` は最初から `(?!\*\/)` を使っており正しかった。**同じ処理が 2 箇所にあり、片方だけ正しい**——共通化していれば起きなかった |
| **`tools/lib` の共通処理を探す手段が無かった** | `advisor` は「新規作成の前に既存を再利用できる」ための仕組みだが、対象は `packages/*` だけで **`tools/lib` は対象外**。検査ツールを書く人は既存の共通処理を見つけられず、同じものを書き直す。実際 2026-08 に作業者が作った検査 5 本のファイル収集が `collectFiles` と完全に同じ実装だった。`node tools/lib-find.mjs` を足した(2026-08)。**作る過程で 3 回つまずいた**——`@example` のコード行が要約になる / `@typedef` ブロックを関数の説明と誤認 / 正規表現で `/** … */ export` を一度に取ると**間に別の TSDoc があっても前のブロックから掴む**。最後のものは非貪欲でも防げず、**export を先に見つけて直前のブロックを後ろから探す**必要があった |
| **除外ディレクトリの一覧が検査ごとにバラバラだった** | ファイル収集を自前で書いている検査 21 本のうち、**11 本が `.turbo` を除外していなかった**(`.next` `dist` `generated` の抜けも混在)。CI は `pnpm install` 前に走るので `.turbo` は存在せず問題にならないが、**手元で `pnpm build` した後に流すと検査ごとに結果が変わる**——「手元では落ちるが CI では通る」という最も追いにくい形になる。`tools/lib/collect-files.mjs` の `ALWAYS_SKIP` を export し、10 本を置き換えた(2026-08)。さらに**自前実装そのものを `collectFiles` に寄せた 5 本**(私が作った検査。中身が完全に同じだった)。自前で歩く検査は 21 → 16 本。残り 16 本は起点や条件が違う(1 パッケージだけ・ディレクトリ単位で判定する等)ので、**無理に寄せない**——共通化は「同じことをしている」ものだけに効く。書き方も 3 通り(`e.name === "x" \|\| …` / `[...].includes(e.name)` / `new Set`)に分かれており、**同じ意図が別々に書かれているほど食い違いに気づけない** |
| **共通関数を作った後、既存の検査にも同じ誤りが残っていた** | `tools/lib/source-text.mjs` を作った直後に、それを使っていない検査 62 本を横断で測った。`[^)]*` で引数を取るもの 6 件のうち **`check-unsafe-html` が実際に切れていた**(`setX(sanitize(escape(v)))` が `escape(v` で切れる。安全側に倒れるので実害は無かったが、**同じ書き方を写されると誤検出の側に倒れる**)。コメント除去 8 件のうち **`check-core-signatures` が素朴な実装**で、既定値に URL があるとシグネチャの後半が失われ「変更していないのに差分」になる状態だった。両方を共通関数へ置き換え、挙動が変わらないことを発火確認で検証。**共通化は作って終わりではない**——既存の呼び出し元を洗わないと、古い書き方が残ったまま「共通化した」という記憶だけが残る |
| **全銀ファイルの桁あふれを黙って切り捨てていた** | `padLeft` が `s.slice(-len)` で**下位桁だけを残していた**。合計金額 `1,234,567,890,123` 円が **`234,567,890,123` 円として銀行に届く**。銀行はトレーラの件数・金額を明細と突合するので通常は拒否されるが、**桁あふれした値同士が偶然一致すれば誤った金額で処理される**。例外を投げるようにした(2026-08)。右側の切り詰め(`padRight`・名称欄)は表示上の都合なので従来どおり——**数値は切り詰めた時点で別の数になる**ので扱いを分ける。なお TSDoc は `AppError` を投げると書いていたが実装は `Error` で、**このパッケージは純ロジックで基盤に依存しない**方針が正しい(依存を足すと smoke がソース直読みで落ちる)。TSDoc を実態に合わせた |
| **全文検索の `limit` に上限が無かった** | `fullTextSearch` は識別子(テーブル名・カラム名)を厳密に検証し、値は `Prisma.sql` でパラメータ化しており、**SQL インジェクションの心配は無い**。だが**値の妥当性**は別問題だった——`limit` は画面のクエリ文字列から渡る前提なのに範囲の検証が無く、`?limit=9999999` で全件をメモリに載せられる。負の値は PostgreSQL が例外を投げ、利用者には 500 に見える。`MAX_SEARCH_LIMIT = 1000` を設け、整数・範囲を検証するようにした(2026-08)。全件が要る用途(CSV 出力など)は**検索ではなくエクスポートの経路**で扱うこと。**「安全か」と「妥当か」は別に確かめる**——インジェクション対策が済んでいると、値の検証まで済んだ気になりやすい |
| **レート制限で「永久にブロックされる」経路が残っていた** | `packages/ratelimit` の Lua は `current == 1` のときだけ EXPIRE を設定していた。ファイル冒頭には「INCR 後に EXPIRE が失敗すると TTL が付かず永久ブロックになる問題を防ぐ」と書いてあり、**Lua 化でその経路は塞がっていた**。だが**別の入口が残っていた**——キーが既に TTL 無しで存在する場合(別経路で `SET` された・過去の不具合で残った)、INCR で 2 以上になり `== 1` は二度と真にならないので、**EXPIRE が永久に設定されずその利用者が制限され続ける**。`TTL == -1` のときも設定し直すようにした(2026-08)。**問題を認識して対策した後も、別の入口が残ることがある**——「防いだ」と書いてある箇所こそ、入口が 1 つだけか確かめる価値がある |
| **EXIF の向き補正が効いていなかった(スマホ写真が横倒しになる)** | `normalizeUpload` と `stripMetadata` が `{ op: "rotate", angle: 0 }` を使い、コメントにも「EXIF 向き補正」と書いてあった。だが **sharp の `rotate()` が EXIF を見るのは引数を省いたときだけ**で、`rotate(0)` は「0 度回す」という明示的な指示になる。スマホは写真を横倒しのまま保存して EXIF に向きを記録するので、**アップロードした写真が寝たまま表示される**。`{ op: "autoOrient" }` を追加し、`img.rotate()` を引数なしで呼ぶようにした(2026-08)。`stripMetadata` は**向きを反映してから EXIF を捨てる**順番が要る——逆だと向き情報がもう無い。テストで「`rotate()` が呼ばれ `rotate(0)` は呼ばれない」ことを固定した |
| **透かし文字の幅が全角を数えていなかった** | `watermarkTextSvg` が `text.length × fontSize × 0.62` で枠を作っていた。日本語は全角なので**「社外秘」が 40% 以上はみ出す**(計算 86px / 実際 122px)。東アジアの文字を 1.0em、それ以外を 0.55em として見積もる形に修正(2026-08)。**既定フォントが `sans-serif` である点は変えていない**——変えると英字の見た目が変わるため、TSDoc に「サーバで画像化すると日本語は □ になる。`fontFamily: "Noto Sans CJK JP"` を渡すこと」と明記した。`check-server-fonts` は CSS の `font-family:` を見るが、**SVG の `font-family=` は変数展開なので静的に判定できない**(該当は 1 件のみと確認済み) |
| **サーバで PDF 化すると日本語が □(豆腐)になる** | 帳票 5 つ(請求書・経費・月次・給与明細・PDF サービス)の CSS が `"Hiragino Kaku Gothic ProN"`(macOS)`"Yu Gothic"`(Windows)`"Noto Sans JP"` を並べていた。前 2 つはサーバに無く、**`"Noto Sans JP"` は Google Fonts の Web 版の名前**——Debian の `fonts-noto-cjk` が入れるのは **`"Noto Sans CJK JP"`**(別名)。全て外れて `sans-serif` に落ち、□ が並ぶ。しかも `apps/internal-app/Dockerfile` は `node:22-bookworm-slim` で**日本語フォントを 1 つも入れていなかった**。**画面は端末のフォントで描くので開発中は絶対に気づけない**——サーバ側で描く帳票だけが壊れ、文字化けでなく □ なので原因も分かりにくい。Dockerfile に `fonts-noto-cjk` を追加し、CSS 5 箇所を修正、`check-server-fonts` を新設(2026-08)。**メール本文は対象外**——受信者のメーラーが描くので端末のフォントを並べるのが正しい |
| **添付サイズの上限が「送れるはずが弾かれる」形だった** | `validateAttachments` は**復号後の実バイト数**で見ており(それ自体は正しい)、既定 25MB は Gmail と同じ数字に見える。だが送信時は base64 で約 1.37 倍に膨らむので、**25MB の添付は転送量 34MB** になり Gmail(25MB)でも Outlook(20MB)でも通らない。**こちらの検証は通ったのに相手に弾かれる**ので、原因が分かりにくい。`transferSize` を追加し(2026-08)、TSDoc に「既定 25MB は転送量 33MB を意味する。Gmail 宛に確実に届かせたいなら 18MB 程度」と明記した。TSDoc が**存在しない `allowedTypes`** を説明していたのも修正 |
| **走査量が「0 件」でも検査は緑になる** | `check-scan-reporting` は「数を出しているか」を見ていたが、**その数が 0 でも通っていた**。対象の指定を間違えた検査は `✅ 違反はありません(0 ファイルを検査)` と出して**永久に緑のまま**になる——ファイルはあり、CI でも走り、走査量も報告している。それでも何も見ていない。`check-api-error-shape` がアプリ名を手書きして showcase 17 件を取りこぼしたときも、件数は出ていたが誰も読まなかった。**数がすべて 0 なら落とす**ようにした(2026-08)。「検査がある」→「CI で走る」→「走査量を出す」→「**0 件ではない**」の 4 段でようやく、検査が機能していると言える |
| **正規表現で識別子を決め打ちすると数え落とす(同じ誤りを 4 回繰り返した)** | 2026-08 に私(作業者)が 4 回同じ形で誤った——`localeCompare\(([^)]*)\)` が入れ子括弧で切れて正しい行を誤検出、`@example` でコメントを先に除去して URL の `//` を巻き込み、`await res.json()` と変数名を決め打ちして `paypal`(`r.json()`)を数え落とし、そして**その誤りをそのまま `check-contract` の C007 に埋め込んだ**。`await\s+\w+\.json\(\)` に直したところ、今度は TSDoc の例に書かれた `await req.json()` で `packages/http` を誤検出——**コメントを除き、受信側(`req` / `request`)を対象外にする**必要があった(契約が見るのは「相手が返すもの」)。**検査を書くときは、①識別子を任意にする ②コメントを除く ③方向(送信/受信)を区別する** の 3 点を確かめること。なお他の検査 60 本を横断で測ったところ、同種の決め打ちは 0 件だった |
| **契約の「中身」も測ったが、8 件すべて健全だった(検査にはしなかった)** | C007 で網羅を揃えた後、**契約の必須フィールドが実装の依存と合っているか**を測った。「契約に無いが実装が読む」フィールドが google 3・microsoft 2・zoho 4 件出たが、**すべて任意項目として正しく扱われていた**(`json.expires_in ?? 3600` のように既定値がある)。必須として扱うものは契約と完全に一致。応答の型を持たない形(`line` の `LineProfile`、`slack` の `SlackApiResponse`、`notion` のジェネリクス)も、型定義を追うと契約どおりだった。**「実装が必須扱いするフィールド」を機械で判定するには型注釈の形が揃っている必要があり、この基盤は 3 通りの書き方がある**(インライン型・名前付き型・ジェネリクス)ので、確実な判定ができない。誤検出の方が害が大きいと判断して見送った。なお測定の途中で `await res.json()` と変数名を決め打ちして 4 件を「型注釈なし」と誤認した——`r.json()` `response.json()` もある |
| **契約テストの網羅に漏れがあった(10 中 5 が素通り)** | 外部 API の応答を読んでいるのは 10 パッケージなのに契約は 5 件しかなく、`ai` / `microsoft` / `notion` / `ocr` / `slack` が対象外だった。**いずれもアプリで実際に使われている**(slack 5・ocr 5・notion 3・microsoft 2・ai 12 ファイル)。とくに Slack は **HTTP 200 でも `ok:false`** を返す仕様で、そこを見誤ると「通知が飛んでいないのに成功」になる。`check-contract` に **C007(外部 API を読むのに契約が無い)** を足し、slack / microsoft / notion の契約とレコーダーを追加(2026-08)。`ai` と `ocr` は**宛先が利用側の設定で決まる**(プロバイダ差し替え・エンジン注入)ので理由付きで除外——契約は「相手の応答の形」を固定するものなので、相手が実行時に決まるなら固定しようがない |
| **CSV インジェクションが未対策だった** | Excel / Google スプレッドシートは、セルが `=` `+` `-` `@` で始まると**数式として実行する**。業務データ(備考欄・氏名・取引先名)は**利用者が自由に入力できる**ので、`=HYPERLINK("http://…","請求書")` のような値を仕込める。**表示は「請求書」に見えるので、受け取った人がクリックする**。先頭に `'` を付けて無害化した(Excel はこれを「文字列として扱う指示」と読み、セルには表示されない)。**負の数値は除外する**——`-500` を一律に無害化すると Excel で合計が計算できなくなり、差額・値引き・返金は負で入るので影響が広い。一方 `-1+1` は数値ではないので無害化する(2026-08) |
| **`@example` の残り(検証できない 87 件)は調べたが、検査にはしなかった** | 2026-08 に 3 つの切り口で測った。**① 括弧の対応** … 331 件すべて閉じていた(健全)。最初 5 件を検出したが、**コメントを先に除去したせいで URL の `//` がコメント扱いされ**閉じ括弧まで消えた自分の誤り——文字列を先に除去する順序が正しい。**② 例が呼ぶ関数の実在** … 58 件が「そのパッケージに無い」と出たが、大半は**他パッケージの関数を正当に使っている**もの(`core` の例が `notify` の `withRetry` を使う等)と例の中で定義した仮の関数で、**本物と見分けられない**。**③ `expect` を含む例** … 268 件中 1 件しかなく、その形を強制しても意味が無い。**「測ったが作らなかった」ことを記録に残す**——同じ切り口を次の人が再検討する無駄を省くため |
| **TSDoc が実装より多くを約束する形が繰り返し出る** | `formatWareki` は「令和8年**7月15日**形式」と書いて年で終わり、`normalizeZipcode` は「**7 桁に正規化**」と書いて桁を見ず、`stepUpRequired` は説明が `maxAgeMs`(ミリ秒)で実装は `freshnessSec`(秒)、`nowOffset` は同じ説明の中で「0..1」と「(%)」が矛盾していた。**`check-tsdoc-params` は引数名を見るが、戻り値が説明どおりかは誰も見ていなかった。** `@example` に `式; // 期待値` と書いてあれば実行して比べられるので `check-doc-examples` を新設(2026-08)。**読める分だけ確かめる**——`node_modules` が無い環境では基盤間依存を持つパッケージを読めないため、読めなかった分は skip する(誤検出より漏れを選ぶ)。現在 11 件を実行 / 87 件は比較対象外(**うち 4 件は `node_modules` が無いため未実行**——`pnpm install` 済みの手元では実行される。この内訳を出力に含めているので「11 件しか見ていない」ことに気づける)。拡張子なしの相対 import(`./rbac`。この基盤の標準で 481 ファイル)は Node が解決できないため、`tools/lib/ts-resolve-loader.mjs` で補っている。**そのローダーで `format: "module"` を指定してはいけない**——`--experimental-strip-types` の型除去が飛ばされて構文エラーになる |
| **郵便番号の「7 桁に正規化」が桁を検証していなかった** | `normalizeZipcode` は説明に「7 桁に正規化する」と書きながら**数字を抜き出すだけ**で、`"100-00011"` は 8 桁、`"東京都"` は空文字のまま**外部 API へ送られていた**。外部を無駄に叩くうえ、返る「該当なし」が**入力の誤りなのか実在しない番号なのか区別できず**、利用者に説明できない。`isValidZipcode` を追加し、`createAddressLookup` が桁違いを `VALIDATION` で弾くようにした(2026-08) |
| **ふりがなの自動入力が無かった** | 日本の申込・社員登録・顧客登録は氏名とふりがなの両方を求めるが、基盤に補助が無く**利用者に二度打たせていた**(打ち直すほど表記が揺れる)。`compositionupdate` の `data` で変換前の読みが取れるので、`useFurigana`(`@platform/ui`)と `toKatakana` / `toHiragana`(`@platform/utils`)を追加。**ふりがな欄は必ず編集可能にすること**——IME の読みをそのまま使うので人名では外れる(「日下部」を「ひのしたぶ」と打てばそう入る)。直せない画面にすると誤った読みが登録されたまま残る |
| **和暦に年月日の整形が無かった(帳票で使えない)** | `formatWareki` の TSDoc は「**令和8年7月15日**形式」と書いていたが、実装は「令和8年」と**年で終わっていた**。契約書・請求書・申請書など紙に出す帳票は年月日まで要り、官公庁提出物では西暦だけの表記を受け付けないものもある。`formatWarekiDate` を追加した(2026-08)。**月日は JST で解釈する**——`getUTCMonth()` で読むと UTC サーバでは JST の 8/1 早朝が 7/31 として出て、**日付が 1 日ずれた帳票**になる。元年は「令和元年」で「令和1年」と書かない(帳票の慣行。1 年目だけ表記が変わる) |
| **「検証できない」という分類が、一度書くと見直されない** | `verify-checks` の `NOT_VERIFIABLE`(仕組み上ファイル 1 つでは検証できない検査の一覧)を 2026-08 に棚卸ししたところ、**3 本は実際には検証できた**——`check-permissions`(policy に無い権限を置けば落ちる)、`check-showcase-deps`(宣言していない import)、`check-e2e-quality`(固定待ち)。とくに `check-permissions` は**同じ月にロール名を権限として渡す誤りを 13 箇所**見つけた検査で、その時点では**自己検証されていなかった**。理由が今も正しいかは**実際に置いて試すのが唯一の確認方法**なので、`node tools/verify-checks.mjs --try <検査名>` を足した(全部流すと数分かかり、疑ったときに試せない)。CASES は 35 → 38 本 |
| **検証用の残骸は、無関係な検査を落とす** | `verify-checks` はわざと壊れたファイルを一時的に置くので、途中で止まると残る。2026-08 に 2 回起きて、1 回目は `@platform/core: TSDoc 完備` が(説明の無い関数があるため)、2 回目は `check-preflight-coverage` が落ちたうえ**資料の「検査 N 種類」まで狂った**。どちらも**エラーの内容から原因に辿り着けない**——「core の TSDoc が落ちた」と言われて別ツールの残骸だとは思わない。`verify-checks` 側にも掃除を入れたが、**掃除するのは `CASES` に載っているものだけ**で、人が手で置いた検証用ファイル(発火を試したとき等)は対象外。名前の規則で拾う `check-leftover-fixtures` を新設した。**この検査自身に `check-verify-` を使わない**——自分を残骸として検出する(最初その名前を付けて実際に起きた) |
| **`verify-checks` が途中で止まると、検証用ファイルが残って別の検査が落ちる** | このツールは「違反を置いて赤くなるか」を確かめるので、タイムアウトや中断で**置いたファイルが残る**。すると `check-tsdoc` が「説明の無い関数がある」と落ち、**原因と無関係な検査が赤くなって追いにくい**(2026-08 に core と crud-template へ置いた検証用ファイルが残り、`@platform/core: TSDoc 完備` が落ちた)。実行前に前回の残骸を掃除するようにした。**既存ファイルを一時的に書き換える形(上限ファイルなど)は掃除しない**——本物を消してしまうため |
| **作った検査が preflight に登録されず、CI で一度も動いていなかった(8 本)** | ファイルは存在し、手で叩けば正しく動くので、**作った本人は「入れた」と思っている**。2026-08 に `check-cookie-parsing` / `check-api-error-shape` / `check-css-vars` / `check-allow-lists` / `check-ime-enter` / `check-locale-compare` / `check-scan-reporting` の 7 本が未登録で、置換スクリプトが対象文字列に一致せず静かに失敗したのが原因だった。さらに `check-locale-format`(サーバの `LANG` で帳票やメールの金額表記が変わる問題を見る)は **`verify-checks` にだけ登録され、preflight から抜けていた**——`verify-checks` は「違反を置くと赤になるか」を見るが、**CI で実際に走るかは見ていない**。`check-preflight-coverage` を新設(**`grep` 1 回で済むからこそ誰もやらない。確認は仕組みに載せないと続かない**) |
| **検査が「何件見たか」を出さないと、対象が縮んでも気づけない** | 緑の検査は読まれない。だから走査範囲が狭まっても誰も気づかない。実際にこの形で 4 件の取りこぼしが起きた——`check-utc-date` が `getFullYear()` 系を見ておらず**タイムゾーン依存 9 箇所**、`check-docs-links` が `docs/` しか見ずコード側の案内が対象外、`check-doc-numbers` の除外一覧の食い違いで手書き資料 3 件、`check-api-error-shape` がアプリ名を手書きして **showcase 17 件**。**走査量が出ていれば `1801 ファイル` が `12 ファイル` に落ちたときに気づける。** 13 本が数を出しておらず、すべてに追加した(`check-utc-date` → 2157 ファイル、`check-deps` → 120 パッケージ など)。書式は問わず**前回と比べられれば目的は果たせる**。`check-scan-reporting` が見張る |
| **サーバの TZ で年月日を解釈していた(9 箇所)** | `new Date().getFullYear()` は**プロセスのタイムゾーン**で解釈する。クラウドの既定は UTC なので、**JST の 1/1 00:10 に前年が返る**。会計 8 本(決算・年末調整・固定資産・元帳・出力)の**既定年**がこれで、「元日の朝だけ去年の帳票が出る」状態だった。`packages/sequence` の `periodToken` はさらに重く、**月次リセットの採番で 8 月最初の伝票に 7 月の連番**が払い出される(年またぎだと 1 年ずれ、影響が 12 か月続く)。`check-utc-date` は `toISOString()` だけを見ており、`getFullYear()` 系は**対象外**だった。検出を足し、`yearJst()` を `@platform/datetime` に追加して 9 箇所すべてを修正。**画面(`.tsx` / `packages/ui`)は対象外**——端末の TZ は JST なのでローカル解釈が正しい |
| **金額の表記がサーバの `LANG` に依存していた(110 箇所)** | `n.toLocaleString()` はロケールを省くと**実行環境の既定**で整形する。`LANG=de_DE` のサーバでは `1,234,567.89` が **`1.234.567,89`**(小数点とカンマが逆)になり、実際に `LANG=de_DE node -e` で再現した。**ブラウザだけの話ではない**——`apps/internal-app/src/server/`(アラート・帳票)と `packages/payroll` `packages/tax`(源泉徴収・印紙税のエラーメッセージ)が**サーバ側で金額を整形**しており、帳票やメールの表記が変わる。Node の既定は `en-US` だが、コンテナの設定次第で何にでもなる。**手元では正しく見え、テストも通り、環境を変えたときにだけ壊れる。** 110 箇所を `"ja-JP"` 明示に統一し、`check-locale-format` を新設。日時の未指定は 0 件だった(こちらは元から明示されていた) |
| **`localeCompare` のロケール指定漏れで並び順が環境依存だった** | ロケールを省くと**実行環境の既定**で比較する。`["経費","勤怠","給与"]` は未指定だと `勤怠 経費 給与`、`"ja"` 付きだと `給与 勤怠 経費`。漢字の氏名はさらに差が大きい(`["斎藤","伊藤","上田","阿部"]` → 未指定 `上田 伊藤 斎藤 阿部` / `"ja"` 付き `阿部 伊藤 斎藤 上田`)。**同じ画面を別の環境で開くと順序が違う**、という再現しにくい形になり、手元では正しく見えるのでテストも書きにくい。11 箇所が未指定で、うち日本語が入るのは 3 箇所(FAQ のカテゴリ「経費/勤怠」、ログの値、環境変数の分類「基本/秘密/機能」)。残り 8 は日付と ID なので指定不要。`check-locale-compare` を新設(**フィールド名とファイル位置から ASCII 専用かを判定**し、日付・ID は誤検出しない)。`DataTable` は最初から `"ja"` を渡しており正しかった |
| **負の金額が `¥-5,000` と表示されていた** | `formatYen` は記号を単純に前置しており、**還付・返金・差額をそのまま出すと `¥-5,000`** になっていた。日本の会計帳票では `△5,000`、一般的な画面では `-¥5,000` と書く。`packages/accounting` は消費税の還付(マイナス)を扱うので**実際に出る値**。第 2 の題材(経費申請)を作る過程で発見。`formatYen(value, "sign" | "triangle" | "paren")` に拡張した(既定は `sign`。既存の呼び出しは 0 件変更で済む)。**端数は絶対値で切り捨てる**ので `-1234.9` は `△1,234`(`△1,235` ではない)——テストで固定した |
| **日本語入力の変換確定で送信される(21 箇所中 20 が該当)** | 日本語入力では漢字を選ぶ操作そのものが Enter。`e.key === "Enter"` だけを見ると**変換を確定した瞬間に送信される**。「田中」と打とうとして「たなか」の変換を確定した時点で送られる。**英語環境では起きないので、英語で動作確認すると絶対に気づけない。** 基盤には `useComposition()` があり、デモ(`/inquiries`)にも「`isComposing` を見ないと変換を確定した瞬間にフォームが送信されます」と**警告が書いてあった**のに、見ていたのは 1 箇所だけだった。**部品と文書があるだけでは足りない。** しかも基盤の `autocomplete` / `tag-input` / `search-input` / `prompt-dialog` が該当しており、使う側すべてに伝播していた。21 箇所すべてを修正し `check-ime-enter` を新設(上限 0)。実地課題(会議室予約)を実際に作る過程で見つかったもの |
| **i18n と環境変数は健全だった(2026-08 に確認)** | 「参照はあるのに実体が無い」形を i18n と env にも当てはめて探したが、**どちらも 0 件**。翻訳キーは 4 言語(ja/en/zh/ko)でキー数が完全に揃っており、環境変数も 5 アプリすべてが `.env.example` と一致していた。ただし探索の途中で**私(調べる側)が 2 回誤った**: ① 名前空間(`namespaced("expenses", …)`)を追えず 7 件を「辞書に無い」と誤認 ② 正規表現の組み立てを誤り 39 件全部を「未参照」と誤認。**「見つかった」と思ったら、まず自分の測り方を疑うこと。** 実際に直す前に実物を開いて確かめれば、どちらも数分で分かった |
| **`.env.example` の 4 変数は grep しても呼び出し箇所が出てこない** | `MAIL_TRANSPORT` / `NOTION_DATABASE_ID` / `FREEE_ACCESS_TOKEN` / `GOOGLE_ACCESS_TOKEN` はコードのどこからも参照されていないが、**これは正しい状態**。基盤のアダプタは `createFreeeClient({ accessToken })` のように**引数で受け取る**設計で、環境変数を直接読まない。値を読んでアダプタへ渡すのはアプリ側の責任。「grep して見つからない = 設定漏れ」と誤解しないよう `.env.example` に注記した |
| **traceId は 0 件になった(2026-08・上限 0)** | 2026-08 に `internal-app` の 13 件と `line-console` の 8 件を消化し、**実アプリはすべて包まれた**。`equipment` の 5 ルートは `try/catch` すら無く、`requirePermission` の例外が Next 既定の 500 になっていた(本来 403)。除外したものは理由付きで ALLOW に登録: `chat/…/stream`(**SSE は 1 リクエストが数分〜数時間続くため、包むと計測が歪む**——ファイル冒頭にも同じ理由が書いてあった)、`auth/methods` と `maintenance-state`(**認可の前段**。包むと自分自身を締め出す)、`line/webhook` と `public-site/api/contact`(**社外が相手。内部の相関 ID を外へ出さない**)。`showcase` の 10 件も **デモはコピー元になる**ため潰した(包まれていない形が新しいコードへ広がる)。**262 / 262 が包まれ、上限 0**。1 件でも増えると preflight が落ちる |
| **line-console に traceId が入った(2026-08)。4 つ目のコピーは作らなかった** | このアプリだけラッパーが無く、8 ルートが traceId を返していなかった(LINE 応対は問い合わせ対応そのものなので、追えないのは特に困る)。**雛形の `withApi`(188 行)を写さず**、文脈を張るだけの 20 行のラッパーを置き、例外→応答の変換は `@platform/http` の `handleRoute` に委譲した。ついでに `check-api-error-shape` の判定も直した——**`toErrorEnvelope` を直接呼ぶことだけを条件にしていたため、基盤に委譲する望ましい書き方が減点されていた**。`/api/line/webhook` は素の 401 が仕様(相手は LINE のサーバで JSON の封筒を読まないし、載せると内部 ID を外へ渡すことになる)、`/api/auth/logout` と `dev-login` はリダイレクトが本体なので、いずれも理由付きで ALLOW に登録 |
| **P2・P4 は 0 件になった(2026-08)。残るは P3 のみ** | `check-tsdoc-params` の P2(実装に無い引数)と P4(存在しないプロパティ)は**どちらも上限 0**。1 件でも増えると落ちる。消化の途中で**検査自身の誤検出を 3 つ**直した: ① 1 行で書いた型を読めずプロパティ 0 件と誤認 ② 交差型(`A & { b }`)の片側しか見ない ③ `extends` で外部の型を継ぐもの(`ConnectOptions extends RequestDeviceOptions`)を空と誤認。**誤検出は、直す人を「実装が正しいのに文書を壊す」方向へ誘導する**——上限を減らそうとするほど品質が下がるので、件数が動いたら中身を疑うこと。残る P3(249 件)は `opts` と `options` のような表記ゆれが大半で、実害はほぼ無い |
| **検査の型読み取りが 1 行の型を読めず、正しい文書を誤って責めていた** | `check-tsdoc-params` は型定義を `interface X { … \n}` の形で探しており、**1 行で書いた型**(`export interface FormatNumberOptions { decimals?: number; thousandsSep?: string }`)は**プロパティ 0 件**と読まれていた。結果、正しく書かれている `@param options.thousandsSep` が「存在しないプロパティ」として P4 に計上されていた。**検査が誤って数えると、直す人は「実装が正しいのに文書を壊す」方向へ誘導される**——上限を減らそうとするほど品質が下がる。1 行用の式を分けて対応(既存の式に `\n?` を足すと非貪欲が効きすぎ、複数行の型を最初の `}` で打ち切って P4 が 22→34 件に増えた)。プロパティ抽出も行頭固定をやめた(1 行に `a; b` と並ぶため最初の 1 つしか拾えなかった) |
| **除外リストの重複キーが、理由を静かに消す** | 検査の除外はオブジェクトで書くことが多いが、JavaScript は同じキーを 2 回書いてもエラーにせず**後の値が静かに勝つ**。`check-docs-duplication` の `ALLOW` で `"検証"` が 2 回定義されており、**先に書いた理由が消えていた**。動きは変わらないので誰も気づかない。除外の理由が消えると、次の人は「なぜ許しているのか」を調べ直すことになり、分からなければ外してしまう(すると本物の指摘が復活して混乱する)。`tools/` は `eslint.config.mjs` の対象外なので `no-dupe-keys` も効かない。`check-allow-lists` を足した(2026-08)。**除外は 13 リスト・のべ 50 項目以上あり、そのすべてが「なぜ許すか」の記録でもある** |
| **検査の「除外」が、検出したかった誤りそのものを飛ばしていた** | 13 か所が `requirePermission(user, "admin")` と**ロール名を権限として**渡していた。`admin` は policy に権限としては存在せず、admin ロールの `"*"`(全許可)に救われて動いていただけ。**`"*"` を外した瞬間に管理者まで 403** になる状態で、policy 自身の「運用操作は名前を明示しておく」という方針とも逆行していた。`check-permissions` は既にあったが、**「`:` を含まないものはロール名なので対象外」という除外**を持っており、まさにこの形を素通りさせていた。除外を消し、ロール名だと分かったらそう指摘する形にした(2026-08)。`"system:manage"` に修正済み。**参照はあるのに実体が無く、別の何かに救われて気づけない**——`--font-mono` がフォールバックに救われていたのと同じ型 |
| **定義していない CSS 変数が参照されていた** | `--font-mono` を参照する箇所が 4 つあったが、**`tokens.css` に定義が無かった**。`var(--font-mono, monospace)` とフォールバック付きだったので画面は壊れず、**誰も気づかないまま素の `monospace` で描画**されていた。残り 110 か所は最初から素の `monospace` を直書き。多くの環境でこれは Courier に落ち、細く小さく描画されて**等幅にした目的(ID・ログ・金額の桁合わせ)が果たせない**。トークンを定義し、118 か所を `var(--font-mono)` に統一した(2026-08)。`check-hardcoded-colors` は色を見張るが、**フォントには同じ見張りが無い**——`--color-*` 以外のトークンも同様に未定義のまま参照されうる |
| **基盤の `Card` が使われず、59 ファイルが囲み枠を手書きしている(要判断)** | `<Card>` を描画しているのは **4 ファイル**、`const box: React.CSSProperties = {…}` を自作しているのは **59 ファイル**(うち **49 が完全に同一**)。**自作側はすべて `@platform/ui` を import しているのに `Card` を 1 つも使っていない**——部品を知らなかったのではない。原因は背景トークンの食い違いで、`tokens.css` は `--color-surface` を「**面(サイドナビ・カード・パネル)の背景。本文より一段沈ませる**」と定義しているのに、`Card` は `--color-bg`(本文と同じ)を使っている。自作側は 59 ファイルすべてが `--color-surface` を選んでいる。**ui の部品 40 個が `--color-bg`、`--color-surface` を使うのは 1 個だけ**なので、部品全体が説明に従っていない。直すと**全画面の見た目が変わる**ため目視確認が要る。`Card` を `--color-surface` に寄せるか、トークンの説明を実態に合わせるかは未決 |
| **同じラッパーが 4 段階あり、基盤自身のものが一番弱かった** | API の例外を応答に変える処理が 4 通りある: `handleRoute`(`@platform/http`・**基盤**)、`withApi`(雛形・188 行)、`withApiObservability`(社内アプリ・125 行)、そして**何も無い**アプリ。2026-08 まで、**基盤の `handleRoute` だけが traceId を付けていなかった**。呼び出し側は「基盤の作法どおりに書いた」つもりで、利用者の申告とログを突き合わせられない応答を返していた(showcase の 6 ルートが該当)。`getRequestId()` を見る形に直し、コンテキスト外では何も付けない(バッチ・起動時に壊れない)。**雛形の `withApi` は基盤パッケージにしか依存していない**ので、基盤へ引き上げる余地がある(新しいアプリを作るたび 188 行がコピーされる) |
| **同じ対応表が 2 か所にあり、1 行だけ食い違っていた** | `@platform/http` の `STATUS_BY_CODE` が独自の表を持ち、**`DATABASE` が 500(core の `ERROR_POLICY` は 503)**。同じ `AppError(DATABASE)` が `toHttpError` を通ると 500、`httpStatusFor` を通ると 503 になっていた。503 には「一時的なので後で再試行してよい」という意味があり、500 だと呼び出し側もロードバランサも監視も再試行の判断ができない。**10 行のうち 9 行が一致していたので、見比べても気づきにくい**。`ERROR_POLICY` は自ら「唯一の情報源」と宣言しているので、http 側は表を捨てて導出する形にした(2026-08)。smoke が「http が独自の数値表を持たないこと」を見張る |
| **「基盤にあるのに使われていない」は、包んでいる側を見てから言う** | 2026-08 に「`errorResponse()` が 227 ルート中 2 つしか使われていない」と数えて検査を作ったが、**前提が誤っていた**。実際は `withApiObservability()` が全体を `catch` し、`AppError` は `httpStatusFor()` で正しいステータスに、応答は `toErrorEnvelope(e, span.traceId)` で **traceId 付き**にしていた。**211 ルートがこのラッパーを通っている**。呼び出し側だけを数えて、包んでいる側を見なかったのが誤りの原因。作り直したら該当は **168 件 → 27 件**になった(`check-api-error-shape`)。**残る 27 件は本物**で、包まれていないため例外が Next 既定の 500 になり、`x-request-id` も返らない。`/api/health` `/api/metrics` `/api/status` は観測の入れ子を避けるため ALLOW に登録済み |
| **`fetch` の受け取り方が 3 通り併存している(要判断)** | 「注入された `fetchImpl` が無ければグローバルの `fetch` を使う」という同じ処理に 3 つの書き方がある: `?? fetch`(素・**14 ファイル**)、`?? (globalThis as unknown as { fetch: typeof fetch }).fetch`(キャスト付き・**96 ファイル**)、`?? globalThis.fetch`(キャスト無し・**2 ファイル**)。`tsconfig.base.json` の `lib` は `["ES2022"]` で DOM を含まないが、`packages/ai` は base 継承のまま**素の `fetch`** で通っている(`@types/node` が供給しているとみられる)。つまり**キャストは要らない可能性が高い**が、`check-dom-lib` が警告するとおりこの領域は「**テストは全部緑でも `tsc` だけが落ちる**」ため、`tsc` を通せない状態で 96 ファイルを一括変更してはいけない。**やるなら: ① 1 ファイルだけキャストを外して `pnpm build` を通す ② 通れば共通ヘルパー(`resolveFetch`)の置き場所を決める(90 ファイルは `apps/internal-app` のクライアント部品で、いずれも `@platform/ui` を import 済み。`@platform/ui` の `lib` には DOM がある) ③ 一括置換**。中身は同じなので、順番を守れば安全に消せる |
| **残債表に出ない重複がある** | `pnpm debt` は**検査済みの残債**しか見せない。上限ファイルを持たない重複は表に出ない(クッキー正規表現 249 か所がそうだった)。2026-08 に `pnpm dup` を足した。**合否は出さない**——重複には正当なものが多く(`async function handleGET(req: Request)` は規約)、機械が言えるのは「同じ行が何ファイルにあるか」まで。最初の収穫は `const yen` が **12 種類 37 か所**で、同じ金額が `¥1,234.56` / `¥1,235` / `¥1234.5600` / `1,234.56 円` と画面ごとに違って出ていたこと。うち 2 件は**単位や精度が違うのに同じ名前**(万円入力で 10000 倍ずれるもの、1 円未満まで出すもの)だったので改名した。残りは基盤の `@platform/report#formatYen` に寄せるか要判断 |
| **同じ 1 行が 249 か所にコピーされ、同じバグを持っていた** | `req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1]` が `apps/internal-app` に 249 か所(別途 `line-console` にも 1 か所)。この正規表現は**部分一致**なので、`zoho_session=...` のように**名前が `session` で終わる別のクッキー**があるとそちらの値を返す。**このアプリは Zoho 連携**なので現実的な危険だった。URL エンコードも解けない。型検査も lint も smoke もすべて通っていた。`check-reimplementation` は**基盤と同名の関数**を見るので、「関数を作らずその場に直書き」する形は素通りする。2026-08 に `currentUser(request)` へ寄せて一掃し、`check-cookie-parsing` を足した |
| **セッションが基盤の再実装で、中身が読める** | `apps/internal-app/src/server/zoho-session.ts` は `@platform/session` の再実装(`check-app-rules --bypass` が数える唯一の 1 件)。**HMAC 署名だけでペイロードは base64 のまま**なので、クッキーを見れば email と roles が読める。基盤の `createSession` は暗号化する。**第一段階(クッキー解析を基盤へ)は完了済み**——呼び出し側 249 か所の正規表現の自作は解消し、`getCookie` を通している。

**残る移行(暗号化への切り替え)は判断待ち。** そのまま入れ替えると**全員ログアウト**するが、**避ける手順はある**:

1. **読む側を先に両対応にする** … `verifySession` が失敗したら `@platform/session` の `read` も試す(逆でもよい)。この時点では**まだ古い形式で書く**ので、誰もログアウトしない
2. **書く側を切り替える** … ログインと更新で新形式を発行する。既存のセッションは古い形式のまま読めるので、**利用者は何も気づかない**
3. **期限が切れるまで待つ** … セッションの `maxAge`(既定 8 時間程度)を過ぎれば、全員が新形式になる
4. **古い側を消す** … 1 で足した読み取りを外す

**3 の待機を飛ばさないこと。** 飛ばすと 2 の直後に古いセッションが読めなくなり、結局全員ログアウトになる。

**緊急ではない。** クッキーの属性は正しく(`httpOnly` / `secure` / `sameSite: lax`)、**JavaScript からは読めない**——盗み見るには端末そのものを操作する必要がある。危険は「共用端末で開発者ツールを開かれる」程度。**1 を今実装しても効果はゼロ**(新形式で書く側が無いので必ず失敗する)うえ、鍵が未設定の環境で例外が出ると**ログイン自体が壊れる**ので、**2 と一緒に進めること** |
| **検査は足せているが、消化する段が無かった** | 上限方式は増加を止めるだけで、既存分は放っておけば永久に残る。`check-tsdoc-params` の P4 は**追加した時点の 92 件がそのまま上限**になり、うち 20 件は zoho の `config.dc` ——**その検査を追加した動機そのもの**——が手つかずで残っていた。検査は毎回 `⚠`(上限内)を出すが preflight は緑なので誰も読まない。2026-08 に `pnpm debt`(残債の一覧と推移)、`check-debt-slack`(**直したのに上限を下げ忘れ**を止める。緑のまま守れていない唯一の穴)、月次ワークフロー `debt`(記録と、3 か月動いていなければ Issue)を足した。**順位は機械が付けない**。「直しやすいものから」だと危険なものだけが残る |
| `@platform/core` | **多数のパッケージが依存**（実測は check-core-signatures が示す）。引数を変えるだけで全体が壊れる（`check-core-signatures` が守っている） |
| `tools/smoke.mjs` | 12,000 行超。**227 の `section()` で区切ってある**ので検索で辿れる |
| パッケージの追加 | **数の更新は不要になった**（2026-08）。smoke の 6 か所が `=== 114` と書いており、1 つ足すたびに落ちて「数字を直す作業」だけが残っていた。ディレクトリの実数と突き合わせる形に変え、**取りこぼしの検出はそのまま**残してある。いま足すと落ちるのは「資料の数値」（`check-doc-numbers --fix` で直る）と「新パッケージの構成不備」（`pnpm scaffold` が生成する）の 2 つで、**どちらも直すべきもの**。展開そのものは `docs/ops/PACKAGE_CONSOLIDATION.md` |
| TSDoc は「完備」でも中身が合っていないことがある | `check-tsdoc` は**書いてあるかしか見ない**。2026-08 に `check-tsdoc-params` を足して測ったところ、**並び順が実装と逆の関数が 7 件**あった(`reconcile(invoices, payments)` の説明が `(payments, invoices)` など)。型が同じだと**黙って入れ替わる**。P1(並び順)は 0 を保つ。P2/P3 は上限方式 |
| ドット付きの @param は中身まで見ないと嘘が通る | `@param options.foo` は**先頭(`options`)しか照合されない**設計だと、中身が出鱈目でも通る。実際 2026-08 に機械的に寄せたら `config.dc`(正しくは `dataCenter`)が素通りした。`check-tsdoc-params` の P4 が型のプロパティまで見る |
| 文書にあるのに実装に無い機能がある | 上の検査の P2 は、単なる文書の古さではなく**「作ると書いて作らなかったもの」の一覧**でもある。**2026-08 に 21 件すべてを解消し、上限を 0 にした**(1 件でも増えると落ちる)。中身は単なる引数名のズレではなく、次のような**読み違えると壊れるもの**が含まれていた: `stepUpRequired` の説明が `maxAgeMs`(ミリ秒)、実装は `freshnessSec`(**秒**)——ミリ秒を渡すと 1000 倍ゆるくなり**再認証が事実上働かない**。`nowOffset` は同じ文書内で「0..1」と「(%)」が矛盾——100 倍して使うと画面外へ飛ぶ。`isSuppressed` は「**カテゴリ単位で停止できる**」と書いてあるが実装にカテゴリは無い。`toggleAll` は「選ぶか解除するかを渡す」と書いてあるが、実装は現在の状態から決める。`image.ts` の 3 関数は**旧版と新版の `@param` ブロックが二重に貼られたまま**だった。なお、以前この行が例に挙げていた `extraHolidays` と `hashApiKey` の pepper は**どちらも既に解決済み**で、警告している当の文書に古い記述が残っていた |
| pnpm は PowerShell では「スクリプト」 | Windows の `pnpm` は corepack が置く **`pnpm.ps1`**(`Get-Command pnpm` の CommandType が `ExternalScript`)。これに **`*> $null` を付けると成功しても終了コード 1 が返る**。「`pnpm smoke` は 1640 passed なのに setup だけ失敗する」形で踏んだ。出力を捨てたいときは変数で受ける(`$null = & $cmd 2>&1`)。`\| Out-Null` は問題ない |
| PowerShell は外部コマンドの stderr で止まる | `$ErrorActionPreference = "Stop"` のとき、外部コマンドが stderr に 1 行書いただけで **PowerShell 5.1 は致命的エラーにする**。`docker info` は正常時でも `WARNING: No blkio throttle...` を出すため、**Docker が動いていても setup が落ちた**。エラー文は PowerShell 内部のもの(NativeCommandError)で Docker の問題にしか見えない。`Test-Native` / `Invoke-Native` 経由にし、成否は `$LASTEXITCODE` で見る |
| `query` のようなオブジェクトは useMemo の中で組む | 外で作ると毎描画で新しい参照になり、依存配列に入れられない。中身だけを依存に並べると `exhaustive-deps` が「足りない」と警告する。**useMemo の中で組めば**警告も消え、何に依存しているかも読み手に伝わる |
| ブラウザ向けサブパスは**バレルを経由しない** | `@platform/sms/browser` が `./index` を再 export しており、そこから twilio まで辿られて **build が落ちた**(サブパスを作ったのに意味が無い状態)。中核を `core.ts` に切り出し、バレルとブラウザ入口の**両方がそこを参照する**形にした。検査もサブパスを対象に含め、相対 export を**最後まで辿る**(1 段だけだと 2 段先を見逃す)。ただし **`import type` は追わない**(実行時に消えるため。追うと誤検出になる) |
| client から**サーバ専用パッケージ**を読むと build だけが落ちる | `bullmq` / `ioredis` / `twilio` は `node:` 接頭辞**なし**で `fs` / `net` / `dns` を require するため、`check-build-ready` の FATAL(接頭辞つき)を素通りしていた。typecheck も lint も smoke も通るのに **`next build` が 14 件のエラー**で落ちる。`@platform/jobs/browser` などのサブパスへ逃がし、検査もサーバ専用 npm パッケージを辿るよう拡張した |
| フックは早期 return より前で呼ぶ | `TimelineChart` が `if (allX.length === 0) return null;` の**後ろ**で `useState` / `useRef` を呼んでいた。React はフックの呼び出し順で状態を対応づけるため、**データが空のときだけ順序がずれ、別の状態を読む**。`react-hooks/rules-of-hooks` を有効にして初めて出た(それまで lint 自体が TS を見ていなかった) |
| 無効化コメントは「そのルールが設定されている」前提 | `// eslint-disable-next-line react-hooks/exhaustive-deps` が 10 ファイルにあったが、**ルール自体が設定されておらず**「そんな規則は無い」というエラーになっていた。無効化を書くときは、そのルールが `eslint.config.mjs` で有効かを確かめること。逆に**有効でないルールの無効化は消す**(`no-control-regex` が「未使用の指示」警告になっていた) |
| **秘密値は `===` で比較しない** | `===` は一致した文字数だけ時間が変わり、差を測れば 1 文字ずつ正解を絞り込める。プレビュートークンと API キーのハッシュがこの形だった。`@platform/crypto` の **`safeEqual`** を使う(**長さ違いでも早期 return しない**)。smoke が見張る(空文字比較と確認欄の一致判定は対象外) |
| ReDoS は**形ではなく実測**で見張る | lint の `detect-unsafe-regex` は入れ子の量指定子を形だけで見るため、内側が排他的な文字クラスなら安全でも警告する。指摘 10 件を実測したら**全部が誤検出**だった(1ms 未満)。ルールは切り、smoke が時間を測る |
| 正規表現を足したら実測の検査にも足す | 上の smoke「破滅的バックトラック」に 1 件足す。攻撃文字列を与えて 200ms 以内に終わることを見る |
| 誤検出の多いルールは切る | `security/detect-object-injection` は `obj[key]` を一律に警告し、**約 500 件のうち 9 割以上**を占めていた。TS では型付きアクセスも同じ形なのでほぼ誤検出。**本物(ReDoS・非リテラルなパス操作)が埋もれる**ため切ってある。プロトタイプ汚染の防止は実装側の責任(利用者の入力をそのままキーにしない) |
| lint が「緑」ではなく「走っていない」ことがある | **ESLint 9 は既定で `.js` 系しか見ない。** `eslint.config.mjs` に `files` と TypeScript のパーサが無く、**TS が 1 ファイルも lint されていなかった**(`eslint src` は「all of the files … are ignored」で異常終了)。検査があるつもりで無い、という最も質の悪い形。**typescript-eslint の推奨ルール一式は入れていない** — 守りたいのは境界と危険なパターンで、書き方は tsconfig の strict と 47 種の検査が見ているため |
| `.d.ts` は置くだけでは外から見えない | 型定義を持たない外部ライブラリ用の `.d.ts` は、**同じフォルダに置くだけでは自分の tsconfig の include に入るだけ**。`apps/showcase` のように外から `index.ts` を辿ってきた場合はプログラムに含まれず TS7016(暗黙の any)になる。**`/// <reference path="./xxx.d.ts" />` を index.ts の先頭に書く**(`barcode` は書いてあり `media` は漏れていた)。また `.d.ts` にトップレベルの import/export を書くと「モジュール」になり、`declare module` が宣言でなく**既存モジュールの拡張**になる |
| 移行の取り残しは typecheck でしか出ない | 自作 SVG グラフ → `ComboChart` への移行で、**未使用の定数が残り import が漏れていた**(`cashflow-client.tsx`)。smoke も `check-handmade-chart` も通る。この層は **`pnpm typecheck` が唯一の網**。JSX タグの import 漏れを正規表現で検出しようとしたが、ジェネリクス(`useState<RunResult>`)や TSDoc 内の記述と区別できず**誤検出だらけ**になったので入れていない |
| **「終了コード null」はプロセスを起動できていない印** | Windows の `pnpm` は `pnpm.cmd` / `pnpm.ps1` であって実行可能ファイルではない。`spawnSync("pnpm", …)` を `shell: true` なしで呼ぶと起動できず、`status` が **null** になる(エラーは `r.error` に入る)。`tools/db.mjs` がこの形で、**Windows では一度も動いていなかった**(setup は pnpm を直接呼んでいたため気づかれなかった)。`pnpm` / `npx` / `prisma` / `tsc` などは `shell: true` で起動する |
| package.json に shell のコマンドを直に書かない | `rm -rf` などは **cmd.exe に無い**ので Windows で止まる(`pnpm clean` と `pnpm fresh` が動かなかった)。掃除は `tools/clean.mjs`(Node の `fs.rm`)に寄せてある。同種のコマンドが混入していないか smoke が見張る |
| JSX コメントは要素の中にしか置けない | `{/* … */}` を `return (` や `map((x) => (` の**直後**に書くと構文エラー。`command-palette.tsx` / `log-viewer.tsx` がこの形で、typecheck が 22 件のエラーを出した。`check-syntax` なら捕まえられるが**あれは TypeScript の導入が要る**ので、依存なしの smoke でも弾くようにした。説明は要素の外に **`//` で書く** |
| 実装を厳しくしたらテストも見直す | `createSession` が**負の `maxAgeSec` を起動時に落とす**ようになったが、単体テストは `maxAgeSec: -1` で「即座に期限切れ」を作る古い形のまま残り、`pnpm test` で 1 件だけ落ちた。smoke には「負の秒数は落とす」検査があったので、**smoke は緑・test は赤**という食い違いになった。期限切れは `vi.useFakeTimers()` で時間を進めて再現する |
| smoke が緑でも型は通っていない | smoke は **node が型を落として実行するだけ**で、型検査をしない。しかも `@platform/core` をスタブに差し替えるため、**スタブが緩いと型の誤りを覆い隠す**。実際 `storage/operations.ts` が `AppError` の代わりに素の `new Error()` を返しており、smoke は 8 項目すべて緑なのに `pnpm typecheck` で 4 件落ちた。**スタブは本物と同じ形にすること**、そして **`pnpm check`(typecheck→lint→smoke)を通すこと** |
| 検査が「生成物」を見てしまう | `apps/*/src/generated/`(Prisma クライアント)には `process.env.DATABASE_URL` や色の直書きが含まれる。除外しないと **`prisma generate` を実行した環境だけが落ちる** = setup を完走した人が全員落ちる。共有の `tools/lib/collect-files.mjs` は除外済みだが、**smoke 内で自前に walk を書くと漏れる**(2026-08 に実際に踏んだ)。ディレクトリを自前で辿るときは `generated` / `node_modules` を必ず飛ばす |
| 改行コードで Windows だけ落ちる | `.gitattributes` が無いと Windows の Git が **checkout 時に CRLF へ変換**し、行単位で解析する道具が軒並み壊れる(advisor / リファレンスサイト / カタログ MCP / 資料の節分割)。**Linux の CI では再現しない**ので「自分の環境だけおかしい」に見える。`* text=auto eol=lf` で固定し、読む側でも `.replace()` で正規化して二重に守る(ZIP 展開や手コピーには .gitattributes が効かないため) |
| compose は「引数なし」で全部起動する | `docker compose up -d` を引数なしで打つと、開発に不要な検索・キャッシュまで起動・取得され、**初回に 100MB 以上を余計にダウンロードする**。`meilisearch` / `redis` は `profiles: ["optional"]` に入れてあるので既定では動かない。起動は `pnpm db:up`(db + mailpit を名指し)。image の `latest` も禁止(日によって中身が変わり環境が揃わない) |
| `pnpm install` が **postinstall で generate する** | 生成物は git 管理外なので install のたびに消える。忘れると「Can't resolve '../generated/prisma'」で落ちるが、エラーからは原因が読み取れない。**失敗しても install は止めない**(止めると依存すら入れられない)。CI 等では `SKIP_POSTINSTALL_GENERATE=1` で飛ばせる |
| Prisma の生成物は git 管理外 = 毎回作り直す | `apps/*/src/generated/prisma` は `.gitignore` 対象。**`import type` で書いていると実行時に消えるため、無くても型検査は通る**。実体で import した途端「Can't resolve '../generated/prisma'」で落ちた。`pnpm doctor` が未生成を検出する |
| 対象アプリの一覧が 3 か所にある | `tools/db.mjs` / `setup.sh` / `setup.ps1`。**`balance-app` が 3 つとも漏れていた**ため、schema があるのに生成も DB 作成もされていなかった。1 か所足しても他が残るので、smoke が食い違いを見張る |
| **型キャストは実体の不一致を隠す(3 例目: xlsx の読み込み)** | `readSheet` が `cell.value as Row[string]` と押し込んでいた。ExcelJS は基本型だけでなく**オブジェクトを返す**——数式は `{ formula, result }`、ハイパーリンクは `{ text, hyperlink }`、書式付き文字列は `{ richText: [...] }`、エラーセルは `{ error: "#DIV/0!" }`。**利用者が Excel で合計欄を作っただけで起きる**ので業務では珍しくないが、取り込み先が文字列を期待していると `"[object Object]"` になる。`normalizeCell` を追加(**数式は計算結果を採る**——式そのものは取り込んでも使えない。**エラーセルは文字列で残す**——`null` にすると空欄と区別できず取り込み側が誤りに気づけない)。2026-08 |
| **型キャストは実体の不一致を隠す** | `createDb` が `@prisma/client`(モデルは AuditLog だけ)を new し、`as unknown as TClient` でアプリの型に差し替えていた。**`db.systemSetting` が undefined** になるのに、キャストが型検査を黙らせるため **typecheck / build / smoke / preflight を全部通過**し、画面を開いて初めて落ちた。`as unknown as` を書くときは「実体も本当にそうか」を疑うこと。4 アプリすべてが同じ状態だった |
| **middleware から DB を引かない** | **Prisma のクライアントは middleware のバンドルに載らない**(「Cannot read properties of undefined (reading 'call')」で落ちる)。そもそも middleware は全リクエストの前に走るので、DB を叩くこと自体が避けたい形。状態が要るなら **API 経由で取り、TTL キャッシュ越しに読む**(`/api/maintenance-state`)。取れないときは**解除扱い(fail-open)**にする — 503 にすると状態を戻す管理画面にも入れなくなる。matcher からその API を除外すること(呼び合う) |
| 入口の**ランタイムは版で変わる** | Edge には Prisma のクライアントが載らないため、`db.systemSetting` が **undefined** になり「Cannot read properties of undefined」で落ちる。**typecheck も build も smoke も preflight も通り、画面を開いて初めて出る**。**Next 15 の middleware は Edge 既定**だが、`export const runtime = "nodejs"` を書ける（15.5 で正式版）。一時 Next 16 に上げていた頃は逆で、proxy は常に Node.js・`runtime` は**書くと落ちた**（「Route segment config is not allowed in Proxy file」）。**版を動かすときは、ここが真っ先に変わる**（ADR-0025 で 15 系に固定） |
| **顧客情報は写して持たない** | `line-console` は会員番号・氏名・電話・クラスを DB に持たず、`zohoContactId` だけを覚えて表示のたびに Zoho CRM から取る。写すと **Zoho で直しても古いままになり、どちらが正か分からなくなる**。副次的に、このアプリの DB に個人情報が残らない。**取得に失敗しても応対は続けられる**よう、例外にせず「取れなかった」状態を返す |
| LINE Webhook は 3 点を守る | ①**生ボディで署名検証**(パースしてから戻すと空白や順序が変わって合わない)②**メッセージ ID で重複排除**(LINE は再送する)③**失敗しても 200 を返す**(500 だと再送が止まらず、こちらが直るまで攻撃のように届き続ける)。取りこぼしはログで追う |
| ログイン手段が SSO だけだとローカルで何も試せない | internal-app のログインは **Zoho SSO のみ**で、鍵が無いと**全 API が 401**。画面は開くが何も動かず、ONBOARDING_TASK も実施できなかった。`/api/auth/dev-login` を追加(**`isProductionRuntime()` と `DEV_LOGIN=1` の二重ガード**、本番では 404)。**片方だけでは足りない** — 環境変数の設定ミスも NODE_ENV の取り違えも起きる |
| 効かないポーリングを止める | `DebugBar` は `/api/debug` が 404(= DEBUG_TOOL 未設定)でも **3 秒ごとに叩き続け**、コンソールが 404 で埋まって**本当のエラーが見えなくなっていた**。無効と分かったらタイマーを止める |
| **実行経路が違えば import の解決も違う** | アプリ本体は Next のバンドラが拡張子なしの相対 import を解決するが、`node --experimental-strip-types` は解決できない。**同じ書き方でもアプリは通るので気づけない** |
| E2E は**前提を確かめてから走る** | DB が無いと全部落ちる(6.8 分かけて 69 件)。クライアント未生成だとサーバが起動できず 120 秒待たされる。どちらもエラーからは原因が読み取れない |
| `page.tsx` は**必須 props も渡す** | 入口を作っただけでは足りない。必須 props を省くと型検査は通っても実行時に落ちる(`roomIds.join` で 500 になった)。**E2E が見つけた**(smoke はコードの形しか見ない) |
| JSX の属性を **`>` で切らない** | `names={rows.map((r) => …)}` のようにアロー関数が入ると、`[^>]*` が途中で切れて渡した props を見落とす。`@default("{}")` のときと同じ形の誤り |
| 存在しない `variant` は**実行時に落ちる** | `Alert` は `ICONS[variant]` を引くので、無い名前だと `undefined` になり「Element type is invalid」で**画面全体が壊れる**。`destructive` を使っていたが正しくは `danger`。型は `VariantProps` 経由なので**JSX の文字列リテラルは検査をすり抜ける** |
| `req.json()` は**空ボディで例外**を投げる | 受け止めないと 500 になり、利用者には「壊れた」としか見えない(本来は 400)。`.catch(() => ({}))` で受ける。**109 か所が同じ形だった**。E2E が備品の貸出 API で見つけた |
| E2E の**並列度を絞る** | 既定は CPU 数(手元では 10)。dev サーバは 1 プロセスなので、10 本が同時に初回コンパイルを要求すると**耐えられず落ちる**(`ERR_CONNECTION_REFUSED` が 14 件)。`workers: 3` にしてある |
| 同種の画面確認は**1 テストにまとめる** | 画面ごとにテストを分けると並列で一斉にコンパイルを要求する。順に開けば負荷が分散し、**まとめて報告**すればどこが壊れているかも一度で分かる |
| E2E は **`load` を待たない** | ダッシュボードや通知は定期更新を続けるので `load` が完了せず、画面は出ているのにタイムアウトする。`waitUntil: "domcontentloaded"` を使う(`waitForURL` も同じ) |
| E2E の既定 30 秒は**dev では足りない** | dev サーバは初回アクセス時にその画面をコンパイルするので、最初の `page.goto` に数十秒かかる。23 件がこれで落ちた。`timeout: 90_000` に広げてある |
| E2E の `webServer` は **`cwd` を指定する** | ルートから `pnpm --filter <app> dev` で呼ぶと cwd がルートのままで、Next が `.env` を見つけられない。「DATABASE_URL: received undefined」で起動に失敗する |
| `globalSetup` は使わない | **`webServer` の後**に走るので起動失敗を防げず、さらに Playwright が CommonJS として読むため `.ts` の中で `import.meta` が使えない。確認は `pnpm e2e` の入口(`tools/e2e.mjs`)で行う |
| E2E の設定は**アプリを消しても残る** | Playwright の `webServer` は静的なので、統合で消えた `equipment-app` / `platform-portal` を起動しようとしていた。しかも**主要な internal-app が対象外**で、そこの E2E は書いても動かなかった。smoke が実在するワークスペース名と突き合わせる |
| 所有者判定は**サーバの記録で**行う | 掲示板の編集・削除がリクエストの `post` をそのまま使っており、`authorId` を書き換えれば他人の投稿を操作できた。**根本は保存層が無かったこと**(検索索引にだけ入れていた)。`BoardPostRow` を足し、`postId` から引いた投稿で判定する |
| 保存より先に**索引を更新しない** | 索引だけ新しくして本体が古い(または無い)状態を作らない。削除も本体→索引の順 |
| **知らない値を破壊的な側に落とさない** | `body.action === "submit" ? submit() : approve()` は、`action: "x"` でも承認になる。経費の遷移が実際にこの形だった。**先に値を確かめて 400 で弾く** |
| 提出と承認で**権限を分ける** | どちらも `expense:create` だったため、**申請した本人が自分で承認できた**。承認は「別の人が確かめる」ことに意味がある |
| 締め出しは**理由を持たせて戻す** | `/api/auth/me` が 401 を返すと画面がログインへ送り返す。黙って戻すと「ログインしたのに戻される」だけで、無効化なのか台帳に居ないのか分からない。`?reason=` を付けて画面に出す |
| **DB 障害で締め出さない** | 台帳を引けないときに 401 を返すと、何度ログインしても戻される。セッションは正しいのでその内容で通す(`degraded: true`) |
| **無効化はセッションに届かない** | セッションは署名付きで最大 8 時間有効。退職者を無効化しても**中身は変わらない**ので、そのまま操作できてしまう。`/api/auth/me` で台帳を引いて弾き、クッキーも消す(全画面が起動時に呼ぶので実質即時) |
| ログインにも **CSRF 対策**が要る | 他所のページから勝手にログインさせられると、以降の操作が攻撃者の口座で行われる(session fixation)。`Origin` を確認する(ブラウザが管理するので偽装できない) |
| ログインの**失敗も監査に残す** | 総当たりの兆候は失敗の記録からしか分からない。成功だけ残しても攻撃に気づけない |
| フォーム送信に **JSON を返さない** | ログアウトが `{"ok":true}` を返し、画面がその表示に変わっていた。`Accept: text/html` ならリダイレクトを返す |
| ログインの失敗は**理由を区別しない** | 「そのメールは存在しません」と返すと、登録済みのアドレスを総当たりで洗い出せる。応答は 1 種類にする。回数制限は**メールと接続元の両方**で数える(片方だけだと素通りする経路が残る)。クッキーの `secure` は**本番だけ**(開発は http なので常時 true だと保存されない) |
| 所有者の判定に**表示名を使わない** | 同姓同名がいれば他人の投稿を消せる。`authorId`(メール)で判定する。**画面の判定は目印にすぎない**ので、サーバ側でも引いた投稿で確かめる |
| メモリ実装のまま残さない | チャットのルームが `createMemoryRoomRepo` 固定で、**再起動で消えていた**(Prisma 実装が用意されていなかった)。作った翌日に「昨日のルームが無い」となる |
| 記録に残る名前が**常に同じなら疑う** | 経費の取り込みが `userId: "system"`、取り消しが `actor: "system"` で、誰が実行したか辿れなかった。**動いてしまうので気づけない** |
| メンションの宛先は**台帳から引く** | `mentionDirectory` が空の Map で、`@誰か` と書いても届かなかった。氏名では引かない(同姓同名で別人に飛ぶ) |
| 書き込みを **read 権限で通さない** | 会計の仕訳・勘定科目の取り込みが `accounting:read`、経費の取り込み取り消しが `expense:read:own`、問い合わせ登録が `inquiry:read` だった。**参照できる人が書き換えられる**。既読や自分の設定は例外(理由を検査の除外表に書く) |
| 拡張子を**そのまま鍵に混ぜない** | `evil./../../etc/passwd` から `./etc/passwd` が返り、保存先の鍵にパス区切りが混入した。英数字 16 文字までに限り、外れたら拡張子なしにする |
| パスワード変更で**古いセッションを失効させる** | 署名付きクッキーは書き換えられないが、**盗まれたものは期限まで(最大 8 時間)使える**。再発行が「乗っ取りへの対処」にならない。`iat` と `passwordSetAt` を比べて弾く |
| 移行中は**古い形式も通す** | `iat` を持たないセッションを一律で弾くと、更新した瞬間に全員が締め出される |
| ログのマスクは**名前を網羅する** | `secret` / `apiKey` / `refreshToken` / `passwordHash` が対象に無く、素通りしていた。ログを見られた時点で外部サービスへ入られる |
| マスクの **`*.x` は 1 段だけ** | `config.zoho.clientSecret` のような入れ子は隠れない。設定オブジェクトをそのまま出すと漏れる。3 段まで足した(無制限にはしない — 照合が増える) |
| **逆方向も確かめる** | 「公開宣言なのに認可を通している」は、認可なし一覧を実態と食い違わせる。「理由なく `catch {}`」は、握ってよいのか書き忘れかを分からなくする。どちらも 0 件だったが、検査で維持する |
| **書いた守りが入っているか確かめる** | 「レート制限で保護する」とコメントにありながら実装が無い箇所が 2 つ、「共有鍵で守る」で `!==` を使う箇所が 1 つあった。**宣言と実装のずれは読む人を誤らせる**(守られていると思って通す) |
| **1 箇所直したら全部探す** | 認可・SSRF・失敗表示・押下反応・トークン照合と、同じ穴が複数箇所にある形を何度も踏んだ。外部への通信も、時間制限とリダイレクト不追従を**横断で見張る**ようにした |
| 外部呼び出しは**時間を切る** | proxy(全リクエストが通る)とアラート送信に制限が無かった。**異常を知らせる仕組みが異常で詰まる**のが最悪。proxy は 2 秒、通知は 5 秒 |
| 源泉徴収は**表を引く**(計算しない) | 計算式で近似すると 1 円ずれ、年末調整で全員分の精算になる。**表の範囲外は例外**にする(黙って 0 にすると徴収漏れ → 後から追徴) |
| 税額表は**毎年入れ替わる** | `validateWithholdingTable` が「扶養 0〜7 人の 8 列があるか」「扶養が増えて税額が上がっていないか」を見る。入れ替えの誤りに気づける |
| 社会保険は**五捨六入**(四捨五入でない) | ちょうど 0.5 は切り捨て。一般の丸めと違うので、素直に `Math.round` にすると全員 1 円ずれる |
| 介護保険は **1 日生まれが前月から** | 「40 歳の誕生日の**前日**が属する月から」なので、1 日生まれは前日が前月末になる。見落とすと 1 か月分の徴収漏れ |
| 折半するもの・しないもの | 健康保険・厚生年金は**労使折半**、雇用保険は**折半でない**(総支給に本人負担率を掛ける) |
| 給与の割増は**法定を下回れない** | 時間外 25% / 60h 超 50% / 深夜 25% / 法定休日 35%。**深夜の時間外は両方が付く**(0.5 相当)。片方だけだと不足し、是正勧告の対象になる。手計算と照らす検査を入れた |
| シードは**本番で流れない守りを検査で維持** | 開発用パスワードが本番に入ると誰でも入れる。`isProductionRuntime()` を外すと赤くなる(発火を確認済み) |
| 貸借不一致は**取り込まない** | 警告だけ出して入れると、決算のときに原因を探すことになる。`csv-import` が仕訳ごとに確かめ、合わない分は `continue` で捨てる |
| 丸めは**負の金額でも対称に** | `Math.floor(-2.5)` は -3、`Math.round(-2.5)` は -2。返品・値引き・赤伝で金額は負になるので、符号で「切り捨て」の意味が入れ替わる。絶対値で丸めて符号を戻す |
| **「今月」を UTC で決めない** | `new Date().toISOString().slice(0, 7)` は UTC。日本では月初の 00:00〜08:59 に開くと**前月**が出る。勤怠・給与・予算・締めの 9 画面が該当した。`formatMonthJst()` を使う |
| 記録は**消す仕組みが要る** | 監査ログ・配信の記録・通知は減る仕組みが無く、放っておくと DB を圧迫する。`/api/admin/retention` を cron から流す。**法令の保存義務があるもの(請求 7 年・勤怠 5 年)は対象外** |
| 保持期間には**理由を書く** | 「なんとなく 90 日」だと、短くしてよいか判断できない。配信の記録は「再送の判断に使う期間」、通知は「読まれなければ意味が無い」 |
| 消したことも**監査に残す** | 「あるはずの記録が無い」と言われたとき、**期限で消えたのか消されたのか**を区別できる |
| ループの中で**引かない・書かない**(N+1) | 在庫の一覧が商品ごとに台帳を引いており、100 商品なら 101 回。受信箱は宛先ごと(全社宛なら数百人)、仕訳の取り込みは 1 件ずつだった。`in` と `createMany` でまとめる |
| 増え続けるテーブルには**索引を** | 請求・発注・見積の日付、監査の `actor` に索引が無かった。今は数十件で気づかないが、**件数に比例して遅くなる**。逆に設定やマスタには張らない(書き込みが遅くなるだけ) |
| 索引にも**理由を書く** | 「なんとなく」で増やすと、効かない索引が残り続ける。何を引くために張ったかをスキーマに残す |
| 接続プールの**上限を決める** | 既定のままだと要求が増えたぶんだけ接続を開き、**DB 側の上限(PostgreSQL は既定 100)を先に使い切る**。他のアプリや管理ツールも繋げなくなる。1 インスタンス 10 で、3 台構成なら 30 |
| 複数テーブルは**1 回で書く** | ルームと参加者を 2 回に分けていた。参加者の登録で失敗すると**誰も入っていないルームが残る**(作った本人すら入れない)。Prisma の入れ子なら 1 つのトランザクションにまとまる |
| SQL は**先頭の語だけで判定しない** | `/* memo */ DROP TABLE` はコメント始まりで write 扱いになり、**danger の確認を通らなかった**。`WITH a AS (...) DELETE FROM users` も先頭は `with` なので read 扱いだった。コメントを外し、CTE は中身を見る |
| 迷ったら**厳しく倒す** | `SELECT` の文字列に `delete` が入ると write と判定されるが、確認が 1 つ増えるだけ。逆は取り返しがつかない |
| **「読んで → 無ければ作る」は同時実行に耐えない** | 2 人が同時に押すと両方が「無い」と判断して 2 件できる。勤怠(同じ日が二重)と備品の貸出(同じ物を 2 人が借りる)が該当した。DB の一意制約で止める |
| 一意制約に **null を使わない** | PostgreSQL は null を重複とみなさないので、「返却日が null なら貸出中」では制約が効かない。**空文字**にして初めて止まる |
| 制約で弾かれたら**業務の言葉で返す** | 例外をそのまま流すと 500 になる。`catch` して「貸出中です(借用者: …)」を返す |
| 設定は**知らないキーを受け取らない** | `settingsStore.update` が任意のキーを保存していた。際限なく増えて何が効いているか分からなくなる。既知のキー(`SETTINGS_DEFAULTS`)だけを通す |
| 権限は**継承を辿って確かめる** | `inherits` があるので、`permissions` だけ見ても実際に持つ権限は分からない。smoke が展開して「一般社員が持ってはいけない 8 権限」を見張る |
| **分けすぎも困る** | 管理職は `expense:approve:own`(部下の分)まで。`:any`(全社)は経理だけ。**部門をまたいで承認できる必要は無い**が、部下の分すら通せないと仕事にならない |
| **監査ログは見張る側が持つ** | `audit:read` が一般社員に付いており、全員の操作履歴 — 誰が何を承認したか、誰の情報を見たか — が読めた。管理職・経理・管理者へ移した |
| **URL を直接叩かないと開けない画面は無いのと同じ** | CMS の下位 7 画面・経費 3 画面・管理 6 画面がナビにも画面内にも出ておらず、作った本人しか辿り着けなかった。ナビに追加し、smoke が孤立を見張る |
| ナビに出さない画面は**理由を書く** | ログイン・オフライン・デバッグなど、出さないのが正しい画面もある。検査の除外表に理由を添えて、「なんとなく出していない」を残さない |
| E2E の**行き先が実在しない** | `/register` `/board` `/views` は元から無い画面を指しており、**一度も通っていなかった**。落ちていても「E2E は元々赤い」で流されると意味を失う。smoke が `page.goto` の先を実在確認する |
| `.first()` は**逃げではない** | 「実労働」「合計」のような語は説明文・見出し・値の 3 か所に出る。見たいのは**その語が画面にあるか**であって、どれか 1 つではない。画面側にテスト用の印を足すのは本末転倒 |
| 一括置換で**構文を壊さない** | 32 ファイルに `try {` を挿入して閉じ忘れ、全部壊した。**閉じ括弧を伴う変更は機械にやらせない**。巻き戻して代表画面を手で直した |
| 押した後に**反応を見せる** | 見えないと二重に押される。「保存」を 2 回押して 2 件登録される。`Button` の `loading` で押せなくし、`aria-busy` で読み上げにも伝える |
| 尋ねる値には**業務の制約**も入れる | 入荷数量は「1 以上」だけでなく「**発注残を超えない**」まで見る。`window.prompt` では確かめようがなく、超過入荷が通っていた |
| 空のときは**次にすることを書く** | 「スレッドがありません」だけでは、そこで止まる。**何を書けば並ぶのか**と、作る導線を添える |
| 書きかけを**失わせない** | 明細を何行も組んだ後に誤って閉じると全部やり直し。`useUnsavedChangesWarning` は基盤にあったが**どこでも使われていなかった**。空のときは邪魔しない |
| 値を尋ねるなら **`PromptDialog`** | `window.prompt` は**入力の種類を指定できず**(金額なのに数字キーパッドが出ない)、その場で検証もできない。一部のブラウザでは無効化されていて何も起きない |
| 確認は **`ConfirmDialog`** で取る | `window.confirm` はブラウザの見た目に依存し、**何が消えるのかを具体的に書けない**。「削除しますか」ではなく「請求書 INV-2026-101 を削除します」と名指しする |
| 失敗したとき**「読み込み中」で止めない** | 取得に失敗すると、いつまでも「読み込み中…」のまま。**動いているのか壊れているのか分からない**表示がいちばん困る。15 画面が該当した。`AsyncBoundary` で読み込み・失敗・空を 1 か所で扱う |
| 握りつぶすなら**理由を書く** | `catch { /* noop */ }` だけでは、なぜ握るのかが分からない。「ダッシュボードは 1 つ欠けても残りが役に立つ」のように、握ってよい理由を残す |
| **行全体を押させない** | `tr` や `div` に onClick を付けると Tab で止まらず、キーボードで操作できない。中に `button` を置く(押す場所も明確になる) |
| 表の中の入力欄は **`aria-label`** を付ける | 列見出しは目で見れば分かるが、**読み上げでは伝わらない**。「数量」「単価」など、その欄が何かを添える |
| 記録は**機械で分かる分を自分で書く** | 「あとで記録する」は積み重なって未記録のまま残る。実施日・所要時間・元のダンプは測れるので `drill` が書く。**人が足すのは「詰まったこと」と「直したこと」だけ** |
| 復元訓練は**中身まで確かめる** | 件数の照合が名前順の先頭 5 件だけで、**空のテーブルばかり当たると何も確かめていない**のと同じだった。全テーブルを照合し、**すべて 0 件なら失敗**にする |
| 同じ形は**共通の口に寄せる** | `check-imports` と `check-doc-apis` が同じ問題を持っていた。`tools/lib/live-surface.mjs` に集約。**記録は捨てない**(毎回すべてのパッケージを走査すると遅い)— 外れたときだけソースを見る |
| 検査が**生成物を見ていると詰まる** | `check-imports` は `api-surface.json` を見るので、export を足した直後は「無い」と言われる。**`--update` を思い出すまで時間を取られた**。記録に無ければその場でソースを見るようにした |
| 検査の**対象が狭ければ通り抜ける** | 3 回踏んだ。① `check-utc-date` が日だけで月を見逃す ② 色の検査が 6 桁だけで `#ddd` を見逃す ③ `check-env-example` が「4 字下げ + `z.`」だけで 22 変数を見逃す |
| **「検査があるから大丈夫」ではない** | 何を見ているかを確かめる。smoke が検査自体の対象範囲を見張るようにした |
| 色は**トークンで書く**(#rrggbb を直書きしない) | テーマ切り替えに追従せず、暗いテーマにしたのに文字だけ黒のまま、という形で崩れる。アプリ側に 71 箇所あった。**`var(--x, #fff)` のフォールバックは正当**(トークンが無い環境への保険) |
| 直書きしてよい場所は**理由を書く** | テーマの見本・PWA の themeColor・付箋の色など、色そのものが意味を持つ画面はある。検査の除外表に理由を添える |
| **作ったら同じ日に適用する** | 「作っても使われない」が 7 件あった反省から、`makeETag` と `withIdempotency` は作った直後に外部 API と発注へ適用した。検査でも適用を見張る |
| 発注番号が**分単位**だった | `PO-20260808-1430`。同じ分に 2 回押すと同じ番号の別レコードになる。番号を細かくするより、**そもそも 2 回実行しない**方が確実 |
| 判定は**基盤に置く** | Webhook の送信と接続テストで、同じ判定が要った。各所に書くと片方だけ緩いままになる。`@platform/net` の `isSafeExternalUrl` に集約した |
| **防げないことも書く** | 名前解決はしないので、`evil.example` が社内アドレスを指す DNS リバインディングは防げない。完全に防ぐなら専用の出口(プロキシ)が要る。**それでも素朴な指定は止まる** |
| 送信先の URL は**確かめてから叩く**(SSRF) | 購読の URL は管理画面から登録できる。`169.254.169.254`(クラウドの資格情報)や `10.0.1.5` を指定されると、**こちらのサーバが内部を叩く踏み台**になる。https のみ・私有アドレスと内部の名前を弾く |
| **リダイレクトを追わない** | 追うと、許可した URL から社内アドレスへ飛ばされる(判定をすり抜ける) |
| 配信の失敗を**記録に残す** | best-effort でも握りつぶさない。相手が受け取れていないことに気づけなくなる |
| Webhook は**署名だけでは足りない** | 過去の正しい要求をそのまま送り直せる。「重複を弾く」記録は期限で消えるので、その後の再送は通る。**時刻を署名に含め**(`t=...,v1=...`)、5 分を超えたら弾く |
| **未来の署名も弾く** | 時計を進めた署名を作り置きされる。ずれの許容は絶対値で見る |
| 再送で**二重に登録しない** | 通信が切れたときクライアントは送り直す。`Idempotency-Key` があれば最初の結果を返す。**利用者ごとに分ける**(分けないと他人の結果が返る)。**失敗は覚えない**(直して送り直せるように) |
| `Idempotency-Key` は**必須にしない** | 必須にすると既存のクライアントが全部動かなくなる。二重登録が困る操作(決済・発注)から順に付けてもらう |
| 並び替えは**許可リスト**で絞る | 列名をクエリから受けると、SQL に危ない値が渡る。許可外は既定へ戻す(エラーにしない — 一覧が出ない方が困る) |
| 不正なページ指定は**丸める**(エラーにしない) | `page=0` `page=-5` `page=abc` `limit=99999` すべて既定か上限へ。**`offset` が負になると SQL が壊れる** |
| ETag で**全件送信を避ける** | 一覧を開くたび全件を送るのは、件数が増えるほど効く無駄。**弱い ETag**(`W/`)にし、`W/` を落とすプロキシに備えて有無を無視して比べる |
| 一覧には**件数の上限**を置く | `findMany` に上限が無い箇所が 44 件。今は数十件で気づかないが、勤怠は「人数 × 日数」で毎日増える。既定 200 件を 1 つ置き、**画面ごとに数字を散らさない** |
| 退職時は**セッションを先に切る** | 権限を消してもセッションが生きていれば、その中身(ロール)で操作が通る。`sessionsRevokedAt` と `iat` を比べて弾く。**無効化・権限変更で自動的に切る**(手で 2 回操作させない) |
| 2 要素認証は**2 段階で有効にする** | シークレットを作った時点で有効にすると、認証アプリへの登録に失敗した人が締め出される(コードを出せないのにコードを求められる) |
| 予備コードは**有効化と同時に**発行する | 後回しにすると誰も作らない。端末を失くしたときの唯一の復旧手段で、無いと管理者が手で解除するしかない |
| **ADR に反した実装が入りうる** | 「自前のパスワードを持つなら 2 要素認証を実装する」(ADR-0016)と決めていたのに、ログイン画面を作ったとき未実装だった。基盤に TOTP は揃っていた |
| 検査があっても**対象が狭ければ通る** | `check-utc-date` は日(`slice(0,10)`)だけを見ており、月(`slice(0,7)`)が 9 画面で素通りしていた。「検査があるから大丈夫」ではなく何を見ているかを確かめる |
| **ADR は決めたときのまま**残る | 「既定はメモリ」「`CHAT_PERSISTENCE` で切替」と書かれたまま、実装だけが変わっていた。**決定を覆したら追記する**(消さない — なぜ変えたかが次の判断材料になる) |
| ADR の手順も**動くか確かめる** | ADR-0014 の `pnpm exec prisma migrate diff` は、Prisma 7 では動かない(`PRISMA_SCHEMA` が渡らない)。**本番を移すときに初めて気づく**ので、`pnpm db baseline` を用意した |
| 手順書のコマンドは**動くか確かめる** | `DATABASE.md` の `prisma migrate dev` は、Prisma 7 の `--schema` 廃止で動かなくなっていた。`pnpm db` を通す形に直した |
| **案内はコードにも書かれる** | `check-docs-links` は `docs/` しか見ないが、「実例は〜を参照」は**コメントや例外メッセージにも書かれる**。2026-08 に、雛形 `crud-template` が統合で消えた `apps/equipment-app` を「実際に動く例」として案内しており、**1 つは本番で投げる例外の本文**だった。雛形はコピーされる前提なので、放置すれば新しいアプリすべてに広がる。`check-source-paths` が `apps/` と `packages/` を見る(`tools/` は例示を持つのが仕事なので対象外 — 入れると誤検出だらけになる) |
| README が**実在しないパスを指す** | 「実例は `demos/app` を参照」と書いてあるのに、そこが元から無かった(3 件)。読み手は探しに行って見つからず、そこで止まる。smoke がリポジトリ内のパスを実在確認する |
| 移設したら **README も実態に合わせる** | showcase の README は「DB 不要のデモ 2 画面」のままだった。実際は 87 画面あり、`apps/` の実運用アプリになっている |
| 検査は**コメントを読み飛ばす** | `check-unsafe-html` が「以前は dangerouslySetInnerHTML で流していた」という説明文まで拾い、直した箇所を指摘し続けていた |
| デモを実運用に格上げすると**求められる水準が上がる** | showcase を `apps/` へ移したら、`check-build-ready` が health/ready の欠落を指摘した。デモのうちは不要だが、実運用なら「落ちても気づけない」ことになる |
| ディレクトリの移設は**道具まで追う** | 30 件の検査ツールが `demos/` を走査対象に持っていた。参照の書き換えだけでは `ENOENT` で止まる |
| **存在しない参照は移設で表に出る** | `demos/loadtest-scenarios` や `@demos/notify-channels` は元から実体が無かった。移設を機に実態(`packages/loadtest` / `@platform/notify`)へ直した |
| 依存が要る検査は**skip される** | `check-syntax` は TypeScript が要るため、install 前やオフラインでは動かない。その隙に 2 回壊した。**依存ゼロの `check-braces`** を最後の砦として足した |
| 誤検出は**害の方が大きい** | 括弧の検査で `.tsx` を対象にすると JSX の `<` を演算子と誤認する。正しいコードを直させることになるので、**確実に判定できる範囲に絞る**(JSX は `check-jsx-tags` が別に見る) |
| 一括置換は**開閉の対応まで見る** | 開きタグだけを消して `</div>` が余り、19 画面が 500 になった。`check-jsx-tags` は**数しか見ていなかった**ので通り抜けた。smoke が PageShell の画面で深さを追う |
| 検査の対象は**広げすぎない** | 上の件で `div` `span` を全ファイルの対象にしたら、`{/* … */}` や `style={{…}}` で数え違いが起き**誤検出が 6 件**出た。深さの追跡は tsc に任せ、対象を絞って早期検知に徹する |
| 面の背景は**本文より沈ませる** | `--color-surface` が `#ffffff` で背景と同じだったため、サイドナビやカードの境界が線だけになっていた。`mix(bg, #000, 0.03)` で一段沈ませる |
| 画面の幅は **`PageShell`** に寄せる | `max-w-2xl` 〜 `max-w-6xl` が 6 種類あり、移動するたび本文の位置が動いた。広さは 4 種類に絞る |
| 固定値の仮実装は**必ず残る** | ルーム画面が `meId = "me@example.com"` のままで、自分の発言も他人扱いになっていた。「実運用では〜」というコメント付きの仮実装は、そのまま動き続ける |
| 返信の入れ子は **1 段まで** | 何段でも許すと画面の右端に押しやられて読めない。返信への返信も同じ親の下に並べる(流れは時刻で追える) |
| ファイルの取り出しは**台帳を通す** | key を直接受けて実体を返すと `../` で別の場所を読まれる。`attachment` で保存させる(`inline` だと HTML を上げられたとき同じサイトの中で script が動く)。**誰が落としたかも残す** |
| **利用者の入力を HTML として流さない** | 投稿・発言・ブログ本文を `dangerouslySetInnerHTML` に通していた(`linkify` の結果)。変換に漏れがあれば script が動く。基盤の **`Markdown`** は React 要素に組み立てるので、その経路が無い |
| **許可リストにする**(拒否リストにしない) | `javascript:` を弾く形にすると、タブ・改行・制御文字を混ぜた変則入力や `data:` `vbscript:` `//evil.com` が抜ける(検査で 6 件確認)。**`https?://` と `/` だけ通す**方が安全 |
| 暗号は**動かして確かめる** | 「AES-GCM を使っている」ことと、正しく使えていることは別。**IV や salt の使い回し・認証タグの見落とし**は、動かさないと分からない。12 項目で確認した(すべて正しかった) |
| パスワード検証は**遅いのが正しい** | scrypt で 1 回 43ms。総当たりが 1 秒に 23 回に制限される。**速い実装は疑う** |
| cron のトークンも**定数時間で** | 6 か所すべてが `===` だった。**1 文字ずつ試せばトークンを割り出せる**。各所で直すと片方だけ古いまま残るので、`isCronAuthorized` に集約した |
| 秘密は**定数時間で比べる** | `===` は一致した文字数で時間が変わり、1 文字ずつ絞り込める。ただし**ハッシュチェーンの整合確認は対象外**(攻撃者が時間差から得るものが無い)。5 件を確認して問題なしと判断した |
| `timingSafeEqual` は**長さが違うと例外** | 先に長さを確かめてから呼ぶ。忘れると、長さの違う入力で 500 になる |
| 静的な検査だけでは**足りない** | 「弾くと書いてある」ことと「実際に弾ける」ことは別。`safeHref` を取り出して 12 種類の入力を通すようにした |
| 埋め込み先は**許可リストで絞る** | `<iframe>` の中は別のサイトで、こちらからは見られない。偽のログイン画面・広告・追跡が**こちらの責任として見える**。ホスト名は**完全一致**で見る(`youtube.com.evil.example` で抜けられる) |
| iframe には **`sandbox`** を付ける | `allow-same-origin` は**付けない**(付けると埋め込み先が Cookie を読める)。`referrerpolicy=no-referrer` と `loading=lazy` も付ける |
| **公開サイトだけ緩める判断** | `Cross-Origin-Resource-Policy: same-origin` は正しいが、公開サイトに付けると **SNS で共有したとき OGP 画像が出ない**(X や Slack が別ドメインから取りに来る)。社内アプリは `same-origin` のまま |
| **使わない選択にも理由を書く** | `__Host-` 接頭辞は付けていない。**切り替えた瞬間に全員のセッションが切れる**(名前が変わるため)ので、業務時間中には入れられない。サブドメインを他所に貸す構成になったら、深夜の枠で切り替える |
| Cookie の既定は**安全側に** | `httpOnly` / `secure` / `SameSite=Lax` / `Path=/` をすべて既定 true にする。呼ぶ側が指定を忘れても守られる |
| `window.opener` を**触らせない** | `Cross-Origin-Opener-Policy: same-origin`。`window.open` で開かれた側から元のページを別 URL へ飛ばせる(偽のログイン画面に差し替え) |
| `default-src` で**拾えないものがある** | とくに **`form-action`**。差し込まれた `<form action="https://evil.example">` に入力を送られるのを防ぐ唯一の手段。`connect-src` `worker-src` も別扱い |
| **CSP と揃える**(二重の守り) | `frame-src` が無いと、サニタイズを抜けた `<iframe>` が動く。`frame-ancestors`(埋め込まれる側)とは別物 |
| リンクは **scheme を確かめる** | `javascript:` を通すと、押しただけで任意のコードが動く。記法としては普通のリンクに見える。http(s) と相対パスだけ許す |
| API があっても**画面が無いと使えない** | 掲示板の投稿・チャットのルーム作成・ファイルのアップロードは、API も保存層も揃っていたのに**画面から呼べなかった**。「実装済み」と「使える」は違う |
| 掲示板のスレッドは**台帳を持たない** | 投稿を 1 件書けばスレッドができる。台帳を別に持つと「空のスレッドが並ぶ」状態を管理することになり、使われ方に合わない |
| **同じ失敗を 3 度した** | `try {` を挿入して閉じ忘れる形。1 度目は 32 ファイル、2 度目は line-console。`check-braces` は `.tsx` を見ないので気づけない。**閉じ括弧を伴う変更は機械にやらせない** |
| 誤検出が出たら**戻す勇気** | `.tsx` でも中括弧なら見られると考えたが、型注釈やテンプレート文字列で 22 件の誤検出。**正しいコードを直させる**のは害の方が大きいので、対象外に戻した |
| **全アプリを見る。** 2 つでは足りない | 雛形と internal-app に入れた後も、line-console(10 API)と public-site(3 API)が無防備だった。とくに**問い合わせ受付は社外に開いた口**で、「レート制限で保護する」とコメントに書きながら実装が無かった |
| 社外に開いた口は**社内より厳しく** | 問い合わせは 1 分 5 回・本文 100KB(社内は 60 回・1MB)。人が送る限り届かず、いたずらや自動送信は止まる |
| **雛形に入れたら本体にも入れる** | 回数制限・CSRF・本文サイズを `crud-template` にだけ入れ、**実際に業務で使う internal-app が無防備**なままだった。ログインだけが個別に Origin を確かめており、残り 226 本の API は素通りだった |
| 検査は**緑を出しながら失敗しうる** | `verify-checks` が末尾に成功メッセージを出しつつ、未分類があって 1 を返していた。preflight が `❌ … ✅ 25 件の検査が…` と並べて表示し、読む人が混乱する。**失敗のときは理由の行を出す** |
| `Content-Type` を**確かめる** | `text/plain` は**事前確認(preflight)なしで送れる**ので、他所のページから JSON を投げ込める。`application/json` を求めれば preflight が必須になり、`Origin` の確認と二重の守りになる |
| エラーは**出すものと隠すものを分ける** | 検証エラーは詳細を出す(どの欄が悪いか伝わらないと直せない)。内部エラーは隠す(接続先・テーブル名が漏れる)。**隠したうえで traceId は返す**ので、開発者はログで追える |
| 何を投げられても**落ちない** | 文字列や `null` を throw する実装もある。`AppError` 以外は `UNKNOWN` に丸める |
| **成功時も追跡できるように** | `x-request-id` を例外時だけ返していた。「動いたが結果がおかしい」と言われたときに照合できない |
| 守りは **`withApi` に置く** | 回数制限・CSRF・本文サイズを各ルートに書くと必ず漏れる。入口が 1 つなら、ルートが増えても付け忘れない |
| 制限の仕組みが落ちたら**通す** | 回数制限のストア障害で業務が止まる方が困る(fail-open)。守りが目的を上回ってはいけない |
| `global-error` は**基盤を呼ばない** | レイアウトごと壊れたときの受け皿。基盤の読み込みで失敗している可能性があり、そこで `@platform/ui` を呼ぶと二重に落ちる |
| 数値は**自分で直す** | 資料の数値は機械的に決まる。手で直させると「直す作業」だけが残り、中身の検査が形骸化する。**このセッションだけで 8 回手で直した**。`--fix` を全ルールに効かせた |
| 上限は**減ったら自動で下げる** | 手で `--set-limit` を叩かせると忘れ、上限だけが緩いまま残る。**増えたときは止める**(そちらは判断が要る)。CI では書き換えない(誰もコミットしないので差分が残るだけ) |
| 手順書があっても**手作業は漏れる** | `crud-template` のコピーは、アプリ名 5 ファイル・ポート 2 か所の書き換えが要る。漏らすとポートが衝突し、監査ログに前のアプリ名が残る。**`pnpm new-app` に寄せた** |
| 作る道具には **`--dry`** を付ける | 作ってから「違った」となると、ディレクトリとルートの `package.json` を手で戻すことになる。**消し方も書いておく** |
| 作る道具は**次にやることを出す** | 「作りました」で終わると、install / .env / db push を調べ直させる。**そのまま貼れる形**で並べる |
| 雛形の不足は**コピー先すべてに広がる** | `crud-template` が「動く最小」だったため、失敗を握る・押下の反応が無い・確認が無いという、点検で見つけた不備がそのまま入っていた。**後から足す手間を先に払う** |
| ADR で決めた**機能も使われない** | `decideErasure()` / `explainErasure()`(ADR-0018)がどこからも呼ばれておらず、削除要求を受けても手で判断するしかなかった。画面を作って初めて使える |
| **パッケージを作っても使われない** | `@platform/web-storage`(ADR-0020 で新設)が **120 パッケージ中ただ 1 つ**、どのアプリからも使われていなかった。`sessionStorage` を直接触る実装が残っていた |
| 鍵が動的でも**基盤を通す** | マスタ画面は種類ごとに鍵が変わるが、`createWebStorage` を都度作れば済む。**作る手間は小さく、例外処理を各所に書くより安い** |
| 保存の失敗を**握らない** | `try { localStorage.setItem(...) } catch { /* noop */ }` だと、**画面には残るのに次回は消えている**。`web-storage` は `Result` を返すので、失敗を伝えられる |
| **部品を作るだけでは使われない** | `ConfirmDialog` / `FileInput` / `UserMenu` / `useUnsavedChangesWarning` / `ErrorBoundary` が、あるのに使われていなかった(5 件)。「同じものを自作」か「そもそも守りが無い」状態になる。**使うと決めた部品は smoke で見張る** |
| 未使用でも**全部を使う必要は無い** | 254 の部品のうち 78 が未使用だが、グラフの種類・音声・公開サイト向けなど**用途が限られるもの**が多い。使うと決めたものだけを見張る |
| 同名の実装は**消すか理由を書く** | `createCircuitBreaker` が `core` と `observability` の両方にあり、どちらを使うか分からなかった。**同名でも役割が違えば残してよい**(ADR-0015)が、理由が無いのが問題。3 件に使い分けを明記した |
| **base と同じ値を書き直さない** | `tsconfig` に `module: "esnext"` を各アプリが重複して書いており、大文字小文字も揺れていた。**片方だけ直したとき差が出る**。共通の設定を継承する |
| **全アプリに `.env.example`** | showcase に無く、clone した人が何を設定すべきか分からなかった。**秘密の既定値は書かない**(そのままコピーされると全環境が同じ鍵になる)。`change-me` のような目印にする |
| **パッケージ名の実在も見る** | `@platform/xxx` と書いて実在しないと、探して見つからない。統合や改名のたびに起きうる。日本語が続く場合(`@platform/mailがトップ`)は抽出の誤りなので、バッククォートで囲まれたものだけを対象にする |
| **コード表記のパスも見る** | `[名前](パス)` のリンクは見ていたが、`` `e2e/xxx.spec.ts` `` のような書き方が素通りしていた。「これを見てください」と書いて**実際には無い**状態が 2 件(移設で消えたファイル)。例示(`my-app`)は対象外 |
| 重複の**大半は正しい形だった** | 36 件のうち 6 件は ADR の定型見出し(`文脈` / `決定` / `影響` など)で、**揃っていないと決定を追いにくい**。残る 30 件も「一覧(PLATFORM_SERVICES)と詳細」の役割分担で、片方に寄せると一覧から辿れなくなる |
| 重複検査も**同じ形だった** | `check-docs-duplication` も対象 16 件の手書き。73 件に広げたら重複が 36 件見つかった。**重複が常に悪いわけではない**(入口を分ける意図もある)ので上限方式にし、増える方向にだけ効かせる |
| リンク検査が**資料の 1/4 しか見ていなかった** | 対象 18 件を手書きしており、`docs/` の手書き 69 件のうち **51 件が対象外**。歩く形にしたら **7 件のリンク切れ**が見つかった(存在しないファイル・別アプリのパス) |
| 「できない」と決める前に**一度試す** | `check-env-example` と `check-app-transpile` を「突き合わせだから確かめられない」と分類していたが、**ファイルを 1 つ置けば発火した**。発火を確認できる検査が 20 → 22 件に増えた |
| 0 でない上限は**6 件まで** | 上限が 0 でないほど「緑でも守れていない」範囲が広がる。今は `tsdoc-params`(P2/P3/P4)・`app-bypass`・`maintainability`(2 項目)の 6 件。増やすときは理由を添える |
| **上限方式の検査は発火を確かめにくい** | `check-tsdoc-params` の検証が「存在しないプロパティ」で、P3(上限方式)に当たっていた。**1 件増えても上限内で通る**ため、発火を確かめられていなかった。上限を持たない P1(並び順)に差し替えた |
| 検査の**対象範囲を機械で見張る** | 検査自体の穴を 6 回踏んだ(月 / 色 / インデント / アプリ数 / 対象一覧 / 拡張子)。**通っているのに見ていない**のが最も危ない。`.tsx` 漏れとアプリ一覧の手書きを smoke が探す |
| 資料の「全 1,751 関数」が**実態と 2 割ずれていた** | `.tsx` を数えていなかったため。`packages/ui` は大半が `.tsx` で、301 件が漏れていた |
| 検査の**対象一覧も手書きしない** | `["internal-app", "public-site", ...]` と書いた 2 か所で showcase が漏れ、**`process.env` 直読みの検査が showcase を素通り**していた(5 箇所の秘密が直読みのまま)。全アプリが対象なら `readdir` で数える |
| **既定値のある秘密は危ない** | `process.env.CSRF_SECRET ?? "showcase-secret-change-me"` は、設定し忘れても動いてしまう。**未設定なら未設定として扱い、その機能を止める** |
| 検査で**個数を固定しない** | 「✅ が 4 つ」と数を決め打ちしていたため、アプリを 1 つ足すと落ちた。`>=` で書く |
| `reactStrictMode` は**全アプリで** | 2 アプリで欠けていた。効果を 2 回実行して、後始末を書き忘れた処理を炙り出す(本番の動きは変わらない) |
| ライブラリの版を**揃える** | React が `^19.0.0` と `^19.2.0` に分かれていた。**2 つ入ると「Invalid hook call」**で動かなくなり、原因の特定に時間がかかる。`peerDependencies` は「受け入れる範囲」なので別扱い |
| `^` の**有無も揃える** | 片方だけ固定していると、更新したとき片方だけ古いまま残る |
| 作る前に**基盤を探す** | `UserMenu` を自作したが、`@platform/ui` に同じものがあった(開閉・外側クリック・区切り線まで揃っていた)。`check-reimplementation` が捕まえた。アプリ側は**ロールの日本語化とメニューの中身だけ**を持ち、名前も `AppUserMenu` と分ける |
| **client component の `<script>` は実行されない** | React が「Scripts inside React components are never executed」と警告する。CSP に nonce を入れた環境ではどのみちブロックされる。AppSkin がテーマのちらつき防止に使っていたが**動いていなかった**。effect で行う(その分、一瞬だけ既定のテーマが見える) |
| ナビと本文は**別々にスクロール**させる | 本文がページ全体を伸ばすと、ナビの上で回してもページが動く。外側を `h-screen overflow-hidden`、本文を `overflow-y-auto`、ナビを `overscroll-contain` にする |
| 項目が多いナビは**既定でたたむ** | 50 項目を全部開くと目的地を探せない。**現在地のカテゴリだけ**開き、一度に開くのは 1 つ |
| ハイドレーション不一致は**拡張機能でも起きる** | ログに `zse-dd-wrapper` のような見覚えのない `<div>` が出ていたら、ブラウザ拡張が DOM をいじっている。**アプリ側の不具合ではない**(切り分けにシークレットウィンドウを使う) |
| **`packages/` を直したら `.next` を消す** | Next は基盤を取り込んでビルドし、結果が `.next` に残る。パッケージ側を直しても作り直されず、削除済みのコードが動き続ける |
| 症状は**「ボタンが反応しない」** | 上の件、ハイドレーションが失敗して React がイベントを結び付けられない。エラーからは原因が読み取れない。**`predev` が起動時に自動で消す**ようにした |
| 開発では**失敗の理由をサーバのログに** | ログインの応答は 1 種類のまま(登録済みアドレスを洗い出させない)。ただし開発中は「なぜ入れないのか」が分からないので、手元のコンソールにだけ出す |
| **Service Worker が古い画面を出し続ける** | 開発中に登録されていると、コードを直しても古い画面が出る。**`.next` を消しても消えない**(ブラウザ側に残る)。開発では登録せず、既存の登録も解除する作りにした。過去に登録されたものは F12 → Application → Service Workers → Unregister |
| 反映されないときは `pnpm dev:clean <app>` | `.next` を消してから起動する。**毎回は消さない**(初回表示が数十秒遅くなる)。おかしいときだけ使う |
| `.next` が古いと**ハイドレーション不一致**が出る | サーバが旧版・クライアントが新版の HTML を出す。画面を直したのに「差分が出る」ときは `.next` を消して再起動する |
| 使えないログイン方法を**出さない** | 「Zoho でログイン」を常に出すと、設定していない環境では押しても失敗する。`/api/auth/methods` で有無を聞き、揃っているときだけ出す |
| ログイン前に返す情報は**有無だけ** | 上の API が設定値そのものを返すと、ログイン前の誰にでもクライアント ID が見える |
| レイアウトは全画面共通 = **ログイン画面にも出る** | ナビ・通知・チャット・自動ログアウトが、まだ誰でもない状態の画面に並んでいた(押しても弾かれるだけ)。`AfterLogin` で包む。**判定は URL で行う**(`/api/auth/me` の応答を待つと一瞬出てから消えてちらつく) |
| ナビは**カテゴリで束ねる** | internal-app は項目が 30 を超え、横一列では画面幅に収まらず端が切れていた。縦のサイドナビ + カテゴリに変更。**権限が無い項目は最初から出さない**(押してから 403 を見せない)。中身が空のカテゴリは見出しごと消す |
| Button の**色も className で塗らない** | 既定は青く塗られる。そこへ `text-[var(--color-danger)]` を重ねると**青地に赤文字**、`--color-primary` なら**青地に青文字**で読めない。157 か所が該当した(承認の「却下」、受信箱の一覧など) |
| 選択状態は **`variant`** で表す(className で塗らない) | 既定の Button は青く塗られる。そこへ `text-[var(--color-muted)]` を重ねると**青地にグレー文字**で読めない。23 画面がこの形だった。`variant="tab"`(下線)/ `"toggle"`(枠と塗り)/ `"star"`(記号だけ)を用意し、`data-state` で切り替える。**色だけに頼らない**(下線・太さも変える) |
| 永続化フラグを機能ごとに分けない | internal-app は `CHAT_/FAQ_/CONTRACT_/TASK_PERSISTENCE` の 4 つを持ち、**どれも既定がメモリ**だった。`DATABASE_URL` は必須なのに DB を使わない食い違いで、**シードを入れても画面が空**になった。しかも `CHAT_PERSISTENCE` は名前と実態が合っておらず、取引先・通知・監査など **51 のストア**を切り替えていた。`PERSISTENCE` 1 つに統一し、既定を DB にした |
| **謳い文句と実装が食い違っていないか** | `crud-template` は「既定インメモリ・DB 不要」と謳っていたが、`services.ts` が生成物を先頭で import しており**結局 `prisma generate` が必要**だった。「何も設定せず動く」と書いてあるのに動かない状態。**DB 前提に揃えた**(既定 PostgreSQL、`PERSISTENCE=memory` のときだけメモリ) |
| Prisma 7 は **`new PrismaClient()` を受け付けない** | ドライバアダプタが必須。seed が引数なしで作っており `PrismaClientInitializationError` で落ちた。基盤の **`createDb`** を通す(アプリ本体と設定がずれる余地も無くなる)。あわせて `pnpm seed` は Next を経由しないので **`.env` を自分で読む**(`import "dotenv/config"`) |
| PowerShell の `NativeCommandError` は失敗ではない | prisma は正常時にも「Loaded Prisma config…」を stderr に書く。PowerShell はそれを赤いエラー表示にするので、ログが赤くても**終了コードで判断する** |
| スクリプトは `tsx` で実行する | 上の対処で seed の import に拡張子を足したが、**基盤パッケージの内部(33 か所)まで**同じ問題が起きた。全部に足すのではなく、解決できる実行系(`tsx`)に替えるのが正しい。範囲が広いときは**個別に直さず、前提を変える** |
| 失敗の案内で**原因を決めつけない** | `seed-all` は「DB が起動しているか、db push 済みか」とだけ出していたが、実際の原因は Prisma クライアントの未生成だった。**当たっていない案内は調査を遠回りさせる**。切り分けの入口(`pnpm doctor`)を示し、候補を並べる |
| seed の列違いは**動かすまで気づけない** | 型検査は generate 済みの環境でしか通らず、CI では素通りしうる。列名の打ち間違いは DB を用意して実行して初めて落ちる。smoke が **seed の `data` と schema の列を突き合わせる**。ただし `lines: [{ name, qty }]` のような **JSON 列の中身は列ではない**ので、深さ 0 のキーだけを見る(最初はここで誤検知した) |
| **道具にアプリ名を手で並べない** | 2026-08 に 2 アプリを統合したとき、`check-env-example` / `check-generated` / `check-win-setup` / `preflight` / `platform-report` / `smoke` の **6 か所**が古い一覧を持ったまま壊れた。1 か所直しても他が残る。`apps/` から集める形にすれば、足しても消しても勝手に追随する。smoke が手書きの一覧を見張る(一覧を持つのが妥当な `smoke` / `seed-all` / `db.mjs` は除外) |
| アプリを消しても**生成物は消えない** | 生成は「作る」だけで「消す」をしない。`apps/<アプリ名>/docs/appmap.md<app>.md` と 旧 erd/<app>.md が残り、**リファレンスサイトが存在しないアプリを数え続ける**(balance-app の統合で実際に起きた)。アプリを消したら生成物も手で消す。smoke が孤児を見張る |
| 実行時にファイルを読む画面は**生成物に固める** | `platform-portal` は `process.cwd()` 起点で docs/ を読んでいた。配置によって cwd が変わると画面が壊れる(Amplify の SSR 等)。apps/showcase へ移すとき `tools/gen-portal-extras.mjs` で固めた。**構成ツリーは深さ 3 に絞る**(全部入れると生成物が数 MB になり読み込みが目に見えて遅くなる) |
| アプリを統合する判断は ADR-0015 の 3 基準で | **デプロイ単位・担当者・利用者**のどれかが違えば分ける。どれも同じなら統合。balance-app は資金繰りと**機能が重複**し、単独では**認可も無かった**(社内の口座残高が誰でも見られた)。統合は機能追加でもあった |
| **必須の列を渡しているか**も見る | 「列が実在するか」だけでは足りない。既定値の無い列を省くと `Argument \`createdAt\` is missing` で実行時に落ちる |
| schema の切り出しは**行単位で** | `model X { ... }` を `[^}]*` で取ると、`@default("{}")` の `}` で打ち切られ**その先の列を見落とす**。SurveyRow.createdAt を実際に見落とした。行を読んで `model` 〜 `}` を追うこと |
| スプレッドは**列以外を混ぜる** | `data: { ...d, … }` の `d` に表示用の補助値(`step` / `days` など)があると、スキーマに無い列として実行時に落ちる。**型検査は配列リテラルの推論で通る**ので気づけない。列だけを明示するか、分割代入で除く。smoke がスプレッドの中身も突き合わせる |
| シーダーは**失敗の原因を本文に出す** | `シード失敗: 承認待ち` だけでは何が起きたか分からず、呼び出し側が `cause` を掘る必要があった。`@platform/db` の `createSeeder` が原因メッセージも出すようにした |
| 消したら**使える状態まで戻す** | `DROP SCHEMA` だけで止めると「relation does not exist」でアプリが起動できない。案内を出すだけでは踏まれるので、`reset` が `db push` まで行う |
| PowerShell は**内側の `"` も落とす** | 外側をシングルクォートにしても、docker に渡る際に落ちる。`'SELECT … FROM \\"UserRow\\"'` のようにバックスラッシュで守る |
| データを消す道具は**守りを二重に** | `pnpm db reset` は本番判定で止め、さらに対話で `yes` を求める(`--yes` で省ける)。**打ち間違いで業務データが消えるのを防ぐ** |
| Windows 向けの案内は **PowerShell の記法で** | `-c "DELETE FROM \\"UserRow\\""` は bash の書き方。PowerShell では `\"` がそのまま渡り `unterminated quoted identifier` になる。外側をシングルクォートにする |
| 飛ばすときも**中身が今の設定と合っているか**見る | 開発用パスワードを変えても既存の利用者はそのままで、「ログインできない」原因が分からない |
| **知らせるだけでなく直す** | 上の件、パスワードを入れ直したいだけなのに「全部消してやり直せ」では経費も勤怠も消える。seed が該当分だけ合わせ直す |
| seed は**ステップごとに**飛ばす(全体で止めない) | 先頭で `process.exit(0)` していたため、**後から足したステップが既存の環境に永久に入らなかった**(「シードを流したのに新しい画面が空のまま」)。各ステップが自分の対象を `count()` で見て飛ばす |
| 見本データは**本番で流れない守りを二重に** | 架空の氏名や会話は**見て本物と区別できない**。混ざると業務データが信用できなくなる。各アプリの seed と入口(`tools/seed-all.mjs`)の**両方**で `isProductionRuntime()` を見る。既存データがあれば何もしない(二重投入で増やさない)。対象アプリは package.json から集める(手書きの一覧は必ず漏れる) |
| Tailwind の設定を忘れると**静かに崩れる** | `@platform/ui` の部品は Tailwind のクラスで書かれている。`postcss.config.mjs` と `globals.css`(`@import "tailwindcss"` + **`@source "../../../../packages/ui/src"`**)、`layout.tsx` での `tokens.css` / `globals.css` の import が要る。**どれか欠けるとエラーも警告も出ず、要素が縦に積み上がるだけ**。`@source` が無いと Tailwind 4 は node_modules を走査しないため、基盤部品のクラスが 1 つも生成されない。2026-08 に `internal-app` / `public-site` / `line-console` の 3 つで欠けていた。**`crud-template` はインラインスタイルのみなので、そこから起こすと引き継がれない** |
| **CSP が Next のインライン script を止める** | `script-src 'self'` だけだと、Next がページ起動に使うインライン script が全部ブロックされ、**画面は出るがボタンが何も反応しない**(ハイドレーションが動かない)。エラーは**ブラウザのコンソールにしか出ない**ので、サーバ側のログを見ていても気づけない。リクエストごとに nonce を作り、**応答だけでなく要求の CSP ヘッダにも載せる**(Next が読むのは要求側)。dev は `eval` も要る。**`'unsafe-inline'` で通さないこと**(XSS への防御が無くなる) |
| 「画面を開く」層はどの検査も見ていない | 上の件は静的検査すべてを通過した。**実際に起動して画面を開く**まで分からない層が残っている。E2E(`pnpm e2e`)がその役目だが、まだ 14 本しかない |
| 起動を止めるエラーは「何を直せばよいか」を本文に出す | `parseEnv` は不足項目を `details` にだけ入れていたため、Next の起動時エラーで **`details: { issues: [Object, Object] }`** と潰れ、**どの変数が足りないか分からなかった**。`details` は機械向け、**メッセージ本文は人向け**。止まる種類のエラーは本文に項目名と理由を書く |
| 運用ツールは「ホストに何が入っているか」を前提にしない | 復元訓練ツールを `pg_dump` 直呼びで作ったが、**Windows には PostgreSQL クライアントが入っておらず実行できなかった**。DB を Docker で動かしているので、道具もコンテナの中にある。`docker compose exec db` 経由を既定にし、ダンプは `docker compose cp` でホストへ取り出す(**取り出せないバックアップは意味がない**) |
| Prisma 7 は設定ファイルと `--schema` を併用できない | 「Passing the --schema flag is not supported when a Prisma config file is present」。**依存を入れ直した(`pnpm fresh`)ら制限が入った版になり、generate も db push も一斉に落ちた**。どの schema を使うかは環境変数 `PRISMA_SCHEMA` で渡す(`prisma.config.ts` が読む)。使う場所は tools/db.mjs・setup(sh/ps1)・CI・Dockerfile ×2・資料と広いので、smoke が全部を見張る |
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
| 入口は `middleware.ts`（Next 16 の `proxy.ts` ではない）| Next 16 で改称されたため、**両方あるとビルドが落ちる**。`internal-app` は中身の違う 2 つが並存していたことがある（`middleware.ts` にメンテナンスゲート、`proxy.ts` にヘッダ付与だけ）。`check-build-ready` の `[A4]` が検出する。**この基盤は Next 15 系なので `middleware.ts` が正**（ADR-0025） |
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
| Windows のパス長 260 文字 | pnpm は `.pnpm/<pkg>@<版>_<ハッシュ>/node_modules/...` と**非常に深い階層**を作る。120 パッケージでは簡単に超える。2026-07 に実測 265 文字で踏んだ。対処は `LongPathsEnabled=1`（管理者権限・要再起動）。`node tools/check-path-length.mjs` が測る |
| turbo が Windows で動かない（**未解決**）| `turbo run build` / `dev` が `0xC0000409`（スタック破壊）で**タスクを 1 つも実行せず、ログも出さずに落ちる**。`ui: stream`・`--concurrency=1`・`LongPathsEnabled=1`・turbo 2.10.7 への更新のいずれでも変わらない（パス長が原因ではなかった）。**そのため `pnpm dev` / `build` / `test` の既定を turbo なしにしてある**（誰も踏まないように）。turbo を試したい場合は `pnpm dev:turbo` などを使う。デプロイ（Amplify・Linux）は `apps/showcase` だけをビルドするので影響なし |
| Docker が要るテストは通常実行から外す | `*.integration.test.ts` は testcontainers で実 PostgreSQL を起動する。共通プリセットの `exclude` で外し、`pnpm --filter @platform/db test:integration` で明示的に実行する |
| Prisma の Json 列には `toJson()` | `InputJsonValue` は**索引シグネチャを要求する**ため、`interface Theme` のような名前付きの型やその配列はそのまま入らない。`@platform/db` の `toJson()` で包む（実行時は素通し）。読み出しは `as unknown as T` を挟む |
| トランザクション内のモデルは型が付く | `withTransaction(db, fn)` の `tx` は**クライアントの型から導かれる**（`TransactionClientOf`）。`createDb<PrismaClient>()` で自分の生成物を渡していれば `tx.expense` に型が付く |
| pnpm は未宣言の依存を解決しない | `prisma generate` を動かすパッケージは `@prisma/client` と `prisma` を**自分で宣言する**。基盤が持っていても届かない（`Could not resolve @prisma/client`）。`check-test-setup` が検出する |
| Prisma の生成物はアプリごとに分ける | `output` を書かないと全アプリが `node_modules/@prisma/client` を奪い合い、**同時に 1 アプリしか型が通らない**。`createDb(PrismaClient, url)` に自分の生成物の**実体**を渡す(型だけでは実体が別物になる)。基盤は `RawCapableClient` など**必要な形だけ**を要求する（ADR-0006 の追記）|
| Prisma 7 は CLI と実行時で設定が別 | `schema.prisma` に `url` を書けない(`P1012`)。CLI は `prisma.config.ts`、実行時は `createDb()` → アダプタ。**片方だけ直すと generate は通るのに動かない**。`prisma generate` は `build` の前段なので、放置すると**デプロイも落ちる** |
| vitest と Playwright の住み分け | `.test.ts` は vitest、`.spec.ts` は Playwright。vitest の既定 include は両方拾うため、`Playwright Test did not expect test.describe()` で落ちる。`vitest.preset.mjs` で `.test.ts` だけに絞ってある |
| Prisma の生成物 | `@prisma/client` は `prisma generate` 前だと **import した時点で落ちる**。`pnpm test`(turbo)なら先に生成されるが、`pnpm exec vitest run` を直接叩くと生成されない |
| API の例外は投げ返さない | `withApiObservability` は例外を **traceId つきの 500 に変換して返す**。素で投げると Next 既定の 500 画面になり、traceId が返らず調査できない。内部メッセージも漏らさない(`toErrorEnvelope`)|
| BM25 は短い文書を高く評価する | 同じ語を同じ回数含むなら**短いほうが上**(文書長正規化)。「請求書」で「経費と請求書」が「請求書の書き方」より上に出る。仕様どおりなので、タイトル一致を優先したいなら `fieldBoosts` を使う |
| ローカル時刻と UTC の混在 | `new Date(y, m, d)` はローカル、`toISOString()` は UTC。混ぜると **JST 機だけ日付が 1 日ずれる**。`@platform/invoice` の `endOfNextMonth` が該当し、**支払期日が 1 日早く**なっていた。CI は UTC なので**絶対に検出できない**。日付だけの値は `Date.UTC` で揃える |
| テストが「動かない」形で壊れる | `pnpm test` は**一度も成功していなかった**。① ワークスペースがディレクトリ指定で demos の README に当たる ② 共通プリセットが `.ts` で Node が読めない ③ `@platform/ui`(83 件)と `internal-app`(16 件)の test が echo で素通り ④ `packages/form` が `@platform/config` を未宣言。**どれもテストの中身とは無関係**。`check-test-setup` で守る |
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
| 検査が本当に発火するか確かめる | `node tools/verify-checks.mjs`（preflight にも入っている）。わざと違反したファイルを置き、**赤になること**を見る。これで `check-hardcoded-colors` の `process.exit(0)` が `exitCode` を上書きしていたバグが見つかった。**検査 103 件すべてを分類済み**（発火を確認 69 / 仕組み上できない 34）。分類漏れがあると落ちるので、検査を足したら `CASES` か `NOT_VERIFIABLE` に必ず追記する |
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

## メモリ実装から Redis / DB へ移す手順

**台数を 2 台以上にする前に**必ず行うこと。1 台なら動きますが、
増やした瞬間に壊れます（起動時の `log.error` が該当を挙げています）。

### 何を移すか

| 対象 | 移し先 | 移さないと |
|---|---|---|
| `notifyOutbox` | `createSqlOutboxStore`（`@platform/observability`） | **再起動で未送信の通知が消える** / リレーが片方でしか動かない |
| `notifySeen` | `createRedisSeenStore`（`@platform/notify`） | **同じ通知が台数分届く** |
| `idempotencyStore` | `createRedisIdempotencyStore`（`@platform/observability`） | **二重実行を防げないまま「防いでいるつもり」** |
| `notify-scheduler` の `lockStore` | `createRedisLockStore`（`@platform/cron`） | **定期実行が全台で走る**（通知・レポートが台数分） |
| `rpa-service` の `lock` | 同上（単一ホストなら `createFileLockStore`） | 同上 |

### 順番

1. **Redis を用意**して `REDIS_URL` を `.env` に足す
   （`.env.example` にも記載すること——`check-env-example` が見ています）
2. **ロックから移す**。定期実行の二重起動が一番わかりやすく壊れるので、
   移した効果も確認しやすい
3. **冪等キー**を移す。移す前後で**送信を伴う処理を止めておく**
   ——切り替えの瞬間は「どちらのストアにも記録が無い」状態になる
4. **Outbox** を移す。`OutboxRow` テーブルのマイグレーションが要る。
   **移す前に未送信を空にする**（`relayOutbox` を回しきる）
   ——メモリに残ったものは移行できません
5. `notifySeen` を移す

### 確認のしかた

**2 台起動して、定期実行が 1 回だけ走ること**を確かめます。
ログの `cron_runs_total` が 1 台分だけ増えれば成功です。

**移し忘れは起動時のログで分かります**（`services.ts` の `log.error`）。
移したら、そのストアを警告の一覧から外してください。


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

### `pnpm typecheck` の 282 件を直した回（2026-08）

**型検査が回っていなかった期間に溜まったもの**です。原因の内訳:

| 原因 | 件数の目安 |
|---|---:|
| `createDb` の型付けで `db` が `unknown` に潰れる | 約 45 |
| `AsyncBoundary` の children が先に評価される（`data` が null のまま） | 約 60 |
| 生タグに残った `variant="secondary"` | 26 |
| `@platform/db` が `Prisma.sql`（生成物）に依存 | 2 + 波及 |
| import の相対パスが実体と合っていない | 18 |
| 未使用の変数・引数・import | 約 20 |
| props の不一致・個別 | 約 110 |

**型の問題ではなく、動かすと困るものが 6 件**見つかりました。
いずれも**検査は緑**だったので、`ADR 0024` の「検査が緑でも守られていない」の実例です。

| 何が起きていたか | 場所 |
|---|---|
| 監査ログの「誰が」が要求本文だった（本文を書き換えれば他人名義で記録できる） | `api/expenses/requests` |
| Zoho CRM を無認証で呼んでいた（認証情報をクライアントへ直接渡していた） | `line-console/server/customer.ts` |
| 7 画面が読み込み中に落ちる（`AsyncBoundary` の誤用） | 会計・分析・資金繰り・CMS・ダッシュボード・概況・学習 |
| 雛形が未定義関数を呼んでいた（書き込みの共通ガードが動かない） | `crud-template/server/instrument.ts` |
| レート制限が IP 単位だった（`limitKey` を作ったが渡していない） | `line-console/server/guard.ts` |
| 投稿直後だけ自分の投稿を編集できない（`authorId` の欠落） | `board/[threadId]` |

**構文エラー 6 件が、同じアプリの意味検査を丸ごと隠していました。**
TypeScript は**構文エラーのあるファイルの意味検査を飛ばす**ため、
直したあとに新しいエラーが出てきます。**直したら必ずもう一度回すこと。**

---

## 最初の 1 週間ですること

1. `pnpm install && node tools/preflight.mjs` — 緑になるか
2. `pnpm dev:showcase` — 動く実例集を一通り眺める（93 デモ）
3. `docs/onboarding/04-task.md` の課題をやってみる（半日）
4. **復元訓練を 1 回**（1 時間）
5. `CLAUDE.md` を読む — 作法と、その理由

**やらなくてよいこと**も書いておきます:

- **この資料を頭から読む**——916 行あります。**検索して使ってください**
- **120 パッケージを把握する**——`pnpm advisor find "<やりたいこと>"` で足ります
- **92 画面を全部開く**——一覧は `apps/<アプリ名>/docs/appmap.md` にあります

**1 週間で「どこに何があるか」が分かれば十分**です。
中身は、触るときに `HANDOVER` を検索すれば出てきます。

### 引き継いだ直後に必ず書き換えるもの

`node tools/check-placeholders.mjs` を実行してください。
**`CODEOWNERS` の `@your-org` `@yamada`** が残っていると、
**レビューが誰にも回りません**（エラーにはならないので気づけません）。

## 関連

- `CLAUDE.md` — 作法（AI に読ませる前提でも書いてある）
- `docs/README.md` — 資料の索引
- `docs/ops/CHECKS.md` — 103 種類の検査が何を見ているか
- `docs/RUNBOOK.md` — 障害対応
- `docs/ops/SUPPORT_GUIDE.md` — 利用者からの問い合わせ
