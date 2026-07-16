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
export function Sidebar({ children, content, side = "left", collapsible, defaultCollapsed = false, widthClassName = "w-64", className }: SidebarProps) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);
  const aside = (
    <aside className={cn("flex-shrink-0 transition-all", collapsed ? "w-0 overflow-hidden" : widthClassName)}>
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
