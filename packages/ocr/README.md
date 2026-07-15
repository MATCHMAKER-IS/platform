# @platform/ocr

画像の文字認識(OCR)。エンジンを抽象化し、ローカル(tesseract.js)/クラウド(HTTP API)を差し替え可能。

```ts
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
