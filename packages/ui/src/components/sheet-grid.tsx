"use client";
/**
 * Excel ライクな表示専用シート。ヘッダ・フッタ・左列固定、縦横スクロール、列リサイズ、
 * 行仮想化・列仮想化(大量行/列)に対応。セルをドラッグで範囲選択し Ctrl/Cmd+C で TSV コピー。
 * cellError で不正セルを強調できる(取り込み検証と併用)。編集は不可。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";
import { useI18n } from "./i18n-provider";
import {
  normalizeCellRange, inRange, rangeToTsv, stickyLeftOffsets, applyColumnResize,
  computeVisibleRange, computeVisibleColumns, type CellRange,
} from "../lib/grid";

/** 列定義。 */
export interface SheetColumn<T> {
  key: string;
  header: React.ReactNode;
  width?: number;
  align?: "left" | "right" | "center";
  render?: (row: T) => React.ReactNode;
  /** ロケール連動の整形。render 未指定時に適用。 */
  format?: "currency" | "number" | "date";
  /** currency 時の通貨コード(既定 JPY)。 */
  currency?: string;
  footer?: React.ReactNode;
}

/** {@link SheetGrid} の props。 */
export interface SheetGridProps<T extends Record<string, unknown>> {
  rows: T[];
  columns: SheetColumn<T>[];
  freezeLeft?: number;
  stickyHeader?: boolean;
  showFooter?: boolean;
  height?: number;
  width?: number;
  resizable?: boolean;
  /** 行仮想化(大量行)。 */
  virtualized?: boolean;
  rowHeight?: number;
  /** 列仮想化(大量列)。表示幅 width を指定するとより正確。 */
  virtualizeColumns?: boolean;
  /** 不正セルの強調。メッセージを返すと赤くする。 */
  cellError?: (rowIndex: number, key: string) => string | null;
  className?: string;
}

