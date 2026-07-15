"use client";
/** 画面右上に常駐する受信箱インジケータ。未読数を定期取得してバッジ表示し、/mailbox へ導線する。 */
import * as React from "react";

export interface MailboxIndicatorProps { fetchImpl?: typeof fetch; }

export function MailboxIndicator({ fetchImpl }: MailboxIndicatorProps) {
  const [unread, setUnread] = React.useState(0);
  const [ready, setReady] = React.useState(false);
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  React.useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await doFetch("/api/mailbox");
        if (!alive || !res.ok) return;
        const d = (await res.json()) as { unread: number };
        setUnread(d.unread);
        setReady(true);
      } catch {
        // 未ログイン等では非表示のまま
      }
    };
    void load();
    const timer = setInterval(load, 60000);
    return () => { alive = false; clearInterval(timer); };
  }, [doFetch]);

  if (!ready) return null;
  return (
    <a href="/mailbox" title="受信箱" className="fixed right-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white shadow-md hover:bg-neutral-50">
      <span aria-hidden className="text-lg">✉</span>
      {unread > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>}
      <span className="sr-only">受信箱（未読 {unread} 件）</span>
    </a>
  );
}
