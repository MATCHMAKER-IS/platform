/**
 * メンション通知(チャット・掲示板 共通)。メンション抽出結果を受け、@platform/notify の各ユーザーの
 * 通知口(Slack/メール等)へ「メンションされました」を送る。送信者自身は除外。
 * chat / board のどちらのオブジェクトでも、送信者・本文・文脈 ID に正規化して渡せば使える。
 * @packageDocumentation
 */
import { type Notifier, renderTemplate } from "@platform/notify";

/** メンション元の正規化コンテキスト(chat のメッセージ / board の投稿を写像する)。 */
export interface MentionContext {
  /** 送信者 ID(chat: senderId / board: authorId)。 */
  senderId: string;
  /** 本文(chat: text / board: body)。 */
  text: string;
  /** 文脈 ID(chat: roomId / board: threadId)。テンプレートの {{context}} に使える。 */
  contextId?: string;
}

/** メンション通知の構成。 */
export interface MentionNotifyOptions {
  /** handle(メンション名)からその人の通知口を解決する。無ければ通知しない。 */
  notifierFor: (handle: string) => Notifier | undefined;
  /** 本文テンプレート。{{sender}} {{context}} {{text}} を使える。 */
  template?: string;
  /** 送信者自身へのメンションを除外(既定 true)。 */
  excludeSelf?: boolean;
  /** 送信者 ID → 表示名。 */
  senderName?: (id: string) => string;
  /** 文脈 ID(ルーム/スレッド)→ 表示名。 */
  contextName?: (id: string) => string;
}

/** 通知結果。 */
export interface MentionNotifyResult {
  /** 実際に通知できた handle。 */
  notified: string[];
  /** 通知しなかった handle(自分・通知口なし・送信失敗)。 */
  skipped: string[];
}

/** メンション通知関数を生成する(chat の onMentions / board の投稿後フックに渡せる)。 */
export function buildMentionNotifier(opts: MentionNotifyOptions): (ctx: MentionContext, handles: string[]) => Promise<MentionNotifyResult> {
  const template = opts.template ?? "{{sender}} さんがあなたにメンションしました: {{text}}";
  const excludeSelf = opts.excludeSelf ?? true;
  return async (ctx, handles) => {
    const notified: string[] = [];
    const skipped: string[] = [];
    for (const handle of handles) {
      if (excludeSelf && handle === ctx.senderId) {
        skipped.push(handle);
        continue;
      }
      const notifier = opts.notifierFor(handle);
      if (!notifier) {
        skipped.push(handle);
        continue;
      }
      const text = renderTemplate(template, {
        sender: opts.senderName?.(ctx.senderId) ?? ctx.senderId,
        context: ctx.contextId ? (opts.contextName?.(ctx.contextId) ?? ctx.contextId) : "",
        text: ctx.text,
      });
      const res = await notifier.notify({ text, level: "info" });
      if (res.ok) notified.push(handle);
      else skipped.push(handle);
    }
    return { notified, skipped };
  };
}
