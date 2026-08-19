"use client";
/**
 * 画面の枠。見出し・説明・操作ボタンと本文をまとめる。
 *
 * 【なぜ要るか】
 * 画面ごとに `max-w-2xl` `max-w-3xl` `max-w-4xl` … と幅がバラバラで、
 * **移動するたびに本文の位置が動いていた**(2026-08 に 6 種類あった)。
 * 見出しの大きさや余白も揃っていない。
 *
 * ここに寄せると、画面を足すときに迷わなくなる。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

/** 画面の広さ。 */
export type PageWidth = "narrow" | "normal" | "wide" | "full";

/**
 * 広さの対応表。
 *
 * **3 種類に絞る。** 細かく刻んでも読み手が選べない。
 * - `narrow`: フォーム 1 つの画面(設定・ログインなど)
 * - `normal`: 一覧や詳細(既定)
 * - `wide`: 表が横に広い画面(会計・レポート)
 * - `full`: 画面いっぱい(ダッシュボード・チャット)
 */
const WIDTHS: Record<PageWidth, string> = {
  narrow: "max-w-xl",
  normal: "max-w-3xl",
  wide: "max-w-6xl",
  full: "max-w-none",
};

/** {@link PageShell} の props。 */
export interface PageShellProps {
  /** 画面の名前。**h1 はここだけ**(1 画面に 1 つ)。 */
  title: React.ReactNode;
  /** 何をする画面かの一言。 */
  description?: React.ReactNode;
  /** 右上に置く操作(新規作成など)。 */
  actions?: React.ReactNode;
  width?: PageWidth;
  children: React.ReactNode;
  className?: string;
}

/**
 * 画面の枠。
 *
 * @param title 画面の名前
 * @returns 見出しと本文をまとめた要素
 */
export function PageShell({
  title, description, actions, width = "normal", children, className,
}: PageShellProps) {
  return (
    <div className={cn("mx-auto w-full px-4 py-6 sm:px-6", WIDTHS[width], className)}>
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-xl font-semibold text-[var(--color-fg)]">{title}</h1>
          {/* **操作は右上。** 一覧の下に置くと、長い画面でたどり着けない */}
          {actions !== undefined && <div className="flex shrink-0 gap-2">{actions}</div>}
        </div>
        {description !== undefined && (
          <p className="mt-1 text-sm text-[var(--color-muted)]">{description}</p>
        )}
      </header>
      {children}
    </div>
  );
}
