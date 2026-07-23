# 開発規約 (AI・開発者 共通)

このリポジトリは **社内基盤(packages)** と **アプリ(apps)** を分離したモノレポです。
**作業する前に必ず本ファイルを読んでください。**

> **このファイルの位置づけ**: 「**何を守るか**」を書いています。人間にも AI にも同じく適用されます。
> Claude Code / Cursor / GitHub Copilot などは、このファイルを自動で読みます。
>
> | 知りたいこと | 見るファイル |
> |---|---|
> | **何を守るか**（規約・大原則） | このファイル |
> | どう書くか（定型コード） | `docs/ai/patterns.md` |
> | なぜそうなのか（設計判断） | `docs/ai/architecture.md` / `docs/adr/` |
> | **Cursor の使い方**（道具の操作） | `docs/ops/CURSOR_GUIDE.md` |
> | どのコマンドを打つか | `docs/ops/COMMANDS.md` |

## AI向けドキュメント(まずここを読む)

- `docs/ai/architecture.md` … 層のルール・ストアの作り方・検証手順・変更チェックリスト
- `docs/ai/module-list.md` … 113 パッケージのカテゴリ別インデックス(自動生成: `node tools/gen-module-list.mjs`)
- `docs/ai/patterns.md` … ストア/route/スモーク/通知/UI の定型コード
- 各 `packages/<name>/README.md` … 個別パッケージの用途・使い方(113/113 整備済み)

新機能の前に module-list で既存部品を確認し、車輪の再発明を避けること。

**MCP が使える環境なら** `search_platform` ツールで基盤を直接検索できる(接続方法: `docs/ai/mcp-catalog.md`)。
`pnpm mcp:catalog` で起動。日本語で「csv 出力」「メール送信」等と引けば、該当パッケージと API が返る。
`find_examples` で使用例(demos/)、`explain_rules` で設計ルールも引ける。

## AI が守ること(人間のレビュー前に自分で確認する)

- **実装前に基盤を検索する**(`search_platform` / module-list)。既にある部品を再実装しない。
  基盤にあれば**必ず使う**。無ければ「基盤に追加すべきか」を提案してから実装する。
- **apps に汎用処理を書かない**(CSV・PDF・ログ・バリデーション・HTTP など。上の表を参照)。
- **`pnpm check` を通す**。「テストが通りました」と報告する前に、実際に実行する。
- **`any` / `@ts-ignore` で型エラーを塞がない**。型エラーは設計の問題を示すサイン。
- **存在しない API を提案しない**。不確かなら `describe_package` で確認する。
- **色をハードコードしない**(`var(--color-primary)` を使う)。テーマ切り替えに追従させるため。
- **`process.env` を直接読まない**(`server/env.ts` に集約)。

## アプリ開発の基本フロー(最重要)

**基盤(`packages/`)は共通機能の唯一の実装元。** アプリ(`apps/`)は業務ロジックと UI に専念する。

`apps/` や `demos/` を実装するときは、必ずこの順で進める:

1. **まず基盤に既存機能が無いか探す。**
   - MCP が使えるなら `search_platform("csv 出力")`(最速)
   - `pnpm dev:portal`(:3005)で検索
   - `docs/ai/module-list.md`(カテゴリ別インデックス)
   - 使い方の実例は `find_examples("請求書")` または `demos/`
2. **あれば必ず使う。** 似た処理を自作しない。
3. **無ければ**、それが汎用部品か業務固有かを判断する(下の基準)。
   - 汎用なら **基盤への追加を提案**する(`pnpm scaffold <name>`。**別 PR** にする)
   - 業務固有ならアプリ側に実装する

### apps に実装してよいもの / いけないもの

| ✅ apps に書く(業務そのもの) | ❌ apps に書かない(基盤にある) |
|---|---|
| 経費申請の承認フロー | 認証・認可・権限判定 |
| 勤怠の集計ロジック | ログ・監査 |
| 見積の金額計算・税計算の適用 | バリデーション・日付/数値/文字列処理 |
| 画面の表示制御・遷移 | CSV・PDF・Excel・帳票 |
| 業務フロー固有の分岐 | メール・通知・SMS |
| このアプリだけの設定 | ファイル操作・ストレージ |
| | **UI 部品(ボタン・入力欄・プルダウン等)** |
| | HTTP クライアント・外部 API 連携 |
| | AI 連携・RAG・MCP |
| | Workflow・Scheduler・Queue・Cache |
| | Feature Flag・設定管理 |
| | テストユーティリティ |

