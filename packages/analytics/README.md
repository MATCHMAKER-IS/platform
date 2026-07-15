# @platform/analytics

サイト/アプリのアクセス解析(純ロジック)。イベント(ページビュー等)の記録形式と、集計関数を提供します。保存や送信は呼び出し側(アプリ/adapter)の責務です。

- `pageViews` / `uniqueVisitors` / `uniqueUsers` … 基本指標
- `topPages` / `referrerBreakdown` … 上位ページ・流入元の内訳
- `timeSeries` … 日次などの時系列化
- `bounceRate` / `summarize` … 直帰率・サマリー
- `browser.ts` … ブラウザ側の計測ビーコン送信ヘルパ

```ts
import { summarize, topPages } from "@platform/analytics";
const s = summarize(events);          // { pageViews, uniqueVisitors, ... }
const pages = topPages(events, 10);   // 上位10ページ
```

集計は入力イベント配列に対する純関数のため、テスト・再計算が容易です。実利用例は apps/internal-app の `/analytics`(アクセス解析画面)を参照。
