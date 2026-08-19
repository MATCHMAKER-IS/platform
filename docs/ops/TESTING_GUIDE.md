# テストとデバッグ

「壊れていないか確かめる」方法と、「壊れたとき原因を探す」方法をまとめています。

**迷ったら `pnpm check`。** これが基本です。

---


> **【範囲】ここには「試験の書き方」を書きます。**
>
> **どのアプリで何をカバーしているか**は、
> **各アプリの `README.md`（このアプリの運用）**にあります——
> **アプリが増えるたびにここが伸びると、書き方が埋もれます**。

## 【最初に読む】どの検査が、何を見ているか

**種類が多いので、まずここで役割を掴んでください。**

| コマンド | 何を見るか | かかる時間 | いつ回すか |
|---|---|---|---|
| **`pnpm smoke`** | **基盤 120 パッケージの動き**（2,468 件）。実装を直接呼んで、**関数が期待どおり動くか**を確かめます | **1〜2 分** | **書き換えたら毎回** |
| **`pnpm test`** | **単体テスト**（vitest / 342 ファイル）。パッケージごとの細かい振る舞い | 数分 | 書き換えたら毎回 |
| **`node tools/preflight.mjs`** | **75 本の検査**をまとめて実行（うち 69 本）。**書き方の約束**が守られているか——並び順・上限・伏せ字・権限の印など | **数分**（`check-scan-reporting` が遅い） | **出す前** |
| **`pnpm check`** | **型 → lint → smoke** の順。**型の不一致**はここでしか見つかりません | 数分 | 書き換えたら毎回 |
| **`pnpm verify`** | 依存・API の差分・型・テスト。**通しの確認** | 数分〜 | 出す前 |
| **`pnpm e2e`** | **ブラウザで画面を操作**（10 ファイル）。**押して動くか** | 数分 | 画面を直したら |
| **`pnpm loadtest`** | **応答時間と同時実行**。100 人規模で耐えるか | 数分 | 人が増えたとき |
| **`pnpm drill`** | **バックアップから戻せるか**（復元訓練） | 十数分 | **半年に 1 回** |
| **`pnpm advisor`** | 基盤の使われ方を分析し、**再実装や重複**を報告 | 1 分 | ときどき |
| **`pnpm suggest <言葉>`** | **基盤に既にあるもの**を探す | 数秒 | **作る前** |

### 使い分けの目安

| したいこと | 回すもの |
|---|---|
| **書き換えた直後** | `pnpm check`（型 + lint + smoke） |
| **出す前** | `node tools/preflight.mjs` |
| **画面を直した** | `pnpm e2e` |
| **遅いと言われた** | `pnpm loadtest` → `docs/ops/SLOW_TRIAGE.md` |
| **何か作る前** | `pnpm suggest <やりたいこと>` |

### smoke と test（vitest）の違い

**どちらも「動くか」を見ますが、目的が違います。**

| | smoke | test（vitest） |
|---|---|---|
| **狙い** | **全体が壊れていないか**を素早く | **1 つの関数を細かく** |
| **件数** | 2,468 件を**1 ファイル**に集約 | 342 ファイルに分散 |
| **書く場所** | `tools/smoke.mjs` | 各パッケージの `*.test.ts` |
| **いつ足すか** | **基盤の約束**を守らせたいとき | **関数の振る舞い**を固定したいとき |

**smoke には「検査が効いているか」の検査も入っています**——
**書き方の約束**（並び順・上限・資料の記述）は smoke で見張っています。


## 実行のしかた

```bash
pnpm test          # turbo 経由。prisma generate も先に走るので、これが基本
pnpm exec vitest run   # 直接実行。**先に `pnpm --filter @platform/db db:generate` が要る**
```

`@prisma/client` は生成物が無いと import した時点で落ちる
(`Cannot find module '.prisma/client/default'`)。`pnpm test` なら turbo が
`^build` で生成するが、vitest を直接叩くと生成されない。

### turbo が動かないとき

