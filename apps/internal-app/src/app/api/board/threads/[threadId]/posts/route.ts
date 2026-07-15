/**
 * 掲示板の投稿 API（POST）。認可 → 検証（createPost）→ メンションがあれば通知。
 * ボディ `{ body, replyTo?, attachments? }`。検証 NG は 400、成功は 201。
 */
import { withApiObservability } from "../../../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../../../server/authorize.js";
import { serverEnv } from "../../../../../../server/env.js";
import { boardService } from "../../../../../../server/chat.js";
import type { Attachment } from "@platform/board";

async function handlePOST(req: Request, ctx: { params: Promise<{ threadId: string }> }): Promise<Response> {
  const { threadId } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "board:post");

  const body = (await req.json()) as { body?: string; replyTo?: string; attachments?: Attachment[] };
  const res = await boardService.post({
    threadId,
    authorId: user!.email,
    body: body.body ?? "",
    replyTo: body.replyTo,
    attachments: body.attachments,
  });
  if (!res.ok) return Response.json({ error: res.error }, { status: 400 });
  return Response.json(res.post, { status: 201 });
}

export const POST = withApiObservability("/api/board/threads/[threadId]/posts", handlePOST);
