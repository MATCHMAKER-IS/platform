/** 文書要約(POST {text, style?})。AI Gateway 経由。要ログイン。実行はコスト/ログに計上される。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser } from "../../../../server/authorize";
import "../../../../server/env";
import {
  aiGateway, aiIsMock, aiConcurrency, aiSpending,
  inspectAiInput, inspectAiOutput, wrapAsData,
} from "../../../../server/ai-gateway";
import { validate, z } from "@platform/validation";

/**
 * 要約の入力。
 *
 * **`style` は列挙で受ける。** 以前は `body.style === "bullet"` で分岐し、
 * それ以外は黙って既定に落ちていた——**綴りを間違えても気づけない**。
 */
const SummarizeInput = z.object({
  text: z.string().trim().min(1, "text は必須です").max(20000, "text は 20000 文字以内にしてください"),
  style: z.enum(["bullet", "plain"]).optional(),
});

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  const parsed = validate(SummarizeInput, await req.json().catch(() => ({})));
  if (!parsed.ok) return Response.json({ error: parsed.error.message, details: parsed.error.details }, { status: 400 });
  const { text } = parsed.value;

  // **費用の上限は人ごとに見る。** 全体の上限だけだと、
  // 1 人が誤って繰り返し処理を仕掛けたときに**全員が止まる**。
  if (aiSpending.usageRatio(user.email) >= 1) {
    return Response.json(
      { error: "今月の利用上限に達しました。管理者にご相談ください" },
      { status: 429 },
    );
  }

  // **指示の乗っ取りを見る。** 見つかっても止めずに記録する——
  // 完全には防げないので、**止めると正当な依頼まで弾かれる**。
  // 本当の守りは「AI に権限を渡さない」ことで、ここは気づくための仕組み。
  const suspicious = inspectAiInput(text);

  const style = parsed.value.style === "bullet" ? "箇条書きで3〜5点に" : "3文以内で簡潔に";
  // **同時実行を絞る。** 100 人が同時に使うと提供者のレート制限に当たり、
  // 全員がエラーになる。順番に流せば待たされはするが**全員通る**。
  const r = await aiConcurrency.run(() => aiGateway.chat({
    messages: [
      { role: "system", content: `あなたは日本語の要約アシスタントです。要点を${style}まとめてください。` },
      // **取り込んだ文章は「データ」として囲む。** そのまま貼ると
      // AI は指示と区別できず、文書中の「〜せよ」を命令として読む。
      { role: "user", content: wrapAsData(text, "要約する文章") },
    ],
    maxTokens: 512,
    user: user.email,
  }));
  if (!r.ok) return Response.json({ error: r.error.message }, { status: 502 });

  // **返す前に見る。** 入力を伏せても AI は文脈から推測して書くので、
  // 出力側でも確かめる必要がある。
  const leaked = inspectAiOutput(r.value.text);
  // 費用を人ごとに積む(次回の上限判定に効く)
  if (r.value.costJpy !== undefined) aiSpending.add(user.email, r.value.costJpy);

  return Response.json({
    summary: r.value.text,
    usage: r.value.usage,
    costJpy: r.value.costJpy ?? null,
    model: r.value.model,
    mock: aiIsMock,
    // **気づける形で返す。** 空なら「見つからなかった」だけで、安全の保証ではない
    warnings: { promptInjection: suspicious, sensitiveOutput: leaked },
  });
}

export const POST = withApiObservability("/api/ai/summarize", handlePOST);
