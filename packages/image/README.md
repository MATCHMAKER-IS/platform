# @platform/image

サーバ側の画像処理(sharp ラッパー)。順序付きの操作リストを適用します。

```ts
import sharp from "sharp";
import { createImageProcessor } from "@platform/image";

const image = createImageProcessor(sharp);

// アップロード写真を実用サイズに正規化(縮小 + webp 変換)
const norm = await image.normalizeUpload(buffer, { maxWidth: 1600, format: "webp", quality: 82 });

// 任意の操作を順に適用
const out = await image.process(buffer, [
  { op: "extract", left: 100, top: 100, width: 800, height: 600 }, // トリミング
  { op: "resize", width: 400 },                                    // リサイズ
  { op: "modulate", brightness: 1.1, saturation: 1.2 },            // 明度・彩度
  { op: "grayscale" },                                             // グレースケール
  { op: "flop" },                                                  // 左右反転
  { op: "flatten", background: "#ffffff" },                        // 透明→白背景
  { op: "format", type: "png" },                                  // 形式変換
]);
```

操作: resize / extract(トリミング)/ rotate / flip(上下)/ flop(左右)/ grayscale /
negate(色反転)/ tint / modulate(明度・彩度・色相)/ blur / gamma / normalize /
trim(余白自動除去)/ flatten(背景色塗り)/ format(jpeg/png/webp/avif)。

sharp は peerDependency(任意)。未注入時は遅延 import します。寸法計算 `fitDimensions` 等は
`@platform/image/geometry` から sharp 無しで利用できます(ブラウザ側と共通)。
