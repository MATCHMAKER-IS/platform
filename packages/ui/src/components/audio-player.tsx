"use client";
/**
 * 共通 AudioPlayer。ネイティブ <audio> にカスタムコントロールを付けたプレイヤー。
 * @packageDocumentation
 */
import * as React from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { Seekbar } from "./progress";
import { Slider } from "./slider";
import { useMediaElement } from "./use-media";
import { formatTime } from "../lib/format-time";
import { cn } from "../lib/cn";

/** {@link AudioPlayer} の props。 */
export interface AudioPlayerProps {
  src: string;
  /** 曲名等のタイトル。 */
  title?: string;
  className?: string;
}

/** 音声プレイヤー。 */
/**
 * 音声の再生。
 *
 * 議事録や問い合わせ録音に使う。**再生位置を保存**すると、途中から続きを聞ける。
 */
export function AudioPlayer({ src, title, className }: AudioPlayerProps) {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const m = useMediaElement(audioRef);

  return (
    <div className={cn("flex items-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2", className)}>
      <audio ref={audioRef} src={src} {...m.bind} />
      <button type="button" onClick={m.toggle} aria-label={m.playing ? "一時停止" : "再生"} className="text-[var(--color-primary)]">
        {m.playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
      </button>
      <div className="flex-1">
        {title && <div className="truncate text-sm text-[var(--color-fg)]">{title}</div>}
        <Seekbar value={m.current} max={m.duration || 0} onSeek={m.seek} formatLabel={formatTime} />
      </div>
      <button type="button" onClick={m.toggleMute} aria-label={m.muted ? "ミュート解除" : "ミュート"} className="text-[var(--color-muted)]">
        {m.muted || m.volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>
      <div className="w-20"><Slider value={[m.muted ? 0 : m.volume]} max={1} step={0.05} onValueChange={([v]) => m.changeVolume(v ?? 0)} /></div>
    </div>
  );
}
