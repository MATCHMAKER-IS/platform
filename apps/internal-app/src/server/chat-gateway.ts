/**
 * チャットゲートウェイ。@platform/realtime(BroadcastHub 同報)と @platform/chat(検証)を束ね、
 * 「購読/解除/送信」をトランスポート非依存で提供する。WebSocket でも SSE でも、
 * 接続ごとの `send(data)` を渡せば同じように使える。
 * @packageDocumentation
 */
import { createMessage, editMessage, canModifyMessage, extractMentions, validateAttachments, type ChatMessage, type Attachment, type AttachmentLimits } from "@platform/chat";
import { type BroadcastHub } from "@platform/realtime";

/** ルームのチャネル名。 */
export function roomChannel(roomId: string): string {
  return `room:${roomId}`;
}

/** ゲートウェイの構成。 */
export interface ChatGatewayOptions {
  /** 同報ハブ(Redis Pub/Sub 背後・全インスタンスへ配信)。 */
  hub: BroadcastHub;
  /** メッセージ ID 生成。 */
  newId: () => string;
  /** メンション検知時のフック(通知等)。配信はブロックしない。 */
  onMentions?: (message: ChatMessage, handles: string[]) => void | Promise<unknown>;
  /** 添付の制約(任意)。 */
  attachmentLimits?: AttachmentLimits;
  /** 配信成功後のフック(メッセージ履歴の記録等)。配信はブロックしない。 */
  onSent?: (message: ChatMessage) => void | Promise<unknown>;
  /** 編集/削除対象のメッセージを引く(履歴ストアから)。無ければ編集/削除は失敗。 */
  lookupMessage?: (roomId: string, messageId: string) => Promise<ChatMessage | undefined>;
  /** 編集を履歴へ反映。 */
  onEdited?: (message: ChatMessage) => void | Promise<unknown>;
  /** 削除を履歴へ反映。 */
  onDeleted?: (roomId: string, messageId: string) => void | Promise<unknown>;
  /** リアクションをトグルし、最新カウントを返す(未指定なら react は未対応)。 */
  toggleReactionStore?: (messageId: string, userId: string, kind: string) => Promise<Record<string, number>>;
  /** ピンをトグルし、ピン状態(true=固定)を返す(未指定なら pin は未対応)。 */
  togglePinStore?: (roomId: string, messageId: string, byUserId: string) => Promise<boolean>;
  /** フック中の例外を握る(送信自体は成功扱いのまま)。 */
  onHookError?: (error: unknown) => void;
}

/** 送信入力。 */
export interface GatewaySendInput {
  roomId: string;
  senderId: string;
  text: string;
  replyTo?: string;
  attachments?: Attachment[];
}

/** 送信結果。 */
export type GatewaySendResult = { ok: true; message: ChatMessage } | { ok: false; error: string };

/** チャットゲートウェイ。 */
export interface ChatGateway {
  /** 接続をルームに参加させる(send は受信 1 件ごとに呼ばれる)。 */
  connect(roomId: string, connectionId: string, send: (data: string) => void): Promise<void>;
  /** 接続をルームから外す。 */
  disconnect(roomId: string, connectionId: string): Promise<void>;
  /** メッセージを検証して配信する(NG は publish しない)。 */
  send(input: GatewaySendInput): Promise<GatewaySendResult>;
  /** そのインスタンスでのローカル接続数。 */
  onlineCount(roomId: string): number;
  /** 入力中の合図をルームへ同報する(メッセージとは別の封筒 { typing:true })。 */
  publishTyping(roomId: string, userId: string): Promise<void>;
  /** メッセージを編集する(本人/管理者のみ)。編集後を同報。 */
  edit(input: { roomId: string; messageId: string; editorId: string; text: string; isAdmin?: boolean }): Promise<GatewaySendResult>;
  /** メッセージを削除する(本人/管理者のみ)。削除を同報。 */
  remove(input: { roomId: string; messageId: string; editorId: string; isAdmin?: boolean }): Promise<{ ok: true } | { ok: false; error: string }>;
  /** リアクションをトグルし、最新カウントを全接続へ同報する。 */
  react(input: { roomId: string; messageId: string; userId: string; kind: string }): Promise<{ ok: true; counts: Record<string, number> } | { ok: false; error: string }>;
  /** ピンをトグルし、状態を全接続へ同報する。 */
  pin(input: { roomId: string; messageId: string; userId: string }): Promise<{ ok: true; pinned: boolean } | { ok: false; error: string }>;
}

