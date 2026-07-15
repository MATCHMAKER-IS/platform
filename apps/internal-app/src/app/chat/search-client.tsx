"use client";
/**
 * チャット/掲示板の検索画面。検索ボックスに入力すると /api/chat|board/search を叩き、
 * @platform/ui の HighlightedText で一致箇所を強調表示する。
 * @packageDocumentation
 */
import * as React from "react";
import { SearchInput, HighlightedText, List, EmptyState } from "@platform/ui";

/** メッセージ検索結果。 */
interface MessageResult {
  id: string;
  roomId: string;
  senderId: string;
  text: string;
  at: string;
  score?: number;
}

/** props。 */
export interface SearchClientProps {
  /** "chat"(メッセージ)か "board"(投稿)。 */
  scope?: "chat" | "board";
  fetchImpl?: typeof fetch;
}

/** 検索画面。 */
export function SearchClient({ scope = "chat", fetchImpl }: SearchClientProps) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<MessageResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  React.useEffect(() => {
    const q = query.trim();
    if (q.length === 0) {
      setResults([]);
      return;
    }
    let alive = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      const path = scope === "board" ? "/api/board/search" : "/api/chat/search";
      const res = await doFetch(`${path}?q=${encodeURIComponent(q)}`);
      if (!alive) return;
      setLoading(false);
      if (!res.ok) {
        setResults([]);
        return;
      }
      const data = (await res.json()) as { results: MessageResult[] };
      setResults(data.results);
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, scope]);

  return (
    <div className="flex flex-col gap-3">
      <SearchInput value={query} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)} placeholder="メッセージを検索" />
      {query.trim().length > 0 && results.length === 0 && !loading && <EmptyState title="一致する結果がありません" />}
      <List>
        {results.map((r) => {
          const body = "text" in r ? r.text : "";
          return (
            <div key={r.id} className="flex flex-col gap-1 px-3 py-2">
              <div className="text-xs text-[var(--color-muted)]">
                {r.senderId} ・ {r.at.slice(0, 16).replace("T", " ")}
              </div>
              <div className="text-sm">
                <HighlightedText text={body} query={query} />
              </div>
            </div>
          );
        })}
      </List>
    </div>
  );
}