turbo 2.10.5 は **Windows で `0xC0000409`(スタック破壊)により落ちることがある**。
タスクを 1 つも実行せず、ログも出さないので原因が分かりにくい。
`ui` を `stream` にしても `--concurrency=1` でも変わらない(2026-07 時点で未解決)。

turbo を経由しない代替を用意してある。

```bash
# **これらが既定です。** turbo は Windows で動かないため、
# pnpm dev / build / test はすべて turbo を通りません（そのまま使えます）
pnpm build            # 依存順にビルド（遅いがログが出る）
pnpm test             # vitest を直接実行
pnpm dev              # 全アプリを一斉起動

# turbo を試したいときだけ（Windows では落ちます）
pnpm dev:turbo / pnpm build:turbo / pnpm test:turbo
```

1 つだけ起動したいときは `--filter` を使う。**画面を見るだけならこちらが軽い。**

```bash
pnpm --filter showcase dev      # http://localhost:3001（統合デモ）
pnpm --filter internal-app dev       # http://localhost:3000
pnpm --filter platform-portal dev    # http://localhost :3001
```

デプロイ(Amplify)は `apps/showcase` だけをビルドするので、この問題の影響を受けない。

`*.integration.test.ts` は **Docker(testcontainers)が要る**ため通常実行から外してある。
実行するときは明示的に呼ぶ。

```bash
pnpm --filter @platform/db test:integration   # 要 Docker
```

`.spec.ts` は Playwright(e2e)のもので、vitest は `.test.ts` だけを見る
(`@platform/config` の `vitest.preset.mjs` で明示)。e2e は `pnpm e2e` で実行する。

## テストの全体像

このリポジトリには 6 種類の検証があります。**速いものから順に**使ってください。

| # | 種類 | コマンド | 何を確かめる | 速さ | DB |
|---|---|---|---|---|---|
| 1 | **スモーク** | `pnpm smoke` | ロジック 1000+ 項目 | 10秒 | 不要 |
| 2 | **型チェック** | `pnpm typecheck` | 型の整合 | 30秒 | 不要 |
| 3 | **Lint** | `pnpm lint` | 書き方の統一 | 30秒 | 不要 |
| 4 | **ユニットテスト** | `pnpm test` | 関数単位の動作 | 1分 | 不要 |
| 5 | **E2E** | `pnpm e2e` | ブラウザで実操作 | 5分 | **必要** |
| 6 | **負荷テスト** | `pnpm loadtest` | 性能・限界 | 任意 | 必要 |

### まとめて実行

```bash
pnpm check              # 1+2+3（コミット前。これが基本）
pnpm verify:offline     # 上記 + 依存境界・生成物・ポート・設定の整合（PR 前）
```

CI でも同じものが走ります。**手元で通してから PR を出す**とレビューが速くなります。

---

## 1. スモーク（`pnpm smoke`）— 最初に使うもの

**このリポジトリで最も使うテスト**です。1000 項目以上を 10 秒で検証します。

### 特徴

- **DB も外部サービスも不要**（メモリ実装で代替）
- ロジックだけを高速に検証
- `tools/smoke.mjs` に全部入っている（1 ファイル）

### いつ使うか

**コードを書いたら毎回。** 保存 → `pnpm smoke` を癖にしてください。

### 追加の仕方

```js
// tools/smoke.mjs の末尾（結果表示の直前）に追加
{
  section("あなたの機能名");
  const M = await import("../packages/xxx/src/index.ts");
  ok("何を確かめるか", M.someFunc(1) === 2);
}
```

`ok(説明, 条件)` で 1 項目。条件が `true` なら通ります。

### 落とし穴

外部パッケージを import しているモジュールは、そのままでは動きません（`pnpm install` 前提のため）。**依存を一時ファイルに合成してから import** します。既存のブロックが参考になります。

---

## 2. 型チェック（`pnpm typecheck`）

TypeScript の型が合っているかを見ます。**このリポジトリは `strict` + `noUncheckedIndexedAccess`** なので、かなり厳しいです。

### よくあるエラーと対処

