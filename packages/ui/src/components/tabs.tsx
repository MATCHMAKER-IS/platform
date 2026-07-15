/**
 * 共通 Tabs(Radix ラッパー)。
 * @packageDocumentation
 */
import * as React from "react";
import { Tabs as Primitive } from "radix-ui";
import { cn } from "../lib/cn.js";

/** タブのルート。 */
export const Tabs = Primitive.Root;

/** タブの並び。 */
export const TabsList = React.forwardRef<
  React.ElementRef<typeof Primitive.List>,
  React.ComponentPropsWithoutRef<typeof Primitive.List>
>(({ className, ...props }, ref) => (
  <Primitive.List ref={ref} className={cn("inline-flex items-center gap-1 border-b border-[var(--color-border)]", className)} {...props} />
));
TabsList.displayName = "TabsList";

/** タブの見出しボタン。 */
export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof Primitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof Primitive.Trigger>
>(({ className, ...props }, ref) => (
  <Primitive.Trigger
    ref={ref}
    className={cn(
      "-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)] focus-visible:outline-none data-[state=active]:border-[var(--color-primary)] data-[state=active]:text-[var(--color-fg)]",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

/** タブの内容。 */
export const TabsContent = React.forwardRef<
  React.ElementRef<typeof Primitive.Content>,
  React.ComponentPropsWithoutRef<typeof Primitive.Content>
>(({ className, ...props }, ref) => (
  <Primitive.Content ref={ref} className={cn("pt-4 focus-visible:outline-none", className)} {...props} />
));
TabsContent.displayName = "TabsContent";
