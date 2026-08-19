# @platform/xlsx

Excel ファイルの読み書き。**取引先に渡す形**を作ります。

## これは何のためか

**Excel で渡してほしい**と言われるためです。

CSV では書式が付けられず、**複数のシートも持てません**。

## 使う前に知っておくこと

| | |
|---|---|
| **リンクは表示文字列になります** | 読み込むと、**URL ではなく見えている文字**が入ります |
| **書式付きの文字列は連結されます** | 1 つのセルに色違いの文字が混ざっていても、**1 つの文字列**として返ります |
| **型を偽らない** | `as Row[string]` で無理に通すと、**数値のつもりが文字列**で入ります |
| **大きいファイルは重い** | 数万行を一度に読むと**メモリを食います**——**CSV で済むならそちら**を使ってください |
| **日付の扱いに注意** | Excel の日付は**シリアル値**です。読み違えると**1900 年**になります |

## よく使うもの

```ts
import { readSheet, writeSheet, writeWorkbook } from "@platform/xlsx";
import { readSheet, writeSheet } from "@platform/xlsx";

// 取り込み
const parsed = await readSheet(uploadedBytes);
if (parsed.ok) for (const row of parsed.value) use(row["氏名"], row["金額"]);

// 出力
const out = await writeSheet([{ 氏名: "山田", 金額: 1000 }]);
if (out.ok) await storage.put("export.xlsx", out.value);
```
