"use client";
/**
 * ヘッダーのプロフィール。
 *
 * **「今、誰として画面を見ているか」を常に示す**ための頭文字アバター。
 * 押すと、その人の名前・部署・役職・ロールを出す小さなカードが開く。
 *
 * このデモは本物のログインを持たないので、中身は固定のダミー
 * (`DEMO_USER`)。本番の基盤(@platform/auth)と繋ぐときは
 * `DEMO_USER` をセッション由来のユーザーに差し替えるだけでよい。
 */
import * as React from "react";
import { Button } from "@platform/ui";
import { DEMO_USER, initialsOf } from "../lib/demo-user";

export function ProfileMenu() {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const user = DEMO_USER;

  // 外側をクリック / Esc で閉じる(メニューの定石)。
  React.useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <Button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${user.name} のプロフィール`}
        title={`${user.name}（${user.department}）`}
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          border: "1px solid var(--color-border)",
          background: "var(--color-primary)",
          color: "var(--color-primary-fg, #fff)",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
        }}
      >
        {initialsOf(user)}
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label="プロフィール"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 260,
            zIndex: 40,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius)",
            boxShadow: "0 8px 24px color-mix(in srgb, var(--color-fg) 14%, transparent)",
            overflow: "hidden",
          }}
        >
          {/* 上段: アバター + 名前 */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "14px 14px 12px" }}>
            <div
              aria-hidden
              style={{
                width: 40,
                height: 40,
                flexShrink: 0,
                borderRadius: "50%",
                background: "var(--color-primary)",
                color: "var(--color-primary-fg, #fff)",
                fontSize: 16,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {initialsOf(user)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>{user.name}</div>
              <div style={{ fontSize: 11.5, color: "var(--color-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.email}
              </div>
            </div>
          </div>

          <hr style={{ border: 0, borderTop: "1px solid var(--color-border)", margin: 0 }} />

          {/* 下段: 属性 */}
          <dl style={{ margin: 0, padding: "12px 14px", display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 12px", fontSize: 12 }}>
            <dt style={{ color: "var(--color-muted)" }}>部署</dt>
            <dd style={{ margin: 0 }}>{user.department}</dd>
            <dt style={{ color: "var(--color-muted)" }}>役職</dt>
            <dd style={{ margin: 0 }}>{user.title}</dd>
            <dt style={{ color: "var(--color-muted)" }}>ロール</dt>
            <dd style={{ margin: 0, display: "flex", flexWrap: "wrap", gap: 4 }}>
              {user.roles.map((r) => (
                <span
                  key={r}
                  style={{
                    fontSize: 11,
                    padding: "1px 7px",
                    borderRadius: 999,
                    background: "color-mix(in srgb, var(--color-primary) 14%, transparent)",
                    color: "var(--color-fg)",
                  }}
                >
                  {r}
                </span>
              ))}
            </dd>
          </dl>

          <div style={{ padding: "0 14px 12px", fontSize: 10.5, color: "var(--color-muted)", lineHeight: 1.6 }}>
            これはデモ用の固定ユーザーです。実際のログイン基盤（@platform/auth）と繋ぐと、ここにログイン中の本人が出ます。
          </div>
        </div>
      )}
    </div>
  );
}
