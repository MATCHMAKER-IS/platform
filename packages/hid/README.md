# @platform/hid

HID 機器（バーコードリーダー・カードリーダー）との接続。

## これは何のためか

**バーコードリーダーは「キーボード」として見えます。**

読み取ると、**文字を打ったのと同じ**ことが起きます——
**入力欄に勝手に文字が入る**のはこのためです。

## 使う前に知っておくこと

| | |
|---|---|
| **キーボード入力と区別する** | **打つ速度**で見分けます——人の手より**ずっと速い**ためです |
| **末尾に改行が付きます** | 多くの機器が Enter を送ります——**フォームが勝手に送信**されないよう注意してください |
| **入力欄に焦点が要ります** | どこにも当たっていないと、**読み取っても何も起きません** |
| **HTTPS が必要です** | `localhost` 以外では、**HTTP だと動きません** |

## よく使うもの

```ts
import { isHidSupported, reportBytes, connectHid } from "@platform/hid";
import { connectHid, isHidSupported, reportBytes } from "@platform/hid";

if (!isHidSupported()) { /* 非対応の案内 */ }

const res = await connectHid([{ vendorId: 0x1234 }]);   // ボタン等のユーザー操作から
if (res.ok) {
  const conn = res.value;
  const stop = conn.onInputReport((reportId, data) => console.log(reportId, reportBytes(data)));
  await conn.sendReport(0, new Uint8Array([0x01, 0x00]));
  // stop() で購読解除、await conn.close() で切断
}
```
