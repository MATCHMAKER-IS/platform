# @platform/ocr

画像から文字を読む（領収書・請求書の読み取り）。

## これは何のためか

**領収書を撮って、金額と日付を自動で入れる**ためのものです。
手入力の手間と、**打ち間違い**を減らします。

## 使う前に知っておくこと

| | |
|---|---|
| **必ず間違えます** | 手書き・かすれ・斜めの写真は**平気で違う値を返します**——**金額は必ず人が確かめる**形にしてください。「読めたからそのまま登録」は**事故のもと**です |
| **1 枚失敗しても全体を止めません** | 10 枚中 1 枚が読めなくても、**残り 9 枚は処理**します |
| **和暦にも対応しています** | 「令和 6 年 3 月」も読めます——ただし**解釈できなければ `null`** です |
| **推測しません** | 読めなかったものを**それらしく埋めません**——**空欄の方が安全**です |

## よく使うもの

```ts
import { recognizeReceiptsBatch, parseJapaneseDate, extractAmount } from "@platform/ocr";
// ローカル(外部送信なし)
import Tesseract from "tesseract.js";
import { createTesseractOcr } from "@platform/ocr";
const ocr = createTesseractOcr(Tesseract, { lang: "jpn+eng" });
const res = await ocr.recognize(imageBytes);
if (res.ok) console.log(res.value.text, res.value.confidence);

// クラウド OCR(API 仕様に合わせて parse)
import { createHttpOcr } from "@platform/ocr";
const cloud = createHttpOcr({
  endpoint: "https://api.example/ocr",
  headers: { authorization: `Bearer ${token}` },
  parse: (j) => ({ text: j.fullText, confidence: j.score }),
});
```
機密書類はローカル(tesseract.js)、精度重視はクラウド、と使い分けられます。
