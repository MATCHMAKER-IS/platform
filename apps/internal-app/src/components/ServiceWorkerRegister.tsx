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

    // **開発では登録しない。**
    // Service Worker は画面を保存するので、コードを直しても
    // **古い画面が出続ける**(2026-08、直したはずのログイン画面が
    // 何度も古い見た目で出た)。`.next` を消しても消えない。
    //
    // さらに、**すでに登録済みのものを解除する**。
    // 開発を始める前に一度でも登録されていると、
    // ここで登録を止めるだけでは古い画面が残る。
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((rs) => {
        for (const r of rs) void r.unregister();
      });
      // 保存済みの中身も消す(登録解除だけでは残る)
      if ("caches" in window) {
        void caches.keys().then((keys) => { for (const k of keys) void caches.delete(k); });
      }
      return;
    }

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
