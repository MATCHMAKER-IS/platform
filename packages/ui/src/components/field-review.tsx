"use client";
/**
 * OCR 抽出フィールドの確認 UI。信頼度が低い項目を強調し、その場で修正・確定できる。
 * @packageDocumentation
 */
import * as React from "react";
import { AlertTriangle, Check } from "lucide-react";
import { cn } from "../lib/cn.js";
import { useT } from "./i18n-provider.js";
import { needsReview, type ReviewField } from "../lib/field-review.js";
import { Input } from "./input.js";
import { Badge } from "./badge.js";
import { Button } from "./button.js";

/** {@link FieldReview} の props。 */
export interface FieldReviewProps {
  fields: ReviewField[];
  /** {t("ocr.needsReview")}とする信頼度のしきい値(既定 70)。 */
  threshold?: number;
  /** 確定時に編集後の値(key→value)を返す。 */
  onConfirm?: (values: Record<string, string>) => void;
  className?: string;
}

/** 抽出フィールドの確認・修正 UI。低信頼度の項目に警告を出す。 */
export function FieldReview({ fields, threshold = 70, onConfirm, className }: FieldReviewProps) {
  const t = useT();
  const [values, setValues] = React.useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, f.value])));
  const reviewCount = fields.filter((f) => needsReview(f.confidence, threshold)).length;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {reviewCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4" />
          {reviewCount} 件は読み取り信頼度が低いため確認してください。
        </div>
      )}
      {fields.map((f) => {
        const warn = needsReview(f.confidence, threshold);
        return (
          <div key={f.key} className={cn("rounded-[var(--radius)] border p-3", warn ? "border-amber-400 bg-amber-50/50" : "border-[var(--color-border)]")}>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium text-[var(--color-fg)]">{f.label}</label>
              {f.confidence != null && (
                <Badge variant={warn ? "warning" : "success"}>{warn ? t("ocr.needsReview") : "OK"} {Math.round(f.confidence)}%</Badge>
              )}
            </div>
            <Input value={values[f.key] ?? ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
          </div>
        );
      })}
      {onConfirm && (
        <Button onClick={() => onConfirm(values)} className="self-start">
          <Check className="mr-2 h-4 w-4" />確定
        </Button>
      )}
    </div>
  );
}
