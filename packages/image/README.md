# @platform/image

画像の変換（縮小・回転・EXIF 除去）。

## これは何のためか

**スマホの写真はそのままだと数 MB**あります。
100 人が領収書を毎日送れば、**保管先がすぐ埋まります**。

**縮めれば、送信も表示も速くなります。**

## 使う前に知っておくこと

| | |
|---|---|
| **順番が重要です** | **回転 → 縮小**の順で処理してください。逆にすると**縦横が入れ替わったまま縮みます** |
| **EXIF は消してから保存** | **領収書を撮ると、どこで撮ったかが残ります**——本人が意識していない情報です |
| **回転は EXIF を見る** | スマホは**横に倒して撮っても縦のデータ**で保存し、向きは EXIF に入れます。**消す前に回転**してください |
| **領収書は 1,600px で読めます** | それ以上は**容量が増えるだけ**です |

## よく使うもの

```ts
import { createRemoveBgRemover, createBackgroundRemover, mapWithConcurrency } from "@platform/image";
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
