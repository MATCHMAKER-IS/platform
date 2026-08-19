/**
 * チャットルーム。
 *
 * **参加者と自分をセッションから解決する。**
 * 以前は `meId = "me@example.com"` の固定値で、
 * 誰の発言かが正しく出なかった(自分の発言も他人扱いになる)。
 */
import { headers } from "next/headers";
import { currentUserFromValue } from "../../../server/authorize";
import { getCookie } from "@platform/session";
import { serverEnv } from "../../../server/env";
import { roomRepo } from "../../../server/chat";
import { userStore } from "../../../server/platform-services";
import { ChatRoomClient } from "./chat-room-client";
import { RoomMembersPanel } from "./room-members-panel";

export const dynamic = "force-dynamic";

export default async function ChatRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const cookie = (await headers()).get("cookie") ?? "";
  const user = currentUserFromValue(getCookie(cookie, "session"), serverEnv.SESSION_SECRET);

  const room = await roomRepo.get(roomId);
  const users = await userStore.list();
  // **メール → 表示名。** 発言者をメールのまま出すと読みにくい
  // **`ChatRoomClient` の `displayName` は「ID → 表示名」を引く関数**
  // (自分の名前ではない)。2026-08 まで `user.name`(文字列)を渡しており、
  // 型検査で落ちていた。
  const nameByEmail = new Map(users.map((u) => [u.email, u.name === "" ? u.email : u.name]));

  return (
    <main className="mx-auto max-w-3xl space-y-3 p-4">
      <RoomMembersPanel
        roomId={roomId}
        memberIds={room?.memberIds ?? []}
        candidates={users.map((u) => ({
          email: u.email, name: u.name,
          ...(u.department !== "" ? { department: u.department } : {}),
        }))}
      />
      <ChatRoomClient
        roomId={roomId}
        roomName={room?.name ?? `ルーム ${roomId}`}
        meId={user?.email ?? ""}
        displayName={(id) => nameByEmail.get(id) ?? id}
      />
    </main>
  );
}
