"use client";
/**
 * 共通 Rating(星評価)。クリックで評価、ホバーでプレビュー。読み取り専用も可。
 * @packageDocumentation
 */
import * as React from "react";
import { Star } from "lucide-react";
import { cn } from "../lib/cn.js";

/** {@link Rating} の props。 */
export interface RatingProps {
  /** 現在の評価(0〜max)。 */
  value: number;
  /** 星の数(既定 5)。 */
  max?: number;
  /** 変更時(読み取り専用なら不要)。 */
  onChange?: (value: number) => void;
  /** 読み取り専用(表示のみ)。 */
  readOnly?: boolean;
  /** 星のサイズ(px、既定 20)。 */
  size?: number;
  className?: string;
}

/**
 * 星評価。
 * @example
 * ```tsx
 * <Rating value={rating} onChange={setRating} />
 * <Rating value={4} readOnly />
 * ```
 */
export function Rating({ value, max = 5, onChange, readOnly, size = 20, className }: RatingProps) {
  const [hover, setHover] = React.useState<number | null>(null);
  const shown = hover ?? value;

  return (
    <div className={cn("inline-flex items-center gap-0.5", className)} role={readOnly ? "img" : "radiogroup"} aria-label={`評価 ${value} / ${max}`}>
      {Array.from({ length: max }, (_v, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          onMouseEnter={() => !readOnly && setHover(n)}
          onMouseLeave={() => !readOnly && setHover(null)}
          className={cn("text-amber-400", !readOnly && "cursor-pointer", readOnly && "cursor-default")}
          aria-label={`${n} 点`}
        >
          <Star width={size} height={size} className={n <= shown ? "fill-amber-400" : "fill-transparent text-slate-300"} />
        </button>
      ))}
    </div>
  );
}
