/**
 * チャットの具体配線。既定はシングルインスタンス（プロセス内 Pub/Sub・メモリ storage）で、
 * 複数インスタンス構成では Pub/Sub を Redis（ioredis 等）に、保存を createLocalStorage / createS3Storage に
 * 差し替えるだけでよい（gateway・route は無変更）。
 * @packageDocumentation
 */
import { createBroadcastHub, type RedisPubSubClient } from "@platform/realtime";
import { createStorage, type StorageAdapter, type Storage } from "@platform/storage";
import { createNotifier, type Notifier } from "@platform/notify";
import { createSearch, createMemorySearch } from "@platform/search";
import { createImageProcessor } from "@platform/image";
import { createGuardedJob } from "@platform/cron";
import { createChatGateway, type ChatGateway } from "./chat-gateway.js";
import { buildMentionNotifier } from "./chat-notify.js";
import { createMemoryChatStore, type ChatStore } from "./chat-store.js";
import { createPrismaChatStore, type ChatStoreDb } from "./chat-store-prisma.js";
import { createMemoryRoomRepo, type RoomRepository } from "./chat-rooms.js";
import { createPresenceTracker, type PresenceTracker } from "./chat-presence.js";
import { createChatSearch, type ChatSearch } from "./chat-search.js";
import { buildUnreadDigest } from "./chat-digest.js";
import { notificationCenter, auditActions, preferenceStore } from "./platform-services.js";
import { decideDelivery, hasChannel } from "./notification-prefs.js";
import { createMemoryReactionStore, createPrismaReactionStore, type ReactionStore, type ReactionStoreDb } from "./chat-reactions.js";
import { createMemoryPinStore, createPrismaPinStore, type PinStore, type PinStoreDb } from "./chat-pins.js";
import { createMentionInbox, type MentionInbox } from "./chat-mentions.js";
import { createThumbnailService, type ThumbnailService } from "./chat-thumbnails.js";
import { createBoardService, type BoardService } from "./board.js";
import { mailer, db } from "./services.js";
import { useChatPrisma } from "./env.js";

/**
 * プロセス内 Pub/Sub。単一インスタンスならこれで動く。水平スケール時は
 * ioredis の publish/subscribe/unsubscribe を実装した RedisPubSubClient に差し替える。
 */
function inProcessPubSub(): RedisPubSubClient {
  const handlers = new Map<string, ((message: string) => void)[]>();
  return {
    publish(channel, message) {
      for (const h of handlers.get(channel) ?? []) h(message);
    },
    subscribe(channel, handler) {
      const list = handlers.get(channel) ?? [];
      list.push(handler);
      handlers.set(channel, list);
    },
    unsubscribe(channel) {
      handlers.delete(channel);
    },
  };
}

/**
 * メモリ storage アダプタ。本番は createLocalStorage(root) か createS3Storage(...) に差し替える。
 */
function memoryStorageAdapter(): StorageAdapter {
  const store = new Map<string, Uint8Array>();
  return {
    async put(key, body) {
      store.set(key, body);
    },
    async get(key) {
      const v = store.get(key);
      if (!v) throw new Error(`ファイルが見つかりません: ${key}`);
      return v;
    },
    async delete(key) {
      store.delete(key);
    },
    async exists(key) {
      return store.has(key);
    },
    async list(prefix = "") {
      return [...store.keys()].filter((k) => k.startsWith(prefix));
    },
  };
}

/** チャット添付の保存先。 */
export const chatStorage: Storage = createStorage(memoryStorageAdapter());

/**
 * メンション名 → メールアドレスの対応表。実運用ではユーザーストアから解決する。
 * ここに登録された handle だけがメンション通知の対象になる（未登録は通知されない）。
 */
export const mentionDirectory = new Map<string, string>();

/** その人のメール宛に通知する Notifier を作る。 */
function mailNotifier(email: string): Notifier {
  const channel = {
    async send(message: { text: string }) {
      const res = await mailer.sendMail({ to: email, subject: "メンション通知", text: message.text });
      if (!res.ok) throw res.error;
    },
  };
  return createNotifier([channel]);
}

export const mentionNotifier = buildMentionNotifier({
  notifierFor: (handle) => {
    const email = mentionDirectory.get(handle);
    return email ? mailNotifier(email) : undefined;
  },
  senderName: (id) => id,
});

/**
 * メンション通知（メール送信 + 通知センターへの記録）。onMentions に渡す。
 * ハンドルは mentionDirectory でメール（= 通知センターのユーザーID）に解決する。
 */
async function notifyMentions(ctx: { senderId: string; text: string; contextId?: string }, handles: string[]): Promise<{ notified: string[]; skipped: string[] }> {
  const notified: string[] = [];
  const skipped: string[] = [];
  for (const handle of handles) {
    const email = mentionDirectory.get(handle);
    if (!email || email === ctx.senderId) {
      skipped.push(handle);
      continue;
    }
    // ユーザーの配信設定を尊重(mention カテゴリ)
    const decision = await decideDelivery(preferenceStore, email, { category: "mention" });
    let delivered = false;
    if (hasChannel(decision, "inApp")) {
      const notification: { title: string; body: string; kind: "mention"; href?: string } = {
        title: `${ctx.senderId} さんからメンション`,
        body: ctx.text.slice(0, 80),
        kind: "mention",
      };
      if (ctx.contextId) notification.href = `/chat/${ctx.contextId}`;
      await notificationCenter.notify(email, notification);
      delivered = true;
    }
    if (hasChannel(decision, "email")) {
      const notifier = mentionDirectory.has(handle) ? mailNotifier(email) : undefined;
      if (notifier) {
        await notifier.notify({ text: `${ctx.senderId} さんがあなたをメンションしました: ${ctx.text.slice(0, 80)}`, level: "info" });
        delivered = true;
      }
    }
    (delivered ? notified : skipped).push(handle);
  }
  return { notified, skipped };
}