/** 表示専用のシートグリッド。 */
export function SheetGrid<T extends Record<string, unknown>>({
  rows, columns, freezeLeft = 0, stickyHeader = true, showFooter = false, height = 420, width,
  resizable = true, virtualized = false, rowHeight = 32, virtualizeColumns = false, cellError, className,
}: SheetGridProps<T>) {
  const i18n = useI18n();
  const t = i18n.t;
  const [widths, setWidths] = React.useState<number[]>(() => columns.map((c) => c.width ?? 120));
  React.useEffect(() => { setWidths(columns.map((c) => c.width ?? 120)); }, [columns]);
  const lefts = stickyLeftOffsets(widths, freezeLeft);
  const keys = columns.map((c) => c.key);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // 範囲選択
  const [range, setRange] = React.useState<CellRange | null>(null);
  const anchor = React.useRef<{ row: number; col: number } | null>(null);
  const dragging = React.useRef(false);
  const onCellDown = (row: number, col: number) => (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).dataset.resizer) return;
    e.preventDefault(); anchor.current = { row, col }; dragging.current = true;
    setRange(normalizeCellRange({ row, col }, { row, col }));
  };
  const onCellEnter = (row: number, col: number) => () => {
    if (dragging.current && anchor.current) setRange(normalizeCellRange(anchor.current, { row, col }));
  };
  React.useEffect(() => {
    const up = () => { dragging.current = false; };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);
  const onCopy = (e: React.ClipboardEvent) => {
    if (!range) return;
    e.preventDefault();
    e.clipboardData.setData("text/plain", rangeToTsv(rows, keys, range));
  };

  // 列リサイズ
  const startResize = (index: number) => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX; const startW = widths[index] ?? 120;
    const onMove = (ev: PointerEvent) => setWidths((w) => applyColumnResize(w, index, (ev.clientX - startX) - ((w[index] ?? 120) - startW)));
    const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
  };

  // スクロール(行/列 仮想化)
  const [scroll, setScroll] = React.useState({ top: 0, left: 0 });
  const headerH = stickyHeader ? rowHeight : 0;
  const vr = virtualized
    ? computeVisibleRange(scroll.top, rowHeight, height - headerH, rows.length)
    : { start: 0, end: rows.length, topPad: 0, bottomPad: 0 };
  const visibleRows = virtualized ? rows.slice(vr.start, vr.end) : rows;

  const viewportW = width ?? 800;
  const vc = virtualizeColumns
    ? computeVisibleColumns(scroll.left, widths, viewportW, freezeLeft)
    : { start: freezeLeft, end: columns.length - 1, leftPad: 0, rightPad: 0 };
  // 描画する列 index の並び: 固定列 + (leftPad) + 可視列 + (rightPad)
  const frozenCols = columns.slice(0, freezeLeft).map((_c, i) => i);
  const midCols = virtualizeColumns ? [] : columns.map((_c, i) => i).slice(freezeLeft);
  const winCols = virtualizeColumns ? Array.from({ length: Math.max(0, vc.end - vc.start + 1) }, (_v, i) => vc.start + i) : [];
  const drawCols = virtualizeColumns ? [...frozenCols, ...winCols] : [...frozenCols, ...midCols];

  const cellCls = (align?: string) => cn("border-b border-r border-[var(--color-border)] px-2 py-1 whitespace-nowrap tabular-nums",
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left");
  const formatCell = (col: SheetColumn<T>, row: T): React.ReactNode => {
    if (col.render) return col.render(row);
    const v = row[col.key];
    if (v == null || v === "") return "";
    if (col.format === "currency") return i18n.currency(Number(v), col.currency ?? "JPY");
    if (col.format === "number") return i18n.n(Number(v));
    if (col.format === "date") return i18n.date(v as string | number);
    return String(v);
  };
  const stickyCol = (c: number): React.CSSProperties =>
    c < freezeLeft ? { position: "sticky", left: lefts[c] ?? 0, zIndex: 2, background: "var(--color-bg)" } : {};

  const renderHeaderCell = (c: number) => {
    const col = columns[c]!;
    return (
      <th key={col.key} className={cn(cellCls(col.align), "relative bg-[var(--color-muted)]/10 font-semibold")}
        style={{ width: widths[c], minWidth: widths[c], height: rowHeight, ...(stickyHeader ? { position: "sticky", top: 0, zIndex: c < freezeLeft ? 4 : 3 } : {}), ...stickyCol(c), ...(c < freezeLeft && stickyHeader ? { left: lefts[c] ?? 0 } : {}) }}>
        {col.header}
        {resizable && <span data-resizer="1" onPointerDown={startResize(c)} title={t("grid.resize")} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-[var(--color-primary)]/40" />}
      </th>
    );
  };
  const spacerCell = (w: number, key: string) => (w > 0 ? <td key={key} style={{ width: w, minWidth: w }} className="border-b border-[var(--color-border)] p-0" /> : null);

  return (
    <div ref={containerRef} className={cn("overflow-auto rounded-[var(--radius)] border border-[var(--color-border)]", className)}
      style={{ maxHeight: height, maxWidth: width }} tabIndex={0} onCopy={onCopy}
      onScroll={(virtualized || virtualizeColumns) ? (e: React.UIEvent<HTMLDivElement>) => setScroll({ top: (e.currentTarget as HTMLElement).scrollTop, left: (e.currentTarget as HTMLElement).scrollLeft }) : undefined}>
      <table className="border-collapse text-sm select-none" style={{ minWidth: widths.reduce((a, b) => a + b, 0) }}>
        <thead>
          <tr>
            {frozenCols.map(renderHeaderCell)}
            {spacerCell(vc.leftPad, "h-lpad")}
            {(virtualizeColumns ? winCols : midCols).map(renderHeaderCell)}
            {spacerCell(vc.rightPad, "h-rpad")}
          </tr>
        </thead>
        <tbody>
          {virtualized && vr.topPad > 0 && <tr style={{ height: vr.topPad }}><td colSpan={drawCols.length + 2} /></tr>}
          {visibleRows.map((row, i) => {
            const r = virtualized ? vr.start + i : i;
            const renderBodyCell = (c: number) => {
              const col = columns[c]!;
              const errMsg = cellError?.(r, col.key) ?? null;
              return (
                <td key={col.key} onPointerDown={onCellDown(r, c)} onPointerEnter={onCellEnter(r, c)} title={errMsg ?? undefined}
                  className={cn(cellCls(col.align), range && inRange(range, r, c) && "bg-[var(--color-primary)]/15", errMsg && "bg-[var(--color-danger)]/15 outline outline-1 outline-[var(--color-danger)]")}
                  style={{ width: widths[c], minWidth: widths[c], ...stickyCol(c) }}>
                  {formatCell(col, row)}
                </td>
              );
            };
            return (
              <tr key={r} style={virtualized ? { height: rowHeight } : undefined}>
                {frozenCols.map(renderBodyCell)}
                {spacerCell(vc.leftPad, `lpad-${r}`)}
                {(virtualizeColumns ? winCols : midCols).map(renderBodyCell)}
                {spacerCell(vc.rightPad, `rpad-${r}`)}
              </tr>
            );
          })}
          {virtualized && vr.bottomPad > 0 && <tr style={{ height: vr.bottomPad }}><td colSpan={drawCols.length + 2} /></tr>}
        </tbody>
        {showFooter && (
          <tfoot>
            <tr>
              {frozenCols.map((c) => renderFooterCell(columns[c]!, c, widths, lefts, freezeLeft, cellCls, stickyCol))}
              {spacerCell(vc.leftPad, "f-lpad")}
              {(virtualizeColumns ? winCols : midCols).map((c) => renderFooterCell(columns[c]!, c, widths, lefts, freezeLeft, cellCls, stickyCol))}
              {spacerCell(vc.rightPad, "f-rpad")}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function renderFooterCell<T>(col: SheetColumn<T>, c: number, widths: number[], lefts: number[], freezeLeft: number, cellCls: (a?: string) => string, stickyCol: (c: number) => React.CSSProperties) {
  return (
    <td key={col.key} className={cn(cellCls(col.align), "bg-[var(--color-muted)]/10 font-semibold")}
      style={{ width: widths[c], minWidth: widths[c], position: "sticky", bottom: 0, zIndex: c < freezeLeft ? 4 : 3, ...stickyCol(c), ...(c < freezeLeft ? { left: lefts[c] ?? 0 } : {}) }}>
      {col.footer ?? ""}
    </td>
  );
}