| エラー | 意味 | 対処 |
|---|---|---|
| `Object is possibly 'undefined'` | 配列アクセスは undefined かも | `arr[0]` → `arr[0]!` ではなく、`if (!x) return` で分岐 |
| `Type 'string \| undefined' is not assignable` | undefined が混ざっている | `?? ""` で既定値、または型を見直す |
| `Property 'x' does not exist` | その型にない | 型定義を確認。存在しない API を呼んでいないか |

### `any` は使わない

型エラーは「設計がおかしい」サインのことが多いです。`any` や `@ts-ignore` で塞ぐと、**後で必ず困ります**。

AI に直させるときも「`any` を使わずに」と指示してください（AI は困ると `any` で逃げます）。

---

## 3. Lint（`pnpm lint`）

ESLint が書き方を統一します。**依存の境界**（アプリが基盤を勝手に変えない等）もここで機械的に守っています。

```bash
pnpm lint --fix     # 自動修正できるものは直す
```

---

## 4. ユニットテスト（`pnpm test`）

vitest で関数単位の動作を確認します。

### どこに書くか

```
packages/xxx/src/foo.ts        ← 実装
packages/xxx/src/foo.test.ts   ← テスト（隣に置く）
```

### 書き方

```ts
import { describe, it, expect } from "vitest";
import { calcTax } from "./tax.js";

describe("calcTax", () => {
  it("10%を計算する", () => {
    expect(calcTax(1000, 0.1)).toBe(100);
  });

  it("端数は切り捨て", () => {
    expect(calcTax(999, 0.1)).toBe(99);
  });

  it("マイナスはエラー", () => {
    expect(() => calcTax(-1, 0.1)).toThrow();
  });
});
```

**境界値**（0・マイナス・最大値・空文字）を必ず入れてください。バグはそこに出ます。

### 一部だけ実行

```bash
pnpm test:watch                          # 変更を監視して自動実行（開発中に便利）
pnpm --filter @platform/tax test         # 特定パッケージだけ
pnpm --filter @platform/tax test -- -t "端数"   # 名前で絞る
```

### カバレッジ

```bash
pnpm --filter @platform/tax test -- --coverage
```

閾値は共通で **80%**（`@platform/config` の `vitest.preset.mjs` で一元管理）。

---

## 5. E2E（`pnpm e2e`）— ブラウザで実操作

### いま覆っている範囲（2026-08 実測）

**10 ファイル・35 テスト**あります。

| 覆っているもの | ファイル |
|---|---|
| 主要な業務の流れ | `business-flow`（8）/ `expense-flow`（5） |
| 認証・登録 | `internal-auth`（6）/ `register`（4） |
| キーボード操作 | `keyboard`（4） |
| 画面が開くか | `home` / `dashboard` / `smoke` / `crud-template` / `internal-equipment` |

### 覆っていないもの（**足すならここから**）

| 業務 | なぜ必要か |
|---|---|
| **請求書の発行** | **金額が動く**のに E2E が無い。見積 → 請求 → 入金の流れ |
| **契約の更新** | **解約通知の期限を過ぎると自動更新**される。期限の表示が正しいか |

**書くときは実際に赤くしてから緑にしてください。**
書いただけで動かさないと、**通っているつもりのテスト**が増えます
——`pnpm e2e` は**ブラウザが要る**ので、CI か手元の実機で確かめてください。


Playwright が実際のブラウザを動かします。**DB とアプリの起動が必要**です。

### 準備

```bash
pnpm db:up                                    # DB を起動
pnpm --filter internal-app exec prisma db push
pnpm exec playwright install chromium         # 初回のみ（ブラウザをDL）
```

### 実行

```bash
pnpm e2e                    # 全部
pnpm e2e:ui                 # UI モード（おすすめ。何が起きたか見える）
pnpm --filter internal-app e2e    # internal-app だけ
```

### UI モードが便利

`pnpm e2e:ui` を使うと:

- テストが**どこで失敗したか**を画面で見られる
- **各ステップのスクリーンショット**が残る
- ブラウザの Console ログも見える

E2E のデバッグはこれが圧倒的に速いです。

### 既存のテスト

