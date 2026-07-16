"use client";
/**
 * 取り込みレビュー。行を編集でき、型/必須/重複を即時再検証。エラー行だけの絞り込み表示に対応。
 * すべてのエラーが解消したら確定できる。
 * @packageDocumentation
 */
import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "../lib/cn";
import { validateImportRows, cellErrorLookup, errorRowIndices, validRows, type ImportField } from "../lib/import-validate";
import { Input } from "./input";
import { Button } from "./button";
import { Badge } from "./badge";
import { useT } from "./i18n-provider";

/** {@link ImportReview} の props。 */
export interface ImportReviewProps {
  rows: Record<string, string>[];
  fields: (ImportField & { label?: string })[];
  /** すべて妥当になったら確定できる。 */
  onConfirm?: (rows: Record<string, string>[]) => void;
  /** エラー行を除いて有効行だけ保存する(部分保存)。 */
  onPartialConfirm?: (rows: Record<string, string>[]) => void;
  className?: string;
}

/** 取り込み行の確認・修正・再検証コンポーネント。 */
export function ImportReview({ rows: initial, fields, onConfirm, onPartialConfirm, className }: ImportReviewProps) {
  const t = useT();
  const [rows, setRows] = React.useState<Record<string, string>[]>(initial);
  const [errorsOnly, setErrorsOnly] = React.useState(false);
  React.useEffect(() => setRows(initial), [initial]);

  const validation = React.useMemo(() => validateImportRows(rows, fields), [rows, fields]);
  const cellError = React.useMemo(() => cellErrorLookup(validation), [validation]);
  const errIdx = React.useMemo(() => new Set(errorRowIndices(validation)), [validation]);
  const visible = rows.map((row, index) => ({ row, index })).filter((x) => !errorsOnly || errIdx.has(x.index));

  const edit = (index: number, key: string, value: string) =>
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, [key]: value } : r)));

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center gap-2">
        <Badge variant={validation.valid ? "success" : "danger"}>
          {validation.valid ? t("import.valid") : t("import.errorSummary", { errors: validation.errorCount, rows: errIdx.size })}
        </Badge>
        <label className="ml-auto flex items-center gap-1 text-sm">
          <input type="checkbox" checked={errorsOnly} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setErrorsOnly(e.target.checked)} disabled={errIdx.size === 0} />
          {t("import.errorsOnly")}
        </label>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[var(--color-muted)]/10">
              <th className="px-2 py-1 text-left font-semibold">#</th>
              {fields.map((f) => <th key={f.key} className="px-2 py-1 text-left font-semibold">{f.label ?? f.key}{f.required && <span className="text-[var(--color-danger)]">*</span>}</th>)}
            </tr>
          </thead>
          <tbody>
            {visible.map(({ row, index }) => (
              <tr key={index} className="border-t border-[var(--color-border)]">
                <td className="px-2 py-1 text-[var(--color-muted)]">{index + 1}</td>
                {fields.map((f) => {
                  const err = cellError(index, f.key);
                  return (
                    <td key={f.key} className="px-1 py-1">
                      <Input value={row[f.key] ?? ""} title={err ?? undefined}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => edit(index, f.key, e.target.value)}
                        className={cn("h-8", err && "border-[var(--color-danger)] bg-[var(--color-danger)]/10")} />
                      {err && <div className="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-danger)]"><AlertTriangle className="h-3 w-3" />{err}</div>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        {onConfirm && (
          <Button disabled={!validation.valid} onClick={() => onConfirm(rows)}>
            {t("import.confirmN", { count: rows.length })}
          </Button>
        )}
        {onPartialConfirm && !validation.valid && (
          <Button variant="secondary" onClick={() => onPartialConfirm(validRows(rows, validation))}>
            {t("import.partialSaveN", { count: rows.length - errIdx.size })}
          </Button>
        )}
      </div>
    </div>
  );
}
