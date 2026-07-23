/**
 * 共通 Card。見出し・本文・フッターを持つカード。CardGrid でカード表示(グリッド)にできる。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

/**
 * カード(囲み枠)。
 *
 * **関係のある情報をひとまとまりに見せる**ためのもの。
 * `CardHeader` / `CardTitle` / `CardContent` / `CardFooter` を組み合わせて使う。
 *
 * ダッシュボードのタイルには `DashboardWidget` があり、そちらは枠と見出しを
 * 自前で描く。**両方を重ねると枠が二重になる**ので、どちらかにする。
 *
 * @example
 * ```tsx
 * <Card>
 *   <CardHeader>
 *     <CardTitle>今月の請求</CardTitle>
 *     <CardDescription>2026 年 7 月分</CardDescription>
 *   </CardHeader>
 *   <CardContent>…明細…</CardContent>
 *   <CardFooter><Button>PDF を出す</Button></CardFooter>
 * </Card>
 * ```
 */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-fg)] shadow-sm", className)} {...props} />;
}
/** カード見出し領域。 */
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 p-4", className)} {...props} />;
}
/** カードタイトル。 */
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-base font-semibold leading-tight", className)} {...props} />;
}
/** カード説明文。 */
export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-[var(--color-muted)]", className)} {...props} />;
}
/** カード本文。 */
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 pt-0", className)} {...props} />;
}
/** カードフッター。 */
export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center gap-2 p-4 pt-0", className)} {...props} />;
}

/** {@link CardGrid} の props。 */
export interface CardGridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** カード最小幅(px)。これを下回らない範囲で自動的に列数が決まる。既定 260。 */
  minWidth?: number;
  /** カード間の間隔(px)。既定 16。 */
  gap?: number;
}
/** カードを敷き詰めるレスポンシブグリッド(カード表示)。 */
export function CardGrid({ minWidth = 260, gap = 16, className, style, ...props }: CardGridProps) {
  return (
    <div
      className={cn("grid", className)}
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))`, gap, ...style }}
      {...props}
    />
  );
}
