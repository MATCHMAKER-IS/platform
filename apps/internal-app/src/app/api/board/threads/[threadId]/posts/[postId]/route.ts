/**
 * 投稿編集/削除 API。掲示板は投稿リポジトリ未実装のため、対象の投稿はボディで受け取り、
 * 認証ユーザーで本人/管理者判定してから編集/削除する（実運用ではリポジトリから取得する）。
 * - PATCH: ボディ `{ post, body }`。編集して再索引。
 * - DELETE: ボディ `{ post }`。権限確認のうえ索引から除去。
 */
import { withApiObservability } from "../../../../../../../server/instrument";
import { validate, z } from "@platform/validation";

/** 編集の入力。**本文は掲示板に残る文字列**なので、型が崩れると表示が壊れる。 */
const EditPostInput = z.object({ body: z.string().default("") });
import { currentUser, requirePermission } from "../../../../../../../server/authorize";
import "../../../../../../../server/env";
import { boardService, boardPostStore, chatSearch } from "../../../../../../../server/chat";
import { auditActions } from "../../../../../../../server/platform-services";

function isAdmin(roles: string[]): boolean {
  return roles.includes("admin");
}

async function handlePATCH(req: Request, ctx: { params: Promise<{ threadId: string; postId: string }> }): Promise<Response> {
  const { threadId } = await ctx.params;
  const user = currentUser(req);
  requirePermission(user, "board:post");

  const { postId } = await ctx.params;
  const parsed = validate(EditPostInput, await req.json().catch(() => ({})));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error.message, details: parsed.error.details }, { status: 400 });
  }
  const body = parsed.value;

  // **保存してある投稿を引く。** リクエストの `post` は信じない。
  // 以前はクライアントの申告をそのまま所有者判定に使っており、
  // `authorId` を書き換えれば他人の投稿を編集できた(2026-08 に発見)
  const post = await boardPostStore.get(postId);
  if (post === undefined) return Response.json({ error: "投稿が見つかりません" }, { status: 404 });

  const res = await boardService.edit({ post, editorId: user!.email, body: body.body ?? "", isAdmin: isAdmin(user!.roles) });
  if (!res.ok) return Response.json({ error: res.error }, { status: res.error.includes("権限") ? 403 : 400 });
  // **保存が先。** 索引だけ新しくして本体が古い状態を作らない
  await boardPostStore.save(threadId, res.post);
  await chatSearch.indexPost(res.post, threadId);
  await auditActions.boardEdit(user!.email, threadId, res.post.id, "", res.post.body);
  return Response.json(res.post);
}

async function handleDELETE(req: Request, ctx: { params: Promise<{ threadId: string; postId: string }> }): Promise<Response> {
  // 監査ログに threadId も残すので、両方取り出す
  const { threadId, postId } = await ctx.params;
  const user = currentUser(req);
  requirePermission(user, "board:post");

  // **保存してある投稿で判定する。** リクエストの `post` は信じない
  const post = await boardPostStore.get(postId);
  if (post === undefined) return Response.json({ error: "投稿が見つかりません" }, { status: 404 });
  if (!boardService.canDelete(post, user!.email, isAdmin(user!.roles))) {
    return Response.json({ error: "削除する権限がありません" }, { status: 403 });
  }
  await boardPostStore.remove(postId);
  await chatSearch.removePost(postId);
  await auditActions.boardDelete(user!.email, threadId, postId);
  return new Response(null, { status: 204 });
}

export const PATCH = withApiObservability("/api/board/threads/[threadId]/posts/[postId]", handlePATCH);
export const DELETE = withApiObservability("/api/board/threads/[threadId]/posts/[postId]", handleDELETE);
