/**
 * 共通 Badge。ステータス表示等の小さなラベル。
 * @packageDocumentation
 */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-[var(--color-primary)] text-[var(--color-primary-fg)]",
        secondary: "bg-[var(--color-subtle-strong)] text-[var(--color-fg)]",
        success: "bg-emerald-100 text-emerald-700",
        warning: "bg-amber-100 text-amber-700",
        danger: "bg-red-100 text-[var(--color-danger)]",
        info: "bg-blue-100 text-blue-700",
        outline: "border border-[var(--color-border)] text-[var(--color-fg)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

/** {@link Badge} の props。 */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

/**
 * ステータスラベル(小さな色付きの札)。
 *
 * **状態を一目で分からせる**ためのもの。文章の中に埋めず、一覧の行や見出しの横に置く。
 *
 * variant の使い分け:
 * | variant | 使う場面 |
 * |---|---|
 * | `success` | 完了・承認済み・有効 |
 * | `warning` | 期限が近い・要確認(まだ失敗ではない) |
 * | `danger` | 失敗・期限切れ・停止中 |
 * | `info` | 補足の情報(件数・種別) |
 * | `secondary` | 目立たせない補助情報 |
 * | `outline` | 背景色を使いたくない場所 |
 *
 * **色だけで意味を伝えない。** 色が見分けにくい人にも分かるよう、必ず文字を入れる
 * (「●」だけの Badge は避ける)。
 *
 * @example
 * ```tsx
 * <Badge variant="success">承認済み</Badge>
 * <Badge variant="warning">期限まで 3 日</Badge>
 * <Badge variant="danger">失敗</Badge>
 * ```
 */
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
