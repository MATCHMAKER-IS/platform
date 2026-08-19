# @platform/importer

CSV / Excel の取り込み（検証・エラー報告）。

## これは何のためか

**「取り込みに失敗しました」だけでは、何を直せばよいか分かりません。**

**どの行の、どの列が、なぜ駄目か**——
これが分からないと、**利用者は 500 行を目で探すことになります**。

## 使う前に知っておくこと

| | |
|---|---|
| **行番号はヘッダの分だけずれます** | 配列の 0 行目は**ファイルの 2 行目**です。**どちらの番号か**を必ず明記してください——**ファイルの行番号の方が親切**です |
| **全部のエラーを出す** | 1 件目で止めると、**直しては再実行を繰り返す**ことになります |
| **一部だけ取り込まない** | 途中で失敗したら**全部やり直し**にしてください——**どこまで入ったか分からない**のが最も困ります |
| **全角を受け取る** | 利用者は**全角の数字**を入れます。弾くより**直して受ける**方が親切です |

## よく使うもの

```ts
import { validateRows, runImport, rowsToObjects } from "@platform/importer";
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
