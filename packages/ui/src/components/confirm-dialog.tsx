"use client";
/**
 * 共通 ConfirmDialog / ErrorDialog(Radix AlertDialog)。
 * 確認・エラー通知に適したセマンティクス(role=alertdialog、フォーカス管理)。
 * @packageDocumentation
 */
import * as React from "react";
import { AlertDialog as Primitive } from "radix-ui";
import { AlertTriangle } from "lucide-react";
import { cn } from "../lib/cn";
import { useT } from "./i18n-provider";
import { buttonVariants } from "./button";

const overlay = "fixed inset-0 z-50 bg-black/40";
const content =
  "fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-lg";

/** {@link ConfirmDialog} の props。 */
export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  /** 破壊的操作(削除等)なら true で確認ボタンを危険色に。 */
  destructive?: boolean;
  onConfirm: () => void;
}

/** 確認ダイアログ。 */
/**
 * 取り消せない操作の確認。
 *
 * 削除・一括更新など、**やり直せないもの**にだけ出す。
 * 何度も出すと読まずに押されるので、本当に危ないものに限る。
 * 確認の文には**何が起きるか**を書く(「削除しますか」ではなく「12 件を削除します」)。
 */
export function ConfirmDialog({
  open, onOpenChange, title, description,
  confirmText = "OK", cancelText, destructive, onConfirm,
}: ConfirmDialogProps) {
  const t = useT();
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Portal>
        <Primitive.Overlay className={overlay} />
        <Primitive.Content className={content}>
          <Primitive.Title className="text-lg font-semibold text-[var(--color-fg)]">{title ?? t("error.title")}</Primitive.Title>
          {description && <Primitive.Description className="mt-2 text-sm text-[var(--color-muted)]">{description}</Primitive.Description>}
          <div className="mt-6 flex justify-end gap-2">
            <Primitive.Cancel className={cn(buttonVariants({ variant: "secondary" }))}>{cancelText ?? t("common.cancel")}</Primitive.Cancel>
            <Primitive.Action
              className={cn(buttonVariants({ variant: destructive ? "danger" : "primary" }))}
              onClick={onConfirm}
            >
              {confirmText}
            </Primitive.Action>
          </div>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}

/** {@link ErrorDialog} の props。 */
export interface ErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  message: string;
  closeText?: string;
}

/** エラー通知ダイアログ。 */
export function ErrorDialog({ open, onOpenChange, title, message, closeText }: ErrorDialogProps) {
  const t = useT();
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Portal>
        <Primitive.Overlay className={overlay} />
        <Primitive.Content className={content}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-danger)]" />
            <div>
              <Primitive.Title className="text-lg font-semibold text-[var(--color-danger)]">{title ?? t("error.title")}</Primitive.Title>
              <Primitive.Description className="mt-1 text-sm text-[var(--color-fg)]">{message}</Primitive.Description>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Primitive.Action className={cn(buttonVariants({ variant: "secondary" }))}>{closeText ?? t("common.close")}</Primitive.Action>
          </div>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
