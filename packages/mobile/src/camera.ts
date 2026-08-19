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
 * @param input.facing 前面/背面(**`environment` で背面**。商品スキャンには背面)
 * @param input.width 横の解像度
 * @param input.height 縦の解像度
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
 * @param input カメラの条件
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
 * @param options.type / quality 出力形式
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

/** 録音の器。 */
export interface AudioRecorder {
  /** 録音を始める。**すでに録音中なら何もしません**。 */
  start(): void;
  /** 録音を止めて中身を返す。**録音していなければ `undefined`**。 */
  stop(): Promise<Blob | undefined>;
  /** 録音中か。 */
  isRecording(): boolean;
}

/**
 * **音声を録る**器を作る。
 *
 * 【使いどころ】
 * 現場のメモ、電話の記録、議事録の下書き——**書くより話す方が速い**場面です。
 * 録った音は `@platform/ai` に渡して文字にできます。
 *
 * 【必ず止めること】
 * **止めないとマイクが開いたままになります。** ブラウザのタブに
 * **録音中の印が出続け**、利用者は「盗聴されている」と感じます。
 * 画面を離れるときは必ず `stop()` を呼んでください。
 *
 * 【形式について】
 * **ブラウザによって形式が違います**（`webm` / `mp4` / `ogg`）。
 * 保存する側で決め打ちにせず、**返ってきた `Blob` の `type` を見て**ください。
 *
 * @param stream `getUserMedia({ audio: true })` で得た音声
 * @param options `mimeType`（省略時はブラウザに任せる）
 * @returns 録音の器
 */
export function createAudioRecorder(
  stream: MediaStream,
  options: { mimeType?: string } = {},
): AudioRecorder {
  let recorder: MediaRecorder | undefined;
  let chunks: Blob[] = [];

  return {
    start() {
      // **二重に始めない。** 押し間違いで 2 つ動くと、
      // **片方が止まらずマイクが開いたまま**になります。
      if (recorder !== undefined) return;
      chunks = [];
      recorder = options.mimeType !== undefined && MediaRecorder.isTypeSupported(options.mimeType)
        ? new MediaRecorder(stream, { mimeType: options.mimeType })
        : new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.start();
    },

    async stop() {
      const r = recorder;
      if (r === undefined) return undefined;
      recorder = undefined;
      return new Promise((resolve) => {
        r.onstop = () => {
          // **返ってきた形式をそのまま持たせる。** 保存側で決め打ちにすると、
          // **別のブラウザで開けないファイル**ができます。
          resolve(new Blob(chunks, { type: r.mimeType }));
          chunks = [];
        };
        r.stop();
      });
    },

    isRecording() {
      return recorder !== undefined;
    },
  };
}

/**
 * 録音が使えるかを見る。
 *
 * **`getUserMedia` と `MediaRecorder` の両方**が要ります——
 * 片方だけある環境があるので、**両方を確かめてください**。
 *
 * @returns 使えれば true
 */
export function isAudioRecordingSupported(): boolean {
  return typeof navigator !== "undefined"
    && navigator.mediaDevices?.getUserMedia !== undefined
    && typeof MediaRecorder !== "undefined";
}