### UI 部品は `@platform/ui` を使う

**生の `<button>` / `<input>` / `<select>` / `<textarea>` を書かないこと。**

```tsx
// ❌ 生タグ + inline style や Tailwind 直書き
<button className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white">保存</button>
<input className="rounded border px-2 py-1 text-sm" />

// ✅ 基盤の部品
import { Button, Input } from "@platform/ui";
<Button>保存</Button>
<Input placeholder="氏名" />
```

**なぜか**:

- **サイズが揃わない**。基盤で入力欄の高さを変えても、生タグは追従しない。
  実際、`h-10`→`h-9` にしたのに生タグの画面だけ大きいまま、という事象が起きた
- **スキンが効かない**。`bg-neutral-900` のような固定色はテーマを切り替えても変わらない。
  11 スキンを用意した意味が消える
- **1 箇所で直せない**。フォーカスリングやアクセシビリティ属性の修正が、
  基盤ではなく全アプリへの一括修正になる

`@platform/ui` にあるもの: `Button` / `Input` / `Textarea` / `Select` / `NumberInput` /
`PasswordInput` / `Checkbox` / `Radio` / `Switch` / `DatePicker` / `Combobox` /
`TagInput` / `ColorPicker` / `Slider` ほか。

**無い部品が必要なら、アプリで自作せず基盤に足す。**
そのとき「このアプリだけで使うか」を考える必要はない —— UI 部品は定義上どのアプリでも使う。

**現在 `@platform/ui` に無く、生タグで書かざるを得ないもの**(足したら生タグを消すこと):

| 用途 | 現状 | 使用箇所 |
|---|---|---|
| `<input type="datetime-local">` | 無い(`DatePicker` は日付のみ) | `demos/showcase/src/app/status-page` |
| `<input type="file">` | **`FileInput` を追加済み**(`label` を渡すとボタン風) | — |
| `<input type="range">` | **`Slider` で代替できる**(`value={[n]}` / `onValueChange={([v]) => …}`) | apps 各所(2 箇所・要置換) |

> 検査: `node tools/check-app-rules.mjs` が生タグを検出する(現在は警告)。
> 既存コードには未適用の箇所が多く残っている(移行中)。**新しく書くコードでは守ること。**

### 判断基準(基盤 or アプリ)

**基盤に置く**: 他のアプリでも使う可能性がある / 業務に依存しない / 汎用的 / テストしやすい
**アプリに置く**: このアプリだけで使い、業務依存が強い

迷ったら「**この処理、隣の部署のアプリでも使うか?**」と考える。使うなら基盤。

### 禁止事項(車輪の再発明)

- 独自のユーティリティを量産する
- 独自の HTTP クライアント / バリデーション / ログ / CSV / PDF を作る
- 他のアプリからコピー&ペーストして持ち込む

**実装前チェック**: 基盤に同等機能はないか / 似た処理が既にアプリ内にないか / 業務依存か / 再利用性はあるか

## 大原則

1. **アプリ/デモ(`apps/**`・`demos/**`)の修正時に、基盤(`packages/**`)のソースを編集してはいけない。**
   - アプリで不足する機能があっても、`packages/` のファイルを直接書き換えないこと。
   - 基盤の変更が必要な場合は、**アプリ作業とは別タスク**として切り出し、
     基盤側(CODEOWNERS の基盤担当)のレビューを経て変更する。
   - 基盤を変更したら `pnpm platform:check` で影響範囲(削除した API を誰が使っているか)を確認し、
     `pnpm platform:sync` で生成物を更新して同じ PR に含める。
     **バージョンは上げない**(理由: docs/adr/0011)。アプリのコミットに `packages/` の変更を混ぜない。

