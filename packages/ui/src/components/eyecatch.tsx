"use client";
/**
 * アイキャッチ（記事のヒーロー画像）。画像の上にタイトル・メタを重ねられる。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn.js";

/** {@link Eyecatch} の props。 */
export interface EyecatchProps {
  image: string;
  alt?: string;
  title?: string;
  subtitle?: string;
  /** 高さ（Tailwind 高さクラス、既定 h-64）。 */
  heightClassName?: string;
  /** オーバーレイの濃さ（0–100、既定 40）。 */
  overlayOpacity?: number;
  className?: string;
}

/** アイキャッチ画像。 */
export function Eyecatch({ image, alt = "", title, subtitle, heightClassName = "h-64", overlayOpacity = 40, className }: EyecatchProps) {
  return (
    <div className={cn("relative w-full overflow-hidden rounded-[var(--radius)]", heightClassName, className)}>
      <img src={image} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
      {(title || subtitle) && (
        <>
          <div className="absolute inset-0 bg-black" style={{ opacity: overlayOpacity / 100 }} />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center text-white">
            {title && <h2 className="text-2xl font-bold drop-shadow">{title}</h2>}
            {subtitle && <p className="mt-1 text-sm opacity-90 drop-shadow">{subtitle}</p>}
          </div>
        </>
      )}
    </div>
  );
}
