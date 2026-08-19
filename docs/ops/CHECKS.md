# 検査の一覧（preflight は何を見ているか）

`node tools/preflight.mjs` は **依存をインストールせずに 103 種類の検査**をまとめて実行する
（schema 検査はアプリごとに走るため、実行時の項目数は 61）。
「手元で `pnpm install` する前に、壊れているかどうかを知る」ための入口。

```bash
node tools/preflight.mjs      # 全部まとめて（pnpm verify:offline と同じ）
node tools/<検査名>.mjs        # 1 つだけ実行する
```

**全部緑になってから** `pnpm check`（型 + lint + テスト）や実ビルドへ進む。

## 【必読】検査で見つからないもの

**検査が緑でも、これらは守られていません。**

**「検査を通ったから大丈夫」と思うのが一番危ない**——
**何を見ていないか**を知っておいてください。

| 何 | 検査はあるか | どうやって見つけるか |
|---|---|---|
| **索引の有無** | **あります**（`check-missing-index`） | 検査で分かります。**効いているかは別**——`EXPLAIN ANALYZE` で `Seq Scan` を見る |
| **型の不一致** | **あります**（`pnpm typecheck`） | **AI が作業する環境では回せない**ことがあります——そのときは手で探す（`CLAUDE.md`） |
| **性能の劣化** | **測る手段はあります**（`pnpm loadtest`） | **自動では落ちません**。**先に測って基準を残す**（`LOAD_TESTING.md`） |
| **本番でしか出ないもの** | **ありません** | フォント・タイムゾーン・外部サービスの実応答——**出してみるまで分かりません** |
| **業務の正しさ** | **ありません** | 「経費の上限が 2 万円か 3 万円か」——**人が確かめる**しかありません |
| **画面の使いやすさ** | **ありません** | 「ボタンが押しにくい」——**使った人にしか分かりません** |
| **設計の誤り** | **ありません** | 「そもそもこの機能は要らなかった」——**検査は「書いたものが正しいか」しか見ません** |

**「検査はあるか」を必ず確かめてから書いてください。**

**2026-08 に、「索引の不足は検査では見つかりません」と 2 か所に書きましたが誤り**でした
——**`check-missing-index` が既にあった**のに、**検査の一覧を数え間違えて見落としていた**のです。

**あるのに無いと書くと、次の人が余計な調査をします。**

### 実際に確かめた結果（2026-08）

**「検査で見つからない」と書いたものを、手で確かめました。**

| 確かめたもの | 結果 | どうやって |
|---|---|---|
| **索引の効き方** | **索引の有無は `check-missing-index` が見ています**（`check-schema` は `@id` だけ）。ただし**効いているか**は別——`EXPLAIN ANALYZE` で `Seq Scan` が出ないか確かめてください |
| **増え続ける表の索引** | ✅ 無し | `@@index` の無い表を洗い出し（1 件だが設定表で増えない） |
| **PDF のフォント** | ✅ あり | `Dockerfile` に `fonts-noto-cjk` |
| **タイムゾーン** | ✅ あり | `Dockerfile` に `TZ=Asia/Tokyo`（compose は DB だけなので不要） |

**残るのは「本番でしか出ないもの」「業務の正しさ」「使いやすさ」**——
**どれも人が確かめるしかありません**。

**確かめたら、ここに書き足してください。**
**「見つからない」と書いたまま放置すると、**
**本当は確かめられるのに諦めることになります**。

### 検査を信じすぎないために

**緑は「明らかな間違いが無い」という意味**で、
**「正しい」という意味ではありません**。

**2026-08 に、`check-tsdoc` が「件数が 1000 超か」しか見ておらず、
TSDoc を丸ごと消しても通る**ことが分かりました——
**「残債 0」を何度も報告していたのに、それを保つ仕組みが無かった**のです。

**検査を作ったら壊して確かめる**（下の節）、
**検査が何を見ていないかを知る**（この節）——**両方が要ります**。


## 【必読】検査を作ったら、必ず壊して確かめる

**書いただけでは、効いているか分かりません。**

```bash
# 1) 正常な状態で通ることを確かめる
node tools/check-なんとか.mjs   # → 0

# 2) わざと壊す（検査が見つけるはずのものを、1 つ作る）
#    例: 引数を 1 つ減らす、take を消す、色を直書きする

# 3) 落ちることを確かめる
node tools/check-なんとか.mjs   # → 1

# 4) 戻して、また通ることを確かめる
node tools/check-なんとか.mjs   # → 0
```

**②で落ちなければ、その検査は効いていません。**

### 実際に踏んだ失敗（2026-08）

`check-dual-impl-args` を作ったとき、**2 回とも効いていませんでした**。

| 何をした | なぜ効かなかったか |
|---|---|
| 同じ器の中で引数を比べた | **メソッドは 1 つずつ**しかなく、比べる相手がいない |
| 器ごとに区切って比べた | **2 実装は別の器**なので、**比較されなくなった** |

**わざと壊すまで、どちらも「通っている」ように見えました。**

### 「件数だけ見る」検査に注意

