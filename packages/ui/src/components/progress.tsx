/**
 * 共通 Progress(進捗バー)と Seekbar(操作可能なシークバー)。
 * @packageDocumentation
 */
import * as React from "react";
import { Progress as Primitive } from "radix-ui";
import { Slider } from "./slider";
import { cn } from "../lib/cn";

/** 進捗バー(0〜100、非操作)。 */
/**
 * 進み具合の帯。
 *
 * **終わりが分かるときだけ**使う。いつ終わるか分からない処理には `Spinner` を使う
 * (止まっているように見える帯は、失敗と区別がつかない)。
 *
 * - 進みが分かるなら、**残り件数も文字で出す**(「120 / 500 件」)
 * - 時間のかかる処理は、画面を離れても続くようにする(`@platform/jobs`)
 * - `Seekbar` は動画・音声の再生位置用。押した位置へ移動できる
 *
 * @example
 * ```tsx
 * <Progress value={(done / total) * 100} />
 * <p>{done} / {total} 件を取り込みました</p>
 * ```
 */
export function Progress({ value = 0, className }: { value?: number; className?: string }) {
  return (
    <Primitive.Root
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-[var(--color-subtle-strong)]", className)}
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
