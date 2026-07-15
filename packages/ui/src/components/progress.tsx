/**
 * 共通 Progress(進捗バー)と Seekbar(操作可能なシークバー)。
 * @packageDocumentation
 */
import * as React from "react";
import { Progress as Primitive } from "radix-ui";
import { Slider } from "./slider.js";
import { cn } from "../lib/cn.js";

/** 進捗バー(0〜100、非操作)。 */
export function Progress({ value = 0, className }: { value?: number; className?: string }) {
  return (
    <Primitive.Root
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-slate-200", className)}
      value={value}
    >
      <Primitive.Indicator
        className="h-full bg-[var(--color-primary)] transition-transform"
        style={{ transform: `translateX(-${100 - value}%)` }}
      />
    </Primitive.Root>
  );
}

/** {@link Seekbar} の props。 */
export interface SeekbarProps {
  /** 現在値。 */
  value: number;
  /** 最大値。 */
  max: number;
  /** ドラッグ/クリックで位置が変わったとき。 */
  onSeek?: (value: number) => void;
  /** 値をラベル整形する関数(例: 秒→ mm:ss)。 */
  formatLabel?: (value: number) => string;
  className?: string;
}

/** 操作可能なシークバー(動画・音声の再生位置など)。 */
export function Seekbar({ value, max, onSeek, formatLabel, className }: SeekbarProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Slider value={[value]} max={max} step={1} onValueChange={([v]) => onSeek?.(v ?? 0)} className="flex-1" />
      {formatLabel && (
        <span className="w-24 text-right text-xs tabular-nums text-[var(--color-muted)]">
          {formatLabel(value)} / {formatLabel(max)}
        </span>
      )}
    </div>
  );
}
