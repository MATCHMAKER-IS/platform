/**
 * ピン留め(ルーム共有)とブックマーク(個人)の純ロジック。トグル・判定・一覧整列。
 * @packageDocumentation
 */

/** ピン留め(ルーム内で 1 メッセージ 1 件・全員に見える)。 */
export interface Pin {
  roomId: string;
  messageId: string;
  /** 固定した人。 */
  pinnedBy: string;
  pinnedAt: string;
}

/** ブックマーク(ユーザーごとの保存)。 */
export interface Bookmark {
  userId: string;
  messageId: string;
  roomId: string;
  at: string;
}

/** ピンをトグルする(同じ (roomId, messageId) が既にあれば解除)。 */
export function togglePin(pins: Pin[], pin: Pin): Pin[] {
  const exists = pins.some((p) => p.roomId === pin.roomId && p.messageId === pin.messageId);
  if (exists) return pins.filter((p) => !(p.roomId === pin.roomId && p.messageId === pin.messageId));
  return [...pins, pin];
}

/** そのメッセージがピン留めされているか。 */
export function isPinned(pins: Pin[], roomId: string, messageId: string): boolean {
  return pins.some((p) => p.roomId === roomId && p.messageId === messageId);
}

/** ルームのピン留めを新しい順で返す。 */
export function pinsOf(pins: Pin[], roomId: string): Pin[] {
  return pins.filter((p) => p.roomId === roomId).sort((a, b) => (a.pinnedAt > b.pinnedAt ? -1 : a.pinnedAt < b.pinnedAt ? 1 : 0));
}

/** ブックマークをトグルする(同じ (userId, messageId) が既にあれば解除)。 */
export function toggleBookmark(bookmarks: Bookmark[], bookmark: Bookmark): Bookmark[] {
  const exists = bookmarks.some((b) => b.userId === bookmark.userId && b.messageId === bookmark.messageId);
  if (exists) return bookmarks.filter((b) => !(b.userId === bookmark.userId && b.messageId === bookmark.messageId));
  return [...bookmarks, bookmark];
}

/** そのメッセージをユーザーがブックマークしているか。 */
export function isBookmarked(bookmarks: Bookmark[], userId: string, messageId: string): boolean {
  return bookmarks.some((b) => b.userId === userId && b.messageId === messageId);
}

/** ユーザーのブックマークを新しい順で返す。 */
export function bookmarksOf(bookmarks: Bookmark[], userId: string): Bookmark[] {
  return bookmarks.filter((b) => b.userId === userId).sort((a, b) => (a.at > b.at ? -1 : a.at < b.at ? 1 : 0));
}
