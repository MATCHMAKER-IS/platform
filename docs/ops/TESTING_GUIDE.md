# テストとデバッグ

「壊れていないか確かめる」方法と、「壊れたとき原因を探す」方法をまとめています。

**迷ったら `pnpm check`。** これが基本です。

---

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

閾値は共通で **80%**（`@platform/config` の `vitest.preset.ts` で一元管理）。

---

## 5. E2E（`pnpm e2e`）— ブラウザで実操作

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
| `e2e/equipment-app.spec.ts` | 備品の貸出・返却 |
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
| **基盤の部品を探す** | http://localhost:3005 （platform-portal） |

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

**関連**: [コマンド早見表](COMMANDS.md) / [困ったときは](GETTING_STARTED_2.md#困ったときは) / [Cursor での開発](CURSOR_GUIDE.md)
