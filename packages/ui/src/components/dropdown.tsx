/**
 * 共通 DropdownMenu(Radix ラッパー)。操作メニュー用。
 * Root / Trigger はそのまま、Content / Item をスタイル付きで提供する。
 * @packageDocumentation
 */
import * as React from "react";
import { DropdownMenu as Primitive } from "radix-ui";
import { cn } from "../lib/cn";

/**
 * ドロップダウンメニュー(押すと出る一覧)。
 *
 * **場所が足りないときに操作をまとめる**もの。よく使う操作は隠さず、
 * ボタンとして出しておく方が速い(隠すと 1 回多く押すことになる)。
 *
 * - 危ない操作(削除・取り消し)は**メニューの一番下**に離して置く。押し間違いを防ぐ
 * - 項目が 3 つ未満なら、メニューにせず並べた方がよい
 * - 区切りは `DropdownMenuSeparator` で。種類の違う操作を分ける
 *
 * @example
 * ```tsx
 * <DropdownMenu>
 *   <DropdownMenuTrigger asChild><Button variant="ghost">…</Button></DropdownMenuTrigger>
 *   <DropdownMenuContent>
 *     <DropdownMenuItem onSelect={edit}>編集</DropdownMenuItem>
 *     <DropdownMenuItem onSelect={duplicate}>複製</DropdownMenuItem>
 *     <DropdownMenuSeparator />
 *     <DropdownMenuItem onSelect={remove}>削除</DropdownMenuItem>
 *   </DropdownMenuContent>
 * </DropdownMenu>
 * ```
 */
export const DropdownMenu = Primitive.Root;
/** メニューを開くトリガー。 */
export const DropdownMenuTrigger = Primitive.Trigger;
/** メニュー内のセパレータ。 */
export const DropdownMenuSeparator = Primitive.Separator;

/** メニュー本体(ポップオーバー)。 */
export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof Primitive.Content>,
  React.ComponentPropsWithoutRef<typeof Primitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <Primitive.Portal>
    <Primitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-1 shadow-md",
        className,
      )}
      {...props}
    />
  </Primitive.Portal>
));
DropdownMenuContent.displayName = "DropdownMenuContent";

/** メニュー項目。 */
export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof Primitive.Item>,
  React.ComponentPropsWithoutRef<typeof Primitive.Item>
>(({ className, ...props }, ref) => (
  <Primitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center rounded-[calc(var(--radius)-2px)] px-2 py-1.5 text-sm text-[var(--color-fg)] outline-none focus:bg-[var(--color-subtle-strong)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = "DropdownMenuItem";
