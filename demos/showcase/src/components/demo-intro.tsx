"use client";
/**
 * 各デモページの先頭に出す「このデモでできること」バナー。
 *
 * overviews.ts の初心者向け概要を、現在地の URL から自動で引いて表示する。
 * 概要が未登録のページ（ホーム等）では何も出さない。
 */
import * as React from "react";
import { usePathname } from "next/navigation";
import { OVERVIEWS } from "../lib/overviews";

export function DemoIntro() {
  const pathname = usePathname() ?? "/";
  const overview = OVERVIEWS[pathname];
  if (!overview) return null;

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        margin: "16px 16px 0",
        padding: "10px 14px",
        borderRadius: "var(--radius)",
        border: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        borderLeft: "3px solid var(--color-primary)",
      }}
    >
      <span aria-hidden style={{ fontSize: 14, lineHeight: 1.6 }}>📘</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-primary)", marginBottom: 2 }}>
          このデモでできること
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.8, color: "var(--color-fg)" }}>{overview}</div>
      </div>
    </div>
  );
}
