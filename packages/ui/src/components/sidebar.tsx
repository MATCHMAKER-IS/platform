"use client";
/**
 * サイドバー付きレイアウト。折りたたみ可能なサイドバーと本文の 2 カラム。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

/** {@link Sidebar} の props。 */
export interface SidebarProps {
  /** サイドバーの中身。 */
  children: React.ReactNode;
  /** 本文。 */
  content: React.ReactNode;
  /** 配置（既定 left）。 */
  side?: "left" | "right";
  /** 折りたたみ可能にする。 */
  collapsible?: boolean;
  /** 初期折りたたみ状態。 */
  defaultCollapsed?: boolean;
  /** サイドバー幅（Tailwind、既定 w-64）。 */
  widthClassName?: string;
  className?: string;
}

/** サイドバー付きレイアウト。 */
/**
 * 横の案内(画面の一覧)。
 *
 * 項目が多いなら分類でまとめる。**現在いる場所を必ず示す**
 * (どこにいるか分からないと、戻る操作ができない)。
 * 権限で見せない項目は、灰色にせず**消す**(あることが分かると問い合わせが増える)。
 */
export function Sidebar({ children, content, side = "left", collapsible, defaultCollapsed = false, widthClassName = "w-64", className }: SidebarProps) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);
  const aside = (
    <aside
      className={cn("flex-shrink-0 transition-all", collapsed ? "w-0 overflow-hidden" : widthClassName)}
      // テーマが sidebarBg を持つときだけ色が変わる。
      // 持たないテーマでは surface(これまでと同じ)になる
      style={{
        background: "var(--color-sidebar-bg, var(--color-surface))",
        color: "var(--color-sidebar-fg, var(--color-fg))",
        // 中の NavMenu が参照する既定値。テーマが sidebarActiveBg を持たない場合は
        // 背景をわずかに明るくした色にする(濃色テーマでも選択中が読める)
        ["--color-nav-active-bg" as string]: "color-mix(in srgb, currentColor 12%, transparent)",
      }}
    >
      <div className="p-4">{children}</div>
    </aside>
  );
  const main = <main className="min-w-0 flex-1 p-4">{content}</main>;
  return (
    <div className={cn("flex", className)}>
      {side === "left" ? aside : main}
      {collapsible && (
        <button
          aria-label={collapsed ? "サイドバーを開く" : "サイドバーを閉じる"}
          onClick={() => setCollapsed((c) => !c)}
          className="self-start p-2 text-[var(--color-muted)] hover:text-[var(--color-fg)]"
        >
          {side === "left" ? (collapsed ? "»" : "«") : (collapsed ? "«" : "»")}
        </button>
      )}
      {side === "left" ? main : aside}
    </div>
  );
}
