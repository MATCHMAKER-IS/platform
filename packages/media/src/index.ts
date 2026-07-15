/**
 * `@platform/media` — 動画・音声の処理(ffmpeg ラッパー)。
 *
 * アップロードされた動画/音声のメタ情報取得・変換・音声抽出・サムネイル生成・
 * トリミングを共通化する。内部は fluent-ffmpeg + ffmpeg-static(同梱バイナリ)。
 * 重い処理なのでサーバ側(できれば `@platform/jobs` の非同期ジョブ)で実行する。
 *
 * @packageDocumentation
 */

import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { AppError, ErrorCode, tryCatch, type Result } from "@platform/core";

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobe.path);

/** メディアのメタ情報。 */
export interface MediaInfo {
  /** 長さ(秒)。 */
  durationSec: number;
  /** コンテナ形式(例: "mov,mp4,m4a,...")。 */
  format: string;
  /** 全体ビットレート(bps)。 */
  bitrate: number;
  /** 映像トラック(音声のみなら undefined)。 */
  video?: { codec: string; width: number; height: number; fps: number };
  /** 音声トラック。 */
  audio?: { codec: string; sampleRate: number; channels: number };
}

/** メディア処理口。 */
export interface MediaProcessor {
  /** メタ情報(長さ・解像度・コーデック等)を取得する。 */
  probe(input: string): Promise<Result<MediaInfo>>;
  /** 別形式へ変換する(拡張子で自動判定)。 */
  transcode(input: string, output: string): Promise<Result<void>>;
  /** 音声トラックを抽出する(mp3/aac 等、output の拡張子で決定)。 */
  extractAudio(input: string, output: string): Promise<Result<void>>;
  /** 指定秒の 1 フレームをサムネイル画像として保存する。 */
  thumbnail(input: string, output: string, atSeconds?: number): Promise<Result<void>>;
  /** 開始秒から指定秒数を切り出す。 */
  trim(input: string, output: string, startSec: number, durationSec: number): Promise<Result<void>>;
}

function run(build: (cmd: ffmpeg.FfmpegCommand) => ffmpeg.FfmpegCommand, output: string): Promise<Result<void>> {
  return new Promise((resolve) => {
    build(ffmpeg())
      .on("end", () => resolve({ ok: true, value: undefined }))
      .on("error", (e) => resolve({ ok: false, error: new AppError(ErrorCode.INTERNAL, "メディア処理に失敗しました", { cause: e }) }))
      .save(output);
  });
}

/**
 * メディアプロセッサを作る。
 * @returns {@link MediaProcessor}
 *
 * @example
 * ```ts
 * const media = createMediaProcessor();
 * const info = await media.probe("/uploads/movie.mov");
 * await media.thumbnail("/uploads/movie.mov", "/out/thumb.jpg", 3);
 * await media.extractAudio("/uploads/movie.mov", "/out/audio.mp3");
 * ```
 */
export function createMediaProcessor(): MediaProcessor {
  return {
    async probe(input) {
      return tryCatch(
        () =>
          new Promise<MediaInfo>((resolve, reject) => {
            ffmpeg.ffprobe(input, (err, data) => {
              if (err) return reject(err);
              const v = data.streams.find((s) => s.codec_type === "video");
              const a = data.streams.find((s) => s.codec_type === "audio");
              const [num, den] = (v?.r_frame_rate ?? "0/1").split("/").map(Number);
              resolve({
                durationSec: Number(data.format.duration ?? 0),
                format: String(data.format.format_name ?? ""),
                bitrate: Number(data.format.bit_rate ?? 0),
                video: v ? { codec: String(v.codec_name), width: v.width ?? 0, height: v.height ?? 0, fps: den ? (num ?? 0) / den : 0 } : undefined,
                audio: a ? { codec: String(a.codec_name), sampleRate: Number(a.sample_rate ?? 0), channels: a.channels ?? 0 } : undefined,
              });
            });
          }),
      ).then((r) => (r.ok ? r : { ok: false as const, error: new AppError(ErrorCode.VALIDATION, "メディア情報の取得に失敗しました", { cause: r.error }) }));
    },
    transcode: (input, output) => run((cmd) => cmd.input(input), output),
    extractAudio: (input, output) => run((cmd) => cmd.input(input).noVideo(), output),
    thumbnail: (input, output, atSeconds = 0) =>
      run((cmd) => cmd.input(input).seekInput(atSeconds).frames(1), output),
    trim: (input, output, startSec, durationSec) =>
      run((cmd) => cmd.input(input).setStartTime(startSec).duration(durationSec), output),
  };
}
