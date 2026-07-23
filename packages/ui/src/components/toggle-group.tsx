/**
 * 共通 ToggleGroup(Radix ラッパー)。セグメント状の選択(単一/複数)。
 * @packageDocumentation
 */
import * as React from "react";
import { ToggleGroup as Primitive } from "radix-ui";
import { cn } from "../lib/cn";

/** トグルグループのルート(`type="single"` か `"multiple"`)。 */
export const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof Primitive.Root>,
  React.ComponentPropsWithoutRef<typeof Primitive.Root>
>(({ className, ...props }, ref) => (
  <Primitive.Root
    ref={ref}
    className={cn("inline-flex rounded-[var(--radius)] border border-[var(--color-border)] p-0.5", className)}
    {...props}
  />
));
ToggleGroup.displayName = "ToggleGroup";

/** トグル 1 項目。 */
export const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof Primitive.Item>,
  React.ComponentPropsWithoutRef<typeof Primitive.Item>
>(({ className, ...props }, ref) => (
  <Primitive.Item
    ref={ref}
    className={cn(
      "rounded-[calc(var(--radius)-2px)] px-3 py-1.5 text-sm text-[var(--color-fg)] transition-colors hover:bg-[var(--color-subtle-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] data-[state=on]:bg-[var(--color-primary)] data-[state=on]:text-[var(--color-primary-fg)]",
      className,
    )}
    {...props}
  />
));
ToggleGroupItem.displayName = "ToggleGroupItem";
