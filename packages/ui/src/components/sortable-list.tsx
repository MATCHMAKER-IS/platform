"use client";
/**
 * ドラッグ&ドロップで並べ替えできるリスト（HTML5 Drag and Drop）。
 * 並べ替え確定時に onReorder で新しい順序を通知する。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

/** {@link SortableList} の props。 */
export interface SortableListProps<T> {
  items: T[];
  /** 各要素の一意キー。 */
  getKey: (item: T) => string;
  /** 並べ替え後に呼ばれる。 */
  onReorder: (items: T[]) => void;
  /** 各要素の描画。 */
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
  itemClassName?: string;
}

/** 配列の要素を from から to へ移動した新しい配列を返す。 */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved as T);
  return next;
}

/** D&D 並べ替えリスト。 */
/**
 * 並べ替えできる一覧。
 *
 * 手で順序を決めるものに使う(表示順・優先度)。
 * **保存のタイミング**を決める(動かすたびか、まとめてか)。
 */
export function SortableList<T>({ items, getKey, onReorder, renderItem, className, itemClassName }: SortableListProps<T>) {
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [overIndex, setOverIndex] = React.useState<number | null>(null);

  const onDrop = (to: number) => {
    if (dragIndex === null) return;
    onReorder(moveItem(items, dragIndex, to));
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <ul className={cn("flex flex-col gap-1", className)}>
      {items.map((item, i) => (
        <li
          key={getKey(item)}
          draggable
          onDragStart={() => setDragIndex(i)}
          onDragOver={(e: React.DragEvent) => { e.preventDefault(); setOverIndex(i); }}
          onDrop={() => onDrop(i)}
          onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
          className={cn(
            "flex cursor-grab items-center gap-2 active:cursor-grabbing",
            overIndex === i && dragIndex !== null && dragIndex !== i && "border-t-2 border-[var(--color-primary)]",
            dragIndex === i && "opacity-50",
            itemClassName,
          )}
        >
          <span aria-hidden className="select-none text-[var(--color-muted)]">⠿</span>
          <div className="min-w-0 flex-1">{renderItem(item, i)}</div>
        </li>
      ))}
    </ul>
  );
}
