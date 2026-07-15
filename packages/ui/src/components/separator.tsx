/**
 * 共通 Separator。水平/垂直の区切り線(Radix ラッパー)。
 * @packageDocumentation
 */
import * as React from "react";
import { Separator as Primitive } from "radix-ui";
import { cn } from "../lib/cn.js";

/** {@link Separator} の props。 */
export type SeparatorProps = React.ComponentPropsWithoutRef<typeof Primitive.Root>;

/** 区切り線。orientation で水平(既定)/垂直を切替。 */
export const Separator = React.forwardRef<React.ElementRef<typeof Primitive.Root>, SeparatorProps>(
  ({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
    <Primitive.Root
      ref={ref}
      orientation={orientation}
      decorative={decorative}
      className={cn(
        "shrink-0 bg-[var(--color-border)]",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
      {...props}
    />
  ),
);
Separator.displayName = "Separator";
