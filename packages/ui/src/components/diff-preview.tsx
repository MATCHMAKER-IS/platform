"use client";
/**
 * 取り込み差分のプレビュー。追加・変更・削除・不変の件数と内容を表示する。
 * @packageDocumentation
 */
import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { useT } from "./i18n-provider";
import { Badge } from "./badge";
import type { RowDiff } from "../lib/diff";

/** {@link DiffPreview} の props。 */
export interface DiffPreviewProps<T extends Record<string, unknown>> {
  diff: RowDiff<T>;
  /** 行の表示ラベル。 */
  labelOf: (row: T) => string;
  className?: string;
}

/** 差分プレビュー。 */
export function DiffPreview<T extends Record<string, unknown>>({ diff, labelOf, className }: DiffPreviewProps<T>) {
  const t = useT();
  return (
    <div className={cn("flex flex-col gap-2 text-sm", className)}>
      <div className="flex flex-wrap gap-2">
        <Badge variant="success">{t("diff.added")} {diff.added.length}</Badge>
        <Badge variant="warning">{t("diff.changed")} {diff.changed.length}</Badge>
        <Badge variant="danger">{t("diff.removed")} {diff.removed.length}</Badge>
        <Badge variant="secondary">{t("diff.unchanged")} {diff.unchanged.length}</Badge>
      </div>
      {diff.added.length > 0 && <Section title={t("diff.added")} color="var(--color-success)">{diff.added.map((r, i) => <li key={i}>{labelOf(r)}</li>)}</Section>}
      {diff.changed.length > 0 && (
        <Section title={t("diff.changed")} color="var(--color-warning)">
          {diff.changed.map((c, i) => <li key={i}>{labelOf(c.after)} <span className="text-[var(--color-muted)]">({c.fields.join(", ")})</span></li>)}
        </Section>
      )}
      {diff.removed.length > 0 && <Section title={t("diff.removed")} color="var(--color-danger)">{diff.removed.map((r, i) => <li key={i}>{labelOf(r)}</li>)}</Section>}
    </div>
  );
}

function Section({ title, color, children }: { title: string; color: string; children: ReactNode }) {
  return (
    <div>
      <div className="font-semibold" style={{ color }}>{title}</div>
      <ul className="ml-4 list-disc">{children}</ul>
    </div>
  );
}