2. **ロジックはアプリ側に置く。** 基盤はロジックを持たない。
   基盤が担うのは「外部サービス連携・バリデーション・メール・電話・ファイル操作・
   共通UI」などの **機能単位の共通部品** のみ。

3. **有名ライブラリはラッパー(Adapter)経由で使う。**
   アプリは `nodemailer` や `@prisma/client` を直接 import しない。
   必ず `@platform/mail` `@platform/db` などの公開 API 経由で呼ぶ。
   ライブラリ差し替え時に基盤内部だけ直せばアプリは無変更で済む状態を保つ。

4. **公開 API は各パッケージの `src/index.ts` からの export のみ。**
   内部ファイル(`src/internal/*` など)へアプリから import しない
   (ESLint `boundaries` が機械的に禁止する)。

## 開発ルール(AI・セキュリティ / 壁打ち2026-07反映)

- **AI 呼び出しは必ず `@platform/ai`(AI Gateway)経由**。プロバイダ API の直叩き・API キーのコード直書きは禁止(理由: docs/adr/0010)。pricing / limits / logStore を設定してコストとログを一元化する。
- **RAG は「検索」、MCP は「操作」**として役割を分離する。自動化の優先順位は API > MCP > RPA(API があるなら RPA は使わない)。
- RAG を実装する際は**利用者の権限を継承した検索**にする(管理者権限での全検索は禁止)。
- 環境変数を増やしたら `.env.example` に追記(`node tools/check-env-example.mjs` が CI で検査)。
- 重要な設計決定は **ADR**(docs/adr/)に1枚残す。全体方針は docs/platform/ROADMAP.md。

## TSDoc(公開 API の説明)

**新しく作る/触る公開関数には必ず書く。** 型だけでは「何を渡すのか」「何が返るのか」「いつ例外が出るのか」が分からない。
エディタの補完に説明が出ないと、使う人は実装を読みに行くことになる。**AI も TSDoc が無いと誤った使い方を提案する。**

```ts
/**
 * 何をするか(1 行で)。
 *
 * 補足があれば段落で。**なぜそうしているか**を書くと価値が高い
 * (例:「中止は分母から除く。やらないと決めたものを未完扱いすると進捗が永久に 100% にならないため」)。
 *
 * @param tasks 対象のタスク
 * @param today 基準日(テスト注入用。既定は今日)
 * @returns 件数・完了率・期限切れ数
 * @throws {@link @platform/core#AppError} コード `VALIDATION` — 不正な入力の場合
 *
 * @example
 * ```ts
 * const p = summarize(tasks);
 * console.log(`${Math.round(p.rate * 100)}% 完了`);
 * ```
 */
```

| タグ | いつ書くか |
|---|---|
| 説明文 | **必ず**。1 行目は「何をするか」 |
| `@param` | 引数があるなら必ず。**型で分かることは書かない**(「文字列」ではなく「対象のタスク」) |
| `@returns` | 戻り値が void 以外なら必ず |
| `@throws` | `throw` するなら必ず。**どのコードで、どんな条件か**まで書く |
| `@example` | 使い方に迷いそうなものに。**動くコード**を書く |

**UI(React コンポーネント)にも書く。** props が何か、いつ使うかが分からないと再利用されない。

```tsx
/**
 * 設定を区分ごとの表で見せる。
 *
 * **秘密値は必ずサーバ側でマスクしてから渡すこと**(この画面は渡された値をそのまま表示する)。
 *
 * @param props.rows       表示する設定
 * @param props.groupNotes 区分ごとの説明(任意)
 * @param props.runtime    実行環境の情報(任意)
 */
export function EnvSettingsTable({ rows, groupNotes, runtime }: EnvSettingsTableProps) {
```

検査: `node tools/check-tsdoc.mjs`(全体の完備率)/ `node tools/check-tsdoc.mjs <package>`(不足の詳細)

**リファレンスサイト**(`pnpm site`)は TSDoc から**引数・戻り値・例外・使用例**を自動生成する。
書かなければサイトにも出ない = 使う人に伝わらない。

> **全 1,752 関数・113 パッケージが完備**(2026-07 時点)。**この状態を保つ**: 新規の関数には必ず書き、
> `node tools/check-tsdoc.mjs` で確認する
> (**正規表現での一括処理は関数を壊す**ので、1 ファイルずつ意味を確認しながら書くこと)。

