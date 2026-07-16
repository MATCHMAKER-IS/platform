/**
 * モバイル向け React フック(クライアント専用)。
 * 画面幅・ブレークポイント・向き・ネットワーク状態・可視性・スリープ防止を購読する。
 * SSR 安全(初期値を返し、マウント後に実値へ更新)。
 * @packageDocumentation
 */
import { useState, useEffect } from "react";
import { matchBreakpoint, deviceSizeFromWidth, type Breakpoints, type DeviceSize } from "./breakpoints";
import { classifyConnection, type ConnectionQuality } from "./network";
import { orientationFromDimensions, type Orientation } from "./orientation";

/**
 * メディアクエリの一致を購読する。
 *
 *
 * @param query メディアクエリ
 * @returns 一致するか(**SSR では false**)
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

/** ビューポートの幅・高さを購読する。 */
export function useViewportSize(): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return size;
}

/**
 * 現在のブレークポイント名を購読する。
 *
 *
 * @param breakpoints ブレークポイントの定義
 * @returns 現在のブレークポイント名
 */
export function useBreakpoint(breakpoints?: Breakpoints): string {
  const { width } = useViewportSize();
  return matchBreakpoint(width, breakpoints);
}

/**
 * 端末カテゴリ(mobile/tablet/desktop)を購読する。
 *
 * @returns 画面の幅・高さ(**リサイズに追従**)
 */
export function useDeviceSize(): DeviceSize {
  const { width } = useViewportSize();
  return deviceSizeFromWidth(width || 1024);
}

/**
 * モバイル幅かどうか。
 *
 * @returns モバイル幅なら true
 */
export function useIsMobile(): boolean {
  return useDeviceSize() === "mobile";
}

/**
 * 画面の向きを購読する。
 *
 * @returns 画面の向き(**回転に追従**)
 */
export function useOrientation(): Orientation {
  const { width, height } = useViewportSize();
  return orientationFromDimensions(width || 1, height || 2);
}

/**
 * オンライン/オフライン状態を購読する。
 *
 * @returns オンラインか。**`navigator.onLine` は当てにならない**(LAN に繋がっていれば true になる。実際の疎通は別途確認する)
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}

/** ネットワーク品質(effectiveType/downlink)を購読する。 */
export function useNetworkStatus(): { online: boolean; quality: ConnectionQuality; saveData: boolean } {
  const online = useOnlineStatus();
  const [info, setInfo] = useState<{ effectiveType?: string; downlink?: number; saveData?: boolean }>({});
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const conn = (navigator as unknown as { connection?: { effectiveType?: string; downlink?: number; saveData?: boolean; addEventListener?: (t: string, h: () => void) => void; removeEventListener?: (t: string, h: () => void) => void } }).connection;
    if (!conn) return;
    const update = () => setInfo({ effectiveType: conn.effectiveType, downlink: conn.downlink, saveData: conn.saveData });
    update();
    conn.addEventListener?.("change", update);
    return () => conn.removeEventListener?.("change", update);
  }, []);
  return { online, quality: classifyConnection({ online, ...info }), saveData: info.saveData === true };
}

/**
 * ページの可視状態(タブがアクティブか)を購読する。
 *
 * @returns 画面が見えているか(**裏に回ったらポーリングを止める**のに使う。電池とデータ量を節約できる)
 */
export function usePageVisibility(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const update = () => setVisible(document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

/**
 * 画面のスリープを防ぐ(Wake Lock)。enabled が true の間、画面を点灯し続ける。
 * バーコード読み取り・キオスク・現場入力などに。非対応環境では無視される。
 * @param enabled 有効にするか(**画面を消さない**。レジ・調理の手順表示など、見続ける画面で使う。**電池を食う**ので必要なときだけ)
 */
export function useWakeLock(enabled: boolean): { supported: boolean } {
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    const nav = typeof navigator !== "undefined" ? (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }) : undefined;
    setSupported(!!nav?.wakeLock);
    if (!enabled || !nav?.wakeLock) return;
    let sentinel: { release: () => Promise<void> } | null = null;
    let released = false;
    nav.wakeLock.request("screen").then((s) => { if (released) s.release(); else sentinel = s; }).catch(() => {});
    const onVisible = () => { if (document.visibilityState === "visible" && enabled && nav.wakeLock) nav.wakeLock.request("screen").then((s) => { sentinel = s; }).catch(() => {}); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { released = true; document.removeEventListener("visibilitychange", onVisible); sentinel?.release().catch(() => {}); };
  }, [enabled]);
  return { supported };
}
