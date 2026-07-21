# @platform/barcode

QR コード・バーコードの**発行**(生成)。

- **QR** — `qrSvg()` / `qrDataUrl()`(実体は `qrcode`)
- **1 次元バーコード** — `barcodeSvg()`(実体は `bwip-js`)
- **社内 URL の組み立て** — `buildAssetUrl()`

サーバ(帳票 PDF・ラベル印刷)でもブラウザ(画面表示)でも**同じ関数で SVG が出せます**。

## 読み取りは `@platform/mobile`

| | |
|---|---|
| `@platform/barcode` | **発行**。ラベル・帳票で「出す」 |
| `@platform/mobile` | **読み取り**(BarcodeDetector)・JAN/EAN のチェックディジット検証。現場で「読む」 |

「読む」と「出す」で関心が違うので分けています。

## なぜ自作しないか

QR は**規格が複雑で誤り訂正(リードソロモン符号)が必要**、バーコードは**種類ごとに桁数・
チェックディジット・使える文字が違います**。自作すると「読み取り機で読めない」が起きます。

## 使い方

```ts
import { qrSvg, qrDataUrl, barcodeSvg, buildAssetUrl } from "@platform/barcode";

// 備品ラベル(QR に社内 URL を入れる → 標準カメラで開ける)
const url = buildAssetUrl({ baseUrl: "https://portal.example.co.jp", kind: "asset", id: "A-0042" });
const svg = await qrSvg(url, { level: "Q" });  // 屋外・現場なら Q

// TOTP(認証アプリの登録)
const png = await qrDataUrl(otpauthUri, { level: "M" });

// JAN コード
const bar = await barcodeSvg("4901234567894", { format: "ean13" });
```

すべて `Result` を返します(`ok` / `error`)。
