/** 文書要約(POST {text, style?})。AI Gateway 経由。要ログイン。実行はコスト/ログに計上される。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { aiGateway, aiIsMock } from "../../../../server/ai-gateway.js";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  const body = (await req.json()) as { text?: string; style?: string };
  const text = (body.text ?? "").trim();
  if (text.length === 0) return Response.json({ error: "text は必須です" }, { status: 400 });
  if (text.length > 20000) return Response.json({ error: "text は 20000 文字以内にしてください" }, { status: 400 });

  const style = body.style === "bullet" ? "箇条書きで3〜5点に" : "3文以内で簡潔に";
  const r = await aiGateway.chat({
    messages: [
      { role: "system", content: `あなたは日本語の要約アシスタントです。要点を${style}まとめてください。` },
      { role: "user", content: text },
    ],
    maxTokens: 512,
    user: user.email,
  });
  if (!r.ok) return Response.json({ error: r.error.message }, { status: 502 });
  return Response.json({ summary: r.value.text, usage: r.value.usage, costJpy: r.value.costJpy ?? null, model: r.value.model, mock: aiIsMock });
}

export const POST = withApiObservability("/api/ai/summarize", handlePOST);
