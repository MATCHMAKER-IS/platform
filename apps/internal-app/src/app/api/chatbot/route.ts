/** チャットボット: ヘルプ応答(POST)。質問に最も一致するトピックを関連リンクつきで返す。要ログイン。 */
import { withApiObservability } from "../../../server/instrument";
import { currentUser } from "../../../server/authorize";
import { serverEnv } from "../../../server/env";
import { answer } from "../../../server/chatbot";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  const body = (await req.json()) as { message: string };
  if (!body.message || body.message.trim().length === 0) return Response.json({ error: "メッセージを入力してください" }, { status: 400 });
  return Response.json(answer(body.message));
}

export const POST = withApiObservability("/api/chatbot", handlePOST);
