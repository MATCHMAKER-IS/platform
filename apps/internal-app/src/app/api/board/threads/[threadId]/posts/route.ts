/**
 * 掲示板の投稿 API（POST）。認可 → 検証（createPost）→ メンションがあれば通知。
 * ボディ `{ body, replyTo?, attachments? }`。検証 NG は 400、成功は 201。
 */
import { withApiObservability } from "../../../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../../../server/authorize";
import "../../../../../../server/env";
import { boardService, boardPostStore } from "../../../../../../server/chat";
import type { Attachment } from "@platform/board";
import { validate, z } from "@platform/validation";

/**
 * 投稿の入力(**形**の検証)。
 *
 * **意味の検証は下流にある**(`createPost` が本文の長さを、
 * `validateAttachments` が件数・サイズ・種別を見る)。
 * ここで見るのは**形**——それが抜けていると、下流の検証がすり抜ける。
 *
 * 例: `attachments: "abc"` を送ると、`"abc".length` は 3 なので件数の上限を通り、
 * `for (const a of "abc")` は文字を回すので `a.size` が undefined になり、
 * **サイズの検証も素通りする**。型は `Attachment[]` と書いてあったが、
 * `as` は実行時に何も確かめない。
 */
const PostInput = z.object({
  body: z.string().default(""),
  replyTo: z.string().optional(),
  attachments: z
    // **`key` は必須。** 保存先を指す識別子で、これが無いと実体を引けない
    // (2026-08、最初に書いたスキーマは `url` を入れて `key` を落としていた
    //  ——型検査で気づいた)。
    .array(z.object({ key: z.string().min(1), name: z.string(), size: z.number().nonnegative(), type: z.string() }))
    .optional(),
});

async function handlePOST(req: Request, ctx: { params: Promise<{ threadId: string }> }): Promise<Response> {
  const { threadId } = await ctx.params;
  const user = currentUser(req);
  requirePermission(user, "board:post");

  const parsed = validate(PostInput, await req.json().catch(() => ({})));
  if (!parsed.ok) return Response.json({ error: parsed.error.message, details: parsed.error.details }, { status: 400 });
  const input = parsed.value;
  const res = await boardService.post({
    threadId,
    authorId: user!.email,
    body: input.body,
    ...(input.replyTo === undefined ? {} : { replyTo: input.replyTo }),
    ...(input.attachments === undefined ? {} : { attachments: input.attachments as Attachment[] }),
  });
  if (!res.ok) return Response.json({ error: res.error }, { status: 400 });
  return Response.json(res.post, { status: 201 });
}

/**
 * スレッドの投稿を返す。
 *
 * **保存層から引く。** 以前は保存が無く、検索索引しか無かったため
 * 一覧を出す手段も無かった。
 */
async function handleGET(req: Request, ctx: { params: Promise<{ threadId: string }> }): Promise<Response> {
  const { threadId } = await ctx.params;
  const user = currentUser(req);
  requirePermission(user, "board:read");
  return Response.json({ posts: await boardPostStore.list(threadId) });
}

export const GET = withApiObservability("/api/board/threads/[threadId]/posts", handleGET);
export const POST = withApiObservability("/api/board/threads/[threadId]/posts", handlePOST);
