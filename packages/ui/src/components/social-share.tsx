"use client";
/**
 * SNS シェアボタン。@platform/social の shareLinks で URL を生成し、新規タブで開く。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn.js";

/** シェアリンク（@platform/social の shareLinks の出力形）。 */
export interface ShareLink {
  platform: string;
  label: string;
  url: string;
}

/** {@link SocialShare} の props。 */
export interface SocialShareProps {
  links: ShareLink[];
  /** ボタンの見た目。 */
  variant?: "solid" | "outline";
  onShare?: (platform: string) => void;
  className?: string;
}

const BRAND: Record<string, string> = {
  x: "#000000", facebook: "#1877F2", line: "#06C755", hatena: "#00A4DE", linkedin: "#0A66C2", email: "#666666", whatsapp: "#25D366", telegram: "#26A5E4",
};

/** SNS シェアボタン群。 */
export function SocialShare({ links, variant = "solid", onShare, className }: SocialShareProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {links.map((l) => {
        const color = BRAND[l.platform] ?? "var(--color-fg)";
        const style = variant === "solid" ? { backgroundColor: color, color: "#fff" } : { borderColor: color, color };
        return (
          <a
            key={l.platform}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onShare?.(l.platform)}
            className={cn("inline-flex items-center gap-1 rounded-[var(--radius)] px-3 py-1.5 text-xs font-medium", variant === "outline" && "border")}
            style={style}
          >
            {l.label}
          </a>
        );
      })}
    </div>
  );
}
