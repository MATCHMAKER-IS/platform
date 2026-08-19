"use client";
/**
 * ライト / ダークモードの切り替えボタン。
 *
 * @platform/ui の SkinContext（useSkin）で公開された mode / setMode を使う。
 * 既定では OS のダーク設定に追従するが、このボタンで手動に切り替えられる。
 */
import * as React from "react";
import { Button, useSkin } from "@platform/ui";

export function ModeToggle() {
  const { mode, setMode } = useSkin();
  const isDark = mode === "dark";
  return (
    <Button
      type="button"
      onClick={() => setMode(isDark ? "light" : "dark")}
      aria-label={isDark ? "ライトモードにする" : "ダークモードにする"}
      title={isDark ? "ライトモードにする" : "ダークモードにする"}
      style={{
        width: 30,
        height: 30,
        borderRadius: 6,
        cursor: "pointer",
        border: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        color: "var(--color-fg)",
        fontSize: 15,
        lineHeight: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {isDark ? "☀" : "🌙"}
    </Button>
  );
}