| ファイル | 内容 |
|---|---|
| `e2e/home.spec.ts` | showcase のトップ |
| `e2e/crud-template.spec.ts` | CRUD テンプレートの一覧・登録 |
| `e2e/internal-equipment.spec.ts` | 備品の貸出・返却 |
| `e2e/internal-auth.spec.ts` | ログイン・2 要素認証 |
| `e2e/business-flow.spec.ts` | 見積 → 受注 → 請求 |
| `e2e/dashboard.spec.ts` | ダッシュボードの表示 |
| `e2e/keyboard.spec.ts` | キーボード操作(アクセシビリティ) |
| `e2e/register.spec.ts` | 問い合わせの登録 |
| `apps/internal-app/e2e/expense-flow.spec.ts` | 経費 CSV 取込 → 承認 |
| `apps/internal-app/e2e/smoke.spec.ts` | 主要画面が開くか |

### 書き方

```ts
import { test, expect } from "@playwright/test";

test("経費を申請できる", async ({ page }) => {
  await page.goto("/expenses");
  await page.getByRole("button", { name: "新規申請" }).click();
  await page.getByLabel("金額").fill("1000");
  await page.getByRole("button", { name: "申請" }).click();
  await expect(page.getByText("申請しました")).toBeVisible();
});
```

**`getByRole` / `getByLabel` を使う**のがコツです。CSS セレクタ（`.btn-primary`）は見た目を変えると壊れます。

---

## 6. 負荷テスト（`pnpm loadtest`）

「何リクエストまで捌けるか」「レスポンスが遅くないか」を測ります。

### 使い方

```bash
# アプリを起動しておく
pnpm dev:internal

# 別のターミナルで
pnpm loadtest -- --url http://localhost:3000/api/health --concurrency 20 --duration 10000
```

| オプション | 意味 |
|---|---|
| `--url` | 対象の URL（必須） |
| `--concurrency` | 同時に投げる数（例: 20） |
| `--duration` | 何ミリ秒続けるか（例: 10000 = 10秒） |
| `--iterations` | 何回投げるか（duration の代わり） |
| `--method` | GET / POST など |
| `--dry` | 実際には投げず、動作確認だけ（ネットワーク不要） |

### 出力の読み方

```
5000 reqs, 480.2 req/s, err 0.2%, p50 38ms / p95 120ms / p99 310ms
```

| 項目 | 意味 | 見るポイント |
|---|---|---|
| `req/s` | 1 秒あたりの処理数（スループット） | 目標値に届いているか |
| `err` | エラー率 | **0% でないなら問題**。何が失敗しているか調べる |
| `p50` | 半分のリクエストがこの時間以内 | 体感速度 |
| **`p95`** | **95% がこの時間以内** | **最も重要**。ここが遅いと「たまに遅い」と言われる |
| `p99` | 99% がこの時間以内 | 外れ値。極端に大きいなら詰まりがある |

**平均値を見ないでください。** 平均は外れ値に引きずられて実態を隠します。p95 を見ます。

### 何を測るか

| 対象 | 例 |
|---|---|
| **一覧画面の API** | 件数が増えたときに遅くならないか |
| **重い集計** | 月次決算・給与計算など |
| **同時アクセス** | 全員が朝 9 時に打刻したら耐えられるか |

### 注意

