"use client";
/**
 * 左メニューを開閉できるラッパー。
 *
 * 常に見えるトグルボタンで、サイドバーを引っ込めたり再表示したりできる。
 * 画面が狭いとき・本文に集中したいときに畳める。
 */
import * as React from "react";
import { Button } from "@platform/ui";
import { DemoSidebar } from "./demo-sidebar";

export function CollapsibleSidebar() {
  const [collapsed, setCollapsed] = React.useState(false);
  // 画面が狭い端末では初期状態で畳んでおく（本文の可読性を優先）
  React.useEffect(() => { if (typeof window !== "undefined" && window.innerWidth < 768) setCollapsed(true); }, []);

  return (
    <>
      <Button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "メニューを開く" : "メニューを閉じる"}
        title={collapsed ? "メニューを開く" : "メニューを閉じる"}
        style={{
          position: "fixed",
          top: 8,
          left: 8,
          zIndex: 30,
          width: 30,
          height: 30,
          borderRadius: 6,
          cursor: "pointer",
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          color: "var(--color-fg)",
          fontSize: 14,
          lineHeight: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {collapsed ? "☰" : "◀"}
      </Button>

      <aside
        style={{
          width: collapsed ? 0 : 240,
          flexShrink: 0,
          borderRight: collapsed ? "none" : "1px solid var(--color-border)",
          background: "var(--color-surface)",
          overflowY: "auto",
          overflowX: "hidden",
          maxHeight: "100vh",
          position: "sticky",
          top: 0,
          transition: "width .18s ease",
        }}
      >
        {!collapsed && (
          <div style={{ paddingTop: 36 }}>
            <DemoSidebar />
          </div>
        )}
      </aside>
    </>
  );
}
