"use client";
/**
 * サイトフッター。複数のリンク列と、下部の著作権表示・法的リンクをまとめる。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn.js";

/** フッターのリンク列。 */
export interface FooterLinkGroup {
  title: string;
  links: { label: string; href: string; external?: boolean }[];
}

/** {@link SiteFooter} の props。 */
export interface SiteFooterProps extends React.HTMLAttributes<HTMLElement> {
  /** リンク列。 */
  groups?: FooterLinkGroup[];
  /** 左側のブランド/説明(ロゴ等)。 */
  brand?: React.ReactNode;
  /** 著作権表記(既定で © + 年 + 名称を組み立てる場合は copyrightName を使う)。 */
  copyright?: React.ReactNode;
  /** copyright 未指定時に「© {year} {name}」を生成。 */
  copyrightName?: string;
  /** 下部の法的リンク(利用規約・プライバシー等)。 */
  legalLinks?: { label: string; href: string }[];
  /** 右下のSNSアイコン等。 */
  social?: React.ReactNode;
}

/** サイト全体のフッター。 */
export const SiteFooter = React.forwardRef<HTMLElement, SiteFooterProps>(
  ({ groups = [], brand, copyright, copyrightName, legalLinks = [], social, className, ...props }, ref) => {
    const year = new Date().getFullYear();
    const copyrightNode = copyright ?? (copyrightName ? `© ${year} ${copyrightName}` : null);
    return (
      <footer ref={ref} className={cn("border-t border-[var(--color-border)] bg-[var(--color-bg)]", className)} {...props}>
        {(brand != null || groups.length > 0) && (
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-10 sm:grid-cols-3 md:grid-cols-4">
            {brand != null && <div className="col-span-2 sm:col-span-1">{brand}</div>}
            {groups.map((group) => (
              <div key={group.title}>
                <h3 className="mb-3 text-sm font-semibold text-[var(--color-fg)]">{group.title}</h3>
                <ul className="flex flex-col gap-2">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        className="text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <div className="border-t border-[var(--color-border)]">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-4 text-xs text-[var(--color-muted)] sm:flex-row">
            <span>{copyrightNode}</span>
            <div className="flex items-center gap-4">
              {legalLinks.map((link) => (
                <a key={link.href} href={link.href} className="transition-colors hover:text-[var(--color-fg)]">{link.label}</a>
              ))}
              {social}
            </div>
          </div>
        </div>
      </footer>
    );
  },
);
SiteFooter.displayName = "SiteFooter";
