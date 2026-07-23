"use client";
/**
 * 無操作ログアウト(クライアント UX)。
 * 一定時間無操作で自動ログアウトし、その手前で警告カウントダウンを表示する。
 * 無効化(timeoutMinutes<=0)なら何もしない=既定は「無操作でもログアウトしない」。
 * サーバ側の失効は @platform/session の idleTimeoutSec が担う(本コンポーネントは UX)。
 */
import { useEffect, useRef, useState } from "react";
import { Button } from "@platform/ui";
import { createIdleTimer, bindActivityListeners } from "@platform/session/idle-timer";

export interface IdleLogoutProps {
  /** 無操作からログアウトまでの分。0 以下で無効(既定 0 = 無効)。 */
  timeoutMinutes?: number;
  /** ログアウト何秒前に警告を出すか(既定 60 秒)。 */
  warnSeconds?: number;
  /** ログアウト先(既定 "/api/auth/logout" に POST 後 "/login" へ)。 */
  onLogout?: () => void;
}

export function IdleLogout({ timeoutMinutes = 0, warnSeconds = 60, onLogout }: IdleLogoutProps) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timeoutMinutes <= 0) return; // 既定: 無効(無操作でもOK)
    const timeoutMs = timeoutMinutes * 60_000;
    const warnBeforeMs = Math.min(warnSeconds * 1000, timeoutMs - 1);

    const doLogout = async () => {
      if (onLogout) return onLogout();
      try { await fetch("/api/auth/logout", { method: "POST" }); } catch { /* noop */ }
      window.location.href = "/login";
    };

    const clearCountdown = () => { if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; } };

    const timer = createIdleTimer({
      timeoutMs,
      warnBeforeMs,
      onWarn: () => {
        let left = Math.ceil(warnBeforeMs / 1000);
        setRemaining(left);
        countdownRef.current = setInterval(() => {
          left -= 1;
          setRemaining(left > 0 ? left : 0);
          if (left <= 0) clearCountdown();
        }, 1000);
      },
      onActive: () => { clearCountdown(); setRemaining(null); },
      onIdle: () => { clearCountdown(); setRemaining(null); void doLogout(); },
    });
    timer.start();
    const unbind = bindActivityListeners(timer);
    return () => { unbind(); timer.stop(); clearCountdown(); };
  }, [timeoutMinutes, warnSeconds, onLogout]);

  if (remaining === null) return null;
  return (
    <div role="alertdialog" aria-live="assertive" style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "grid", placeItems: "center", zIndex: 9999,
    }}>
      <div style={{ background: "var(--color-surface, #fff)", borderRadius: 12, padding: "1.5rem 2rem", maxWidth: 360, textAlign: "center" }}>
        <h2 style={{ fontSize: "1.1rem", margin: "0 0 .5rem" }}>まもなく自動ログアウトします</h2>
        <p style={{ color: "var(--color-muted, #6b7280)", margin: ".25rem 0 1rem" }}>
          無操作が続いています。あと <strong>{remaining}</strong> 秒で自動的にログアウトします。
        </p>
        <Button onClick={() => { /* activity は listener が拾うが、明示クリックも活動として扱う */ setRemaining(null); }}
          style={{ padding: ".5rem 1.25rem", borderRadius: 8, background: "var(--color-primary, #2563eb)", color: "var(--color-surface, #fff)", border: "none", cursor: "pointer" }}>
          継続する
        </Button>
      </div>
    </div>
  );
}
