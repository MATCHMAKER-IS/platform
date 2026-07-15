# @platform/utils

規律ある汎用ヘルパー。`sleep` / `chunk` / `groupBy` / `uniqueBy` / `assertNever` /
`safeJsonParse` / `retry` など、純粋で汎用的な関数のみを置きます。

**運用ルール(重要)**: 業務ロジックは置かない。1 箇所でしか使わないものは置かない。
有名ライブラリで足りるものはそれを使う。これを守らないと"何でも入る引き出し"化して
属人化が再発します。

## 関数・オブジェクト・配列・非同期(汎用ユーティリティ)
```ts
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
