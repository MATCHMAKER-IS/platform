/**
 * 掲示板スレッド。
 *
 * **保存層から投稿を読む。** 以前は `initialPosts={[]}` を渡しており、
 * 投稿しても再読み込みで消えていた(保存層を足す前の名残)。
 */
import { headers } from "next/headers";
import { currentUserFromValue } from "../../../server/authorize";
import { getCookie } from "@platform/session";
import { serverEnv } from "../../../server/env";
import { boardPostStore } from "../../../server/chat";
import { userStore } from "../../../server/platform-services";
import { BoardThreadClient } from "./board-thread-client";

export const dynamic = "force-dynamic";

export default async function BoardThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  const cookie = (await headers()).get("cookie") ?? "";
  const user = currentUserFromValue(getCookie(cookie, "session"), serverEnv.SESSION_SECRET);
  const posts = await boardPostStore.list(threadId);

  // **投稿者はメールではなく氏名で出す。**
  // 社内の掲示板なので、誰の発言かがすぐ分かる方が読みやすい
  const users = await userStore.list();
  const nameOf = new Map(users.map((u) => [u.email, u.name]));

  return (
    <main className="mx-auto max-w-2xl p-4">
      <BoardThreadClient
        meId={user?.email ?? ""}
        isAdmin={user?.roles.includes("admin") ?? false}
        threadId={threadId}
        title={`スレッド ${threadId}`}
        initialPosts={posts.map((p) => ({
          id: p.id,
          authorId: p.authorId,
          authorName: nameOf.get(p.authorId) ?? p.authorId,
          body: p.body,
          timestamp: p.createdAt,
          ...(p.editedAt !== undefined ? { edited: true } : {}),
          ...(p.replyTo !== undefined ? { replyTo: p.replyTo } : {}),
        }))}
      />
    </main>
  );
}
