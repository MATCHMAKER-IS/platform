"use client";
/** 横断検索（コマンドパレット）。⌘K / Ctrl+K で開き、全デモをキーワード検索して移動する。 */
import * as React from "react";
import { Button, Input } from "@platform/ui";
import { useRouter } from "next/navigation";
import { allDemos } from "../lib/nav";

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [idx, setIdx] = React.useState(0);
  const [narrow, setNarrow] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const demos = React.useMemo(() => allDemos(), []);
  React.useEffect(() => { const check = () => setNarrow(window.innerWidth < 640); check(); window.addEventListener("resize", check); return () => window.removeEventListener("resize", check); }, []);
  const results = React.useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = t ? demos.filter((d) => `${d.title} ${d.desc} ${d.href}`.toLowerCase().includes(t)) : demos;
    return list.slice(0, 12);
  }, [q, demos]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) { e.preventDefault(); setOpen((o) => !o); setQ(""); setIdx(0); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  React.useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 20); }, [open]);
  React.useEffect(() => { setIdx(0); }, [q]);

  const go = (href: string) => { setOpen(false); router.push(href); };
  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
    else if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(results.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter" && results[idx]) go(results[idx]!.href);
  };

  return (
    <>
      <Button type="button" onClick={() => { setOpen(true); setQ(""); }} title="検索 (⌘K)"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "4px 10px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-muted)" }}>
        🔍{narrow ? "" : <> 検索 <kbd style={{ fontSize: 10, border: "1px solid var(--color-border)", borderRadius: 4, padding: "0 4px" }}>⌘K</kbd></>}
      </Button>
      {open && (
        <div role="presentation" onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "12vh", padding: "12vh 16px 16px" }}>
          <div role="dialog" aria-modal="true" aria-label="デモを検索" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 12, boxShadow: "0 20px 60px rgba(0,0,0,0.35)", overflow: "hidden" }}>
            <Input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onInputKey} placeholder="デモを検索…（例: カレンダー, CSV, 承認）"
              style={{ width: "100%", padding: "14px 16px", fontSize: 15, border: "none", borderBottom: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-fg)", outline: "none", boxSizing: "border-box" }} />
            <ul style={{ listStyle: "none", margin: 0, padding: 6, maxHeight: 360, overflowY: "auto" }}>
              {results.length === 0 && <li style={{ padding: 16, fontSize: 13, color: "var(--color-muted)", textAlign: "center" }}>該当なし</li>}
              {results.map((d, i) => (
                <li key={d.href}>
                  <Button type="button" onClick={() => go(d.href)} onMouseEnter={() => setIdx(i)}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 8, border: "none", cursor: "pointer", background: i === idx ? "var(--color-primary)" : "transparent", color: i === idx ? "var(--color-primary-fg)" : "var(--color-fg)" }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{d.title}</div>
                    <div style={{ fontSize: 11.5, opacity: 0.75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.href} · {d.desc}</div>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
