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
 * @param options.facing 前面/背面(**`environment` で背面**。商品スキャンには背面)
 * @param options.width / height 解像度
 */
export function cameraConstraints(input: CameraConstraintsInput = {}): { video: Record<string, unknown>; audio: false } {
  const video: Record<string, unknown> = {};
  if (input.deviceId) video.deviceId = { exact: input.deviceId };
  else video.facingMode = { ideal: input.facing ?? "environment" };
  if (input.width) video.width = { ideal: input.width };
  if (input.height) video.height = { ideal: input.height };
  return { video, audio: false };
}

/**
 * カメラが使えるかを判定する。
 *
 * **HTTPS が必須**。使えても、**利用者が許可するとは限らない**
 * (拒否されたときの案内を用意すること)。
 *
 * @returns 使えるなら true
 */
export function isCameraSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function";
}

/** 利用可能なカメラ 1 台の情報。 */
export interface CameraDevice {
  deviceId: string;
  label: string;
}

/**
 * カメラを列挙する。
 *
 * **許可を得る前はラベルが空**(プライバシーのため)。「背面カメラ」と
 * 選ばせたいなら、先に許可を取る必要がある。
 *
 * @returns カメラの一覧。**非対応なら空配列**
 */
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
 *
 * @param constraints カメラの条件
 * @returns メディアストリーム
 * @throws 利用者が拒否した場合、または非対応の環境(**必ず捕まえて案内すること**)
 */
export async function startCamera(input: CameraConstraintsInput = {}): Promise<MediaStream> {
  if (!isCameraSupported()) throw new Error("このブラウザはカメラに対応していません");
  return navigator.mediaDevices.getUserMedia(cameraConstraints(input) as MediaStreamConstraints);
}

/**
 * カメラを解放する。
 *
 * **必ず呼ぶこと**。呼ばないとカメラのランプが点いたままになり、
 * 利用者は「まだ撮られている」と不安になる。
 *
 * @param stream メディアストリーム
 * @returns なし
 */
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
 *
 * @param video video 要素
 * @param options.format / quality 出力形式
 * @returns 静止画の Blob
 * @throws 描画に失敗した場合
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
