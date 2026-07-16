"use client";
/**
 * 共通 Kanban。列(ステータス)ごとにカードを並べるボード表示。
 * ネイティブ HTML5 ドラッグでカードを移動でき、変更は onMove コールバックで受け取る
 * (状態は呼び出し側が保持=制御コンポーネント)。移動ロジックは lib/kanban の moveCard を使う。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn.js";

/** カンバンのカード。 */
export interface KanbanCard {
  id: string;
  title: React.ReactNode;
  /** 補足(担当・期限など)。 */
  meta?: React.ReactNode;
  /** 左端の色帯(優先度など)。 */
  accent?: string;
}

/** カンバンの列。 */
export interface KanbanColumn {
  id: string;
  title: React.ReactNode;
  cards: KanbanCard[];
  /** 列ヘッダの色。 */
  accent?: string;
}

/** {@link Kanban} の props。 */
export interface KanbanProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onMove"> {
  columns: KanbanColumn[];
  /** カード移動時(cardId, 移動先列 id, 挿入位置)。ドラッグ有効時のみ。 */
  onMove?: (cardId: string, toColumnId: string, toIndex: number) => void;
  /** カードクリック時。 */
  onCardClick?: (card: KanbanCard, columnId: string) => void;
  /** ドラッグ移動を無効化する。 */
  readOnly?: boolean;
}

/** カンバンボード。列ごとにカードを表示し、ドラッグで移動可能。 */
export function Kanban({ columns, onMove, onCardClick, readOnly, className, ...props }: KanbanProps) {
  const dragId = React.useRef<string | null>(null);
  return (
    <div className={cn("flex gap-4 overflow-x-auto pb-2", className)} {...props}>
      {columns.map((col) => (
        <div key={col.id} className="flex w-72 shrink-0 flex-col rounded-[var(--radius)] bg-slate-50"
          onDragOver={readOnly ? undefined : (e) => e.preventDefault()}
          onDrop={readOnly ? undefined : () => { if (dragId.current) { onMove?.(dragId.current, col.id, col.cards.length); dragId.current = null; } }}
        >
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
            <span className="flex items-center gap-2 text-sm font-semibold">
              {col.accent && <span className="h-2.5 w-2.5 rounded-full" style={{ background: col.accent }} aria-hidden />}
              {col.title}
            </span>
            <span className="rounded-full bg-slate-200 px-2 text-xs text-[var(--color-muted)]">{col.cards.length}</span>
          </div>
          <div className="flex flex-1 flex-col gap-2 p-2">
            {col.cards.map((card, idx) => (
              <div
                key={card.id}
                draggable={!readOnly}
                onDragStart={readOnly ? undefined : () => { dragId.current = card.id; }}
                onDragOver={readOnly ? undefined : (e) => e.preventDefault()}
                onDrop={readOnly ? undefined : (e) => { e.stopPropagation(); if (dragId.current) { onMove?.(dragId.current, col.id, idx); dragId.current = null; } }}
                onClick={() => onCardClick?.(card, col.id)}
                className={cn(
                  "cursor-pointer rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2.5 text-sm shadow-sm hover:shadow",
                  !readOnly && "active:cursor-grabbing",
                )}
                style={card.accent ? { borderLeft: `3px solid ${card.accent}` } : undefined}
              >
                <div className="font-medium text-[var(--color-fg)]">{card.title}</div>
                {card.meta && <div className="mt-1 text-xs text-[var(--color-muted)]">{card.meta}</div>}
              </div>
            ))}
            {col.cards.length === 0 && <div className="rounded-md border border-dashed border-[var(--color-border)] py-6 text-center text-xs text-[var(--color-muted)]">なし</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