## コーディング規約

- 言語は **TypeScript**、`strict` 必須。
- すべての公開関数・型・クラスに **TSDoc コメント**(`/** ... */`)を書く。
  `@param` `@returns` `@throws` `@example` を適切に付ける。
- エラーは `@platform/core` の `AppError` / `Result` 規約に従う
  (全パッケージで失敗の形を統一する)。
- **`Result` と例外(throw)の使い分け:**
  - *想定内の実行時失敗*(外部連携の失敗、DB エラー、入力検証など、呼び出し側が
    分岐して処理すべきもの)→ `Result` を返す(`ok`/`err`)。
  - *プログラマエラー・起動時の設定不備*(あってはならない状態、環境変数の欠落など、
    復旧不能で即停止すべきもの)→ `AppError` を throw する。
  - 例: `@platform/env` の `parseEnv` は throw、`@platform/mail`・`@platform/db`・
    `@platform/validation` は `Result` を返す。
- ログは `console.log` ではなく `@platform/logger` を使う。
- 環境変数は直接 `process.env` を読まず、`@platform/env` の検証済み値を使う。
- 各機能にはテスト(`*.test.ts`)を書く。外部依存はモックする。

## ドキュメント

- **基盤側ドキュメント** → `docs/platform/`(TSDoc から `pnpm docs:platform` で生成)。
- **アプリ側ドキュメント** → `docs/apps/`。
- 両者を混在させない。

## よく使うコマンド

### まずこれ

| コマンド | 何をするか | 引数 |
|---|---|---|
| **`pnpm check`** | **型 + Lint + スモーク**を一括。**コミット前に必ず** | — |
| `pnpm dev` | 全アプリを一斉起動(3000〜3005) | — |
| `pnpm doctor` | 環境診断(Node/pnpm/Docker/.env/生成物)。動かないときの切り分け | — |

### 開発サーバ(個別)

| コマンド | アプリ | ポート |
|---|---|---|
| `pnpm dev:internal` | 社内アプリ | 3000 |
| `pnpm dev:demos` | 基盤ショーケース | 3001 |
| `pnpm dev:crud` | CRUD テンプレート(新規アプリのコピー元) | 3002 |
| `pnpm dev:equipment` | 備品管理 | 3003 |
| `pnpm dev:site` | 公開サイト | 3004 |
| `pnpm dev:portal` | 基盤ポータル(部品を探す) | 3005 |

### 検証

| コマンド | 何を確かめるか | 引数 |
|---|---|---|
| `pnpm smoke` | ロジック 1100+ 項目(DB 不要・10 秒) | — |
| `pnpm typecheck` | 型 | — |
| `pnpm lint` | 書き方(依存境界も含む) | `--fix` で自動修正 |
| `pnpm test` | ユニットテスト(vitest) | — |
| `pnpm test:watch` | 変更を監視して自動テスト | — |
| `pnpm test:pkg <pkg> test` | 特定パッケージだけ | 例: `pnpm test:pkg @platform/tax test` |
| `pnpm e2e` | ブラウザで実操作(Playwright。DB 必要) | — |
| `pnpm e2e:ui` | E2E を UI モードで(失敗箇所が見える) | — |
| **`pnpm verify:offline`** | **preflight 全 17 項目 + 生成物 drift**。PR 前 | — |
| `pnpm loadtest` | 負荷テスト | `-- --url <URL> --concurrency 20 --duration 10000`(`--dry` でネットワーク不要) |

### 基盤(packages/)を作る・変える

| コマンド | 何をするか | 引数 |
|---|---|---|
| **`pnpm scaffold <name> "<説明>"`** | **規約どおりの雛形を生成**(手作りしない) | 例: `pnpm scaffold shipping "配送(送り状・追跡)"` |
| **`pnpm platform:check`** | 基盤の変更が**アプリに与える影響**を確認(削除した API を誰が使っているか) | — |
| **`pnpm platform:sync`** | 生成物(カタログ・API 一覧・ER 図)を更新 | — |
| `pnpm check:api` | 公開 API の破壊的変更を検出 | `--update` でスナップショット更新 |
| `pnpm check:deps` | 循環依存・層破り | — |
| `pnpm advisor` | 重複・類似・孤立パッケージの検出 | `dup` / `find <キーワード>` |

