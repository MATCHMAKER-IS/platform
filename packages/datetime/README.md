# @platform/datetime

日付と時刻。**JST を前提**にした計算と表示を提供します。

## これは何のためか

**日付は「9 時間ずれる」事故が最も多い**ところです。

DB は UTC で持ちます（**わざとです**——サーバの場所が変わっても値が変わらないため）。
画面と帳票は JST で出します。**その境目を間違えると、深夜の打刻が前日**になります。

## 使う前に知っておくこと

| | |
|---|---|
| **「今日」は JST で切る** | `new Date().toISOString().slice(0,10)` は **UTC の日付**です——**JST の 0 時〜9 時が前日**になります |
| **SQL で `NOW()` を使わない** | DB の時計とアプリの時計は**別**です。ずれると**原因が分かりません** |
| **月末は月によって違う** | 「1 か月後」は**31 日後ではありません**。`addMonths` を使ってください |
| **営業日は祝日を含む** | 祝日は**会社ごとに違う**ので、**設定で渡してください** |

## よく使うもの

```ts
import { formatDateJst, todayJst, addMonths } from "@platform/datetime";
import { formatJst, startOfDayJst, endOfDayJst } from "@platform/datetime";
formatJst(new Date());              // "2026-07-09 14:30"
startOfDayJst(new Date());          // JST 00:00 の UTC 時刻(集計の範囲指定に)
```
