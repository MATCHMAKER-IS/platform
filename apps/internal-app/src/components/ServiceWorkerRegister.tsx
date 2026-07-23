"use client";
/**
 * Service Worker を登録する。
 *
 * 画面には何も出さない。登録に失敗しても**アプリの動作は妨げない**
 * (オフライン対応は「あると良い」ものであり、無くても業務は回るため)。
 */
import * as React from "react";

export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // 読み込みが落ち着いてから登録する(初回表示を遅くしない)
    const register = () => {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        // 失敗しても業務は続けられる。利用者に見せる必要はない
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
