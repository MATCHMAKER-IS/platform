"use client";
/**
 * WebHID(PC 周辺機器)への接続状態をリアクティブに扱うフック(@platform/hid ラッパー)。
 * @packageDocumentation
 */
import * as React from "react";
import { connectHid, isHidSupported, reportBytes, type HidConnection, type HidFilter } from "@platform/hid";

export interface UseHidState {
  supported: boolean;
  connecting: boolean;
  device: { vendorId: number; productId: number; productName: string } | null;
  error: string | null;
  connection: HidConnection | null;
  /** 直近の入力レポート(reportId とバイト配列)。 */
  lastReport: { reportId: number; bytes: number[] } | null;
  connect: (filters?: HidFilter[]) => Promise<void>;
  disconnect: () => void;
}

/** WebHID 接続フック(入力レポートを自動購読)。 */
export function useHid(): UseHidState {
  const [connecting, setConnecting] = React.useState(false);
  const [device, setDevice] = React.useState<UseHidState["device"]>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [lastReport, setLastReport] = React.useState<UseHidState["lastReport"]>(null);
  const connRef = React.useRef<HidConnection | null>(null);
  const stopRef = React.useRef<(() => void) | null>(null);

  const connect = React.useCallback(async (filters: HidFilter[] = []) => {
    setError(null); setConnecting(true);
    const res = await connectHid(filters);
    setConnecting(false);
    if (!res.ok) { setError(res.error.message); return; }
    connRef.current = res.value;
    setDevice(res.value.device);
    stopRef.current = res.value.onInputReport((reportId, data) => setLastReport({ reportId, bytes: reportBytes(data) }));
  }, []);

  const disconnect = React.useCallback(() => {
    stopRef.current?.(); stopRef.current = null;
    void connRef.current?.close(); connRef.current = null;
    setDevice(null);
  }, []);

  React.useEffect(() => () => { stopRef.current?.(); void connRef.current?.close(); }, []);

  return { supported: isHidSupported(), connecting, device, error, connection: connRef.current, lastReport, connect, disconnect };
}
