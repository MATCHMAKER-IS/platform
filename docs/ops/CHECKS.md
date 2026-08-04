# 検査の一覧（preflight は何を見ているか）

`node tools/preflight.mjs` は **依存をインストールせずに 47 種類の検査**をまとめて実行する
（schema 検査はアプリごとに走るため、実行時の項目数は 61）。
「手元で `pnpm install` する前に、壊れているかどうかを知る」ための入口。

```bash
node tools/preflight.mjs      # 全部まとめて（pnpm verify:offline と同じ）
node tools/<検査名>.mjs        # 1 つだけ実行する
```

**全部緑になってから** `pnpm check`（型 + lint + テスト）や実ビルドへ進む。

## 一覧

| 検査 | 何を守っているか | 落ちたときに起きること |
|---|---|---|
| `smoke` | 依存なしで実ソースを動かす 1,300 件以上の確認 | ロジックの退行 |
| `check-deps` | 内部パッケージの循環依存・層破り | 直せない依存の絡まり |
| `api-surface` | 公開 API の破壊的変更（削除・シグネチャ変更） | 利用側が壊れる |
| `check-core-signatures` | **依存の多い基盤**（core など）の引数・戻り値・型の形 | 型検査でしか気づけず、多数のパッケージに波及する |
| `check-env-example` | コードが読む環境変数が `.env.example` にあるか | 設定漏れで起動しない |
| `check-generated` | 生成物（目録・API 一覧・資料索引）が最新か | 古い情報を見て判断される |
| `check-doc-numbers` | 手書き資料の数値が実態と合っているか | 資料の数字が嘘になる |
| `check-ports` | アプリのポート重複 | 同時起動できない |
| `check-package-shape` | パッケージ構成が規約どおりか | 解決できない import |
| `check-docs-links` | 資料内のリンク・参照パスの実在 | 手順書のリンクが切れている |
| `check-doc-commands` | 資料に書いた `pnpm` コマンドが package.json にあるか | **書いてあるのに動かない**（資料全体が信用されなくなる）|
| `check-docs-duplication` | 資料の重複記述 | 直す場所が増える |
| `check-docs-orphans` | どこからも辿り着けない資料が無いか | 書いたのに読まれない |
| `check-doc-apis` | 資料のコード例が実在する API を使っているか | 真似したら動かない |
| `check-tsdoc-params` | TSDoc の `@param` が実装の引数と一致するか | **並び順が違うと黙って入れ替わる**（`check-tsdoc` は「書いてあるか」しか見ない） |
| `check-e2e-quality` | E2E テストの質（意味のある検証か） | 通るだけのテスト |
| `check-package-rules` | **基盤自身**が作法（logger / env）を守っているか | 基盤が破ると、使う側にも同じ書き方が広がる |
| `check-app-rules` | アプリが基盤の役割を侵していないか。**生タグの上限**と**手書き Cookie** も見る | 属人化・作法の崩壊・Secure の付け忘れ |
| `check-api-auth` | API が認可を通すか、通さない理由を宣言しているか。**見るのは「認可を書いたか」だけ**（身元が本物かは `check-auth-stub`） | 認可の書き忘れ |
| `check-auth-stub` | **身元を返す関数が固定値を返していないか**。スタブは禁止せず、本番ガードか `// auth-stub: 理由` を求める | **全検査グリーンなのに誰でも全操作できるアプリ**。雛形はコピーされ黙って複製される |
| `check-permissions` | 使っている権限がポリシーに定義されているか | 誰も通れず 403 になる |
| `check-reimplementation` | 基盤にある機能をアプリで作り直していないか | 直す場所が増え、強度もばらつく |
| `check-handmade-chart` | **アプリが自前でグラフを描いていないか**（データ駆動のインライン SVG）。名前ではなく書き方で再実装を捕まえる | 目盛・凡例・レスポンシブを毎回作り直して毎回抜ける。色も直書きになる |
| `check-utc-date` | **「今」から UTC の日付を切り出していないか**（`new Date().toISOString().slice(0,10)`）| JST の **00:00〜08:59 だけ前日**になる。昼間に試すと必ず通り、夜間バッチで出る |
| `check-test-setup` | **テスト・ビルドを実行できる設定か**（ワークスペースのグロブ・共通プリセットの拡張子・`test` が vitest を呼ぶか・依存の宣言・アプリの環境変数・Prisma 7 の schema と config・turbo の UI モード）| **`pnpm test` / `pnpm build` が 1 件も動かない**。テストの中身は正しいのに起動しないので、緑にも赤にもならず気づけない。`"ui": "tui"` は Windows で**ログも出さずクラッシュ**する |
| `check-path-length` | **Windows のパス長 260 文字**を超えていないか（`node_modules` の最長パスを実測）| **turbo が `0xC0000409` でログも出さずクラッシュ**し、`pnpm -r` も止まる。単一パッケージは通るのでコードの問題と誤解する |
| `check-dom-lib` | **DOM の型を使うのに `lib` に DOM が無い**か（`BlobPart` `BodyInit` `RequestInit` など）。**利用側の tsconfig も見る**（ソースを直接 import するため）| `TS2304` で**ビルドだけが落ちる**。vitest は型を見ないので、**テストが全部緑でも `tsc` で落ちる** |
| `check-result-narrowing` | **Result の絞り込みが効かない書き方**（同じ呼び出しを 2 回書いて `f().ok && f().value` とする）| `TS2339` で**ビルドだけが落ちる**。API を 2 回呼ぶので**呼び出し回数も 2 倍**になる |
| `check-react-import` | **`React` の import の過不足**（`jsx: "react-jsx"` のパッケージのみ）| `TS6133`（未使用）/ `TS2686`（不足）で**ビルドだけが落ちる**。`jsx` が `preserve` のアプリでは同じコードがエラーにならないので間違えやすい |
| `check-showcase-deps` | デモの依存と `transpilePackages` の整合 | ビルド失敗 |
| `check-app-transpile` | **実際に import している** `@platform/*` が `transpilePackages` に載っているか（宣言ではなくソースを見る） | **`next build` だけが落ちる**。以前は宣言どうしを比べており、未宣言 import 17 件を見逃していた |
| `check-syntax` | **全 .ts/.tsx を本物のパーサ（TypeScript）にかける**。この検査だけ `typescript` が要るため、未インストールなら `⏭` で skip され、preflight の最後に警告が出る（**skip を ✅ で描かない**） | **ビルドが構文エラーで落ちる**。これが無い間、他の検査が全部グリーンのまま `next build` が落ちた |
| `check-jsx-tags` | JSX の閉じ忘れ（数え上げによる一次検知） | ビルドが構文エラーで落ちる |
| `check-a11y` | 画像の alt・キーボード操作・読み上げ名 | 一部の人が操作できない画面 |
| `check-pwa` | ホーム画面追加・オフラインの設定が揃っているか | 現場から言われるまで気づけない |
| `check-maintainability` | ファイルの大きさ・1 行の長さ | 次に触る人が読めない・編集を失敗する |
| `check-hardcoded-colors` | UI 部品に色を直書きしていないか | テーマを切り替えても変わらない |
| `check-contract` | 外部 SaaS の契約（依存フィールド）と実装のズレ | 相手の変更に気づけない |
| `check-drill` | 復元訓練の鮮度 | 戻せないバックアップ |
| `check-imports` | `@platform/*` から取り込む名前が実在するか | **ビルドが落ちる**（型検査まで気づけない） |
| `check-lockfile` | **pnpm-lock.yaml と全 package.json の一致**。`peerDependencies` は `auto-install-peers` で書き戻されるため、載っていること自体は正常とし指定のズレだけ報告 | **CI の `--frozen-lockfile` でデプロイが落ちる**（Amplify で実際に発生） |
| `check-build-ready` | `next build` が通る前提（entry・重複 export・import 解決・リテラル型の広がり・**例外/404 の受け皿**・**`exports` に無いサブパスの import**・**相対 import の `.js`**・**`middleware.ts` と `proxy.ts` の重複**・**`use client` の欠落**・**メタデータファイルの `default` export**） | ビルド失敗・白い画面 |
| `check-rate-limit` | **資源を使う公開 API**に回数制限があるか（AI・アップロード・外部プロセス）| **連打されるだけ**で費用が出る／ディスクが埋まる／CPU が占有される |
| `check-security-headers` | **セキュリティヘッダ**が全アプリに付いているか（CSP・X-Frame-Options ほか）| XSS・クリックジャッキング。**付け忘れても画面は動く**ので気づけない |
| `check-unsafe-html` | **サニタイズしていない HTML の描画**（`dangerouslySetInnerHTML`）| **XSS**（画面を開いた人のセッションが奪われる）|
| `check-workflows` | **GitHub Actions のワークフロー**（履歴の深さ・秘密の直書き・権限・呼ぶスクリプトの実在）| **CI が動かない**（落ちるのではなく走らないので、緑に見える）|
| `verify-checks` | **検査そのものが生きているか**（わざと違反を置いて、赤になるか見る） | **緑なのに守れていない**（検査が壊れていても気づけない） |
| `advisor` | 重複コードの検出 | 同じものが増える |
| `setup.sh 構文` | セットアップスクリプトの構文 | 初日に詰まる |
| `Windows setup 検査` | Windows 環境の手順 | Windows で動かない |

