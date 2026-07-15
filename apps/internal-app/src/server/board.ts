/**
 * 掲示板の具体配線。投稿を検証(createPost)して、本文のメンションを chat と同じ通知器へ流す。
 * 実体保存(スレッド/投稿の永続化)は Prisma 等のリポジトリに接続する前提で、ここでは
 * 「検証 → メンション通知」の結線を提供する。
 * @packageDocumentation
 */
import { createPost, editPost, canModifyPost, extractMentions, validateAttachments, type Post, type Attachment, type AttachmentLimits } from "@platform/board";
import { type MentionContext } from "./chat-notify.js";

/** 掲示板配線の構成。 */
export interface BoardServiceOptions {
  newId: () => string;
  /** メンション通知(chat と同じ buildMentionNotifier の戻り値)。 */
  onMentions?: (ctx: MentionContext, handles: string[]) => void | Promise<unknown>;
  attachmentLimits?: AttachmentLimits;
  /** 投稿作成/編集後のフック(検索索引更新等)。 */
  onPosted?: (post: Post, threadId: string) => void | Promise<unknown>;
  onHookError?: (error: unknown) => void;
}

/** 投稿の入力。 */
export interface BoardPostInput {
  threadId: string;
  authorId: string;
  body: string;
  replyTo?: string;
  attachments?: Attachment[];
}

/** 投稿結果。 */
export type BoardPostResult = { ok: true; post: Post } | { ok: false; error: string };

/** 掲示板サービス。 */
export interface BoardService {
  /** 投稿を検証して作成し、メンションがあれば通知する。 */
  post(input: BoardPostInput): Promise<BoardPostResult>;
  /** 投稿を編集する(本人/管理者のみ)。 */
  edit(input: { post: Post; editorId: string; body: string; isAdmin?: boolean }): Promise<BoardPostResult>;
  /** 投稿を削除できるか判定する(本人/管理者のみ)。 */
  canDelete(post: Post, userId: string, isAdmin?: boolean): boolean;
}

/** 掲示板サービスを生成する。 */
export function createBoardService(opts: BoardServiceOptions): BoardService {
  const { newId, onMentions, attachmentLimits, onHookError, onPosted } = opts;
  return {
    async post(input) {
      if (attachmentLimits && input.attachments && input.attachments.length > 0) {
        const v = validateAttachments(input.attachments, attachmentLimits);
        if (!v.ok) return v;
      }
      const created = createPost({ id: newId(), authorId: input.authorId, body: input.body, replyTo: input.replyTo, attachments: input.attachments });
      if (!created.ok) return created;
      const handles = extractMentions(created.post.body);
      if (onMentions && handles.length > 0) {
        try {
          await onMentions({ senderId: created.post.authorId, text: created.post.body, contextId: input.threadId }, handles);
        } catch (e) {
          onHookError?.(e);
        }
      }
      if (onPosted) {
        try { await onPosted(created.post, input.threadId); } catch (e) { onHookError?.(e); }
      }
      return { ok: true, post: created.post };
    },
    async edit(input) {
      if (!canModifyPost(input.post, input.editorId, input.isAdmin ?? false)) return { ok: false, error: "編集する権限がありません" };
      const edited = editPost(input.post, input.body);
      if (!edited.ok) return edited;
      if (onPosted) {
        try { await onPosted(edited.post, ""); } catch (e) { onHookError?.(e); }
      }
      return { ok: true, post: edited.post };
    },
    canDelete(post, userId, isAdmin = false) {
      return canModifyPost(post, userId, isAdmin);
    },
  };
}
