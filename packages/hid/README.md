# @platform/hid

WebHID(PC 周辺機器連携)。キーボード・バーコードリーダー・カードリーダー・独自 HID 機器と
レポートを送受信します。**PC 周辺機器(HID)は Web Bluetooth では扱えないため WebHID を使います。**
ブラウザ専用(Chrome/Edge、HTTPS または localhost、ユーザー操作が必要)。

```ts
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
