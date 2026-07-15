/**
 * Web Bluetooth の最小型定義(このパッケージが必要とする範囲のみ)。
 * @packageDocumentation
 */

/** サービス/キャラクタリスティックの UUID(数値・短縮名・完全UUIDのいずれか)。 */
export type BluetoothUUID = number | string;

/** requestDevice のフィルタ。 */
export interface DeviceFilter {
  services?: BluetoothUUID[];
  name?: string;
  namePrefix?: string;
}

/** requestDevice のオプション。 */
export interface RequestDeviceOptions {
  filters?: DeviceFilter[];
  optionalServices?: BluetoothUUID[];
  acceptAllDevices?: boolean;
}

export interface BluetoothCharacteristicLike {
  readValue(): Promise<DataView>;
  writeValue(value: BufferSource): Promise<void>;
  startNotifications(): Promise<BluetoothCharacteristicLike>;
  stopNotifications(): Promise<BluetoothCharacteristicLike>;
  addEventListener(type: "characteristicvaluechanged", cb: (e: Event) => void): void;
  removeEventListener(type: "characteristicvaluechanged", cb: (e: Event) => void): void;
  value?: DataView;
}
export interface BluetoothServiceLike {
  getCharacteristic(uuid: BluetoothUUID): Promise<BluetoothCharacteristicLike>;
}
export interface BluetoothGattServerLike {
  connected: boolean;
  connect(): Promise<BluetoothGattServerLike>;
  disconnect(): void;
  getPrimaryService(uuid: BluetoothUUID): Promise<BluetoothServiceLike>;
}
export interface BluetoothDeviceLike {
  id: string;
  name?: string;
  gatt?: BluetoothGattServerLike;
  addEventListener(type: "gattserverdisconnected", cb: () => void): void;
  removeEventListener(type: "gattserverdisconnected", cb: () => void): void;
}
export interface BluetoothLike {
  requestDevice(options: RequestDeviceOptions): Promise<BluetoothDeviceLike>;
  getAvailability?(): Promise<boolean>;
}
