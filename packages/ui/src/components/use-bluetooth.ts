"use client";
/**
 * BLE 機器への接続状態をリアクティブに扱うフック(@platform/bluetooth ラッパー)。
 * @packageDocumentation
 */
import * as React from "react";
import { connectBluetooth, isBluetoothSupported, type BluetoothConnection, type ConnectOptions } from "@platform/bluetooth";

export interface UseBluetoothState {
  /** この環境で Web Bluetooth が使えるか。 */
  supported: boolean;
  /** 接続処理中か。 */
  connecting: boolean;
  /** 接続中の機器(未接続は null)。 */
  device: { id: string; name?: string } | null;
  /** 直近のエラーメッセージ。 */
  error: string | null;
  /** 接続中の低レベルハンドル(read/write/subscribe に使う)。 */
  connection: BluetoothConnection | null;
  /** 機器を選択して接続する(ユーザー操作から呼ぶ)。 */
  connect: (options: ConnectOptions) => Promise<void>;
  /** 切断する。 */
  disconnect: () => void;
}

/**
 * BLE 接続フック。
 *
 * @returns 接続状態と操作。**非対応の環境では available: false**(使う前に確認して代替を案内する)
 */
export function useBluetooth(): UseBluetoothState {
  const [connecting, setConnecting] = React.useState(false);
  const [device, setDevice] = React.useState<{ id: string; name?: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const connRef = React.useRef<BluetoothConnection | null>(null);

  const connect = React.useCallback(async (options: ConnectOptions) => {
    setError(null);
    setConnecting(true);
    const res = await connectBluetooth(options);
    setConnecting(false);
    if (!res.ok) { setError(res.error.message); return; }
    connRef.current = res.value;
    setDevice(res.value.device);
    res.value.onDisconnect(() => { setDevice(null); connRef.current = null; });
  }, []);

  const disconnect = React.useCallback(() => {
    connRef.current?.disconnect();
    connRef.current = null;
    setDevice(null);
  }, []);

  React.useEffect(() => () => connRef.current?.disconnect(), []);

  return { supported: isBluetoothSupported(), connecting, device, error, connection: connRef.current, connect, disconnect };
}
