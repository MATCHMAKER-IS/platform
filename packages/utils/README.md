# @platform/utils

小さな道具（文字・数値・配列・非同期）。**依存ゼロ**です。

## これは何のためか

**「自分で書けば 3 行」のものを、書かせない**ためのものです。

3 行で書けるものは、**3 行の間違いが入ります**——
全角の数字、`null` の配列、0 除算。**境界で必ず踏みます**。

## 使う前に知っておくこと

| | |
|---|---|
| **`formatNumber` は日本語向け** | 桁区切りは `,`、**全角の数字も受け取ります**（利用者は全角で入れます） |
| **`chunk` は空配列で空を返す** | 例外にはなりません——**呼び出し側で件数を確かめる**必要はありません |
| **`pTimeout` は必ず使う** | 外部への呼び出しに時間制限が無いと、**永久に待ちます**——利用者は白い画面のままです |
| **依存を足さないこと** | ここは**全パッケージが使う土台**です。依存を足すと**全体に広がります** |

## よく使うもの

```ts
import { sortBy, partition, keyBy } from "@platform/utils";
import { debounce, memoize, once, pipe } from "@platform/utils";           // 関数
import { pick, omit, deepClone, deepMerge, deepEqual, isEmpty } from "@platform/utils"; // オブジェクト
import { sortBy, partition, keyBy, zip, range, difference } from "@platform/utils";     // 配列
import { pMapLimit, retry, pTimeout } from "@platform/utils";              // 非同期
```
- `pMapLimit(items, fn, 5)` … 並行数を絞った一括処理(外部 API を守る)
- `retry(fn, { retries: 3 })` … 指数バックオフ付き汎用リトライ

## 辞書ベースのテキスト正規化

表記ゆれの統一や、音声認識・OCR の定型的な誤変換の補正に(社内 interview-transcribe の用語辞書を一般化):

- `replaceByDictionary(text, rules)`: from→to の一括置換(longest-match 優先・wholeWord 対応)
- `buildGlossaryHint(terms)`: 用語リストを LLM 向けのヒント文に

```ts
replaceByDictionary("現地名で呼ぶ", [{ from: "現地名", to: "源氏名" }]); // "源氏名で呼ぶ"
```

辞書の中身(業務用語)はアプリ側で持ち、仕組みだけを基盤が提供します。
