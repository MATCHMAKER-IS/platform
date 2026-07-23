/**
 * 共通 Separator。水平/垂直の区切り線(Radix ラッパー)。
 * @packageDocumentation
 */
import * as React from "react";
import { Separator as Primitive } from "radix-ui";
import { cn } from "../lib/cn";

/** {@link Separator} の props。 */
export type SeparatorProps = React.ComponentPropsWithoutRef<typeof Primitive.Root>;

/**
 * 区切り線。
 *
 * **意味の切れ目**にだけ使う。見た目を整えるためだけに引くと、
 * どこが本当の区切りか分からなくなる。余白で足りるならその方がよい。
 *
 * - `orientation="vertical"` は、横に並んだ操作の間に使う。**親に高さが要る**
 * - 見出しがあるなら線は不要なことが多い(見出し自体が区切りになる)
 *
 * @example
 * ```tsx
 * <section>…集計…</section>
 * <Separator className="my-6" />
 * <section>…明細…</section>
 *
 * // 横並びの操作を区切る(親に h-* が要る)
 * <div className="flex h-5 items-center gap-3">
 *   <button>編集</button>
 *   <Separator orientation="vertical" />
 *   <button>削除</button>
 * </div>
 * ```
 */
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
