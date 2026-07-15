"use client";
/**
 * 共通 Modal。制御された(open/onOpenChange)汎用モーダル。既存 Dialog の薄い糖衣。
 * @packageDocumentation
 */
import * as React from "react";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter } from "./dialog.js";

/** {@link Modal} の props。 */
export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: React.ReactNode;
  /** フッタ(操作ボタン等)。 */
  footer?: React.ReactNode;
}

/**
 * 汎用モーダル。
 * @example
 * ```tsx
 * <Modal open={open} onOpenChange={setOpen} title="編集" footer={<Button onClick={save}>保存</Button>}>
 *   <p>本文</p>
 * </Modal>
 * ```
 */
export function Modal({ open, onOpenChange, title, children, footer }: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {title && <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>}
        {children}
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
