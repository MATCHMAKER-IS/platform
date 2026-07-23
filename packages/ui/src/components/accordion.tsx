/**
 * 共通 Accordion(Radix ラッパー)。
 * @packageDocumentation
 */
import * as React from "react";
import { Accordion as Primitive } from "radix-ui";
import { ChevronDown } from "lucide-react";
import { cn } from "../lib/cn";

/**
 * 折りたたみ(開閉できる見出し)。
 *
 * **最初は隠しておいてよい情報**に使う。よく使う項目を隠すと、毎回開く手間が増える。
 * FAQ・詳細設定・補足説明に向く。
 *
 * - `type="single"` … 1 つ開くと他が閉じる(場所を取らない)
 * - `type="multiple"` … 複数を同時に開ける(見比べたいとき)
 * - `defaultValue` で最初から開いておく項目を指定できる
 *
 * **中身を検索したい場合は使わない。** 閉じている部分はブラウザの検索に引っかかりません。
 *
 * @example
 * ```tsx
 * <Accordion type="single" collapsible defaultValue="q1">
 *   <AccordionItem value="q1">
 *     <AccordionTrigger>経費はいつ振り込まれますか</AccordionTrigger>
 *     <AccordionContent>承認された月の翌月 25 日です。</AccordionContent>
 *   </AccordionItem>
 * </Accordion>
 * ```
 */
export const Accordion = Primitive.Root;

/** 1 項目。 */
export const AccordionItem = React.forwardRef<
  React.ElementRef<typeof Primitive.Item>,
  React.ComponentPropsWithoutRef<typeof Primitive.Item>
>(({ className, ...props }, ref) => (
  <Primitive.Item ref={ref} className={cn("border-b border-[var(--color-border)]", className)} {...props} />
));
AccordionItem.displayName = "AccordionItem";

/** 見出し(クリックで開閉)。 */
export const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof Primitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof Primitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <Primitive.Header className="flex">
    <Primitive.Trigger
      ref={ref}
      className={cn(
        "flex flex-1 items-center justify-between py-3 text-sm font-medium text-[var(--color-fg)] focus-visible:outline-none [&[data-state=open]>svg]:rotate-180",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 text-[var(--color-muted)] transition-transform" />
    </Primitive.Trigger>
  </Primitive.Header>
));
AccordionTrigger.displayName = "AccordionTrigger";

/** 内容。 */
export const AccordionContent = React.forwardRef<
  React.ElementRef<typeof Primitive.Content>,
  React.ComponentPropsWithoutRef<typeof Primitive.Content>
>(({ className, ...props }, ref) => (
  <Primitive.Content ref={ref} className={cn("pb-3 text-sm text-[var(--color-fg)]", className)} {...props} />
));
AccordionContent.displayName = "AccordionContent";