**2026-08 まで、smoke の `check-tsdoc` は「件数が 1000 超か」しか見ていませんでした。**

**TSDoc を丸ごと消しても通ります**——**「残債 0」を達成しても、それを保つ仕組みがありませんでした**。

**`check-tsdoc` は引数なしだと一覧を出すだけ**（終了コード 0）で、
**preflight でも回していません**——**smoke だけが見張り**です。

**「数を数えるだけ」の検査を見つけたら、中身を見る形に直してください。**

**2026-08 に smoke 全体を調べたところ、同じ形は 1 件だけ**でした
（環境変数の名前が 1 つ以上あるか——**次の行で中身も見ている**ので実害なし）。
**smoke は概ね健全**です。

### 資料の文言を見張る検査（8 件）

**smoke には「資料にこう書いてあるか」を見る検査**があります。

| 見張っているもの | どこ |
|---|---|
| 「どちらに書くか」 | 各アプリの `HANDOVER.md` |
| 「作る前に探す」 | `docs/onboarding/03-development.md` |
| 「必ず壊して確かめる」 | `CHECKS.md` と `CLAUDE.md` |
| 「検査で見つからないもの」 | `CHECKS.md` と `CLAUDE.md` |
| 「よくある失敗」の見出し 4 つ | `CLAUDE.md` |
| 「どの検査が何を見ているか」 | `TESTING_GUIDE.md` と `CLAUDE.md` |
| 「検査は 3 段階ある」 | `docs/onboarding/05-verify.md` |
| 検査の数が実数と合う | `CLAUDE.md` |

**なぜ見張るか**: **消えても誰も気づかない**ためです。
**資料は静かに腐ります**——**書き換えた人に悪気は無く、ただ知らないだけ**です。

### 見張られている文言を変えたいとき

**落ちるのは正しい動き**です。**次の順で直してください**。

1. **その文言が要らなくなったのか、言い換えたいだけか**を決める
2. **言い換えたいだけなら**、`tools/smoke.mjs` の `includes("...")` も一緒に変える
3. **要らなくなったなら**、検査ごと消す——**なぜ要らなくなったかを HANDOVER に書いて**ください
4. **壊して確かめる**（変えた後の文言で落ちないこと、消すと落ちること）

**検査だけ消して資料を残す**のはやめてください——
**見張りが外れたことに、誰も気づけません**。

### 遅い検査

**`check-scan-reporting` は 1 分以上かかります。**

**67 個の検査を `spawnSync` で順に起動する**ためで、
**preflight がタイムアウトする原因**でもあります。

**速くするなら並列化**が要りますが、**同時に 67 個立ち上げるとメモリを食い潰す**ので、
**数個ずつ**にしてください。**急ぐときは preflight から外して、CI だけで回す**のも手です。

### 確かめた記録（2026-08）

**主要な検査を実際に壊して確かめました。**

| 検査 | 壊し方 | 結果 |
|---|---|---|
| `check-unbounded-query` | `take: 100` を消す | ✅ 落ちた |
| smoke「色をハードコードしていない」 | `#ffffff` を直書き | ✅ 落ちた |
| smoke「承認: 自分の経費」 | 判定を `false` に | ✅ 落ちた |
| `check-tsdoc` | TSDoc を丸ごと消す | ✅ 落ちた |
| `check-missing-index` | `findMany` で絞る列に索引があるか | **索引が無いと全件を走査**します——**数人の間は速く、100 人で急に遅くなる**。**静的に見るだけ**なので、**効いているかは `EXPLAIN ANALYZE`** で |
| `check-dual-impl-args` | 引数を 1 つ減らす | ✅ 落ちた |
| smoke「よくある失敗」 | 見出しを変える | ✅ 落ちた（**1 度目は効かず、直した**） |
| `check-api-auth` | `// public-api:` の印を消す | ✅ 落ちた |
| `check-delete-confirm` | 上限を 1 下げる | ✅ 落ちた |
| `check-docs-orphans` | `docs/README.md` の行を削る | ✅ 落ちた |
| `check-package-shape` | `package.json` の `scripts` を消す | ✅ 落ちた |
| `check-doc-numbers` | `CLAUDE.md` の数字を変える | ✅ 落ちた |
| smoke「check-tsdoc」 | TSDoc を丸ごと消す | ✅ 落ちた（**直すまで効いていなかった**） |
| `check-schema` | モデルの `@id` を消す | ✅ 落ちた |

**`check-schema` は索引（`@@index`）を見ていません**——**`@id` の有無だけ**です。
**索引が効いているかは `pnpm loadtest` と `EXPLAIN ANALYZE` で見つけて**ください（`LOAD_TESTING.md`）。

**壊し方を 3 回間違えました**（`package-shape`）——
`exports` `main` `types` を消しても落ちず、**実際に見ていたのは `scripts`** でした。

**その検査が何を見ているかを読んでから壊す**——`grep -oE '\bpkg\.[a-zA-Z]+' tools/check-なんとか.mjs` が早いです。

**壊し方を間違えると「効いていない」と誤解します。**

