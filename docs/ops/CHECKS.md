# 検査の一覧（preflight は何を見ているか）

`node tools/preflight.mjs` は **依存をインストールせずに 31 個の検査**をまとめて実行する。
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
| `check-doc-numbers` | 手書き資料の数値が実態と合っているか | 資料の数字が嘘になる |
| `check-ports` | アプリのポート重複 | 同時起動できない |
| `check-package-shape` | パッケージ構成が規約どおりか | 解決できない import |
| `check-docs-links` | 資料内のリンク・パス・`pnpm` コマンドの実在 | 手順書どおりで動かない |
| `check-docs-duplication` | 資料の重複記述 | 直す場所が増える |
| `check-docs-orphans` | どこからも辿り着けない資料が無いか | 書いたのに読まれない |
| `check-doc-apis` | 資料のコード例が実在する API を使っているか | 真似したら動かない |
| `check-e2e-quality` | E2E テストの質（意味のある検証か） | 通るだけのテスト |
| `check-app-rules` | アプリが基盤の役割を侵していないか。**生タグの上限**と**手書き Cookie** も見る | 属人化・作法の崩壊・Secure の付け忘れ |
| `check-api-auth` | 認可も公開宣言も無い API が増えていないか | URL を知っていれば誰でも叩ける |
| `check-permissions` | 使っている権限がポリシーに定義されているか | 誰も通れず 403 になる |
| `check-reimplementation` | 基盤にある機能をアプリで作り直していないか | 直す場所が増え、強度もばらつく |
| `check-showcase-deps` | デモの依存と `transpilePackages` の整合 | ビルド失敗 |
| `check-app-transpile` | 各アプリの `transpilePackages` の網羅 | ビルド失敗 |
| `check-jsx-tags` | JSX の閉じ忘れ | ビルドが構文エラーで落ちる |
| `check-a11y` | 画像の alt・キーボード操作・読み上げ名 | 一部の人が操作できない画面 |
| `check-pwa` | ホーム画面追加・オフラインの設定が揃っているか | 現場から言われるまで気づけない |
| `check-maintainability` | ファイルの大きさ・1 行の長さ | 次に触る人が読めない・編集を失敗する |
| `check-hardcoded-colors` | UI 部品に色を直書きしていないか | テーマを切り替えても変わらない |
| `check-contract` | 外部 SaaS の契約（依存フィールド）と実装のズレ | 相手の変更に気づけない |
| `check-drill` | 復元訓練の鮮度 | 戻せないバックアップ |
| `check-imports` | `@platform/*` から取り込む名前が実在するか | **ビルドが落ちる**（型検査まで気づけない） |
| `check-build-ready` | `next build` が通る前提（entry・重複 export・import 解決・**リテラル型の広がり**） | ビルド失敗 |
| `advisor` | 重複コードの検出 | 同じものが増える |
| `setup.sh 構文` | セットアップスクリプトの構文 | 初日に詰まる |
| `Windows setup 検査` | Windows 環境の手順 | Windows で動かない |

## 上限つきの検査（ラチェット）

一度に全部は直せないが、**増やさない**ことはすぐできる。次の 2 つは現状値を上限として記録し、
**超えたら失敗・下回ったら上限を下げる**運用にしている。数が一方向にしか動かなくなる。

| 対象 | 記録先 | 上限を下げる |
|---|---|---|
| 生タグ（`<button>` 等）の使用箇所 | `tools/ui-raw-tag-limit.json` | `node tools/check-app-rules.mjs --set-limit` |
| 認可の無い API の本数 | `tools/api-auth-limit.json` | `node tools/check-api-auth.mjs --set-limit` |
| 基盤と同名の実装 | `tools/reimplementation-limit.json` | `node tools/check-reimplementation.mjs --set-limit` |
| 大きいファイル・長い行 | `tools/maintainability-limit.json` | `node tools/check-maintainability.mjs --set-limit` |
| 色の直書き | `tools/hardcoded-colors-limit.json` | `node tools/check-hardcoded-colors.mjs --set-limit` |
| 復元訓練の間隔 | `ops/drills/restore-drill.json` | 訓練を実施して記録を更新 |

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
