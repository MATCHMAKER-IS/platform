/** 画像生成/編集(POST {prompt, image?})。AI Image Gateway 経由。要ログイン。コストはログに計上。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser } from "../../../../server/authorize";
import "../../../../server/env";
import { aiImageGateway, aiImageIsMock, aiSpending, aiConcurrency } from "../../../../server/ai-gateway";
import { validate, z } from "@platform/validation";

// **画像生成は文章生成よりコストが高い。** 長いプロンプトの上限も要る
// (以前は無制限で、費用上限も適用されていなかった)。
const ImageInput = z.object({
  prompt: z.string().trim().min(1, "prompt は必須です").max(2000),
  image: z.string().optional(),
});

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });

  // **費用の上限は人ごとに見る。** 全体の上限だけだと、1 人が誤って
  // 繰り返し処理を仕掛けたときに全員が止まる(要約APIと同じ理由)。
  if (aiSpending.usageRatio(user.email) >= 1) {
    return Response.json({ error: "今月の利用上限に達しました。管理者にご相談ください" }, { status: 429 });
  }

  const parsed = validate(ImageInput, await req.json().catch(() => ({})));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error.message, details: parsed.error.details }, { status: 400 });
  }
  const { prompt, image } = parsed.value;

  const r = await aiConcurrency.run(() => aiImageGateway.generate({ prompt, ...(image ? { image } : {}), n: 1, user: user.email }));
  if (!r.ok) return Response.json({ error: r.error.message }, { status: 502 });
  if (r.value.costJpy !== undefined) aiSpending.add(user.email, r.value.costJpy);
  return Response.json({ images: r.value.images, model: r.value.model, costJpy: r.value.costJpy ?? null, mock: aiImageIsMock });
}

export const POST = withApiObservability("/api/ai/image", handlePOST);
