"use client";
/**
 * 各デモページの上部に「概要」と「使用パッケージ」を出す小さなバー。
 *
 * nav.ts の 1 か所（desc / packages）を情報源に、現在地の URL から自動で引く。
 * ページ側の h1・本文とは別に、どのページでも同じ位置に統一表示される。
 */
import * as React from "react";
import { usePathname } from "next/navigation";
import { allDemos } from "../lib/nav";

const chip: React.CSSProperties = {
  fontSize: 11,
  fontFamily: "monospace",
  color: "var(--color-primary)",
  border: "1px solid var(--color-border)",
  borderRadius: 999,
  padding: "1px 8px",
  whiteSpace: "nowrap",
};

export function DemoMeta() {
  const pathname = usePathname() ?? "/";
  const demo = allDemos().find((d) => d.href === pathname);
  if (!demo) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", minWidth: 0, flex: 1 }}>
      <span style={{ fontSize: 11, color: "var(--color-muted)" }}>使用パッケージ:</span>
      {demo.packages.map((p) => (
        <span key={p} style={chip}>@platform/{p}</span>
      ))}
    </div>
  );
}
