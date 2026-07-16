/**
 * 共通 Slider(Radix ラッパー)。数値レンジの入力。
 * @packageDocumentation
 */
import * as React from "react";
import { Slider as SliderPrimitive } from "radix-ui";
import { cn } from "../lib/cn";

/** {@link Slider} の props。 */
export type SliderProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>;

/**
 * 共通スライダー。
 * @example
 * ```tsx
 * <Slider defaultValue={[50]} max={100} step={1} onValueChange={([v]) => setVolume(v)} />
 * ```
 */
export const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex w-full touch-none select-none items-center", className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-slate-200">
      <SliderPrimitive.Range className="absolute h-full bg-[var(--color-primary)]" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-[var(--color-primary)] bg-white shadow transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:opacity-50" />
  </SliderPrimitive.Root>
));
Slider.displayName = "Slider";
