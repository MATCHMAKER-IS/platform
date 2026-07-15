"use client";
/**
 * バナー/広告表示。画像リンク＋任意で閉じるボタン・スポンサー表記。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn.js";

/** {@link BannerAd} の props。 */
export interface BannerAdProps {
  image: string;
  href: string;
  alt?: string;
  sponsored?: boolean;
  /** 閉じるボタンを出す。 */
  dismissible?: boolean;
  onDismiss?: () => void;
  onClick?: () => void;
  className?: string;
}

/** バナー広告。 */
export function BannerAd({ image, href, alt = "", sponsored, dismissible, onDismiss, onClick, className }: BannerAdProps) {
  const [closed, setClosed] = React.useState(false);
  if (closed) return null;
  return (
    <div className={cn("relative overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)]", className)}>
      {sponsored && <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">PR</span>}
      {dismissible && (
        <button
          aria-label="閉じる"
          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/40 text-xs text-white hover:bg-black/60"
          onClick={() => { setClosed(true); onDismiss?.(); }}
        >
          ×
        </button>
      )}
      <a href={href} onClick={onClick} target="_blank" rel="noopener sponsored">
        <img src={image} alt={alt} className="block w-full" loading="lazy" />
      </a>
    </div>
  );
}
