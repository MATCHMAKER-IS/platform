# @platform/xlsx

Excel(.xlsx)の読み書き。行=オブジェクトの配列として扱えます(内部は ExcelJS)。

```ts
import { readSheet, writeSheet } from "@platform/xlsx";

// 取り込み
const parsed = await readSheet(uploadedBytes);
if (parsed.ok) for (const row of parsed.value) use(row["氏名"], row["金額"]);

// 出力
const out = await writeSheet([{ 氏名: "山田", 金額: 1000 }]);
if (out.ok) await storage.put("export.xlsx", out.value);
```
