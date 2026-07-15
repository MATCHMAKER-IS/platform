/**
 * `@platform/bluetooth` — Web Bluetooth(BLE 機器連携)の共通部品。
 *
 * 機器の選択・接続、GATT 特性の読み書き・通知購読を Result ベースで扱う。
 * ブラウザ専用(Chrome/Edge、HTTPS または localhost、ユーザー操作が必要)。
 * Safari/Firefox は未対応のため {@link isBluetoothSupported} で分岐する。
 *
 * @packageDocumentation
 */
import { AppError, ErrorCode, ok, err, type Result } from "@platform/core";
import type {
  BluetoothLike, BluetoothDeviceLike, BluetoothGattServerLike,
  BluetoothCharacteristicLike, BluetoothUUID, RequestDeviceOptions,
} from "./types.js";

export * from "./parse.js";
export type { BluetoothUUID, RequestDeviceOptions, DeviceFilter } from "./types.js";

function getBluetooth(): BluetoothLike | null {
  if (typeof navigator === "undefined") return null;
  return (navigator as unknown as { bluetooth?: BluetoothLike }).bluetooth ?? null;
}

/** この環境で Web Bluetooth が使えるか。 */
export function isBluetoothSupported(): boolean {
  return getBluetooth() !== null;
}

/** 接続済み BLE 機器のハンドル。 */
export interface BluetoothConnection {
  /** 機器情報。 */
  readonly device: { id: string; name?: string };
  /** 接続中か。 */
  isConnected(): boolean;
  /** 特性値を読む。 */
  read(service: BluetoothUUID, characteristic: BluetoothUUID): Promise<Result<DataView>>;
  /** 特性値を書く。 */
  write(service: BluetoothUUID, characteristic: BluetoothUUID, data: BufferSource): Promise<Result<void>>;
  /** 特性の通知を購読する。戻り値で購読解除。 */
  subscribe(service: BluetoothUUID, characteristic: BluetoothUUID, onValue: (value: DataView) => void): Promise<Result<() => void>>;
  /** 切断時のコールバックを登録。 */
  onDisconnect(cb: () => void): void;
  /** 切断する。 */
  disconnect(): void;
}

/** {@link connectBluetooth} のオプション。 */
export interface ConnectOptions extends RequestDeviceOptions {}

function mapBleError(e: unknown): AppError {
  const name = (e as { name?: string })?.name;
  if (name === "NotFoundError") return new AppError(ErrorCode.VALIDATION, "機器が選択されませんでした(キャンセル)", { cause: e });
  if (name === "SecurityError") return new AppError(ErrorCode.FORBIDDEN, "Bluetooth の利用が許可されていません", { cause: e });
  if (name === "NetworkError") return new AppError(ErrorCode.EXTERNAL, "機器への接続に失敗しました", { cause: e });
  return new AppError(ErrorCode.INTERNAL, "Bluetooth 操作に失敗しました", { cause: e });
}

/**
 * BLE 機器を選択して接続する(機器選択ダイアログはユーザー操作から呼ぶ必要がある)。
 *
 * @example
 * ```ts
 * const res = await connectBluetooth({ filters: [{ services: ["battery_service"] }] });
 * if (res.ok) {
 *   const conn = res.value;
 *   const val = await conn.read("battery_service", "battery_level");
 *   if (val.ok) console.log("電池残量", val.value.getUint8(0), "%");
 *   conn.disconnect();
 * }
 * ```
 */
export async function connectBluetooth(options: ConnectOptions): Promise<Result<BluetoothConnection>> {
  const bt = getBluetooth();
  if (!bt) return err(new AppError(ErrorCode.INTERNAL, "この環境は Web Bluetooth に未対応です"));

  let device: BluetoothDeviceLike;
  let server: BluetoothGattServerLike;
  try {
    device = await bt.requestDevice(options);
    if (!device.gatt) return err(new AppError(ErrorCode.EXTERNAL, "この機器は GATT に対応していません"));
    server = await device.gatt.connect();
  } catch (e) {
    return err(mapBleError(e));
  }

  const charCache = new Map<string, BluetoothCharacteristicLike>();
  async function getChar(service: BluetoothUUID, characteristic: BluetoothUUID): Promise<BluetoothCharacteristicLike> {
    const key = `${service}/${characteristic}`;
    const cached = charCache.get(key);
    if (cached) return cached;
    const svc = await server.getPrimaryService(service);
    const ch = await svc.getCharacteristic(characteristic);
    charCache.set(key, ch);
    return ch;
  }

  return ok({
    device: { id: device.id, name: device.name },
    isConnected: () => server.connected,
    async read(service, characteristic) {
      try {
        return ok(await (await getChar(service, characteristic)).readValue());
      } catch (e) {
        return err(mapBleError(e));
      }
    },
    async write(service, characteristic, data) {
      try {
        await (await getChar(service, characteristic)).writeValue(data);
        return ok(undefined);
      } catch (e) {
        return err(mapBleError(e));
      }
    },
    async subscribe(service, characteristic, onValue) {
      try {
        const ch = await getChar(service, characteristic);
        const handler = (e: Event) => {
          const v = (e.target as unknown as { value?: DataView }).value;
          if (v) onValue(v);
        };
        ch.addEventListener("characteristicvaluechanged", handler);
        await ch.startNotifications();
        return ok(() => {
          ch.removeEventListener("characteristicvaluechanged", handler);
          void ch.stopNotifications().catch(() => {});
        });
      } catch (e) {
        return err(mapBleError(e));
      }
    },
    onDisconnect(cb) {
      device.addEventListener("gattserverdisconnected", cb);
    },
    disconnect() {
      if (server.connected) server.disconnect();
    },
  });
}

/**
 * 電池残量(%)を読む簡易ヘルパー(battery_service / battery_level)。
 * 事前に `optionalServices: ["battery_service"]` などで許可されている必要がある。
 */
export async function readBatteryLevel(conn: BluetoothConnection): Promise<Result<number>> {
  const res = await conn.read("battery_service", "battery_level");
  return res.ok ? ok(res.value.getUint8(0)) : res;
}

/** 機器情報(Device Information Service)。 */
export interface DeviceInformation {
  manufacturer?: string;
  model?: string;
  firmware?: string;
  serial?: string;
}

/**
 * 機器情報(製造元・モデル・ファーム・シリアル)を読む。
 * イヤホン等が Device Information Service を公開している場合に取得できる。
 * 公開していない特性は undefined になる。事前に `optionalServices: ["device_information"]` が必要。
 *
 * @remarks Web Bluetooth は音声再生の制御はできない(音声は OS 側の従来 Bluetooth 経由)。
 * イヤホンで取得できるのは、機器が BLE GATT で公開する電池残量・機器情報などに限られる。
 */
export async function readDeviceInformation(conn: BluetoothConnection): Promise<Result<DeviceInformation>> {
  const read = async (characteristic: string): Promise<string | undefined> => {
    const r = await conn.read("device_information", characteristic);
    return r.ok ? new TextDecoder().decode(r.value.buffer) : undefined;
  };
  return ok({
    manufacturer: await read("manufacturer_name_string"),
    model: await read("model_number_string"),
    firmware: await read("firmware_revision_string"),
    serial: await read("serial_number_string"),
  });
}
