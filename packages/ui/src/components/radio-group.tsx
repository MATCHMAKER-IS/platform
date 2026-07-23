/**
 * 共通 RadioGroup(Radix ラッパー)。単一選択のラジオボタン。
 * @packageDocumentation
 */
import * as React from "react";
import { RadioGroup as Primitive } from "radix-ui";
import { cn } from "../lib/cn";

/** ラジオグループのルート。 */
/**
 * 排他的な選択(いくつかから 1 つ選ぶ)。
 *
 * **選択肢が 2〜5 個で、全部見せたいとき**に使う。それより多いなら `Select`
 * (画面が縦に伸びると、他の項目が見えなくなる)。
 *
 * - **必ず 1 つは選ばれている状態**にする。未選択を許すなら「指定なし」を選択肢に入れる
 * - 選択肢の並びには意味を持たせる(金額順・頻度順)。順不同なら五十音
 * - 選ぶと画面が変わる場合は、その旨を先に書く(押してから驚かせない)
 *
 * @example
 * ```tsx
 * <RadioGroup value={method} onValueChange={setMethod}>
 *   <label><RadioGroupItem value="bank" /> 銀行振込</label>
 *   <label><RadioGroupItem value="card" /> クレジットカード</label>
 * </RadioGroup>
 * ```
 */
export const RadioGroup = React.forwardRef<
  React.ElementRef<typeof Primitive.Root>,
  React.ComponentPropsWithoutRef<typeof Primitive.Root>
>(({ className, ...props }, ref) => (
  <Primitive.Root ref={ref} className={cn("grid gap-2", className)} {...props} />
));
RadioGroup.displayName = "RadioGroup";

/** ラジオ 1 項目。`value` を指定して使う。 */
export const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof Primitive.Item>,
  React.ComponentPropsWithoutRef<typeof Primitive.Item>
>(({ className, ...props }, ref) => (
  <Primitive.Item
    ref={ref}
    className={cn(
      "aspect-square h-4 w-4 rounded-full border border-[var(--color-border)] text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:opacity-50 data-[state=checked]:border-[var(--color-primary)]",
      className,
    )}
    {...props}
  >
    <Primitive.Indicator className="flex items-center justify-center">
      <span className="h-2 w-2 rounded-full bg-[var(--color-primary)]" />
    </Primitive.Indicator>
  </Primitive.Item>
));
RadioGroupItem.displayName = "RadioGroupItem";
