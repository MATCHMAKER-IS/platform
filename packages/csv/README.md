# @platform/csv

CSV の生成・解析・ダウンロード。生成/解析は純関数、`downloadCsv` はブラウザ専用。

```ts
import { toCsv, parseCsv, downloadCsv } from "@platform/csv";

const csv = toCsv(rows, { columns: [{ key: "name", header: "氏名" }, { key: "age", header: "年齢" }] });
const rows2 = parseCsv(csv, { header: true });   // オブジェクト配列
downloadCsv("会員一覧.csv", rows);                // Excel 用に BOM 付きでダウンロード
```
引用符・カンマ・改行のエスケープに対応。Excel の日本語文字化けを避けるため、ダウンロード時は BOM を付与します。

## 大容量 CSV のストリーミング処理

数百 MB〜GB 級の CSV をメモリに全展開せず、チャンク単位で処理します(社内 zoho-emergency-backup の設計を環境非依存に一般化して取り込み)。

- `streamCsvLines(source, options, onChunk)`: 行を供給する `AsyncIterable<string>`(ファイル/ネットワーク)をチャンク処理。メモリには最大 chunkSize 行のみ
- `parseCsvChunks(text, options, onChunk)`: テキスト全体(埋め込み改行対応)をチャンクに分けて下流処理を平準化

```ts
await streamCsvLines(fileLineIterator, { chunkSize: 500 }, async (rows) => {
  await store.bulkInsert(rows);   // チャンクごとに保存
});
```
