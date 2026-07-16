"use client";
/**
 * 自動更新フック。usePolling(定期取得)と useWebSocket(リアルタイム)。
 * チャートやダッシュボードのデータ自動更新に使う。内部は @platform/realtime。
 * @packageDocumentation
 */
import * as React from "react";
import { createPoller, createReconnectingWebSocket } from "@platform/realtime";

/** {@link usePolling} のオプション。 */
export interface UsePollingOptions {
  /** 有効化(既定 true)。false で停止。 */
  enabled?: boolean;
  /** タブが非表示のときは停止する(既定 true)。 */
  pauseWhenHidden?: boolean;
}

/**
 * 一定間隔でデータを取得するフック。
 *
 * @param options.fetch 取得する処理
 * @param options.intervalMs 間隔(**短くしすぎない**。サーバの負荷になる)
 */
export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number, options: UsePollingOptions = {}) {
  const { enabled = true, pauseWhenHidden = true } = options;
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const fetcherRef = React.useRef(fetcher);
  fetcherRef.current = fetcher;

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try { setData(await fetcherRef.current()); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => {
    if (!enabled) return;
    const poller = createPoller(() => void refresh(), intervalMs);
    poller.start();
    const onVis = () => { if (document.hidden) poller.stop(); else poller.start(); };
    if (pauseWhenHidden) document.addEventListener("visibilitychange", onVis);
    return () => { poller.stop(); if (pauseWhenHidden) document.removeEventListener("visibilitychange", onVis); };
  }, [enabled, intervalMs, pauseWhenHidden, refresh]);

  return { data, error, loading, refresh };
}

/** WebSocket の接続状態。 */
export type WsStatus = "connecting" | "open" | "closed";

/**
 * リアルタイム受信フック(自動再接続)。
 *
 * @param url 接続先
 * @param options.onMessage 受信時の処理(**自動再接続する**)
 */
export function useWebSocket<T = unknown>(url: string, options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  const [lastMessage, setLastMessage] = React.useState<T | null>(null);
  const [status, setStatus] = React.useState<WsStatus>("connecting");
  const wsRef = React.useRef<ReturnType<typeof createReconnectingWebSocket> | null>(null);

  React.useEffect(() => {
    if (!enabled) return;
    const ws = createReconnectingWebSocket<T>(url, {
      onMessage: (d) => setLastMessage(d),
      onOpen: () => setStatus("open"),
      onClose: () => setStatus((s) => (s === "open" ? "connecting" : s)),
    });
    wsRef.current = ws;
    return () => { ws.close(); setStatus("closed"); };
  }, [url, enabled]);

  const send = React.useCallback((data: unknown) => wsRef.current?.send(data), []);
  return { lastMessage, status, send };
}

import { appendCapped } from "../lib/live-buffer";

/**
 * ライブ系列フック。直近 max 件だけを保持し、push で 1 点追加する。
 * 参照は変化点でのみ更新されるので、React.memo 済みチャートの再描画を抑えられる。
 * @example
 * ```tsx
 * const { data, push } = useLiveSeries<{ t: string; v: number }>(30);
 * useWebSocket("wss://...", { }); // 受信で push(msg)
 * <LineChart data={data} xKey="t" series={[{ key: "v" }]} />
 * ```
 * @param options.max 保持する件数(**上限が無いとメモリを食い尽くす**)
 */
export function useLiveSeries<T>(max = 60, initial: T[] = []) {
  const [data, setData] = React.useState<T[]>(initial);
  const push = React.useCallback((item: T) => setData((prev) => appendCapped(prev, item, max)), [max]);
  const reset = React.useCallback(() => setData([]), []);
  return { data, push, reset };
}
