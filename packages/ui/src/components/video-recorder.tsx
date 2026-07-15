"use client";
/**
 * 共通 VideoRecorder。カメラ+マイクから録画し、プレビュー・再生できる(MediaRecorder)。
 * @packageDocumentation
 */
import * as React from "react";
import { Video, Square } from "lucide-react";
import { Button } from "./button.js";
import { VideoPlayer } from "./video-player.js";
import { useMediaRecorder } from "./use-media-recorder.js";
import { formatTime } from "../lib/format-time.js";
import { cn } from "../lib/cn.js";

/** {@link VideoRecorder} の props。 */
export interface VideoRecorderProps {
  /** 録画完了時(Blob)。 */
  onRecorded?: (blob: Blob) => void;
  className?: string;
}

/** カメラ録画コンポーネント。 */
export function VideoRecorder({ onRecorded, className }: VideoRecorderProps) {
  const r = useMediaRecorder({ audio: true, video: true });
  const previewRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    if (previewRef.current) previewRef.current.srcObject = r.stream;
  }, [r.stream]);
  React.useEffect(() => { if (r.blob) onRecorded?.(r.blob); }, [r.blob]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {r.recording && (
        <video ref={previewRef} autoPlay muted playsInline className="w-full rounded-[var(--radius)] bg-black" />
      )}
      <div className="flex items-center gap-3">
        {r.recording ? (
          <Button variant="danger" onClick={r.stop}><Square className="mr-1 h-4 w-4" />停止</Button>
        ) : (
          <Button onClick={r.start}><Video className="mr-1 h-4 w-4" />録画</Button>
        )}
        {r.recording && <span className="tabular-nums text-sm text-[var(--color-danger)]">● {formatTime(r.seconds)}</span>}
      </div>
      {r.error && <span className="text-sm text-[var(--color-danger)]">{r.error}</span>}
      {r.url && !r.recording && <VideoPlayer src={r.url} />}
    </div>
  );
}
