"use client";
/**
 * 共通 Waveform。音声ファイルの波形を表示し、クリックでシーク再生できる(wavesurfer.js)。
 * @packageDocumentation
 */
import * as React from "react";
import WaveSurfer from "wavesurfer.js";
import { Play, Pause } from "lucide-react";
import { cn } from "../lib/cn";

/** {@link Waveform} の props。 */
export interface WaveformProps {
  src: string;
  height?: number;
  className?: string;
}

/** 波形表示付き音声プレイヤー。 */
export function Waveform({ src, height = 80, className }: WaveformProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const wsRef = React.useRef<WaveSurfer | null>(null);
  const [playing, setPlaying] = React.useState(false);

  React.useEffect(() => {
    if (!containerRef.current) return;
    const ws = WaveSurfer.create({
      container: containerRef.current,
      url: src,
      height,
      waveColor: "#cbd5e1",
      progressColor: "#0f766e",
      cursorColor: "#0f766e",
    });
    ws.on("play", () => setPlaying(true));
    ws.on("pause", () => setPlaying(false));
    ws.on("finish", () => setPlaying(false));
    wsRef.current = ws;
    return () => ws.destroy();
  }, [src, height]);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <button type="button" onClick={() => wsRef.current?.playPause()} aria-label={playing ? "一時停止" : "再生"} className="text-[var(--color-primary)]">
        {playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
      </button>
      <div ref={containerRef} className="flex-1" />
    </div>
  );
}
