"use client";
/**
 * 共通 StreamPlayer。HLS(.m3u8)/ DASH(.mpd)のストリーミング再生。
 * HLS は hls.js、DASH は dashjs を使い、Safari 等ネイティブ対応時はそのまま再生する。
 * コントロールは VideoPlayer と同じ(再生/シーク/音量/速度/全画面)。
 * @packageDocumentation
 */
import * as React from "react";
import { Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react";
import { Seekbar } from "./progress";
import { Slider } from "./slider";
import { useMediaElement } from "./use-media";
import { formatTime } from "../lib/format-time";
import { cn } from "../lib/cn";
import { useT } from "./i18n-provider";

/** {@link StreamPlayer} の props。 */
export interface StreamPlayerProps {
  src: string;
  /** ストリーム種別。既定 "auto"(拡張子で判定)。 */
  type?: "hls" | "dash" | "auto";
  poster?: string;
  className?: string;
}

/** HLS/DASH ストリーミングプレイヤー。 */
/**
 * 配信の再生。
 *
 * 生放送や監視カメラなど、**終わりが無い映像**に使う。
 * 通信が途切れたときに自動で繋ぎ直すかを決めておく。
 */
export function StreamPlayer({ src, type = "auto", poster, className }: StreamPlayerProps) {
  const t = useT();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const m = useMediaElement(videoRef);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const kind = type === "auto" ? (src.includes(".mpd") ? "dash" : "hls") : type;
    let cleanup = () => {};

    if (kind === "dash") {
      let player: { reset: () => void } | null = null;
      void import("dashjs").then((dashjs) => {
        player = dashjs.MediaPlayer().create();
        (player as unknown as { initialize: (v: HTMLVideoElement, s: string, a: boolean) => void }).initialize(video, src, false);
      });
      cleanup = () => player?.reset();
    } else {
      // HLS: ネイティブ対応(Safari)ならそのまま、なければ hls.js
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
      } else {
        let hls: { destroy: () => void } | null = null;
        void import("hls.js").then(({ default: Hls }) => {
          if (Hls.isSupported()) {
            const h = new Hls();
            h.loadSource(src);
            h.attachMedia(video);
            hls = h;
          } else {
            video.src = src;
          }
        });
        cleanup = () => hls?.destroy();
      }
    }
    return () => cleanup();
  }, [src, type]);

  const fullscreen = () => containerRef.current?.requestFullscreen?.();

  return (
    <div ref={containerRef} className={cn("relative overflow-hidden rounded-[var(--radius)] bg-black", className)}>
      <video ref={videoRef} poster={poster} onClick={m.toggle} className="w-full" {...m.bind} />
      <div className="flex items-center gap-2 bg-black/80 px-3 py-2 text-white">
        <button type="button" onClick={m.toggle} aria-label={m.playing ? "一時停止" : "再生"}>
          {m.playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
        <Seekbar value={m.current} max={m.duration || 0} onSeek={m.seek} formatLabel={formatTime} className="flex-1" />
        <button type="button" onClick={m.toggleMute} aria-label={m.muted ? "ミュート解除" : "ミュート"}>
          {m.muted || m.volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
        <div className="w-20"><Slider value={[m.muted ? 0 : m.volume]} max={1} step={0.05} onValueChange={([v]) => m.changeVolume(v ?? 0)} /></div>
        <button type="button" onClick={fullscreen} aria-label={t("media.fullscreen")}><Maximize className="h-5 w-5" /></button>
      </div>
    </div>
  );
}
