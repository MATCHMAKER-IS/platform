/**
 * チャット送信 API（POST）。認可 → 検証 → 全接続へ同報（メンションは通知）。
 */
import { withApiObservability } from "../../../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../../../server/authorize";
import "../../../../../../server/env";
import { chatGateway } from "../../../../../../server/chat";
import type { Attachment } from "@platform/chat";
import { validate, z } from "@platform/validation";

/**
 * 送信の入力（**形**の検証）。
 *
 * **意味の検証は下流にある**（`createMessage` が本文の長さを、
 * `validateAttachments` が件数・サイズ・種別を見る）。ここで見るのは**形**——
 * それが抜けていると、下流の検証がすり抜ける。
 *
 * 掲示板の投稿で見つかったのと同じ穴で、`attachments: "abc"` を送ると
 * `"abc".length` が 3 なので件数の上限を通り、`for (const a of "abc")` が
 * 文字を回すので `a.size` が undefined になり、**サイズの検証も素通りする**。
 */
const SendInput = z.object({
  text: z.string().default(""),
  replyTo: z.string().optional(),
  attachments: z
    // **`key` は必須。** 保存先を指す識別子で、これが無いと実体を引けない
    // (2026-08、最初に書いたスキーマは `url` を入れて `key` を落としていた
    //  ——型検査で気づいた)。
    .array(z.object({ key: z.string().min(1), name: z.string(), size: z.number().nonnegative(), type: z.string() }))
    .optional(),
});

async function handlePOST(req: Request, ctx: { params: Promise<{ roomId: string }> }): Promise<Response> {
  const { roomId } = await ctx.params;
  const user = currentUser(req);
  requirePermission(user, "chat:post");

  const parsed = validate(SendInput, await req.json().catch(() => ({})));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error.message, details: parsed.error.details }, { status: 400 });
  }
  const body = parsed.value as { text: string; replyTo?: string; attachments?: Attachment[] };
  const res = await chatGateway.send({
    roomId,
    senderId: user!.email,
    text: body.text ?? "",
    replyTo: body.replyTo,
    attachments: body.attachments,
  });
  if (!res.ok) return Response.json({ error: res.error }, { status: 400 });
  return Response.json(res.message, { status: 201 });
}

export const POST = withApiObservability("/api/chat/rooms/[roomId]/messages", handlePOST);
