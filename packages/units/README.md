# @platform/units

単位変換(純関数)。長さ・重さ・面積・体積・温度、および日本の尺貫法(坪/畳)に対応。
各系統は基準単位への係数で表現し、任意の単位間を換算します。

```ts
import { convertLength, convertArea, convertTemperature } from "@platform/units";

convertLength(1, "km", "m");        // 1000
convertArea(10, "tsubo", "m2");     // 坪 → 平米(不動産・図面)
convertArea(6, "jo", "m2");         // 畳 → 平米
convertTemperature(100, "C", "F");  // 212
```

不動産(坪/畳)・物流(重量/体積)・製造(長さ)など、社内業務で頻出の単位換算に。
