"use client";
/**
 * ページヘッダー。ページ上部の見出し。パンくず・タイトル・説明・右側アクションを配置する。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

/** {@link PageHeader} の props。 */
export interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** ページタイトル。 */
  title: React.ReactNode;
  /** 補足説明。 */
  description?: React.ReactNode;
  /** 上部のパンくず(Breadcrumb 等)。 */
  breadcrumb?: React.ReactNode;
  /** 右側のアクション(ボタン等)。 */
  actions?: React.ReactNode;
}

/** ページ上部の見出しブロック。 */
/**
 * 画面の見出し(題名・説明・操作)。
 *
 * **その画面が何をする場所か**を最初に伝える。
 * 主要な操作(新規作成・書き出し)は右側に置くと、視線の流れに合う。
 */
export const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ title, description, breadcrumb, actions, className, ...props }, ref) => (
    <div ref={ref} className={cn("mb-6 flex flex-col gap-3", className)} {...props}>
      {breadcrumb != null && <div>{breadcrumb}</div>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-[var(--color-fg)]">{title}</h1>
          {description != null && <p className="mt-1 text-sm text-[var(--color-muted)]">{description}</p>}
        </div>
        {actions != null && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  ),
);
PageHeader.displayName = "PageHeader";
