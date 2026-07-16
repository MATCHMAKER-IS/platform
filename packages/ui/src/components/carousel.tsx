"use client";
/**
 * 共通 Carousel(Embla ラッパー)。前後ボタン付きの横スクロールカルーセル。
 * @packageDocumentation
 */
import * as React from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/cn";
import { useT } from "./i18n-provider";

/** {@link Carousel} の props。 */
export interface CarouselProps {
  /** スライド(各要素が 1 枚)。 */
  children: React.ReactNode;
  /** ループ再生するか。 */
  loop?: boolean;
  className?: string;
}

/**
 * カルーセル。子要素をスライドとして横並びに表示し、前後ボタンで送る。
 * @example
 * ```tsx
 * <Carousel loop>
 *   <img src="/1.jpg" />
 *   <img src="/2.jpg" />
 * </Carousel>
 * ```
 */
export function Carousel({ children, loop = false, className }: CarouselProps) {
  const t = useT();
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop });
  const scrollPrev = React.useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = React.useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  return (
    <div className={cn("relative", className)}>
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {React.Children.map(children, (child, i) => (
            <div key={i} className="min-w-0 flex-[0_0_100%]">
              {child}
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={scrollPrev}
        aria-label={t("common.prev")}
        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)]/80 p-1.5 shadow hover:bg-[var(--color-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={scrollNext}
        aria-label={t("common.next")}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)]/80 p-1.5 shadow hover:bg-[var(--color-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
