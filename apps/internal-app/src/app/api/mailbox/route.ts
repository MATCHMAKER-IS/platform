/** メールボックス: 自分の受信箱一覧＋未読数(GET)。ログインユーザーの受信箱のみ。 */
import { withApiObservability } from "../../../server/instrument";
import { currentUser } from "../../../server/authorize";
import { serverEnv } from "../../../server/env";
import { mailboxStore } from "../../../server/platform-services";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  const [messages, unread] = await Promise.all([mailboxStore.list(user.email), mailboxStore.unreadCount(user.email)]);
  return Response.json({ messages, unread });
}

export const GET = withApiObservability("/api/mailbox", handleGET);
