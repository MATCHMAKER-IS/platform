"use client";
/** 横断検索（コマンドパレット）。⌘K / Ctrl+K で開き、全デモをキーワード検索して移動する。 */
import * as React from "react";
import { Button, Input } from "@platform/ui";
import { useRouter } from "next/navigation";
import { allDemos } from "../lib/nav";

/**
 * よく使われる言い回し → 基盤の名前。
 *
 * 利用者は正式名で覚えていない（「エクセル」で csv/xlsx を探す）。
 * 数を増やしすぎると当たりが鈍るので、**実際に問い合わせが来た言い方**だけを足すこと。
 */
const ALIASES: Record<string, string> = {
  "エクセル": "xlsx sheet",
  "csv": "importer",
  "excel": "xlsx",
  "帳票": "pdf report invoice",
  "印刷": "print pdf",
  "メール": "mail notify",
  "通知": "notify os-notify",
  "ログイン": "auth session login",
  "権限": "auth guard",
  "検索": "search",
  "グラフ": "ui charts",
  "カレンダー": "datetime calendar booking",
  "在庫": "inventory",
  "請求": "invoice quote",
  "経費": "accounting expenses",
  "勤怠": "attendance payroll",
  "給与": "payroll attendance",
  "バーコード": "barcode mobile",
  "決済": "stripe paypal payments",
};

/**
 * このデモサイトのコマンドパレット。
 *
 * 見た目と検索は `@platform/ui` の `CommandPalette` が持つ(基盤の実装を使う)。
 * ここが足すのは**このサイト固有の配線**: ⌘K の購読・Next.js のルーター・
 * nav.ts からのコマンド生成。基盤側は状態を持たない(open を props で受ける)ため、
 * 開閉の管理は利用側の責任。
 */
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
    // 基盤の名前でも引けるようにする。
    // 「csv を使う画面はどれか」の探し方ができないと、目的から辿り着けない。
    // 同義語も少しだけ足す(利用者は正式名で覚えていない)。
    const list = t
      ? demos.filter((d) => {
          const hay = `${d.title} ${d.desc} ${d.href} ${(d.packages ?? []).join(" ")}`.toLowerCase();
          if (hay.includes(t)) return true;
          // 同義語は**語ごと**に照合する。まとめて含むかを見ると、
          // 「エクセル」→「xlsx csv」の並びが一致せず、無関係な画面が出る
          const alias = ALIASES[t];
          return alias !== undefined && alias.split(" ").some((w) => hay.includes(w));
        }) : demos;
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