- **本番環境に向けて撃たない**でください（本物の障害になります）
- 開発機の性能に依存するので、**絶対値より「変更前後の比較」**に使います
- 本格的な負荷試験には [k6](https://k6.io/) 等の専用ツールを推奨。これは「桁感の確認」用です

### コードから使う

```ts
import { runLoad, formatResult } from "@platform/loadtest";

const result = await runLoad(
  async () => {
    const t0 = Date.now();
    const res = await fetch("http://localhost:3000/api/health");
    return { ok: res.ok, status: res.status, durationMs: Date.now() - t0 };
  },
  { concurrency: 10, iterations: 1000 },
);
console.log(formatResult(result));
```

---

# デバッグ

## 原因を探す順番

**闇雲に直さないでください。** この順で絞ります。

```
1. pnpm doctor          環境が壊れていないか
2. ターミナルのログ       サーバ側のエラー（pnpm dev の画面）
3. ブラウザの Console     画面側のエラー（F12）
4. /admin/env           設定（API キー等）が入っているか
5. pnpm check           型・Lint・テストで引っかかっていないか
6. pnpm fresh           それでもダメなら入れ直し
```

## ブラウザの開発者ツール（F12）

> **詳しくは [Chrome の開発ツールで調べる](DEVTOOLS_GUIDE.md)** — タブごとの使い分け、症状から探す表、ブレークポイント、性能測定。

| タブ | 見るもの |
|---|---|
| **Console** | 赤いエラー。まずここ |
| **Network** | API が失敗（赤い行）していないか。クリックすると送受信の中身が見える |
| **Application** | Cookie・localStorage（セッションやテーマ選択が入っている） |
| **Elements** | HTML と CSS。`--color-primary` などの変数もここで確認できる |

## サーバ側のデバッグ

### ログを見る

`pnpm dev` を実行したターミナルに出ます。エラーはここが一次情報です。

### VS Code / Cursor でブレークポイント

1. 行番号の左をクリック → 赤い点
2. `F5` → 「Node.js」を選ぶ
3. 画面を操作すると、その行で止まる
4. 変数の中身を見る（左パネル）

**「なぜこの値になるのか」はデバッガで見るのが最速**です。`console.log` を撒くより速く、消し忘れもありません。

### console.log を使うなら

```ts
console.log("[expense]", { userId, amount, status });   // タグを付ける
```

**コミット前に必ず消してください。** `pnpm lint` で検出されることもあります。

## Platform Debugger（サーバの中を見る）

ブラウザの DevTools は**ブラウザ側**しか見えません。「この画面が遅いのは SQL が 30 本走っているからか、AI 呼び出しが遅いのか」を見るには、こちらを使います。

```bash
# apps/internal-app/.env に追記して再起動
DEBUG_TOOL=true
```

http://localhost:3000/debug を開くと:

- **リクエスト一覧** — 実行時間・ステータス・SQL/AI の件数
- **タイムライン** — 1 リクエストの中で、いつ何が何 ms かかったか（帯グラフ）
- **気になる点** — N+1・遅い SQL・1 秒超えを自動で指摘

> **本番では有効にできません**（`NODE_ENV=production` のとき強制的に無効。API も 404 を返します）。

## このリポジトリ固有のデバッグ機能

| 見たいもの | 場所 |
|---|---|
| **今の設定**（環境変数・秘密値はマスク） | http://localhost:3000/admin/env |
| **DB の中身** | http://localhost:3000/admin/db-viewer |
| **送信されたメール** | http://localhost:8025 （Mailpit） |
| **監査ログ**（誰が何をしたか） | http://localhost:3000/admin/audit |
| **基盤の部品を探す** | http://localhost :3001 （platform-portal） |

### DB を直接触る

```bash
pnpm db:psql        # psql が開く

# よく使う
\dt                 # テーブル一覧
\d "Expense"        # テーブルの定義
SELECT * FROM "Expense" LIMIT 10;
```

## 症状別の対処

| 症状 | 見るところ |
|---|---|
| 画面が真っ白 | Console（F12）の赤いエラー |
| ボタンを押しても何も起きない | Console + Network（API が呼ばれているか） |
| API が 500 を返す | ターミナルのログ（サーバ側の例外） |
| API が 403 を返す | ログインしているか・権限があるか |
| データが表示されない | Network で API のレスポンスを確認 → DB Viewer で実データを確認 |
| メールが届かない | Mailpit（http://localhost:8025）。開発では実送信されません |
| 「設定が未構成」と出る | `/admin/env` で該当の環境変数を確認 |
| 変更が反映されない | 強制リロード（`Ctrl+Shift+R`）→ それでもダメなら `pnpm dev` を再起動 |
| 型エラーが大量 | `pnpm fresh`（node_modules を入れ直す） |
| CI だけ落ちる | `pnpm verify:offline` を実行。生成物の更新漏れが多い（`pnpm gen:all`） |

---

## テストを書くときの心得

### 何をテストするか

| 優先 | 対象 | 理由 |
|---|---|---|
| **高** | 金額計算・税・給与 | 間違えると実害が出る |
| **高** | 権限判定 | 見えてはいけないものが見える事故 |
| **中** | 状態遷移（申請→承認→支払） | 順序を飛ばせてしまうバグ |
| **中** | 境界値（0・空・最大） | バグが出やすい |
| **低** | 単純な getter・画面の見た目 | 壊れても影響が小さい |

### 良いテスト・悪いテスト

| ❌ 悪い | ✅ 良い |
|---|---|
| `expect(result).toBeTruthy()` | `expect(result.total).toBe(1100)` |
| 正常系だけ | 正常 + 異常 + 境界 |
| テスト同士が順番に依存 | 単独で動く |
| 実装の内部を検証 | **外から見た振る舞い**を検証 |

### AI にテストを書かせるとき

**参考ファイルを渡す**のがコツです。

```
@packages/tax/src/index.test.ts を参考に、同じ形式で
@packages/payroll/src/calc.ts のテストを書いて。
境界値（0円、マイナス、上限超え）も含めて。
```

**「テストが通りました」を信じないでください。** 自分のターミナルで `pnpm test` を実行して確認します。

---

## まとめ

| やりたいこと | コマンド |
|---|---|
| **とりあえず確認**（毎回） | `pnpm check` |
| PR 前の最終確認 | `pnpm verify:offline` |
| 開発中に自動でテスト | `pnpm test:watch` |
| ブラウザの操作を確認 | `pnpm e2e:ui` |
| 性能を測る | `pnpm loadtest -- --url ... --dry` |
| 環境を診断 | `pnpm doctor` |
| 環境を作り直す | `pnpm fresh` |

---

**関連**: [コマンド早見表](COMMANDS.md) / [困ったときは](../onboarding/03-development.md#困ったときは) / [Cursor での開発](CURSOR_GUIDE.md)

## いま手薄なところ（実測）

`node tools/check-maintainability.mjs` と同じ考えで、テストの薄さも把握しておきます。

| パッケージ | 実装 | 単体テスト | 補足 |
|---|---|---|---|
| `ui` | 6,275 行 | 453 行 | **全アプリが依存する中核**。`lib/` の純ロジックから優先して増やす |
| `db` | 1,443 行 | 126 行 | Prisma 依存部分はテストしにくい。純ロジックを分けると書ける |
| `mobile` | 1,132 行 | 85 行 | ブラウザ API 依存が多い。判定ロジック（PWA・端末別）は書ける |

**単体テストが 0 のパッケージが 13 件**ありますが、いずれも `tools/smoke.mjs` が動作を確認しています
（`cms` 18 箇所、`html` 21 箇所、`rag` 14 箇所など）。「テストが無い」＝「未検証」ではありません。

### 調べてから書く

「テストが無い」ように見えても、`tools/smoke.mjs` が確認していることがあります。
書き始める前に、**同じことを二重に書いていないか**を調べてください。

```bash
grep -c "lib/table" tools/smoke.mjs     # smoke が触っているか
ls packages/ui/src/lib/table.test.ts    # 単体テストがあるか
```

実際、`table.ts`（並べ替え・選択）と `grid.ts`（表計算）は
単体テストが無い一方で、smoke が網羅していました。

### どこから書くか

1. **純ロジック**（`lib/` 配下・引数と戻り値だけで完結するもの）— 最も書きやすく、壊れると影響が広い
2. **業務判断が入るもの**（取込の検証・権限・計算）— 間違うと**気づかないまま誤ったデータが入る**
3. 描画（React コンポーネント）— 手間の割に壊れにくい。後回しでよい

### E2E は「業務が通るか」だけを見る

画面ごとの確認は `e2e/*.spec.ts`、**一連の業務**は `e2e/business-flow.spec.ts` にあります。

見た目の細部（文字の位置・色）は E2E で見ません。変わりやすく、落ちるたびに
「また E2E か」と無視されるようになるためです。
**型検査も smoke も画面の繋がりは見ていない**ので、そこだけを担当させます。

### 書くときの原則

**実装を読んでから書く。** 推測で期待値を書くと、実装が正しいのにテストが落ちます。
実際 `cellErrorLookup` は `undefined` ではなく `null` を返しており、
推測で書いたテストが落ちました（テスト側を実装に合わせて修正）。

---

# 基盤のテスト方針

**`docs/ops/TESTING_GUIDE.md` を統合したものです（2026-08）。**

このモノレポは、実行環境の制約下でも品質を担保できるよう、テストを層で重ねている。

## 1. 型チェック（第一の門番）
- `tsc --noEmit` を全パッケージ・アプリで実行。`strict` + `noUncheckedIndexedAccess` で境界の抜けを検出。
- 基盤(packages/)は純ロジック中心のため、型が仕様の大部分を保証する。
- 実行コマンド: 各パッケージ `pnpm typecheck`、ルート `pnpm -r typecheck`。

## 2. 単体テスト（vitest）
- 純ロジックは `*.test.ts` で網羅。境界値・端数処理・状態遷移を重点的に。
- 例: `@platform/invoice` の税率区分ごとの端数処理、`@platform/booking` の空き枠、`@platform/auth` の RBAC。
- 実行: `pnpm -r test`。

## 3. スモークハーネス（tools/smoke.mjs）
- ネットワーク/フルビルド不可の環境向けに、主要パッケージの純ロジックを 1 プロセスで通し検証する。
- 相互依存は実ソースを一時展開して結線し、**実際のパッケージ間連携**（例: invoice × tax）も検証する。
- 実行: `pnpm smoke`（`node --experimental-strip-types tools/smoke.mjs`）。期待値は onboarding/05-verify.md に記録。
- 依存関係の健全性は `node tools/check-deps.mjs`（循環依存・層破りの検出）。

## 4. 結合テスト（アプリ層・Playwright E2E）
- `apps/internal-app/e2e/*.spec.ts` に主要業務フローの E2E を置く（例: 経費申請フロー、ログイン→ダッシュボード）。
- `playwright.config.ts` で起動。CI では `next build` 後に `playwright test`。
- 対象: 認証（ソーシャルログイン）、権限による画面出し分け、フォーム送信→トースト、一覧の検索/ページャ。

## 5. 契約・可観測性
- API サーフェスは `tools/api-surface.mjs --update` で追跡し、破壊的変更を差分で検知。
- 実行時は `@platform/observability` / instrumentation でメトリクス・トレースを収集（OBSERVABILITY.md 参照）。

## 層の対応表
| 変更対象 | 主に効く層 |
| --- | --- |
| 基盤の純ロジック | 型 + 単体 + スモーク |
| パッケージ間連携 | スモーク（実ソース結線）+ 型 |
| 画面・配線 | 型 + Playwright E2E |
| 破壊的変更の検知 | api-surface 差分 + check-deps |

原則: **速い層で多くを捕まえ、E2E は代表フローに絞る**。純ロジックを基盤へ寄せることで、
アプリ側の E2E を薄く保てる（属人化・ブラックボックス化の抑止にも寄与）。

---

# 契約テスト（外部 SaaS の応答の形）

**`docs/ops/TESTING_GUIDE.md` を統合したものです（2026-08）。**

## なぜ必要か

外部 API（freee / Google / PayPal など）は、こちらの都合と関係なく変わります。
自前のテストは**モックを相手にしているので通り続け**、壊れたことに気づくのは
利用者からの連絡になりがちです。

そこで「**うちのコードが相手の応答のどのフィールドに依存しているか**」を
契約として明文化し、実際に記録した応答と突き合わせます。

## 仕組み

| 場所 | 役割 |
|---|---|
| `tests/contracts/*.contract.json` | 契約（依存フィールド・実装ファイル・記録した応答） |
| `tools/check-contract.mjs` | 突き合わせ。preflight と CI から実行 |
| `.github/workflows/contract.yml` | 週次で**本物の API** に問い合わせて記録を更新し、厳格モードで検査 |

検査内容:

- **C001** 契約ファイルの形式
- **C002** 契約が指す実装ファイルの存在
- **C003** 契約の必須フィールドを**実装が本当に参照しているか**（契約と実装のズレ）
- **C004** 記録した応答に必須フィールドが**揃っているか**（相手の API 変更）
- **C005** 記録が古すぎないか（既定 90 日）
- **C006** その契約に**記録手段があるか**（`tools/record-contract.mjs` の `RECORDERS`）

> C006 は 2026-08 に追加しました。契約が 5 件あるのに記録手段は 3 件しかなく、
> **zoho / line は鍵を用意しても永久に記録されない**状態だったためです。
> C004 の「未記録」だけでは、それが *鍵待ち* なのか *記録できない* のか区別できません。

## 実行

```bash
node tools/check-contract.mjs                 # 通常（未記録は警告どまり。preflight はこちら）
CONTRACT_STRICT=1 node tools/check-contract.mjs   # 本番前・定期CI（未記録/期限切れも失敗）
```

## 契約を追加する

1. `tests/contracts/<name>.contract.json` を作る

```json
{
  "connector": "freee",
  "title": "freee OAuth トークン更新",
  "endpoint": "POST https://accounts.secure.freee.co.jp/public_api/token",
  "sourceFile": "packages/freee/src/token.ts",
  "requiredFields": ["access_token", "refresh_token", "expires_in"],
  "note": "欠けるとトークン更新ができず連携が全面停止する",
  "capturedAt": null,
  "fixture": null
}
```

2. `requiredFields` には、**実装が実際に読んでいるフィールドだけ**を書く
   （書いたのに実装が読んでいなければ C003 で落ちます）
3. 任意項目（あってもなくても動くもの）は含めない
4. `tools/record-contract.mjs` の `RECORDERS` に**同じ名前**で記録手段を足す
   （ファイル名から `.contract.json` を除いたもの）
5. `.github/workflows/contract.yml` の `env:` に必要な Secrets を足す

## 必要な Secrets

| コネクタ | 環境変数 |
|---|---|
| freee | `FREEE_CLIENT_ID` / `FREEE_CLIENT_SECRET` / `FREEE_REFRESH_TOKEN` |
| google | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REFRESH_TOKEN` |
| paypal | `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` |
| zoho | `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` / `ZOHO_REFRESH_TOKEN` / **`ZOHO_DATA_CENTER`**（`jp` or `com`。既定は持たない — 取り違えると「認証情報が誤っている」ようにしか見えない応答が返る） |
| line | `LINE_CHANNEL_ACCESS_TOKEN` / **`LINE_TEST_USER_ID`**（Bot と友だちになっている人の userId。プロフィール取得には実在の ID が要る。値は記録に残らない） |

**1 件でも揃えば、そのコネクタだけ記録が始まります**（残りは黙ってスキップ）。
5 件すべてを待つ必要はありません。

## 実応答を記録する

`fixture` に**本物の応答**を入れ、`capturedAt` に記録日を入れます。

- **秘密情報は必ず伏せる**（`access_token` の値は `"<redacted>"` などで可。
  検査しているのは**フィールドの有無**であって値ではありません）
- 手で貼っても構いませんし、CI（`contract.yml`）に任せても構いません

## 落ちたときの読み方

| 表示 | 意味 | 対応 |
|---|---|---|
| C003 | 契約に書いたフィールドを実装が読んでいない | 契約を実装に合わせて直す |
| C004 | 記録した応答に必須フィールドが無い | **相手の API が変わった**。実装の追随が必要 |
| C005 | 記録が古い | 取り直す（週次 CI が動いていれば自動） |
| C006 | その契約を記録する手段が無い | `tools/record-contract.mjs` の `RECORDERS` に足す |

## 限界

- 記録した瞬間の応答しか見ていません。**週次で取り直すこと**が前提です
- フィールドの**有無**だけを見ます。型や意味の変更（例: 単位が円→銭）は検知できません
- 相手のサンドボックス環境と本番で応答が違う場合があります

