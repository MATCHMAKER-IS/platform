/**
 * 共通 Avatar(Radix ラッパー)。画像読み込み失敗時はフォールバックを表示。
 * @packageDocumentation
 */
import * as React from "react";
import { Avatar as Primitive } from "radix-ui";
import { cn } from "../lib/cn";

/** アバターのルート(円形)。 */
/**
 * 利用者の顔写真(無ければ頭文字)。
 *
 * 一覧で誰の行かを素早く見分けるためのもの。**名前を省略して顔だけにしない**
 * (似た写真の人がいると分からなくなる)。
 */
export const Avatar = React.forwardRef<
  React.ElementRef<typeof Primitive.Root>,
  React.ComponentPropsWithoutRef<typeof Primitive.Root>
>(({ className, ...props }, ref) => (
  <Primitive.Root ref={ref} className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)} {...props} />
));
Avatar.displayName = "Avatar";

/** アバター画像。 */
export const AvatarImage = React.forwardRef<
  React.ElementRef<typeof Primitive.Image>,
  React.ComponentPropsWithoutRef<typeof Primitive.Image>
>(({ className, ...props }, ref) => (
  <Primitive.Image ref={ref} className={cn("h-full w-full object-cover", className)} {...props} />
));
AvatarImage.displayName = "AvatarImage";

/** 画像が無い/失敗したときの代替(イニシャル等)。 */
export const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof Primitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof Primitive.Fallback>
>(({ className, ...props }, ref) => (
  <Primitive.Fallback ref={ref} className={cn("flex h-full w-full items-center justify-center bg-[var(--color-subtle-strong)] text-sm text-[var(--color-muted)]", className)} {...props} />
));
AvatarFallback.displayName = "AvatarFallback";
