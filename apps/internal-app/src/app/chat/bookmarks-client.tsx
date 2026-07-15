"use client";
/**
 * 個人ブックマーク一覧。/api/chat/bookmarks を取得し、新しい順で表示する。
 * @packageDocumentation
 */
import * as React from "react";
import { List, EmptyState, Card } from "@platform/ui";

interface BookmarkRow {
  userId: string;
  messageId: string;
  roomId: string;
  at: string;
}

export interface BookmarksClientProps {
  fetchImpl?: typeof fetch;
}

export function BookmarksClient({ fetchImpl }: BookmarksClientProps) {
  const [bookmarks, setBookmarks] = React.useState<BookmarkRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const res = await doFetch("/api/chat/bookmarks");
      if (!alive) return;
      setLoading(false);
      if (!res.ok) return;
      const data = (await res.json()) as { bookmarks: BookmarkRow[] };
      setBookmarks(data.bookmarks);
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!loading && bookmarks.length === 0) return <EmptyState title="ブックマークはまだありません" />;

  return (
    <Card>
      <List>
        {bookmarks.map((b) => (
          <a key={b.messageId} href={`/chat/${encodeURIComponent(b.roomId)}#${encodeURIComponent(b.messageId)}`} className="flex items-center justify-between px-3 py-2 text-sm hover:bg-[var(--color-muted-bg,#f8f8f8)]">
            <span className="truncate">メッセージ {b.messageId}</span>
            <span className="ml-2 text-xs text-[var(--color-muted)]">{b.at.slice(0, 16).replace("T", " ")}</span>
          </a>
        ))}
      </List>
    </Card>
  );
}
