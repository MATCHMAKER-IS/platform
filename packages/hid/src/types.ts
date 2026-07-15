/**
 * WebHID の最小型(このパッケージが使う範囲のみ)。
 * @packageDocumentation
 */
export interface HidFilter {
  vendorId?: number;
  productId?: number;
  usagePage?: number;
  usage?: number;
}
export interface HidInputReportEvent {
  device: HidDeviceLike;
  reportId: number;
  data: DataView;
}
export interface HidDeviceLike {
  opened: boolean;
  vendorId: number;
  productId: number;
  productName: string;
  open(): Promise<void>;
  close(): Promise<void>;
  sendReport(reportId: number, data: BufferSource): Promise<void>;
  sendFeatureReport(reportId: number, data: BufferSource): Promise<void>;
  receiveFeatureReport(reportId: number): Promise<DataView>;
  addEventListener(type: "inputreport", cb: (e: HidInputReportEvent) => void): void;
  removeEventListener(type: "inputreport", cb: (e: HidInputReportEvent) => void): void;
}
export interface HidLike {
  requestDevice(options: { filters: HidFilter[] }): Promise<HidDeviceLike[]>;
  getDevices(): Promise<HidDeviceLike[]>;
}
