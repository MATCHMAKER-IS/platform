"use client";
/**
 * 右クリックでコピー/貼り付けメニューを出す実例。
 * ContextMenu の項目に CopyButton の元になる copyToClipboard と usePaste を結び、
 * 右クリック→「コピー」「貼り付け」を実現する。テキスト編集セルなどで使う想定。
 * @packageDocumentation
 */
import * as React from "react";
import { ContextMenu, useCopyToClipboard, usePaste, CopyButton } from "@platform/ui";

/** {@link EditableCell} の props。 */
export interface EditableCellProps {
  initial?: string;
}

/** 右クリックでコピー/貼り付けできる編集セル。 */
export function EditableCell({ initial = "" }: EditableCellProps) {
  const [value, setValue] = React.useState(initial);
  const [copied, copy] = useCopyToClipboard();
  const [, paste] = usePaste();

  return (
    <ContextMenu
      items={[
        { label: "コピー", onSelect: () => copy(value) },
        { label: "貼り付け", onSelect: async () => { const t = await paste(); if (t != null) setValue(t); } },
        { label: "クリア", onSelect: () => setValue(""), danger: true, separated: true },
      ]}
    >
      <div className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-2">
        <span className="flex-1 truncate text-sm">{value || <span className="text-[var(--color-muted)]">右クリックで操作</span>}</span>
        {/* 明示的なコピーボタンも併設(右クリックが使えない環境向け) */}
        <CopyButton value={value} label="" />
        {copied && <span className="text-xs text-[var(--color-success)]">コピー済み</span>}
      </div>
    </ContextMenu>
  );
}
