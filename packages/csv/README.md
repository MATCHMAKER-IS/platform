# @platform/csv

CSV の生成と解析。**Excel で開いても日本語が化けない**ようにするためのものです。

## これは何のためか

**Excel で開くと日本語が化ける**——この 1 点のためにあります。

自分で書くと必ず踏みます。**BOM、改行コード、引用符の入れ子**——
**どれか 1 つ間違えると、相手先で開けません**。

## 使う前に知っておくこと

| | |
|---|---|
| **Excel で開くなら `bom: true`** | 付けないと**日本語が化けます**。**既定は `false`**——他システムに渡すときはこちらが正解です |
| **取り込みは `strict: true`** | 引用符が閉じていないときに**止まります**。既定では読めたところまで返すので、**欠けたまま取り込みます** |
| **どの行が失敗したかを示す** | 「取り込みに失敗しました」だけでは、**何を直せばよいか分かりません** |
| **改行は CRLF** | Excel の慣行です。LF だと**古い Excel で 1 行に見えます** |

## よく使うもの

```ts
import { toCsv, parseCsv } from "@platform/csv";
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

## 取り込みの支援(`@platform/csv/import`)

`parseCsv` はテキストを行と列に分けるところまでです。実際の取り込みでは、
その**手前と後ろ**で問題が起きます。

- **手前**: 相手がくれるファイルが Shift_JIS。UTF-8 として読むと文字化けする
- **後ろ**: 「1,000」「1000円」「２０２６/８/３」を数値や日付に直す必要がある

```ts
import { detectEncoding, importRows, errorRowsToCsv } from "@platform/csv/import";

const enc = detectEncoding(bytes);                       // "shift_jis" 等
const result = importRows(rows, { code: "string", amount: "number", date: "date" });
// result.valid → 取り込む / result.errors → 利用者に返す
```

**1 行の誤りで全部止めません。** 1,000 行のうち 3 行が不正なとき、例外で止めると
997 行の正しいデータも取り込めません。かといって黙って飛ばすと「取り込んだつもりが
入っていない」ことになります。成功した行と失敗した行を**両方返す**ので、
「997 行を取り込み、3 行は要確認」と示せます(`errorRowsToCsv` で差し戻し用の
CSV を作れます)。
