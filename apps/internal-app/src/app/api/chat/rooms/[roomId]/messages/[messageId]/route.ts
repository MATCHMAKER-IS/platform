/**
 * メッセージ編集/削除 API。
 * - PATCH: 本文を編集（本人/管理者のみ）。ボディ `{ text }`。編集後を全接続へ同報。
 * - DELETE: メッセージを削除（本人/管理者のみ）。削除を全接続へ同報。
 */
import { withApiObservability } from "../../../../../../../server/instrument";
import { validate, z } from "@platform/validation";

/** 編集の入力。**本文は利用者に届く文字列**なので、型が崩れると表示が壊れる。 */
const EditInput = z.object({ text: z.string().default("") });
import { currentUser, requirePermission } from "../../../../../../../server/authorize";
import "../../../../../../../server/env";
import { chatGateway } from "../../../../../../../server/chat";
import { auditActions } from "../../../../../../../server/platform-services";

function isAdmin(roles: string[]): boolean {
  return roles.includes("admin");
}

async function handlePATCH(req: Request, ctx: { params: Promise<{ roomId: string; messageId: string }> }): Promise<Response> {
  const { roomId, messageId } = await ctx.params;
  const user = currentUser(req);
  requirePermission(user, "chat:post");

  const parsed = validate(EditInput, await req.json().catch(() => ({})));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error.message, details: parsed.error.details }, { status: 400 });
  }
  const body = parsed.value;
  const res = await chatGateway.edit({ roomId, messageId, editorId: user!.email, text: body.text, isAdmin: isAdmin(user!.roles) });
  if (!res.ok) return Response.json({ error: res.error }, { status: res.error.includes("権限") ? 403 : 400 });
  await auditActions.chatEdit(user!.email, roomId, messageId, "", res.message.text);
  return Response.json(res.message);
}

async function handleDELETE(req: Request, ctx: { params: Promise<{ roomId: string; messageId: string }> }): Promise<Response> {
  const { roomId, messageId } = await ctx.params;
  const user = currentUser(req);
  requirePermission(user, "chat:post");

  const res = await chatGateway.remove({ roomId, messageId, editorId: user!.email, isAdmin: isAdmin(user!.roles) });
  if (!res.ok) return Response.json({ error: res.error }, { status: res.error.includes("権限") ? 403 : 400 });
  await auditActions.chatDelete(user!.email, roomId, messageId);
  return new Response(null, { status: 204 });
}

export const PATCH = withApiObservability("/api/chat/rooms/[roomId]/messages/[messageId]", handlePATCH);
export const DELETE = withApiObservability("/api/chat/rooms/[roomId]/messages/[messageId]", handleDELETE);
