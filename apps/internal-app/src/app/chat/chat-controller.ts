/**
 * チャットのクライアント制御(フレームワーク非依存)。SSE(EventSource)でルームを購読し、
 * 受信メッセージを整列・重複排除して保持する。送信・既読は fetch で API を叩く。
 * EventSource / fetch は注入可能でテストしやすい。React からはこの購読を薄くラップする。
 * @packageDocumentation
 */
import { sortMessages, type ChatMessage, type Attachment } from "@platform/chat";

/** EventSource の最小インターフェース(ブラウザ標準 / テスト用フェイク)。 */
export interface EventSourceLike {
  onmessage: ((ev: { data: string }) => void) | null;
  onerror: ((ev?: unknown) => void) | null;
  close(): void;
}

/** 制御の構成。 */
export interface ChatControllerOptions {
  roomId: string;
  /** 状態が変わるたびに呼ばれる(現在のメッセージ一覧)。 */
  onChange?: (messages: ChatMessage[]) => void;
  /** 接続エラー時。 */
  onError?: (error: unknown) => void;
  /** 他ユーザーの入力中を受け取る。 */
  onTyping?: (userId: string) => void;
  /** リアクションの最新カウントを受け取る。 */
  onReaction?: (messageId: string, counts: Record<string, number>) => void;
  /** ピン状態の変化を受け取る。 */
  onPin?: (messageId: string, pinned: boolean) => void;
  /** EventSource 実装(既定はグローバル)。 */
  EventSourceImpl?: new (url: string) => EventSourceLike;
  /** fetch 実装(既定はグローバル)。 */
  fetchImpl?: typeof fetch;
  /** API のベースパス(既定 "/api/chat")。 */
  basePath?: string;
}

/** チャット制御。 */
export interface ChatController {
  /** 購読を開始する。 */
  start(): void;
  /** メッセージを送信する(サーバが配信し、SSE で自分にも返る)。 */
  send(text: string, attachments?: Attachment[]): Promise<{ ok: boolean; error?: string }>;
  /** ルームを既読にする。 */
  markRead(at?: string): Promise<void>;
  /** 入力中を通知する。 */
  sendTyping(): Promise<void>;
  /** 自分のメッセージを編集する。 */
  editMessage(messageId: string, text: string): Promise<{ ok: boolean; error?: string }>;
  /** 自分のメッセージを削除する。 */
  deleteMessage(messageId: string): Promise<{ ok: boolean; error?: string }>;
  /** メッセージにリアクションする(トグル)。 */
  react(messageId: string, kind: string): Promise<{ ok: boolean; error?: string }>;
  /** 現在のメッセージ一覧(古い→新しい)。 */
  messages(): ChatMessage[];
  /** 購読を終了する。 */
  close(): void;
}

/** チャット制御を生成する。 */
export function createChatController(opts: ChatControllerOptions): ChatController {
  const base = opts.basePath ?? "/api/chat";
  const ES = opts.EventSourceImpl ?? (globalThis as unknown as { EventSource?: new (url: string) => EventSourceLike }).EventSource;
  const doFetch = opts.fetchImpl ?? (globalThis as unknown as { fetch: typeof fetch }).fetch;
  const roomId = opts.roomId;

  let source: EventSourceLike | null = null;
  const seen = new Set<string>();
  let list: ChatMessage[] = [];

  const emit = () => opts.onChange?.(list.slice());

  const ingest = (message: ChatMessage) => {
    if (seen.has(message.id)) return;
    seen.add(message.id);
    list = sortMessages([...list, message]);
    emit();
  };

  const replaceMessage = (message: ChatMessage) => {
    const i = list.findIndex((m) => m.id === message.id);
    if (i >= 0) {
      list = list.slice();
      list[i] = message;
      emit();
    }
  };

  const removeMessage = (id: string) => {
    if (!seen.has(id)) return;
    seen.delete(id);
    list = list.filter((m) => m.id !== id);
    emit();
  };

  return {
    start() {
      if (!ES) throw new Error("EventSource が利用できません");
      const url = `${base}/rooms/${encodeURIComponent(roomId)}/stream`;
      const es = new ES(url);
      es.onmessage = (ev) => {
        try {
          const payload = JSON.parse(ev.data) as
            | ChatMessage
            | { typing: true; userId: string }
            | { edit: true; message: ChatMessage }
            | { delete: true; id: string }
            | { reaction: true; messageId: string; counts: Record<string, number> }
            | { pin: true; messageId: string; pinned: boolean };
          if ("typing" in payload && payload.typing) {
            opts.onTyping?.(payload.userId);
            return;
          }
          if ("edit" in payload && payload.edit) {
            replaceMessage(payload.message);
            return;
          }
          if ("delete" in payload && payload.delete) {
            removeMessage(payload.id);
            return;
          }
          if ("reaction" in payload && payload.reaction) {
            opts.onReaction?.(payload.messageId, payload.counts);
            return;
          }
          if ("pin" in payload && payload.pin) {
            opts.onPin?.(payload.messageId, payload.pinned);
            return;
          }
          ingest(payload as ChatMessage);
        } catch {
          /* open イベント等・JSON でない行は無視 */
        }
      };
      es.onerror = (e) => opts.onError?.(e);
      source = es;
    },
    async send(text, attachments) {
      const res = await doFetch(`${base}/rooms/${encodeURIComponent(roomId)}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, ...(attachments && attachments.length ? { attachments } : {}) }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        return { ok: false, error: data.error ?? `送信に失敗しました (${res.status})` };
      }
      return { ok: true };
    },
    async markRead(at) {
      await doFetch(`${base}/rooms/${encodeURIComponent(roomId)}/read`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ at: at ?? new Date().toISOString() }),
      });
    },
    async sendTyping() {
      await doFetch(`${base}/rooms/${encodeURIComponent(roomId)}/typing`, { method: "POST" });
    },
    async editMessage(messageId, text) {
      const res = await doFetch(`${base}/rooms/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(messageId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        return { ok: false, error: data.error ?? `編集に失敗しました (${res.status})` };
      }
      return { ok: true };
    },
    async deleteMessage(messageId) {
      const res = await doFetch(`${base}/rooms/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(messageId)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        return { ok: false, error: data.error ?? `削除に失敗しました (${res.status})` };
      }
      return { ok: true };
    },
    async react(messageId, kind) {
      const res = await doFetch(`${base}/rooms/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(messageId)}/reactions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        return { ok: false, error: data.error ?? `リアクションに失敗しました (${res.status})` };
      }
      return { ok: true };
    },
    messages() {
      return list.slice();
    },
    close() {
      source?.close();
      source = null;
    },
  };
}
