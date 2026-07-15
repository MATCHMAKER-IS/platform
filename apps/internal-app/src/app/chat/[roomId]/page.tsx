/**
 * チャットルームページ（サーバシェル）。実運用ではセッションから meId、ルーム名を解決する。
 */
import { ChatRoomClient } from "./chat-room-client.js";

export const dynamic = "force-dynamic";

export default async function ChatRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  // 実運用: currentUser や rooms リポジトリから解決
  const meId = "me@example.com";
  return (
    <main className="mx-auto max-w-3xl p-4">
      <ChatRoomClient roomId={roomId} roomName={`ルーム ${roomId}`} meId={meId} />
    </main>
  );
}
