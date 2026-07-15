# @platform/datetime

日本時間(JST)前提の日時ユーティリティ。UTC で保存し、表示・境界計算は JST で行います。

```ts
import { formatJst, startOfDayJst, endOfDayJst } from "@platform/datetime";
formatJst(new Date());              // "2026-07-09 14:30"
startOfDayJst(new Date());          // JST 00:00 の UTC 時刻(集計の範囲指定に)
```
