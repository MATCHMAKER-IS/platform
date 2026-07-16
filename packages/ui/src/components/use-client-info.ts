"use client";
/**
 * クライアント情報をリアクティブに購読するフック。
 * リサイズ・オンライン状態・配色設定の変化で自動更新する。内部は @platform/device。
 * @packageDocumentation
 */
import * as React from "react";
import { getClientInfo, type ClientInfo } from "@platform/device";

/**
 * 端末・ブラウザ・ネットワーク等の情報を取得する(SSR では null、マウント後に確定)。
 * @example
 * ```tsx
 * const info = useClientInfo();
 * if (info?.device.type === "mobile") { ... }
 * ```
 * @returns ブラウザ・OS・画面サイズ。**SSR では undefined**(サーバには画面が無い)
 */
export function useClientInfo(): ClientInfo | null {
  const [info, setInfo] = React.useState<ClientInfo | null>(null);

  React.useEffect(() => {
    const update = () => setInfo(getClientInfo());
    update();

    window.addEventListener("resize", update);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const dark = matchMedia("(prefers-color-scheme: dark)");
    dark.addEventListener?.("change", update);
    const conn = (navigator as Navigator & { connection?: EventTarget }).connection;
    conn?.addEventListener?.("change", update);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      dark.removeEventListener?.("change", update);
      conn?.removeEventListener?.("change", update);
    };
  }, []);

  return info;
}
