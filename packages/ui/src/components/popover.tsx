/**
 * 共通 Popover(Radix ラッパー)。トリガーに紐づく浮遊パネル。
 * @packageDocumentation
 */
import * as React from "react";
import { Popover as Primitive } from "radix-ui";
import { cn } from "../lib/cn";

/** ポップオーバーのルート。 */
export const Popover = Primitive.Root;
/** 開くトリガー。 */
export const PopoverTrigger = Primitive.Trigger;
/** 閉じるボタン用。 */
export const PopoverClose = Primitive.Close;
/** アンカー(トリガーと別要素に位置合わせする場合)。 */
export const PopoverAnchor = Primitive.Anchor;

/** {@link PopoverContent} の props。 */
export type PopoverContentProps = React.ComponentPropsWithoutRef<typeof Primitive.Content>;

/** ポップオーバー本体。 */
export const PopoverContent = React.forwardRef<React.ElementRef<typeof Primitive.Content>, PopoverContentProps>(
  ({ className, align = "center", sideOffset = 6, ...props }, ref) => (
    <Primitive.Portal>
      <Primitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-72 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-sm text-[var(--color-fg)] shadow-lg outline-none",
          className,
        )}
        {...props}
      />
    </Primitive.Portal>
  ),
);
PopoverContent.displayName = "PopoverContent";
