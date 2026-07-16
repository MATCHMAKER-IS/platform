/**
 * 共通 Tooltip(Radix ラッパー)。
 * アプリのルート付近を {@link TooltipProvider} で囲んで使う。
 * @packageDocumentation
 */
import * as React from "react";
import { Tooltip as Primitive } from "radix-ui";
import { cn } from "../lib/cn";

/** Tooltip のプロバイダ(アプリ上位で 1 度囲む)。 */
export const TooltipProvider = Primitive.Provider;
/** Tooltip のルート。 */
export const Tooltip = Primitive.Root;
/** Tooltip のトリガー。 */
export const TooltipTrigger = Primitive.Trigger;

/** Tooltip の吹き出し。 */
export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof Primitive.Content>,
  React.ComponentPropsWithoutRef<typeof Primitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <Primitive.Portal>
    <Primitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 rounded-[calc(var(--radius)-2px)] bg-[var(--color-fg)] px-2 py-1 text-xs text-white shadow",
        className,
      )}
      {...props}
    />
  </Primitive.Portal>
));
TooltipContent.displayName = "TooltipContent";
