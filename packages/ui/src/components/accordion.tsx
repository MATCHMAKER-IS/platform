/**
 * 共通 Accordion(Radix ラッパー)。
 * @packageDocumentation
 */
import * as React from "react";
import { Accordion as Primitive } from "radix-ui";
import { ChevronDown } from "lucide-react";
import { cn } from "../lib/cn";

/** アコーディオンのルート(`type="single"` か `"multiple"`)。 */
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
