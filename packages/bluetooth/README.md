# @platform/bluetooth

Web Bluetooth(BLE 機器連携)の共通部品。ブラウザ専用(Chrome/Edge、HTTPS または localhost、
ユーザー操作が必要)。Safari/Firefox は未対応なので `isBluetoothSupported()` で分岐します。

```ts
import { connectBluetooth, readBatteryLevel, isBluetoothSupported } from "@platform/bluetooth";

if (!isBluetoothSupported()) { /* 非対応の案内 */ }

// ボタンクリックなどのユーザー操作から呼ぶ
const res = await connectBluetooth({
  filters: [{ services: ["battery_service"] }],
  optionalServices: ["device_information"],
});
if (res.ok) {
  const conn = res.value;
  const battery = await readBatteryLevel(conn);       // 電池残量 %
  const stop = await conn.subscribe("heart_rate", "heart_rate_measurement", (v) => {
    console.log("心拍", v.getUint8(1));
  });
  conn.onDisconnect(() => console.log("切断されました"));
  // stop.value?.(); で購読解除、conn.disconnect(); で切断
}
```

`read`/`write`/`subscribe` はすべて Result を返し、キャンセル・未対応・接続失敗を型で扱えます。
特性値の解析には `parseText` / `parseUint8` / `parseUint16` / `toBytes` を利用できます。
