/**
 * 共通 Breadcrumb。パンくずリスト。
 * @packageDocumentation
 */
import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../lib/cn";
import { useT } from "./i18n-provider";

/** パンくず 1 項目。 */
export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/** {@link Breadcrumb} の props。 */
export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  /** 区切り文字/要素(既定は「›」風のシェブロン。"/" や "・" などを渡せる)。 */
  separator?: React.ReactNode;
  className?: string;
}

/**
 * パンくずリスト。最後の項目は現在地として強調(リンク無効)。
 * @example
 * ```tsx
 * <Breadcrumb items={[{ label: "ホーム", href: "/" }, { label: "設定" }]} />
 * ```
 */
/**
 * パンくず(今いる場所の階層)。
 *
 * 深い階層で「どこから来たか」を示す。
 * **階層が 2 段までなら不要**(戻るボタンで足りる)。
 */
export function Breadcrumb({ items, separator, className }: BreadcrumbProps) {
  const t = useT();
  return (
    <nav aria-label={t("nav.breadcrumb")} className={cn("flex items-center gap-1 text-sm", className)}>
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <React.Fragment key={i}>
            {item.href && !last ? (
              <a href={item.href} className="text-[var(--color-muted)] hover:text-[var(--color-fg)]">{item.label}</a>
            ) : (
              <span className={last ? "font-medium text-[var(--color-fg)]" : "text-[var(--color-muted)]"} aria-current={last ? "page" : undefined}>
                {item.label}
              </span>
            )}
            {!last && (
              separator != null
                ? <span className="text-[var(--color-muted)]" aria-hidden="true">{separator}</span>
                : <ChevronRight className="h-3.5 w-3.5 text-[var(--color-muted)]" aria-hidden="true" />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
