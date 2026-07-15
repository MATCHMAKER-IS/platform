# @platform/debug

**Platform Debugger** — 開発時に「1 リクエストの中で何が起きたか」を可視化します。

ブラウザの DevTools は**ブラウザ側**しか見えません。「この画面が遅いのは SQL が 30 本走っているからか、AI 呼び出しが遅いのか」はサーバの中を見ないと分かりません。CakePHP の DebugKit が解いていた問題を、この基盤向けに実装したものです。

## 設計の要点

| 方針 | 理由 |
|---|---|
| **開発時のみ有効** | `enabled: false` なら記録も保持もしない。本番でのメモリ・性能への影響はゼロ |
| **メモリのリングバッファ** | DB も外部サービスも使わない。容量を超えたら古いものから捨てる |
| **リクエスト単位で束ねる** | `@platform/context` の requestId をそのまま使う |
| **基盤側に計装を仕込まない** | 104 パッケージ全てに手を入れるのは非現実的で、基盤を汚す。呼び出し側が記録したいものだけ記録する |

## 使い方

```ts
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
