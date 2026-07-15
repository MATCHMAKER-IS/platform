"use client";
/**
 * 共通 AudioRecorder。マイクから録音し、停止後に再生・取得できる(MediaRecorder)。
 * @packageDocumentation
 */
import * as React from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "./button.js";
import { AudioPlayer } from "./audio-player.js";
import { useMediaRecorder } from "./use-media-recorder.js";
import { formatTime } from "../lib/format-time.js";
import { cn } from "../lib/cn.js";

/** {@link AudioRecorder} の props。 */
export interface AudioRecorderProps {
  /** 録音完了時(Blob)。 */
  onRecorded?: (blob: Blob) => void;
  className?: string;
}

/** マイク録音コンポーネント。 */
export function AudioRecorder({ onRecorded, className }: AudioRecorderProps) {
  const r = useMediaRecorder({ audio: true });
  React.useEffect(() => { if (r.blob) onRecorded?.(r.blob); }, [r.blob]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center gap-3">
        {r.recording ? (
          <Button variant="danger" onClick={r.stop}><Square className="mr-1 h-4 w-4" />停止</Button>
        ) : (
          <Button onClick={r.start}><Mic className="mr-1 h-4 w-4" />録音</Button>
        )}
        {r.recording && <span className="tabular-nums text-sm text-[var(--color-danger)]">● {formatTime(r.seconds)}</span>}
      </div>
      {r.error && <span className="text-sm text-[var(--color-danger)]">{r.error}</span>}
      {r.url && !r.recording && <AudioPlayer src={r.url} title="録音結果" />}
    </div>
  );
}
