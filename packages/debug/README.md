# @platform/debug

開発用の調査ツール（クエリの記録・リクエストの追跡）。

## これは何のためか

**「なぜこの画面が遅いのか」を、その場で見る**ためのものです。

## 使う前に知っておくこと

| | |
|---|---|
| **本番では無効にする** | `DEBUG_TOOL=1` のときだけ動きます。**本番で有効にすると、全クエリが記録され遅くなります** |
| **記録には値が入ります** | SQL には `WHERE email = '...'` のような**個人情報**が含まれます——**開発機の外に持ち出さないで**ください |
| **本番の遅さを見るなら別のもの** | `SLOW_QUERY_LOG=1`（`@platform/db` の `createSlowQueryLog`）を使ってください——**しきい値超えだけ**なので軽いです |
| **メモリに溜まります** | 長く動かすと**増え続けます**——開発中に再起動してください |

## よく使うもの

```ts
import { createDebugCollector, summarizeSql } from "@platform/debug";
// アプリの起動時に 1 つだけ作る
export const debugCollector = createDebugCollector({
  enabled: featureEnv.DEBUG_TOOL,   // 本番では必ず false
  capacity: 50,
  slowSqlMs: 100,
});

// API の計装(withApiObservability)で
debugCollector.start({ requestId, method, path, userId });
// ... 処理 ...
debugCollector.finish(requestId, 200);

// 記録したい処理で
debugCollector.record(requestId, {
  kind: "sql",
  label: summarizeSql(query),
  durationMs: 12,
  ok: true,
  meta: { rows: 20 },
});
```

## 実行時にしか分からない問題を検出

`findIssues` は、静的解析（preflight / advisor）では見つからないものだけを対象にします。

| 検出 | 意味 |
|---|---|
| **N+1** | 同じ SQL が繰り返し実行されている（`include` / `join` でまとめられないか） |
| **遅い SQL** | しきい値超え（インデックスを確認） |
| **SQL が多すぎる** | 1 リクエストで 20 本超 |
| **失敗した処理** | ok: false の記録 |
| **1 秒超え** | 内訳（どの種類が重いか）も示す |

## API

| 関数 | 用途 |
|---|---|
| `createDebugCollector(options)` | 収集器を作る |
| `summarizeSql(sql)` | SQL を「動詞 + テーブル名」に短縮（一覧で読めるように） |
| `findIssues(req, summary)` | 気になる点を挙げる |

## 画面

`internal-app` の `/debug`（`DEBUG_TOOL=true` のときのみ）。リクエスト一覧とタイムラインが見られます。
