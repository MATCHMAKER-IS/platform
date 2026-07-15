/**
 * 掲示板スレッドページ（サーバシェル）。実運用では投稿をリポジトリから取得する。
 */
import { BoardThreadClient } from "./board-thread-client.js";

export const dynamic = "force-dynamic";

export default async function BoardThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  return (
    <main className="mx-auto max-w-2xl p-4">
      <BoardThreadClient threadId={threadId} title={`スレッド ${threadId}`} initialPosts={[]} />
    </main>
  );
}
