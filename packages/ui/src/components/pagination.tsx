"use client";
/**
 * 共通 Pagination。ページ番号 + 前後移動(省略記号対応)。
 * @packageDocumentation
 */
import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/cn.js";
import { useT } from "./i18n-provider.js";

/** {@link Pagination} の props。 */
export interface PaginationProps {
  /** 現在ページ(1 始まり)。 */
  page: number;
  /** 総ページ数。 */
  totalPages: number;
  /** ページ変更時。 */
  onPageChange: (page: number) => void;
  className?: string;
}

function pageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_v, i) => i + 1);
  const set = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const n of sorted) {
    if (n - prev > 1) out.push("…");
    out.push(n);
    prev = n;
  }
  return out;
}

/** ページネーション。 */
export function Pagination({ page, totalPages, onPageChange, className }: PaginationProps) {
  const t = useT();
  const cellClass = "flex h-8 min-w-8 items-center justify-center rounded-[calc(var(--radius)-2px)] border border-[var(--color-border)] px-2 text-sm disabled:opacity-40";
  return (
    <nav className={cn("flex items-center gap-1", className)} aria-label={t("pagination.nav")}>
      <button type="button" className={cellClass} disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label={t("pagination.prev")}>
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pageList(page, totalPages).map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="px-1 text-[var(--color-muted)]">…</span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(cellClass, p === page && "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-fg)]")}
          >
            {p}
          </button>
        ),
      )}
      <button type="button" className={cellClass} disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label={t("pagination.next")}>
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}

/** {@link SimplePagination} の props。 */
export interface SimplePaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/** 前後移動と「現在 / 総数」だけのシンプルなページネーション。 */
export function SimplePagination({ page, totalPages, onPageChange, className }: SimplePaginationProps) {
  const t = useT();
  const btn = "flex h-8 items-center gap-1 rounded-[calc(var(--radius)-2px)] border border-[var(--color-border)] px-3 text-sm disabled:opacity-40";
  return (
    <nav className={cn("flex items-center justify-between gap-2", className)} aria-label={t("pagination.nav")}>
      <button type="button" className={btn} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        <ChevronLeft className="h-4 w-4" />前へ
      </button>
      <span className="text-sm text-[var(--color-muted)]">{page} / {totalPages}</span>
      <button type="button" className={btn} disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        次へ<ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}
