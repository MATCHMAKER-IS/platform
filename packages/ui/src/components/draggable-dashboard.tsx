"use client";
/**
 * ドラッグ&ドロップで並べ替え・リサイズできるダッシュボード。レイアウトは
 * localStorage か任意の非同期ストア(DB)に保存できる。
 * @packageDocumentation
 */
import * as React from "react";
import { GripVertical } from "lucide-react";
import { cn } from "../lib/cn";
import { useT } from "./i18n-provider";
import { reorder, setColSpan, type DashboardLayout } from "../lib/layout";
import type { LayoutStore } from "../lib/layout-store";

/** レイアウト状態を管理し、ストアに永続化するフック。 */
export function useDashboardLayout(defaultLayout: DashboardLayout, store?: LayoutStore) {
  const [layout, setLayout] = React.useState<DashboardLayout>(defaultLayout);

  React.useEffect(() => {
    let active = true;
    void (async () => {
      const saved = await store?.load();
      if (active && saved && saved.length > 0) setLayout(saved);
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = React.useCallback((next: DashboardLayout) => {
    setLayout(next);
    void store?.save(next);
  }, [store]);

  return { layout, setLayout: update, reset: () => update(defaultLayout) };
}

/** {@link DraggableDashboard} の props。 */
export interface DraggableDashboardProps {
  layout: DashboardLayout;
  onLayoutChange: (layout: DashboardLayout) => void;
  /** 各ウィジェットの中身。 */
  renderWidget: (id: string) => React.ReactNode;
  /** 見出し(id → タイトル)。 */
  titleOf?: (id: string) => React.ReactNode;
  columns?: number;
  gap?: number;
  /** 並べ替え・リサイズを有効化(既定 true)。false で閲覧モード。 */
  editable?: boolean;
  className?: string;
}

/** ドラッグ&ドロップ対応ダッシュボード。 */
export function DraggableDashboard({
  const t = useT();
  layout, onLayoutChange, renderWidget, titleOf, columns = 12, gap = 16, editable = true, className,
}: DraggableDashboardProps) {
  const gridRef = React.useRef<HTMLDivElement>(null);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const resizing = React.useRef<{ id: string; startX: number; startSpan: number } | null>(null);

  const onResizePointerDown = (id: string, span: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    resizing.current = { id, startX: e.clientX, startSpan: span };
    const onMove = (ev: PointerEvent) => {
      const r = resizing.current;
      const grid = gridRef.current;
      if (!r || !grid) return;
      const colWidth = (grid.clientWidth - gap * (columns - 1)) / columns;
      const deltaCols = Math.round((ev.clientX - r.startX) / (colWidth + gap));
      onLayoutChange(setColSpan(layout, r.id, r.startSpan + deltaCols, columns));
    };
    const onUp = () => {
      resizing.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      ref={gridRef}
      className={cn("platform-dashboard", className)}
      style={{ ["--dash-cols" as string]: String(columns), gap }}
    >
      {layout.map((item) => (
        <section
          key={item.id}
          draggable={editable}
          onDragStart={() => setDragId(item.id)}
          onDragOver={(e: React.DragEvent) => e.preventDefault()}
          onDrop={() => { if (dragId && dragId !== item.id) onLayoutChange(reorder(layout, dragId, item.id)); setDragId(null); }}
          className={cn("relative rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4", dragId === item.id && "opacity-50")}
          style={{ gridColumn: `span ${item.colSpan}` }}
        >
          {editable && (
            <div className="mb-2 flex items-center gap-2">
              <GripVertical className="h-4 w-4 cursor-grab text-[var(--color-muted)]" />
              {titleOf && <span className="text-sm font-semibold text-[var(--color-fg)]">{titleOf(item.id)}</span>}
            </div>
          )}
          {renderWidget(item.id)}
          {editable && (
            <div
              onPointerDown={onResizePointerDown(item.id, item.colSpan)}
              title={t("grid.resize")}
              className="absolute right-0 top-0 h-full w-2 cursor-ew-resize"
            />
          )}
        </section>
      ))}
    </div>
  );
}
