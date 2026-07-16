"use client";
/**
 * ChartCard。任意のチャートを枠で囲み、CSV / PNG エクスポートのツールバーを付ける。
 * @packageDocumentation
 */
import * as React from "react";
import { Download, Image as ImageIcon } from "lucide-react";
import { downloadCsv, type CsvColumn } from "@platform/csv";
import { cn } from "../../lib/cn";
import { elementToPng } from "../../lib/export-image";

/** {@link ChartCard} の props。 */
export interface ChartCardProps {
  title?: string;
  /** CSV 出力用データ(渡すと CSV ボタンを表示)。 */
  data?: Record<string, unknown>[];
  /** CSV の列(ヘッダ名指定)。 */
  csvColumns?: CsvColumn[];
  /** 出力ファイル名の基本(拡張子なし、既定 "chart")。 */
  filename?: string;
  /** エクスポートツールバーを表示(既定 true)。 */
  exportable?: boolean;
  children: React.ReactNode;
  className?: string;
}

/** グラフをカードで囲み、CSV/PNG エクスポートを付けるコンテナ。 */
export function ChartCard({ title, data, csvColumns, filename = "chart", exportable = true, children, className }: ChartCardProps) {
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const iconBtn = "flex h-7 w-7 items-center justify-center rounded-[calc(var(--radius)-2px)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]";
  return (
    <div className={cn("rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4", className)}>
      {(title || exportable) && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--color-fg)]">{title}</h3>
          {exportable && (
            <div className="flex gap-1">
              {data && data.length > 0 && (
                <button type="button" className={iconBtn} title="CSVで出力"
                  onClick={() => downloadCsv(`${filename}.csv`, data, csvColumns ? { columns: csvColumns } : undefined)}>
                  <Download className="h-4 w-4" />
                </button>
              )}
              <button type="button" className={iconBtn} title="PNG画像で出力"
                onClick={() => bodyRef.current && void elementToPng(bodyRef.current, `${filename}.png`)}>
                <ImageIcon className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
      <div ref={bodyRef}>{children}</div>
    </div>
  );
}
