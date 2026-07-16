/**
 * 共通 Drawer。画面端から出るパネル(フィルタ・詳細・モバイルナビ等)。
 * Radix Dialog をベースに、side で出現方向を指定する。
 * @packageDocumentation
 */
import * as React from "react";
import { Dialog as Primitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "../lib/cn";

/** ドロワーのルート。 */
export const Drawer = Primitive.Root;
/** 開くトリガー。 */
export const DrawerTrigger = Primitive.Trigger;
/** 閉じるボタン用。 */
export const DrawerClose = Primitive.Close;

/** 出現方向。 */
export type DrawerSide = "left" | "right" | "top" | "bottom";

const SIDE_CLASSES: Record<DrawerSide, string> = {
  left: "inset-y-0 left-0 h-full w-80 max-w-[85vw] border-r",
  right: "inset-y-0 right-0 h-full w-80 max-w-[85vw] border-l",
  top: "inset-x-0 top-0 w-full max-h-[85vh] border-b",
  bottom: "inset-x-0 bottom-0 w-full max-h-[85vh] border-t",
};

/** {@link DrawerContent} の props。 */
export interface DrawerContentProps extends React.ComponentPropsWithoutRef<typeof Primitive.Content> {
  /** 出現方向(既定 right)。 */
  side?: DrawerSide;
  /** 閉じる×ボタンを隠す。 */
  hideClose?: boolean;
}

/** ドロワー本体(オーバーレイ + 端パネル)。 */
export const DrawerContent = React.forwardRef<React.ElementRef<typeof Primitive.Content>, DrawerContentProps>(
  ({ className, children, side = "right", hideClose, ...props }, ref) => (
    <Primitive.Portal>
      <Primitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <Primitive.Content
        ref={ref}
        className={cn(
          "fixed z-50 flex flex-col gap-4 overflow-y-auto border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-lg",
          SIDE_CLASSES[side],
          className,
        )}
        {...props}
      >
        {children}
        {!hideClose && (
          <Primitive.Close aria-label="閉じる" className="absolute right-4 top-4 opacity-60 hover:opacity-100">
            <X className="h-4 w-4" />
          </Primitive.Close>
        )}
      </Primitive.Content>
    </Primitive.Portal>
  ),
);
DrawerContent.displayName = "DrawerContent";

/** ドロワー見出し。 */
export function DrawerHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1", className)} {...props} />;
}
/** ドロワータイトル。 */
export const DrawerTitle = Primitive.Title;
/** ドロワー説明。 */
export const DrawerDescription = Primitive.Description;
