/**
 * 未読ダイジェスト。ユーザーごとに未読数を集計し、まとめて 1 通の通知を送る。
 * @platform/cron の guarded job で定期実行する（配線は chat.ts）。
 * @packageDocumentation
 */
import { type Notifier, renderTemplate } from "@platform/notify";
import { type ChatStore } from "./chat-store";
import { type RoomRepository } from "./chat-rooms";

/** ダイジェストの構成。 */
export interface UnreadDigestOptions {
  store: ChatStore;
  roomRepo: RoomRepository;
  /** userId からその人の通知口を解決。無ければ送らない。 */
  notifierFor: (userId: string) => Notifier | undefined;
  /** ルーム ID → 表示名。 */
  roomName?: (roomId: string) => string;
  /** 本文テンプレート。{{count}} {{rooms}} を使える。 */
  template?: string;
}

/** ダイジェスト結果。 */
export interface DigestResult {
  /** 通知したユーザー。 */
  notified: string[];
  /** 送らなかったユーザー(未読なし・通知口なし・失敗)。 */
  skipped: string[];
}

/** 未読ダイジェスト送信関数を作る。 */
export function buildUnreadDigest(opts: UnreadDigestOptions): (userIds: string[]) => Promise<DigestResult> {
  const template = opts.template ?? "未読が {{count}} 件あります（{{rooms}}）";
  const nameOf = opts.roomName ?? ((id: string) => id);
  return async (userIds) => {
    const notified: string[] = [];
    const skipped: string[] = [];
    for (const userId of userIds) {
      const roomIds = await opts.roomRepo.roomIdsForUser(userId);
      const unread = await opts.store.unreadFor(userId, roomIds);
      const withUnread = unread.filter((u) => u.unread > 0);
      const total = withUnread.reduce((sum, u) => sum + u.unread, 0);
      if (total === 0) {
        skipped.push(userId);
        continue;
      }
      const notifier = opts.notifierFor(userId);
      if (!notifier) {
        skipped.push(userId);
        continue;
      }
      const roomsText = withUnread
        .slice()
        .sort((a, b) => b.unread - a.unread)
        .map((u) => `${nameOf(u.roomId)}: ${u.unread}`)
        .join("、");
      const text = renderTemplate(template, { count: total, rooms: roomsText });
      const res = await notifier.notify({ text, level: "info" });
      if (res.ok) notified.push(userId);
      else skipped.push(userId);
    }
    return { notified, skipped };
  };
}
