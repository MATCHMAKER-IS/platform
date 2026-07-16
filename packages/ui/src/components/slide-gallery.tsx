"use client";
/**
 * スライドギャラリー。サムネイル一覧＋選択画像の拡大表示（ライトボックス風）。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

/** ギャラリー画像。 */
export interface GalleryImage {
  src: string;
  alt?: string;
  /** サムネイル（未指定は src）。 */
  thumb?: string;
  caption?: string;
}

/** {@link SlideGallery} の props。 */
export interface SlideGalleryProps {
  images: GalleryImage[];
  /** 初期選択インデックス。 */
  initialIndex?: number;
  className?: string;
}

/** スライドギャラリー。 */
export function SlideGallery({ images, initialIndex = 0, className }: SlideGalleryProps) {
  const [index, setIndex] = React.useState(Math.min(initialIndex, Math.max(0, images.length - 1)));
  if (images.length === 0) return null;
  const current = images[index]!;
  const go = (d: number) => setIndex((i) => (i + d + images.length) % images.length);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="relative overflow-hidden rounded-[var(--radius)] bg-black/5">
        <img src={current.src} alt={current.alt ?? ""} className="mx-auto max-h-[70vh] w-auto object-contain" />
        {images.length > 1 && (
          <>
            <button aria-label="前へ" onClick={() => go(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-2 text-white hover:bg-black/70">‹</button>
            <button aria-label="次へ" onClick={() => go(1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-2 text-white hover:bg-black/70">›</button>
            <span className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">{index + 1} / {images.length}</span>
          </>
        )}
      </div>
      {current.caption && <p className="text-center text-sm text-[var(--color-muted)]">{current.caption}</p>}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={cn("h-16 w-16 flex-shrink-0 overflow-hidden rounded border-2", i === index ? "border-[var(--color-primary)]" : "border-transparent opacity-70 hover:opacity-100")}
            >
              <img src={img.thumb ?? img.src} alt={img.alt ?? ""} className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