## OS 非依存であること

検査ツールは **`find` などの外部コマンドを使わない**。`find` は Windows では
まったく別のコマンド(文字列検索の `FIND.EXE`)になり、`FIND: パラメーターが違います`
で落ちる。ファイルの走査は `tools/lib/collect-files.mjs` を使う。

パスの比較も注意が要る。`path.join` は Windows で `\` を返すため、
`endsWith("src/index.ts")` のような比較は**一度も一致しない**（検査が黙って素通りする）。
走査結果は `/` 区切りに揃えてから比較する。

> 2026-07、`check-lockfile` を Windows で実行して発覚した。
> `check-syntax` を含む 5 つの検査が Windows では動いていなかった。

## 上限つきの検査（ラチェット）

一度に全部は直せないものがある。そういうときは **「今より増やさない」** だけを守る。

やり方は単純で、**現在の数を「上限」としてファイルに記録**しておく。

- 上限を **超えたら失敗** → 新しく増やせない
- 上限を **下回ったら上限を下げる** → 直した分は元に戻せない

こうすると数が**一方向にしか動かなくなる**。少しずつ減らしていける。

| 対象 | いまの上限 | 記録先 | 上限を下げるコマンド |
|---|---|---|---|
| 生タグ（`<button>` などを直接書く）| **0** | `tools/ui-raw-tag-limit.json` | `node tools/check-app-rules.mjs --set-limit` |
| 認可の無い API | **0** | `tools/api-auth-limit.json` | `node tools/check-api-auth.mjs --set-limit` |
| 基盤と同名の実装 | **0** | `tools/reimplementation-limit.json` | `node tools/check-reimplementation.mjs --set-limit` |
| 自前で描いたグラフ | **0** | `tools/handmade-chart-limit.json` | `node tools/check-handmade-chart.mjs --set-limit` |
| 色の直書き（基盤）| **0** | `tools/hardcoded-colors-limit.json` | `node tools/check-hardcoded-colors.mjs --set-limit` |
| 色の直書き（アプリ・デモ）| **0** | `tools/hardcoded-colors-app-limit.json` | 同上（両方まとめて更新される）|
| 「今」から UTC の日付を切る箇所 | **0** | `tools/utc-date-limit.json` | `node tools/check-utc-date.mjs --set-limit` |
| 大きいファイル・長い行 | 6 件 / 1,396 行 | `tools/maintainability-limit.json` | `node tools/check-maintainability.mjs --set-limit` |
| 復元訓練の間隔 | 180 日 | `ops/drills/restore-drill.json` | 訓練を実施して記録を更新 |

> **色の上限が 2 つに分かれている理由**
> 基盤（`packages/ui`）とアプリで別々に数えている。1 つにまとめると、
> **アプリで減らした分だけ基盤で増やせてしまう**ため。基盤の部品は全画面に影響するので 0 を保つ。

## 検査そのものが壊れていないか

検査が緑でも、「問題が無い」とは限らない。**検査自体が壊れていて何も見ていない**こともある。

実際にこの基盤で起きたこと:

- `check-a11y` が `packages/` を見ていなかった（基盤の違反 10 件が放置されていた）
- `check-hardcoded-colors` が最後に `process.exit(0)` していて、**違反を見つけても成功扱い**になっていた

どちらも**緑のまま守れていない**状態で、気づいたのは偶然だった。

そこで `verify-checks` を用意した。**わざと違反したファイルを一時的に置き、検査が赤くなることを確かめる**（終わったら必ず消す）。

```bash
node tools/verify-checks.mjs
#   ✅ check-api-auth: 認可も公開宣言も無い API
#   ✅ check-a11y / A11Y002: div の onClick
#   ...
#    検査 42 件 / 発火を確認 14 件 / 仕組み上できない 28 件
```

**「仕組み上できない」もの**（`check-lockfile` など、ファイルを 1 つ置いても関係しない検査）は、
理由を `tools/verify-checks.mjs` の `NOT_VERIFIABLE` に書いてある。

**検査を新しく足したら**、`CASES`（発火を確かめる）か `NOT_VERIFIABLE`（できない理由）の
どちらかに必ず追記すること。**どちらにも無いと `verify-checks` が失敗する**ので、忘れられない。

## 保守しやすさについて分かっていること

実測した結果、次が分かっている。**知った上で触る**ためにここに残す。

| 事実 | 影響 |
|---|---|
| `tools/smoke.mjs` が **12,000 行超** | どこを直すか探すのに時間がかかる。ただし 227 の `section()` で区切ってあり、目的の箇所は検索で辿れる |
| **200 文字を超える行が 1,300 行あまり** | 差分が読めず、**文字列置換での編集が失敗しやすい**（実際に何度も起きた）。機械的に割れるもの（1 行に詰めた関数本体・`.replace` の連鎖）は 131 行分を解消済み。残るのは JSX の属性や長い文字列で、**割ると意味が変わる**ため触るついでに直す |
| 大きいファイルは 6 件 | `utils/numbers.ts`・`utils/strings.ts`・`datetime/calendar.ts` は関数の集まりなので、分割の効果は薄い |

`check-maintainability` が上限として記録しており、**増やすと preflight が失敗する**。

### smoke.mjs を編集するとき

- 目的のセクションは `section("...")` を検索して探す
- **1 行を長くしない**。長い行は次の編集で壊れる
- パッケージをまたぐ依存を足したら、smoke 側の展開も要る（`docs/ops/PACKAGE_CONSOLIDATION.md`）

## 意図した変更で落ちたとき

検査は「意図しない変化」を捕まえる。**意図した変更なら基準の方を更新する。**

| 検査 | 更新方法 |
|---|---|
| `api-surface`（公開 API を意図的に削除した） | `node tools/api-surface.mjs --update` |
| `check-generated`（生成物が古い） | `pnpm gen:all` |
| `check-app-rules`（生タグを減らした） | `node tools/check-app-rules.mjs --set-limit` |
| `check-contract`（相手の API 変更に追随した） | `node tools/record-contract.mjs` で記録を取り直す |
| `check-core-signatures`（意図して形を変えた） | `node tools/check-core-signatures.mjs --update` |

更新したときは、**なぜ更新したかをコミットメッセージに書く**。基準の更新は「検査を黙らせる」ことでもあるため、
理由が残っていないと、後から見て事故と区別できない。

## この検査でも分からないこと

preflight は**依存をインストールせずに**動く。そのため次は確認できない。

- 型（`tsc`）が通るか → `pnpm typecheck`
- 実際にビルドできるか → `pnpm build`
- 画面の見た目 → 実際に開く
- 本番の性能・データ量での挙動 → 負荷試験（`pnpm loadtest`）

**preflight が緑でも「壊れていないことの証明」にはならない。** 早く気づくための仕掛けであって、
最終確認は手元のビルドと画面で行う。

## 関連

- `docs/VERIFY.md`（検証の考え方）
- `docs/ops/COMMANDS.md`（コマンド一覧）
- `docs/ops/TESTING_GUIDE.md`（テストの書き方）
- `docs/ops/CONTRACT_TESTING.md` / `docs/ops/BACKUP_RESTORE.md`
