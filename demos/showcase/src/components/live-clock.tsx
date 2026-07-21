"use client";
/**
 * 現在の日時をリアルタイム表示する時計。1 秒ごとに更新。
 *
 * SSR とクライアントで時刻がずれてハイドレーション不一致になるのを避けるため、
 * 初回描画では何も出さず、マウント後に時刻を出す。
 *
 * @example
 * <LiveClock />           // 大きい表示
 * <LiveClock compact />   // 1 行表示（ヘッダ向け）
 */
import * as React from "react";

const DATE_FMT = new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" });
const TIME_FMT = new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

export function LiveClock({ compact = false }: { compact?: boolean }) {
  const [now, setNow] = React.useState<Date | null>(null);

  React.useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;

  const date = DATE_FMT.format(now);
  const time = TIME_FMT.format(now);

  if (compact) {
    return (
      <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 12, color: "var(--color-muted)", whiteSpace: "nowrap" }}>
        {date} {time}
      </span>
    );
  }

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 4 }}>{date}</div>
      <div style={{ fontSize: 34, fontWeight: 700, fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em" }}>{time}</div>
    </div>
  );
}
