/**
 * 共通 Dialog(Radix ラッパー)。モーダルダイアログ。
 * @packageDocumentation
 */
import * as React from "react";
import { Dialog as Primitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "../lib/cn";
import { useT } from "./i18n-provider";

/**
 * ダイアログ(重ねて出す小窓)。
 *
 * **画面を離れずに済む短い操作**に使う。項目が多い入力や、じっくり読む内容は
 * 専用の画面にした方がよい(小窓は狭く、戻る操作もしにくい)。
 *
 * - 確認だけなら `AlertDialog`(取り消せない操作の確認に特化)
 * - 閉じたときに入力を捨ててよいかを必ず決める。**捨てるなら確認を挟む**
 * - `DialogTrigger` を使うと開閉の状態を自分で持たなくてよい
 *
 * @example
 * ```tsx
 * <Dialog>
 *   <DialogTrigger asChild><Button>編集</Button></DialogTrigger>
 *   <DialogContent>
 *     <DialogHeader>
 *       <DialogTitle>取引先を編集</DialogTitle>
 *       <DialogDescription>変更は保存を押すまで反映されません。</DialogDescription>
 *     </DialogHeader>
 *     …入力…
 *     <DialogFooter>
 *       <DialogClose asChild><Button variant="secondary">やめる</Button></DialogClose>
 *       <Button onClick={save}>保存</Button>
 *     </DialogFooter>
 *   </DialogContent>
 * </Dialog>
 * ```
 */
export const Dialog = Primitive.Root;
/** ダイアログを開くトリガー。 */
export const DialogTrigger = Primitive.Trigger;
/** ダイアログを閉じるボタン用。 */
export const DialogClose = Primitive.Close;

/** ダイアログ本体(オーバーレイ + 中央パネル)。 */
export const DialogContent = React.forwardRef<
  React.ElementRef<typeof Primitive.Content>,
  React.ComponentPropsWithoutRef<typeof Primitive.Content>
>(({ className, children, ...props }, ref) => {
  const t = useT();
  return (
  <Primitive.Portal>
    <Primitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
    <Primitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-lg",
        className,
      )}
      {...props}
    >
      {children}
      <Primitive.Close className="absolute right-4 top-4 rounded-sm opacity-60 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]">
        <X className="h-4 w-4" />
        <span className="sr-only">{t("common.close")}</span>
      </Primitive.Close>
    </Primitive.Content>
  </Primitive.Portal>
  );
});
DialogContent.displayName = "DialogContent";

/** ダイアログのタイトル。 */
export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof Primitive.Title>,
  React.ComponentPropsWithoutRef<typeof Primitive.Title>
>(({ className, ...props }, ref) => (
  <Primitive.Title ref={ref} className={cn("text-lg font-semibold text-[var(--color-fg)]", className)} {...props} />
));
DialogTitle.displayName = "DialogTitle";

/** ヘッダ領域(タイトル・説明をまとめる)。 */
export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 flex flex-col gap-1.5", className)} {...props} />;
}

/** フッタ領域(操作ボタンを右寄せ)。 */
export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-6 flex justify-end gap-2", className)} {...props} />;
}
