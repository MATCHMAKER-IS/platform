/**
 * 共通 List / ListItem。設定一覧・項目一覧などのリスト表示。
 * @packageDocumentation
 */
import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../lib/cn";
import { Highlight } from "./highlight";

/** リスト枠(項目間に区切り線)。 */
export function List({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return <ul role="list" className={cn("divide-y divide-[var(--color-border)] overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)]", className)} {...props} />;
}

/** {@link ListItem} の props。 */
export interface ListItemProps {
  /** 左側の要素(アイコン・アバター等)。 */
  leading?: React.ReactNode;
  /** タイトル。 */
  title: React.ReactNode;
  /** 補足説明。 */
  description?: React.ReactNode;
  /** 右側の要素(バッジ・値等)。 */
  trailing?: React.ReactNode;
  /** クリック時(指定するとホバー・カーソル・矢印付き)。 */
  onClick?: () => void;
  /** リンク先(指定すると a 要素)。 */
  href?: string;
  /** title/description が文字列のとき、この語(空白区切り)をハイライト。 */
  highlightQuery?: string;
  className?: string;
}

/** リスト項目。 */
export function ListItem({ leading, title, description, trailing, onClick, href, highlightQuery, className }: ListItemProps) {
  const hl = (v: React.ReactNode) => (highlightQuery && typeof v === "string" ? <Highlight text={v} query={highlightQuery} multiWord /> : v);
  const interactive = !!onClick || !!href;
  const inner = (
    <>
      {leading != null && <span className="flex shrink-0 items-center">{leading}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{hl(title)}</span>
        {description != null && <span className="mt-0.5 block truncate text-sm text-[var(--color-muted)]">{hl(description)}</span>}
      </span>
      {trailing != null && <span className="shrink-0 text-sm text-[var(--color-muted)]">{trailing}</span>}
      {interactive && !trailing && <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-muted)]" />}
    </>
  );
  const cls = cn("flex items-center gap-3 bg-[var(--color-bg)] px-4 py-3 text-left", interactive && "w-full cursor-pointer hover:bg-slate-50", className);
  if (href) return <li><a href={href} className={cls}>{inner}</a></li>;
  if (onClick) return <li><button type="button" onClick={onClick} className={cls}>{inner}</button></li>;
  return <li className={cls}>{inner}</li>;
}
