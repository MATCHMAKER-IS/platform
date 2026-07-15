# @platform/importer

一括インポートの共通枠組み(依存ゼロ)。CSV/Excel 取込の「行ごと検証 → エラー行集約 →
ドライラン → トランザクション適用」を統一します。パースは `@platform/csv`/`@platform/xlsx` に委譲。

```ts
import { runImport, rowsToObjects } from "@platform/importer";

const rows = rowsToObjects(header, csvRows);
const result = await runImport(rows, (raw, i) => {
  if (!raw.email) return { ok: false, errors: ["メール必須"] };
  return { ok: true, value: { email: raw.email } };
}, {
  apply: async (values) => { await db.$transaction(() => insertMany(values)); },
});

// result.errors … 行番号つきエラー / result.applied … 適用件数
```

既定は「1行でもエラーなら全件中止」(安全側)。`dryRun` で検証のみ、`partial` で有効行だけ適用。