/** ゲートウェイを生成する。 */
export function createChatGateway(opts: ChatGatewayOptions): ChatGateway {
  const { hub, newId, onMentions, attachmentLimits, onHookError, onSent, lookupMessage, onEdited, onDeleted, toggleReactionStore, togglePinStore } = opts;
  return {
    async connect(roomId, connectionId, send) {
      await hub.subscribe(roomChannel(roomId), connectionId, send);
    },
    async disconnect(roomId, connectionId) {
      await hub.unsubscribe(roomChannel(roomId), connectionId);
    },
    async send(input) {
      if (attachmentLimits && input.attachments && input.attachments.length > 0) {
        const v = validateAttachments(input.attachments, attachmentLimits);
        if (!v.ok) return v;
      }
      const created = createMessage({ id: newId(), roomId: input.roomId, senderId: input.senderId, text: input.text, replyTo: input.replyTo, attachments: input.attachments });
      if (!created.ok) return created;
      await hub.publish(roomChannel(input.roomId), created.message);
      if (onSent) {
        try {
          await onSent(created.message);
        } catch (e) {
          onHookError?.(e);
        }
      }
      const handles = extractMentions(created.message.text);
      if (onMentions && handles.length > 0) {
        try {
          await onMentions(created.message, handles);
        } catch (e) {
          onHookError?.(e);
        }
      }
      return { ok: true, message: created.message };
    },
    onlineCount(roomId) {
      return hub.localCount(roomChannel(roomId));
    },
    async publishTyping(roomId, userId) {
      await hub.publish(roomChannel(roomId), { typing: true, roomId, userId, at: new Date().toISOString() });
    },
    async edit(input) {
      if (!lookupMessage) return { ok: false, error: "編集は未対応です" };
      const target = await lookupMessage(input.roomId, input.messageId);
      if (!target) return { ok: false, error: "メッセージが見つかりません" };
      if (!canModifyMessage(target, input.editorId, input.isAdmin ?? false)) return { ok: false, error: "編集する権限がありません" };
      const edited = editMessage(target, input.text);
      if (!edited.ok) return edited;
      if (onEdited) {
        try { await onEdited(edited.message); } catch (e) { onHookError?.(e); }
      }
      await hub.publish(roomChannel(input.roomId), { edit: true, message: edited.message });
      return { ok: true, message: edited.message };
    },
    async remove(input) {
      if (!lookupMessage) return { ok: false, error: "削除は未対応です" };
      const target = await lookupMessage(input.roomId, input.messageId);
      if (!target) return { ok: false, error: "メッセージが見つかりません" };
      if (!canModifyMessage(target, input.editorId, input.isAdmin ?? false)) return { ok: false, error: "削除する権限がありません" };
      if (onDeleted) {
        try { await onDeleted(input.roomId, input.messageId); } catch (e) { onHookError?.(e); }
      }
      await hub.publish(roomChannel(input.roomId), { delete: true, id: input.messageId, roomId: input.roomId });
      return { ok: true };
    },
    async react(input) {
      if (!toggleReactionStore) return { ok: false, error: "リアクションは未対応です" };
      const counts = await toggleReactionStore(input.messageId, input.userId, input.kind);
      await hub.publish(roomChannel(input.roomId), { reaction: true, messageId: input.messageId, roomId: input.roomId, counts });
      return { ok: true, counts };
    },
    async pin(input) {
      if (!togglePinStore) return { ok: false, error: "ピンは未対応です" };
      const pinned = await togglePinStore(input.roomId, input.messageId, input.userId);
      await hub.publish(roomChannel(input.roomId), { pin: true, messageId: input.messageId, roomId: input.roomId, pinned });
      return { ok: true, pinned };
    },
  };
}
