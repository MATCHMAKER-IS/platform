"use client";
/**
 * メンション受信箱。/api/chat/mentions を取得し、ベルに未読数バッジ+ドロップダウン一覧を出す。
 * @packageDocumentation
 */
import * as React from "react";
import { Badge, Button } from "@platform/ui";

interface MentionRow {
  messageId: string;
  roomId: string;
  senderId: string;
  text: string;
  at: string;
}

export interface MentionInboxClientProps {
  fetchImpl?: typeof fetch;
  /** ポーリング間隔ms(既定 30000)。0 で無効。 */
  pollMs?: number;
}

export function MentionInboxClient({ fetchImpl, pollMs = 30000 }: MentionInboxClientProps) {
  const [count, setCount] = React.useState(0);
  const [mentions, setMentions] = React.useState<MentionRow[]>([]);
  const [open, setOpen] = React.useState(false);
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  const load = React.useCallback(async () => {
    const res = await doFetch("/api/chat/mentions");
    if (!res.ok) return;
    const data = (await res.json()) as { count: number; mentions: MentionRow[] };
    setCount(data.count);
    setMentions(data.mentions);
  }, []);

  React.useEffect(() => {
    void load();
    if (pollMs <= 0) return;
    const id = setInterval(() => void load(), pollMs);
    return () => clearInterval(id);
  }, [load, pollMs]);

  return (
    <div className="relative inline-block">
      <Button className="relative rounded-full p-2 hover:bg-[var(--color-muted-bg,#f8f8f8)]" onClick={() => setOpen((v) => !v)} aria-label="メンション">
        <span aria-hidden>@</span>
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5">
            <Badge variant="danger">{count > 99 ? "99+" : count}</Badge>
          </span>
        )}
      </Button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-80 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg,#fff)] shadow-lg">
          <div className="border-b border-[var(--color-border)] px-3 py-2 text-sm font-medium">メンション</div>
          {mentions.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-[var(--color-muted)]">未読のメンションはありません</div>
          ) : (
            <ul className="max-h-96 overflow-auto">
              {mentions.map((m) => (
                <li key={m.messageId}>
                  <a href={`/chat/${encodeURIComponent(m.roomId)}#${encodeURIComponent(m.messageId)}`} className="block px-3 py-2 text-sm hover:bg-[var(--color-muted-bg,#f8f8f8)]">
                    <div className="text-xs text-[var(--color-muted)]">{m.senderId} ・ {m.at.slice(0, 16).replace("T", " ")}</div>
                    <div className="truncate">{m.text}</div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
