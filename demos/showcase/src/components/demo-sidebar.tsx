"use client";
/**
 * 統合デモサイトの共通ナビ。
 *
 * **区分ごとに折りたたむ**ので、1 サイトでも「基盤デモ」「アプリデモ」が
 * 別物として見える。現在地の区分は自動で開く(畳まれたままだと、
 * 自分がどこにいるか分からない)。
 */
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SECTIONS } from "../lib/nav.js";

export function DemoSidebar() {
  const pathname = usePathname() ?? "/";
  // 現在地の区分を開く(hasActiveChild 相当の判定)
  const activeSection = SECTIONS.findIndex((s) => s.items.some((i) => pathname === i.href));
  const [open, setOpen] = React.useState<number[]>(activeSection >= 0 ? [activeSection] : [0]);

  const toggle = (i: number) => setOpen((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));

  return (
    <nav style={{ padding: "12px 8px", fontSize: 13 }}>
      <Link
        href="/"
        style={{
          display: "block", padding: "8px 10px", marginBottom: 8, borderRadius: 6,
          fontWeight: 700, textDecoration: "none",
          color: pathname === "/" ? "var(--color-primary-fg, #fff)" : "var(--color-fg)",
          background: pathname === "/" ? "var(--color-primary)" : "transparent",
        }}
      >
        ホーム
      </Link>

      {SECTIONS.map((section, i) => {
        const isOpen = open.includes(i);
        return (
          <div key={section.title} style={{ marginBottom: 4 }}>
            <button
              onClick={() => toggle(i)}
              style={{
                display: "flex", alignItems: "center", gap: 6, width: "100%",
                padding: "6px 10px", border: "none", background: "none", cursor: "pointer",
                color: "var(--color-muted)", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
              }}
            >
              <span style={{ fontSize: 9 }}>{isOpen ? "▼" : "▶"}</span>
              {section.title}
              <span style={{ marginLeft: "auto", fontWeight: 400 }}>{section.items.length}</span>
            </button>

            {isOpen && (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {section.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        style={{
                          display: "block", padding: "5px 10px 5px 24px", borderRadius: 6,
                          textDecoration: "none", fontSize: 12.5,
                          color: active ? "var(--color-primary-fg, #fff)" : "var(--color-fg)",
                          background: active ? "var(--color-primary)" : "transparent",
                        }}
                      >
                        {item.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}
