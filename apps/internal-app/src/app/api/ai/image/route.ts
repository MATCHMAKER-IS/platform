/** 画像生成/編集(POST {prompt, image?})。AI Image Gateway 経由。要ログイン。コストはログに計上。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { aiImageGateway, aiImageIsMock } from "../../../../server/ai-gateway";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  const body = (await req.json()) as { prompt?: string; image?: string };
  const prompt = (body.prompt ?? "").trim();
  if (!prompt) return Response.json({ error: "prompt は必須です" }, { status: 400 });

  const r = await aiImageGateway.generate({ prompt, ...(body.image ? { image: body.image } : {}), n: 1, user: user.email });
  if (!r.ok) return Response.json({ error: r.error.message }, { status: 502 });
  return Response.json({ images: r.value.images, model: r.value.model, costJpy: r.value.costJpy ?? null, mock: aiImageIsMock });
}

export const POST = withApiObservability("/api/ai/image", handlePOST);