### 生成物(手で編集しない)

| コマンド | 何を生成するか |
|---|---|
| **`pnpm gen:all`** | **全生成物を正しい順で再生成**し drift ゼロを確認(2 パス) |
| `pnpm gen:reference` | API リファレンス JSON(TSDoc から引数・戻り値も) |
| `pnpm gen:site` / `pnpm site` | リファレンスサイト(`docs/site/index.html`) |
| `pnpm gen:erd` | ER 図(Mermaid) |
| `pnpm gen:appmap` | 各アプリの画面・API 一覧 |
| `pnpm gen:depgraph` | パッケージ依存グラフ |

### データベース(ローカル Docker)

| コマンド | 何をするか |
|---|---|
| `pnpm db:up` | PostgreSQL + Mailpit を起動 |
| `pnpm db:down` | 停止 |
| `pnpm db:reset` | 作り直し(**データは消える**) |
| `pnpm db:psql` | psql に接続 |

> スキーマの適用は **`db push`**(マイグレーション履歴は持たない。理由: docs/adr/0013)。
> `pnpm --filter internal-app exec prisma db push` で反映する。

### AI・環境

| コマンド | 何をするか |
|---|---|
| **`pnpm mcp:catalog`** | **基盤カタログ MCP** を起動。AI から `search_platform("csv 出力")` で部品を探せる |
| `pnpm mcp` | 社内データの MCP サーバ |
| `pnpm fresh` | node_modules を消して再インストール(依存が壊れたとき) |
| `pnpm clean` | dist / .next / .turbo / node_modules を全削除 |
| `pnpm outdated` | 依存の更新可能なものを確認(変更はしない) |

### 個別の検査ツール(preflight に同梱。単体でも呼べる)

| コマンド | 何を検出するか |
|---|---|
| `node tools/check-tsdoc.mjs [pkg]` | TSDoc の不足(引数 or 戻り値 or 例外の説明が無い) |
| `node tools/check-app-rules.mjs` | apps が基盤の役割を侵していないか |
| `node tools/check-ports.mjs` | 開発ポートの重複・ドキュメントとの不一致 |
| `node tools/check-package-shape.mjs` | tsconfig / scripts / vitest.config の欠落 |
| `node tools/check-docs-links.mjs` | 資料のリンク切れ・存在しないコマンドの案内 |
| `node tools/check-e2e-quality.mjs` | E2E の Flaky リスク(固定待ち等) |
| `node tools/check-app-transpile.mjs` | apps の next.config `transpilePackages` 漏れ(next build が落ちる) |
| `node tools/check-jsx-tags.mjs` | JSX インラインタグの閉じ忘れ・`**` 混入(next build を落とす構文エラーの一次検知) |

> **`pnpm changeset` は使わない。** バージョンを上げない方針(docs/adr/0011)。
> `.changeset/` は将来 外部配布する日のために残してあるだけ。

> **生タグの歯止め**: `<button>` / `<input>` / `<select>` / `<textarea>` の使用箇所数は
> `tools/ui-raw-tag-limit.json` に上限として記録されている。**増やすと preflight が失敗する**。
> 減らしたら `node tools/check-app-rules.mjs --set-limit` で上限を下げること。
> 現在の残り(44)は、**機械的に置換すると壊れるもの**だけ:
> - `<input type="file">` 11 … `FileInput` は自前のボタンを描画するため、hidden + ラベルで起動している箇所は見た目が変わる
> - `<input type="radio">` 5 … `RadioGroup` + `RadioGroupItem` へ構造ごと組み替える必要がある
> - `<select>` 26 … 数値 value(`value={3}`)や `.filter().map()` を含み、options への変換に人の判断が要る
> - `<input type="checkbox">` 1 … 上記いずれにも当てはまらない特殊形
>
> これらは画面を動かして確かめながら、1つずつ置き換える。