`check-hardcoded-colors` は **Tailwind の色クラス**（`bg-slate-500`）を見るもので、
**16 進の直書きは smoke 側の別の検査**が見ます——
**16 進を書いて「落ちない」と判断したのは、私の確認方法の誤り**でした。

**その検査が何を見ているか**を読んでから壊してください。

### 上限方式には `--list` を必ず付ける

**どれが対象か分からないと、減らせません**——**上限を守るだけ**になり、
**現状の追認**で終わります。

```bash
node tools/check-なんとか.mjs --list   # 対象の一覧
node tools/check-なんとか.mjs --set-limit  # 減らしたら上限も下げる
```

**2026-08 に 2 本（`server-localtime` / `css-vars`）へ足しました**——
**26 件あるのに、どれか分からない**状態でした。
**smoke で「`--list` があること」を見張っています**。

### 上限方式の弱点

**上限を現状に合わせると、減らす動機が無くなります。**

`check-delete-confirm` は **9 件 / 上限 9** で、
「これ以上増えない」は守れても、**9 件が放置**されていました。

**一覧を見て、危ないものから減らしてください**（`--list`）。
**2026-08 に 3 件減らしました（9 → 6）**:

| 直したもの | なぜ危ないか |
|---|---|
| 予約の取り消し | **押した瞬間に消え**、**他の人が押さえると戻せません**（同じ枠が空いている保証がない） |
| CMS ページの削除 | **外から見られなくなります**——検索エンジンにも SNS にも載っており、**気づくのは見に来た人**です |
| 経費の一括取り込みの取り消し | **まとめて取消済になります**——**1 件ずつ戻す手段はありません**。**押した人が件数を知らない**まま押せてしまいます |

**残る 7 件を 1 件ずつ見たところ**（`--list`）:

| 件 | 判断 |
|---|---|
| チャット | **ピン留めの解除**でした——**すぐ戻せる**ので確認は不要 |
| 経費の履歴 | **取り込みの一括取り消し**——**部品側**（`@platform/ui` の `ImportHistoryTable`）に確認を足しました |
| 用語集・テーマ・開発用画面 | 影響が小さく、確認を挟むと**かえって使いにくい** |
| CMS の分類と本体 | **次に直す価値があります** |

**件数だけ見て「危ない」と決めないでください。**
**チャットは誤検出に近く、経費は部品側**——**1 件ずつ中身を見る**必要があります。

**部品（`packages/ui`）に足しても件数は減りません**（検査はアプリだけを見ます）——
**それでも安全性は上がります**。

**減らしたら `--set-limit` で上限も下げる**こと
（**下げないと、また増やせてしまいます**）。

### 誤検出も確かめてください

**落ちるようになったら、次は「落ちすぎていないか」**を見ます。

同じ検査で、`export-schedule.ts` が**誤検出**しました——
**1 ファイルに複数の器**があり、**別物を比べて**いたためです。

**作る → 壊して確かめる → 誤検出を潰す**、の 3 段階が要ります。


## 検査を新しく書くときは

**まず `node tools/lib-find.mjs --list` で既存の共通処理を見ること。**

### 必ず踏む落とし穴: 自分の説明文を拾う

ソースを読む検査は、**自分が書いたコメントも入力として読みます**。

```js
// ❌ 「2026-08 まで toISOString().slice(0, 10) で…」という
//    修正の説明を、検査が違反として検出する
if (/\.slice\(0, ?10\)/.test(src)) violations += 1;

// ✅ コメントを除いてから見る
import { stripComments } from "./lib/source-text.mjs";
if (/\.slice\(0, ?10\)/.test(stripComments(src))) violations += 1;
```

2026-08 までに**同じ失敗を 3 回**しました(`source-text.mjs` 自身・`@throws` の検査・
日付の検査)。**「使うな」と書いた瞬間に自分が違反者になる**ので、
検査を書いたら**自分の説明文で試す**こと。

`stripComments` は JS/TS 向けで `#` を扱いません。
YAML・Dockerfile も見るなら、`#` と `REM` を落とす別の処理が要ります
(smoke の `stripCommentsAnyLang`)。

```bash
node tools/lib-find.mjs collect files   # キーワードで探す
node tools/lib-find.mjs --list          # 全部出す
```

2026-08 に、作業者が作った検査 5 本のファイル収集が
**`collectFiles` と完全に同じ実装**だった(しかも 5 本とも `.git` の除外を落としていた)。
この基盤の目的は「同じものを何度も作らない」ことなのに、**検査を作る側が破っていた**。
`advisor` は `packages/*` を見るが `tools/lib` は対象外なので、こちらで探す。

**`tools/lib/source-text.mjs` を使うこと。**

忘れても `check-regex-pitfalls` が preflight で指摘する。

**同名の関数を別パッケージに作るときは** `check-risky-duplicates` が止める。
複製そのものは悪くない(依存を増やさない判断は正しい)が、**乖離を放置すると片方だけ弱くなる**。

