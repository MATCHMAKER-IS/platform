/**
 * カメラ撮影(getUserMedia ラッパー)。
 * 制約の組み立ては純ロジック、ストリーム取得・フレーム取り込みはブラウザ API。
 * 現場での写真報告・書類/バーコード撮影に使う。モバイルの前面/背面切替に対応。
 * @packageDocumentation
 */

/** カメラの向き。user=前面(自撮り), environment=背面(撮影)。 */
export type CameraFacing = "user" | "environment";

/** {@link cameraConstraints} の入力。 */
export interface CameraConstraintsInput {
  /** 向き(既定 environment=背面。書類/バーコード撮影向き)。 */
  facing?: CameraFacing;
  /** 特定デバイス ID を指定(listCameras の結果)。 */
  deviceId?: string;
  /** 希望解像度。 */
  width?: number;
  height?: number;
}

/**
 * getUserMedia に渡す制約オブジェクトを組み立てる(純ロジック)。
 * deviceId 指定時はそれを優先、無ければ facing で前面/背面を選ぶ。
 */
export function cameraConstraints(input: CameraConstraintsInput = {}): { video: Record<string, unknown>; audio: false } {
  const video: Record<string, unknown> = {};
  if (input.deviceId) video.deviceId = { exact: input.deviceId };
  else video.facingMode = { ideal: input.facing ?? "environment" };
  if (input.width) video.width = { ideal: input.width };
  if (input.height) video.height = { ideal: input.height };
  return { video, audio: false };
}

/** カメラ(や getUserMedia)が使えるか。 */
export function isCameraSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function";
}

/** 利用可能なカメラ 1 台の情報。 */
export interface CameraDevice {
  deviceId: string;
  label: string;
}

/** 接続されているカメラ(videoinput)を列挙する。非対応なら空配列。 */
export async function listCameras(): Promise<CameraDevice[]> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return [];
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === "videoinput").map((d) => ({ deviceId: d.deviceId, label: d.label }));
  } catch {
    return [];
  }
}

/**
 * カメラのストリームを取得する。取得したストリームは <video> の srcObject に設定し、
 * 使い終わったら {@link stopStream} で停止すること。
 */
export async function startCamera(input: CameraConstraintsInput = {}): Promise<MediaStream> {
  if (!isCameraSupported()) throw new Error("このブラウザはカメラに対応していません");
  return navigator.mediaDevices.getUserMedia(cameraConstraints(input) as MediaStreamConstraints);
}

/** ストリームの全トラックを停止する(カメラを解放)。 */
export function stopStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => track.stop());
}

/** {@link captureFrame} の出力形式。 */
export interface CaptureOptions {
  /** MIME(既定 image/jpeg)。 */
  type?: string;
  /** 画質 0..1(JPEG/WebP)。 */
  quality?: number;
  /** 出力幅(未指定は映像の実寸)。高さはアスペクト比維持。 */
  width?: number;
}

/**
 * <video> の現在フレームを Blob として取り込む(canvas 経由)。
 * 撮影ボタン押下時に呼ぶ。ブラウザ専用。
 */
export async function captureFrame(video: HTMLVideoElement, options: CaptureOptions = {}): Promise<Blob> {
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;
  const targetW = options.width ?? vw;
  const targetH = Math.round((vh / vw) * targetW);
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas コンテキストを取得できません");
  ctx.drawImage(video, 0, 0, targetW, targetH);
  const type = options.type ?? "image/jpeg";
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("画像の生成に失敗しました"))), type, options.quality ?? 0.9);
  });
}
