"use client";
/**
 * OCR フィードバックの集計ダッシュボード。フィールド別の修正率・平均信頼度を表示する。
 * @packageDocumentation
 */
import { cn } from "../lib/cn.js";
import { aggregateOcrFeedback, type OcrFeedback } from "../lib/ocr-feedback.js";
import { Badge } from "./badge.js";

/** {@link OcrFeedbackDashboard} の props。 */
export interface OcrFeedbackDashboardProps {
  feedbacks: OcrFeedback[];
  /** フィールド表示名。 */
  labelOf?: (field: string) => string;
  className?: string;
}

/** OCR フィードバック集計ダッシュボード。 */
export function OcrFeedbackDashboard({ feedbacks, labelOf, className }: OcrFeedbackDashboardProps) {
  const agg = aggregateOcrFeedback(feedbacks);
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const max = Math.max(1, ...agg.byField.map((f) => f.corrections));

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap gap-3">
        <Kpi label="対象ドキュメント" value={String(agg.totalDocs)} />
        <Kpi label="受入率" value={pct(agg.acceptanceRate)} />
        <Kpi label="総修正数" value={String(agg.totalCorrections)} />
      </div>
      <div>
        <div className="mb-2 text-sm font-semibold">フィールド別の修正回数 / 修正率</div>
        <div className="flex flex-col gap-1">
          {agg.byField.length === 0 && <p className="text-sm text-[var(--color-muted)]">修正はありません(すべて正しく抽出)。</p>}
          {agg.byField.map((f) => (
            <div key={f.field} className="flex items-center gap-2 text-sm">
              <span className="w-28 shrink-0 truncate">{labelOf?.(f.field) ?? f.field}</span>
              <div className="h-4 flex-1 rounded bg-[var(--color-muted)]/10">
                <div className="h-4 rounded bg-[var(--color-primary)]/60" style={{ width: `${(f.corrections / max) * 100}%` }} />
              </div>
              <span className="w-10 text-right tabular-nums">{f.corrections}</span>
              <Badge variant={f.correctionRate > 0.5 ? "danger" : f.correctionRate > 0.2 ? "warning" : "secondary"}>{pct(f.correctionRate)}</Badge>
              {f.avgConfidence != null && <span className="w-16 text-right text-xs text-[var(--color-muted)]">信頼度{f.avgConfidence}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] px-4 py-2">
      <div className="text-xs text-[var(--color-muted)]">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}