| 関数 | 何を防ぐか |
|---|---|
| `stripComments(src)` | TSDoc の例を実物と誤認する。**文字列を先に読み飛ばす**ので URL の `//` を巻き込まない。行番号も保つ |
| `argsAt(text, i)` | `[^)]*` で引数を取ると入れ子で切れ、**正しく書けている行を誤検出する** |
| `methodCallRe(name, opts)` | `res` `response` `r` と呼び方は揃っていない。決め打ちすると**数え落とす** |
| `docBefore(src, i)` | `/** … */ export` を正規表現で一度に取ると、**間に別の TSDoc があると前のブロックを掴む**。`gen-reference` ではこれで**説明 1,208 件が別の宣言のもの**になっていた |
| `summaryOf(doc)` | `@` で始まる行・コード例・`@typedef` を要約にしない |

この 3 点は 2026-08 の作業だけで **5 回**同じ誤りを繰り返した箇所。
対策は文書に書いてあったが**測るたびに参照されなかった**ので、関数として置いてある。


## 一覧

**分野ごとの目安**(詳細は下の表):

| 分野 | 主な検査 | 何を防ぐか |
|---|---|---|
| **動作** | `smoke` / `check-contract` / `check-drill` | ロジックの退行・外部連携の形崩れ |
| **構造** | `check-deps` / `check-package-shape` / `check-imports` / `api-surface` | 依存の絡まり・解決できない import・破壊的変更 |
| **説明と実装** | `check-tsdoc-params`(P1〜P4) / `check-returns-mismatch` / `check-doc-examples` / `check-doc-apis` | **説明を読んで呼ぶと動かない**・例が動かない |
| **日本語** | `check-locale-compare` / `check-locale-format` / `check-ime-enter` / `check-server-fonts` | 五十音順にならない・変換中の誤送信・帳票の豆腐 |
| **時刻** | `check-utc-date` / `check-server-localtime` | **JST の 00:00〜08:59 に日付が 1 日ずれる** |
| **セキュリティ** | `check-api-auth` / `check-auth-stub` / `check-permissions` / `check-unsafe-html` / `check-rate-limit` / `check-security-headers` / `check-next-version` | 認可漏れ・スタブの本番流出・XSS |
| **壊れ方** | `check-unguarded-json-parse` / `check-api-error-shape` / `check-result-narrowing` | 壊れた入力で 500・調査できない障害 |
| **重複** | `check-risky-duplicates` / `check-reimplementation` / `advisor` | 片方だけ直して静かに食い違う |
| **検査自身** | `check-preflight-coverage` / `check-scan-reporting` / `check-regex-pitfalls` / `verify-checks` / `check-allow-lists` | **検査を書いたのに動かない**・0 件検査して緑 |
| **資料** | `check-doc-numbers` / `check-docs-links` / `check-source-paths` / `check-docs-orphans` | 古い数値・切れたリンクで誤った判断 |

下の表には **106 種類**を載せています(preflight が実行する数と一致していること——
**「67 種類ある」と書きながら一覧は 48 件**という状態が 2026-08 まで続いていたので、
`check-doc-numbers` が**表の行数そのもの**を数えるようにしました)。

`check-tsdoc-params` は 1 つの検査の中で 4 段階に分けています。

