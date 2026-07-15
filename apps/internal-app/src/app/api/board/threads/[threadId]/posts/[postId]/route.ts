/**
 * 投稿編集/削除 API。掲示板は投稿リポジトリ未実装のため、対象の投稿はボディで受け取り、
 * 認証ユーザーで本人/管理者判定してから編集/削除する（実運用ではリポジトリから取得する）。
 * - PATCH: ボディ `{ post, body }`。編集して再索引。
 * - DELETE: ボディ `{ post }`。権限確認のうえ索引から除去。
 */
import { withApiObservability } from "../../../../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../../../../server/authorize.js";
import { serverEnv } from "../../../../../../../server/env.js";
import { boardService, chatSearch } from "../../../../../../../server/chat.js";
import { auditActions } from "../../../../../../../server/platform-services.js";
import type { Post } from "@platform/board";

function isAdmin(roles: string[]): boolean {
  return roles.includes("admin");
}

async function handlePATCH(req: Request, ctx: { params: Promise<{ threadId: string; postId: string }> }): Promise<Response> {
  const { threadId } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "board:post");

  const body = (await req.json()) as { post?: Post; body?: string };
  if (!body.post) return Response.json({ error: "post が必要です" }, { status: 400 });
  const res = await boardService.edit({ post: body.post, editorId: user!.email, body: body.body ?? "", isAdmin: isAdmin(user!.roles) });
  if (!res.ok) return Response.json({ error: res.error }, { status: res.error.includes("権限") ? 403 : 400 });
  await chatSearch.indexPost(res.post, threadId);
  await auditActions.boardEdit(user!.email, threadId, res.post.id, "", res.post.body);
  return Response.json(res.post);
}

async function handleDELETE(req: Request, ctx: { params: Promise<{ threadId: string; postId: string }> }): Promise<Response> {
  const { postId } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "board:post");

  const body = (await req.json().catch(() => ({}))) as { post?: Post };
  if (!body.post) return Response.json({ error: "post が必要です" }, { status: 400 });
  if (!boardService.canDelete(body.post, user!.email, isAdmin(user!.roles))) {
    return Response.json({ error: "削除する権限がありません" }, { status: 403 });
  }
  await chatSearch.removePost(postId);
  await auditActions.boardDelete(user!.email, threadId, postId);
  return new Response(null, { status: 204 });
}

export const PATCH = withApiObservability("/api/board/threads/[threadId]/posts/[postId]", handlePATCH);
export const DELETE = withApiObservability("/api/board/threads/[threadId]/posts/[postId]", handleDELETE);
