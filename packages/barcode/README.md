# @platform/barcode

バーコードの生成（JAN / EAN / Code128）。**読み取りは `@platform/mobile`** です。

## これは何のためか

**在庫や備品にラベルを貼る**ためのものです。

手で番号を打つと**必ず打ち間違えます**——
バーコードなら、**読み取るだけで済みます**。

## 使う前に知っておくこと

| | |
|---|---|
| **余白（クワイエットゾーン）が要ります** | 既定は 4 モジュールです。**詰めると読めません**——印刷して確かめてください |
| **チェックディジットを検証する** | JAN の最後の 1 桁は**検算用**です。**合わない番号は入力ミス**です |
| **印刷の解像度に注意** | 画面で見えても、**低解像度で印刷すると読めません**。SVG で出して**原寸で印刷**してください |
| **読み取りは別パッケージ** | `@platform/mobile` の `isBarcodeDetectorSupported` を見てください——**iOS Safari は非対応**です |

## よく使うもの

```ts
import { qrSvg, qrDataUrl, barcodeSvg } from "@platform/barcode";
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