| 種別 | 内容 | 現在 |
|---|---|---|
| **P1** 並び順違い | 型が同じだと**黙って入れ替わる**(結果は返るが中身が逆) | **0 件・上限 0** |
| **P2** 存在しない引数 | 渡すと `TS2554`。ビルドで気づけるが**渡せると思って設計する** | **0 件・上限 0** |
| **P3** 名前の違い・説明の抜け | 改名漏れ。**軽い名前だが、呼ぶと動かないものが混ざる**(2026-08 に 7 件発見) | 185 + 38 件(上限方式) |
| **P4** 存在しないプロパティ | `@param options.foo` の `foo` が型に無い。**先頭だけ見ていると素通りする** | **0 件・上限 0** |


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
| `check-tsdoc-params`（P5） | **同じ引数を 2 回説明している**（説明を書き足すとき、既にあることに気づかず追記すると起きる） | **どちらが正しいか分からず**、片方だけ直されて食い違いが残ります。上限を持たず常に 0 |
| `check-package-rules` | **基盤自身**が作法（logger / env）を守っているか | 基盤が破ると、使う側にも同じ書き方が広がる |
| `check-app-rules` | アプリが基盤の役割を侵していないか。**生タグの上限**と**手書き Cookie** も見る | 属人化・作法の崩壊・Secure の付け忘れ |
| `check-api-auth` | API が認可を通すか、通さない理由を宣言しているか。**見るのは「認可を書いたか」だけ**（身元が本物かは `check-auth-stub`） | 認可の書き忘れ |
| `check-auth-stub` | **身元を返す関数が固定値を返していないか**。スタブは禁止せず、本番ガードか `// auth-stub: 理由` を求める | **全検査グリーンなのに誰でも全操作できるアプリ**。雛形はコピーされ黙って複製される |
| `check-permissions` | 使っている権限がポリシーに定義されているか | 誰も通れず 403 になる |
| `check-async-boundary` | **`AsyncBoundary` の中身が判定より先に評価されていないか**。JSX の子要素は引数なので、部品が「読み込み中」を返すより前に作られる | `data` が null のまま `data.x` を辿り、**「読み込み中…」の代わりに白い画面**になる。2026-08 に **7 画面**が同じ形だった |
| `check-intrinsic-props` | **生タグに部品の props が残っていないか**（`<td variant="secondary">` など）| それ自体は無害だが、**同じ行の本物の違反を検査から隠す**。実際 26 箇所が「青地に青文字で読めない `<Button>`」26 箇所を隠していた |
| `check-node-portability` | **Windows で静かに壊れる書き方**（`.pathname` をパスとして渡す / `` `file://${process.argv[1]}` `` で直接実行を判定）| **Linux では偶然通る**。`pnpm smoke` が Windows でだけ停止したり、検査が**何も出力せず終わる**（`check-coverage --set-floor` が無反応だった）|
| `check-comment-terminators` | **ブロックコメントが途中で終わっていないか**。グロブや JSX を説明しようとして書いた「アスタリスク＋スラッシュ」がコメントを閉じてしまう | 以降が**コードとして解釈**され、`ReferenceError: src is not defined` のように**原因とかけ離れたエラー**になる。2026-08 に同じ間違いを 2 度踏んだ |
| `check-coverage-scope` | **カバレッジが「人が書いた実装」だけを測っているか**（生成物・設定・`tools/` を分母に入れていないか）| 初回計測で Prisma の生成物や `smoke.mjs`（24,518 行）まで数え、全体が **16%** と出た。**検査を 1 本足すだけで割合が下がり**、テストを減らしていないのに CI が落ちる |
| `check-migration-mode` | **スキーマの適用方式を固定していないか**。`db push` / `migrate deploy` は `tools/apply-schema.mjs` が `migrations/` の有無で選ぶ | 切り替えの日に直し忘れた場所だけ古い方式で残る。**本番だけ `db push`** になると列の削除が無警告で走る（ADR 0014 が禁止）。逆に履歴ゼロで `migrate deploy` 固定だと**何も適用されない** |
| `check-empty-branches` | **条件だけあって中身がコメントだけの分岐**が無いか | 「設定すれば動く」ように見えて動かない。`SENTRY_DSN` の分岐が実際に空で、`INCIDENT_RESPONSE.md` だけが「Sentry で見る」と書いていた |
| `check-licenses` | **配布できないライセンス**（GPL / AGPL / SSPL / BUSL 等）の依存が混ざっていないか。不明なものは許可一覧でラチェット | 依存の脆弱性監査（`audit`）は脆弱性しか見ない。**顧客へ納品する・SaaS として提供する**と自社ソースの開示を求められうる。深く使ってから気づくと剥がせない |
| `check-bundle-size` | **画面を開くのに読み込む JS の量**が増えていないか（上限ラチェット。`pnpm build` の後） | JS は黙って増え、**どれが効いたか分からないまま**重くなる。拠点の細い回線・古い端末では体感で数秒。**増えた PR で気づく**ためのもの |
| `check-openapi-coverage` | **別のアプリから叩く API が OpenAPI に宣言されているか**（未宣言の数を上限ラチェット） | アプリは別リポジトリなので**型を直接共有できない**。宣言し忘れても API は動くので気づけず、**別のアプリが叩こうとしたときに相手を待たせる** |
| `check-rollback-ready` | **前の版へ戻せる状態か**（compose のタグが差し替えられるか・app と migrate が同じタグか・`type=sha` があるか・手順書に書いてあるか） | タグを `:main` に固定していると、**壊れた版を出した直後に pull で取れるのが壊れた最新**。「前回の成功したデプロイを Re-run」では**戻りません** |
| `check-incubating-review` | **incubating が置き去りになっていないか**（12 か月ごとの見直し。`--list` で実戦利用つき一覧） | 「使われていないが、消す判断もされていない」パッケージが増えると、**本当に使うべきものが埋もれる**。**incubating のままでよい**ものもある——咎めているのは判断の先送りだけ |
| `check-db-indexes` | **他テーブルの ID を指す列に索引があるか**（上限ラチェット） | このリポジトリは**外部キーをあえて張らない**方針なので、**Prisma は索引を作りません**。無いとその列で絞る検索が全件走査になり、**10 件のときは速く、10 万件で急に遅くなる**（開発中は気づけない）|
| `check-ops-hygiene` | **1 台の VPS で静かに壊れるもの**（Docker のログの上限・バックアップの自動実行と通知・`TZ`・`restart`） | どれも「動かなくなる」のではなく**気づかないまま悪化**する。ログ無制限は**ディスクを食い潰して全部止め**、cron の失敗は**黙って続く** |
| `check-query-in-loop` | **ループの中で DB を呼んでいないか**（上限ラチェット。理由を書けば免除） | **件数ぶんだけ往復**する。1 往復 2ms でも 5 万件で 100 秒。**開発中のデータは 10 件なので体感は一瞬**で、使われ始めてから遅くなる |
| `check-stale-counts` | **説明文に「すぐ古くなる数値」を固定で書いていないか**（`tools/` と `packages/` のコメント。`check-doc-numbers` は `docs/` しか見ない） | **コメントの数値は誰も直しません**。資料を AI が読む前提なので、「465 セクション」と書いてあれば**そう信じて作業されます**。過去の記録（「2026-08 の時点で〜」）は対象外 |
| `check-unused-deps` | **依存に入れたまま一度も import していないパッケージ**（`check-app-transpile` の逆向き） | 落ちはしませんが、**入れるものが増え、半年後に「消してよいか分からない」**状態になります。`platform.plannedDeps` に理由を書けば咎めません |
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
| `check-win-setup` | Windows のセットアップスクリプト（BOM・改行・文字化け） | **`setup.bat` が BOM 付きだと、cmd.exe が先頭行を読めず即座に止まる** |
| `check-pwa` | ホーム画面追加・オフラインの設定が揃っているか | 現場から言われるまで気づけない |
| `check-maintainability` | ファイルの大きさ・1 行の長さ | 次に触る人が読めない・編集を失敗する |
| `check-hardcoded-colors` | UI 部品に色を直書きしていないか | テーマを切り替えても変わらない |
| `check-contract` | 外部 SaaS の契約（依存フィールド）と実装のズレ | 相手の変更に気づけない |
| `check-drill` | 復元訓練の鮮度 | 戻せないバックアップ |
| `check-imports` | `@platform/*` から取り込む名前が実在するか | **ビルドが落ちる**（型検査まで気づけない） |
| `check-unreachable-modules` | **実装があるのに `index.ts` から出ていないファイル**。`package.json` の `exports`・パッケージ内 import・export ゼロは対象外 | 2026-08、`tax/stamp-tax.ts`（印紙税・約 300 行）が**一度も公開されていなかった**。アプリから import できず、`advisor` にも `module-list` にも出ないので**存在自体が見えない**。`check-imports` は逆向き（書いた import が実在するか）しか見ていなかった |
| `check-input-validation` | **API が入力を検証しているか**。スキーマ検証・手書き・未検証を分けて数え、未検証は上限・スキーマ検証は下限でラチェット（`tools/input-validation-floor.json`）。免除は `// no-body-validation: <理由>` | **`as Record<string, string>` は型の嘘**で、実行時には何でも入る。2026-08 の実測で、本文を読む 122 本のうち **52 本（43%）が一度も検証していなかった**。基盤の `validate()` は 1 本でしか使われていなかった |
| `check-schema-types` | **Prisma schema の型の落とし穴と、金額の入口**。①金額が `Float` ②日時が `String` ③**金額を受ける API が整数で検証しているか**。上限方式（`tools/schema-types-limit.json`。③だけは上限 0） | **`Float` の金額は足すたびに誤差が積もり、請求書の合計が合わなくなる**。型を `Int` にしても**入口が小数を通せば書き込みで落ちる**（手作業では 6 件中 2 件しか見つけられなかった）。`check-schema` は `@id` と括弧しか見ていなかった |
| `check-app-ci` | **各アプリが自分の CI を持っているか**、テンプレート（`apps/crud-template/.github/workflows/ci.yml`）からずれていないか | **基盤の CI はアプリを見られない**（`.gitignore` で `apps/*` を除外・ADR 0021）。2026-08 の実測で **API 264 本のうち CI が見ていたのは 22 本（8%）**だった |
| `check-safety-parts` | **「使わないと危ない部品」が必要な場所で使われているか**（被覆率・**7 部品**）。critical（無害化・種別判定・宛先検証・鍵の比較）は 100%、レート制限／監査ログ／冪等は下限ラチェット（`tools/safety-parts-floor.json`）。免除は `// safe-source:` `// no-rate-limit:` `// no-audit:` を**その場に理由つきで**書く | **基盤に置いただけの部品は無いのと同じ**。「1 箇所でも使われていれば緑」にすると、12 本中 1 本だけ認可している状態が緑になる |
| `check-package-tier` | **パッケージの成熟度(`platform.tier`)の宣言と、依存の向き**。`stable` が `incubating` / `deprecated` に依存していないか | **未検証のパッケージを本番で掴む**／119 件すべてを本番品質で保守する羽目になる |
| `check-coverage` | **カバレッジが前回より下がっていないか**（下限ラチェット）。`core` / `crypto` / `guard` は絶対値 80% で守る。`coverage/coverage-summary.json` が無ければ skip | **閾値だけ書いて一度も測っていない**状態（2026-08 まで実際にそうだった） |
| `check-lockfile` | **pnpm-lock.yaml と全 package.json の一致**。`peerDependencies` は `auto-install-peers` で書き戻されるため、載っていること自体は正常とし指定のズレだけ報告 | **CI の `--frozen-lockfile` でデプロイが落ちる**（Amplify で実際に発生） |
| `check-build-ready` | `next build` が通る前提（entry・重複 export・import 解決・リテラル型の広がり・**例外/404 の受け皿**・**`exports` に無いサブパスの import**・**相対 import の `.js`**・**`middleware.ts` と `proxy.ts` の重複**・**`use client` の欠落**・**メタデータファイルの `default` export**） | ビルド失敗・白い画面 |
| `check-build-ready`（A7 / A8）| **`"use client"` が先頭にあるか** / **`route.ts` が決められた名前以外を export していないか** | どちらも**型検査も試験も通り、`next build` で初めて落ちます**。2026-08 に実際に 5 アプリを止めました（ADR-0025 の作業中）|
| `check-rate-limit` | **資源を使う公開 API**に回数制限があるか（AI・アップロード・外部プロセス）| **連打されるだけ**で費用が出る／ディスクが埋まる／CPU が占有される |
| `check-security-headers` | **セキュリティヘッダ**が全アプリに付いているか（CSP・X-Frame-Options ほか）| XSS・クリックジャッキング。**付け忘れても画面は動く**ので気づけない |
| `check-next-version` | Next.js のメジャー版が**置き先（Amplify）の対応範囲 12〜15**か | **手元では 16 でも動く**。気づくのは Amplify に上げたときで、そのときは「なぜか本番だけ動かない」を追うことになる（ADR-0025） |
| `check-codeowners` | **`.github/CODEOWNERS` の規則が実体を指しているか** | GitHub は**存在しないパスの規則を黙って無視**する。`tools/` を改名した瞬間に「レビュー必須のはず」が誰にも通知されなくなり、**気づくのはレビュー無しのものが本番に出たとき** |
| `check-runtime-boundary` | **ブラウザ / Edge で動くファイル**が、入口経由で `node:` に届くパッケージを巻き込んでいないか | `next build` が `UnhandledSchemeError` で落ちる。**自分では import していない**のに、束ねた入口が連れてくるので気づけない（上限ラチェット） |
| `check-unsafe-html` | **サニタイズしていない HTML の描画**（`dangerouslySetInnerHTML`）| **XSS**（画面を開いた人のセッションが奪われる）|
| `check-workflows` | **GitHub Actions のワークフロー**（履歴の深さ・秘密の直書き・権限・呼ぶスクリプトの実在）| **CI が動かない**（落ちるのではなく走らないので、緑に見える）|
| `verify-checks` | **検査そのものが生きているか**（わざと違反を置いて、赤になるか見る） | **緑なのに守れていない**（検査が壊れていても気づけない） |
| `advisor` | 重複コードの検出 | 同じものが増える |
| `setup.sh 構文` | セットアップスクリプトの構文 | 初日に詰まる |
| `Windows setup 検査` | Windows 環境の手順 | Windows で動かない |
| `check-allow-lists` | 検査の除外リストに静かに上書きされた項目が無いか | **除外したつもりが効いていない**(または知らぬ間に除外が増える) |
| `check-api-error-shape` | API のエラー応答が `traceId` を返す経路に乗っているか | 障害調査でログと突き合わせられない |
| `check-braces` | 括弧の対応(依存ゼロで検出) | ビルド前に構文エラーで止まる |
| `check-cookie-parsing` | クッキーを自前で解析していないか | **区切りの扱いを誤り、値を取り違える** |
| `check-css-vars` | 参照している CSS 変数が定義されているか | **テーマが効かず、既定色のまま出る** |
| `check-debt-slack` | 上限に「たるみ」が無いか(実測 < 上限) | 直した分だけ後戻りが素通りする |
| `check-doc-examples` | TSDoc の `@example` を実行して期待値と合うか | **例をコピーすると動かない** |
| `check-ime-enter` | Enter を拾うのに変換中を見ていない箇所 | **日本語入力の確定で誤送信** |
| `check-leftover-fixtures` | 検証用の一時ファイルが残っていないか | 実行のたびにゴミが増える |
| `check-locale-compare` | 日本語が入りうる並べ替えにロケール指定があるか | **五十音順にならない**(環境で結果が変わる) |
| `check-locale-format` | `toLocale*()` にロケール指定があるか | **サーバの設定で表示が変わる** |
| `check-preflight-coverage` | 作った検査が preflight から呼ばれているか | **検査を書いたのに一度も動かない** |
| `check-regex-pitfalls` | 検査・生成ツールの正規表現が範囲を取り違えていないか | **検査自身が誤検出・見落としをする** |
| `check-returns-mismatch` | `@returns` / `@throws` の説明と実装が一致するか | **`=== undefined` が常に false**・**`try/catch` で捕まらない** |
| `check-risky-duplicates` | 壊れると実害がある同名関数が増えていないか | **片方だけ直して静かに食い違う** |
| `check-scan-reporting` | 検査が「何件見たか」を報告しているか | **0 件検査して緑**でも気づけない |
| `check-server-fonts` | PDF・画像にする HTML のフォントがサーバに実在するか | **帳票が豆腐(□)になる** |
| `check-server-localtime` | サーバ側でローカル時刻を使っている箇所 | **JST の 00:00〜08:59 に日付が 1 日ずれる** |
| `check-source-paths` | 資料中の「ここを見ろ」というパスが実在するか | 手順書のパスが切れている |
| `check-placeholders` | 引き継ぎ時に書き換えが要る設定（**落としません**） | **レビューが誰にも回らない** / メールが届かない |
| `check-a11y` | 画像の代替文字・クリックできる要素・`tabIndex`・`lang`・フォーカス表示 | **キーボードだけで使えない** / 読み上げで意味が分からない |
| `check-e2e-quality` | E2E が Flaky になりにくい書き方か（待ち方・固定待機） | **たまに落ちるテスト**は、いずれ誰も見なくなる |
| `check-schema` | Prisma スキーマの重複・`@id` の有無・括弧の整合 | **`@id` が無いモデル**は更新も削除もできない |
| `check-dual-impl-args` | メモリ実装と Prisma 実装で引数の数が揃っているか | **片方だけ直すと、試験では通るのに本番で落ちます**（逆もあり、**どちらも気づきにくい**）。**型検査の代わりではなく、回せないときの保険**です |
| `check-unbounded-query` | `findMany` に上限（`take`）があるか | **全件を読むので、数人の間は速く、100 人で急に遅くなる**——遅くなったときには**動いているものを触る**ことになる |
| `check-order-by` | 一覧の並び順が指定されているか | **開くたびに並びが変わる**(更新した行が別の場所へ飛ぶ) |
| `check-style-literals` | 見た目の値(文字サイズ・角丸)の直書きが増えていないか | **テーマを切り替えても変わらない**(同じ役割の文字が画面で違うサイズになる) |
| `check-delete-confirm` | 画面からの削除に確認があるか | **隣の行を押し間違えて消す**(元に戻せない) |
| `check-file-input-disabled` | ファイル選択が処理中に無効化されているか | **同じファイルが二重に上がる**(押した人は反応が無いと思って選び直す) |
| `check-unguarded-json-parse` | `JSON.parse` が try/catch で守られているか | **壊れたボディで 500 → 送信元がリトライし続ける** |