const hub = createBroadcastHub(inProcessPubSub());
let seq = 0;

/**
 * チャット履歴・既読ストア。既定はインメモリ。`CHAT_PERSISTENCE=prisma` かつ Prisma に
 * ChatMessageRow/MessageReadRow を生成済みなら、`createPrismaChatStore(db as ...)` に切り替える。
 */
export const chatStore: ChatStore =
  useChatPrisma
    ? createPrismaChatStore(db as unknown as ChatStoreDb, { keepPerRoom: 500 })
    : createMemoryChatStore({ keepPerRoom: 500 });

/** ルーム・メンバーのリポジトリ(既定インメモリ・Prisma 差し替え可)。 */
export const roomRepo: RoomRepository = createMemoryRoomRepo();

/** プレゼンス(オンライン/タイピング)トラッカー。 */
export const presence: PresenceTracker = createPresenceTracker();

/** 全文検索(メッセージ/投稿は別索引)。本番は createMeilisearchAdapter に差し替え可能。 */
export const chatSearch: ChatSearch = createChatSearch({
  messageSearch: createSearch(createMemorySearch({ fieldBoosts: { text: 2 } })),
  postSearch: createSearch(createMemorySearch({ fieldBoosts: { body: 2 } })),
});

/** メッセージのリアクション保存(CHAT_PERSISTENCE=prisma で Prisma 実装)。 */
export const reactionStore: ReactionStore =
  useChatPrisma
    ? createPrismaReactionStore(db as unknown as ReactionStoreDb)
    : createMemoryReactionStore();

/** ピン留め・ブックマークの保存(CHAT_PERSISTENCE=prisma で Prisma 実装)。 */
export const pinStore: PinStore =
  useChatPrisma
    ? createPrismaPinStore(db as unknown as PinStoreDb)
    : createMemoryPinStore();

/** メンション受信箱(未読メンション集計・一覧)。 */
export const mentionInbox: MentionInbox = createMentionInbox({ store: chatStore, roomRepo });

/** 画像添付のサムネイル生成(sharp + chatStorage)。 */
export const thumbnailService: ThumbnailService = createThumbnailService({
  processor: createImageProcessor(),
  storage: chatStorage,
  maxSize: 240,
});

/** アプリ全体で共有するチャットゲートウェイ。 */
export const chatGateway: ChatGateway = createChatGateway({
  hub,
  newId: () => `msg_${Date.now()}_${++seq}`,
  // ChatMessage → MentionContext に写像して共通通知器へ
  onMentions: (message, handles) => notifyMentions({ senderId: message.senderId, text: message.text, contextId: message.roomId }, handles),
  // 配信後に履歴へ記録(未読数算出)+ 全文検索へ索引
  onSent: async (message) => {
    await chatStore.append(message);
    await chatSearch.indexMessage(message);
  },
  // 編集/削除は履歴から対象を引く(直近キャッシュ内)
  lookupMessage: async (roomId, messageId) => (await chatStore.recent(roomId)).find((m) => m.id === messageId),
  onEdited: async (message) => {
    await chatStore.update(message);
    await chatSearch.indexMessage(message);
  },
  onDeleted: async (roomId, messageId) => {
    await chatStore.remove(roomId, messageId);
    await chatSearch.removeMessage(messageId);
  },
  toggleReactionStore: (messageId, userId, kind) => reactionStore.toggle(messageId, userId, kind),
  togglePinStore: (roomId, messageId, byUserId) => pinStore.togglePin(roomId, messageId, byUserId),
  attachmentLimits: { maxCount: 5, maxSizeBytes: 10_000_000, allowedTypes: ["image/", "application/pdf"] },
  onHookError: (e) => console.error("チャットのフック処理に失敗", e),
});

/** 掲示板サービス(投稿検証 + メンション通知)。chat と同じ通知器を再利用。 */
export const boardService: BoardService = createBoardService({
  newId: () => `post_${Date.now()}_${++seq}`,
  onMentions: notifyMentions,
  onPosted: async (post, threadId) => {
    if (threadId) await chatSearch.indexPost(post, threadId);
  },
  attachmentLimits: { maxCount: 5, maxSizeBytes: 10_000_000, allowedTypes: ["image/", "application/pdf"] },
  onHookError: (e) => console.error("掲示板のフック処理に失敗", e),
});

/** 未読ダイジェスト送信(cron から呼ぶ)。宛先メールは mentionDirectory を流用。 */
export const sendUnreadDigest = buildUnreadDigest({
  store: chatStore,
  roomRepo,
  notifierFor: (userId) => {
    const email = mentionDirectory.get(userId) ?? userId;
    return email.includes("@") ? mailNotifier(email) : undefined;
  },
});

/**
 * 未読ダイジェストの定期ジョブ。`digestUsers()` が対象ユーザーを返す(既定は空=無効)。
 * scheduler で `unreadDigestJob.run()` を定期起動する(例: 毎朝)。
 */
export let digestUsers: () => string[] = () => [];
/** ダイジェスト対象ユーザーの供給元を差し替える。 */
export function setDigestUsers(fn: () => string[]): void {
  digestUsers = fn;
}
export const unreadDigestJob = createGuardedJob({
  name: "chat-unread-digest",
  preventOverlap: true,
  jitterMs: 2_000,
  handler: async () => {
    await sendUnreadDigest(digestUsers());
  },
  onError: (name, error) => console.error(`${name} 失敗`, error),
});
