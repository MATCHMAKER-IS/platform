/**
 * 共通 List / ListItem。設定一覧・項目一覧などのリスト表示。
 * @packageDocumentation
 */
import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../lib/cn";
import { Highlight } from "./highlight";

/**
 * 一覧(縦に並べる箱)。中に `ListItem` を並べる。
 *
 * **列がそろわない情報**を並べるのに向く。列で比べたいなら `DataTable` を使う
 * (通知・履歴・メニューは List、金額や日付を比べる一覧は DataTable)。
 *
 * @example
 * ```tsx
 * <List>
 *   <ListItem title="経費申請が承認されました" description="7/22 14:03"
 *     leading="✅" trailing={<Badge variant="success">承認</Badge>} href="/expenses/123" />
 *   <ListItem title="請求書が発行されました" description="7/21 09:15" leading="📄" />
 * </List>
 * ```
 */
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

/**
 * 一覧の 1 行。
 *
 * | props | 使いどころ |
 * |---|---|
 * | `leading` | 左に置くアイコン・アバター。種類が一目で分かる |
 * | `title` | 主題。短く |
 * | `description` | 補足(日時・送信者)。無くてもよい |
 * | `trailing` | 右に置く値・バッジ。**状態や金額**を置く |
 * | `onClick` / `href` | 押せるようにする。**押した先がある**ときだけ付ける |
 *
 * `onClick` と `href` の両方は付けない。リンクなら `href` を使う
 * (新しいタブで開く・URL をコピーする、といった操作ができるため)。
 */
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
  const cls = cn("flex items-center gap-3 bg-[var(--color-bg)] px-4 py-3 text-left", interactive && "w-full cursor-pointer hover:bg-[var(--color-subtle)]", className);
  if (href) return <li><a href={href} className={cls}>{inner}</a></li>;
  if (onClick) return <li><button type="button" onClick={onClick} className={cls}>{inner}</button></li>;
  return <li className={cls}>{inner}</li>;
}
