/**
 * BLE レシートプリンタ連携。`createReceipt` で組み立てた ESC/POS バイト列を、
 * BLE のキャラクタリスティックへ MTU 分割して書き込む。
 * ブラウザ専用(@platform/bluetooth 経由)。
 * @packageDocumentation
 */
import { ok, type Result } from "@platform/core";
import { connectBluetooth, type BluetoothUUID } from "@platform/bluetooth";

/** レシートプリンタの GATT プロファイル(サービス/書き込み特性)。 */
export interface ReceiptPrinterProfile {
  name: string;
  service: BluetoothUUID;
  characteristic: BluetoothUUID;
}

/** よくある BLE レシートプリンタのプロファイル。機種により異なるため選択・上書き可。 */
export const RECEIPT_PROFILES: Record<string, ReceiptPrinterProfile> = {
  common: { name: "汎用ESC/POS (18f0)", service: 0x18f0, characteristic: 0x2af1 },
  issc: { name: "ISSC/Microchip UART", service: "49535343-fe7d-4ae5-8fa9-9fafd205e455", characteristic: "49535343-8841-43f4-a8d4-ecbe34729bb3" },
  ff00: { name: "汎用 (ff00)", service: 0xff00, characteristic: 0xff02 },
};

/** 接続済みレシートプリンタ。 */
export interface ReceiptPrinter {
  readonly device: { id: string; name?: string };
  /** ESC/POS バイト列を送信する(自動でチャンク分割)。 */
  print(bytes: Uint8Array, options?: { chunkSize?: number }): Promise<Result<void>>;
  onDisconnect(cb: () => void): void;
  disconnect(): void;
}

/**
 * BLE レシートプリンタに接続する(ユーザー操作から呼ぶ)。
 * @param options `profile` … 使用プロファイル(既定 common)、`namePrefix` … 機器名の前方一致で絞り込み
 * @example
 * ```ts
 * import { createReceipt } from "@platform/print";
 * const res = await connectReceiptPrinter();
 * if (res.ok) {
 *   const bytes = createReceipt().init().align("center").line("領収書").feed(2).cut().build();
 *   await res.value.print(bytes);
 * }
 * ```
 */
export async function connectReceiptPrinter(
  options: { profile?: ReceiptPrinterProfile; namePrefix?: string } = {},
): Promise<Result<ReceiptPrinter>> {
  const profile = options.profile ?? RECEIPT_PROFILES.common!;
  const allServices = Object.values(RECEIPT_PROFILES).map((p) => p.service);

  const res = await connectBluetooth({
    filters: options.namePrefix ? [{ namePrefix: options.namePrefix }] : [{ services: [profile.service] }],
    optionalServices: allServices,
  });
  if (!res.ok) return res;
  const conn = res.value;

  return ok({
    device: conn.device,
    async print(bytes, o = {}) {
      const chunkSize = o.chunkSize ?? 512; // 送信できない機種はこれを小さく(例 100)
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        const w = await conn.write(profile.service, profile.characteristic, chunk as unknown as BufferSource);
        if (!w.ok) return w;
      }
      return ok(undefined);
    },
    onDisconnect: (cb) => conn.onDisconnect(cb),
    disconnect: () => conn.disconnect(),
  });
}
