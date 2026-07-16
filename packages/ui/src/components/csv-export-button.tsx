"use client";
/** CSV エクスポートボタン。データを CSV でダウンロードする(@platform/csv)。 @packageDocumentation */
import { Download } from "lucide-react";
import { downloadCsv, type CsvColumn } from "@platform/csv";
import { Button, type ButtonProps } from "./button";

/** {@link CsvExportButton} の props。 */
export interface CsvExportButtonProps extends Omit<ButtonProps, "onClick"> {
  /** 出力する行データ。 */
  rows: Record<string, unknown>[];
  /** ファイル名(既定 "export.csv")。 */
  filename?: string;
  /** 出力列(ヘッダ名指定)。 */
  columns?: CsvColumn[];
}

/** クリックで CSV をダウンロードするボタン(Excel 用に BOM 付き)。 */
export function CsvExportButton({ rows, filename = "export.csv", columns, children, ...props }: CsvExportButtonProps) {
  return (
    <Button onClick={() => downloadCsv(filename, rows, columns ? { columns } : undefined)} {...props}>
      <Download className="mr-2 h-4 w-4" />
      {children ?? "CSV出力"}
    </Button>
  );
}
