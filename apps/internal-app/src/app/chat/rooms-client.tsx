"use client";
/**
 * ルーム一覧のクライアント画面。/api/chat/rooms から未読数を取得し、バッジ付きで表示する。
 * @packageDocumentation
 */
import * as React from "react";
import { Badge, Button, List } from "@platform/ui";

/** 1 ルームの未読情報。 */
export interface RoomUnreadView {
  roomId: string;
  unread: number;
  lastAt?: string;
}

/** props。 */
export interface RoomsClientProps {
  /** 対象ルーム ID(実運用では所属から解決)。 */
  roomIds: string[];
  /** ルーム ID → 表示名。 */
  roomName?: (id: string) => string;
  /** クリック時の遷移。 */
  onOpen?: (roomId: string) => void;
  fetchImpl?: typeof fetch;
}

/** ルーム一覧。 */
export function RoomsClient({ roomIds, roomName, onOpen, fetchImpl }: RoomsClientProps) {
  const [rows, setRows] = React.useState<RoomUnreadView[]>([]);
  const doFetch = fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;

  React.useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await doFetch(`/api/chat/rooms?rooms=${encodeURIComponent(roomIds.join(","))}`);
      if (!res.ok) return;
      const data = (await res.json()) as { rooms: RoomUnreadView[] };
      if (alive) setRows(data.rooms);
    })();
    return () => {
      alive = false;
    };
  }, [roomIds.join(",")]);

  const nameOf = roomName ?? ((id: string) => id);

  return (
    <List>
      {rows.map((r) => (
        <Button key={r.roomId} onClick={() => onOpen?.(r.roomId)} className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-[var(--color-muted-bg,#f5f5f5)]">
          <span>{nameOf(r.roomId)}</span>
          {r.unread > 0 && <Badge tone="danger">{r.unread}</Badge>}
        </Button>
      ))}
    </List>
  );
}
