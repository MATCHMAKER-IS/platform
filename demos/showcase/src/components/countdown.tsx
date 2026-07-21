"use client";
/**
 * 実時間でカウントダウンするタイマー。
 *
 * `seconds`（総秒数）から 1 秒ずつ減る。`running` が false の間は止まる。
 * 残りが 0 になったら一度だけ `onDone` を呼ぶ。`seconds` が変わるとリセット。
 *
 * @example
 * <Countdown seconds={300} running={running} onDone={() => alert("終了")} />
 */
import * as React from "react";

const pad = (n: number) => String(n).padStart(2, "0");

/** 秒数を mm:ss / h:mm:ss の文字列にする。 */
export function formatDuration(total: number): string {
  const t = Math.max(0, Math.floor(total));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export interface CountdownProps {
  /** 総秒数。 */
  seconds: number;
  /** 動作中か（false で一時停止）。既定 true。 */
  running?: boolean;
  /** 残り 0 になったとき一度だけ呼ばれる。 */
  onDone?: () => void;
  /** 残りが少ないと警告色にする閾値（秒）。既定 60。 */
  warnUnder?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Countdown({ seconds, running = true, onDone, warnUnder = 60, style }: CountdownProps) {
  const [remaining, setRemaining] = React.useState(seconds);
  const doneRef = React.useRef(false);

  React.useEffect(() => {
    setRemaining(seconds);
    doneRef.current = false;
  }, [seconds]);

  React.useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [running]);

  React.useEffect(() => {
    if (remaining === 0 && !doneRef.current) {
      doneRef.current = true;
      onDone?.();
    }
  }, [remaining, onDone]);

  const warn = remaining <= warnUnder;
  return (
    <span
      style={{
        fontVariantNumeric: "tabular-nums",
        fontWeight: 700,
        letterSpacing: "0.02em",
        color: remaining === 0 ? "var(--color-danger)" : warn ? "var(--color-warning, #d97706)" : "var(--color-fg)",
        ...style,
      }}
    >
      {formatDuration(remaining)}
    </span>
  );
}