## `showcase` を対象外にするかの基準

検査によって `apps/showcase` を除外したりしなかったりします。**基準はこれです。**

| 除外する | 除外しない |
|---|---|
| **業務データを扱わないので実害が無い**もの | **見本として正しくあるべき**もの |
| 例: 削除の確認（`check-delete-confirm`）、ファイル選択の無効化（`check-file-input-disabled`）、見た目の直書き（`check-style-literals`） | 例: 金額・日付・率の表示（smoke）、`orderBy` の指定（`check-order-by`） |

**判断のしかた:** その検査が守っているものが
「**利用者のデータを壊さないため**」なら除外してよく、
「**書き方の見本**」なら除外してはいけません。

2026-08 に `showcase` へ `Number(e.target.value)` が **42 箇所**残っているのが見つかりました
——**見本が古いと、それを真似た人が古い書き方をします**。
金額を扱う 3 つ（請求書・見積・税）は直しましたが、残りは手つかずです。

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
| 大きいファイル・長い行 | 9 件 / 1,372 行 | `tools/maintainability-limit.json` | `node tools/check-maintainability.mjs --set-limit` |
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
| 大きいファイルは 7 件 | `utils/numbers.ts`・`utils/strings.ts`・`datetime/calendar.ts` は関数の集まりなので、分割の効果は薄い。`internal-app/prisma/seed.ts` は 19 ステップの並びで、切ると全体像が見えなくなる |

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

