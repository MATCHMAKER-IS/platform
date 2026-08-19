"use client";
/**
 * 共通 Pagination。ページ番号 + 前後移動(省略記号対応)。
 * @packageDocumentation
 */
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "../lib/cn";
import { useT } from "./i18n-provider";

/** {@link Pagination} の props。 */
export interface PaginationProps {
  /** 現在ページ(1 始まり)。 */
  page: number;
  /** 総ページ数。 */
  totalPages: number;
  /** ページ変更時。 */
  onPageChange: (page: number) => void;
  /**
   * 総件数。**渡すと「1〜20 件目 / 全 143 件」を出す**。
   *
   * **これが無いと、利用者は「あと何件あるか」が分からない**——
   * 「3 ページ目」だけでは、全部見たのか途中なのかが判断できません。
   * 絞り込みの結果が 0 件なのか、そもそもデータが無いのかも区別できません。
   */
  totalItems?: number;
  /** 1 ページの件数（`totalItems` と併せて「何件目」を計算する）。 */
  pageSize?: number;
  /**
   * 「最初へ」「最後へ」を出すか（既定 true）。
   *
   * **ページ数が多いときに効きます**——50 ページある一覧で最後を見るのに、
   * 「次へ」を 49 回押させないため。
   */
  showEdges?: boolean;
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

/**
 * 頁送り。
 *
 * `DataTable` を使っていれば自前で置く必要はない(内側に入っている)。
 * **自前で一覧を組んだとき**に使う。
 *
 * - 総頁数が分からない(次があるかだけ分かる)場合は `SimplePagination`
 * - 頁数が多いと番号が並びきらないので、この部品が自動で省略する
 * - 頁を変えたら**一覧の先頭へ戻す**こと(下の方を見たまま次頁に行くと迷子になる)
 *
 * @example
 * ```tsx
 * <Pagination page={page} totalPages={pageCount} onPageChange={(p) => { setPage(p); scrollTo(0, 0); }} />
 * ```
 */
export function Pagination({
  page, totalPages, onPageChange, totalItems, pageSize, showEdges = true, className,
}: PaginationProps) {
  const t = useT();
  // **「1〜20 件目 / 全 143 件」を組み立てる。**
  // `totalItems` が無ければ出さない(嘘の件数を出すより、出さない方がよい)
  const range = totalItems === undefined || pageSize === undefined || pageSize <= 0
    ? null
    : (() => {
        if (totalItems === 0) return t("pagination.empty");
        const from = (page - 1) * pageSize + 1;
        // **最後のページは端数になる。** `page * pageSize` をそのまま出すと
        // 「141〜160 件目 / 全 143 件」のように、ありもしない件数が出る
        const to = Math.min(page * pageSize, totalItems);
        return t("pagination.range", { from: String(from), to: String(to), total: String(totalItems) });
      })();
  const cellClass = "flex h-8 min-w-8 items-center justify-center rounded-[calc(var(--radius)-2px)] border border-[var(--color-border)] px-2 text-sm disabled:opacity-40";
  return (
    <nav className={cn("flex flex-wrap items-center gap-1", className)} aria-label={t("pagination.nav")}>
      {/* **件数を先に出す。** 「何件中の何件目か」が分かると、
          絞り込みが効いているか・まだ先があるかを判断できる */}
      {range !== null && (
        <span className="mr-2 text-sm text-[var(--color-muted)]" aria-live="polite">
          {range}
        </span>
      )}
      {showEdges && (
        <button
          type="button"
          className={cellClass}
          disabled={page <= 1}
          onClick={() => onPageChange(1)}
          aria-label={t("pagination.first")}
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>
      )}
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
      {showEdges && (
        <button
          type="button"
          className={cellClass}
          disabled={page >= totalPages}
          onClick={() => onPageChange(totalPages)}
          aria-label={t("pagination.last")}
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      )}
      {/* **「3 / 12 ページ」も出す。** 番号だけ並んでいると、
          いま何ページ目かは色で分かっても「全部で何ページか」が読み取りにくい */}
      <span className="ml-2 text-sm text-[var(--color-muted)]">
        {t("pagination.pageOf", { page: String(page), total: String(totalPages) })}
      </span>
    </nav>
  );
}

/** {@link SimplePagination} の props。 */
export interface SimplePaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** 総件数（渡すと「全 143 件」を併記する）。 */
  totalItems?: number;
  /** 1 ページの件数。 */
  pageSize?: number;
  /** 「最初へ」「最後へ」を出すか（既定 true）。 */
  showEdges?: boolean;
  className?: string;
}

/** 前後移動と「現在 / 総数」だけのシンプルなページネーション。 */
export function SimplePagination({
  page, totalPages, onPageChange, totalItems, pageSize, showEdges = true, className,
}: SimplePaginationProps) {
  const t = useT();
  const btn = "flex h-8 items-center gap-1 rounded-[calc(var(--radius)-2px)] border border-[var(--color-border)] px-3 text-sm disabled:opacity-40";
  const icon = "flex h-8 w-8 items-center justify-center rounded-[calc(var(--radius)-2px)] border border-[var(--color-border)] text-sm disabled:opacity-40";
  // **最後のページは端数になる。** `page * pageSize` をそのまま出すと
  // 「141〜160 件目 / 全 143 件」という、ありもしない件数が出る
  const range = totalItems === undefined || pageSize === undefined || pageSize <= 0
    ? null
    : totalItems === 0
      ? t("pagination.empty")
      : t("pagination.range", {
          from: String((page - 1) * pageSize + 1),
          to: String(Math.min(page * pageSize, totalItems)),
          total: String(totalItems),
        });
  return (
    <nav className={cn("flex items-center justify-between gap-2", className)} aria-label={t("pagination.nav")}>
      <div className="flex items-center gap-1">
        {showEdges && (
          <button type="button" className={icon} disabled={page <= 1}
            onClick={() => onPageChange(1)} aria-label={t("pagination.first")}>
            <ChevronsLeft className="h-4 w-4" />
          </button>
        )}
        <button type="button" className={btn} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" />前へ
        </button>
      </div>
      {/* **件数とページ数の両方を出す。** 「3 / 12」だけでは全体の量が分からず、
          件数だけでは「あと何回押すか」が分からない */}
      <span className="text-sm text-[var(--color-muted)]">
        {range !== null && <>{range}　</>}
        {t("pagination.pageOf", { page: String(page), total: String(totalPages) })}
      </span>
      <div className="flex items-center gap-1">
        <button type="button" className={btn} disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          次へ<ChevronRight className="h-4 w-4" />
        </button>
        {showEdges && (
          <button type="button" className={icon} disabled={page >= totalPages}
            onClick={() => onPageChange(totalPages)} aria-label={t("pagination.last")}>
            <ChevronsRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </nav>
  );
}
