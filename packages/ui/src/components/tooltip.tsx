/**
 * 共通 Tooltip(Radix ラッパー)。
 * アプリのルート付近を {@link TooltipProvider} で囲んで使う。
 * @packageDocumentation
 */
import * as React from "react";
import { Tooltip as Primitive } from "radix-ui";
import { cn } from "../lib/cn";

/** Tooltip のプロバイダ(アプリ上位で 1 度囲む)。 */
/**
 * 補足の吹き出し(マウスを乗せると出る)。
 *
 * **触らないと読めないため、大事な情報は入れない。**
 * スマートフォンでは出しにくく、読み上げでも伝わりにくい。
 * 必要な説明は画面に書き、吹き出しは「あると助かる」程度に留める。
 *
 * - アイコンだけのボタンには `aria-label` を付ける(吹き出しの代わりにはならない)
 * - `TooltipProvider` はアプリの外側に 1 つ置く
 *
 * @example
 * ```tsx
 * <TooltipProvider>
 *   <Tooltip>
 *     <TooltipTrigger asChild><Button variant="ghost" aria-label="更新">⟳</Button></TooltipTrigger>
 *     <TooltipContent>最新の状態に更新します</TooltipContent>
 *   </Tooltip>
 * </TooltipProvider>
 * ```
 */
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