- `docs/onboarding/05-verify.md`（検証の考え方）
- `docs/ops/COMMANDS.md`（コマンド一覧）
- `docs/ops/TESTING_GUIDE.md`（テストの書き方）
- `docs/ops/TESTING_GUIDE.md` / `docs/ops/BACKUP_RESTORE.md`


## 実行時間（2026-08 実測）

| | 時間 |
|---|---|
| `node tools/preflight.mjs`（全 103 種類） | **約 6 分** |
| `node tools/preflight.mjs --apps-only`（57 種類） | **約 2 分 40 秒** |

内訳の上位:

| 検査 | 時間 | 備考 |
|---|---|---|
| `verify-checks` | **174 秒** | 検査自体が発火するかを確かめる（**基盤専用**） |
| `smoke` | **113 秒** | 2,474 件の検査 |
| `check-build-ready` | 6 秒 | |
| `check-generated` | 6 秒 | 基盤専用 |
| `check-debt-slack` | 6.5 秒 | 基盤専用 |
| ほか 74 種類 | 合計 40 秒ほど | |

**`--apps-only` は「基盤そのものの健全性」を見る 22 件を飛ばす。**
アプリのソースを 1 行も見ない検査で、基盤の CI が回せば十分だからである
（ADR 0024。アプリ側 CI のテンプレートはこちらを使う）。

飛ばす一覧は `tools/preflight.mjs` の `PLATFORM_ONLY` にある。
**アプリを走査する検査をここへ入れないこと**——入れた瞬間、
そのアプリは**誰にも検査されなくなる**（基盤の CI からはアプリのソースが見えない）。

`check-scan-reporting` は単体では **156 秒**（全検査を叩き直すため）だが、
preflight からは `--from-cache` で呼ばれるので実質 0 秒。
**単体で実行するときだけ遅い**ので驚かないこと。
