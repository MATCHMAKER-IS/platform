/**
 * `@platform/hid` — WebHID(PC 周辺機器連携)の共通部品。
 *
 * キーボード・バーコードリーダー・カードリーダー・独自 HID 機器などと、レポートの
 * 送受信を行う。PC 周辺機器(HID)は Web Bluetooth では扱えないため WebHID を使う。
 * ブラウザ専用(Chrome/Edge、HTTPS または localhost、ユーザー操作が必要)。
 *
 * @packageDocumentation
 */
import { AppError, ErrorCode, ok, err, type Result } from "@platform/core";
import type { HidLike, HidDeviceLike, HidFilter } from "./types.js";

export type { HidFilter } from "./types.js";

function getHid(): HidLike | null {
  if (typeof navigator === "undefined") return null;
  return (navigator as unknown as { hid?: HidLike }).hid ?? null;
}

/**
 * この環境で WebHID が使えるかを判定する。
 *
 * **対応が限られる**(Chrome 系のみ)。**HTTPS が必須**で、
 * **利用者の操作から呼ばないと拒否される**。使う前に必ず確認すること。
 *
 * @returns 使えるなら true
 */
export function isHidSupported(): boolean {
  return getHid() !== null;
}

/**
 * DataView をバイト配列にする(レポート解析用)。
 *
 * @param view DataView
 * @returns バイト配列
 */
export function reportBytes(view: DataView): number[] {
  return Array.from({ length: view.byteLength }, (_v, i) => view.getUint8(i));
}

/** 接続済み HID 機器のハンドル。 */
export interface HidConnection {
  readonly device: { vendorId: number; productId: number; productName: string };
  /** 出力レポートを送る。 */
  sendReport(reportId: number, data: BufferSource): Promise<Result<void>>;
  /** 入力レポートを購読する。戻り値で購読解除。 */
  onInputReport(handler: (reportId: number, data: DataView) => void): () => void;
  /** Feature レポートを読む。 */
  readFeatureReport(reportId: number): Promise<Result<DataView>>;
  /** 切断(クローズ)する。 */
  close(): Promise<void>;
}

function mapHidError(e: unknown): AppError {
  const name = (e as { name?: string })?.name;
  if (name === "NotAllowedError") return new AppError(ErrorCode.FORBIDDEN, "HID の利用が許可されていません", { cause: e });
  return new AppError(ErrorCode.INTERNAL, "HID 操作に失敗しました", { cause: e });
}

/**
 * HID 機器を選択して接続する(ユーザー操作から呼ぶ)。
 * @param filters ベンダーID/プロダクトID/usage で候補を絞る
 * @example
 * ```ts
 * const res = await connectHid([{ vendorId: 0x1234 }]);
 * if (res.ok) {
 *   const stop = res.value.onInputReport((id, data) => console.log(id, reportBytes(data)));
 *   await res.value.sendReport(0, new Uint8Array([0x01]));
 * }
 * ```
 * @returns 接続したデバイス
 * @throws 利用者が選択をキャンセルした場合、または非対応の環境
 */
export async function connectHid(filters: HidFilter[] = []): Promise<Result<HidConnection>> {
  const hid = getHid();
  if (!hid) return err(new AppError(ErrorCode.INTERNAL, "この環境は WebHID に未対応です"));

  let device: HidDeviceLike | undefined;
  try {
    const devices = await hid.requestDevice({ filters });
    device = devices[0];
    if (!device) return err(new AppError(ErrorCode.VALIDATION, "機器が選択されませんでした(キャンセル)"));
    if (!device.opened) await device.open();
  } catch (e) {
    return err(mapHidError(e));
  }
  const dev = device;

  return ok({
    device: { vendorId: dev.vendorId, productId: dev.productId, productName: dev.productName },
    async sendReport(reportId, data) {
      try { await dev.sendReport(reportId, data); return ok(undefined); }
      catch (e) { return err(mapHidError(e)); }
    },
    onInputReport(handler) {
      const listener = (e: { reportId: number; data: DataView }) => handler(e.reportId, e.data);
      dev.addEventListener("inputreport", listener);
      return () => dev.removeEventListener("inputreport", listener);
    },
    async readFeatureReport(reportId) {
      try { return ok(await dev.receiveFeatureReport(reportId)); }
      catch (e) { return err(mapHidError(e)); }
    },
    async close() { if (dev.opened) await dev.close(); },
  });
}