> **API の認可**: `apps/**/api/**/route.ts` は、認可（`requirePermission` / `requireUser` / API キー検証）を通すか、
> 通さない理由をファイル冒頭に `// public-api: 理由` として書く。どちらも無い本数は
> `tools/api-auth-limit.json` に上限として記録され、**増やすと preflight が失敗する**。
> 「画面に出していないから大丈夫」は成立しない（URL は通信を見れば分かる）。

> **名前は実際の振る舞いに合わせる**: `require〜` という名前の関数は、条件を満たさなければ
> **必ず例外を投げる**こと。値を返すだけなら `current〜` にする。
> 実際に `requireUser` が null を返すだけの実装になっており、
> 呼び出し側が判定を書き忘れれば素通りする状態だった（現在は `currentUser` /
> `requireUserOrThrow` に分けてある）。判定は**呼ぶ側に任せず、関数側に寄せる**。

> **Cookie は手書きしない**: `set-cookie` を文字列で組み立てると、属性の付け忘れが必ず起きる。
> 実際に **`Secure` が全 5 箇所で抜けており**、HTTPS 以外でもセッションが送られる状態だった。
> `@platform/session` の `serializeCookie` / `clearCookie`（`Secure`・`HttpOnly`・`SameSite` が既定で付く）
> か、`createSession` の `write` / `destroy` を使う。手書きは `check-app-rules` が検出する。

> **読める大きさを保つ**: 1 ファイル 600 行・1 行 200 文字を目安にする。
> 長い行は差分が読めないだけでなく、**文字列置換での編集が失敗する原因**になる
> （実際に何度も起きた）。件数は `tools/maintainability-limit.json` に上限として記録され、
> 増やすと preflight が失敗する。

> **デモを足すときは** `docs/ops/ADD_DEMO.md` を見ること。画面・nav.ts・overviews.ts・
> smoke の件数・資料の本数の **5 か所**を更新する。忘れても preflight が具体的に教える。

> **色を直書きしない**: `bg-slate-100` のように書くと、**テーマを切り替えても変わらない**。
> 実際、濃色サイドバーのテーマを足したとき、選択中の項目だけ白いまま残って読めなくなった。
> 薄い背景は `bg-[var(--color-subtle)]` / `bg-[var(--color-subtle-strong)]` を使う
> （現在の文字色を薄く敷くので、明るいテーマでも暗いテーマでも馴染む）。
> 状態色（成功・警告・エラー）は**意味を固定したいので直書きしてよい**
> — その場合は `tools/check-hardcoded-colors.mjs` の ALLOW に理由付きで登録する。

> **文字列リテラルは広がる**: `type X = { kind: "A" | "B" }` の配列に
> `setX((l) => [{ kind: "A" }, ...l])` と書くと、`"A"` が `string` に広がって
> **ビルドの型検査だけで落ちる**（依存を入れずに動く検査では見つけにくい）。
> `kind: "A" as const` にするか、`kind: X["kind"]` と型注釈のある引数を経由する。
> `check-build-ready` が `[T]` として検出する。

> **部品の高さは固定しない**: `h-9` のように決め打ちすると、中身が増えたときに
> **はみ出した部分が見えなくなる**（アイコン一覧で、名前は出るのに絵が出ない状態になった）。
> `min-h-*` にしておけば、文字だけのときの見た目は変わらず、増えたときだけ伸びる。
>
> **外部ライブラリの形は変わる**: lucide の `icons` は版によって有無が変わる。
> 名前で引く仕組みは、**取得経路を 1 つに賭けない**（`icon.tsx` の `buildRegistry` が両方に対応）。

> **依存の多い基盤は重く扱う**: `@platform/core` は **54 パッケージ・142 ファイル**が依存する（2026-07 時点）。 <!-- doc-numbers:ignore -->
> 名前を消さなくても、**引数や戻り値を変えれば全体が壊れる**（型検査でしか分からない）。
> `check-core-signatures` が形を記録しており、変えると preflight が止まる。
> 意図した変更なら `node tools/check-core-signatures.mjs --update` で記録を更新し、
> **なぜ変えたかをコミットメッセージに書く**。
