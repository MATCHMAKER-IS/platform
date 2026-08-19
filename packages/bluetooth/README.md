# @platform/bluetooth

Bluetooth 機器との接続（測定器・プリンタ）。

## これは何のためか

**現場の機器から、直接データを取る**ためのものです。

体重計・血圧計・ラベルプリンタ——**手で入力しなくて済みます**。

## 使う前に知っておくこと

| | |
|---|---|
| **利用者が機器を選びます** | **こちらからは選べません**——ブラウザの画面が出ます |
| **HTTPS が必要です** | `localhost` 以外では、**HTTP だと動きません** |
| **iOS Safari は非対応** | **代替を用意する**か、**使えないことを伝えて**ください |
| **切断されます** | 電池切れ、距離、干渉——**繋がり続ける前提で作らないで**ください |
| **機器ごとに仕様が違います** | 同じ「体重計」でも、**メーカーで形式が違います** |

## よく使うもの

```ts
import { isBluetoothSupported, connectBluetooth, readBatteryLevel } from "@platform/bluetooth";
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
