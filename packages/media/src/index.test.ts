import { describe, it, expect, vi } from "vitest";

// fluent-ffmpeg をモックし、ラッパーの配線(save/end で ok)を検証する。
vi.mock("ffmpeg-static", () => ({ default: "/bin/ffmpeg" }));
vi.mock("ffprobe-static", () => ({ default: { path: "/bin/ffprobe" }, path: "/bin/ffprobe" }));
vi.mock("fluent-ffmpeg", () => {
  const cmd: any = {};
  cmd.input = () => cmd;
  cmd.noVideo = () => cmd;
  cmd.seekInput = () => cmd;
  cmd.frames = () => cmd;
  cmd.setStartTime = () => cmd;
  cmd.duration = () => cmd;
  cmd.on = (ev: string, fn: (...a: unknown[]) => void) => { if (ev === "end") setTimeout(fn, 0); return cmd; };
  cmd.save = () => cmd;
  const ffmpeg: any = () => cmd;
  ffmpeg.setFfmpegPath = () => {};
  ffmpeg.setFfprobePath = () => {};
  ffmpeg.ffprobe = (_i: string, cb: (e: unknown, d: unknown) => void) =>
    cb(null, { format: { duration: "12.5", format_name: "mp4", bit_rate: "800000" }, streams: [{ codec_type: "video", codec_name: "h264", width: 1920, height: 1080, r_frame_rate: "30/1" }] });
  return { default: ffmpeg };
});

import { createMediaProcessor } from "./index";

describe("media", () => {
  it("probe はメタ情報を返す", async () => {
    const m = createMediaProcessor();
    const r = await m.probe("/x.mp4");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.durationSec).toBe(12.5);
      expect(r.value.video?.width).toBe(1920);
      expect(r.value.video?.fps).toBe(30);
    }
  });
  it("thumbnail は end で ok", async () => {
    const m = createMediaProcessor();
    const r = await m.thumbnail("/x.mp4", "/t.jpg", 2);
    expect(r.ok).toBe(true);
  });
});
