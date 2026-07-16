"use client";
/**
 * 共通 VideoPlayer。ネイティブ <video> にカスタムコントロールを重ねたプレイヤー。
 * 再生/一時停止・シーク・音量・再生速度・全画面に対応。
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

/** {@link VideoPlayer} の props。 */
export interface VideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
}

/** 動画プレイヤー。 */
export function VideoPlayer({ src, poster, className }: VideoPlayerProps) {
  const t = useT();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const m = useMediaElement(videoRef);

  const fullscreen = () => containerRef.current?.requestFullscreen?.();

  return (
    <div ref={containerRef} className={cn("relative overflow-hidden rounded-[var(--radius)] bg-black", className)}>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        onClick={m.toggle}
        className="w-full"
        {...m.bind}
      />
      <div className="flex items-center gap-2 bg-black/80 px-3 py-2 text-white">
        <button type="button" onClick={m.toggle} aria-label={m.playing ? "一時停止" : "再生"}>
          {m.playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
        <Seekbar value={m.current} max={m.duration || 0} onSeek={m.seek} formatLabel={formatTime} className="flex-1" />
        <button type="button" onClick={m.toggleMute} aria-label={m.muted ? "ミュート解除" : "ミュート"}>
          {m.muted || m.volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
        <div className="w-20"><Slider value={[m.muted ? 0 : m.volume]} max={1} step={0.05} onValueChange={([v]) => m.changeVolume(v ?? 0)} /></div>
        <select value={m.rate} onChange={(e) => m.changeRate(Number(e.target.value))} className="rounded bg-transparent text-xs" aria-label={t("media.speed")}>
          {[0.5, 1, 1.25, 1.5, 2].map((r) => <option key={r} value={r} className="text-black">{r}x</option>)}
        </select>
        <button type="button" onClick={fullscreen} aria-label={t("media.fullscreen")}><Maximize className="h-5 w-5" /></button>
      </div>
    </div>
  );
}
